import { fetchApi, fetchJson, readApiError } from "@/lib/api";

import type { FabricationView, PlacementView } from "./types";

export function fetchFabricationView(viewUrl: string): Promise<FabricationView> {
    return fetchJson<FabricationView>(viewUrl, undefined, "Could not load the fabrication package");
}

export function fetchPlacement(placementUrl: string): Promise<PlacementView> {
    return fetchJson<PlacementView>(placementUrl, undefined, "Could not load the placement data");
}

/**
 * One layer's SVG as an object URL.
 *
 * Through `fetchApi` rather than a bare `<img src>` so the request carries
 * credentials and a failure is an error, not a silently empty layer. The caller
 * owns the URL and must revoke it.
 */
export async function fetchLayerObjectUrl(layerUrl: string): Promise<string> {
    const response = await fetchApi(layerUrl);
    if (!response.ok) {
        throw new Error(await readApiError(response, `Could not load layer (${response.status})`));
    }
    const blob = await response.blob();
    // Ownership passes to useLayerImages, which revokes on unmount.
    // react-doctor-disable-next-line react-doctor/no-create-object-url-without-revoke
    return URL.createObjectURL(blob);
}
