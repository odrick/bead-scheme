import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
    buildBrickGrid,
    countBeadsByPaletteIndex,
    extractPalette,
    parseHexColor,
    type BackgroundMode,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";
import {
    loadImageToImageData,
    type CanvasBackground,
} from "../preview/canvasUtils";
import { clampPreviewZoom } from "../preview/previewZoom";
import {
    applyCellEditChanges,
    cellKey,
    EMPTY_PALETTE_INDEX,
    getBasePaletteIndex,
    getEffectivePaletteIndex,
    isSchemeBeadIndex,
    MARKED_PALETTE_INDEX,
    MAX_CELL_EDIT_HISTORY,
    setOverrideValue,
    type CellEditChange,
} from "./cellEditHistory";
import {
    clampSchemeSize,
    filterOverridesToScheme,
    mapImageCellsToScheme,
    measureImageGridBounds,
    mergeSchemeCells,
    type SchemeSizeBeads,
} from "./schemeGrid";
import type { ProjectExportData } from "../project/projectFile";

const DEFAULT_BG = "#ffffff";
const BG_MATCH_SQ = 55 * 55;
const PALETTE_SAMPLE_STEP = 2;

type PaletteOverrides = {
    baseKey: string;
    colors: Record<number, RGB>;
};

type CellOverrides = {
    baseKey: string;
    cells: Record<string, number>;
};

type EditHistoryState = {
    baseKey: string;
    undo: CellEditChange[][];
    redo: CellEditChange[][];
};

type SetCellPaletteIndexOptions = {
    stroke?: boolean;
};

type PatternModel = {
    paletteSize: number;
    setPaletteSize: (value: number) => void;
    beadsPerRow: number;
    setBeadsPerRow: (value: number) => void;
    gridLayout: GridLayout;
    setGridLayout: (value: GridLayout) => void;
    backgroundMode: BackgroundMode;
    setBackgroundMode: (value: BackgroundMode) => void;
    backgroundHex: string;
    setBackgroundHex: (value: string) => void;
    previewZoom: number;
    setPreviewZoom: Dispatch<SetStateAction<number>>;
    labelPaletteIndices: boolean;
    setLabelPaletteIndices: (value: boolean) => void;
    canvasBackground: CanvasBackground;
    setCanvasBackground: (value: CanvasBackground) => void;
    backgroundRgb: RGB;
    cellSizePx: number;
    palette: RGB[];
    cells: BrickCell[];
    patternPalette: RGB[];
    setPaletteColor: (index: number, hex: string) => void;
    resetPaletteColor: (index: number) => void;
    resetPattern: () => void;
    setCellPaletteIndex: (
        row: number,
        col: number,
        paletteIndex: number,
        options?: SetCellPaletteIndexOptions,
    ) => void;
    endCellEditStroke: () => void;
    applyCellEditBatch: (changes: CellEditChange[]) => void;
    undoCellEdit: () => void;
    redoCellEdit: () => void;
    canUndoCellEdit: boolean;
    canRedoCellEdit: boolean;
    hasPattern: boolean;
    beadCount: number;
    beadCountsByPalette: number[];
    schemeSizeBeads: SchemeSizeBeads;
    imageGridSizeBeads: SchemeSizeBeads;
    setSchemeSizeBeads: (width: number, height: number) => void;
    restoreCellAt: (
        row: number,
        col: number,
        options?: SetCellPaletteIndexOptions,
    ) => void;
    baseCells: BrickCell[];
    exportProjectData: () => ProjectExportData | null;
    loadProject: (project: ProjectExportData) => void;
};

