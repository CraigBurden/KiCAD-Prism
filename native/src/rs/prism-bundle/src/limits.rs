//! The CLI's resource limits (cli-spec.md §7.2): names, defaults per
//! command, hard bounds and `--limit <name>=<value>` overrides.
//!
//! Hitting a limit is exit 4 and is never recorded in a bundle: limits are
//! configuration, not part of the bundle key (bundle-format.md §3.2).

use crate::finding::{Failure, Outcome};

/// The Design Comparison object-diff engine (`prism-kicad compare`, amendment
/// C2). `prism-kicad-cli` reaches it through this crate rather than depending
/// on `prism-projections` directly, which would edit a Cargo manifest
/// (amendment C2 §2 item 3 keeps the Cargo manifests unchanged).
#[cfg(feature = "build")]
pub use prism_projections::compare;

/// The largest safe JSON integer, the bound of a limit without a hard bound
/// (every limit value is written into `CliLimitHit` as a `safeint`).
pub const SAFE_INTEGER: u64 = (1 << 53) - 1;

/// One limit (`CliLimitName`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum LimitName {
    /// `max-source-files`.
    MaxSourceFiles,
    /// `max-source-file-bytes`.
    MaxSourceFileBytes,
    /// `max-total-source-bytes`.
    MaxTotalSourceBytes,
    /// `max-path-bytes`.
    MaxPathBytes,
    /// `max-sexpr-depth`.
    MaxSexprDepth,
    /// `max-sexpr-nodes`.
    MaxSexprNodes,
    /// `max-sexpr-string-bytes`.
    MaxSexprStringBytes,
    /// `max-json-depth`.
    MaxJsonDepth,
    /// `max-json-nodes`.
    MaxJsonNodes,
    /// `max-config-bytes`.
    MaxConfigBytes,
    /// `max-models-glb-bytes`.
    MaxModelsGlbBytes,
    /// `max-materialization-operations`.
    MaxMaterializationOperations,
    /// `max-member-bytes`.
    MaxMemberBytes,
    /// `max-archive-bytes`.
    MaxArchiveBytes,
    /// `max-archive-members`.
    MaxArchiveMembers,
    /// `max-total-unpacked-bytes`.
    MaxTotalUnpackedBytes,
    /// `max-compression-ratio`.
    MaxCompressionRatio,
    /// `max-diagnostic-lines`.
    MaxDiagnosticLines,
    /// `max-findings`.
    MaxFindings,
    /// `max-memory-bytes`.
    MaxMemoryBytes,
    /// `timeout-ms`.
    TimeoutMs,
}

/// The unit a limit's name suffix gives it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LimitUnit {
    /// `-bytes`.
    Bytes,
    /// `-ms`.
    Time,
    /// Anything else.
    Count,
}

impl LimitName {
    /// Every limit, in `CliLimitName` order.
    pub const ALL: [Self; 21] = [
        Self::MaxSourceFiles,
        Self::MaxSourceFileBytes,
        Self::MaxTotalSourceBytes,
        Self::MaxPathBytes,
        Self::MaxSexprDepth,
        Self::MaxSexprNodes,
        Self::MaxSexprStringBytes,
        Self::MaxJsonDepth,
        Self::MaxJsonNodes,
        Self::MaxConfigBytes,
        Self::MaxModelsGlbBytes,
        Self::MaxMaterializationOperations,
        Self::MaxMemberBytes,
        Self::MaxArchiveBytes,
        Self::MaxArchiveMembers,
        Self::MaxTotalUnpackedBytes,
        Self::MaxCompressionRatio,
        Self::MaxDiagnosticLines,
        Self::MaxFindings,
        Self::MaxMemoryBytes,
        Self::TimeoutMs,
    ];

    /// The name as `--limit` and `CliLimitName` spell it.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        TABLE[slot(self)].1
    }

    /// The limit spelled `name`.
    #[must_use]
    pub fn parse(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|limit| limit.as_str() == name)
    }

    /// The unit given by the name's suffix.
    #[must_use]
    pub fn unit(self) -> LimitUnit {
        let name = self.as_str();
        if name.ends_with("-bytes") {
            LimitUnit::Bytes
        } else if name.ends_with("-ms") {
            LimitUnit::Time
        } else {
            LimitUnit::Count
        }
    }

    /// The largest value `--limit` accepts.
    #[must_use]
    pub fn hard_bound(self) -> u64 {
        match self {
            Self::MaxPathBytes | Self::MaxArchiveMembers => 65_535,
            Self::MaxSexprDepth => 512,
            Self::MaxMaterializationOperations | Self::MaxMemberBytes | Self::MaxArchiveBytes => {
                u64::from(u32::MAX)
            }
            _ => SAFE_INTEGER,
        }
    }
}

