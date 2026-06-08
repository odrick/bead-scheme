import type { BrickCell, GridLayout } from "../../beadMath";
import {
    computeBrickLayout,
    type SchemeSizeBeads,
} from "./canvasUtils";

export const PREVIEW_ZOOM_MIN = 0.01;
export const PREVIEW_ZOOM_MAX = 3;
export const PREVIEW_ZOOM_STEP = 0.01;
/**
 * Швидкість масштабування Ctrl+коліщатком: впливає на відносний крок за один тик.
 * Масштаб множиться, а не додається — швидкість виглядає однаково на всіх рівнях.
 */
export const PREVIEW_ZOOM_WHEEL_SPEED = 3;
/** Відносний множник масштабу за один тик коліщатка. */
export const PREVIEW_ZOOM_WHEEL_FACTOR =
    1 + PREVIEW_ZOOM_STEP * PREVIEW_ZOOM_WHEEL_SPEED;

export function applyPreviewZoomWheelStep(
    zoom: number,
    direction: 1 | -1,
): number {
    const factor =
        direction > 0
            ? PREVIEW_ZOOM_WHEEL_FACTOR
            : 1 / PREVIEW_ZOOM_WHEEL_FACTOR;

    return clampPreviewZoom(zoom * factor);
}
/** Інтервал застосування масштабу після зміни повзунка або Ctrl+коліщатка. */
export const PREVIEW_ZOOM_APPLY_INTERVAL_MS = 50;

export function clampPreviewZoom(value: number): number {
    const stepped =
        Math.round(value / PREVIEW_ZOOM_STEP) * PREVIEW_ZOOM_STEP;
    return Math.min(
        PREVIEW_ZOOM_MAX,
        Math.max(PREVIEW_ZOOM_MIN, stepped),
    );
}

export type PreviewZoomScrollAnchor = {
    clientX: number;
    clientY: number;
};

/** Зберігає точку під курсором після зміни масштабу (масштаб відносно pad). */
export function adjustPreviewScrollForZoomAtPointer(
    wrap: HTMLElement,
    anchor: PreviewZoomScrollAnchor,
    oldZoom: number,
    newZoom: number,
    pad: number,
): void {
    if (oldZoom === newZoom || oldZoom <= 0 || newZoom <= 0) return;

    const rect = wrap.getBoundingClientRect();
    const pointerX = anchor.clientX - rect.left;
    const pointerY = anchor.clientY - rect.top;
    const contentX = wrap.scrollLeft + pointerX;
    const contentY = wrap.scrollTop + pointerY;
    const scale = newZoom / oldZoom;

    const newContentX = pad + (contentX - pad) * scale;
    const newContentY = pad + (contentY - pad) * scale;

    wrap.scrollLeft = Math.max(0, newContentX - pointerX);
    wrap.scrollTop = Math.max(0, newContentY - pointerY);
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
