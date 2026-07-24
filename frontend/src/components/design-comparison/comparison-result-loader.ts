import { fetchApi, readApiError } from "@/lib/api";
import type {
    DesignCompareBundle,
    DesignCompareResult,
} from "./types";

const SIDECARS = [
    "core",
    "schematic",
    "pcb",
    "bom",
    "stackup",
    "document_diff",
] as const;

function isBundle(
    payload: DesignCompareResult | DesignCompareBundle,
): payload is DesignCompareBundle {
    return payload.schema === "prism.design_compare_bundle_v1";
}

export async function hydrateDesignComparePayload(
    payload: DesignCompareResult | DesignCompareBundle,
    signal?: AbortSignal,
): Promise<DesignCompareResult> {
    if (!isBundle(payload)) return payload;
    const responses = await Promise.all(
        SIDECARS.map(async (name) => {
            const descriptor = payload.sidecars[name];
            if (!descriptor?.url) {
                throw new Error(`Comparison result is missing its ${name} sidecar`);
            }
            const response = await fetchApi(descriptor.url, { signal });
            if (!response.ok) {
                throw new Error(
                    await readApiError(
                        response,
                        `Failed to load comparison ${name} data`,
                    ),
                );
            }
            return [name, await response.json()] as const;
        }),
    );
    const sidecars = Object.fromEntries(responses) as Record<
        (typeof SIDECARS)[number],
        unknown
    >;
    const core = sidecars.core as Pick<
        DesignCompareResult,
        | "schema"
        | "base"
        | "head"
        | "compare"
        | "diagnostics"
        | "readiness"
        | "files"
    >;
    return {
        ...core,
        schematic: sidecars.schematic as DesignCompareResult["schematic"],
        pcb: sidecars.pcb as DesignCompareResult["pcb"],
        bom: sidecars.bom as DesignCompareResult["bom"],
        stackup: sidecars.stackup as DesignCompareResult["stackup"],
        document_diff:
            sidecars.document_diff as DesignCompareResult["document_diff"],
    };
}
