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
    clampWeavingCurtains,
    DEFAULT_WEAVING_CURTAINS,
    type WeavingCurtains,
} from "../preview/weavingCurtains";
import {
    applyCellEditChanges,
    applyMarkChanges,
    cellKey,
    EMPTY_PALETTE_INDEX,
    exportCellEditsFromState,
    getBasePaletteIndex,
    getEffectivePaletteIndex,
    isMarkedKey,
    isSchemeBeadIndex,
    MAX_CELL_EDIT_HISTORY,
    setMarkValue,
    setOverrideValue,
    splitLegacyCellEdits,
    type CellEditChange,
    type MarkEditChange,
} from "./cellEditHistory";
import {
    clampSchemeSize,
    filterOverridesToScheme,
    mapImageCellsToScheme,
    measureImageGridBounds,
    mergeSchemeCells,
    type SchemeSizeBeads,
} from "./schemeGrid";
import { applyImageMask } from "../mask/imageMask";
import { loadImageElement, loadImageElementFromFile } from "../mask/loadMaskImage";
import {
    applySourceTransform,
    defaultSourceTransform,
    sourceTransformKey,
    type SourceTransform,
} from "../image/sourceTransform";
import {
    centerMaskOnImage,
    defaultMaskSettings,
    type BuiltInMaskKind,
    type ImageMaskSettings,
    type MaskKind,
    serializeMaskSettings,
} from "../mask/maskTypes";
import {
    maskImageKey,
    resolveMaskImage,
    type AvailableMaskImages,
} from "../mask/resolveMaskImage";
import type { ProjectExportData } from "../project/projectFile";
import { encodeImageToBase64, projectImageToDataUrl } from "../project/projectFile";

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

type MarkOverrides = {
    baseKey: string;
    marks: Record<string, boolean>;
};

type EditHistoryState = {
    baseKey: string;
    undo: CellEditChange[][];
    redo: CellEditChange[][];
};

type MarkEditHistoryState = {
    baseKey: string;
    undo: MarkEditChange[][];
    redo: MarkEditChange[][];
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
    cellMarks: Record<string, boolean>;
    setCellMarked: (
        row: number,
        col: number,
        marked: boolean,
        options?: SetCellPaletteIndexOptions,
    ) => void;
    clearCellMark: (
        row: number,
        col: number,
        options?: SetCellPaletteIndexOptions,
    ) => void;
    endMarkEditStroke: () => void;
    applyMarkEditBatch: (changes: MarkEditChange[]) => void;
    undoMarkEdit: () => void;
    redoMarkEdit: () => void;
    canUndoMarkEdit: boolean;
    canRedoMarkEdit: boolean;
    baseCells: BrickCell[];
    exportProjectData: () => ProjectExportData | null;
    loadProject: (project: ProjectExportData) => void;
    maskSettings: ImageMaskSettings;
    availableMaskImages: AvailableMaskImages;
    customMaskBitmap: HTMLImageElement | null;
    setMaskKind: (kind: MaskKind) => void;
    commitMaskSettings: (settings: ImageMaskSettings) => void;
    setCustomMaskFile: (file: File | null) => Promise<void>;
    sourceTransform: SourceTransform;
    commitSourceTransform: (transform: SourceTransform) => void;
    resetSourceTransform: () => void;
    weavingCurtains: WeavingCurtains;
    setWeavingCurtains: Dispatch<SetStateAction<WeavingCurtains>>;
};

type UsePatternModelOptions = {
    maskImages: Record<BuiltInMaskKind, HTMLImageElement | null>;
};

