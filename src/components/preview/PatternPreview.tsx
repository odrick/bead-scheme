import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { PREVIEW_ZOOM_STEP } from "../../features/preview/previewZoom";
import type { BrickCell, GridLayout, RGB } from "../../beadMath";
import {
    paintBrickPreview,
    type CanvasBackground,
    type PaintBrickPreviewOptions,
} from "../../features/preview/canvasUtils";

type PatternPreviewProps = {
    bitmap: HTMLImageElement | null;
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    previewZoom: number;
    onPreviewZoomChange: Dispatch<SetStateAction<number>>;
    gridLayout: GridLayout;
    canvasBackground: CanvasBackground;
};

export function PatternPreview({
    bitmap,
    cells,
    cellSizePx,
    patternPalette,
    previewZoom,
    onPreviewZoomChange,
    gridLayout,
    canvasBackground,
}: PatternPreviewProps) {
    const patternCanvasRef = useRef<HTMLCanvasElement>(null);
    const patternWrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wrap = patternWrapRef.current;
        if (!wrap || !bitmap) return;

        const onWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;

            event.preventDefault();
            const direction = event.deltaY < 0 ? 1 : -1;

            onPreviewZoomChange(
                (zoom) => zoom + direction * PREVIEW_ZOOM_STEP,
            );
        };

        wrap.addEventListener("wheel", onWheel, { passive: false });
        return () => wrap.removeEventListener("wheel", onWheel);
    }, [bitmap, onPreviewZoomChange]);

    useEffect(() => {
        const canvas = patternCanvasRef.current;
        if (!canvas || !bitmap) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const options: PaintBrickPreviewOptions = {
            zoom: previewZoom,
            pad: 6,
            layout: gridLayout,
            canvasBackground,
        };

        paintBrickPreview(ctx, cells, cellSizePx, patternPalette, options);
    }, [
        bitmap,
        cells,
        cellSizePx,
        patternPalette,
        previewZoom,
        gridLayout,
        canvasBackground,
    ]);

    return (
        <section className="preview-block preview-scheme">
            <h2>Схема</h2>

            <div ref={patternWrapRef} className="pattern-wrap">
                <canvas ref={patternCanvasRef} className="pattern" />
            </div>
        </section>
    );
}
