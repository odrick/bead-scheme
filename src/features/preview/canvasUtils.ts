import {
    rgbToCss,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";
import type { SpeechHighlight } from "../speech/speechSequence";

export type PaintBrickPreviewOptions = {
    ignoreBackground: boolean;
    zoom: number;
    pad: number;
    showEmptyAsTransparent: boolean;
    layout: GridLayout;
    activeHighlight?: SpeechHighlight | null;
};

export function loadImageToImageData(
    source: HTMLImageElement | HTMLCanvasElement,
): ImageData {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function drawCheckerboard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    light: string,
    dark: string,
    size: number,
): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const n = Math.ceil(w / size) + 2;
    const m = Math.ceil(h / size) + 2;

    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < m; j += 1) {
            ctx.fillStyle = (i + j) % 2 === 0 ? light : dark;
            ctx.fillRect(x + i * size, y + j * size, size, size);
        }
    }

    ctx.restore();
}

export function paintBrickPreview(
    ctx: CanvasRenderingContext2D,
    cells: BrickCell[],
    cellSize: number,
    palette: RGB[],
    options: PaintBrickPreviewOptions,
): void {
    const {
        zoom,
        pad,
        ignoreBackground,
        showEmptyAsTransparent,
        layout,
        activeHighlight = null,
    } = options;
    const cs = cellSize * zoom;
    const radius = cs * 0.48;

    let maxCol = 0;
    for (const cell of cells) {
        maxCol = Math.max(maxCol, cell.col);
    }

    const rows =
        cells.length === 0 ? 0 : Math.max(...cells.map((cell) => cell.row)) + 1;
    const width =
        layout === "brick"
            ? pad * 2 + (maxCol + 1) * cs + cs / 2
            : pad * 2 + (maxCol + 1) * cs;
    const height = pad * 2 + rows * cellSize * zoom;

    ctx.canvas.width = Math.max(1, Math.ceil(width));
    ctx.canvas.height = Math.max(1, Math.ceil(height));

    drawCheckerboard(
        ctx,
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height,
        "#f0f0f0",
        "#d8d8d8",
        8,
    );

    for (const cell of cells) {
        const ox =
            (layout === "brick" && cell.row % 2 === 1 ? cs / 2 : 0) + pad;
        const cx = ox + cell.col * cs + cs / 2;
        const cy = pad + cell.row * cs + cs / 2;

        if (cell.paletteIndex < 0) {
            if (showEmptyAsTransparent && ignoreBackground) {
                drawCheckerboard(
                    ctx,
                    cx - radius,
                    cy - radius,
                    radius * 2,
                    radius * 2,
                    "#e8e8e8",
                    "#c8c8c8",
                    4,
                );
                ctx.strokeStyle = "rgba(0,0,0,0.12)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            continue;
        }

        const color = palette[cell.paletteIndex];
        const isActive =
            activeHighlight !== null &&
            cell.row === activeHighlight.row &&
            cell.col >= activeHighlight.fromCol &&
            cell.col <= activeHighlight.toCol;

        ctx.save();
        if (activeHighlight !== null && !isActive) {
            ctx.globalAlpha = 0.35;
        }
        ctx.fillStyle = rgbToCss(color);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = Math.max(0.5, zoom * 0.35);
        ctx.stroke();
        ctx.restore();

        if (isActive) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius + Math.max(1.5, cs * 0.08), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 222, 89, 0.95)";
            ctx.lineWidth = Math.max(1.5, zoom * 1.15);
            ctx.shadowColor = "rgba(255, 222, 89, 0.7)";
            ctx.shadowBlur = Math.max(8, cs * 0.55);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, radius + Math.max(0.5, cs * 0.03), 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = Math.max(1, zoom * 0.7);
            ctx.shadowBlur = 0;
            ctx.stroke();
            ctx.restore();
        }
    }
}
