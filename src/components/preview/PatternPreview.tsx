import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import { rgbToCss, type BrickCell, type GridLayout, type RGB } from "../../beadMath";
import { PREVIEW_ZOOM_STEP } from "../../features/preview/previewZoom";
import { floodFillChanges } from "../../features/pattern/floodFill";
import {
    getCanvasPointerCoords,
    hitTestBrickCell,
    paintBrickPreview,
    type CanvasBackground,
    type PaintBrickPreviewOptions,
    type SchemeSizeBeads,
} from "../../features/preview/canvasUtils";

type EditTool = "pan" | "pencil" | "eraser" | "fill";

type PatternPreviewProps = {
    bitmap: HTMLImageElement | null;
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    previewZoom: number;
    onPreviewZoomChange: Dispatch<SetStateAction<number>>;
    gridLayout: GridLayout;
    canvasBackground: CanvasBackground;
    onCellPaletteIndexChange: (
        row: number,
        col: number,
        paletteIndex: number,
        options?: { stroke?: boolean },
    ) => void;
    onCellEditStrokeEnd: () => void;
    onCellEditBatch: (
        changes: Array<{
            row: number;
            col: number;
            from: number;
            to: number;
        }>,
    ) => void;
    onUndoCellEdit: () => void;
    onRedoCellEdit: () => void;
    canUndoCellEdit: boolean;
    canRedoCellEdit: boolean;
    schemeSizeBeads: { width: number; height: number };
    minSchemeSizeBeads: { width: number; height: number };
    onSchemeSizeChange: (width: number, height: number) => void;
};

const PREVIEW_PAD = 6;

function PanToolIcon() {
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
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
    );
}

function PencilToolIcon() {
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
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    );
}

function EraserToolIcon() {
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
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" />
            <path d="m5 12 5 5" />
        </svg>
    );
}

function FillToolIcon() {
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
            <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
            <path d="m5 2 5 5" />
            <path d="M2 13h15" />
            <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
        </svg>
    );
}

function ChevronDownIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
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

function RedoIcon() {
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
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
    );
}

type PatternColorComboboxProps = {
    palette: RGB[];
    selectedIndex: number;
    onSelect: (index: number) => void;
};

