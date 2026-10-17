//! Process guards (cli-spec.md §5.2.5, §7.3, §7.4): the counting allocator
//! that enforces `max-memory-bytes`, the wall-clock watchdog for
//! `timeout-ms`, the SIGTERM/SIGINT/SIGHUP handlers, the Linux `RLIMIT_AS`
//! backstop, and the raw writes and `_exit` they end with.
//!
//! This is the only module that uses `unsafe`, each block for one libc call
//! or for the `GlobalAlloc` contract.

use std::alloc::{GlobalAlloc, Layout, System};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicUsize, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

static LIVE: AtomicUsize = AtomicUsize::new(0);
static LIMIT: AtomicUsize = AtomicUsize::new(usize::MAX);
static OUT_OF_MEMORY: OnceLock<(Vec<u8>, Vec<u8>)> = OnceLock::new();
static SIGNAL: AtomicI32 = AtomicI32::new(0);
static CHILD_GROUP: AtomicI32 = AtomicI32::new(0);
static STDOUT_TAKEN: AtomicBool = AtomicBool::new(false);
static TEMP_FILE: Mutex<Option<PathBuf>> = Mutex::new(None);

/// A global allocator that counts live heap bytes and refuses to go over
/// `max-memory-bytes`: it writes the pre-serialized `CliErrorA0` and
/// diagnostic without allocating, then `_exit(4)`.
pub struct CountingAllocator;

/// What a thread takes from [`LIVE`] at a time. Each thread keeps between 0
/// and twice this as its own spare, so [`LIVE`] can run ahead of the real heap
/// by at most twice this per thread, and the threads that run the parse
/// stage's producers do not all update one atomic on every allocation.
const CREDIT_CHUNK: usize = 1 << 20;

thread_local! {
    /// Bytes this thread holds in [`LIVE`] but has not allocated yet. A
    /// `const`-initialized `Cell` has no destructor, so reading it never
    /// allocates; a thread's spare at exit stays counted (at most
    /// `2 * CREDIT_CHUNK`).
    static CREDIT: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

fn reserve_shared(bytes: usize) -> bool {
    let before = LIVE.fetch_add(bytes, Ordering::Relaxed);
    if before.saturating_add(bytes) > LIMIT.load(Ordering::Relaxed) {
        LIVE.fetch_sub(bytes, Ordering::Relaxed);
        return false;
    }
    true
}

fn reserve(bytes: usize) -> bool {
    CREDIT
        .try_with(|credit| {
            let have = credit.get();
            if have >= bytes {
                credit.set(have - bytes);
                return true;
            }
            let missing = bytes - have;
            // Take a chunk more than is missing, so the next allocations stay
            // local; near the limit, take exactly what is missing.
            if reserve_shared(missing.saturating_add(CREDIT_CHUNK)) {
                credit.set(CREDIT_CHUNK);
                true
            } else if reserve_shared(missing) {
                credit.set(0);
                true
            } else {
                false
            }
        })
        .unwrap_or_else(|_| reserve_shared(bytes))
}

fn release(bytes: usize) {
    let returned = CREDIT.try_with(|credit| {
        let have = credit.get().saturating_add(bytes);
        if have > 2 * CREDIT_CHUNK {
            credit.set(CREDIT_CHUNK);
            have - CREDIT_CHUNK
        } else {
            credit.set(have);
            0
        }
    });
    match returned {
        Ok(0) => {}
        Ok(excess) => {
            LIVE.fetch_sub(excess, Ordering::Relaxed);
        }
        Err(_) => {
            LIVE.fetch_sub(bytes, Ordering::Relaxed);
        }
    }
}

/// Write `bytes` to file descriptor `fd` with `write(2)`, retrying partial
/// writes; allocates nothing.
pub fn raw_write(fd: i32, mut bytes: &[u8]) -> bool {
    while !bytes.is_empty() {
        // SAFETY: the pointer and length describe a live slice.
        let written = unsafe { libc::write(fd, bytes.as_ptr().cast(), bytes.len()) };
        let Ok(written) = usize::try_from(written) else {
            return false;
        };
        if written == 0 {
            return false;
        }
        bytes = &bytes[written..];
    }
    true
}

/// End the process at once with `code`, running no destructor or handler.
pub fn exit_now(code: i32) -> ! {
    // SAFETY: `_exit` takes any status and never returns.
    unsafe { libc::_exit(code) }
}

fn out_of_memory() -> ! {
    if let Some((stdout, stderr)) = OUT_OF_MEMORY.get()
        && !STDOUT_TAKEN.swap(true, Ordering::SeqCst)
    {
        raw_write(1, stdout);
        raw_write(2, stderr);
    }
    remove_temp_file();
    exit_now(4)
}

// SAFETY: every method forwards to `System` with the caller's layout and
// pointers unchanged; the counter only decides whether to call it.
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if !reserve(layout.size()) {
            out_of_memory();
        }
        // SAFETY: forwarded under the caller's contract.
        let pointer = unsafe { System.alloc(layout) };
        if pointer.is_null() {
            release(layout.size());
        }
        pointer
    }

    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        if !reserve(layout.size()) {
            out_of_memory();
        }
        // SAFETY: forwarded under the caller's contract.
        let pointer = unsafe { System.alloc_zeroed(layout) };
        if pointer.is_null() {
            release(layout.size());
        }
        pointer
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        // SAFETY: forwarded under the caller's contract.
        unsafe { System.dealloc(pointer, layout) };
        release(layout.size());
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        let old = layout.size();
        if new_size > old && !reserve(new_size - old) {
            out_of_memory();
        }
        // SAFETY: forwarded under the caller's contract.
        let moved = unsafe { System.realloc(pointer, layout, new_size) };
        if moved.is_null() {
            if new_size > old {
                release(new_size - old);
            }
        } else if new_size < old {
            release(old - new_size);
        }
        moved
    }
}

