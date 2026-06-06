import { useCallback, useMemo, useState } from "react";
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

const DEFAULT_BG = "#ffffff";
const BG_MATCH_SQ = 55 * 55;
const PALETTE_SAMPLE_STEP = 2;

type PaletteOverrides = {
    baseKey: string;
    colors: Record<number, RGB>;
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
    canvasBackground: CanvasBackground;
    setCanvasBackground: (value: CanvasBackground) => void;
    backgroundRgb: RGB;
    cellSizePx: number;
    palette: RGB[];
    cells: BrickCell[];
    patternPalette: RGB[];
    setPaletteColor: (index: number, hex: string) => void;
    resetPaletteColor: (index: number) => void;
    resetPaletteColors: () => void;
    hasPattern: boolean;
    beadCount: number;
    beadCountsByPalette: number[];
};

export function usePatternModel(bitmap: HTMLImageElement | null): PatternModel {
    const [paletteSize, setPaletteSize] = useState(10);
    const [beadsPerRow, setBeadsPerRow] = useState(60);
    const [gridLayout, setGridLayout] = useState<GridLayout>("brick");
    const [backgroundMode, setBackgroundMode] =
        useState<BackgroundMode>("color");
    const [backgroundHex, setBackgroundHex] = useState(DEFAULT_BG);
    const [previewZoom, setPreviewZoomState] = useState(1.2);
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

    const backgroundRgb = useMemo(
        () => parseHexColor(backgroundHex),
        [backgroundHex],
    );

    const cellSizePx = useMemo(() => {
        if (!bitmap || bitmap.width <= 0) return 1;

        return bitmap.width / Math.max(2, beadsPerRow);
    }, [bitmap, beadsPerRow]);

    const { palette, cells } = useMemo(() => {
        if (!bitmap || bitmap.width === 0) {
            return { palette: [] as RGB[], cells: [] as BrickCell[] };
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
        const cells = buildBrickGrid(imageData, cellSizePx, palette, {
            ...backgroundFilter,
            layout: gridLayout,
        });

        return { palette, cells };
    }, [
        bitmap,
        paletteSize,
        cellSizePx,
        backgroundRgb,
        backgroundMode,
        gridLayout,
    ]);

    const paletteBaseKey = useMemo(
        () => palette.map((color) => `${color.r},${color.g},${color.b}`).join("|"),
        [palette],
    );

    const patternPalette = useMemo(() => {
        if (paletteOverrides.baseKey !== paletteBaseKey) return palette;

        return palette.map((color, index) => paletteOverrides.colors[index] ?? color);
    }, [palette, paletteBaseKey, paletteOverrides]);

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

    const resetPaletteColors = useCallback(() => {
        setPaletteOverrides({ baseKey: paletteBaseKey, colors: {} });
    }, [paletteBaseKey]);

    const hasPattern = useMemo(
        () => cells.some((cell) => cell.paletteIndex >= 0),
        [cells],
    );

    const beadCount = useMemo(
        () => cells.filter((cell) => cell.paletteIndex >= 0).length,
        [cells],
    );

    const beadCountsByPalette = useMemo(
        () => countBeadsByPaletteIndex(cells, palette.length),
        [cells, palette.length],
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
        canvasBackground,
        setCanvasBackground,
        backgroundRgb,
        cellSizePx,
        palette,
        cells,
        patternPalette,
        setPaletteColor,
        resetPaletteColor,
        resetPaletteColors,
        hasPattern,
        beadCount,
        beadCountsByPalette,
    };
}
