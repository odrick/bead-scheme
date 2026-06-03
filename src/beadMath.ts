export type RGB = { r: number; g: number; b: number };

export function parseHexColor(hex: string): RGB {
    const h = hex.replace(/^#/, "");
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16),
        };
    }
    if (h.length !== 6) return { r: 255, g: 255, b: 255 };

    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

export function rgbToCss(c: RGB): string {
    return `rgb(${c.r},${c.g},${c.b})`;
}

export function colorDistanceSq(a: RGB, b: RGB): number {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;

    return dr * dr + dg * dg + db * db;
}

/** CIE Lab (D65) для перцептивної відстані між кольорами. */
export type Lab = { L: number; a: number; b: number };

export function rgbToLab(c: RGB): Lab {
    let r = c.r / 255;
    let g = c.g / 255;
    let b = c.b / 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    const X = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) * 100;
    const Y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) * 100;
    const Z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) * 100;

    let xr = X / 95.047;
    let yr = Y / 100.0;
    let zr = Z / 108.883;

    const f = (t: number) =>
        t > 0.00885645167903581
            ? Math.cbrt(t)
            : (903.2962962962963 * t + 16) / 116;

    const fx = f(xr);
    const fy = f(yr);
    const fz = f(zr);

    return {
        L: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz),
    };
}

/** CIE76 Delta E (менше — ближче візуально). */
export function deltaE76(p: Lab, q: Lab): number {
    const dL = p.L - q.L;
    const da = p.a - q.a;
    const db = p.b - q.b;

    return Math.sqrt(dL * dL + da * da + db * db);
}

/** Піксель вважається фоном, якщо відстань до обраного кольору не більша за поріг. */
export function isBackground(p: RGB, bg: RGB, thresholdSq: number): boolean {
    return colorDistanceSq(p, bg) <= thresholdSq;
}

const HIST_BUCKET = 10;

function histKey(r: number, g: number, b: number): string {
    const qr = Math.round(r / HIST_BUCKET) * HIST_BUCKET;
    const qg = Math.round(g / HIST_BUCKET) * HIST_BUCKET;
    const qb = Math.round(b / HIST_BUCKET) * HIST_BUCKET;

    return `${qr},${qg},${qb}`;
}

type Bucket = { count: number; sr: number; sg: number; sb: number };

function addPixel(
    buckets: Map<string, Bucket>,
    r: number,
    g: number,
    b: number,
): void {
    const k = histKey(r, g, b);
    let bkt = buckets.get(k);
    if (!bkt) {
        bkt = { count: 0, sr: 0, sg: 0, sb: 0 };
        buckets.set(k, bkt);
    }
    bkt.count += 1;
    bkt.sr += r;
    bkt.sg += g;
    bkt.sb += b;
}

type BucketEntry = {
    rgb: RGB;
    lab: Lab;
    count: number;
};

/**
 * Палітра: перший колір — найчастіший; далі жадібний добір із балансом
 * «відмінність у Lab» × «частота», щоб рідкі, але помітні кольори
 * (наприклад стебло) не витіснялись десятками відтінків домінанти.
 */
