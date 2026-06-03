import {
    laceGridCellCenter,
    rgbToCss,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";
export type CanvasBackground = "checkerboard" | "white" | "black";

export type PaintBrickPreviewOptions = {
    zoom: number;
    pad: number;
    layout: GridLayout;
    canvasBackground: CanvasBackground;
    labelPaletteIndices?: boolean;
};

export type BrickLayoutMetrics = {
    canvasWidth: number;
    canvasHeight: number;
    cs: number;
    radius: number;
    pad: number;
    layout: GridLayout;
    laceOriginX: number;
    laceOriginY: number;
    laceOffsetX: number;
    laceOffsetY: number;
};

export function contrastingTextColor(c: RGB): "#000000" | "#ffffff" {
    const luminance = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return luminance > 0.55 ? "#000000" : "#ffffff";
}

export function computeBrickLayout(
    cells: BrickCell[],
    cellSize: number,
    zoom: number,
    pad: number,
    layout: GridLayout,
): BrickLayoutMetrics {
    const cs = cellSize * zoom;
    const radius = cs * 0.48;

    let maxCol = 0;
    for (const cell of cells) {
        maxCol = Math.max(maxCol, cell.col);
    }

    const rows =
        cells.length === 0 ? 0 : Math.max(...cells.map((cell) => cell.row)) + 1;

    let canvasWidth: number;
    let canvasHeight: number;
    let laceOriginX = 0;
    let laceOriginY = 0;
    let laceOffsetX = pad;
    let laceOffsetY = pad;

    if (layout === "lace" && cells.length > 0) {
        let minRow = Infinity;
        let maxRow = -Infinity;
        let minCol = Infinity;
        let maxColLace = -Infinity;
        for (const cell of cells) {
            minRow = Math.min(minRow, cell.row);
            maxRow = Math.max(maxRow, cell.row);
            minCol = Math.min(minCol, cell.col);
            maxColLace = Math.max(maxColLace, cell.col);
        }
        laceOriginX = ((minCol + maxColLace) / 2 + 0.5) * cs;
        laceOriginY = ((minRow + maxRow) / 2 + 0.5) * cs;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const cell of cells) {
            const { x, y } = laceGridCellCenter(
                cell.row,
                cell.col,
                cs,
                laceOriginX,
                laceOriginY,
            );
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
        laceOffsetX = pad - minX;
        laceOffsetY = pad - minY;
        canvasWidth = pad * 2 + (maxX - minX);
        canvasHeight = pad * 2 + (maxY - minY);
    } else {
        canvasWidth =
            layout === "brick"
                ? pad * 2 + (maxCol + 1) * cs + cs / 2
                : pad * 2 + (maxCol + 1) * cs;
        canvasHeight = pad * 2 + rows * cellSize * zoom;
    }

    return {
        canvasWidth,
        canvasHeight,
        cs,
        radius,
        pad,
        layout,
        laceOriginX,
        laceOriginY,
        laceOffsetX,
        laceOffsetY,
    };
}

export function getBrickCellCenter(
    cell: BrickCell,
    metrics: BrickLayoutMetrics,
): { cx: number; cy: number } {
    const {
        cs,
        pad,
        layout,
        laceOriginX,
        laceOriginY,
        laceOffsetX,
        laceOffsetY,
    } = metrics;

    if (layout === "lace") {
        const center = laceGridCellCenter(
            cell.row,
            cell.col,
            cs,
            laceOriginX,
            laceOriginY,
        );
        return {
            cx: center.x + laceOffsetX,
            cy: center.y + laceOffsetY,
        };
    }

    const ox = (layout === "brick" && cell.row % 2 === 1 ? cs / 2 : 0) + pad;

    return {
        cx: ox + cell.col * cs + cs / 2,
        cy: pad + cell.row * cs + cs / 2,
    };
}

export type PaintBrickCellsOptions = {
    labelPaletteIndices?: boolean;
    strokeWidth?: number;
};

export function paintBrickCells(
    ctx: CanvasRenderingContext2D,
    cells: BrickCell[],
    palette: RGB[],
    metrics: BrickLayoutMetrics,
    options: PaintBrickCellsOptions = {},
): void {
    const { labelPaletteIndices = false, strokeWidth } = options;
    const { radius } = metrics;
    const lineWidth = strokeWidth ?? Math.max(0.5, metrics.cs * 0.35 * 0.73);

    for (const cell of cells) {
        if (cell.paletteIndex < 0) continue;

        const color = palette[cell.paletteIndex];
        const { cx, cy } = getBrickCellCenter(cell, metrics);

        ctx.fillStyle = rgbToCss(color);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        if (labelPaletteIndices) {
            const fontSize = Math.max(8, radius * 1.05);
            ctx.fillStyle = contrastingTextColor(color);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
            ctx.fillText(String(cell.paletteIndex + 1), cx, cy);
        }
    }
}

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

export function drawCanvasBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    background: CanvasBackground,
    checkerSize = 8,
): void {
    if (background === "checkerboard") {
        drawCheckerboard(ctx, x, y, w, h, "#f0f0f0", "#d8d8d8", checkerSize);
        return;
    }

    ctx.fillStyle = background === "white" ? "#ffffff" : "#000000";
    ctx.fillRect(x, y, w, h);
}

export function paintBrickPreview(
    ctx: CanvasRenderingContext2D,
    cells: BrickCell[],
    cellSize: number,
    palette: RGB[],
    options: PaintBrickPreviewOptions,
): void {
    const { zoom, pad, layout, canvasBackground, labelPaletteIndices } = options;
    const metrics = computeBrickLayout(cells, cellSize, zoom, pad, layout);

    ctx.canvas.width = Math.max(1, Math.ceil(metrics.canvasWidth));
    ctx.canvas.height = Math.max(1, Math.ceil(metrics.canvasHeight));

    drawCanvasBackground(
        ctx,
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height,
        canvasBackground,
    );

    paintBrickCells(ctx, cells, palette, metrics, {
        labelPaletteIndices,
        strokeWidth: Math.max(0.5, zoom * 0.35),
    });
}
