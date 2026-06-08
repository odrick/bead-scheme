import type { MaskKind } from "./maskTypes";

const MASK_BASE = `${import.meta.env.BASE_URL}masks`;

export const MASK_ASSET_URLS: Record<Exclude<MaskKind, "none">, string> = {
    circle: `${MASK_BASE}/circle.png`,
    tie: `${MASK_BASE}/tie.png`,
    gerdana: `${MASK_BASE}/gerdana.png`,
};

export function isMaskKind(value: string): value is MaskKind {
    return (
        value === "none" ||
        value === "circle" ||
        value === "tie" ||
        value === "gerdana"
    );
}
