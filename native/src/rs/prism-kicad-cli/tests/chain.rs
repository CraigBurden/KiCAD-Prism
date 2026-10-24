//! Stage chaining (cli-spec.md §5.2.1, §5.2.5, §11 items 2, 3 and 7):
//! re-running a stage gives the same archive, `-o` is always the old or the
//! new archive when a build is killed, and the two recorded usb-pd GLB
//! exports canonicalize to the same bytes.

mod support;

use std::path::PathBuf;
use std::time::Duration;
use support::{recording, repo, run, s, scratch, sha256};

const USB: &str = "fixtures/release-studio/usb-pd";

fn usb_pd() -> PathBuf {
    repo().join(USB).join("USB-PD-Trigger-Board.kicad_pro")
}

#[test]
fn rerunning_board_gives_the_same_archive() {
    let recordings = scratch("chain-recordings");
    let refilled = recording(USB, "USB-PD-Trigger-Board.kicad_pcb", &recordings).unwrap();
    let glb = recording(USB, "components.glb", &recordings).unwrap();
    let dir = scratch("chain");
    let mut finals = Vec::new();
    for reruns in [1, 2] {
        let archive = dir.join(format!("r{reruns}.prism"));
        assert_eq!(
            run(&[
                "bundle",
                "build",
                s(&usb_pd()),
                "--stage",
                "parse",
                "-o",
                s(&archive),
                "--quiet"
            ])
            .code,
            0
        );
        for _ in 0..reruns {
            let board = run(&[
                "bundle",
                "build",
                "--stage",
                "board",
                "--in",
                s(&archive),
                "-o",
                s(&archive),
                "--refilled-board",
                s(&refilled),
                "--refill-tool",
                "10.0.6",
                "--quiet",
            ]);
            assert_eq!(board.code, 0, "{}", board.document);
        }
        let models = run(&[
            "bundle",
            "build",
            "--stage",
            "models",
            "--in",
            s(&archive),
            "-o",
            s(&archive),
            "--models-glb",
            s(&glb),
            "--models-tool",
            "10.0.6",
            "--quiet",
        ]);
        assert_eq!(models.code, 0);
        finals.push(std::fs::read(&archive).unwrap());
    }
    assert!(
        finals[0] == finals[1],
        "parse→board→models equals parse→board→board→models"
    );
    // Re-running board on a complete bundle drops models back to pending.
    let archive = dir.join("r1.prism");
    let rerun = run(&[
        "bundle",
        "build",
        "--stage",
        "board",
        "--in",
        s(&archive),
        "-o",
        s(&dir.join("again.prism")),
        "--refilled-board",
        s(&refilled),
        "--refill-tool",
        "10.0.6",
        "--quiet",
    ]);
    assert_eq!(rerun.code, 0);
    assert_eq!(rerun.document["stages"][2]["status"], "pending");
}

#[test]
fn a_killed_build_leaves_the_old_or_the_new_archive() {
    let recordings = scratch("kill-recordings");
    let refilled = recording(USB, "USB-PD-Trigger-Board.kicad_pcb", &recordings).unwrap();
    let dir = scratch("kill");
    let archive = dir.join("a.prism");
    assert_eq!(
        run(&[
            "bundle",
            "build",
            s(&usb_pd()),
            "--stage",
            "parse",
            "-o",
            s(&archive),
            "--quiet"
        ])
        .code,
        0
    );
    let old = sha256(&std::fs::read(&archive).unwrap());
    let mut seen_new = None;
    for step in 0..12u64 {
        let mut child = std::process::Command::new(support::binary())
            .args([
                "bundle",
                "build",
                "--stage",
                "board",
                "--in",
                s(&archive),
                "-o",
                s(&archive),
                "--refilled-board",
                s(&refilled),
                "--refill-tool",
                "10.0.6",
                "--quiet",
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .unwrap();
        std::thread::sleep(Duration::from_millis(40 * step));
        let _ = child.kill();
        let _ = child.wait();
        let now = sha256(&std::fs::read(&archive).unwrap());
        let verify = run(&["bundle", "verify", s(&archive), "--quiet"]);
        assert_eq!(verify.code, 0, "step {step}: -o does not verify");
        if now != old {
            assert!(
                seen_new.as_ref().is_none_or(|new| *new == now),
                "only one new archive exists"
            );
            seen_new = Some(now.clone());
            // Start again from the parse-stage archive for the next step.
            assert_eq!(
                run(&[
                    "bundle",
                    "build",
                    s(&usb_pd()),
                    "--stage",
                    "parse",
                    "-o",
                    s(&archive),
                    "--quiet"
                ])
                .code,
                0
            );
        }
    }
}

#[test]
fn the_two_recorded_glb_exports_canonicalize_to_the_same_bytes() {
    let recordings = scratch("glb-recordings");
    let first = std::fs::read(recording(USB, "components.glb", &recordings).unwrap()).unwrap();
    let second =
        std::fs::read(recording(USB, "components.second.glb", &recordings).unwrap()).unwrap();
    assert_ne!(first, second, "the exports differ in generated_at");
    let one = prism_bundle::stages::models::canonicalize(first).unwrap();
    let two = prism_bundle::stages::models::canonicalize(second).unwrap();
    assert!(one == two);
    assert_eq!(one.len(), 1_360_412);
    assert!(
        sha256(&one).starts_with("ec4b495a"),
        "the canonical GLB of cli-spec.md §5.2.4"
    );
}