/// What an invocation does; the memory cap and timeout defaults differ.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Work {
    /// `bundle build --stage parse`.
    Parse,
    /// `bundle build --stage board`.
    Board,
    /// `bundle build --stage models`.
    Models,
    /// `bundle verify`.
    Verify,
    /// `bundle extract`.
    Extract,
    /// `revision-key`.
    RevisionKey,
    /// `compare` (cli-spec.md §5.6).
    Compare,
    /// `version` and usage errors.
    Other,
}

const GIB: u64 = 1 << 30;
const MIB: u64 = 1 << 20;

/// The limit values of one invocation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Limits {
    values: [u64; LimitName::ALL.len()],
}

/// Every limit: its name and its default, cli-spec.md §7.2 (in
/// `LimitName::ALL` order). `max-memory-bytes` and `timeout-ms` depend on
/// the work ([`memory_default`], [`timeout_default`]).
const TABLE: [(LimitName, &str, u64); 21] = [
    (LimitName::MaxSourceFiles, "max-source-files", 16_384),
    (
        LimitName::MaxSourceFileBytes,
        "max-source-file-bytes",
        128 * MIB,
    ),
    (
        LimitName::MaxTotalSourceBytes,
        "max-total-source-bytes",
        2 * GIB,
    ),
    (LimitName::MaxPathBytes, "max-path-bytes", 4_096),
    (LimitName::MaxSexprDepth, "max-sexpr-depth", 128),
    (LimitName::MaxSexprNodes, "max-sexpr-nodes", 24_000_000),
    (
        LimitName::MaxSexprStringBytes,
        "max-sexpr-string-bytes",
        64 * MIB,
    ),
    (LimitName::MaxJsonDepth, "max-json-depth", 256),
    (LimitName::MaxJsonNodes, "max-json-nodes", 8_000_000),
    (LimitName::MaxConfigBytes, "max-config-bytes", MIB),
    (LimitName::MaxModelsGlbBytes, "max-models-glb-bytes", GIB),
    (
        LimitName::MaxMaterializationOperations,
        "max-materialization-operations",
        u32::MAX as u64,
    ),
    (LimitName::MaxMemberBytes, "max-member-bytes", 2 * GIB),
    (
        LimitName::MaxArchiveBytes,
        "max-archive-bytes",
        u32::MAX as u64,
    ),
    (LimitName::MaxArchiveMembers, "max-archive-members", 32_768),
    (
        LimitName::MaxTotalUnpackedBytes,
        "max-total-unpacked-bytes",
        8 * GIB,
    ),
    (LimitName::MaxCompressionRatio, "max-compression-ratio", 200),
    (
        LimitName::MaxDiagnosticLines,
        "max-diagnostic-lines",
        10_000,
    ),
    (LimitName::MaxFindings, "max-findings", 1_000),
    (LimitName::MaxMemoryBytes, "max-memory-bytes", 2 * GIB),
    (LimitName::TimeoutMs, "timeout-ms", 300_000),
];

fn memory_default(work: Work) -> u64 {
    match work {
        Work::Parse => 4 * GIB,
        Work::Board => 6 * GIB,
        _ => 2 * GIB,
    }
}

fn timeout_default(work: Work) -> u64 {
    match work {
        Work::Board | Work::Verify | Work::Extract => 600_000,
        Work::Models | Work::Compare => 120_000,
        _ => 300_000,
    }
}

fn default_value(name: LimitName, work: Work) -> u64 {
    match name {
        LimitName::MaxMemoryBytes => memory_default(work),
        LimitName::TimeoutMs => timeout_default(work),
        other => TABLE[slot(other)].2,
    }
}

fn slot(name: LimitName) -> usize {
    LimitName::ALL
        .iter()
        .position(|candidate| *candidate == name)
        .unwrap_or(0)
}

impl Limits {
    /// The defaults of cli-spec.md §7.2 for `work`.
    #[must_use]
    pub fn defaults(work: Work) -> Self {
        let mut values = [0; LimitName::ALL.len()];
        for (value, name) in values.iter_mut().zip(LimitName::ALL) {
            *value = default_value(name, work);
        }
        Self { values }
    }

