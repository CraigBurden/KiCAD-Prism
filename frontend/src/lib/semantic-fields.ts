// The order the component inspector lists a semantic-index component's fields.
//
// The canonical BOM fields come first, in the order the index builds them
// (`_canonical_fields`, backend/app/services/semantic_index_service.py); every
// other field follows A to Z. The order then no longer depends on how the
// index serialized its map: today's Python index (a0) keeps insertion order,
// the design bundle's (a1) keeps code point order, and both read the same.

const CANONICAL_FIELD_ORDER = [
    "Value", "DNP", "In BOM", "Description", "Datasheet", "Manufacturer",
    "Manufacturer Part Number", "Vendor", "Vendor Part Number", "Footprint",
    "Mass (g)", "RQjC (C/W)", "RQjC_top (C/W)", "Temp_max (C)", "Temp_min (C)",
    "Power Dissipation (W)", "Rate",
];

const CANONICAL_FIELD_RANK = new Map(CANONICAL_FIELD_ORDER.map((key, index) => [key, index]));

export function orderedFieldEntries<T>(fields: Record<string, T>): [string, T][] {
    return Object.entries(fields).sort(([left], [right]) => {
        const leftRank = CANONICAL_FIELD_RANK.get(left) ?? CANONICAL_FIELD_ORDER.length;
        const rightRank = CANONICAL_FIELD_RANK.get(right) ?? CANONICAL_FIELD_ORDER.length;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left < right ? -1 : left > right ? 1 : 0;
    });
}