/// Arm the memory cap at `limit` bytes. `stdout` and `stderr` are the
/// documents written when an allocation would cross it.
pub fn arm_memory_cap(limit: u64, stdout: Vec<u8>, stderr: Vec<u8>, threads: u64) {
    let _ = OUT_OF_MEMORY.set((stdout, stderr));
    LIMIT.store(
        usize::try_from(limit).unwrap_or(usize::MAX),
        Ordering::SeqCst,
    );
    address_space_backstop(limit, threads);
}

#[cfg(target_os = "linux")]
fn address_space_backstop(limit: u64, threads: u64) {
    let margin = (1u64 << 30) + (128u64 << 20) * threads.max(1);
    let bound = limit.saturating_add(margin);
    let value = libc::rlimit {
        rlim_cur: bound,
        rlim_max: bound,
    };
    // SAFETY: `setrlimit` reads one valid `rlimit`.
    unsafe {
        libc::setrlimit(libc::RLIMIT_AS, &value);
    }
}

#[cfg(not(target_os = "linux"))]
fn address_space_backstop(_limit: u64, _threads: u64) {}

/// Claim stdout for the one document of this invocation. Returns false when
/// a guard already wrote it.
pub fn take_stdout() -> bool {
    !STDOUT_TAKEN.swap(true, Ordering::SeqCst)
}

/// Remember the temp file to remove on a timeout or signal.
pub fn register_temp_file(path: Option<PathBuf>) {
    if let Ok(mut slot) = TEMP_FILE.lock() {
        *slot = path;
    }
}

/// Remove the registered temp file, if any.
pub fn remove_temp_file() {
    if let Ok(mut slot) = TEMP_FILE.try_lock()
        && let Some(path) = slot.take()
    {
        let _ = std::fs::remove_file(path);
    }
}

/// Remember the process group of a running `git`, for the watchdog.
pub fn set_child_group(group: i32) {
    CHILD_GROUP.store(group, Ordering::SeqCst);
}

fn kill_child_group() {
    let group = CHILD_GROUP.load(Ordering::SeqCst);
    if group > 0 {
        // SAFETY: `kill` with a negative pid signals that process group.
        unsafe {
            libc::kill(-group, libc::SIGKILL);
        }
    }
}

extern "C" fn on_signal(signal: libc::c_int) {
    SIGNAL.store(signal, Ordering::SeqCst);
}

/// Install the SIGTERM, SIGINT and SIGHUP handlers.
pub fn install_signal_handlers() {
    let handler = on_signal as extern "C" fn(libc::c_int) as libc::sighandler_t;
    for signal in [libc::SIGTERM, libc::SIGINT, libc::SIGHUP] {
        // SAFETY: the handler only stores into an atomic.
        unsafe {
            libc::signal(signal, handler);
        }
    }
}

/// Start the watchdog: at `deadline` it removes the temp file, kills a
/// running `git`, writes the timeout documents and exits 5; on a signal it
/// removes the temp file and exits 128+n without a document.
pub fn start_watchdog(started: Instant, timeout: Duration, stdout: Vec<u8>, stderr: Vec<u8>) {
    let deadline = started.checked_add(timeout);
    let spawned = std::thread::Builder::new()
        .name("prism-kicad-watchdog".to_owned())
        .spawn(move || {
            loop {
                let signal = SIGNAL.load(Ordering::SeqCst);
                if signal != 0 {
                    kill_child_group();
                    remove_temp_file();
                    exit_now(128 + signal);
                }
                if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
                    kill_child_group();
                    remove_temp_file();
                    if take_stdout() {
                        raw_write(1, &stdout);
                        raw_write(2, &stderr);
                    }
                    exit_now(5);
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });
    // Without a watchdog the backend's outer timeout still applies.
    drop(spawned);
}