export function extractPalette(
    data: ImageData,
    paletteSize: number,
    options: {
        ignoreBackground: boolean;
        background: RGB;
        bgThresholdSq: number;
        /** Крок вибірки для швидкості; 1 = кожен піксель */
        sampleStep: number;
    },
): RGB[] {
    const { width, height, data: buf } = data;
    const buckets = new Map<string, Bucket>();
    const step = Math.max(1, options.sampleStep);

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            const r = buf[i];
            const g = buf[i + 1];
            const b = buf[i + 2];
            const a = buf[i + 3];
            if (a < 128) continue;
            const rgb: RGB = { r, g, b };
            if (
                options.ignoreBackground &&
                isBackground(rgb, options.background, options.bgThresholdSq)
            ) {
                continue;
            }
            addPixel(buckets, r, g, b);
        }
    }

    const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
    if (sorted.length === 0) return [];

    const maxPool = Math.min(sorted.length, Math.max(paletteSize * 25, 320));
    const pool: BucketEntry[] = sorted.slice(0, maxPool).map((b) => {
        const rgb: RGB = {
            r: Math.round(b.sr / b.count),
            g: Math.round(b.sg / b.count),
            b: Math.round(b.sb / b.count),
        };

        return { rgb, lab: rgbToLab(rgb), count: b.count };
    });

    const paletteLabs: Lab[] = [];
    const palette: RGB[] = [];

    const pushEntry = (e: BucketEntry) => {
        palette.push(e.rgb);
        paletteLabs.push(e.lab);
    };

    pushEntry(pool[0]);

    const countPow = 0.22;
    const used = new Set<number>([0]);

    while (palette.length < paletteSize && used.size < pool.length) {
        let bestIdx = -1;
        let bestScore = -1;

        for (let i = 0; i < pool.length; i++) {
            if (used.has(i)) continue;
            const e = pool[i];
            let minD = Infinity;
            for (const pl of paletteLabs) {
                const d = deltaE76(e.lab, pl);
                if (d < minD) minD = d;
            }
            const score = minD * minD * Math.pow(e.count, countPow);
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        if (bestIdx < 0) break;
        used.add(bestIdx);
        pushEntry(pool[bestIdx]);
    }

    if (palette.length < paletteSize) {
        for (
            let i = 0;
            i < sorted.length && palette.length < paletteSize;
            i++
        ) {
            const b = sorted[i];
            const rgb: RGB = {
                r: Math.round(b.sr / b.count),
                g: Math.round(b.sg / b.count),
                b: Math.round(b.sb / b.count),
            };
            const lab = rgbToLab(rgb);
            let tooClose = false;
            for (const pl of paletteLabs) {
                if (deltaE76(lab, pl) < 2) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;
            palette.push(rgb);
            paletteLabs.push(lab);
        }
    }

    return palette;
}

function averageRect(
    data: ImageData,
    left: number,
    top: number,
    cw: number,
    ch: number,
): RGB {
    const { width, height, data: buf } = data;
    let sr = 0,
        sg = 0,
        sb = 0,
        sa = 0,
        n = 0;
    /** Цілі пікселі, що перетинають [left, left+cw) × [top, top+ch) (кірпічне зміщення дає дробовий left). */
    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(width, Math.ceil(left + cw));
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(height, Math.ceil(top + ch));
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * width + x) * 4;
            const a = buf[i + 3];
            if (a < 128) continue;
            sr += buf[i];
            sg += buf[i + 1];
            sb += buf[i + 2];
            sa += a;
            n += 1;
        }
    }
    if (n === 0) return { r: 255, g: 255, b: 255 };

    return {
        r: Math.round(sr / n),
        g: Math.round(sg / n),
        b: Math.round(sb / n),
    };
}

export type BrickCell = {
    row: number;
    col: number;
    avg: RGB;
    /** індекс у палітрі або -1 якщо клітинка «порожня» (фон) */
    paletteIndex: number;
};

export function countBeadsByPaletteIndex(
    cells: BrickCell[],
    paletteLength: number,
): number[] {
    const counts = new Array<number>(paletteLength).fill(0);

    for (const cell of cells) {
        if (cell.paletteIndex < 0 || cell.paletteIndex >= paletteLength) continue;
        counts[cell.paletteIndex] += 1;
    }

    return counts;
}

/** «кірпич» — зміщення кожного парного ряду на півклітинки; «пряма» — прямокутна сітка; «ажурна» — та сама пряма, повернута на 45°. */
export type GridLayout = "brick" | "straight" | "lace";

const COS45 = Math.SQRT1_2;
const SIN45 = Math.SQRT1_2;

function straightGridCenter(
    row: number,
    col: number,
    cellSize: number,
): { gx: number; gy: number } {
    return {
        gx: col * cellSize + cellSize / 2,
        gy: row * cellSize + cellSize / 2,
    };
}

/** Структурна «дірка» ажурної сітки: непарний ряд, кожна друга клітинка. */
export function isLaceStructuralHole(row: number, col: number): boolean {
    return (row & 1) === 1 && (col & 1) === 1;
}

/** Центр клітинки прямої сітки, повернутої на 45° навколо (originX, originY). */
export function laceGridCellCenter(
    row: number,
    col: number,
    cellSize: number,
    originX: number,
    originY: number,
): { x: number; y: number } {
    const { gx, gy } = straightGridCenter(row, col, cellSize);
    const dx = gx - originX;
    const dy = gy - originY;

    return {
        x: originX + dx * COS45 - dy * SIN45,
        y: originY + dx * SIN45 + dy * COS45,
    };
}

function rotatedSquareIntersectsImage(
    cx: number,
    cy: number,
    size: number,
    width: number,
    height: number,
): boolean {
    const half = size / 2;
    const ext = half * (Math.abs(COS45) + Math.abs(SIN45));

    return cx + ext >= 0 && cx - ext < width && cy + ext >= 0 && cy - ext < height;
}

