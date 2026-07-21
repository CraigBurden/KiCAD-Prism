import type {
    EcadDocumentComparisonPreparation,
} from "@/types/ecad-viewer";
import {
    resolveSideBySideFocus,
    type SideBySideFocusTarget,
} from "./revision-sources";
import type {
    ChangeItem,
    KiCadProjectDiffBundle,
} from "./types";

export type ComparisonSelection =
    | { kind: "item" | "group"; id: string }
    | null;

export function resolveNativeSelection(
    preparation: EcadDocumentComparisonPreparation,
    documentDiff: KiCadProjectDiffBundle,
    selection: ComparisonSelection,
    changes: ChangeItem[],
): { kind: "change" | "group"; id: string } | null {
    const changeIds = changes
        .map((change) => documentDiff.navigation[change.id])
        .filter(
            (
                entry,
            ): entry is { documentPath: string; changeId: string } =>
                Boolean(
                    entry
                    && entry.documentPath === preparation.document.path,
                ),
        )
        .map((entry) => entry.changeId);

    if (!changeIds.length) return null;
    if (selection?.kind === "group") {
        const group = [...preparation.targets.values()].find(
            (target) =>
                target.kind === "group"
                && changeIds.every((id) => target.memberIds.includes(id)),
        );
        if (group) return { kind: "group", id: group.id };
    }

    return { kind: "change", id: changeIds[0]! };
}

export function resolveComparisonFocus(
    changes: ChangeItem[],
): SideBySideFocusTarget | null {
    return resolveSideBySideFocus(changes);
}
