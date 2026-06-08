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
    isMaskSignificantAtImagePoint,
} from "../../features/mask/imageMask";
import {
    drawTransformedSource,
    isDefaultSourceTransform,
    SOURCE_SCALE_MAX,
    SOURCE_SCALE_MIN,
    SOURCE_SCALE_STEP,
    type SourceTransform,
} from "../../features/image/sourceTransform";
import {
    MASK_KIND_LABELS,
    MASK_SCALE_MAX,
    MASK_SCALE_MIN,
    MASK_SCALE_STEP,
} from "../../features/mask/maskTypes";
import type { ImageMaskSettings, MaskKind } from "../../features/mask/maskTypes";
import { resolveMaskImage, type AvailableMaskImages } from "../../features/mask/resolveMaskImage";
import { drawCheckerboard, getCanvasPointerCoords } from "../../features/preview/canvasUtils";

const PREVIEW_MAX_WIDTH = 420;
const MASK_OVERLAY_ALPHA = 0.45;

type DragMode = "image" | "mask";

type OriginalImagePreviewProps = {
    bitmap: HTMLImageElement | null;
    sourceTransform: SourceTransform;
    onSourceTransformCommit: (transform: SourceTransform) => void;
    onResetSourceTransform: () => void;
    maskImages: AvailableMaskImages;
    maskSettings: ImageMaskSettings;
    onMaskKindChange: (kind: MaskKind) => void;
    onMaskCommit: (settings: ImageMaskSettings) => void;
    onCustomMaskFileSelect: (file: File | null) => void;
    isDragOver: boolean;
    onDragOver: DragEventHandler<HTMLElement>;
    onDragLeave: DragEventHandler<HTMLElement>;
    onDrop: DragEventHandler<HTMLElement>;
};

function isImagePanButton(button: number): boolean {
    return button === 0 || button === 1 || button === 2;
}

function UndoIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
    );
}

