import { type BrickCell, type GridLayout } from "../../beadMath";
import {
    EMPTY_PALETTE_INDEX,
    getBasePaletteIndex,
    isMarkedKey,
    type CellEditChange,
    type MarkEditChange,
    cellKey,
} from "./cellEditHistory";
import type { SchemeSizeBeads } from "./schemeGrid";

export type GridCoord = {
    row: number;
    col: number;
};

export function buildPaletteIndexLookup(
    cells: BrickCell[],
): Map<string, number> {
    const lookup = new Map<string, number>();

    for (const cell of cells) {
        lookup.set(cellKey(cell.row, cell.col), cell.paletteIndex);
    }

    return lookup;
}

/**
 * Список 4-зв'язних сусідів для будь-якого типу сітки.
 * Для «Цегли» враховується зміщення непарних рядків.
 * Для «Прямої» та «Ажурної» — стандартні 4 напрямки.
 * Структурні дірки «Ажурної» блокуються через lookup (paletteIndex = -1),
 * тому тут ніяких додаткових перевірок не треба.
 */
function candidates(
    row: number,
    col: number,
    layout: GridLayout,
): GridCoord[] {
    if (layout === "brick") {
        const base: GridCoord[] = [
            { row, col: col - 1 },
            { row, col: col + 1 },
        ];

        if (row % 2 === 0) {
            base.push(
                { row: row - 1, col: col - 1 },
                { row: row - 1, col },
                { row: row + 1, col: col - 1 },
                { row: row + 1, col },
            );
        } else {
            base.push(
                { row: row - 1, col },
                { row: row - 1, col: col + 1 },
                { row: row + 1, col },
                { row: row + 1, col: col + 1 },
            );
        }

        return base;
    }

    return [
        { row: row - 1, col },
        { row: row + 1, col },
        { row, col: col - 1 },
        { row, col: col + 1 },
    ];
}

function inScheme(
    row: number,
    col: number,
    schemeSize: SchemeSizeBeads | undefined,
): boolean {
    if (!schemeSize) return true;

    return (
        row >= 0 &&
        row < schemeSize.height &&
        col >= 0 &&
        col < schemeSize.width
    );
}

export function floodFillRegion(
    cells: BrickCell[],
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
): GridCoord[] {
    const lookup = buildPaletteIndexLookup(cells);

    const startKey = cellKey(startRow, startCol);
    const sourceIndex = lookup.get(startKey) ?? EMPTY_PALETTE_INDEX;

    if (sourceIndex === EMPTY_PALETTE_INDEX) {
        return [];
    }

    const bounds = schemeSize;

    const visited = new Set<string>();
    const queue: GridCoord[] = [{ row: startRow, col: startCol }];
    const result: GridCoord[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const key = cellKey(current.row, current.col);

        if (visited.has(key)) continue;
        visited.add(key);

        const paletteIndex = lookup.get(key) ?? -1;
        if (paletteIndex !== sourceIndex) continue;

        result.push(current);

        for (const neighbor of candidates(current.row, current.col, layout)) {
            const nk = cellKey(neighbor.row, neighbor.col);
            if (!visited.has(nk) && inScheme(neighbor.row, neighbor.col, bounds)) {
                queue.push(neighbor);
            }
        }
    }

    return result;
}

export function floodFillChanges(
    cells: BrickCell[],
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
    targetIndex: number,
): CellEditChange[] {
    const lookup = buildPaletteIndexLookup(cells);
    const startKey = cellKey(startRow, startCol);
    const sourceIndex = lookup.get(startKey) ?? EMPTY_PALETTE_INDEX;

    if (
        sourceIndex === EMPTY_PALETTE_INDEX ||
        sourceIndex === targetIndex
    ) {
        return [];
    }

    const region = floodFillRegion(
        cells,
        schemeSize,
        layout,
        startRow,
        startCol,
    );

    const changes: CellEditChange[] = [];

    for (const { row, col } of region) {
        const from = lookup.get(cellKey(row, col)) ?? EMPTY_PALETTE_INDEX;
        if (from === targetIndex) continue;
        changes.push({ row, col, from, to: targetIndex });
    }

    return changes;
}

export function floodFillRestoreChanges(
    cells: BrickCell[],
    baseCells: BrickCell[],
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
): CellEditChange[] {
    const lookup = buildPaletteIndexLookup(cells);
    const startKey = cellKey(startRow, startCol);
    const sourceIndex = lookup.get(startKey) ?? EMPTY_PALETTE_INDEX;

    if (sourceIndex === EMPTY_PALETTE_INDEX) {
        return [];
    }

    const region = floodFillRegion(
        cells,
        schemeSize,
        layout,
        startRow,
        startCol,
    );

    const changes: CellEditChange[] = [];

    for (const { row, col } of region) {
        const from = lookup.get(cellKey(row, col)) ?? EMPTY_PALETTE_INDEX;
        const to = getBasePaletteIndex(baseCells, row, col);

        if (from === to) continue;
        changes.push({ row, col, from, to });
    }

    return changes;
}

export function floodFillMarkChanges(
    cells: BrickCell[],
    marks: Record<string, boolean>,
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
): MarkEditChange[] {
    const lookup = buildPaletteIndexLookup(cells);
    const startKey = cellKey(startRow, startCol);
    const sourceIndex = lookup.get(startKey) ?? EMPTY_PALETTE_INDEX;

    if (sourceIndex === EMPTY_PALETTE_INDEX) {
        return [];
    }

    const region = floodFillRegion(
        cells,
        schemeSize,
        layout,
        startRow,
        startCol,
    );

    const changes: MarkEditChange[] = [];

    for (const { row, col } of region) {
        const key = cellKey(row, col);
        const from = isMarkedKey(marks, key);

        if (!from) {
            changes.push({ row, col, from: false, to: true });
        }
    }

    return changes;
}

export function floodFillUnmarkChanges(
    cells: BrickCell[],
    marks: Record<string, boolean>,
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
): MarkEditChange[] {
    const lookup = buildPaletteIndexLookup(cells);
    const startKey = cellKey(startRow, startCol);
    const sourceIndex = lookup.get(startKey) ?? EMPTY_PALETTE_INDEX;

    if (sourceIndex === EMPTY_PALETTE_INDEX) {
        return [];
    }

    const region = floodFillRegion(
        cells,
        schemeSize,
        layout,
        startRow,
        startCol,
    );

    const changes: MarkEditChange[] = [];

    for (const { row, col } of region) {
        const key = cellKey(row, col);
        const from = isMarkedKey(marks, key);

        if (from) {
            changes.push({ row, col, from: true, to: false });
        }
    }

    return changes;
}
