import type { ImageMaskSettings } from "./maskTypes";

const MASK_ALPHA_THRESHOLD = 128;
const MASK_RED_THRESHOLD = 128;

export type MaskDrawRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export function isMaskPixelSignificant(
    r: number,
    g: number,
    b: number,
    a: number,
): boolean {
    if (a < MASK_ALPHA_THRESHOLD) return false;

    return r >= MASK_RED_THRESHOLD && r > g * 1.15 && r > b * 1.15;
}

export function computeMaskFitScale(
    imageWidth: number,
    imageHeight: number,
    maskWidth: number,
    maskHeight: number,
): number {
    if (maskWidth <= 0 || maskHeight <= 0) return 1;

    return Math.min(imageWidth / maskWidth, imageHeight / maskHeight);
}

export function computeMaskDrawRect(
    imageWidth: number,
    imageHeight: number,
    maskWidth: number,
    maskHeight: number,
    settings: Pick<ImageMaskSettings, "scale" | "offsetX" | "offsetY">,
): MaskDrawRect {
    const fitScale = computeMaskFitScale(
        imageWidth,
        imageHeight,
        maskWidth,
        maskHeight,
    );
    const scale = fitScale * settings.scale;
    const width = maskWidth * scale;
    const height = maskHeight * scale;

    return {
        x: settings.offsetX - width / 2,
        y: settings.offsetY - height / 2,
        width,
        height,
    };
}

function drawMaskLayer(
    ctx: CanvasRenderingContext2D,
    mask: HTMLImageElement,
    rect: MaskDrawRect,
): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(mask, rect.x, rect.y, rect.width, rect.height);
}

export function applyImageMask(
    source: HTMLImageElement,
    mask: HTMLImageElement,
    settings: Pick<ImageMaskSettings, "scale" | "offsetX" | "offsetY">,
): HTMLCanvasElement {
    const width = source.naturalWidth;
    const height = source.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    ctx.drawImage(source, 0, 0);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;

    const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!maskCtx) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    const rect = computeMaskDrawRect(
        width,
        height,
        mask.naturalWidth,
        mask.naturalHeight,
        settings,
    );
    drawMaskLayer(maskCtx, mask, rect);

    const imageData = ctx.getImageData(0, 0, width, height);
    const maskData = maskCtx.getImageData(0, 0, width, height);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const mr = maskData.data[i];
        const mg = maskData.data[i + 1];
        const mb = maskData.data[i + 2];
        const ma = maskData.data[i + 3];

        if (!isMaskPixelSignificant(mr, mg, mb, ma)) {
            imageData.data[i + 3] = 0;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

export function drawMaskOverlay(
    ctx: CanvasRenderingContext2D,
    mask: HTMLImageElement,
    rect: MaskDrawRect,
    alpha = 0.45,
): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(mask, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
}
