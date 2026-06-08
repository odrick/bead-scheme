import {
    isLaceStructuralHole,
    laceGridCellCenter,
    rgbToCss,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";
import {
    EMPTY_PALETTE_INDEX,
    isMarkedPaletteIndex,
} from "../pattern/cellEditHistory";

export type SchemeSizeBeads = {
    width: number;
    height: number;
};
export type CanvasBackground = "checkerboard" | "white" | "black";

export type PaintBrickPreviewOptions = {
    zoom: number;
    pad: number;
    layout: GridLayout;
    canvasBackground: CanvasBackground;
    labelPaletteIndices?: boolean;
    schemeSize?: SchemeSizeBeads;
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
    schemeSize?: SchemeSizeBeads,
): BrickLayoutMetrics {
    const cs = cellSize * zoom;
    const radius = cs * 0.48;

    const useFixedScheme =
        schemeSize && schemeSize.width > 0 && schemeSize.height > 0 && layout !== "lace";

    if (useFixedScheme) {
        const rows = schemeSize.height;
        const maxCol = schemeSize.width - 1;

        const canvasWidth =
            layout === "brick"
                ? pad * 2 + (maxCol + 1) * cs + cs / 2
                : pad * 2 + (maxCol + 1) * cs;
        const canvasHeight = pad * 2 + rows * cs;

        return {
            canvasWidth,
            canvasHeight,
            cs,
            radius,
            pad,
            layout,
            laceOriginX: 0,
            laceOriginY: 0,
            laceOffsetX: pad,
            laceOffsetY: pad,
        };
    }

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

        const naturalW = maxX - minX;
        const naturalH = maxY - minY;

        // Якщо задано schemeSize — канвас розширюється до візуального розміру в бісеринках.
        const effectiveW =
            schemeSize && schemeSize.width > 0
                ? Math.max(naturalW, schemeSize.width * cs)
                : naturalW;
        const effectiveH =
            schemeSize && schemeSize.height > 0
                ? Math.max(naturalH, schemeSize.height * cs)
                : naturalH;

        laceOffsetX = pad + (effectiveW - naturalW) / 2 - minX;
        laceOffsetY = pad + (effectiveH - naturalH) / 2 - minY;
        canvasWidth = pad * 2 + effectiveW;
        canvasHeight = pad * 2 + effectiveH;
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

export function paintMarkedBrickCell(
    ctx: CanvasRenderingContext2D,
    cell: BrickCell,
    metrics: BrickLayoutMetrics,
    options: PaintBrickCellsOptions = {},
): void {
    const { strokeWidth } = options;
    const { radius } = metrics;
    const lineWidth = strokeWidth ?? Math.max(0.5, metrics.cs * 0.35 * 0.73);
    const { cx, cy } = getBrickCellCenter(cell, metrics);

    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    const starSize = Math.max(10, radius * 1.5);
    ctx.fillStyle = "#f59e0b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${starSize}px system-ui, sans-serif`;
    ctx.fillText("★", cx, cy);
}

export function paintBrickCell(
    ctx: CanvasRenderingContext2D,
    cell: BrickCell,
    palette: RGB[],
    metrics: BrickLayoutMetrics,
    options: PaintBrickCellsOptions = {},
): void {
    if (isMarkedPaletteIndex(cell.paletteIndex)) {
        paintMarkedBrickCell(ctx, cell, metrics, options);
        return;
    }

    if (cell.paletteIndex < 0) return;

    const { labelPaletteIndices = false, strokeWidth } = options;
    const { radius } = metrics;
    const lineWidth = strokeWidth ?? Math.max(0.5, metrics.cs * 0.35 * 0.73);
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

export function clearBrickCellAt(
    ctx: CanvasRenderingContext2D,
    cell: BrickCell,
    metrics: BrickLayoutMetrics,
    canvasBackground: CanvasBackground,
    canvasWidth: number,
    canvasHeight: number,
): void {
    const { cx, cy } = getBrickCellCenter(cell, metrics);
    const { radius } = metrics;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    drawCanvasBackground(ctx, 0, 0, canvasWidth, canvasHeight, canvasBackground);
    ctx.restore();
}

export function paintBrickCells(
    ctx: CanvasRenderingContext2D,
    cells: BrickCell[],
    palette: RGB[],
    metrics: BrickLayoutMetrics,
    options: PaintBrickCellsOptions = {},
): void {
    for (const cell of cells) {
        paintBrickCell(ctx, cell, palette, metrics, options);
    }
}

export type BrickCellPaletteChange = {
    cell: BrickCell;
    prevPaletteIndex: number;
};

export function findChangedBrickCells(
    prevCells: BrickCell[],
    nextCells: BrickCell[],
): BrickCellPaletteChange[] {
    const prevIndexByKey = new Map<string, number>();

    for (const cell of prevCells) {
        prevIndexByKey.set(`${cell.row},${cell.col}`, cell.paletteIndex);
    }

    const changes: BrickCellPaletteChange[] = [];

    for (const cell of nextCells) {
        const key = `${cell.row},${cell.col}`;
        const prevPaletteIndex = prevIndexByKey.get(key);

        if (prevPaletteIndex === undefined) {
            if (
                cell.paletteIndex >= 0 ||
                isMarkedPaletteIndex(cell.paletteIndex)
            ) {
                changes.push({ cell, prevPaletteIndex: EMPTY_PALETTE_INDEX });
            }
            continue;
        }

        if (prevPaletteIndex !== cell.paletteIndex) {
            changes.push({ cell, prevPaletteIndex });
        }

        prevIndexByKey.delete(key);
    }

    return changes;
}

export function applyBrickCellChanges(
    ctx: CanvasRenderingContext2D,
    changes: BrickCellPaletteChange[],
    palette: RGB[],
    metrics: BrickLayoutMetrics,
    canvasBackground: CanvasBackground,
    canvasWidth: number,
    canvasHeight: number,
    options: PaintBrickCellsOptions = {},
): void {
    for (const { cell } of changes) {
        if (cell.paletteIndex === EMPTY_PALETTE_INDEX) {
            clearBrickCellAt(
                ctx,
                cell,
                metrics,
                canvasBackground,
                canvasWidth,
                canvasHeight,
            );
        } else {
            paintBrickCell(ctx, cell, palette, metrics, options);
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

export function getCanvasPointerCoords(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
}

/**
 * Зворотнє перетворення для ажурної сітки:
 * з canvas-координат (cx, cy) визначаємо row/col бісеринки.
 * Використовує ту саму математику, що й laceGridCellCenter, але в зворотному напрямку.
 */
function laceCellFromCanvas(
    canvasX: number,
    canvasY: number,
    metrics: BrickLayoutMetrics,
): { row: number; col: number } | null {
    const { cs, laceOriginX, laceOriginY, laceOffsetX, laceOffsetY } = metrics;

    // Прибираємо зміщення канвасу → фізичні координати у просторі laceGridCellCenter
    const px = canvasX - laceOffsetX;
    const py = canvasY - laceOffsetY;

    // laceGridCellCenter: x = originX + (gx-originX)*cos - (gy-originY)*sin
    //                     y = originY + (gx-originX)*sin + (gy-originY)*cos, cos=sin=1/√2
    // Звідси: gx = originX + (lx+ly)/√2, gy = originY + (ly-lx)/√2
    const lx = px - laceOriginX;
    const ly = py - laceOriginY;
    const gx = laceOriginX + (lx + ly) * Math.SQRT1_2;
    const gy = laceOriginY + (ly - lx) * Math.SQRT1_2;

    const col = Math.round((gx - cs / 2) / cs);
    const row = Math.round((gy - cs / 2) / cs);

    if (isLaceStructuralHole(row, col)) return null;

    // Перевіряємо, що точка дійсно потрапляє в радіус бісеринки
    const probe: BrickCell = { row, col, avg: { r: 255, g: 255, b: 255 }, paletteIndex: -1 };
    const { cx, cy } = getBrickCellCenter(probe, metrics);

    if (Math.hypot(canvasX - cx, canvasY - cy) > metrics.radius) return null;

    return { row, col };
}

export function hitTestBrickCell(
    canvasX: number,
    canvasY: number,
    cells: BrickCell[],
    cellSize: number,
    zoom: number,
    pad: number,
    layout: GridLayout,
    schemeSize?: SchemeSizeBeads,
): BrickCell | null {
    const metrics = computeBrickLayout(cells, cellSize, zoom, pad, layout, schemeSize);

    if (layout === "lace") {
        const pick = laceCellFromCanvas(canvasX, canvasY, metrics);
        if (!pick) return null;

        return (
            cells.find((c) => c.row === pick.row && c.col === pick.col) ?? {
                row: pick.row,
                col: pick.col,
                avg: { r: 255, g: 255, b: 255 },
                paletteIndex: -1,
            }
        );
    }

    if (schemeSize && schemeSize.width > 0 && schemeSize.height > 0) {
        const { cs } = metrics;
        const row = Math.floor((canvasY - pad) / cs);
        if (row < 0 || row >= schemeSize.height) return null;

        const rowOffset = layout === "brick" && row % 2 === 1 ? cs / 2 : 0;
        const col = Math.floor((canvasX - pad - rowOffset) / cs);
        if (col < 0 || col >= schemeSize.width) return null;

        const probe: BrickCell = { row, col, avg: { r: 0, g: 0, b: 0 }, paletteIndex: -1 };
        const { cx, cy } = getBrickCellCenter(probe, metrics);
        if (Math.hypot(canvasX - cx, canvasY - cy) > metrics.radius) return null;

        return (
            cells.find((c) => c.row === row && c.col === col) ?? {
                row,
                col,
                avg: { r: 255, g: 255, b: 255 },
                paletteIndex: -1,
            }
        );
    }

    let best: BrickCell | null = null;
    let bestDist = Infinity;

    for (const cell of cells) {
        const { cx, cy } = getBrickCellCenter(cell, metrics);
        const dist = Math.hypot(canvasX - cx, canvasY - cy);

        if (dist <= metrics.radius && dist < bestDist) {
            bestDist = dist;
            best = cell;
        }
    }

    return best;
}

export function paintBrickPreview(
    ctx: CanvasRenderingContext2D,
    cells: BrickCell[],
    cellSize: number,
    palette: RGB[],
    options: PaintBrickPreviewOptions,
): void {
    const { zoom, pad, layout, canvasBackground, labelPaletteIndices, schemeSize } =
        options;
    const metrics = computeBrickLayout(
        cells,
        cellSize,
        zoom,
        pad,
        layout,
        schemeSize,
    );

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
