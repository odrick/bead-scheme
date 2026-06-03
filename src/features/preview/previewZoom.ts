export const PREVIEW_ZOOM_MIN = 0.01;
export const PREVIEW_ZOOM_MAX = 3;
export const PREVIEW_ZOOM_STEP = 0.05;

export function clampPreviewZoom(value: number): number {
    const stepped =
        Math.round(value / PREVIEW_ZOOM_STEP) * PREVIEW_ZOOM_STEP;
    return Math.min(
        PREVIEW_ZOOM_MAX,
        Math.max(PREVIEW_ZOOM_MIN, stepped),
    );
}
