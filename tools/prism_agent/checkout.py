"""Getting a specific commit, branch or tag into the working tree, safely.

"Open this commit" sounds like a one-liner and is not. A checkout moves the files under
KiCad while KiCad may have them open, and it can destroy uncommitted work. Almost all of
this module is the guards, and that is the right proportion.

The rule everything here follows: **never destroy work the user cannot get back.**

A commit is recoverable from git. An uncommitted edit is not. So anything that would
discard uncommitted changes is refused, with a reason and a way forward, rather than
done with a warning. `git checkout` itself is not this careful: it will happily carry
your dirty files onto another branch, and `git checkout -f` will silently delete them.

What is checked, and why each one matters:

  no repo             nothing to check out from
  unknown ref         a typo or a commit from a branch you never fetched: say which
  uncommitted changes the one that loses data. Refused, always.
  unmerged paths      a conflict is already in progress; moving now compounds it
  mid-operation       a rebase/merge/cherry-pick is half-done; git's own state is
                      partial and a checkout leaves it inconsistent
  detached HEAD       fine, but the user should be told they are not on a branch
  KiCad has it open   we cannot detect this reliably, so we say it plainly instead
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)

TIMEOUT = 120

# Marks a stash as one Prism made, so it is recognisable in `git stash list` and in a
# terminal, not just in our own UI. The user's own message follows it.
STASH_PREFIX = "prism: "

# A stash records where it was taken from, so the agent can offer to bring it back when
# the user returns to that branch. git stashes are a global stack, not per-branch, and
# nothing re-applies them: without an origin, a stash made switching away from `main` is
# just work the user has to remember is there. Encoded at the END of the message so the
# user's own text stays readable, and parsed back out by `stashes()`. Shape:
#   prism: <message> [prism-origin: <branch>@<short-sha>]
_ORIGIN_OPEN = " [prism-origin: "
_ORIGIN_CLOSE = "]"


class CheckoutError(Exception):
    """Refused, with a reason the user can act on.

    `code` is the same refusal in a form a caller can branch on. The message is written
    for a person and gets reworded; a UI that has to recognise a specific refusal (to
    offer the remedy for it) must not depend on that wording. Only the refusals a caller
    actually acts on carry one, so an empty code means "just show the message".
    """

    def __init__(self, message: str, code: str = ""):
        super().__init__(message)
        self.code = code


def _git(repo: Path, *args: str, check: bool = True, strip: bool = True) -> str:
    """Run git in `repo` and return stdout.

    `strip=False` for output whose leading whitespace is significant. Porcelain status is
    COLUMN oriented (" M file" means modified-but-unstaged), so stripping it shifts every
    field left and eats the first character of the path: "notes.md" arrives as "otes.md",
    and git then reports a pathspec that matches nothing.
    """
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise CheckoutError(f"Couldn't run git: {exc}") from exc

    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        raise CheckoutError(detail[-1] if detail else "git failed")
    return result.stdout.strip() if strip else result.stdout


def _ok(repo: Path, *args: str) -> bool:
    """Did this git command succeed? For questions, not actions."""
    try:
        subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            timeout=TIMEOUT,
            check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return True


# -- what state is the tree in? --------------------------------------------


def in_progress(repo: Path) -> str:
    """A half-finished git operation, or "".

    Checking out in the middle of one leaves git's own state inconsistent: the
    sequencer files stay behind and the next `git rebase --continue` operates on a tree
    that is no longer what it thinks it is.
    """
    git_dir = Path(_git(repo, "rev-parse", "--git-dir"))
    if not git_dir.is_absolute():
        git_dir = repo / git_dir

    for marker, name in (
        ("rebase-merge", "a rebase"),
        ("rebase-apply", "a rebase"),
        ("MERGE_HEAD", "a merge"),
        ("CHERRY_PICK_HEAD", "a cherry-pick"),
        ("REVERT_HEAD", "a revert"),
        ("BISECT_LOG", "a bisect"),
    ):
        if (git_dir / marker).exists():
            return name
    return ""


def would_be_overwritten(repo: Path, sha: str, untracked: list[str]) -> list[str]:
    """Untracked files that the target commit ALSO has, so a checkout would clobber them.

    The hole in "untracked files always survive a checkout": they survive only if the
    target does not contain a file of the same name. If it does, git refuses outright
    ("The following untracked working tree files would be overwritten by checkout ...
    Aborting"), because writing the committed version would destroy the local one.

    Real, not hypothetical: a KiCad project routinely has `fp-info-cache` untracked in
    one checkout and committed in another, and that alone is enough to abort every
    attempt to open a commit.
    """
    if not sha or not untracked:
        return []
    listing = _git(repo, "ls-tree", "-r", "--name-only", sha, check=False)
    in_target = set(listing.splitlines())
    return sorted(set(untracked) & in_target)


def dirty_files(repo: Path) -> dict:
    """Uncommitted work, split by how recoverable it is.

    Untracked files are called out separately because a checkout usually does NOT destroy
    them (git carries them across), so they must not block one by default. Treating them
    as blocking would make the feature unusable: a KiCad project almost always has some
    untracked output lying around.

    The exception is per-target, so it does not live here: see would_be_overwritten.
    """
    # -z: NUL-separated and UNQUOTED. Without it git wraps any path containing a space
    # in quotes, and `.strip('"')` is not a fix, it is a patch that fails the moment a
    # filename legitimately contains one. A KiCad project called "Git test" produces
    # exactly these paths.
    out = _git(repo, "status", "--porcelain", "-z", strip=False)
    staged, modified, untracked, unmerged = [], [], [], []

    entries = [e for e in out.split("\0") if e]
    i = 0
    while i < len(entries):
        entry = entries[i]
        i += 1
        if len(entry) < 4:
            continue
        x, y, path = entry[0], entry[1], entry[3:]

        # A rename or copy emits its ORIGINAL path as the next entry, with no status
        # prefix. Consume it, or the loop reads a bare filename as a status line and
        # invents a file whose name is its own third character onwards.
        if x in ("R", "C") or y in ("R", "C"):
            i += 1

        if x == "?" and y == "?":
            untracked.append(path)
        elif "U" in (x, y) or (x == "D" and y == "D") or (x == "A" and y == "A"):
            unmerged.append(path)
        else:
            if x != " ":
                staged.append(path)
            if y != " ":
                modified.append(path)

    return {
        "staged": staged,
        "modified": modified,
        "untracked": untracked,
        "unmerged": unmerged,
        # Untracked deliberately excluded: they survive a checkout, so they are not a
        # reason to refuse one.
        "blocking": sorted(set(staged) | set(modified)),
    }


def _default_branch_name(repo: Path) -> str:
    """The repo's default branch (main/master), or "" if it can't be told.

    origin/HEAD is authoritative; a repo with no remote falls back to a local main or
    master. Mirrors projects._default_branch, kept here so checkout has no import cycle
    back to the status module.
    """
    ref = _git(
        repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD", check=False
    )
    if ref:
        return ref.split("/", 1)[1] if "/" in ref else ref
    for name in ("main", "master"):
        if _ok(repo, "show-ref", "--verify", "--quiet", f"refs/heads/{name}"):
            return name
    return ""


def list_branches(repo: str | Path) -> dict:
    """Local and remote-tracking branches, for a switch picker. Read-only.

    Returns ``{current, default, local, remote}``. `current` is the checked-out branch
    (empty on a detached HEAD); `default` is the repo's default branch (main/master), so
    the picker can mark it. Remote branches are the ``origin/…`` refs that have no local
    branch of the same name yet, so the picker can offer "check out a branch someone else
    pushed" without listing every remote twice.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        return {"current": "", "default": "", "local": [], "remote": []}

    current = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    if current == "HEAD":
        current = ""

    local = [
        b.strip()
        for b in _git(
            path, "for-each-ref", "--format=%(refname:short)", "refs/heads", check=False
        ).splitlines()
        if b.strip()
    ]
    local_set = set(local)

    remote = []
    for ref in _git(
        path, "for-each-ref", "--format=%(refname:short)", "refs/remotes", check=False
    ).splitlines():
        ref = ref.strip()
        if not ref or ref.endswith("/HEAD"):
            continue  # origin/HEAD is a symref, not a branch to check out
        if "/" not in ref:
            # A bare remote name with no branch under it. git leaves the directory
            # refs/remotes/<name>/ behind after the refs in it are packed or deleted,
            # and for-each-ref reports it: offering "origin" as something to check out
            # would fail, because it is a remote, not a branch.
            continue
        # origin/feature -> feature; skip it if a local branch already tracks it, the
        # user picks the local one.
        short = ref.split("/", 1)[1]
        if short not in local_set:
            remote.append(ref)

    return {
        "current": current,
        "default": _default_branch_name(path),
        "local": local,
        "remote": remote,
    }


def _remote_tracking_for(repo: Path, name: str) -> str:
    """The single remote-tracking ref a bare branch name would check out, or "".

    `git checkout feature` creates a local branch from `origin/feature` when exactly
    one remote has it. When two remotes do, git refuses as ambiguous rather than
    guessing, so this returns "" in that case too and the caller reports the ref as
    unresolvable instead of silently picking a remote.
    """
    if "/" in name:
        return ""  # already qualified; rev-parse would have found it
    matches = [
        line.strip()
        for line in _git(
            repo,
            "for-each-ref",
            "--format=%(refname:short)",
            f"refs/remotes/*/{name}",
            check=False,
        ).splitlines()
        if line.strip()
    ]
    return matches[0] if len(matches) == 1 else ""


def resolve(repo: Path, ref: str) -> dict:
    """What is this ref, if anything?

    Returns {found, sha, kind, subject}. `kind` distinguishes a branch from a tag from a
    bare sha, because moving to a branch and moving to a commit leave you in genuinely
    different states (on a branch vs detached), and the user should be told which.
    """
    if not ref or not ref.strip():
        raise CheckoutError("No commit or branch given.")
    ref = ref.strip()

    # rev-parse resolves anything: a sha, a branch, a tag, HEAD~3. `^{commit}` forces it
    # to a commit, so an annotated tag resolves to what it points at rather than to the
    # tag object.
    try:
        sha = _git(repo, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}")
    except CheckoutError:
        sha = ""

    # A branch that exists only on the remote does not resolve by its short name: there
    # is no local ref called `feature`, only `origin/feature`. `git checkout feature`
    # still does the right thing (it creates a local branch tracking the remote one),
    # and that is exactly what the picker asks for when you choose a remote branch, so
    # resolving it here is what stops a perfectly real branch being reported as "not a
    # commit, branch or tag in this repository".
    tracking = ""
    if not sha:
        tracking = _remote_tracking_for(repo, ref)
        if tracking:
            try:
                sha = _git(
                    repo, "rev-parse", "--verify", "--quiet", f"{tracking}^{{commit}}"
                )
            except CheckoutError:
                sha = ""

    if not sha:
        return {"found": False, "sha": "", "kind": "", "subject": "", "ref": ref}

    kind = "commit"
    if _ok(repo, "show-ref", "--verify", "--quiet", f"refs/heads/{ref}"):
        kind = "branch"
    elif _ok(repo, "show-ref", "--verify", "--quiet", f"refs/tags/{ref}"):
        kind = "tag"
    elif _ok(repo, "show-ref", "--verify", "--quiet", f"refs/remotes/{ref}"):
        kind = "remote-branch"
    elif tracking:
        # Checking this out creates a local branch of this name, so it behaves as a
        # branch: HEAD stays attached and the user can commit normally.
        kind = "branch"

    subject = _git(repo, "log", "-1", "--format=%s", sha, check=False)
    return {"found": True, "sha": sha, "kind": kind, "subject": subject, "ref": ref}


def status(repo: str | Path, ref: str = "") -> dict:
    """Can we check `ref` out, and if not, why not?

    Read-only. This is what the UI asks before offering a button, so that a refusal is
    explained in advance rather than after the user has committed to the action.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        return {
            "can": False,
            "reason": "not_a_repo",
            "message": "Not a git repository.",
        }

    busy = in_progress(path)
    dirt = dirty_files(path)
    target = resolve(path, ref) if ref else {"found": False}

    current = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    head = _git(path, "rev-parse", "HEAD", check=False)
    detached = current == "HEAD"

    result = {
        "can": True,
        "reason": "",
        "message": "",
        "current_branch": "" if detached else current,
        "detached": detached,
        "head": head,
        "target": target,
        **dirt,
    }

    if busy:
        result.update(
            can=False,
            reason="in_progress",
            message=f"There is {busy} in progress. Finish or abort it first.",
        )
        return result

    if dirt["unmerged"]:
        result.update(
            can=False,
            reason="unmerged",
            message=(
                f"{len(dirt['unmerged'])} file(s) have unresolved conflicts. "
                "Resolve them before moving."
            ),
        )
        return result

    if dirt["blocking"]:
        # THE one that loses data. A commit can always be recovered; an uncommitted edit
        # to a board cannot. So this is a refusal, not a warning.
        result.update(
            can=False,
            reason="dirty",
            message=(
                f"{len(dirt['blocking'])} file(s) have uncommitted changes. "
                "Commit or stash them first."
            ),
        )
        return result

    if ref and not target.get("found"):
        result.update(
            can=False,
            reason="unknown_ref",
            message=(
                f"'{ref}' is not a commit, branch or tag in this repository. "
                "It may be on a branch you have not fetched."
            ),
        )
        return result

    # Same commit as HEAD. That is only "already here" when it would not move HEAD's ref:
    # switching to a DIFFERENT branch that happens to point at the same commit (freshly
    # branched, no divergence yet) still changes which branch you are on, and refusing it
    # is exactly the "I picked a branch and nothing happened" bug. So allow a branch whose
    # name differs from the current one; refuse only a same-commit no-op (the current
    # branch itself, or a bare commit at HEAD).
    if ref and target.get("sha") == head:
        moves_ref = target.get("kind") == "branch" and target.get("ref") != current
        if not moves_ref:
            result.update(
                can=False,
                reason="already_here",
                message="The working tree is already at this commit.",
            )
            return result

    # An untracked file the TARGET also has. Git refuses these outright, and it is right
    # to: writing the committed version would destroy the local one. We have to catch it
    # ourselves, because otherwise git's own "Aborting" is all the user ever sees, and it
    # names neither the file nor the way out.
    clobbered = would_be_overwritten(path, target.get("sha", ""), dirt["untracked"])
    if clobbered:
        result["clobbered"] = clobbered
        result.update(
            can=False,
            reason="untracked_collision",
            message=(
                f"{len(clobbered)} untracked file(s) would be overwritten: "
                f"{', '.join(clobbered[:3])}"
                + (f" and {len(clobbered) - 3} more" if len(clobbered) > 3 else "")
                + ". Set them aside, or delete them."
            ),
        )
        return result

    result["clobbered"] = []
    return result


# -- staging ---------------------------------------------------------------


def _is_noise(path: str) -> bool:
    """Is this a KiCad backup or generated file, not the user's design work?

    Loaded lazily from worktree_diff (which pulls the backend's classifier the same
    way the diff services do), so the classification the panel shows and the one
    staging uses are the same. Falls back to "not noise" if it cannot be loaded,
    the safe default: a design file wrongly hidden is worse than one shown.
    """
    try:
        from .worktree_diff import _is_noise as classify
    except Exception:
        return False
    try:
        return bool(classify(path))
    except Exception:
        return False


def stage(repo: str | Path, paths: list[str]) -> dict:
    """Stage the named paths. Works for modified and untracked files alike.

    A rename is two paths to git (the delete of the old name and the add of the new);
    the caller passes both, and `git add` on each does the right thing. `--` keeps a
    path that looks like a flag or a ref from being reinterpreted as one.
    """
    path = Path(repo)
    cleaned = [p for p in (paths or []) if p]
    if not cleaned:
        raise CheckoutError("No files given to stage.")
    _git(path, "add", "--", *cleaned)
    return {"ok": True, "staged": cleaned}


def unstage(repo: str | Path, paths: list[str]) -> dict:
    """Unstage the named paths, back to the working tree.

    `reset HEAD -- <paths>` is used rather than `restore --staged` because it does the
    right thing for BOTH a newly-added file (returns it to untracked) and a modified one
    (returns it to modified), where the two restore variants differ. On a repo with no
    commits yet there is no HEAD to reset against, so fall back to removing from the
    index.
    """
    path = Path(repo)
    cleaned = [p for p in (paths or []) if p]
    if not cleaned:
        raise CheckoutError("No files given to unstage.")
    if _ok(path, "rev-parse", "--verify", "--quiet", "HEAD"):
        _git(path, "reset", "-q", "HEAD", "--", *cleaned)
    else:
        # No commit yet: everything staged is a fresh add, so drop it from the index.
        _git(path, "rm", "--cached", "-q", "--", *cleaned)
    return {"ok": True, "unstaged": cleaned}


def stage_all(repo: str | Path) -> dict:
    """Stage every changed DESIGN file, deliberately excluding KiCad's churn.

    This is the "Stage all" button, and it must not be `git add -A`: the whole point of
    the feature is to keep backups, caches and generated files out of a commit unless the
    user picks them one by one. So it stages only the non-noise modified/untracked files.
    """
    path = Path(repo)
    dirt = dirty_files(path)
    candidates = [
        p for p in (*dirt["modified"], *dirt["untracked"]) if not _is_noise(p)
    ]
    # De-duplicate while keeping it a stable set to stage.
    to_stage = sorted(set(candidates))
    if not to_stage:
        raise CheckoutError("There are no design changes to stage.")
    _git(path, "add", "--", *to_stage)
    return {"ok": True, "staged": to_stage}


def unstage_all(repo: str | Path) -> dict:
    """Unstage everything, back to the working tree. Leaves the files untouched."""
    path = Path(repo)
    if not dirty_files(path)["staged"]:
        raise CheckoutError("Nothing is staged.")
    if _ok(path, "rev-parse", "--verify", "--quiet", "HEAD"):
        _git(path, "reset", "-q", "HEAD")
    else:
        _git(path, "rm", "--cached", "-rq", ".")
    return {"ok": True}


# -- discarding ------------------------------------------------------------


def discard(repo: str | Path, also: list[str] | None = None) -> dict:
    """Throw away uncommitted changes so the tree can move.

    **This is the one unrecoverable thing in this module.** A stash can be fished back out
    of `git stash apply <sha>` for a while; a discarded edit to a board is gone the
    instant this runs. So:

      * The caller MUST confirm, and must name the files. Nothing here asks.
      * It returns what it destroyed, so the caller can say so afterwards. "Discarded 3
        files" is checkable; "Done" is not.

    `also` names untracked files to delete as well: only the ones the target commit would
    have overwritten anyway, never every untracked file. Deleting somebody's gerber
    exports because they happened to be lying next to the board would be indefensible,
    and unlike a stash there is nothing to undo it with.
    """
    path = Path(repo)
    also = also or []

    dirt = dirty_files(path)
    losing = sorted(set(dirt["blocking"]) | set(also))
    if not losing:
        raise CheckoutError("There are no uncommitted changes to discard.")

    # Tracked files: back to what HEAD says. `--` so a path that looks like a flag or a
    # ref cannot be reinterpreted as one.
    if dirt["blocking"]:
        _git(path, "checkout", "HEAD", "--", *dirt["blocking"])

    # Untracked ones have no committed version to restore, so they are deleted. Only the
    # named ones, and only because the checkout would have clobbered them regardless.
    deleted = []
    for rel in also:
        target = path / rel
        try:
            if target.is_file():
                target.unlink()
                deleted.append(rel)
        except OSError as exc:
            raise CheckoutError(f"Couldn't delete {rel}: {exc}") from exc

    log.info("Discarded %d file(s) in %s", len(losing), path)
    return {"ok": True, "discarded": losing, "deleted": deleted, "count": len(losing)}


# -- stashing --------------------------------------------------------------


def stash(
    repo: str | Path,
    message: str = "",
    also: list[str] | None = None,
    origin: str = "",
) -> dict:
    """Put uncommitted work aside so the tree can move, without losing it.

    This is the way OUT of the dirty guard. Refusing to check out was correct but a dead
    end: the user is told to commit or stash, and then has to leave and do it by hand.

    `also` names untracked files to take as well. Only ever the ones that WOULD BE
    OVERWRITTEN by the checkout, never every untracked file in the tree: sweeping up
    someone's gerber exports and 3D renders because they happened to be lying around is
    taking something we did not need to take, and they would find them gone with no
    visible reason why. So the sweep is targeted, and the caller says what to sweep.

    `origin`, when given, is the branch this work is being set aside FROM, recorded in the
    message so the agent can offer to bring it back on return. Left blank when there is no
    meaningful branch (a detached HEAD) or the caller does not care.

    The MESSAGE is what makes a stash safe rather than a hiding place. A stash you cannot
    identify is one you will never restore. Git's default ("WIP on main: a1b2c3d") says
    nothing about what is in it, and after two of them nobody knows which board they were
    editing. So the caller supplies one, and we prefix it so Prism's own stashes are
    recognisable in `git stash list`.
    """
    path = Path(repo)
    also = also or []

    dirt = dirty_files(path)
    taking = sorted(set(dirt["blocking"]) | set(also))
    if not taking:
        raise CheckoutError("There are no uncommitted changes to stash.")

    label = (message or "").strip() or "Uncommitted changes"
    encoded = _encode_origin(label, origin, path)

    if also:
        # `-u` alone would take EVERY untracked file. Scoped to named paths it takes only
        # those, which is exactly what we want: the ones the checkout would clobber, and
        # not the user's gerber exports and 3D renders that merely happen to be lying
        # around. Without `-u`, git refuses a path that is not tracked ("Did you forget
        # to 'git add'?"), so it is required here, not optional.
        _git(path, "stash", "push", "-u", "-m", f"{STASH_PREFIX}{encoded}", "--", *taking)
    else:
        _git(path, "stash", "push", "-m", f"{STASH_PREFIX}{encoded}")

    return {
        "ok": True,
        "message": label,
        "origin": origin,
        "stashed": taking,
        "count": len(taking),
    }


def _encode_origin(label: str, origin: str, repo: Path) -> str:
    """Append the origin branch and short sha to a stash label, if there is one.

    The short sha pins the exact point the work was taken from, so "bring it back on
    return to main" can be honest about whether main has since moved.
    """
    branch = (origin or "").strip()
    if not branch or branch == "HEAD":
        return label
    short = _git(repo, "rev-parse", "--short", "HEAD", check=False)
    tag = f"{branch}@{short}" if short else branch
    return f"{label}{_ORIGIN_OPEN}{tag}{_ORIGIN_CLOSE}"


def _decode_origin(subject: str) -> tuple[str, str, str]:
    """Split a stash subject into (message, origin_branch, origin_sha).

    Origin fields are "" when the stash carries no origin (an older one, or one made
    from a detached HEAD).
    """
    start = subject.rfind(_ORIGIN_OPEN)
    if start == -1 or not subject.rstrip().endswith(_ORIGIN_CLOSE):
        return subject, "", ""
    message = subject[:start]
    tag = subject[start + len(_ORIGIN_OPEN) : subject.rstrip().rfind(_ORIGIN_CLOSE)]
    branch, _, sha = tag.partition("@")
    return message, branch.strip(), sha.strip()


def stashes(repo: str | Path) -> list[dict]:
    """The stashes on this repo, newest first.

    Includes everyone's, not just ours: a stash made by hand in a terminal is still the
    user's work, and hiding it from a list titled "your stashed changes" would be a good
    way to let them destroy it.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        return []

    out = _git(path, "stash", "list", "--format=%gd%x00%s%x00%cr", check=False)
    result = []
    for line in out.splitlines():
        parts = line.split("\0")
        if len(parts) < 3:
            continue
        ref, subject, when = parts[0], parts[1], parts[2]

        # git decorates every stash subject with "On <branch>: " (or "WIP on <branch>: "
        # for one it named itself). That is git's bookkeeping, not what the user typed,
        # and repeating it in a list that already shows the branch is just noise.
        for decoration in ("WIP on ", "On "):
            if subject.startswith(decoration):
                _, _, rest = subject.partition(": ")
                subject = rest or subject
                break

        # Strip our own prefix too: it exists to identify the stash in git's tooling, not
        # to be read back to the user who typed the message.
        ours = subject.startswith(STASH_PREFIX)
        if ours:
            subject = subject[len(STASH_PREFIX) :]

        # Pull the origin back out of our own stashes, so callers can offer to bring the
        # work back on return to the branch it came from. Only ours carry it.
        origin_branch, origin_sha = "", ""
        if ours:
            subject, origin_branch, origin_sha = _decode_origin(subject)

        result.append(
            {
                "ref": ref,
                "message": subject,
                "when": when,
                "ours": ours,
                "origin_branch": origin_branch,
                "origin_sha": origin_sha,
            }
        )
    return result


def find_returnable_stash(repo: str | Path, branch: str) -> dict | None:
    """The newest Prism stash set aside from `branch`, if any.

    Read-only. This is what lets the agent offer to bring work back when the user returns
    to the branch it came from, rather than leaving it in the stash list to be forgotten.
    Matches on the branch name only: the sha is informational (main may have moved), and
    the user makes the final call to apply, so a slightly stale match is safe to offer.
    """
    if not branch or branch == "HEAD":
        return None
    for entry in stashes(repo):
        if entry.get("ours") and entry.get("origin_branch") == branch:
            return entry
    return None


def restore(repo: str | Path, ref: str = "stash@{0}") -> dict:
    """Put a stash back.

    `pop`, not `apply`: leaving the stash behind after restoring it is how you end up
    with a list of near-identical entries and no idea which is live. If it conflicts, git
    keeps the stash, which is the behaviour we want, so a failure here loses nothing.
    """
    path = Path(repo)

    dirt = dirty_files(path)
    if dirt["blocking"]:
        # Restoring onto a dirty tree can conflict, and resolving a conflict between a
        # stash and a board is exactly the situation we cannot merge our way out of.
        raise CheckoutError(
            f"{len(dirt['blocking'])} file(s) have uncommitted changes. "
            "Commit or stash them before restoring another stash."
        )

    try:
        _git(path, "stash", "pop", ref)
    except CheckoutError as exc:
        # The stash is still there: git does not drop one it could not apply cleanly.
        raise CheckoutError(
            f"Couldn't restore the stash: {exc}\n\n"
            "It is still in the stash list, so nothing is lost."
        ) from exc

    return {"ok": True, "restored": ref}


def apply(repo: str | Path, ref: str = "stash@{0}") -> dict:
    """Put a stash back, and KEEP it in the list.

    The difference from `restore` is the whole point: this leaves the stash where it is.
    That is worth having when the same set-aside work is wanted on more than one branch,
    or when the user wants to look at it without committing to having taken it.

    The cost is the one `restore` avoids: a list of near-identical entries nobody can
    tell apart. So this is the deliberate choice, not the default, and the caller says
    which it wants.
    """
    path = Path(repo)

    dirt = dirty_files(path)
    if dirt["blocking"]:
        # Same guard as restore(): applying onto a dirty tree can conflict, and a
        # conflict between a stash and a board is not something we can merge our way
        # out of.
        raise CheckoutError(
            f"{len(dirt['blocking'])} file(s) have uncommitted changes. "
            "Commit or stash them before applying another stash."
        )

    try:
        _git(path, "stash", "apply", ref)
    except CheckoutError as exc:
        raise CheckoutError(
            f"Couldn't apply the stash: {exc}\n\n"
            "It is still in the stash list, so nothing is lost."
        ) from exc

    return {"ok": True, "applied": ref, "kept": True}


def drop(repo: str | Path, ref: str = "stash@{0}") -> dict:
    """Throw a stash away.

    One of the two places in this module where "never destroy work the user cannot get
    back" is knowingly set aside because the user asked (see also `discard`, which is the
    harsher one: this leaves a recoverable sha behind, that does not). So it is honest
    about it rather than dressed up:

      * It returns what it dropped, so the caller can name it in a confirmation and in
        whatever it says afterwards. "Discarded 3 files" is checkable; "Done" is not.

      * It reports the sha. A dropped stash is not immediately gone: git keeps the commit
        until it is garbage collected, so `git stash apply <sha>` can still rescue it for
        a while. That is a real escape hatch and worth handing to the user, even though
        we will not pretend it is permanent.

    Callers MUST confirm first. Nothing here asks.
    """
    path = Path(repo)

    entries = stashes(path)
    if not entries:
        raise CheckoutError("There is nothing stashed.")

    match = next((e for e in entries if e["ref"] == ref), None)
    if match is None:
        # Refuse rather than dropping stash@{0} as a guess. Stash refs shift as entries
        # are added and removed, so acting on the wrong one is easy and unrecoverable.
        raise CheckoutError(f"{ref} is not in the stash list.")

    sha = _git(path, "rev-parse", ref, check=False)
    files = _git(path, "stash", "show", "--name-only", ref, check=False).splitlines()

    _git(path, "stash", "drop", ref)
    log.info("Dropped stash %s (%s)", ref, match["message"])

    return {
        "ok": True,
        "dropped": ref,
        "message": match["message"],
        "files": [f for f in files if f],
        # The escape hatch, until git garbage-collects it.
        "sha": sha,
    }


# -- doing it --------------------------------------------------------------


def checkout(
    repo: str | Path,
    ref: str,
    stash_message: str | None = None,
    discard_changes: bool = False,
) -> dict:
    """Move the working tree to `ref`, refusing anything that would lose work.

    Two ways past the uncommitted-work guard, and they are not equivalent:

      `stash_message`  put the changes aside first. Recoverable. The message is what
                       makes the stash findable again.
      `discard_changes` throw them away first. NOT recoverable. Only ever on an explicit
                       yes to a question that named the files.

    Given neither, uncommitted changes are still a refusal.

    Re-checks the guards immediately before acting rather than trusting whatever the UI
    saw a moment ago. The user may have saved a board in KiCad in between, and a stale
    "it was clean" is exactly how the data loss happens.
    """
    path = Path(repo)
    state = status(path, ref)

    # Where we are BEFORE moving. A stash made on the way out records this, so the agent
    # can offer to bring the work back when the user returns here; the caller also gets it
    # so a detached-commit view can offer "Return to <branch>".
    origin_branch = state.get("current_branch") or ""

    # Only these two are clearable. A mid-rebase or an unresolved conflict is NOT: git
    # would refuse anyway, and stashing (or discarding) on top of a half-finished
    # operation is how you turn a recoverable mess into an unrecoverable one.
    clearable = ("dirty", "untracked_collision")
    blocked = not state["can"] and state["reason"] in clearable

    # `clobbered` is the untracked files the TARGET also has. They go along with whatever
    # we do, because git will not overwrite them and there is nowhere else to put them.
    # Only those, though: every other untracked file stays where the user left it.
    stashed = None
    discarded = None
    if blocked and discard_changes:
        discarded = discard(path, also=state.get("clobbered") or [])
        state = status(path, ref)
    elif blocked and stash_message is not None:
        stashed = stash(
            path, stash_message, also=state.get("clobbered") or [], origin=origin_branch
        )
        state = status(path, ref)

    if not state["can"]:
        raise CheckoutError(state["message"])

    target = state["target"]

    # A branch is checked out by NAME, so HEAD stays attached and the user can commit
    # normally. A bare commit gets a detached HEAD, which is correct for "look at this
    # revision" and is what the caller is told.
    name = ref if target["kind"] in ("branch",) else target["sha"]
    _git(path, "checkout", name)

    now = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    return {
        "ok": True,
        "sha": target["sha"],
        "subject": target["subject"],
        "kind": target["kind"],
        "detached": now == "HEAD",
        "branch": "" if now == "HEAD" else now,
        # The branch we left. A detached-commit view uses this to offer "Return to
        # <branch>"; empty when the user was already detached.
        "origin_branch": origin_branch,
        # So the caller can tell the user their work was put aside, and where it went.
        # A stash the user does not know about is a stash they will never restore.
        "stashed": stashed,
        # And what was thrown away, so the caller can say how much. Silence after a
        # destructive action is how someone finds out the hard way.
        "discarded": discarded,
    }


def commit(
    repo: str | Path,
    message: str,
    paths: list[str] | None = None,
    allow_detached: bool = False,
    stage_all_design: bool = False,
) -> dict:
    """Commit, refusing anything that would surprise the user.

    Three ways to choose WHAT is committed, in order of precedence:

      * `paths` names files to stage-then-commit (the per-file / "commit these" case).
      * `stage_all_design` stages every non-noise design change first, then commits (a
        "commit all my work" convenience that still leaves KiCad's churn out).
      * neither: commit **what is already staged**. This is the staging-UI path, where
        the user has ticked exactly what they want and the Commit button must honour it,
        not re-stage the tree behind their back.

    Two guards that are not git's:

      * **A message is required.** Git will open an editor; the agent has no editor and a
        commit with no message is not one the user meant. Refuse with a reason.
      * **A detached HEAD needs `allow_detached`.** Committing while detached puts the
        commit on no branch, where the next checkout orphans it. That is exactly the
        n10 trap, so the caller must have offered "create a branch here" and passed the
        flag, rather than us silently making a commit the user will lose.

    Returns the new sha and subject so the caller can show what landed. Does NOT push:
    that is a separate, explicit act (see `push`).
    """
    path = Path(repo)
    if not (path / ".git").exists():
        raise CheckoutError("Not a git repository.")

    subject = (message or "").strip()
    if not subject:
        raise CheckoutError("A commit needs a message.")

    busy = in_progress(path)
    if busy:
        raise CheckoutError(f"There is {busy} in progress. Finish or abort it first.")

    current = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    if current == "HEAD" and not allow_detached:
        raise CheckoutError(
            "You are not on a branch (detached HEAD). A commit here would not be on any "
            "branch and would be lost on the next checkout. Create a branch first."
        )

    # Choose what to stage. `--` so a path that looks like a flag or a ref cannot be
    # reinterpreted. When neither paths nor stage_all_design is given, stage nothing and
    # commit whatever the user already staged.
    if paths:
        _git(path, "add", "--", *[p for p in paths if p])
    elif stage_all_design:
        stage_all(path)

    dirt = dirty_files(path)
    if not dirt["staged"]:
        raise CheckoutError("There is nothing staged to commit.")

    # --no-verify: the agent is not a place to run arbitrary commit hooks, and a hook
    # that blocks (a linter prompt) would hang a headless commit. Same choice the merge
    # commit path already makes.
    _git(path, "commit", "--no-verify", "-m", subject)

    sha = _git(path, "rev-parse", "HEAD", check=False)
    return {
        "ok": True,
        "sha": sha,
        "short": _git(path, "rev-parse", "--short", "HEAD", check=False),
        "subject": subject,
        "branch": "" if current == "HEAD" else current,
        "committed": dirt["staged"],
        "count": len(dirt["staged"]),
    }


def create_branch(repo: str | Path, name: str, switch: bool = True) -> dict:
    """Create a branch at HEAD, optionally switching to it.

    This is git's own remedy for "I have commits on a detached HEAD": name a branch at
    the current commit and the work is no longer orphaned. Also the everyday "start a new
    branch here". Switching (the default) attaches HEAD so subsequent commits land on it.

    Refuses a name git would reject or one that already exists, with git's own reason,
    rather than letting `git branch` fail opaquely.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        raise CheckoutError("Not a git repository.")

    branch = (name or "").strip()
    if not branch:
        raise CheckoutError("A branch needs a name.")
    if _ok(path, "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"):
        raise CheckoutError(f"A branch named '{branch}' already exists.")

    # `switch -c` creates and moves onto it; `branch` creates without moving. `--` is not
    # accepted by these, so validate the name via check-ref-format instead of relying on
    # positional safety.
    if not _ok(path, "check-ref-format", "--branch", branch):
        raise CheckoutError(f"'{branch}' is not a valid branch name.")

    if switch:
        _git(path, "switch", "-c", branch)
    else:
        _git(path, "branch", branch)

    return {
        "ok": True,
        "branch": branch,
        "switched": switch,
        "sha": _git(path, "rev-parse", "HEAD", check=False),
    }


def pull(repo: str | Path, stash_message: str | None = None) -> dict:
    """Fetch and fast-forward the current branch.

    `stash_message`, when given, puts uncommitted changes aside first. Without it they
    are still a refusal.

    **Fast-forward only, deliberately.** A real merge of a KiCad board cannot be done
    textually: a .kicad_pcb is an s-expression tree where a three-way merge produces a
    file neither author drew, and git will cheerfully generate one. That is silent board
    corruption, which is worse than any error message.

    So when the branches have diverged we stop and say so, and resolving it is a
    deliberate act (take one side whole) rather than something a Pull button does behind
    the user's back. Stashing does NOT change that: it clears uncommitted work out of the
    way, it does not make two divergent histories mergeable.
    """
    path = Path(repo)

    if not (path / ".git").exists():
        raise CheckoutError("Not a git repository.")

    busy = in_progress(path)
    if busy:
        raise CheckoutError(f"There is {busy} in progress. Finish or abort it first.")

    branch = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    if branch == "HEAD":
        raise CheckoutError(
            "You are not on a branch (detached HEAD), so there is nothing to pull into. "
            "Check out a branch first."
        )

    upstream = _git(
        path, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}", check=False
    )
    if not upstream:
        raise CheckoutError(
            f"'{branch}' is not tracking a remote branch, so there is nothing to pull."
        )

    # Fetch BEFORE deciding what blocks us: an untracked file only collides if the
    # incoming commit contains it, and we cannot know that until we have the commit.
    _git(path, "fetch", "--prune")

    stashed = None
    dirt = dirty_files(path)
    # A fast-forward writes the upstream's files over ours, so the same untracked
    # collision that aborts a checkout aborts a pull.
    clobbered = would_be_overwritten(
        path,
        _git(path, "rev-parse", upstream, check=False),
        dirt["untracked"],
    )
    if dirt["blocking"] or clobbered:
        if stash_message is None:
            # A pull that has to touch a file you have edited will either refuse or
            # overwrite. Refuse first, on our terms, with a message that says what to do.
            count = len(dirt["blocking"]) + len(clobbered)
            raise CheckoutError(
                f"{count} file(s) would be overwritten by the pull. "
                "Commit or stash them first."
            )
        stashed = stash(path, stash_message, also=clobbered)

    behind_ahead = _git(
        path, "rev-list", "--left-right", "--count", f"{upstream}...HEAD", check=False
    )
    try:
        behind, ahead = (int(n) for n in behind_ahead.split())
    except ValueError:
        behind, ahead = 0, 0

    if behind == 0 or ahead:
        # We are not going to pull after all, either because there is nothing to pull or
        # because the branches diverged. If we stashed to get here, the user's work is
        # now out of their tree with nothing to show for it, so put it straight back:
        # a stash they did not ask for and did not get a pull from is just their work
        # gone missing.
        if stashed:
            restore(path)
            stashed = None

    if behind == 0:
        return {
            "ok": True,
            "changed": False,
            "ahead": ahead,
            "behind": 0,
            "stashed": None,
            "message": "Already up to date."
            if not ahead
            else f"Already up to date. You have {ahead} commit(s) to push.",
        }

    if ahead:
        # Diverged. This is the case that would produce a merge commit, and for a board
        # that means a textual three-way merge of an s-expression tree: a file neither
        # author drew. Refuse, and name the choice that actually has to be made.
        raise CheckoutError(
            f"Your branch and the remote have both moved on "
            f"({ahead} local, {behind} remote commit(s)). "
            "A KiCad board cannot be merged automatically, so this has to be resolved "
            "by choosing one version of each conflicting file."
        )

    _git(path, "merge", "--ff-only", upstream)

    return {
        "ok": True,
        "changed": True,
        "ahead": 0,
        "behind": 0,
        "pulled": behind,
        "stashed": stashed,
        "message": f"Fast-forwarded {behind} commit(s).",
    }


# A remote op (push/fetch of a board repo with 3D models) can be slow; give it the same
# room a clone gets rather than timing out mid-transfer.
CLONE_TIMEOUT = 900


def _remote_git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    """Run a git command that talks to a remote, without hanging on a prompt.

    ``GIT_TERMINAL_PROMPT=0`` makes a missing credential fail fast instead of blocking
    forever on a password prompt that has nowhere to appear (the agent is detached from
    any terminal). Authentication is the user's own local git config, exactly like the
    clone flow, Prism stores no credentials.
    """
    import os

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        return subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            timeout=CLONE_TIMEOUT if args and args[0] in ("push", "fetch") else TIMEOUT,
            check=False,
            env=env,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise CheckoutError(f"Couldn't run git: {exc}") from exc


def fetch(repo: str | Path) -> dict:
    """Fetch from the remote and report how the branch now stands against it.

    Read-only against the working tree: it updates the remote-tracking refs and nothing
    else, so it is always safe to run, even mid-edit. The ahead/behind counts it returns
    are what the panel shows without the user having to pull.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        raise CheckoutError("Not a git repository.")

    result = _remote_git(path, "fetch", "--prune")
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        raise CheckoutError(detail[-1] if detail else "The fetch failed.")

    branch = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    upstream = _git(
        path, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}", check=False
    )
    ahead = behind = 0
    if upstream:
        counts = _git(
            path, "rev-list", "--left-right", "--count", f"{upstream}...HEAD", check=False
        )
        try:
            behind, ahead = (int(n) for n in counts.split())
        except ValueError:
            behind, ahead = 0, 0

    return {
        "ok": True,
        "branch": "" if branch == "HEAD" else branch,
        "upstream": upstream,
        "ahead": ahead,
        "behind": behind,
    }


