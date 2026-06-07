import {
    countBeadsByPaletteIndex,
    rgbToCss,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";
import {
    computeBrickLayout,
    drawCanvasBackground,
    paintBrickCells,
    type CanvasBackground,
    type SchemeSizeBeads,
} from "../preview/canvasUtils";

/**
 * Усі розміри та відступи експортного PNG.
 * Множники: `footScale` ≈ ширина схеми / footReferenceWidth;
 * для палітри додатково × paletteItemScale.
 */
export const EXPORT_LAYOUT = {
    /** Довша сторона схеми (масштабування вгору і вниз). */
    schemeTargetPx: 4096,
    /** Внутрішній відступ навколо сітки бісеринок на полотні схеми. */
    schemePad: 32,

    /** Еталон ширини для масштабу підпису та палітри (px). */
    footReferenceWidth: 1200,
    /** Поля зліва/справа та знизу всього файлу (× footScale). */
    margin: 48,
    /** Проміжок між схемою та палітрою (× footScale). */
    sectionGap: 28,

    /** Загальний коефіцієнт зменшення елементів палітри (0.8 = −20%). */
    paletteItemScale: 0.8,
    /** Висота рядка палітри (× footScale × paletteItemScale). */
    paletteRowHeight: 52,
    /** Радіус кольорового кружечка (× footScale × paletteItemScale). */
    paletteDotRadius: 18,
    /** Шрифт кількості в палітрі (× footScale × paletteItemScale). */
    paletteCountFontSize: 28,
    /** Зазор між кружечком і кількістю (× … × paletteItemScale). */
    paletteCountGap: 14,
    /** Внутрішній відступ усередині рамки (× … × paletteItemScale). */
    paletteItemPad: 10,
    /** Радіус заокруглення рамки (× … × paletteItemScale). */
    paletteBorderRadius: 10,
    /** Товщина рамки (× … × paletteItemScale, мін. 1 px). */
    paletteBorderWidth: 1.1,
    /** Горизонтальний зазор між рамками сусідніх елементів (× footScale). */
    paletteItemGapX: 14,
    /** Вертикальний зазор між рамками (× footScale). */
    paletteItemGapY: 8,
    /** Елементів палітри в рядку; ширина рядка ділиться на cols порівних слотів. */
    paletteColumnsPerRow: 8,
} as const;

/** @deprecated Використовуйте EXPORT_LAYOUT.schemeTargetPx */
export const EXPORT_SCHEME_TARGET_PX = EXPORT_LAYOUT.schemeTargetPx;

export type ExportPatternInput = {
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    gridLayout: GridLayout;
    canvasBackground: CanvasBackground;
    labelPaletteIndices: boolean;
    schemeSize?: SchemeSizeBeads;
};

function schemeExportZoom(
    cells: BrickCell[],
    cellSizePx: number,
    pad: number,
    layout: GridLayout,
    schemeSize?: SchemeSizeBeads,
): number {
    const natural = computeBrickLayout(
        cells,
        cellSizePx,
        1,
        pad,
        layout,
        schemeSize,
    );
    const maxSide = Math.max(
        1,
        natural.canvasWidth,
        natural.canvasHeight,
    );

    return EXPORT_LAYOUT.schemeTargetPx / maxSide;
}

type PaletteLegendMetrics = {
    rowH: number;
    dotR: number;
    countGap: number;
    itemGapX: number;
    itemGapY: number;
    itemPad: number;
    borderRadius: number;
    borderWidth: number;
};

function paletteLegendMetrics(scale: number): PaletteLegendMetrics {
    const L = EXPORT_LAYOUT;
    const s = scale * L.paletteItemScale;
    const dotR = L.paletteDotRadius * s;

    return {
        rowH: L.paletteRowHeight * s,
        dotR,
        countGap: L.paletteCountGap * s,
        itemGapX: L.paletteItemGapX * scale,
        itemGapY: L.paletteItemGapY * scale,
        itemPad: L.paletteItemPad * s,
        borderRadius: L.paletteBorderRadius * s,
        borderWidth: Math.max(1, L.paletteBorderWidth * s),
    };
}

type PaletteLegendColumnLayout = {
    metrics: PaletteLegendMetrics;
    itemBoxWidth: number;
    columnStep: number;
    cols: number;
    rows: number;
};

function computePaletteLegendColumnLayout(
    width: number,
    paletteLength: number,
    scale: number,
): PaletteLegendColumnLayout {
    const metrics = paletteLegendMetrics(scale);
    const L = EXPORT_LAYOUT;

    const cols = Math.max(
        1,
        Math.min(L.paletteColumnsPerRow, paletteLength),
    );
    const columnStep = width / cols;
    const itemBoxWidth = columnStep - metrics.itemGapX;
    const rows = Math.ceil(paletteLength / cols);

    return { metrics, itemBoxWidth, columnStep, cols, rows };
}

const paletteLegendCountFont = (scale: number) => {
    const size = Math.round(
        EXPORT_LAYOUT.paletteCountFontSize *
            scale *
            EXPORT_LAYOUT.paletteItemScale,
    );
    return `700 ${size}px system-ui, sans-serif`;
};

function measurePaletteLegendHeight(
    width: number,
    paletteLength: number,
    scale: number,
): number {
    const { metrics, rows } = computePaletteLegendColumnLayout(
        width,
        paletteLength,
        scale,
    );

    return rows * metrics.rowH;
}

function strokeRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.stroke();
}

