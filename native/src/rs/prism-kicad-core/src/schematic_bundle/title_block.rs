use super::{SchematicBundleLimits, direct_scalars, schematic_limit};
use crate::sexpr_projection::FormSpan;
use crate::{KiCadTitleBlock, SourceBundleError, SourceBundleErrorKind};
use std::collections::BTreeMap;

pub(super) fn parse_title_block(
    text: &str,
    spans: &[FormSpan],
    source_path: &str,
    limits: SchematicBundleLimits,
) -> Result<Option<KiCadTitleBlock>, SourceBundleError> {
    let Some(root) = last_root(spans) else {
        return Ok(None);
    };
    let children = spans
        .iter()
        .filter(is_title_block_child)
        .filter(|span| root.range.contains(&span.range.start));
    if children.clone().count() > limits.max_title_block_children_per_source {
        return Err(schematic_limit(
            source_path,
            "title-block child count exceeds its limit",
        ));
    }
    let mut builder = TitleBlockBuilder::default();
    for child in children {
        builder.consume(text, child, source_path, limits)?;
    }
    Ok(Some(builder.finish(root)))
}

/// A repeated title block replaces the earlier one whole, as KiCad's parser
/// assigns each in turn (`ParseSchematic`, `T_title_block`).
fn last_root(spans: &[FormSpan]) -> Option<&FormSpan> {
    spans
        .iter()
        .rfind(|span| span.depth == 1 && span.head.as_deref() == Some("title_block"))
}

fn is_title_block_child(span: &&FormSpan) -> bool {
    span.depth == 2 && span.path.get(1).is_some_and(|part| part == "title_block")
}

#[derive(Default)]
struct TitleBlockBuilder {
    title: Option<String>,
    date: Option<String>,
    revision: Option<String>,
    company: Option<String>,
    comments: BTreeMap<i64, String>,
}

impl TitleBlockBuilder {
    fn consume(
        &mut self,
        text: &str,
        child: &FormSpan,
        source_path: &str,
        limits: SchematicBundleLimits,
    ) -> Result<(), SourceBundleError> {
        match child.head.as_deref() {
            Some("title") => set_first_scalar(&mut self.title, text, child, source_path, limits),
            Some("date") => set_first_scalar(&mut self.date, text, child, source_path, limits),
            Some("rev") => set_first_scalar(&mut self.revision, text, child, source_path, limits),
            Some("company") => {
                set_first_scalar(&mut self.company, text, child, source_path, limits)
            }
            Some("comment") => self.consume_comment(text, child, source_path, limits),
            _ => Ok(()),
        }
    }

    fn consume_comment(
        &mut self,
        text: &str,
        child: &FormSpan,
        source_path: &str,
        limits: SchematicBundleLimits,
    ) -> Result<(), SourceBundleError> {
        let values = direct_scalars(text, child, 2, source_path, limits)?;
        if values.len() < 2 {
            return Ok(());
        }
        let number = values[0].parse::<i64>().map_err(|_| {
            SourceBundleError::new(
                SourceBundleErrorKind::Schematic,
                Some(source_path),
                "title-block comment number is not an integer",
            )
        })?;
        if !self.comments.contains_key(&number)
            && self.comments.len() >= limits.max_title_block_comments_per_source
        {
            return Err(schematic_limit(
                source_path,
                "title-block comment count exceeds its limit",
            ));
        }
        self.comments.insert(number, values[1].clone());
        Ok(())
    }

    fn finish(self, root: &FormSpan) -> KiCadTitleBlock {
        KiCadTitleBlock {
            title: self.title.unwrap_or_default(),
            date: self.date.unwrap_or_default(),
            revision: self.revision.unwrap_or_default(),
            company: self.company.unwrap_or_default(),
            comments: self.comments,
            source_range: root.range.clone(),
        }
    }
}

fn set_first_scalar(
    target: &mut Option<String>,
    text: &str,
    child: &FormSpan,
    source_path: &str,
    limits: SchematicBundleLimits,
) -> Result<(), SourceBundleError> {
    if target.is_none() {
        *target = direct_scalars(text, child, 1, source_path, limits)?
            .into_iter()
            .next();
    }
    Ok(())
}
