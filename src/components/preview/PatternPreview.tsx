import { useEffect, useRef } from "react";
import type { BrickCell, GridLayout, RGB } from "../../beadMath";
import {
    paintBrickPreview,
    type PaintBrickPreviewOptions,
} from "../../features/preview/canvasUtils";

type PatternPreviewProps = {
    bitmap: HTMLImageElement | null;
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    ignoreBackground: boolean;
    previewZoom: number;
    gridLayout: GridLayout;
};

export function PatternPreview({
    bitmap,
    cells,
    cellSizePx,
    patternPalette,
    ignoreBackground,
    previewZoom,
    gridLayout,
}: PatternPreviewProps) {
    const patternCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = patternCanvasRef.current;
        if (!canvas || !bitmap) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const options: PaintBrickPreviewOptions = {
            ignoreBackground,
            zoom: previewZoom,
            pad: 6,
            showEmptyAsTransparent: true,
            layout: gridLayout,
        };

        paintBrickPreview(ctx, cells, cellSizePx, patternPalette, options);
    }, [
        bitmap,
        cells,
        cellSizePx,
        patternPalette,
        ignoreBackground,
        previewZoom,
        gridLayout,
    ]);

    return (
        <section className="preview-block preview-scheme">
            <h2>Схема</h2>

            <div className="pattern-wrap">
                <canvas ref={patternCanvasRef} className="pattern" />
            </div>
        </section>
    );
}
