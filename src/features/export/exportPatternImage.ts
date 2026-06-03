import type { PreparedBeadCatalog } from "../../beadCatalog";
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
    /** Висота блоку з назвою виробника (× footScale). */
    titleBlock: 40,
    /** Проміжок між назвою виробника та палітрою (× footScale). */
    sectionGap: 28,
    /** Розмір шрифту назви виробника (× footScale). */
    titleFontSize: 28,

    /** Загальний коефіцієнт зменшення елементів палітри (0.8 = −20%). */
    paletteItemScale: 0.8,
    /** Висота рядка палітри (× footScale × paletteItemScale). */
    paletteRowHeight: 52,
    /** Радіус кольорового кружечка (× footScale × paletteItemScale). */
    paletteDotRadius: 18,
    /** Шрифт номера в палітрі (× footScale × paletteItemScale). */
    paletteNumberFontSize: 28,
    /** Шрифт коду виробника (× footScale × paletteItemScale). */
    paletteCodeFontSize: 26,
    /** Відступ після номера до початку кружечка (× … × paletteItemScale). */
    paletteNumberPad: 6,
    /** Зазор між номером і кружечком (× … × paletteItemScale). */
    paletteNumberToDotGap: 4,
    /** Зазор між кружечком і текстом коду (× … × paletteItemScale). */
    paletteCodeGap: 14,
    /** Внутрішній відступ усередині рамки (× … × paletteItemScale). */
    paletteItemPad: 10,
    /** Радіус заокруглення рамки (× … × paletteItemScale). */
    paletteBorderRadius: 10,
    /** Товщина рамки (× … × paletteItemScale, мін. 1 px). */
    paletteBorderWidth: 1.1,
    /** Горизонтальний зазор між рамками сусідніх елементів (× footScale). */
    paletteItemGapX: 28,
    /** Вертикальний зазор між рамками (× footScale). */
    paletteItemGapY: 8,
    /** Елементів палітри в рядку; ширина рядка ділиться на cols порівних слотів. */
    paletteColumnsPerRow: 4,
} as const;

/** @deprecated Використовуйте EXPORT_LAYOUT.schemeTargetPx */
export const EXPORT_SCHEME_TARGET_PX = EXPORT_LAYOUT.schemeTargetPx;

export type ExportPatternInput = {
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    beadMatches: { code: string }[];
    manufacturerLabel: string;
    gridLayout: GridLayout;
    canvasBackground: CanvasBackground;
    labelPaletteIndices: boolean;
};

function schemeExportZoom(
    cells: BrickCell[],
    cellSizePx: number,
    pad: number,
    layout: GridLayout,
): number {
    const natural = computeBrickLayout(cells, cellSizePx, 1, pad, layout);
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
    numberPad: number;
    numberToDotGap: number;
    codeGap: number;
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
        numberPad: L.paletteNumberPad * s,
        numberToDotGap: L.paletteNumberToDotGap * s,
        codeGap: L.paletteCodeGap * s,
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

const paletteLegendNumberFont = (scale: number) => {
    const size = Math.round(
        EXPORT_LAYOUT.paletteNumberFontSize *
            scale *
            EXPORT_LAYOUT.paletteItemScale,
    );
    return `600 ${size}px system-ui, sans-serif`;
};

const paletteLegendCodeFont = (scale: number) => {
    const size = Math.round(
        EXPORT_LAYOUT.paletteCodeFontSize *
            scale *
            EXPORT_LAYOUT.paletteItemScale,
    );
    return `700 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
};

function paletteLegendNumberColumnWidth(
    ctx: CanvasRenderingContext2D,
    itemCount: number,
    scale: number,
): number {
    const { numberPad } = paletteLegendMetrics(scale);
    ctx.font = paletteLegendNumberFont(scale);
    let maxTextW = 0;
    for (let i = 0; i < itemCount; i += 1) {
        maxTextW = Math.max(maxTextW, ctx.measureText(String(i + 1)).width);
    }

    return maxTextW + numberPad;
}

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
    beadMatches: { code: string }[],
    beadCounts: number[],
    scale: number,
): void {
    const { metrics, itemBoxWidth, columnStep, cols } =
        computePaletteLegendColumnLayout(width, palette.length, scale);
    const {
        rowH,
        dotR,
        numberToDotGap,
        codeGap,
        itemGapY,
        itemPad,
        borderRadius,
        borderWidth,
    } = metrics;
    const numberColW = paletteLegendNumberColumnWidth(ctx, palette.length, scale);

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

        ctx.fillStyle = "#111111";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = paletteLegendNumberFont(scale);
        ctx.fillText(String(i + 1), contentX, midY);

        const dotCx = contentX + numberColW + numberToDotGap + dotR;
        ctx.fillStyle = rgbToCss(palette[i]);
        ctx.beginPath();
        ctx.arc(dotCx, midY, dotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = Math.max(1, borderWidth * 0.9);
        ctx.stroke();

        const code = beadMatches[i]?.code ?? "—";
        const count = beadCounts[i] ?? 0;
        ctx.fillStyle = "#000000";
        ctx.font = paletteLegendCodeFont(scale);
        ctx.fillText(`${code} (${count})`, dotCx + dotR + codeGap, midY);
    }
}

function renderSchemeCanvas(input: ExportPatternInput): HTMLCanvasElement {
    const pad = EXPORT_LAYOUT.schemePad;
    const zoom = schemeExportZoom(
        input.cells,
        input.cellSizePx,
        pad,
        input.gridLayout,
    );
    const metrics = computeBrickLayout(
        input.cells,
        input.cellSizePx,
        zoom,
        pad,
        input.gridLayout,
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
    const titleBlock = Math.round(L.titleBlock * footScale);
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
        margin + schemeH + titleBlock + sectionGap + paletteHeight + margin;

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

    const titleY = margin + schemeH + titleBlock * 0.72;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.round(L.titleFontSize * footScale)}px system-ui, sans-serif`;
    ctx.fillText(input.manufacturerLabel, margin, titleY);

    drawPaletteLegend(
        ctx,
        margin,
        margin + schemeH + titleBlock + sectionGap,
        contentW,
        input.patternPalette,
        input.beadMatches,
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

export function exportFilenameForCatalog(catalog: PreparedBeadCatalog): string {
    const slug = catalog.id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `bead-scheme${slug ? `-${slug}` : ""}.png`;
}
