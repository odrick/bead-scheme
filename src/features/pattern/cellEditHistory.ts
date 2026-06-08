import type { BrickCell } from "../../beadMath";

export const MAX_CELL_EDIT_HISTORY = 20;
export const EMPTY_PALETTE_INDEX = -1;
export const MARKED_PALETTE_INDEX = -2;

export type PatternPaintSelection =
    | { kind: "palette"; index: number }
    | { kind: "restore" }
    | { kind: "mark" };

export function isMarkedPaletteIndex(paletteIndex: number): boolean {
    return paletteIndex === MARKED_PALETTE_INDEX;
}

export function isSchemeBeadIndex(paletteIndex: number): boolean {
    return paletteIndex >= 0;
}

export type MarkEditChange = {
    row: number;
    col: number;
    from: boolean;
    to: boolean;
};

export function isMarkedKey(
    marks: Record<string, boolean>,
    key: string,
): boolean {
    return marks[key] === true;
}

export function setMarkValue(
    marks: Record<string, boolean>,
    key: string,
    marked: boolean,
): Record<string, boolean> {
    if (!marked) {
        const { [key]: _removed, ...rest } = marks;
        return rest;
    }

    return { ...marks, [key]: true };
}

export function applyMarkChanges(
    marks: Record<string, boolean>,
    changes: MarkEditChange[],
    useFrom: boolean,
): Record<string, boolean> {
    let next = { ...marks };

    for (const change of changes) {
        const key = cellKey(change.row, change.col);
        next = setMarkValue(next, key, useFrom ? change.from : change.to);
    }

    return next;
}

export function splitLegacyCellEdits(cellEdits: Record<string, number>): {
    colorEdits: Record<string, number>;
    marks: Record<string, boolean>;
} {
    const colorEdits: Record<string, number> = {};
    const marks: Record<string, boolean> = {};

    for (const [key, paletteIndex] of Object.entries(cellEdits)) {
        if (paletteIndex === MARKED_PALETTE_INDEX) {
            marks[key] = true;
        } else {
            colorEdits[key] = paletteIndex;
        }
    }

    return { colorEdits, marks };
}

export function applyMarksToCells(
    cells: BrickCell[],
    marks: Record<string, boolean>,
): BrickCell[] {
    if (Object.keys(marks).length === 0) return cells;

    return cells.map((cell) => {
        const key = cellKey(cell.row, cell.col);

        if (isMarkedKey(marks, key) && cell.paletteIndex >= 0) {
            return { ...cell, paletteIndex: MARKED_PALETTE_INDEX };
        }

        return cell;
    });
}

export type CellEditChange = {
    row: number;
    col: number;
    from: number;
    to: number;
};

export function cellKey(row: number, col: number): string {
    return `${row},${col}`;
}

export function getBasePaletteIndex(
    baseCells: BrickCell[],
    row: number,
    col: number,
): number {
    const cell = baseCells.find((c) => c.row === row && c.col === col);
    return cell?.paletteIndex ?? -1;
}

export function getEffectivePaletteIndex(
    baseCells: BrickCell[],
    overrides: Record<string, number>,
    row: number,
    col: number,
): number {
    const key = cellKey(row, col);
    if (overrides[key] !== undefined) return overrides[key];
    return getBasePaletteIndex(baseCells, row, col);
}

export function setOverrideValue(
    cells: Record<string, number>,
    key: string,
    paletteIndex: number,
    baseIndex: number,
): Record<string, number> {
    if (paletteIndex === baseIndex) {
        const { [key]: _removed, ...rest } = cells;
        return rest;
    }

    return { ...cells, [key]: paletteIndex };
}

export function exportCellEditsFromState(
    baseCells: BrickCell[],
    cells: BrickCell[],
): Record<string, number> {
    const baseIndexByKey = new Map<string, number>();

    for (const cell of baseCells) {
        baseIndexByKey.set(cellKey(cell.row, cell.col), cell.paletteIndex);
    }

    const edits: Record<string, number> = {};

    for (const cell of cells) {
        const key = cellKey(cell.row, cell.col);
        const baseIndex = baseIndexByKey.get(key) ?? EMPTY_PALETTE_INDEX;

        if (cell.paletteIndex !== baseIndex) {
            edits[key] = cell.paletteIndex;
        }
    }

    return edits;
}

export function applyCellEditChanges(
    baseCells: BrickCell[],
    cells: Record<string, number>,
    changes: CellEditChange[],
    useFrom: boolean,
): Record<string, number> {
    let next = { ...cells };

    for (const change of changes) {
        const key = cellKey(change.row, change.col);
        const baseIndex = getBasePaletteIndex(
            baseCells,
            change.row,
            change.col,
        );
        const paletteIndex = useFrom ? change.from : change.to;
        next = setOverrideValue(next, key, paletteIndex, baseIndex);
    }

    return next;
}
