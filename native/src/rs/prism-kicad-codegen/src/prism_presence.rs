//! Prism contracts' optional nullable fields (conventions.md §10).

use crate::{FieldPresence, replace_serde_presence_attr, schema_presence_rules, serde_field_name};
use anyhow::{Context, Result, bail};
use serde_json::Value;
use std::collections::BTreeSet;

/// A Prism field that is optional *and* nullable (`name?: T | null`) keeps the
/// difference between absent and `null` (conventions.md §10): typify gives
/// `Option<T>`, which reads both as `None` and writes neither. Project it to
/// `Option<Option<T>>`: absent is `None`, `null` is `Some(None)`.
pub(crate) fn project_optional_nullable(
    schema_name: &str,
    published_schema: &Value,
    source: String,
) -> Result<String> {
    let model = schema_name.trim_end_matches(".json");
    let rules = schema_presence_rules(schema_name, published_schema)?
        .into_iter()
        .filter(|(_, presence)| *presence == FieldPresence::OptionalNullable)
        .map(|((structure, field), _)| {
            // `schema_presence_rules` names the root `<schema>A0`; a Prism
            // root is named after its model.
            let structure = if structure == format!("{model}A0") {
                model.to_owned()
            } else {
                structure
            };
            (structure, field)
        })
        .collect::<BTreeSet<_>>();
    if rules.is_empty() {
        return Ok(source);
    }
    let mut syntax =
        syn::parse_file(&source).context("parse generated Rust for optional-nullable fields")?;
    let mut seen = BTreeSet::new();
    for item in &mut syntax.items {
        let syn::Item::Struct(structure) = item else {
            continue;
        };
        let syn::Fields::Named(fields) = &mut structure.fields else {
            continue;
        };
        let structure_name = structure.ident.to_string();
        for field in &mut fields.named {
            let Some(ident) = &field.ident else {
                continue;
            };
            let rust_name = ident.to_string();
            let wire_name = serde_field_name(field)?.unwrap_or_else(|| rust_name.clone());
            let key = (structure_name.clone(), wire_name.clone());
            if !rules.contains(&key) {
                continue;
            }
            if !is_option_type(&field.ty) || is_nested_option_type(&field.ty) {
                bail!("{schema_name} {}.{} is not a plain Option", key.0, key.1);
            }
            let inner = field.ty.clone();
            field.ty = syn::parse_quote!(::std::option::Option<#inner>);
            let span = ident.span();
            let replacement = if wire_name == rust_name {
                syn::parse_quote!(#[serde(
                    default,
                    deserialize_with = "crate::deserialize_present_nullable",
                    skip_serializing_if = "::std::option::Option::is_none"
                )])
            } else {
                let wire_name = syn::LitStr::new(&wire_name, span);
                syn::parse_quote!(#[serde(
                    rename = #wire_name,
                    default,
                    deserialize_with = "crate::deserialize_present_nullable",
                    skip_serializing_if = "::std::option::Option::is_none"
                )])
            };
            replace_serde_presence_attr(field, replacement)?;
            seen.insert(key);
        }
    }
    let missing = rules.difference(&seen).collect::<Vec<_>>();
    if !missing.is_empty() {
        bail!("{schema_name} optional-nullable fields not generated: {missing:?}");
    }
    Ok(prettyplease::unparse(&syntax))
}

pub(crate) fn is_option_type(ty: &syn::Type) -> bool {
    let syn::Type::Path(path) = ty else {
        return false;
    };
    path.path
        .segments
        .last()
        .is_some_and(|segment| segment.ident == "Option")
}

pub(crate) fn is_nested_option_type(ty: &syn::Type) -> bool {
    let syn::Type::Path(path) = ty else {
        return false;
    };
    let Some(segment) = path.path.segments.last() else {
        return false;
    };
    let syn::PathArguments::AngleBracketed(arguments) = &segment.arguments else {
        return false;
    };
    arguments.args.iter().any(
        |argument| matches!(argument, syn::GenericArgument::Type(inner) if is_option_type(inner)),
    )
}