export function usePatternModel(bitmap: HTMLImageElement | null): PatternModel {
    const [paletteSize, setPaletteSize] = useState(10);
    const [beadsPerRow, setBeadsPerRow] = useState(60);
    const [gridLayout, setGridLayout] = useState<GridLayout>("brick");
    const [backgroundMode, setBackgroundMode] =
        useState<BackgroundMode>("color");
    const [backgroundHex, setBackgroundHex] = useState(DEFAULT_BG);
    const [previewZoom, setPreviewZoomState] = useState(1.2);
    const [labelPaletteIndices, setLabelPaletteIndices] = useState(false);
    const setPreviewZoom = useCallback((value: SetStateAction<number>) => {
        setPreviewZoomState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            return clampPreviewZoom(next);
        });
    }, []);
    const [canvasBackground, setCanvasBackground] =
        useState<CanvasBackground>("checkerboard");
    const [paletteOverrides, setPaletteOverrides] = useState<PaletteOverrides>({
        baseKey: "",
        colors: {},
    });
    const [cellOverrides, setCellOverrides] = useState<CellOverrides>({
        baseKey: "",
        cells: {},
    });
    const [editHistory, setEditHistory] = useState<EditHistoryState>({
        baseKey: "",
        undo: [],
        redo: [],
    });
    const [schemeSizeBeads, setSchemeSizeBeadsState] = useState<SchemeSizeBeads>({
        width: 0,
        height: 0,
    });
    const autoSchemeSizeKeyRef = useRef("");
    const pendingProjectRestoreRef = useRef<{
        paletteColors: Record<string, RGB>;
        cellEdits: Record<string, number>;
        editHistory: { undo: CellEditChange[][]; redo: CellEditChange[][] };
    } | null>(null);

    const baseCellsRef = useRef<BrickCell[]>([]);
    const cellOverridesRef = useRef(cellOverrides);
    const pendingStrokeRef = useRef<Map<string, CellEditChange>>(new Map());

    cellOverridesRef.current = cellOverrides;

    const backgroundRgb = useMemo(
        () => parseHexColor(backgroundHex),
        [backgroundHex],
    );

    const cellSizePx = useMemo(() => {
        if (!bitmap || bitmap.width <= 0) return 1;

        return bitmap.width / Math.max(2, beadsPerRow);
    }, [bitmap, beadsPerRow]);

    const { palette, imageCells, imageGridBounds } = useMemo(() => {
        if (!bitmap || bitmap.width === 0) {
            return {
                palette: [] as RGB[],
                imageCells: [] as BrickCell[],
                imageGridBounds: measureImageGridBounds([]),
            };
        }

        const imageData = loadImageToImageData(bitmap);
        const backgroundFilter = {
            mode: backgroundMode,
            background: backgroundRgb,
            bgThresholdSq: BG_MATCH_SQ,
        };
        const palette = extractPalette(imageData, paletteSize, {
            ...backgroundFilter,
            sampleStep: PALETTE_SAMPLE_STEP,
        });
        const imageCells = buildBrickGrid(imageData, cellSizePx, palette, {
            ...backgroundFilter,
            layout: gridLayout,
        });
        const imageGridBounds = measureImageGridBounds(imageCells);

        return { palette, imageCells, imageGridBounds };
    }, [
        bitmap,
        paletteSize,
        cellSizePx,
        backgroundRgb,
        backgroundMode,
        gridLayout,
    ]);

    // Для ажурної сітки row/col-діапазон ≈ √2 більший за візуальний розмір,
    // тому показуємо візуальний розмір у бісеринках (як і в інших типах).
    const imageGridSizeBeads = useMemo(() => {
        if (gridLayout === "lace" && bitmap && bitmap.width > 0) {
            return {
                width: beadsPerRow,
                height: Math.max(1, Math.round(bitmap.height / Math.max(1, cellSizePx))),
            };
        }

        return { width: imageGridBounds.width, height: imageGridBounds.height };
    }, [gridLayout, bitmap, beadsPerRow, cellSizePx, imageGridBounds]);

    const autoSchemeSizeKey = useMemo(
        () =>
            [
                bitmap?.width ?? 0,
                bitmap?.height ?? 0,
                paletteSize,
                beadsPerRow,
                backgroundMode,
                backgroundHex,
                gridLayout,
            ].join(":"),
        [
            bitmap,
            paletteSize,
            beadsPerRow,
            backgroundMode,
            backgroundHex,
            gridLayout,
        ],
    );

    useEffect(() => {
        if (autoSchemeSizeKeyRef.current === autoSchemeSizeKey) return;

        autoSchemeSizeKeyRef.current = autoSchemeSizeKey;
        setSchemeSizeBeadsState({
            width: imageGridSizeBeads.width,
            height: imageGridSizeBeads.height,
        });
    }, [autoSchemeSizeKey, imageGridSizeBeads.width, imageGridSizeBeads.height]);

    // Для ажурної сітки клітинки зберігаємо в нативних координатах (можуть бути від'ємними).
    // Центрування та схема-розмір обробляються в computeBrickLayout/hitTestBrickCell.
    const baseCells = useMemo(() => {
        if (gridLayout === "lace") return imageCells;

        return mapImageCellsToScheme(imageCells, imageGridBounds, schemeSizeBeads);
    }, [gridLayout, imageCells, imageGridBounds, schemeSizeBeads]);

    baseCellsRef.current = baseCells;

    const cellsBaseKey = useMemo(
        () =>
            [
                bitmap?.width ?? 0,
                bitmap?.height ?? 0,
                paletteSize,
                beadsPerRow,
                backgroundMode,
                backgroundHex,
                gridLayout,
                palette.map((color) => `${color.r},${color.g},${color.b}`).join("|"),
                // Для ажурної розмір схеми не змінює позиції клітинок — не включаємо до ключа.
                gridLayout !== "lace" ? schemeSizeBeads.width : 0,
                gridLayout !== "lace" ? schemeSizeBeads.height : 0,
            ].join(":"),
        [
            bitmap,
            paletteSize,
            beadsPerRow,
            backgroundMode,
            backgroundHex,
            gridLayout,
            palette,
            schemeSizeBeads.width,
            schemeSizeBeads.height,
        ],
    );

    useEffect(() => {
        if (pendingProjectRestoreRef.current) return;

        pendingStrokeRef.current.clear();
        setEditHistory((current) =>
            current.baseKey === cellsBaseKey
                ? current
                : { baseKey: cellsBaseKey, undo: [], redo: [] },
        );
    }, [cellsBaseKey]);

    const cells = useMemo(() => {
        const overrides =
            cellOverrides.baseKey === cellsBaseKey ? cellOverrides.cells : {};

        if (gridLayout === "lace") {
            // Нативні lace-координати — обмеження по schemeSize не застосовуємо.
            const byKey = new Map(baseCells.map((c) => [cellKey(c.row, c.col), c]));

            for (const [key, paletteIndex] of Object.entries(overrides)) {
                const existing = byKey.get(key);

                if (existing) {
                    byKey.set(key, { ...existing, paletteIndex });
                    continue;
                }

                const [rowStr, colStr] = key.split(",");
                const row = Number.parseInt(rowStr, 10);
                const col = Number.parseInt(colStr, 10);

                if (!Number.isNaN(row) && !Number.isNaN(col)) {
                    byKey.set(key, {
                        row,
                        col,
                        avg: { r: 255, g: 255, b: 255 },
                        paletteIndex,
                    });
                }
            }

            return [...byKey.values()];
        }

        return mergeSchemeCells(baseCells, overrides, schemeSizeBeads, gridLayout);
    }, [baseCells, cellOverrides, cellsBaseKey, schemeSizeBeads, gridLayout]);

    const paletteBaseKey = useMemo(
        () => palette.map((color) => `${color.r},${color.g},${color.b}`).join("|"),
        [palette],
    );

    const patternPalette = useMemo(() => {
        if (paletteOverrides.baseKey !== paletteBaseKey) return palette;

        return palette.map((color, index) => paletteOverrides.colors[index] ?? color);
    }, [palette, paletteBaseKey, paletteOverrides]);

    useEffect(() => {
        const pending = pendingProjectRestoreRef.current;
        if (!pending || !bitmap) return;

        pendingProjectRestoreRef.current = null;
        pendingStrokeRef.current.clear();

        setPaletteOverrides({
            baseKey: paletteBaseKey,
            colors: pending.paletteColors,
        });

        const nextCellOverrides = {
            baseKey: cellsBaseKey,
            cells: pending.cellEdits,
        };
        setCellOverrides(nextCellOverrides);
        cellOverridesRef.current = nextCellOverrides;

        setEditHistory({
            baseKey: cellsBaseKey,
            undo: pending.editHistory.undo,
            redo: pending.editHistory.redo,
        });
    }, [bitmap, paletteBaseKey, cellsBaseKey]);

    const setPaletteColor = useCallback(
        (index: number, hex: string) => {
            const color = parseHexColor(hex);

            setPaletteOverrides((current) => {
                const colors =
                    current.baseKey === paletteBaseKey ? current.colors : {};

                return {
                    baseKey: paletteBaseKey,
                    colors: {
                        ...colors,
                        [index]: color,
                    },
                };
            });
        },
        [paletteBaseKey],
    );

    const resetPaletteColor = useCallback(
        (index: number) => {
            setPaletteOverrides((current) => {
                if (current.baseKey !== paletteBaseKey) {
                    return { baseKey: paletteBaseKey, colors: {} };
                }

                const { [index]: _removedColor, ...colors } = current.colors;

                return {
                    baseKey: paletteBaseKey,
                    colors,
                };
            });
        },
        [paletteBaseKey],
    );

    const resetPattern = useCallback(() => {
        pendingStrokeRef.current.clear();

        setPaletteOverrides({ baseKey: paletteBaseKey, colors: {} });

        const emptyCellOverrides = { baseKey: cellsBaseKey, cells: {} };
        setCellOverrides(emptyCellOverrides);
        cellOverridesRef.current = emptyCellOverrides;

        setEditHistory({ baseKey: cellsBaseKey, undo: [], redo: [] });

        setSchemeSizeBeadsState({
            width: imageGridSizeBeads.width,
            height: imageGridSizeBeads.height,
        });
    }, [paletteBaseKey, cellsBaseKey, imageGridSizeBeads.width, imageGridSizeBeads.height]);

    const setSchemeSizeBeads = useCallback(
        (width: number, height: number) => {
            const next = clampSchemeSize({
                width: Math.max(width, imageGridSizeBeads.width),
                height: Math.max(height, imageGridSizeBeads.height),
            });

            setSchemeSizeBeadsState(next);

            // Для ажурної — не фільтруємо override-и (координати нативні, не прив'язані до схеми).
            if (gridLayout !== "lace") {
                setCellOverrides((current) => {
                    const cells =
                        current.baseKey === cellsBaseKey ? current.cells : {};
                    const filtered = filterOverridesToScheme(cells, next);
                    const nextOverrides = { baseKey: cellsBaseKey, cells: filtered };
                    cellOverridesRef.current = nextOverrides;
                    return nextOverrides;
                });

                pendingStrokeRef.current.clear();
                setEditHistory({ baseKey: cellsBaseKey, undo: [], redo: [] });
            }
        },
        [cellsBaseKey, gridLayout, imageGridSizeBeads.width, imageGridSizeBeads.height],
    );

    const setCellPaletteIndex = useCallback(
        (
            row: number,
            col: number,
            paletteIndex: number,
            options?: SetCellPaletteIndexOptions,
        ) => {
            const key = cellKey(row, col);
            const currentOverrides =
                cellOverridesRef.current.baseKey === cellsBaseKey
                    ? cellOverridesRef.current.cells
                    : {};
            const currentEffective = getEffectivePaletteIndex(
                baseCellsRef.current,
                currentOverrides,
                row,
                col,
            );

            if (currentEffective === paletteIndex) return;

            if (
                paletteIndex === MARKED_PALETTE_INDEX &&
                currentEffective === EMPTY_PALETTE_INDEX
            ) {
                return;
            }

            if (options?.stroke) {
                const pending = pendingStrokeRef.current;
                const existing = pending.get(key);

                if (existing) {
                    existing.to = paletteIndex;
                } else {
                    pending.set(key, {
                        row,
                        col,
                        from: currentEffective,
                        to: paletteIndex,
                    });
                }
            }

            const baseIndex = getBasePaletteIndex(
                baseCellsRef.current,
                row,
                col,
            );

            setCellOverrides((current) => {
                const cells =
                    current.baseKey === cellsBaseKey ? current.cells : {};
                const nextCells = setOverrideValue(
                    cells,
                    key,
                    paletteIndex,
                    baseIndex,
                );
                const next = { baseKey: cellsBaseKey, cells: nextCells };
                cellOverridesRef.current = next;
                return next;
            });
        },
        [cellsBaseKey],
    );

    const restoreCellAt = useCallback(
        (
            row: number,
            col: number,
            options?: SetCellPaletteIndexOptions,
        ) => {
            const baseIndex = getBasePaletteIndex(
                baseCellsRef.current,
                row,
                col,
            );
            setCellPaletteIndex(row, col, baseIndex, options);
        },
        [setCellPaletteIndex],
    );

    const endCellEditStroke = useCallback(() => {
        const changes = [...pendingStrokeRef.current.values()];
        pendingStrokeRef.current.clear();

        if (changes.length === 0) return;

        setEditHistory((current) => {
            const undo =
                current.baseKey === cellsBaseKey
                    ? [...current.undo, changes]
                    : [changes];

            while (undo.length > MAX_CELL_EDIT_HISTORY) {
                undo.shift();
            }

            return {
                baseKey: cellsBaseKey,
                undo,
                redo: [],
            };
        });
    }, [cellsBaseKey]);

    const applyCellEditBatch = useCallback(
        (changes: CellEditChange[]) => {
            if (changes.length === 0) return;

            setCellOverrides((current) => {
                let cells =
                    current.baseKey === cellsBaseKey ? { ...current.cells } : {};

                for (const { row, col, to } of changes) {
                    const key = cellKey(row, col);
                    const baseIndex = getBasePaletteIndex(
                        baseCellsRef.current,
                        row,
                        col,
                    );
                    cells = setOverrideValue(cells, key, to, baseIndex);
                }

                const next = { baseKey: cellsBaseKey, cells };
                cellOverridesRef.current = next;
                return next;
            });

            setEditHistory((current) => {
                const undo =
                    current.baseKey === cellsBaseKey
                        ? [...current.undo, changes]
                        : [changes];

                while (undo.length > MAX_CELL_EDIT_HISTORY) {
                    undo.shift();
                }

                return {
                    baseKey: cellsBaseKey,
                    undo,
                    redo: [],
                };
            });
        },
        [cellsBaseKey],
    );

    const undoCellEdit = useCallback(() => {
        setEditHistory((current) => {
            if (current.baseKey !== cellsBaseKey || current.undo.length === 0) {
                return current;
            }

            const changes = current.undo[current.undo.length - 1];

            setCellOverrides((overrides) => {
                const cells =
                    overrides.baseKey === cellsBaseKey
                        ? overrides.cells
                        : {};
                const nextCells = applyCellEditChanges(
                    baseCellsRef.current,
                    cells,
                    changes,
                    true,
                );
                const next = { baseKey: cellsBaseKey, cells: nextCells };
                cellOverridesRef.current = next;
                return next;
            });

            return {
                baseKey: cellsBaseKey,
                undo: current.undo.slice(0, -1),
                redo: [...current.redo, changes],
            };
        });
    }, [cellsBaseKey]);

    const redoCellEdit = useCallback(() => {
        setEditHistory((current) => {
            if (current.baseKey !== cellsBaseKey || current.redo.length === 0) {
                return current;
            }

            const changes = current.redo[current.redo.length - 1];

            setCellOverrides((overrides) => {
                const cells =
                    overrides.baseKey === cellsBaseKey
                        ? overrides.cells
                        : {};
                const nextCells = applyCellEditChanges(
                    baseCellsRef.current,
                    cells,
                    changes,
                    false,
                );
                const next = { baseKey: cellsBaseKey, cells: nextCells };
                cellOverridesRef.current = next;
                return next;
            });

            return {
                baseKey: cellsBaseKey,
                undo: [...current.undo, changes],
                redo: current.redo.slice(0, -1),
            };
        });
    }, [cellsBaseKey]);

    const canUndoCellEdit =
        editHistory.baseKey === cellsBaseKey && editHistory.undo.length > 0;
    const canRedoCellEdit =
        editHistory.baseKey === cellsBaseKey && editHistory.redo.length > 0;

    const hasPattern = useMemo(
        () => cells.some((cell) => isSchemeBeadIndex(cell.paletteIndex)),
        [cells],
    );

    const beadCount = useMemo(
        () =>
            cells.filter((cell) => isSchemeBeadIndex(cell.paletteIndex)).length,
        [cells],
    );

    const beadCountsByPalette = useMemo(
        () => countBeadsByPaletteIndex(cells, palette.length),
        [cells, palette.length],
    );

    const exportProjectData = useCallback((): ProjectExportData | null => {
        if (!bitmap) return null;

        return {
            version: 1,
            settings: {
                paletteSize,
                beadsPerRow,
                gridLayout,
                backgroundMode,
                backgroundHex,
                previewZoom,
                labelPaletteIndices,
                canvasBackground,
                schemeSize: schemeSizeBeads,
            },
            paletteColors:
                paletteOverrides.baseKey === paletteBaseKey
                    ? paletteOverrides.colors
                    : {},
            cellEdits:
                cellOverrides.baseKey === cellsBaseKey
                    ? cellOverrides.cells
                    : {},
            editHistory:
                editHistory.baseKey === cellsBaseKey
                    ? { undo: editHistory.undo, redo: editHistory.redo }
                    : { undo: [], redo: [] },
        };
    }, [
        bitmap,
        paletteSize,
        beadsPerRow,
        gridLayout,
        backgroundMode,
        backgroundHex,
        previewZoom,
        labelPaletteIndices,
        canvasBackground,
        schemeSizeBeads,
        paletteOverrides,
        paletteBaseKey,
        cellOverrides,
        cellsBaseKey,
        editHistory,
    ]);

    const loadProject = useCallback(
        (project: ProjectExportData) => {
            const { settings, paletteColors, cellEdits, editHistory: history } =
                project;

            pendingProjectRestoreRef.current = {
                paletteColors,
                cellEdits,
                editHistory: history,
            };
            pendingStrokeRef.current.clear();

            setPaletteSize(settings.paletteSize);
            setBeadsPerRow(settings.beadsPerRow);
            setGridLayout(settings.gridLayout);
            setBackgroundMode(settings.backgroundMode);
            setBackgroundHex(settings.backgroundHex);
            setPreviewZoom(settings.previewZoom);
            setLabelPaletteIndices(settings.labelPaletteIndices ?? false);
            setCanvasBackground(settings.canvasBackground);
            setSchemeSizeBeadsState(settings.schemeSize);

            autoSchemeSizeKeyRef.current = [
                bitmap?.width ?? 0,
                bitmap?.height ?? 0,
                settings.paletteSize,
                settings.beadsPerRow,
                settings.backgroundMode,
                settings.backgroundHex,
                settings.gridLayout,
            ].join(":");
        },
        [bitmap, setPreviewZoom],
    );

    return {
        paletteSize,
        setPaletteSize,
        beadsPerRow,
        setBeadsPerRow,
        gridLayout,
        setGridLayout,
        backgroundMode,
        setBackgroundMode,
        backgroundHex,
        setBackgroundHex,
        previewZoom,
        setPreviewZoom,
        labelPaletteIndices,
        setLabelPaletteIndices,
        canvasBackground,
        setCanvasBackground,
        backgroundRgb,
        cellSizePx,
        palette,
        cells,
        patternPalette,
        setPaletteColor,
        resetPaletteColor,
        resetPattern,
        setCellPaletteIndex,
        endCellEditStroke,
        applyCellEditBatch,
        undoCellEdit,
        redoCellEdit,
        canUndoCellEdit,
        canRedoCellEdit,
        hasPattern,
        beadCount,
        beadCountsByPalette,
        schemeSizeBeads,
        imageGridSizeBeads,
        setSchemeSizeBeads,
        restoreCellAt,
        baseCells,
        exportProjectData,
        loadProject,
    };
}
