/**
 * Every native object kind a comparison change can name, in one table.
 *
 * Kinds arrive as the board-objects member spells them (`segment` is `track`,
 * `global_label` is `label`, sheet-pin is `sheet-pin`), so the kinds below
 * are the only ones a change's `objectKind`, or a target's `kind` or `role`,
 * carries. `compare` still decides a change's category and primary/secondary
 * class.
 *
 * A row says which domain the kind lives in, the reviewer noun for it, and the
 * traits the review modules ask about: how changes group, what counts as
 * noise, which presentation the policy picks, and which layers a selection
 * focuses. Adding a kind is one row here plus the parser.
 */

export type ChangeKindTrait =
    /** Schematic wiring: one conductor's worth of wires, junctions, buses. */
    | "wiring"
    /** Schematic object reviewed as part of a net (policy). */
    | "schematic-net"
    /** A net label; a rename can duplicate the semantic net rename (noise). */
    | "schematic-label"
    /** Terminal, hierarchy or topology object both revisions must show (policy). */
    | "schematic-exact"
    /** PCB routing copper: buckets onto one conductor, summarised as a route. */
    | "copper"
    /**
     * Spans layers rather than sitting on one: contributes focus layers only
     * when the whole selection is made of it, so a via drop does not light up
     * every inner layer its barrel crosses.
     */
    | "via-span"
    /** Belongs to its footprint when it carries the part's RefDes. */
    | "component-child"
    /** Repeats its footprint's placement fields (property panel). */
    | "footprint-primitive"
    /** Fabricated geometry or copper connectivity (policy). */
    | "fabrication"
    /** Text, image or table content read best on one clean revision (policy). */
    | "documentation"
    /** Authored board drawing (policy). */
    | "pcb-graphic"
    /** A design rule or constraint, with no canvas geometry. */
    | "rule";

type ChangeKindRow = {
    domain: "schematic" | "pcb" | "both";
    /** Reviewer noun, singular. */
    noun: string;
    traits: readonly ChangeKindTrait[];
};

const rule = (domain: ChangeKindRow["domain"], noun: string): ChangeKindRow => ({
    domain,
    noun,
    traits: ["rule"],
});

export const CHANGE_KINDS: Readonly<Record<string, ChangeKindRow>> = {
    // Schematic
    symbol: { domain: "schematic", noun: "symbol", traits: [] },
    pin: { domain: "schematic", noun: "pin", traits: ["schematic-exact"] },
    sheet: { domain: "schematic", noun: "sheet", traits: ["schematic-exact"] },
    "sheet-pin": { domain: "schematic", noun: "sheet pin", traits: ["schematic-exact"] },
    "no-connect": { domain: "schematic", noun: "no connect", traits: ["schematic-exact"] },
    wire: { domain: "schematic", noun: "wire", traits: ["wiring", "schematic-net"] },
    junction: { domain: "schematic", noun: "junction", traits: ["wiring", "schematic-net"] },
    bus: { domain: "schematic", noun: "bus", traits: ["wiring", "schematic-exact"] },
    "bus-entry": { domain: "schematic", noun: "bus entry", traits: ["wiring", "schematic-exact"] },
    label: { domain: "schematic", noun: "label", traits: ["schematic-net", "schematic-label"] },
    // Board
    footprint: { domain: "pcb", noun: "footprint", traits: ["fabrication"] },
    pad: { domain: "pcb", noun: "pad", traits: ["component-child", "fabrication"] },
    track: { domain: "pcb", noun: "track", traits: ["copper", "fabrication"] },
    arc: { domain: "pcb", noun: "arc", traits: ["copper", "fabrication"] },
    via: { domain: "pcb", noun: "via", traits: ["copper", "via-span", "fabrication"] },
    zone: { domain: "pcb", noun: "zone", traits: ["component-child", "fabrication"] },
    "footprint-graphic": {
        domain: "pcb",
        noun: "footprint graphic",
        traits: ["component-child", "footprint-primitive", "pcb-graphic"],
    },
    "footprint-text": {
        domain: "pcb",
        noun: "footprint text",
        traits: ["component-child", "footprint-primitive", "documentation"],
    },
    graphic: { domain: "both", noun: "graphic", traits: ["pcb-graphic"] },
    group: { domain: "pcb", noun: "group", traits: [] },
    // Documentation
    text: { domain: "both", noun: "text", traits: ["documentation"] },
    image: { domain: "both", noun: "image", traits: ["documentation"] },
    table: { domain: "both", noun: "table", traits: ["documentation"] },
    // Rules and constraints
    "board-constraint": rule("pcb", "board constraint"),
    "board-default": rule("pcb", "board default"),
    "custom-rule": rule("pcb", "custom rule"),
    "drc-exclusion": rule("pcb", "drc exclusion"),
    "drc-severity": rule("pcb", "drc severity"),
    "erc-exclusion": rule("schematic", "erc exclusion"),
    "erc-pin-rule": rule("schematic", "erc pin rule"),
    "fabrication-output": rule("pcb", "fabrication output"),
    "net-class": rule("pcb", "net class"),
    "net-class-assignment": rule("pcb", "net class assignment"),
    "routing-preset": rule("pcb", "routing preset"),
    "teardrop-setting": rule("pcb", "teardrop setting"),
    "zone-setting": rule("pcb", "zone setting"),
};

/** The kinds carrying one trait, for membership checks. */
export function kindsWith(trait: ChangeKindTrait): ReadonlySet<string> {
    const kinds = new Set<string>();
    for (const [kind, row] of Object.entries(CHANGE_KINDS)) {
        if (row.traits.includes(trait)) kinds.add(kind);
    }
    return kinds;
}

/** Reviewer noun for a kind, singular or plural; unknown kinds read as written. */
export function kindNoun(kind: string, count = 1): string {
    const noun = CHANGE_KINDS[kind]?.noun ?? kind.replace(/[-_]/g, " ");
    return count === 1 ? noun : `${noun}s`;
}