function drawPaletteLegend(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    palette: RGB[],
    beadCounts: number[],
    scale: number,
): void {
    const { metrics, itemBoxWidth, columnStep, cols } =
        computePaletteLegendColumnLayout(width, palette.length, scale);
    const {
        rowH,
        dotR,
        countGap,
        itemGapY,
        itemPad,
        borderRadius,
        borderWidth,
    } = metrics;

    for (let i = 0; i < palette.length; i += 1) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const boxX = x + col * columnStep;
        const boxY = y + row * rowH + itemGapY / 2;
        const boxW = itemBoxWidth;
        const boxH = rowH - itemGapY;
        const midY = boxY + boxH / 2;
        const contentX = boxX + itemPad;

        ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
        ctx.lineWidth = borderWidth;
        strokeRoundedRect(ctx, boxX, boxY, boxW, boxH, borderRadius);

        const dotCx = contentX + dotR;
        ctx.fillStyle = rgbToCss(palette[i]);
        ctx.beginPath();
        ctx.arc(dotCx, midY, dotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = Math.max(1, borderWidth * 0.9);
        ctx.stroke();

        const count = beadCounts[i] ?? 0;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = paletteLegendCountFont(scale);
        ctx.fillText(String(count), dotCx + dotR + countGap, midY);
    }
}

function renderSchemeCanvas(input: ExportPatternInput): HTMLCanvasElement {
    const pad = EXPORT_LAYOUT.schemePad;
    const zoom = schemeExportZoom(
        input.cells,
        input.cellSizePx,
        pad,
        input.gridLayout,
        input.schemeSize,
    );
    const metrics = computeBrickLayout(
        input.cells,
        input.cellSizePx,
        zoom,
        pad,
        input.gridLayout,
        input.schemeSize,
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(metrics.canvasWidth));
    canvas.height = Math.max(1, Math.ceil(metrics.canvasHeight));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    const checkerSize = Math.max(4, Math.round(8 * zoom));
    drawCanvasBackground(
        ctx,
        0,
        0,
        canvas.width,
        canvas.height,
        input.canvasBackground,
        checkerSize,
    );

    paintBrickCells(ctx, input.cells, input.patternPalette, metrics, {
        labelPaletteIndices: input.labelPaletteIndices,
        strokeWidth: Math.max(0.5, zoom * 0.35),
    });

    return canvas;
}

export function renderPatternExport(
    input: ExportPatternInput,
): HTMLCanvasElement {
    const schemeCanvas = renderSchemeCanvas(input);
    const schemeW = schemeCanvas.width;
    const schemeH = schemeCanvas.height;

    const L = EXPORT_LAYOUT;
    const footScale = Math.max(0.35, schemeW / L.footReferenceWidth);
    const margin = Math.round(L.margin * footScale);
    const sectionGap = Math.round(L.sectionGap * footScale);
    const contentW = schemeW;
    const beadCounts = countBeadsByPaletteIndex(
        input.cells,
        input.patternPalette.length,
    );

    const paletteHeight = measurePaletteLegendHeight(
        contentW,
        input.patternPalette.length,
        footScale,
    );

    const totalW = schemeW + margin * 2;
    const totalH =
        margin + schemeH + sectionGap + paletteHeight + margin;

    const canvas = document.createElement("canvas");
    canvas.width = totalW;
    canvas.height = totalH;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas 2D context is unavailable.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);

    ctx.drawImage(schemeCanvas, margin, margin);

    drawPaletteLegend(
        ctx,
        margin,
        margin + schemeH + sectionGap,
        contentW,
        input.patternPalette,
        beadCounts,
        footScale,
    );

    return canvas;
}

export function downloadCanvasAsPng(
    canvas: HTMLCanvasElement,
    filename: string,
): void {
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
}

export function exportFilename(): string {
    return "bead-scheme.png";
}
