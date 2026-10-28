use super::*;

fn args(line: &str) -> Outcome<Args> {
    let argv: Vec<String> = line.split_whitespace().map(str::to_owned).collect();
    parse(&argv)
}

#[test]
fn parses_the_synopsis() {
    let build =
        args("bundle build p.kicad_pro --stage parse -o out.prism --limit timeout-ms=5 --quiet")
            .unwrap();
    assert_eq!(build.command, Command::Build);
    assert_eq!(build.stage, Some(StageArg::Parse));
    assert_eq!(build.limits.get(LimitName::TimeoutMs), 5);
    assert!(build.quiet);
    let board =
        args("bundle build --in a -o a --stage board --refilled-board b --refill-tool 10.0.6")
            .unwrap();
    assert_eq!(work_of(board.command, board.stage), Work::Board);
    assert!(args("revision-key . --worktree --project x.kicad_pro").is_ok());
    assert_eq!(args("version").unwrap().command, Command::Version);
    let key = "0".repeat(64);
    let compare = args(&format!(
            "compare --base a.prism --head b.prism --base-revision-key {key} --head-revision-key {key} -o d.json"
        ))
        .unwrap();
    assert_eq!(compare.command, Command::Compare);
    assert_eq!(work_of(compare.command, compare.stage), Work::Compare);
    // A source-tree side runs the parse stage, so it gets that stage's limits.
    let source = args(&format!(
            "compare --base-src p.kicad_pro --base-revision-key {key} --head b.prism --head-revision-key {key} -o r.json"
        ))
        .unwrap();
    assert_eq!(
        source.limits.get(LimitName::TimeoutMs),
        Limits::defaults(Work::Parse).get(LimitName::TimeoutMs)
    );
    let reuse = args("bundle reuse --in a.prism --key-record k.json").unwrap();
    assert_eq!(reuse.command, Command::Reuse);
    assert_eq!(reuse.option("key-record"), Some("k.json"));
}

#[test]
fn rejects_bad_grammar() {
    let code = |line: &str| args(line).unwrap_err().finding.code;
    assert_eq!(code("frobnicate"), "unknown-command");
    assert_eq!(code("bundle build p --stage parse -o a -o b"), "usage");
    assert_eq!(code("bundle build p --stage=parse -o a"), "usage");
    assert_eq!(code("bundle build --stage board -o a"), "option-conflict");
    assert_eq!(
        code("bundle build p --stage parse -o a --in b"),
        "option-conflict"
    );
    assert_eq!(
        code("bundle build p --stage parse -o a --key-record r"),
        "option-conflict"
    );
    assert_eq!(
        code("bundle build p --stage parse -o a --revision-key ABC"),
        "usage"
    );
    assert_eq!(code("revision-key . --project x"), "option-conflict");
    assert_eq!(
        code("revision-key . --commit H --worktree --project x"),
        "option-conflict"
    );
    assert_eq!(code("bundle extract b.prism -o d"), "usage");
    assert_eq!(
        code("bundle verify b --limit max-findings=1 --limit max-findings=2"),
        "usage"
    );
    assert_eq!(code("bundle verify b --threads 0"), "usage");
    assert_eq!(code("bundle verify b --stage parse"), "usage");
}

#[test]
fn parses_the_sheet_commands() {
    let metrics = args("stroke-text --metrics").unwrap();
    assert_eq!(metrics.command, Command::StrokeText);
    assert!(metrics.metrics);
    assert_eq!(
        args("stroke-text --request runs.json")
            .unwrap()
            .option("request"),
        Some("runs.json")
    );
    let sheet = args("drawing-sheet --request sheet.json").unwrap();
    assert_eq!(sheet.command, Command::DrawingSheet);
    let code = |line: &str| args(line).unwrap_err().finding.code;
    assert_eq!(code("stroke-text"), "usage");
    assert_eq!(
        code("stroke-text --metrics --request runs.json"),
        "option-conflict"
    );
    assert_eq!(code("stroke-text --metrics runs.json"), "usage");
    assert_eq!(code("drawing-sheet"), "usage");
    assert_eq!(code("drawing-sheet --metrics"), "usage");
}

#[test]
fn parses_artwork_paper_scale() {
    let artwork =
        args("artwork --in a.prism --config c.json --view top -o d --paper-scale 2.5").unwrap();
    assert_eq!(artwork.command, Command::Artwork);
    assert_eq!(artwork.paper_scale, Some(2.5));
    assert_eq!(
        args("artwork --in a.prism --config c.json --view top -o d")
            .unwrap()
            .paper_scale,
        None
    );
    // `--paper-scale` is a positive finite ratio, and only `artwork` takes it.
    let code = |line: &str| args(line).unwrap_err().finding.code;
    assert_eq!(
        code("artwork --in a --config c --view top -o d --paper-scale 0"),
        "usage"
    );
    assert_eq!(
        code("artwork --in a --config c --view top -o d --paper-scale -1"),
        "usage"
    );
    assert_eq!(
        code("artwork --in a --config c --view top -o d --paper-scale nan"),
        "usage"
    );
    assert_eq!(code("bundle verify b --paper-scale 2"), "usage");
}

#[test]
fn rejects_bad_compare_grammar() {
    let code = |line: &str| args(line).unwrap_err().finding.code;
    assert_eq!(code("compare --head b -o d"), "usage");
    assert_eq!(code("compare --base a -o d"), "usage");
    assert_eq!(code("compare --base a --head b"), "usage");
    assert_eq!(code("compare --base a --head b -o d extra"), "usage");
    assert_eq!(code("compare --base a --head b --base c -o d"), "usage");
    // Both modes take each side's revision key (ADR amendment K2 §3.6).
    let key = "0".repeat(64);
    assert_eq!(
        code(&format!(
            "compare --base a --head b --base-revision-key {key} -o d"
        )),
        "usage"
    );
    assert_eq!(
        code(&format!(
            "compare --base a --head b --base-revision-key {key} --head-revision-key X -o d"
        )),
        "usage"
    );
}

#[test]
fn rejects_bad_reuse_grammar() {
    let code = |line: &str| args(line).unwrap_err().finding.code;
    assert_eq!(code("bundle reuse --in a"), "usage");
    assert_eq!(code("bundle reuse --key-record k"), "usage");
    assert_eq!(code("bundle reuse b --in a --key-record k"), "usage");
    assert_eq!(code("bundle reuse --in a --key-record k -o d"), "usage");
    assert_eq!(code("bundle frob"), "unknown-command");
}

#[test]
fn checks_upgrade_records() {
    let code = |line: &str| args(line).unwrap_err().finding.code;
    assert_eq!(
        code("bundle build --in a -o a --stage board --upgraded x.kicad_sch=1"),
        "option-conflict"
    );
    assert_eq!(
        code("bundle build p --stage parse -o a --upgraded x.kicad_pro=1"),
        "usage"
    );
    assert_eq!(
        code("bundle build p --stage parse -o a --upgraded x.kicad_sch=v7"),
        "usage"
    );
    assert_eq!(
        code("bundle build p --stage parse -o a --upgraded x.kicad_sch=1 --upgraded x.kicad_sch=2"),
        "usage"
    );
    let upgraded = args("bundle build p --stage parse -o a --upgraded a/x.kicad_sch=20230121 --upgraded b.kicad_pcb=20221018").unwrap();
    assert_eq!(upgraded.upgraded.get("a/x.kicad_sch"), Some(&20_230_121));
}