function PatternColorCombobox({
    palette,
    selectedIndex,
    onSelect,
}: PatternColorComboboxProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    const selectedColor = palette[selectedIndex];

    useEffect(() => {
        if (!open) return;

        const onDocumentMouseDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onDocumentMouseDown);
        return () =>
            document.removeEventListener("mousedown", onDocumentMouseDown);
    }, [open]);

    return (
        <div
            ref={rootRef}
            className={`pattern-color-combobox${open ? " open" : ""}`}
        >
            <button
                type="button"
                className="pattern-color-trigger"
                title="Колір з палітри"
                aria-label="Колір з палітри"
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen((value) => !value)}
            >
                {selectedColor && (
                    <span
                        className="pattern-color-block"
                        style={{ background: rgbToCss(selectedColor) }}
                    />
                )}
                <ChevronDownIcon />
            </button>

            {open && (
                <ul
                    className="pattern-color-menu"
                    role="listbox"
                    aria-label="Колір з палітри"
                >
                    {palette.map((color, index) => (
                        <li key={index} role="presentation">
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === selectedIndex}
                                aria-label={`Колір ${index + 1}`}
                                className={`pattern-color-option${index === selectedIndex ? " active" : ""}`}
                                style={{ background: rgbToCss(color) }}
                                onClick={() => {
                                    onSelect(index);
                                    setOpen(false);
                                }}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

type PatternSchemeSizeControlsProps = {
    schemeSize: SchemeSizeBeads;
    minSchemeSize: SchemeSizeBeads;
    onChange: (width: number, height: number) => void;
};

function PatternSchemeSizeControls({
    schemeSize,
    minSchemeSize,
    onChange,
}: PatternSchemeSizeControlsProps) {
    const [widthDraft, setWidthDraft] = useState(String(schemeSize.width));
    const [heightDraft, setHeightDraft] = useState(String(schemeSize.height));

    useEffect(() => {
        setWidthDraft(String(schemeSize.width));
        setHeightDraft(String(schemeSize.height));
    }, [schemeSize.width, schemeSize.height]);

    const commit = () => {
        const width = Number.parseInt(widthDraft, 10);
        const height = Number.parseInt(heightDraft, 10);

        if (Number.isNaN(width) || Number.isNaN(height)) {
            setWidthDraft(String(schemeSize.width));
            setHeightDraft(String(schemeSize.height));
            return;
        }

        onChange(width, height);
    };

    return (
        <div
            className="pattern-scheme-size"
            title="Розмір схеми в бісеринках (ширина × висота)"
        >
            <label className="pattern-scheme-size-field">
                <span className="pattern-scheme-size-label">Ш</span>
                <input
                    type="number"
                    min={minSchemeSize.width}
                    max={800}
                    value={widthDraft}
                    aria-label="Ширина схеми в бісеринках"
                    onChange={(event) => setWidthDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.currentTarget.blur();
                        }
                    }}
                />
            </label>
            <span className="pattern-scheme-size-sep" aria-hidden>
                ×
            </span>
            <label className="pattern-scheme-size-field">
                <span className="pattern-scheme-size-label">В</span>
                <input
                    type="number"
                    min={minSchemeSize.height}
                    max={800}
                    value={heightDraft}
                    aria-label="Висота схеми в бісеринках"
                    onChange={(event) => setHeightDraft(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.currentTarget.blur();
                        }
                    }}
                />
            </label>
        </div>
    );
}

export function PatternPreview({
    bitmap,
    cells,
    cellSizePx,
    patternPalette,
    previewZoom,
    onPreviewZoomChange,
    gridLayout,
    canvasBackground,
    onCellPaletteIndexChange,
    onCellEditStrokeEnd,
    onCellEditBatch,
    onUndoCellEdit,
    onRedoCellEdit,
    canUndoCellEdit,
    canRedoCellEdit,
    schemeSizeBeads,
    minSchemeSizeBeads,
    onSchemeSizeChange,
}: PatternPreviewProps) {
    const patternCanvasRef = useRef<HTMLCanvasElement>(null);
    const patternWrapRef = useRef<HTMLDivElement>(null);
    const isPaintingRef = useRef(false);
    const isPanningRef = useRef(false);
    const panStartRef = useRef({
        x: 0,
        y: 0,
        scrollLeft: 0,
        scrollTop: 0,
    });

    const [editTool, setEditTool] = useState<EditTool>("pan");
    const [selectedColorIndex, setSelectedColorIndex] = useState(0);
    const [isPanning, setIsPanning] = useState(false);

    useEffect(() => {
        setSelectedColorIndex((index) =>
            Math.min(index, Math.max(0, patternPalette.length - 1)),
        );
    }, [patternPalette.length]);

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
            pad: PREVIEW_PAD,
            layout: gridLayout,
            canvasBackground,
            schemeSize: schemeSizeBeads,
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
        schemeSizeBeads,
    ]);

    const applyToolAt = useCallback(
        (clientX: number, clientY: number) => {
            const canvas = patternCanvasRef.current;
            if (!canvas || editTool === "pan") return;

            const { x, y } = getCanvasPointerCoords(canvas, clientX, clientY);
            const cell = hitTestBrickCell(
                x,
                y,
                cells,
                cellSizePx,
                previewZoom,
                PREVIEW_PAD,
                gridLayout,
                schemeSizeBeads,
            );

            if (!cell) return;

            if (editTool === "fill") {
                const changes = floodFillChanges(
                    cells,
                    schemeSizeBeads,
                    gridLayout,
                    cell.row,
                    cell.col,
                    selectedColorIndex,
                );

                onCellEditBatch(changes);
                return;
            }

            if (editTool === "pencil") {
                onCellPaletteIndexChange(
                    cell.row,
                    cell.col,
                    selectedColorIndex,
                    { stroke: true },
                );
            } else {
                onCellPaletteIndexChange(cell.row, cell.col, -1, {
                    stroke: true,
                });
            }
        },
        [
            cells,
            cellSizePx,
            editTool,
            gridLayout,
            onCellPaletteIndexChange,
            onCellEditBatch,
            previewZoom,
            selectedColorIndex,
            schemeSizeBeads,
        ],
    );

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (isPanningRef.current) {
                const wrap = patternWrapRef.current;
                if (!wrap) return;

                const { x, y, scrollLeft, scrollTop } = panStartRef.current;
                wrap.scrollLeft = scrollLeft - (event.clientX - x);
                wrap.scrollTop = scrollTop - (event.clientY - y);
                return;
            }

            if (isPaintingRef.current) {
                applyToolAt(event.clientX, event.clientY);
            }
        };

        const onMouseUp = () => {
            if (isPaintingRef.current) {
                onCellEditStrokeEnd();
            }

            isPanningRef.current = false;
            isPaintingRef.current = false;
            setIsPanning(false);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [applyToolAt, onCellEditStrokeEnd]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;

            const key = event.key.toLowerCase();
            if (key === "z" && !event.shiftKey) {
                if (!canUndoCellEdit) return;
                event.preventDefault();
                onUndoCellEdit();
            } else if (key === "y" || (key === "z" && event.shiftKey)) {
                if (!canRedoCellEdit) return;
                event.preventDefault();
                onRedoCellEdit();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [canUndoCellEdit, canRedoCellEdit, onUndoCellEdit, onRedoCellEdit]);

    const handleWrapMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (editTool !== "pan" || event.button !== 0) return;

        const wrap = patternWrapRef.current;
        if (!wrap) return;

        isPanningRef.current = true;
        setIsPanning(true);
        panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: wrap.scrollLeft,
            scrollTop: wrap.scrollTop,
        };
        event.preventDefault();
    };

    const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (editTool === "pan" || event.button !== 0) return;

        if (editTool === "fill") {
            applyToolAt(event.clientX, event.clientY);
            event.preventDefault();
            return;
        }

        isPaintingRef.current = true;
        applyToolAt(event.clientX, event.clientY);
        event.preventDefault();
    };

    return (
        <section className="preview-block preview-scheme">
            <h2>Схема</h2>

            {bitmap && patternPalette.length > 0 && (
                <div className="pattern-toolbar">
                    <div
                        className="pattern-tool-group"
                        role="group"
                        aria-label="Інструмент редагування"
                    >
                        <button
                            type="button"
                            className={`pattern-tool-btn ${editTool === "pan" ? "active" : ""}`}
                            aria-pressed={editTool === "pan"}
                            title="Перетягування"
                            aria-label="Перетягування"
                            onClick={() => setEditTool("pan")}
                        >
                            <PanToolIcon />
                        </button>
                        <button
                            type="button"
                            className={`pattern-tool-btn ${editTool === "pencil" ? "active" : ""}`}
                            aria-pressed={editTool === "pencil"}
                            title="Олівець"
                            aria-label="Олівець"
                            onClick={() => setEditTool("pencil")}
                        >
                            <PencilToolIcon />
                        </button>
                        <button
                            type="button"
                            className={`pattern-tool-btn ${editTool === "eraser" ? "active" : ""}`}
                            aria-pressed={editTool === "eraser"}
                            title="Стирачка"
                            aria-label="Стирачка"
                            onClick={() => setEditTool("eraser")}
                        >
                            <EraserToolIcon />
                        </button>
                        <button
                            type="button"
                            className={`pattern-tool-btn ${editTool === "fill" ? "active" : ""}`}
                            aria-pressed={editTool === "fill"}
                            title="Заливка"
                            aria-label="Заливка"
                            onClick={() => setEditTool("fill")}
                        >
                            <FillToolIcon />
                        </button>
                    </div>

                    <div
                        className="pattern-tool-group"
                        role="group"
                        aria-label="Історія редагування"
                    >
                        <button
                            type="button"
                            className="pattern-tool-btn"
                            title="Відміна"
                            aria-label="Відміна"
                            disabled={!canUndoCellEdit}
                            onClick={onUndoCellEdit}
                        >
                            <UndoIcon />
                        </button>
                        <button
                            type="button"
                            className="pattern-tool-btn"
                            title="Повтор"
                            aria-label="Повтор"
                            disabled={!canRedoCellEdit}
                            onClick={onRedoCellEdit}
                        >
                            <RedoIcon />
                        </button>
                    </div>

                    <PatternColorCombobox
                        palette={patternPalette}
                        selectedIndex={selectedColorIndex}
                        onSelect={setSelectedColorIndex}
                    />

                    <PatternSchemeSizeControls
                        schemeSize={schemeSizeBeads}
                        minSchemeSize={minSchemeSizeBeads}
                        onChange={onSchemeSizeChange}
                    />
                </div>
            )}

            <div
                ref={patternWrapRef}
                className={`pattern-wrap pattern-wrap--${editTool}${isPanning ? " pattern-wrap--panning" : ""}`}
                onMouseDown={handleWrapMouseDown}
            >
                <canvas
                    ref={patternCanvasRef}
                    className="pattern"
                    onMouseDown={handleCanvasMouseDown}
                />
            </div>
        </section>
    );
}
