import {
    isLaceStructuralHole,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";

export type SchemeSizeBeads = {
    width: number;
    height: number;
};

export type ImageGridBounds = SchemeSizeBeads & {
    minRow: number;
    minCol: number;
    maxRow: number;
    maxCol: number;
};

const EMPTY_AVG: RGB = { r: 255, g: 255, b: 255 };

export function measureImageGridBounds(cells: BrickCell[]): ImageGridBounds {
    if (cells.length === 0) {
        return {
            minRow: 0,
            minCol: 0,
            maxRow: -1,
            maxCol: -1,
            width: 0,
            height: 0,
        };
    }

    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    for (const cell of cells) {
        minRow = Math.min(minRow, cell.row);
        maxRow = Math.max(maxRow, cell.row);
        minCol = Math.min(minCol, cell.col);
        maxCol = Math.max(maxCol, cell.col);
    }

    return {
        minRow,
        minCol,
        maxRow,
        maxCol,
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1,
    };
}

export function clampSchemeSize(
    size: SchemeSizeBeads,
    minWidth = 1,
    minHeight = 1,
    maxWidth = 800,
    maxHeight = 800,
): SchemeSizeBeads {
    return {
        width: Math.min(maxWidth, Math.max(minWidth, Math.round(size.width))),
        height: Math.min(maxHeight, Math.max(minHeight, Math.round(size.height))),
    };
}

export function mapImageCellsToScheme(
    imageCells: BrickCell[],
    imageBounds: ImageGridBounds,
    schemeSize: SchemeSizeBeads,
): BrickCell[] {
    if (imageCells.length === 0 || schemeSize.width <= 0 || schemeSize.height <= 0) {
        return [];
    }

    const rowOffset =
        Math.floor((schemeSize.height - imageBounds.height) / 2) -
        imageBounds.minRow;
    const colOffset =
        Math.floor((schemeSize.width - imageBounds.width) / 2) -
        imageBounds.minCol;

    const mapped: BrickCell[] = [];

    for (const cell of imageCells) {
        const row = cell.row + rowOffset;
        const col = cell.col + colOffset;

        if (row < 0 || row >= schemeSize.height || col < 0 || col >= schemeSize.width) {
            continue;
        }

        mapped.push({ ...cell, row, col });
    }

    return mapped;
}

export function mergeSchemeCells(
    baseCells: BrickCell[],
    overrides: Record<string, number>,
    schemeSize: SchemeSizeBeads,
    layout: GridLayout,
): BrickCell[] {
    const byKey = new Map<string, BrickCell>();

    for (const cell of baseCells) {
        byKey.set(`${cell.row},${cell.col}`, cell);
    }

    for (const [key, paletteIndex] of Object.entries(overrides)) {
        const existing = byKey.get(key);

        if (existing) {
            byKey.set(key, { ...existing, paletteIndex });
            continue;
        }

        const [rowText, colText] = key.split(",");
        const row = Number.parseInt(rowText, 10);
        const col = Number.parseInt(colText, 10);

        if (
            Number.isNaN(row) ||
            Number.isNaN(col) ||
            row < 0 ||
            row >= schemeSize.height ||
            col < 0 ||
            col >= schemeSize.width
        ) {
            continue;
        }

        if (layout === "lace" && isLaceStructuralHole(row, col)) {
            continue;
        }

        byKey.set(key, {
            row,
            col,
            avg: EMPTY_AVG,
            paletteIndex,
        });
    }

    return [...byKey.values()];
}

export function filterOverridesToScheme(
    overrides: Record<string, number>,
    schemeSize: SchemeSizeBeads,
): Record<string, number> {
    const filtered: Record<string, number> = {};

    for (const [key, paletteIndex] of Object.entries(overrides)) {
        const [rowText, colText] = key.split(",");
        const row = Number.parseInt(rowText, 10);
        const col = Number.parseInt(colText, 10);

        if (
            Number.isNaN(row) ||
            Number.isNaN(col) ||
            row < 0 ||
            row >= schemeSize.height ||
            col < 0 ||
            col >= schemeSize.width
        ) {
            continue;
        }

        filtered[key] = paletteIndex;
    }

    return filtered;
}
