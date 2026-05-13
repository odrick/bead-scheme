import type { BrickCell } from "../../beadMath";
import { describeRun, describeSkipRun } from "./speechText";

export type SpeechHighlight = {
    row: number;
    fromCol: number;
    toCol: number;
};

export type SpeechStepKind =
    | "run"
    | "skip"
    | "row-finished"
    | "pattern-finished";

export type SpeechStep = {
    kind: SpeechStepKind;
    text: string;
    highlight: SpeechHighlight | null;
    count?: number;
    paletteIndex?: number;
};

export function buildSpeechSequence(cells: BrickCell[]): SpeechStep[] {
    if (cells.length === 0) return [];

    const rows = new Map<number, BrickCell[]>();
    for (const cell of cells) {
        const row = rows.get(cell.row);
        if (row) {
            row.push(cell);
        } else {
            rows.set(cell.row, [cell]);
        }
    }

    const orderedRows = [...rows.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, rowCells]) => rowCells.sort((a, b) => a.col - b.col));

    const sequence: SpeechStep[] = [];

    orderedRows.forEach((rowCells) => {
        const runs: {
            paletteIndex: number;
            count: number;
            fromCol: number;
            toCol: number;
        }[] = [];
        const row = rowCells[0]?.row ?? 0;

        for (const cell of rowCells) {
            const last = runs[runs.length - 1];
            if (last && last.paletteIndex === cell.paletteIndex) {
                last.count += 1;
                last.toCol = cell.col;
            } else {
                runs.push({
                    paletteIndex: cell.paletteIndex,
                    count: 1,
                    fromCol: cell.col,
                    toCol: cell.col,
                });
            }
        }

        for (const run of runs) {
            if (run.paletteIndex >= 0) {
                sequence.push({
                    kind: "run",
                    text: describeRun(run.count, run.paletteIndex),
                    highlight: {
                        row,
                        fromCol: run.fromCol,
                        toCol: run.toCol,
                    },
                    count: run.count,
                    paletteIndex: run.paletteIndex,
                });
            } else {
                sequence.push({
                    kind: "skip",
                    text: describeSkipRun(run.count),
                    highlight: null,
                    count: run.count,
                });
            }
        }

        sequence.push({
            kind: "row-finished",
            text: "Row finished.",
            highlight: null,
        });
    });

    if (sequence.length > 0) {
        sequence.push({
            kind: "pattern-finished",
            text: "Pattern finished.",
            highlight: null,
        });
    }

    return sequence;
}
