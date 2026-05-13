import { useMemo, useState } from "react";
import {
    BEAD_CATALOGS,
    nearestBead,
    type PreparedBeadCatalog,
} from "../../beadCatalog";
import {
    buildBrickGrid,
    extractPalette,
    parseHexColor,
    type BrickCell,
    type GridLayout,
    type RGB,
} from "../../beadMath";
import { loadImageToImageData } from "../preview/canvasUtils";

const DEFAULT_BG = "#ffffff";
const BG_MATCH_SQ = 55 * 55;
const PALETTE_SAMPLE_STEP = 2;
const DEFAULT_CATALOG = BEAD_CATALOGS[0];

if (!DEFAULT_CATALOG) {
    throw new Error("No bead catalogs configured.");
}

type PatternModel = {
    paletteSize: number;
    setPaletteSize: (value: number) => void;
    beadsPerRow: number;
    setBeadsPerRow: (value: number) => void;
    gridLayout: GridLayout;
    setGridLayout: (value: GridLayout) => void;
    backgroundHex: string;
    setBackgroundHex: (value: string) => void;
    ignoreBackground: boolean;
    setIgnoreBackground: (value: boolean) => void;
    previewZoom: number;
    setPreviewZoom: (value: number) => void;
    useManufacturerPalette: boolean;
    setUseManufacturerPalette: (value: boolean) => void;
    beadCatalogId: string;
    setBeadCatalogId: (value: string) => void;
    beadCatalog: PreparedBeadCatalog;
    backgroundRgb: RGB;
    cellSizePx: number;
    palette: RGB[];
    cells: BrickCell[];
    beadMatches: ReturnType<typeof nearestBead>[];
    patternPalette: RGB[];
    hasPattern: boolean;
    beadCount: number;
};

export function usePatternModel(bitmap: HTMLImageElement | null): PatternModel {
    const [paletteSize, setPaletteSize] = useState(10);
    const [beadsPerRow, setBeadsPerRow] = useState(60);
    const [gridLayout, setGridLayout] = useState<GridLayout>("brick");
    const [backgroundHex, setBackgroundHex] = useState(DEFAULT_BG);
    const [ignoreBackground, setIgnoreBackground] = useState(true);
    const [previewZoom, setPreviewZoom] = useState(1.2);
    const [useManufacturerPalette, setUseManufacturerPalette] = useState(false);
    const [beadCatalogId, setBeadCatalogId] = useState(DEFAULT_CATALOG.id);

    const backgroundRgb = useMemo(
        () => parseHexColor(backgroundHex),
        [backgroundHex],
    );

    const beadCatalog = useMemo(
        () =>
            BEAD_CATALOGS.find((catalog) => catalog.id === beadCatalogId) ??
            DEFAULT_CATALOG,
        [beadCatalogId],
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
        const palette = extractPalette(imageData, paletteSize, {
            ignoreBackground,
            background: backgroundRgb,
            bgThresholdSq: BG_MATCH_SQ,
            sampleStep: PALETTE_SAMPLE_STEP,
        });
        const cells = buildBrickGrid(imageData, cellSizePx, palette, {
            ignoreBackground,
            background: backgroundRgb,
            bgThresholdSq: BG_MATCH_SQ,
            layout: gridLayout,
        });

        return { palette, cells };
    }, [
        bitmap,
        paletteSize,
        cellSizePx,
        backgroundRgb,
        ignoreBackground,
        gridLayout,
    ]);

    const beadMatches = useMemo(
        () => palette.map((color) => nearestBead(color, beadCatalog)),
        [palette, beadCatalog],
    );

    const patternPalette = useMemo(() => {
        if (!useManufacturerPalette) return palette;

        return palette.map((color, index) => {
            const match = beadMatches[index];

            return match?.beadHex ? parseHexColor(match.beadHex) : color;
        });
    }, [palette, beadMatches, useManufacturerPalette]);

    const hasPattern = useMemo(
        () => cells.some((cell) => cell.paletteIndex >= 0),
        [cells],
    );

    const beadCount = useMemo(
        () => cells.filter((cell) => cell.paletteIndex >= 0).length,
        [cells],
    );

    return {
        paletteSize,
        setPaletteSize,
        beadsPerRow,
        setBeadsPerRow,
        gridLayout,
        setGridLayout,
        backgroundHex,
        setBackgroundHex,
        ignoreBackground,
        setIgnoreBackground,
        previewZoom,
        setPreviewZoom,
        useManufacturerPalette,
        setUseManufacturerPalette,
        beadCatalogId,
        setBeadCatalogId,
        beadCatalog,
        backgroundRgb,
        cellSizePx,
        palette,
        cells,
        beadMatches,
        patternPalette,
        hasPattern,
        beadCount,
    };
}
