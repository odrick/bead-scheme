import type { BrickCell, GridLayout } from "../../beadMath";
import {
    computeBrickLayout,
    type SchemeSizeBeads,
} from "./canvasUtils";

export const PREVIEW_ZOOM_MIN = 0.01;
export const PREVIEW_ZOOM_MAX = 3;
export const PREVIEW_ZOOM_STEP = 0.01;

export function clampPreviewZoom(value: number): number {
    const stepped =
        Math.round(value / PREVIEW_ZOOM_STEP) * PREVIEW_ZOOM_STEP;
    return Math.min(
        PREVIEW_ZOOM_MAX,
        Math.max(PREVIEW_ZOOM_MIN, stepped),
    );
}

export function computeFitPreviewZoom(
    cells: BrickCell[],
    cellSizePx: number,
    gridLayout: GridLayout,
    schemeSizeBeads: SchemeSizeBeads,
    pad: number,
    containerWidth: number,
    containerHeight: number,
): number {
    if (
        containerWidth <= 0 ||
        containerHeight <= 0 ||
        cells.length === 0
    ) {
        return clampPreviewZoom(1);
    }

    const atUnitZoom = computeBrickLayout(
        cells,
        cellSizePx,
        1,
        pad,
        gridLayout,
        schemeSizeBeads,
    );

    if (atUnitZoom.canvasWidth <= 0 || atUnitZoom.canvasHeight <= 0) {
        return clampPreviewZoom(1);
    }

    const margin = 2;
    const fitW = (containerWidth - margin) / atUnitZoom.canvasWidth;
    const fitH = (containerHeight - margin) / atUnitZoom.canvasHeight;

    // Невеликий коефіцієнт — запас від смуг прокрутки та субпіксельного округлення.
    return clampPreviewZoom(Math.min(fitW, fitH) * 0.98);
}
