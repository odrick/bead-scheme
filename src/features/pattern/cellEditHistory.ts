import type { BrickCell } from "../../beadMath";

export const MAX_CELL_EDIT_HISTORY = 20;

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