    /// The value of `name`.
    #[must_use]
    pub fn get(&self, name: LimitName) -> u64 {
        self.values[slot(name)]
    }

    /// The value of `name` as a `usize`, saturating.
    #[must_use]
    pub fn get_usize(&self, name: LimitName) -> usize {
        usize::try_from(self.get(name)).unwrap_or(usize::MAX)
    }

    /// Set `name` to `value`.
    pub fn set(&mut self, name: LimitName, value: u64) {
        self.values[slot(name)] = value;
    }

    /// Apply one `--limit <name>=<value>` argument.
    pub fn apply(&mut self, argument: &str) -> Outcome<LimitName> {
        let usage = |message: String| Failure::usage("usage", message).argument("limit");
        let (name, value) = argument
            .split_once('=')
            .ok_or_else(|| usage("--limit takes <name>=<value>".to_owned()))?;
        let name = LimitName::parse(name)
            .ok_or_else(|| usage(format!("--limit names no known limit: {name:?}")))?;
        let digits = !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit());
        let parsed = digits.then(|| value.parse::<u64>().ok()).flatten();
        let value = parsed
            .filter(|value| *value <= name.hard_bound())
            .ok_or_else(|| {
                usage(format!(
                    "--limit {} takes a decimal integer from 0 to {}",
                    name.as_str(),
                    name.hard_bound()
                ))
            })?;
        self.set(name, value);
        Ok(name)
    }

    /// A `limit-exceeded` failure for `name` with `observed`.
    #[must_use]
    pub fn exceeded(&self, name: LimitName, observed: Option<u64>, what: &str) -> Failure {
        let limit = self.get(name);
        let message = match observed {
            Some(observed) => format!("{what} is {observed}, over {} {limit}", name.as_str()),
            None => format!("{what} exceeds {} {limit}", name.as_str()),
        };
        Failure::limit(name, limit, observed, message)
    }

    /// Fail when `observed` is over `name`.
    pub fn check(&self, name: LimitName, observed: u64, what: &str) -> Outcome<()> {
        if observed > self.get(name) {
            return Err(self.exceeded(name, Some(observed), what));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_round_trip_and_units_follow_suffixes() {
        for name in LimitName::ALL {
            assert_eq!(LimitName::parse(name.as_str()), Some(name));
        }
        assert_eq!(LimitName::TimeoutMs.unit(), LimitUnit::Time);
        assert_eq!(LimitName::MaxMemberBytes.unit(), LimitUnit::Bytes);
        assert_eq!(LimitName::MaxFindings.unit(), LimitUnit::Count);
    }

    #[test]
    fn the_table_follows_the_name_order() {
        for (entry, name) in TABLE.iter().zip(LimitName::ALL) {
            assert_eq!(entry.0, name);
        }
    }

    #[test]
    fn defaults_follow_the_spec_table() {
        let parse = Limits::defaults(Work::Parse);
        assert_eq!(parse.get(LimitName::MaxMemoryBytes), 4 * GIB);
        assert_eq!(parse.get(LimitName::TimeoutMs), 300_000);
        assert_eq!(
            Limits::defaults(Work::Board).get(LimitName::MaxMemoryBytes),
            6 * GIB
        );
        assert_eq!(
            Limits::defaults(Work::Models).get(LimitName::TimeoutMs),
            120_000
        );
        assert_eq!(
            Limits::defaults(Work::Compare).get(LimitName::TimeoutMs),
            120_000
        );
        assert_eq!(
            Limits::defaults(Work::Compare).get(LimitName::MaxMemoryBytes),
            2 * GIB
        );
        assert_eq!(parse.get(LimitName::MaxArchiveBytes), u64::from(u32::MAX));
    }

    #[test]
    fn overrides_respect_hard_bounds() {
        let mut limits = Limits::defaults(Work::Verify);
        assert_eq!(limits.apply("max-findings=3"), Ok(LimitName::MaxFindings));
        assert_eq!(limits.get(LimitName::MaxFindings), 3);
        assert!(limits.apply("max-sexpr-depth=513").is_err());
        assert!(limits.apply("max-sexpr-depth=512").is_ok());
        for bad in [
            "max-findings",
            "nope=1",
            "max-findings=-1",
            "max-findings=1e3",
            "max-findings=",
        ] {
            let failure = limits.apply(bad).unwrap_err();
            assert_eq!(failure.finding.code, "usage", "{bad}");
        }
    }
}
