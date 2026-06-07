import {
    isLaceStructuralHole,
    laceGridCellCenter,
    type BrickCell,
    type GridLayout,
} from "../../beadMath";
import { cellKey } from "./cellEditHistory";
import type { SchemeSizeBeads } from "./schemeGrid";

export type GridCoord = {
    row: number;
    col: number;
};

/** Максимальна відстань між центрами сусідніх бісеринок (× cellSize). */
const LACE_ADJACENCY_FACTOR = 1.02;

function isInScheme(
    row: number,
    col: number,
    layout: GridLayout,
    schemeSize: SchemeSizeBeads | undefined,
): boolean {
    if (layout === "lace" || !schemeSize) return true;

    return (
        row >= 0 &&
        row < schemeSize.height &&
        col >= 0 &&
        col < schemeSize.width
    );
}

function isBlockedCell(row: number, col: number, layout: GridLayout): boolean {
    return layout === "lace" && isLaceStructuralHole(row, col);
}

function computeLaceOriginFromCells(
    cells: BrickCell[],
    cellSize: number,
): { originX: number; originY: number } {
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

    if (!Number.isFinite(minRow)) {
        return { originX: 0, originY: 0 };
    }

    return {
        originX: ((minCol + maxCol) / 2 + 0.5) * cellSize,
        originY: ((minRow + maxRow) / 2 + 0.5) * cellSize,
    };
}

export function getConnectedNeighbors(
    row: number,
    col: number,
    layout: GridLayout,
    schemeSize: SchemeSizeBeads | undefined,
): GridCoord[] {
    let candidates: GridCoord[];

    if (layout === "brick") {
        candidates = [
            { row, col: col - 1 },
            { row, col: col + 1 },
        ];

        if (row % 2 === 0) {
            candidates.push(
                { row: row - 1, col: col - 1 },
                { row: row - 1, col },
                { row: row + 1, col: col - 1 },
                { row: row + 1, col },
            );
        } else {
            candidates.push(
                { row: row - 1, col },
                { row: row - 1, col: col + 1 },
                { row: row + 1, col },
                { row: row + 1, col: col + 1 },
            );
        }
    } else {
        candidates = [
            { row: row - 1, col },
            { row: row + 1, col },
            { row, col: col - 1 },
            { row, col: col + 1 },
        ];
    }

    return candidates.filter(
        (neighbor) =>
            isInScheme(neighbor.row, neighbor.col, layout, schemeSize) &&
            !isBlockedCell(neighbor.row, neighbor.col, layout),
    );
}

export function buildPaletteIndexLookup(
    cells: BrickCell[],
): Map<string, number> {
    const lookup = new Map<string, number>();

    for (const cell of cells) {
        lookup.set(cellKey(cell.row, cell.col), cell.paletteIndex);
    }

    return lookup;
}

function floodFillGridRegion(
    lookup: Map<string, number>,
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
    sourceIndex: number,
): GridCoord[] {
    const visited = new Set<string>();
    const queue: GridCoord[] = [{ row: startRow, col: startCol }];
    const result: GridCoord[] = [];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        const key = cellKey(current.row, current.col);
        if (visited.has(key)) continue;

        const paletteIndex = lookup.get(key) ?? -1;
        if (paletteIndex !== sourceIndex) continue;

        visited.add(key);
        result.push(current);

        for (const neighbor of getConnectedNeighbors(
            current.row,
            current.col,
            layout,
            schemeSize,
        )) {
            const neighborKey = cellKey(neighbor.row, neighbor.col);
            if (!visited.has(neighborKey)) {
                queue.push(neighbor);
            }
        }
    }

    return result;
}

function floodFillLaceRegion(
    cells: BrickCell[],
    lookup: Map<string, number>,
    cellSize: number,
    startRow: number,
    startCol: number,
    sourceIndex: number,
): GridCoord[] {
    const { originX, originY } = computeLaceOriginFromCells(cells, cellSize);
    const threshold = cellSize * LACE_ADJACENCY_FACTOR;
    const thresholdSq = threshold * threshold;

    const sameColorCoords: GridCoord[] = [];

    for (const cell of cells) {
        if (isLaceStructuralHole(cell.row, cell.col)) continue;

        const key = cellKey(cell.row, cell.col);
        if ((lookup.get(key) ?? -1) !== sourceIndex) continue;

        sameColorCoords.push({ row: cell.row, col: cell.col });
    }

    const positions = new Map<string, { x: number; y: number }>();

    for (const { row, col } of sameColorCoords) {
        positions.set(
            cellKey(row, col),
            laceGridCellCenter(row, col, cellSize, originX, originY),
        );
    }

    const visited = new Set<string>();
    const queue: GridCoord[] = [{ row: startRow, col: startCol }];
    const result: GridCoord[] = [];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        const key = cellKey(current.row, current.col);
        if (visited.has(key)) continue;
        if ((lookup.get(key) ?? -1) !== sourceIndex) continue;

        const pos = positions.get(key);
        if (!pos) continue;

        visited.add(key);
        result.push(current);

        for (const other of sameColorCoords) {
            const otherKey = cellKey(other.row, other.col);
            if (visited.has(otherKey)) continue;

            const otherPos = positions.get(otherKey);
            if (!otherPos) continue;

            const dx = pos.x - otherPos.x;
            const dy = pos.y - otherPos.y;

            if (dx * dx + dy * dy <= thresholdSq) {
                queue.push(other);
            }
        }
    }

    return result;
}

export function floodFillRegion(
    cells: BrickCell[],
    schemeSize: SchemeSizeBeads | undefined,
    layout: GridLayout,
    startRow: number,
    startCol: number,
    targetIndex: number,
    cellSize = 1,
): GridCoord[] {
    const lookup = buildPaletteIndexLookup(cells);
    const sourceIndex = lookup.get(cellKey(startRow, startCol)) ?? -1;

    if (sourceIndex < 0 || sourceIndex === targetIndex) {
        return [];
    }

    if (layout === "lace") {
        return floodFillLaceRegion(
            cells,
            lookup,
            cellSize,
            startRow,
            startCol,
            sourceIndex,
        );
    }

    return floodFillGridRegion(
        lookup,
        schemeSize,
        layout,
        startRow,
        startCol,
        sourceIndex,
    );
}
