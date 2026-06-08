export type SourceTransform = {
    /** Множник масштабу відносно розміру оригіналу (1 = без змін). */
    scale: number;
    /** Зміщення центру зображення в координатах оригіналу (пікселі). */
    offsetX: number;
    offsetY: number;
};

export const SOURCE_SCALE_MIN = 0.1;
export const SOURCE_SCALE_MAX = 5;
export const SOURCE_SCALE_STEP = 0.01;
export const DEFAULT_SOURCE_SCALE = 1;

export function defaultSourceTransform(): SourceTransform {
    return {
        scale: DEFAULT_SOURCE_SCALE,
        offsetX: 0,
        offsetY: 0,
    };
}

export function clampSourceScale(value: number): number {
    const stepped =
        Math.round(value / SOURCE_SCALE_STEP) * SOURCE_SCALE_STEP;
    return Math.min(
        SOURCE_SCALE_MAX,
        Math.max(SOURCE_SCALE_MIN, stepped),
    );
}

export function isDefaultSourceTransform(
    transform: SourceTransform,
): boolean {
    return (
        transform.scale === DEFAULT_SOURCE_SCALE &&
        transform.offsetX === 0 &&
        transform.offsetY === 0
    );
}

export function sourceTransformKey(transform: SourceTransform): string {
    return `${transform.scale}:${transform.offsetX}:${transform.offsetY}`;
}

export function drawTransformedSource(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource & { width: number; height: number },
    transform: SourceTransform,
): void {
    const width = source.width;
    const height = source.height;

    ctx.save();
    ctx.translate(
        width / 2 + transform.offsetX,
        height / 2 + transform.offsetY,
    );
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    ctx.restore();
}

export function applySourceTransform(
    source: HTMLImageElement,
    transform: SourceTransform,
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

    drawTransformedSource(ctx, source, transform);

    return canvas;
}

export function parseSourceTransform(value: unknown): SourceTransform {
    if (typeof value !== "object" || value === null) {
        return defaultSourceTransform();
    }

    const record = value as Record<string, unknown>;
    const scale = record.scale;
    const offsetX = record.offsetX;
    const offsetY = record.offsetY;

    if (
        typeof scale !== "number" ||
        typeof offsetX !== "number" ||
        typeof offsetY !== "number"
    ) {
        return defaultSourceTransform();
    }

    return {
        scale: clampSourceScale(scale),
        offsetX,
        offsetY,
    };
}
