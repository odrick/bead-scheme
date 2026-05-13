import { useEffect, useRef, type DragEventHandler } from "react";

type OriginalImagePreviewProps = {
    bitmap: HTMLImageElement | null;
    isDragOver: boolean;
    onDragOver: DragEventHandler<HTMLElement>;
    onDragLeave: DragEventHandler<HTMLElement>;
    onDrop: DragEventHandler<HTMLElement>;
};

export function OriginalImagePreview({
    bitmap,
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop,
}: OriginalImagePreviewProps) {
    const sourceCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = sourceCanvasRef.current;
        if (!canvas || !bitmap) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const maxW = 420;
        const scale = Math.min(1, maxW / bitmap.width);
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        ctx.imageSmoothingEnabled = scale < 1;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }, [bitmap]);

    return (
        <section
            className={`preview-block preview-original ${isDragOver ? "drag-over" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <h2>Оригінал</h2>
            {!bitmap && (
                <p className="hint">
                    Оберіть файл зображення або перетягніть його сюди.
                </p>
            )}
            {bitmap && <canvas ref={sourceCanvasRef} className="thumb" />}
        </section>
    );
}