export function OriginalImagePreview({
    bitmap,
    sourceTransform,
    onSourceTransformCommit,
    onResetSourceTransform,
    maskImages,
    maskSettings,
    onMaskKindChange,
    onMaskCommit,
    onCustomMaskFileSelect,
    isDragOver,
    onDragOver,
    onDragLeave,
    onDrop,
}: OriginalImagePreviewProps) {
    const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
    const customMaskInputRef = useRef<HTMLInputElement>(null);
    const displayScaleRef = useRef(1);
    const previewMaskRef = useRef(maskSettings);
    const previewSourceRef = useRef(sourceTransform);
    const isDraggingMaskRef = useRef(false);
    const isDraggingImageRef = useRef(false);
    const [previewMask, setPreviewMask] = useState(maskSettings);
    const [previewSource, setPreviewSource] = useState(sourceTransform);
    const dragRef = useRef<{
        mode: DragMode;
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

    const updatePreviewSource = useCallback((next: SourceTransform) => {
        previewSourceRef.current = next;
        setPreviewSource(next);
    }, []);

    useEffect(() => {
        if (isDraggingMaskRef.current) return;

        previewMaskRef.current = maskSettings;
        setPreviewMask(maskSettings);
    }, [maskSettings]);

    useEffect(() => {
        if (isDraggingImageRef.current) return;

        previewSourceRef.current = sourceTransform;
        setPreviewSource(sourceTransform);
    }, [sourceTransform]);

    const activeMask = resolveMaskImage(previewMask, maskImages);

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

        ctx.save();
        ctx.scale(displayScale, displayScale);
        drawTransformedSource(ctx, bitmap, previewSourceRef.current);
        ctx.restore();

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
    }, [bitmap, activeMask, previewMask, previewSource]);

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

    const resolveDragMode = useCallback(
        (button: number, imageX: number, imageY: number): DragMode | null => {
            if (!bitmap || !isImagePanButton(button)) return null;

            const maskSettings = previewMaskRef.current;
            const maskActive =
                maskSettings.kind !== "none" &&
                (maskSettings.kind !== "custom" || !!maskImages.custom);

            if (button === 0 && maskActive) {
                const mask = resolveMaskImage(maskSettings, maskImages);
                if (!mask) return "image";

                return isMaskSignificantAtImagePoint(
                    mask,
                    bitmap.width,
                    bitmap.height,
                    maskSettings,
                    imageX,
                    imageY,
                )
                    ? "mask"
                    : "image";
            }

            return "image";
        },
        [bitmap, maskImages],
    );

    const handlePointerDown: PointerEventHandler<HTMLCanvasElement> = useCallback(
        (event) => {
            const point = pointerToImageCoords(event.clientX, event.clientY);
            if (!point) return;

            const mode = resolveDragMode(event.button, point.x, point.y);
            if (!mode) return;

            if (mode === "mask") {
                isDraggingMaskRef.current = true;
            } else {
                isDraggingImageRef.current = true;
            }

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
                mode,
                pointerId: event.pointerId,
                startOffsetX:
                    mode === "mask"
                        ? previewMaskRef.current.offsetX
                        : previewSourceRef.current.offsetX,
                startOffsetY:
                    mode === "mask"
                        ? previewMaskRef.current.offsetY
                        : previewSourceRef.current.offsetY,
                startImageX: point.x,
                startImageY: point.y,
            };
        },
        [resolveDragMode, pointerToImageCoords],
    );

    const handlePointerMove: PointerEventHandler<HTMLCanvasElement> = useCallback(
        (event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;

            const point = pointerToImageCoords(event.clientX, event.clientY);
            if (!point) return;

            const offsetX = drag.startOffsetX + (point.x - drag.startImageX);
            const offsetY = drag.startOffsetY + (point.y - drag.startImageY);

            if (drag.mode === "mask") {
                updatePreviewMask({
                    ...previewMaskRef.current,
                    offsetX,
                    offsetY,
                });
                return;
            }

            updatePreviewSource({
                ...previewSourceRef.current,
                offsetX,
                offsetY,
            });
        },
        [pointerToImageCoords, updatePreviewMask, updatePreviewSource],
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

            if (drag.mode === "mask") {
                isDraggingMaskRef.current = false;

                if (shouldCommit) {
                    onMaskCommit(previewMaskRef.current);
                    return;
                }

                updatePreviewMask(maskSettings);
                return;
            }

            isDraggingImageRef.current = false;

            if (shouldCommit) {
                onSourceTransformCommit(previewSourceRef.current);
                return;
            }

            updatePreviewSource(sourceTransform);
        },
        [
            maskSettings,
            sourceTransform,
            onMaskCommit,
            onSourceTransformCommit,
            updatePreviewMask,
            updatePreviewSource,
        ],
    );

    const maskActive =
        previewMask.kind !== "none" &&
        (previewMask.kind !== "custom" || !!maskImages.custom);

    const canPanImage = !!bitmap;
    const canvasCursorClass = canPanImage ? " thumb--pan-active" : "";

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
                            className={`thumb${canvasCursorClass}`}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(event) => finishDrag(event, true)}
                            onPointerCancel={(event) => finishDrag(event, false)}
                            onContextMenu={(event) => event.preventDefault()}
                        />
                    </div>

                    <div className="original-controls">
                        <div className="original-image-controls">
                            <div className="original-control-row">
                                <span
                                    className="label"
                                    title="Масштаб оригінального зображення"
                                >
                                    Масштаб
                                </span>
                                <DeferredRangeSlider
                                    variant="inline"
                                    min={SOURCE_SCALE_MIN}
                                    max={SOURCE_SCALE_MAX}
                                    step={SOURCE_SCALE_STEP}
                                    value={sourceTransform.scale}
                                    onDraftChange={(scale) =>
                                        updatePreviewSource({
                                            ...previewSourceRef.current,
                                            scale,
                                        })
                                    }
                                    onCommit={(scale) =>
                                        onSourceTransformCommit({
                                            ...previewSourceRef.current,
                                            scale,
                                        })
                                    }
                                    aria-label="Масштаб зображення"
                                    tooltip="Масштаб оригінального зображення"
                                />
                                <button
                                    type="button"
                                    className="pattern-tool-btn original-transform-reset"
                                    title="Скинути масштаб і положення"
                                    aria-label="Скинути масштаб і положення"
                                    disabled={isDefaultSourceTransform(sourceTransform)}
                                    onClick={onResetSourceTransform}
                                >
                                    <UndoIcon />
                                </button>
                            </div>
                        </div>

                        <div className="original-mask-controls">
                            <div className="original-control-row original-mask-row">
                                <span className="label">Маска</span>
                                <div className="original-mask-row-controls">
                                    <select
                                        className="mask-select"
                                        value={maskSettings.kind}
                                        onChange={(event) =>
                                            onMaskKindChange(
                                                event.target.value as MaskKind,
                                            )
                                        }
                                    >
                                        {(
                                            Object.keys(
                                                MASK_KIND_LABELS,
                                            ) as MaskKind[]
                                        ).map((kind) => (
                                            <option key={kind} value={kind}>
                                                {MASK_KIND_LABELS[kind]}
                                            </option>
                                        ))}
                                    </select>
                                    {maskSettings.kind === "custom" && (
                                        <>
                                            <input
                                                ref={customMaskInputRef}
                                                className="upload-input-hidden"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) => {
                                                    onCustomMaskFileSelect(
                                                        event.target.files?.[0] ??
                                                            null,
                                                    );
                                                    event.target.value = "";
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="upload-button upload-button--compact"
                                                title="Обрати зображення маски"
                                                onClick={() =>
                                                    customMaskInputRef.current?.click()
                                                }
                                            >
                                                Обрати
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {maskActive && (
                                <div className="original-control-row">
                                    <span
                                        className="label"
                                        title="Масштаб маски"
                                    >
                                        Масштаб
                                    </span>
                                    <DeferredRangeSlider
                                        variant="inline"
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
                                        aria-label="Масштаб маски"
                                        tooltip="Масштаб маски"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
