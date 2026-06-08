import type { BrickLayoutMetrics } from "./canvasUtils";
import type { SchemeSizeBeads } from "../pattern/schemeGrid";

export const WEAVING_CURTAIN_OPACITY = 0.85;

export type WeavingCurtains = {
    leftBeads: number;
    topBeads: number;
};

export const DEFAULT_WEAVING_CURTAINS: WeavingCurtains = {
    leftBeads: 0,
    topBeads: 0,
};

export function clampWeavingCurtains(
    curtains: WeavingCurtains,
    schemeSize: SchemeSizeBeads,
): WeavingCurtains {
    return {
        leftBeads: Math.min(
            Math.max(0, curtains.leftBeads),
            schemeSize.width,
        ),
        topBeads: Math.min(
            Math.max(0, curtains.topBeads),
            schemeSize.height,
        ),
    };
}

export function leftCurtainWidthPx(
    leftBeads: number,
    metrics: BrickLayoutMetrics,
): number {
    if (leftBeads <= 0) return 0;

    return metrics.pad + leftBeads * metrics.cs;
}

export function topCurtainHeightPx(
    topBeads: number,
    metrics: BrickLayoutMetrics,
): number {
    if (topBeads <= 0) return 0;

    return metrics.pad + topBeads * metrics.cs;
}

export function pointerXToLeftCurtainBeads(
    canvasX: number,
    metrics: BrickLayoutMetrics,
    schemeWidth: number,
): number {
    const { pad, cs } = metrics;

    if (canvasX <= pad) return 0;

    return Math.min(
        schemeWidth,
        Math.max(0, (canvasX - pad) / cs),
    );
}

export function pointerYToTopCurtainBeads(
    canvasY: number,
    metrics: BrickLayoutMetrics,
    schemeHeight: number,
): number {
    const { pad, cs } = metrics;

    if (canvasY <= pad) return 0;

    return Math.min(
        schemeHeight,
        Math.max(0, (canvasY - pad) / cs),
    );
}

export function parseWeavingCurtains(value: unknown): WeavingCurtains {
    if (typeof value !== "object" || value === null) {
        return { ...DEFAULT_WEAVING_CURTAINS };
    }

    const record = value as Record<string, unknown>;

    return {
        leftBeads:
            typeof record.leftBeads === "number" && record.leftBeads >= 0
                ? record.leftBeads
                : 0,
        topBeads:
            typeof record.topBeads === "number" && record.topBeads >= 0
                ? record.topBeads
                : 0,
    };
}
