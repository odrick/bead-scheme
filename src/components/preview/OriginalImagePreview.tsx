import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type DragEventHandler,
    type PointerEventHandler,
} from "react";
import { DeferredRangeSlider } from "../controls/DeferredRangeSlider";
import {
    computeMaskDrawRect,
    drawMaskOverlay,
} from "../../features/mask/imageMask";
import {
    MASK_KIND_LABELS,
    MASK_SCALE_MAX,
    MASK_SCALE_MIN,
    MASK_SCALE_STEP,
} from "../../features/mask/maskTypes";
import type { ImageMaskSettings, MaskKind } from "../../features/mask/maskTypes";
import { drawCheckerboard, getCanvasPointerCoords } from "../../features/preview/canvasUtils";

const PREVIEW_MAX_WIDTH = 420;
const MASK_OVERLAY_ALPHA = 0.45;

type OriginalImagePreviewProps = {
    bitmap: HTMLImageElement | null;
    maskImages: Record<Exclude<MaskKind, "none">, HTMLImageElement | null>;
    maskSettings: ImageMaskSettings;
    onMaskKindChange: (kind: MaskKind) => void;
    onMaskCommit: (settings: ImageMaskSettings) => void;
    isDragOver: boolean;
    onDragOver: DragEventHandler<HTMLElement>;
    onDragLeave: DragEventHandler<HTMLElement>;
    onDrop: DragEventHandler<HTMLElement>;
};

export function OriginalImagePreview({
    bitmap,
    maskImages,
    maskSettings,
    onMaskKindChange,
    onMaskCommit,
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop,
}: OriginalImagePreviewProps) {
    const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
    const displayScaleRef = useRef(1);
    const previewMaskRef = useRef(maskSettings);
    const isDraggingMaskRef = useRef(false);
    const [previewMask, setPreviewMask] = useState(maskSettings);
    const dragRef = useRef<{
        pointerId: number;
        startOffsetX: number;
        startOffsetY: number;
        startImageX: number;
        startImageY: number;
    } | null>(null);

    const updatePreviewMask = useCallback((next: ImageMaskSettings) => {
        previewMaskRef.current = next;
        setPreviewMask(next);
    }, []);

    useEffect(() => {
        if (isDraggingMaskRef.current) return;

        previewMaskRef.current = maskSettings;
        setPreviewMask(maskSettings);
    }, [maskSettings]);

    const activeMask =
        previewMask.kind === "none" ? null : maskImages[previewMask.kind];

    const redraw = useCallback(() => {
        const canvas = sourceCanvasRef.current;
        if (!canvas || !bitmap) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const displayScale = Math.min(1, PREVIEW_MAX_WIDTH / bitmap.width);
        displayScaleRef.current = displayScale;

        const width = Math.round(bitmap.width * displayScale);
        const height = Math.round(bitmap.height * displayScale);

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = displayScale < 1;
        drawCheckerboard(ctx, 0, 0, width, height, "#2a2d34", "#1e2128", 8);
        ctx.drawImage(bitmap, 0, 0, width, height);

        if (activeMask) {
            const rect = computeMaskDrawRect(
                bitmap.width,
                bitmap.height,
                activeMask.naturalWidth,
                activeMask.naturalHeight,
                previewMask,
            );

            drawMaskOverlay(
                ctx,
                activeMask,
                {
                    x: rect.x * displayScale,
                    y: rect.y * displayScale,
                    width: rect.width * displayScale,
                    height: rect.height * displayScale,
                },
                MASK_OVERLAY_ALPHA,
            );
        }
    }, [bitmap, activeMask, previewMask]);

    useEffect(() => {
        redraw();
    }, [redraw]);

    const pointerToImageCoords = useCallback(
        (clientX: number, clientY: number) => {
            const canvas = sourceCanvasRef.current;
            if (!canvas) return null;

            const { x, y } = getCanvasPointerCoords(canvas, clientX, clientY);
            const scale = displayScaleRef.current;

            return {
                x: x / scale,
                y: y / scale,
            };
        },
        [],
    );

    const handlePointerDown: PointerEventHandler<HTMLCanvasElement> = useCallback(
        (event) => {
            if (!bitmap || previewMask.kind === "none" || !activeMask) return;

            const point = pointerToImageCoords(event.clientX, event.clientY);
            if (!point) return;

            isDraggingMaskRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
                pointerId: event.pointerId,
                startOffsetX: previewMask.offsetX,
                startOffsetY: previewMask.offsetY,
                startImageX: point.x,
                startImageY: point.y,
            };
        },
        [
            bitmap,
            previewMask.kind,
            previewMask.offsetX,
            previewMask.offsetY,
            activeMask,
            pointerToImageCoords,
        ],
    );

    const handlePointerMove: PointerEventHandler<HTMLCanvasElement> = useCallback(
        (event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;

            const point = pointerToImageCoords(event.clientX, event.clientY);
            if (!point) return;

            updatePreviewMask({
                ...previewMaskRef.current,
                offsetX: drag.startOffsetX + (point.x - drag.startImageX),
                offsetY: drag.startOffsetY + (point.y - drag.startImageY),
            });
        },
        [pointerToImageCoords, updatePreviewMask],
    );

    const finishDrag = useCallback(
        (
            event: React.PointerEvent<HTMLCanvasElement>,
            shouldCommit: boolean,
        ) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }

            dragRef.current = null;
            isDraggingMaskRef.current = false;

            if (shouldCommit) {
                onMaskCommit(previewMaskRef.current);
                return;
            }

            updatePreviewMask(maskSettings);
        },
        [maskSettings, onMaskCommit, updatePreviewMask],
    );

    const maskActive = previewMask.kind !== "none";

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
            {bitmap && (
                <>
                    <div className="original-preview-wrap">
                        <canvas
                            ref={sourceCanvasRef}
                            className={`thumb${maskActive ? " thumb--mask-active" : ""}`}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(event) => finishDrag(event, true)}
                            onPointerCancel={(event) => finishDrag(event, false)}
                        />
                    </div>

                    <div className="original-mask-controls">
                        <label className="field">
                            <span className="label">Маска</span>
                            <select
                                className="mask-select"
                                value={maskSettings.kind}
                                onChange={(event) =>
                                    onMaskKindChange(event.target.value as MaskKind)
                                }
                            >
                                {(Object.keys(MASK_KIND_LABELS) as MaskKind[]).map(
                                    (kind) => (
                                        <option key={kind} value={kind}>
                                            {MASK_KIND_LABELS[kind]}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>

                        {maskActive && (
                            <DeferredRangeSlider
                                min={MASK_SCALE_MIN}
                                max={MASK_SCALE_MAX}
                                step={MASK_SCALE_STEP}
                                value={maskSettings.scale}
                                onDraftChange={(scale) =>
                                    updatePreviewMask({
                                        ...previewMaskRef.current,
                                        scale,
                                    })
                                }
                                onCommit={(scale) =>
                                    onMaskCommit({
                                        ...previewMaskRef.current,
                                        scale,
                                    })
                                }
                                label={() => "Масштаб маски"}
                                aria-label="Масштаб маски"
                            />
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