function averageRotatedSquare(
    imageData: ImageData,
    cx: number,
    cy: number,
    size: number,
): RGB {
    const { width, height, data: buf } = imageData;
    const half = size / 2;
    const cos = COS45;
    const sin = -SIN45;
    const ext = half * (Math.abs(COS45) + Math.abs(SIN45));
    const x0 = Math.max(0, Math.floor(cx - ext));
    const x1 = Math.min(width, Math.ceil(cx + ext));
    const y0 = Math.max(0, Math.floor(cy - ext));
    const y1 = Math.min(height, Math.ceil(cy + ext));

    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;

    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const lx = x - cx;
            const ly = y - cy;
            const gx = lx * cos - ly * sin;
            const gy = lx * sin + ly * cos;
            if (Math.abs(gx) > half || Math.abs(gy) > half) continue;

            const i = (y * width + x) * 4;
            const a = buf[i + 3];
            if (a < 128) continue;
            sr += buf[i];
            sg += buf[i + 1];
            sb += buf[i + 2];
            n += 1;
        }
    }

    if (n === 0) return { r: 255, g: 255, b: 255 };

    return {
        r: Math.round(sr / n),
        g: Math.round(sg / n),
        b: Math.round(sb / n),
    };
}

function paletteIndexForAverage(
    avg: RGB,
    palette: RGB[],
    paletteLabs: Lab[],
    options: {
        ignoreBackground: boolean;
        background: RGB;
        bgThresholdSq: number;
    },
): number {
    if (
        options.ignoreBackground &&
        isBackground(avg, options.background, options.bgThresholdSq)
    ) {
        return -1;
    }
    if (palette.length === 0) return -1;

    const labAvg = rgbToLab(avg);
    let best = 0;
    let bestD = deltaE76(labAvg, paletteLabs[0]);
    for (let p = 1; p < palette.length; p++) {
        const d = deltaE76(labAvg, paletteLabs[p]);
        if (d < bestD) {
            bestD = d;
            best = p;
        }
    }

    return best;
}

export function buildBrickGrid(
    imageData: ImageData,
    cellSize: number,
    palette: RGB[],
    options: {
        ignoreBackground: boolean;
        background: RGB;
        bgThresholdSq: number;
        layout?: GridLayout;
    },
): BrickCell[] {
    const { width: w, height: h } = imageData;
    const cells: BrickCell[] = [];
    const cs = cellSize > 0 ? cellSize : 1e-9;
    const layout = options.layout ?? "brick";
    const paletteLabs =
        palette.length > 0 ? palette.map((p) => rgbToLab(p)) : [];

    if (layout === "lace") {
        const originX = w / 2;
        const originY = h / 2;
        const span = Math.ceil(Math.hypot(w, h) / cs) + 2;

        for (let row = -span; row <= span; row++) {
            for (let col = -span; col <= span; col++) {
                const { x: rcx, y: rcy } = laceGridCellCenter(
                    row,
                    col,
                    cs,
                    originX,
                    originY,
                );
                if (!rotatedSquareIntersectsImage(rcx, rcy, cs, w, h)) continue;

                if (isLaceStructuralHole(row, col)) {
                    cells.push({
                        row,
                        col,
                        avg: { r: 255, g: 255, b: 255 },
                        paletteIndex: -1,
                    });
                    continue;
                }

                const avg = averageRotatedSquare(imageData, rcx, rcy, cs);
                const paletteIndex = paletteIndexForAverage(
                    avg,
                    palette,
                    paletteLabs,
                    options,
                );

                cells.push({ row, col, avg, paletteIndex });
            }
        }

        return cells;
    }

    for (let row = 0; row * cs < h; row++) {
        const offset = layout === "brick" && row % 2 === 1 ? cs / 2 : 0;
        let col = 0;
        while (true) {
            const left = col * cs + offset;
            if (left >= w) break;
            const top = row * cs;
            const cw = Math.min(cs, w - left);
            const ch = Math.min(cs, h - top);
            if (cw <= 0 || ch <= 0) break;

            const avg = averageRect(imageData, left, top, cw, ch);
            const paletteIndex = paletteIndexForAverage(
                avg,
                palette,
                paletteLabs,
                options,
            );

            cells.push({ row, col, avg, paletteIndex });
            col += 1;
        }
    }

    return cells;
}