export function usePatternModel(
    bitmap: HTMLImageElement | null,
    { maskImages }: UsePatternModelOptions,
): PatternModel {
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
    const [weavingCurtains, setWeavingCurtainsState] = useState<WeavingCurtains>(
        () => ({ ...DEFAULT_WEAVING_CURTAINS }),
    );
    const [paletteOverrides, setPaletteOverrides] = useState<PaletteOverrides>({
        baseKey: "",
        colors: {},
    });
    const [cellOverrides, setCellOverrides] = useState<CellOverrides>({
        baseKey: "",
        cells: {},
    });
    const [markOverrides, setMarkOverrides] = useState<MarkOverrides>({
        baseKey: "",
        marks: {},
    });
    const [editHistory, setEditHistory] = useState<EditHistoryState>({
        baseKey: "",
        undo: [],
        redo: [],
    });
    const [markEditHistory, setMarkEditHistory] = useState<MarkEditHistoryState>({
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
        cellMarks: Record<string, boolean>;
        editHistory: { undo: CellEditChange[][]; redo: CellEditChange[][] };
        markEditHistory: { undo: MarkEditChange[][]; redo: MarkEditChange[][] };
    } | null>(null);
    const [restoreKey, setRestoreKey] = useState(0);
    const [maskSettings, setMaskSettings] = useState<ImageMaskSettings>(
        defaultMaskSettings,
    );
    const [sourceTransform, setSourceTransform] = useState<SourceTransform>(
        defaultSourceTransform,
    );
    const [customMaskBitmap, setCustomMaskBitmap] =
        useState<HTMLImageElement | null>(null);
    const bitmapSizeKeyRef = useRef("");
    const skipMaskCenterRef = useRef(false);
    const skipSourceTransformResetRef = useRef(false);
    const customMaskLoadKeyRef = useRef("");

    const baseCellsRef = useRef<BrickCell[]>([]);
    const cellOverridesRef = useRef(cellOverrides);
    const markOverridesRef = useRef(markOverrides);
    const pendingStrokeRef = useRef<Map<string, CellEditChange>>(new Map());
    const pendingMarkStrokeRef = useRef<Map<string, MarkEditChange>>(new Map());

    cellOverridesRef.current = cellOverrides;
    markOverridesRef.current = markOverrides;

    const backgroundRgb = useMemo(
        () => parseHexColor(backgroundHex),
        [backgroundHex],
    );

    const cellSizePx = useMemo(() => {
        if (!bitmap || bitmap.width <= 0) return 1;

        return bitmap.width / Math.max(2, beadsPerRow);
    }, [bitmap, beadsPerRow]);

    const availableMaskImages = useMemo(
        (): AvailableMaskImages => ({
            ...maskImages,
            custom: customMaskBitmap,
        }),
        [maskImages, customMaskBitmap],
    );

    const transformedSource = useMemo(() => {
        if (!bitmap || bitmap.width === 0) return null;

        return applySourceTransform(bitmap, sourceTransform);
    }, [bitmap, sourceTransform]);

    const processedSource = useMemo(() => {
        if (!transformedSource) return null;

        if (maskSettings.kind === "none") return transformedSource;

        const maskImage = resolveMaskImage(maskSettings, availableMaskImages);
        if (!maskImage) return transformedSource;

        return applyImageMask(transformedSource, maskImage, maskSettings);
    }, [transformedSource, availableMaskImages, maskSettings]);

    useEffect(() => {
        const stored = maskSettings.customImage;
        const loadKey = stored
            ? `${stored.mimeType}:${stored.base64.length}:${stored.base64.slice(0, 24)}`
            : "";

        if (customMaskLoadKeyRef.current === loadKey) return;

        customMaskLoadKeyRef.current = loadKey;

        if (!stored) {
            setCustomMaskBitmap(null);
            return;
        }

        let cancelled = false;

        void loadImageElement(projectImageToDataUrl(stored))
            .then((image) => {
                if (!cancelled) {
                    setCustomMaskBitmap(image);
                }
            })
            .catch((error) => {
                console.warn(error);
                if (!cancelled) {
                    setCustomMaskBitmap(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [maskSettings.customImage]);

    useEffect(() => {
        if (!bitmap) {
            bitmapSizeKeyRef.current = "";
            customMaskLoadKeyRef.current = "";
            setCustomMaskBitmap(null);
            setMaskSettings(defaultMaskSettings());
            setSourceTransform(defaultSourceTransform());
            return;
        }

        const sizeKey = `${bitmap.width}x${bitmap.height}`;

        if (bitmapSizeKeyRef.current === sizeKey) return;

        bitmapSizeKeyRef.current = sizeKey;

        if (skipMaskCenterRef.current) {
            skipMaskCenterRef.current = false;
        } else {
            setMaskSettings((current) =>
                centerMaskOnImage(bitmap.width, bitmap.height, current),
            );
        }

        if (skipSourceTransformResetRef.current) {
            skipSourceTransformResetRef.current = false;
        } else {
            setSourceTransform(defaultSourceTransform());
        }
    }, [bitmap]);

    const { palette, imageCells, imageGridBounds } = useMemo(() => {
        if (!processedSource || processedSource.width === 0) {
            return {
                palette: [] as RGB[],
                imageCells: [] as BrickCell[],
                imageGridBounds: measureImageGridBounds([]),
            };
        }

        const imageData = loadImageToImageData(processedSource);
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
        processedSource,
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
                maskImageKey(maskSettings),
                maskSettings.scale,
                maskSettings.offsetX,
                maskSettings.offsetY,
                sourceTransformKey(sourceTransform),
            ].join(":"),
        [
            bitmap,
            paletteSize,
            beadsPerRow,
            backgroundMode,
            backgroundHex,
            gridLayout,
            maskSettings,
            sourceTransform,
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
                maskImageKey(maskSettings),
                maskSettings.scale,
                maskSettings.offsetX,
                maskSettings.offsetY,
                sourceTransformKey(sourceTransform),
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
            maskSettings,
            sourceTransform,
        ],
    );

    useEffect(() => {
        if (pendingProjectRestoreRef.current) return;

        pendingStrokeRef.current.clear();
        pendingMarkStrokeRef.current.clear();
        setEditHistory((current) =>
            current.baseKey === cellsBaseKey
                ? current
                : { baseKey: cellsBaseKey, undo: [], redo: [] },
        );
        setMarkEditHistory((current) =>
            current.baseKey === cellsBaseKey
                ? current
                : { baseKey: cellsBaseKey, undo: [], redo: [] },
        );
    }, [cellsBaseKey]);

    const cellMarks = useMemo(() => {
        return markOverrides.baseKey === cellsBaseKey ? markOverrides.marks : {};
    }, [markOverrides, cellsBaseKey]);

    const cells = useMemo(() => {
        const rawOverrides =
            cellOverrides.baseKey === cellsBaseKey ? cellOverrides.cells : {};
        const overrides = Object.fromEntries(
            Object.entries(rawOverrides).filter(
                ([, paletteIndex]) => paletteIndex >= 0 || paletteIndex === EMPTY_PALETTE_INDEX,
            ),
        );

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

        const nextMarkOverrides = {
            baseKey: cellsBaseKey,
            marks: pending.cellMarks,
        };
        setMarkOverrides(nextMarkOverrides);
        markOverridesRef.current = nextMarkOverrides;

        setEditHistory({
            baseKey: cellsBaseKey,
            undo: pending.editHistory.undo,
            redo: pending.editHistory.redo,
        });
        setMarkEditHistory({
            baseKey: cellsBaseKey,
            undo: pending.markEditHistory.undo,
            redo: pending.markEditHistory.redo,
        });
    }, [bitmap, paletteBaseKey, cellsBaseKey, restoreKey]);

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

        const emptyMarkOverrides = { baseKey: cellsBaseKey, marks: {} };
        setMarkOverrides(emptyMarkOverrides);
        markOverridesRef.current = emptyMarkOverrides;

        setEditHistory({ baseKey: cellsBaseKey, undo: [], redo: [] });
        setMarkEditHistory({ baseKey: cellsBaseKey, undo: [], redo: [] });

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
                pendingMarkStrokeRef.current.clear();
                setEditHistory({ baseKey: cellsBaseKey, undo: [], redo: [] });
                setMarkEditHistory({ baseKey: cellsBaseKey, undo: [], redo: [] });

                setMarkOverrides((current) => {
                    const marks =
                        current.baseKey === cellsBaseKey ? current.marks : {};
                    const filtered = Object.fromEntries(
                        Object.entries(marks).filter(([key]) => {
                            const [rowStr, colStr] = key.split(",");
                            const row = Number.parseInt(rowStr, 10);
                            const col = Number.parseInt(colStr, 10);

                            return (
                                !Number.isNaN(row) &&
                                !Number.isNaN(col) &&
                                row >= 0 &&
                                row < next.height &&
                                col >= 0 &&
                                col < next.width
                            );
                        }),
                    );
                    const nextOverrides = {
                        baseKey: cellsBaseKey,
                        marks: filtered,
                    };
                    markOverridesRef.current = nextOverrides;
                    return nextOverrides;
                });
            }
        },
        [cellsBaseKey, gridLayout, imageGridSizeBeads.width, imageGridSizeBeads.height],
    );

    const setWeavingCurtains = useCallback(
        (value: SetStateAction<WeavingCurtains>) => {
            setWeavingCurtainsState((current) => {
                const next =
                    typeof value === "function" ? value(current) : value;
                return clampWeavingCurtains(next, schemeSizeBeads);
            });
        },
        [schemeSizeBeads],
    );

    useEffect(() => {
        setWeavingCurtainsState((current) =>
            clampWeavingCurtains(current, schemeSizeBeads),
        );
    }, [schemeSizeBeads.width, schemeSizeBeads.height]);

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

    const setCellMarked = useCallback(
        (
            row: number,
            col: number,
            marked: boolean,
            options?: SetCellPaletteIndexOptions,
        ) => {
            const key = cellKey(row, col);
            const colorIndex = getEffectivePaletteIndex(
                baseCellsRef.current,
                cellOverridesRef.current.baseKey === cellsBaseKey
                    ? cellOverridesRef.current.cells
                    : {},
                row,
                col,
            );

            if (marked && colorIndex === EMPTY_PALETTE_INDEX) return;

            const currentMarks =
                markOverridesRef.current.baseKey === cellsBaseKey
                    ? markOverridesRef.current.marks
                    : {};
            const currentlyMarked = isMarkedKey(currentMarks, key);

            if (currentlyMarked === marked) return;

            if (options?.stroke) {
                const pending = pendingMarkStrokeRef.current;
                const existing = pending.get(key);

                if (existing) {
                    existing.to = marked;
                } else {
                    pending.set(key, {
                        row,
                        col,
                        from: currentlyMarked,
                        to: marked,
                    });
                }
            }

            setMarkOverrides((current) => {
                const marks =
                    current.baseKey === cellsBaseKey ? current.marks : {};
                const nextMarks = setMarkValue(marks, key, marked);
                const next = { baseKey: cellsBaseKey, marks: nextMarks };
                markOverridesRef.current = next;
                return next;
            });
        },
        [cellsBaseKey],
    );

    const clearCellMark = useCallback(
        (
            row: number,
            col: number,
            options?: SetCellPaletteIndexOptions,
        ) => {
            setCellMarked(row, col, false, options);
        },
        [setCellMarked],
    );

    const endMarkEditStroke = useCallback(() => {
        const changes = [...pendingMarkStrokeRef.current.values()];
        pendingMarkStrokeRef.current.clear();

        if (changes.length === 0) return;

        setMarkEditHistory((current) => {
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

    const applyMarkEditBatch = useCallback(
        (changes: MarkEditChange[]) => {
            if (changes.length === 0) return;

            setMarkOverrides((current) => {
                let marks =
                    current.baseKey === cellsBaseKey ? { ...current.marks } : {};

                for (const { row, col, to } of changes) {
                    const key = cellKey(row, col);
                    const colorIndex = getEffectivePaletteIndex(
                        baseCellsRef.current,
                        cellOverridesRef.current.baseKey === cellsBaseKey
                            ? cellOverridesRef.current.cells
                            : {},
                        row,
                        col,
                    );

                    if (to && colorIndex === EMPTY_PALETTE_INDEX) continue;

                    marks = setMarkValue(marks, key, to);
                }

                const next = { baseKey: cellsBaseKey, marks };
                markOverridesRef.current = next;
                return next;
            });

            setMarkEditHistory((current) => {
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

    const undoMarkEdit = useCallback(() => {
        setMarkEditHistory((current) => {
            if (current.baseKey !== cellsBaseKey || current.undo.length === 0) {
                return current;
            }

            const changes = current.undo[current.undo.length - 1];

            setMarkOverrides((overrides) => {
                const marks =
                    overrides.baseKey === cellsBaseKey ? overrides.marks : {};
                const nextMarks = applyMarkChanges(marks, changes, true);
                const next = { baseKey: cellsBaseKey, marks: nextMarks };
                markOverridesRef.current = next;
                return next;
            });

            return {
                baseKey: cellsBaseKey,
                undo: current.undo.slice(0, -1),
                redo: [...current.redo, changes],
            };
        });
    }, [cellsBaseKey]);

    const redoMarkEdit = useCallback(() => {
        setMarkEditHistory((current) => {
            if (current.baseKey !== cellsBaseKey || current.redo.length === 0) {
                return current;
            }

            const changes = current.redo[current.redo.length - 1];

            setMarkOverrides((overrides) => {
                const marks =
                    overrides.baseKey === cellsBaseKey ? overrides.marks : {};
                const nextMarks = applyMarkChanges(marks, changes, false);
                const next = { baseKey: cellsBaseKey, marks: nextMarks };
                markOverridesRef.current = next;
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
    const canUndoMarkEdit =
        markEditHistory.baseKey === cellsBaseKey &&
        markEditHistory.undo.length > 0;
    const canRedoMarkEdit =
        markEditHistory.baseKey === cellsBaseKey &&
        markEditHistory.redo.length > 0;

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
                mask: serializeMaskSettings(maskSettings),
                sourceTransform,
                weavingCurtains,
            },
            paletteColors:
                paletteOverrides.baseKey === paletteBaseKey
                    ? paletteOverrides.colors
                    : {},
            cellEdits: exportCellEditsFromState(baseCells, cells),
            cellMarks: Object.keys(cellMarks),
            editHistory:
                editHistory.baseKey === cellsBaseKey
                    ? { undo: editHistory.undo, redo: editHistory.redo }
                    : { undo: [], redo: [] },
            markEditHistory:
                markEditHistory.baseKey === cellsBaseKey
                    ? {
                          undo: markEditHistory.undo,
                          redo: markEditHistory.redo,
                      }
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
        baseCells,
        cells,
        cellMarks,
        cellsBaseKey,
        editHistory,
        markEditHistory,
        maskSettings,
        sourceTransform,
        weavingCurtains,
    ]);

    const setMaskKind = useCallback(
        (kind: MaskKind) => {
            setMaskSettings((current) => {
                const next = { ...current, kind };

                if (!bitmap) return next;

                if (kind === "none") return { ...next, kind: "none" };

                return centerMaskOnImage(bitmap.width, bitmap.height, next);
            });
        },
        [bitmap],
    );

    const commitMaskSettings = useCallback((settings: ImageMaskSettings) => {
        setMaskSettings(settings);
    }, []);

    const setCustomMaskFile = useCallback(
        async (file: File | null) => {
            if (!file) {
                customMaskLoadKeyRef.current = "";
                setCustomMaskBitmap(null);
                setMaskSettings((current) => {
                    const { customImage: _removed, ...rest } = current;
                    return { ...rest };
                });
                return;
            }

            if (!file.type.startsWith("image/")) return;

            const image = await loadImageElementFromFile(file);
            const customImage = await encodeImageToBase64(image);

            customMaskLoadKeyRef.current = `${customImage.mimeType}:${customImage.base64.length}:${customImage.base64.slice(0, 24)}`;
            setCustomMaskBitmap(image);
            setMaskSettings((current) => {
                const next = { ...current, kind: "custom" as const, customImage };

                if (!bitmap) return next;

                return centerMaskOnImage(bitmap.width, bitmap.height, next);
            });
        },
        [bitmap],
    );

    const commitSourceTransform = useCallback((transform: SourceTransform) => {
        setSourceTransform(transform);
    }, []);

    const resetSourceTransform = useCallback(() => {
        setSourceTransform(defaultSourceTransform());
    }, []);

    const loadProject = useCallback(
        (project: ProjectExportData) => {
            const {
                settings,
                paletteColors,
                cellEdits,
                cellMarks,
                editHistory: history,
                markEditHistory: markHistory,
            } = project;

            const legacySplit = splitLegacyCellEdits(cellEdits);
            const restoredMarks = { ...legacySplit.marks };

            for (const key of cellMarks ?? []) {
                restoredMarks[key] = true;
            }

            pendingProjectRestoreRef.current = {
                paletteColors,
                cellEdits: legacySplit.colorEdits,
                cellMarks: restoredMarks,
                editHistory: history,
                markEditHistory: markHistory ?? { undo: [], redo: [] },
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
            setWeavingCurtainsState(
                clampWeavingCurtains(
                    settings.weavingCurtains ?? DEFAULT_WEAVING_CURTAINS,
                    settings.schemeSize,
                ),
            );
            skipMaskCenterRef.current = true;
            skipSourceTransformResetRef.current = true;
            setMaskSettings(settings.mask ?? defaultMaskSettings());
            setSourceTransform(settings.sourceTransform ?? defaultSourceTransform());
            bitmapSizeKeyRef.current = `${bitmap?.width ?? 0}x${bitmap?.height ?? 0}`;
            // Force the restore effect to run even if all other deps are unchanged
            // (e.g. same image + same settings but different cell edits/palette).
            setRestoreKey((k) => k + 1);

            autoSchemeSizeKeyRef.current = [
                bitmap?.width ?? 0,
                bitmap?.height ?? 0,
                settings.paletteSize,
                settings.beadsPerRow,
                settings.backgroundMode,
                settings.backgroundHex,
                settings.gridLayout,
                settings.mask ? maskImageKey(settings.mask) : "none",
                settings.mask?.scale ?? 1,
                settings.mask?.offsetX ?? 0,
                settings.mask?.offsetY ?? 0,
                sourceTransformKey(
                    settings.sourceTransform ?? defaultSourceTransform(),
                ),
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
        cellMarks,
        setCellMarked,
        clearCellMark,
        endMarkEditStroke,
        applyMarkEditBatch,
        undoMarkEdit,
        redoMarkEdit,
        canUndoMarkEdit,
        canRedoMarkEdit,
        baseCells,
        exportProjectData,
        loadProject,
        availableMaskImages,
        customMaskBitmap,
        maskSettings,
        setMaskKind,
        commitMaskSettings,
        setCustomMaskFile,
        sourceTransform,
        commitSourceTransform,
        resetSourceTransform,
        weavingCurtains,
        setWeavingCurtains,
    };
}