def remotes(repo: str | Path) -> list[dict]:
    """The remotes on this repo, in git's own order with `origin` first when present.

    Read-only. This exists so publishing a new branch can ASK which remote rather than
    assuming: a repo with both `origin` and `upstream` (the fork layout) would otherwise
    silently publish to whichever the code happened to name.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        return []

    out = _git(path, "remote", "-v", check=False)
    seen: dict[str, str] = {}
    for line in out.splitlines():
        # "origin	git@github.com:owner/repo.git (fetch)"
        parts = line.split()
        if len(parts) < 2:
            continue
        name, url = parts[0], parts[1]
        # Fetch and push URLs both appear; the fetch one is what we report, and it is
        # listed first, so do not let the push line overwrite it.
        seen.setdefault(name, url)

    result = [{"name": n, "url": u} for n, u in seen.items()]
    # `origin` first: it is the convention, and it is what a picker should preselect.
    result.sort(key=lambda r: (r["name"] != "origin", r["name"]))
    return result


def push(repo: str | Path, set_upstream: bool = False, remote: str = "") -> dict:
    """Push the current branch to its remote, refusing anything that would rewrite it.

    **Never force.** A push that is rejected as non-fast-forward means the remote has
    commits you do not, and overwriting them is exactly the data loss this whole module
    refuses elsewhere. So a rejection is reported with the fix (pull/merge first), not
    pushed past.

    `set_upstream` publishes a brand-new branch that has no remote yet (``push -u``). A
    branch that already tracks a remote pushes to it normally.

    `remote` names where to publish, for the repo that has more than one. Blank keeps
    the historical behaviour (`origin`), so a caller that does not care is unaffected.

    Authentication is the user's own local git (SSH keys, credential helper). Prism
    stores nothing and prompts for nothing.
    """
    path = Path(repo)
    if not (path / ".git").exists():
        raise CheckoutError("Not a git repository.")

    branch = _git(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
    if branch == "HEAD":
        raise CheckoutError(
            "You are not on a branch (detached HEAD), so there is nothing to push. "
            "Create a branch first."
        )

    upstream = _git(
        path, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}", check=False
    )
    if not upstream and not set_upstream:
        # A new branch with no remote yet. Say so rather than letting git's "has no
        # upstream branch" error surface raw; the caller can offer to publish it.
        raise CheckoutError(
            f"'{branch}' isn't tracking a remote yet. Publish it to create the remote "
            "branch.",
            code="no_upstream",
        )

    if set_upstream and not upstream:
        target = remote or "origin"
        known = {r["name"] for r in remotes(path)}
        if not known:
            raise CheckoutError(
                "This repository has no remote to push to. Add one first."
            )
        if target not in known:
            raise CheckoutError(
                f"'{target}' is not a remote of this repository. "
                f"Known remotes: {', '.join(sorted(known))}."
            )
        result = _remote_git(path, "push", "-u", target, branch)
    else:
        result = _remote_git(path, "push")

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        lowered = detail.lower()
        if "non-fast-forward" in lowered or "fetch first" in lowered or "rejected" in lowered:
            raise CheckoutError(
                "The remote has commits you don't. Pull (fast-forward) or resolve the "
                "divergence first, then push. Prism won't force-push over them."
            )
        last = detail.splitlines()
        raise CheckoutError(last[-1] if last else "The push failed.")

    return {"ok": True, "branch": branch, "published": bool(set_upstream and not upstream)}
