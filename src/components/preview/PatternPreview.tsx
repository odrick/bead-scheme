import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import { rgbToCss, type BrickCell, type GridLayout, type RGB } from "../../beadMath";
import { DeferredRangeSlider } from "../controls/DeferredRangeSlider";
import {
    computeFitPreviewZoom,
    PREVIEW_ZOOM_MAX,
    PREVIEW_ZOOM_MIN,
    PREVIEW_ZOOM_STEP,
} from "../../features/preview/previewZoom";
import {
    floodFillChanges,
    floodFillMarkChanges,
    floodFillRestoreChanges,
    floodFillUnmarkChanges,
} from "../../features/pattern/floodFill";
import {
    applyMarksToCells,
    type MarkEditChange,
    type PatternPaintSelection,
} from "../../features/pattern/cellEditHistory";
import {
    applyBrickCellChanges,
    computeBrickLayout,
    findChangedBrickCells,
    getCanvasPointerCoords,
    hitTestBrickCell,
    paintBrickPreview,
    type CanvasBackground,
    type PaintBrickPreviewOptions,
    type SchemeSizeBeads,
} from "../../features/preview/canvasUtils";

type EditTool = "pan" | "pencil" | "eraser" | "fill";
type SchemeMode = "editing" | "weaving";

type PatternPreviewProps = {
    autoFitZoomKey: number;
    bitmap: HTMLImageElement | null;
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    previewZoom: number;
    onPreviewZoomChange: Dispatch<SetStateAction<number>>;
    labelPaletteIndices: boolean;
    onLabelPaletteIndicesChange: (value: boolean) => void;
    gridLayout: GridLayout;
    canvasBackground: CanvasBackground;
    onCanvasBackgroundChange: (value: CanvasBackground) => void;
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
    onRestoreCell: (
        row: number,
        col: number,
        options?: { stroke?: boolean },
    ) => void;
    cellMarks: Record<string, boolean>;
    onSetCellMarked: (
        row: number,
        col: number,
        marked: boolean,
        options?: { stroke?: boolean },
    ) => void;
    onClearCellMark: (
        row: number,
        col: number,
        options?: { stroke?: boolean },
    ) => void;
    onMarkEditBatch: (changes: MarkEditChange[]) => void;
    onMarkEditStrokeEnd: () => void;
    baseCells: BrickCell[];
    onUndoCellEdit: () => void;
    onRedoCellEdit: () => void;
    canUndoCellEdit: boolean;
    canRedoCellEdit: boolean;
    onUndoMarkEdit: () => void;
    onRedoMarkEdit: () => void;
    canUndoMarkEdit: boolean;
    canRedoMarkEdit: boolean;
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

function FitToWindowIcon() {
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
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            <rect x="8" y="8" width="8" height="8" rx="1" />
        </svg>
    );
}

function PaletteLabelsIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
        >
            <text
                x="12"
                y="16.5"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
            >
                123
            </text>
        </svg>
    );
}

function SchemeSizeIcon() {
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
            <rect x="5" y="5" width="14" height="14" rx="1" />
            <path d="M9 5v14" />
            <path d="M15 5v14" />
            <path d="M5 9h14" />
            <path d="M5 15h14" />
        </svg>
    );
}

const CANVAS_BACKGROUND_OPTIONS: Array<{
    value: CanvasBackground;
    label: string;
}> = [
    { value: "checkerboard", label: "Шахматка" },
    { value: "white", label: "Білий" },
    { value: "black", label: "Чорний" },
];

function CanvasBackgroundSwatch({
    background,
    className = "",
}: {
    background: CanvasBackground;
    className?: string;
}) {
    return (
        <span
            className={`pattern-canvas-bg-swatch pattern-canvas-bg-swatch--${background}${className ? ` ${className}` : ""}`}
            aria-hidden
        />
    );
}

type PatternCanvasBackgroundMenuProps = {
    value: CanvasBackground;
    onChange: (value: CanvasBackground) => void;
};

function PatternCanvasBackgroundMenu({
    value,
    onChange,
}: PatternCanvasBackgroundMenuProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

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

    const pick = (next: CanvasBackground) => {
        onChange(next);
        setOpen(false);
    };

    return (
        <div
            ref={rootRef}
            className={`pattern-canvas-bg-menu${open ? " open" : ""}`}
        >
            <button
                type="button"
                className="pattern-tool-btn"
                title="Фон канвасу схеми"
                aria-label="Фон канвасу схеми"
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen((current) => !current)}
            >
                <CanvasBackgroundSwatch background={value} />
            </button>

            {open && (
                <ul
                    className="pattern-canvas-bg-options"
                    role="listbox"
                    aria-label="Фон канвасу схеми"
                >
                    {CANVAS_BACKGROUND_OPTIONS.map((option) => (
                        <li key={option.value} role="presentation">
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === option.value}
                                className={`pattern-canvas-bg-option${value === option.value ? " active" : ""}`}
                                onClick={() => pick(option.value)}
                            >
                                <CanvasBackgroundSwatch
                                    background={option.value}
                                />
                                <span>{option.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function RestoreColorIcon() {
    return (
        <svg
            width="16"
            height="16"
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

function MarkStarIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
        >
            <path d="M12 2.5 14.6 9l7 0.55-5.3 4.55 1.65 6.9L12 17.9 5.05 21l1.65-6.9L1.4 9.55 8.4 9 12 2.5Z" />
        </svg>
    );
}

type PatternColorComboboxProps = {
    mode: SchemeMode;
    palette: RGB[];
    selection: PatternPaintSelection;
    onSelect: (selection: PatternPaintSelection) => void;
};

function PatternColorCombobox({
    mode,
    palette,
    selection,
    onSelect,
}: PatternColorComboboxProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    const isPaletteSelected = selection.kind === "palette";
    const selectedColor = isPaletteSelected
        ? palette[selection.index]
        : undefined;

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

    const pick = (next: PatternPaintSelection) => {
        onSelect(next);
        setOpen(false);
    };

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
                {selection.kind === "restore" ? (
                    <span className="pattern-color-block pattern-color-block--restore">
                        <RestoreColorIcon />
                    </span>
                ) : selection.kind === "mark" ? (
                    <span className="pattern-color-block pattern-color-block--mark">
                        <MarkStarIcon />
                    </span>
                ) : (
                    selectedColor && (
                        <span
                            className="pattern-color-block"
                            style={{ background: rgbToCss(selectedColor) }}
                        />
                    )
                )}
                <ChevronDownIcon />
            </button>

            {open && (
                <ul
                    className="pattern-color-menu"
                    role="listbox"
                    aria-label={
                        mode === "editing"
                            ? "Колір з палітри"
                            : "Інструмент відміток"
                    }
                >
                    {mode === "editing"
                        ? palette.map((color, index) => (
                              <li key={index} role="presentation">
                                  <button
                                      type="button"
                                      role="option"
                                      aria-selected={
                                          isPaletteSelected &&
                                          selection.index === index
                                      }
                                      aria-label={`Колір ${index + 1}`}
                                      className={`pattern-color-option${isPaletteSelected && selection.index === index ? " active" : ""}`}
                                      style={{ background: rgbToCss(color) }}
                                      onClick={() =>
                                          pick({ kind: "palette", index })
                                      }
                                  />
                              </li>
                          ))
                        : (
                              <>
                                  <li role="presentation">
                                      <button
                                          type="button"
                                          role="option"
                                          aria-selected={
                                              selection.kind === "restore"
                                          }
                                          aria-label="Відновлення кольору"
                                          title="Відновлення кольору"
                                          className={`pattern-color-option pattern-color-option--restore${selection.kind === "restore" ? " active" : ""}`}
                                          onClick={() =>
                                              pick({ kind: "restore" })
                                          }
                                      >
                                          <RestoreColorIcon />
                                      </button>
                                  </li>
                                  <li role="presentation">
                                      <button
                                          type="button"
                                          role="option"
                                          aria-selected={
                                              selection.kind === "mark"
                                          }
                                          aria-label="Відмітка"
                                          title="Відмітка"
                                          className={`pattern-color-option pattern-color-option--mark${selection.kind === "mark" ? " active" : ""}`}
                                          onClick={() =>
                                              pick({ kind: "mark" })
                                          }
                                      >
                                          <MarkStarIcon />
                                      </button>
                                  </li>
                              </>
                          )}
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

type PatternSchemeSizePopoverProps = PatternSchemeSizeControlsProps;

function PatternSchemeSizePopover({
    schemeSize,
    minSchemeSize,
    onChange,
}: PatternSchemeSizePopoverProps) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        const onDocumentMouseDown = (event: MouseEvent) => {
            if (!anchorRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", onDocumentMouseDown);
        return () =>
            document.removeEventListener("mousedown", onDocumentMouseDown);
    }, [open]);

    return (
        <div
            ref={anchorRef}
            className={`pattern-scheme-size-anchor${open ? " open" : ""}`}
        >
            <button
                type="button"
                className="pattern-tool-btn"
                title="Розмір схеми"
                aria-label="Розмір схеми"
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen((value) => !value)}
            >
                <SchemeSizeIcon />
            </button>

            {open && (
                <div
                    className="pattern-scheme-size-popover"
                    role="dialog"
                    aria-label="Розмір схеми в бісеринках"
                >
                    <div className="pattern-scheme-size-popover-title">
                        Розмір схеми
                    </div>
                    <PatternSchemeSizeControls
                        schemeSize={schemeSize}
                        minSchemeSize={minSchemeSize}
                        onChange={onChange}
                    />
                </div>
            )}
        </div>
    );
}

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
        <div className="pattern-scheme-size">
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
    autoFitZoomKey,
    bitmap,
    cells,
    cellSizePx,
    patternPalette,
    previewZoom,
    onPreviewZoomChange,
    labelPaletteIndices,
    onLabelPaletteIndicesChange,
    gridLayout,
    canvasBackground,
    onCanvasBackgroundChange,
    onCellPaletteIndexChange,
    onCellEditStrokeEnd,
    onCellEditBatch,
    onRestoreCell,
    cellMarks,
    onSetCellMarked,
    onClearCellMark,
    onMarkEditBatch,
    onMarkEditStrokeEnd,
    baseCells,
    onUndoCellEdit,
    onRedoCellEdit,
    canUndoCellEdit,
    canRedoCellEdit,
    onUndoMarkEdit,
    onRedoMarkEdit,
    canUndoMarkEdit,
    canRedoMarkEdit,
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

    const [schemeMode, setSchemeMode] = useState<SchemeMode>("editing");
    const [editTool, setEditTool] = useState<EditTool>("pan");
    const [paintSelection, setPaintSelection] =
        useState<PatternPaintSelection>({ kind: "palette", index: 0 });
    const [isPanning, setIsPanning] = useState(false);

    const displayCells =
        schemeMode === "weaving"
            ? applyMarksToCells(cells, cellMarks)
            : cells;

    const canUndo =
        schemeMode === "weaving" ? canUndoMarkEdit : canUndoCellEdit;
    const canRedo =
        schemeMode === "weaving" ? canRedoMarkEdit : canRedoCellEdit;
    const onUndo = schemeMode === "weaving" ? onUndoMarkEdit : onUndoCellEdit;
    const onRedo = schemeMode === "weaving" ? onRedoMarkEdit : onRedoCellEdit;

    const lastAutoFitKeyRef = useRef(0);

    const fitPreviewToWindow = useCallback(() => {
        if (!bitmap || cells.length === 0) return;
        if (schemeSizeBeads.width <= 0 || schemeSizeBeads.height <= 0) return;

        const wrap = patternWrapRef.current;
        if (!wrap) return;

        const { clientWidth, clientHeight } = wrap;
        if (clientWidth <= 0 || clientHeight <= 0) return;

        onPreviewZoomChange(
            computeFitPreviewZoom(
                cells,
                cellSizePx,
                gridLayout,
                schemeSizeBeads,
                PREVIEW_PAD,
                clientWidth,
                clientHeight,
            ),
        );
        wrap.scrollLeft = 0;
        wrap.scrollTop = 0;
    }, [
        bitmap,
        cells,
        cellSizePx,
        gridLayout,
        schemeSizeBeads,
        onPreviewZoomChange,
    ]);

    useEffect(() => {
        if (autoFitZoomKey === 0) return;
        if (autoFitZoomKey === lastAutoFitKeyRef.current) return;

        fitPreviewToWindow();
        lastAutoFitKeyRef.current = autoFitZoomKey;
    }, [autoFitZoomKey, fitPreviewToWindow]);

    useEffect(() => {
        setPaintSelection((selection) => {
            if (selection.kind !== "palette") return selection;

            return {
                kind: "palette",
                index: Math.min(
                    selection.index,
                    Math.max(0, patternPalette.length - 1),
                ),
            };
        });
    }, [patternPalette.length]);

    useEffect(() => {
        setPaintSelection((selection) => {
            if (schemeMode === "editing") {
                if (selection.kind === "palette") return selection;

                return { kind: "palette", index: 0 };
            }

            if (selection.kind === "mark" || selection.kind === "restore") {
                return selection;
            }

            return { kind: "mark" };
        });
    }, [schemeMode]);

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

    const paintSnapshotRef = useRef<{
        layoutKey: string;
        paletteKey: string;
        cells: BrickCell[];
    }>({
        layoutKey: "",
        paletteKey: "",
        cells: [],
    });

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
            labelPaletteIndices,
            schemeSize: schemeSizeBeads,
        };

        const metrics = computeBrickLayout(
            displayCells,
            cellSizePx,
            previewZoom,
            PREVIEW_PAD,
            gridLayout,
            schemeSizeBeads,
        );
        const canvasWidth = Math.max(1, Math.ceil(metrics.canvasWidth));
        const canvasHeight = Math.max(1, Math.ceil(metrics.canvasHeight));
        const layoutKey = [
            bitmap.width,
            bitmap.height,
            cellSizePx,
            previewZoom,
            gridLayout,
            canvasBackground,
            labelPaletteIndices,
            schemeSizeBeads.width,
            schemeSizeBeads.height,
            canvasWidth,
            canvasHeight,
        ].join(":");
        const paletteKey = patternPalette
            .map((color) => `${color.r},${color.g},${color.b}`)
            .join("|");

        const snapshot = paintSnapshotRef.current;
        const needsFullRepaint =
            snapshot.layoutKey !== layoutKey ||
            snapshot.paletteKey !== paletteKey ||
            snapshot.cells.length === 0 ||
            canvas.width !== canvasWidth ||
            canvas.height !== canvasHeight;

        if (needsFullRepaint) {
            paintBrickPreview(
                ctx,
                displayCells,
                cellSizePx,
                patternPalette,
                options,
            );
            paintSnapshotRef.current = {
                layoutKey,
                paletteKey,
                cells: displayCells,
            };
            return;
        }

        const changes = findChangedBrickCells(snapshot.cells, displayCells);

        if (changes.length === 0) {
            paintSnapshotRef.current = {
                layoutKey,
                paletteKey,
                cells: displayCells,
            };
            return;
        }

        const incrementalLimit = Math.min(
            2048,
            Math.ceil(snapshot.cells.length * 0.2),
        );

        if (changes.length > incrementalLimit) {
            paintBrickPreview(
                ctx,
                displayCells,
                cellSizePx,
                patternPalette,
                options,
            );
            paintSnapshotRef.current = {
                layoutKey,
                paletteKey,
                cells: displayCells,
            };
            return;
        }

        applyBrickCellChanges(
            ctx,
            changes,
            patternPalette,
            metrics,
            canvasBackground,
            canvasWidth,
            canvasHeight,
            {
                labelPaletteIndices,
                strokeWidth: Math.max(0.5, previewZoom * 0.35),
            },
        );
        paintSnapshotRef.current = {
            layoutKey,
            paletteKey,
            cells: displayCells,
        };
    }, [
        bitmap,
        displayCells,
        cellSizePx,
        patternPalette,
        previewZoom,
        labelPaletteIndices,
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

            if (schemeMode === "weaving") {
                if (editTool === "fill") {
                    if (paintSelection.kind === "restore") {
                        onMarkEditBatch(
                            floodFillUnmarkChanges(
                                cells,
                                cellMarks,
                                schemeSizeBeads,
                                gridLayout,
                                cell.row,
                                cell.col,
                            ),
                        );
                    } else {
                        onMarkEditBatch(
                            floodFillMarkChanges(
                                cells,
                                cellMarks,
                                schemeSizeBeads,
                                gridLayout,
                                cell.row,
                                cell.col,
                            ),
                        );
                    }

                    return;
                }

                if (editTool === "pencil") {
                    if (paintSelection.kind === "restore") {
                        onClearCellMark(cell.row, cell.col, { stroke: true });
                    } else {
                        onSetCellMarked(cell.row, cell.col, true, {
                            stroke: true,
                        });
                    }
                } else if (editTool === "eraser") {
                    onClearCellMark(cell.row, cell.col, { stroke: true });
                }

                return;
            }

            if (editTool === "fill") {
                if (paintSelection.kind === "restore") {
                    onCellEditBatch(
                        floodFillRestoreChanges(
                            cells,
                            baseCells,
                            schemeSizeBeads,
                            gridLayout,
                            cell.row,
                            cell.col,
                        ),
                    );
                } else if (paintSelection.kind === "palette") {
                    onCellEditBatch(
                        floodFillChanges(
                            cells,
                            schemeSizeBeads,
                            gridLayout,
                            cell.row,
                            cell.col,
                            paintSelection.index,
                        ),
                    );
                }

                return;
            }

            if (editTool === "pencil") {
                if (paintSelection.kind === "palette") {
                    onCellPaletteIndexChange(
                        cell.row,
                        cell.col,
                        paintSelection.index,
                        { stroke: true },
                    );
                }
            } else {
                onCellPaletteIndexChange(cell.row, cell.col, -1, {
                    stroke: true,
                });
            }
        },
        [
            baseCells,
            cellMarks,
            cells,
            cellSizePx,
            editTool,
            gridLayout,
            onCellPaletteIndexChange,
            onCellEditBatch,
            onClearCellMark,
            onMarkEditBatch,
            onRestoreCell,
            onSetCellMarked,
            paintSelection,
            previewZoom,
            schemeMode,
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
                if (schemeMode === "weaving") {
                    onMarkEditStrokeEnd();
                } else {
                    onCellEditStrokeEnd();
                }
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
    }, [applyToolAt, onCellEditStrokeEnd, onMarkEditStrokeEnd, schemeMode]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;

            const key = event.key.toLowerCase();
            if (key === "z" && !event.shiftKey) {
                if (!canUndo) return;
                event.preventDefault();
                onUndo();
            } else if (key === "y" || (key === "z" && event.shiftKey)) {
                if (!canRedo) return;
                event.preventDefault();
                onRedo();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [canUndo, canRedo, onUndo, onRedo]);

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
            <div className="preview-scheme-header">
                <h2>Схема</h2>

                {bitmap && patternPalette.length > 0 ? (
                    <div
                        className="pattern-mode-toggle"
                        role="group"
                        aria-label="Режим схеми"
                    >
                        <label className="pattern-mode-option">
                            <input
                                type="radio"
                                name="schemeMode"
                                checked={schemeMode === "editing"}
                                onChange={() => setSchemeMode("editing")}
                            />
                            Редагування
                        </label>
                        <label className="pattern-mode-option">
                            <input
                                type="radio"
                                name="schemeMode"
                                checked={schemeMode === "weaving"}
                                onChange={() => setSchemeMode("weaving")}
                            />
                            Плетіння
                        </label>
                    </div>
                ) : null}
            </div>

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
                            disabled={!canUndo}
                            onClick={onUndo}
                        >
                            <UndoIcon />
                        </button>
                        <button
                            type="button"
                            className="pattern-tool-btn"
                            title="Повтор"
                            aria-label="Повтор"
                            disabled={!canRedo}
                            onClick={onRedo}
                        >
                            <RedoIcon />
                        </button>
                    </div>

                    <PatternColorCombobox
                        mode={schemeMode}
                        palette={patternPalette}
                        selection={paintSelection}
                        onSelect={setPaintSelection}
                    />

                    <PatternCanvasBackgroundMenu
                        value={canvasBackground}
                        onChange={onCanvasBackgroundChange}
                    />

                    <button
                        type="button"
                        className={`pattern-tool-btn${labelPaletteIndices ? " active" : ""}`}
                        aria-pressed={labelPaletteIndices}
                        title={
                            labelPaletteIndices
                                ? "Приховати номери кольорів на схемі"
                                : "Показати номери кольорів на схемі"
                        }
                        aria-label={
                            labelPaletteIndices
                                ? "Приховати номери кольорів на схемі"
                                : "Показати номери кольорів на схемі"
                        }
                        onClick={() =>
                            onLabelPaletteIndicesChange(!labelPaletteIndices)
                        }
                    >
                        <PaletteLabelsIcon />
                    </button>

                    <div
                        className="pattern-preview-zoom"
                        title="Масштаб перегляду схеми"
                    >
                        <DeferredRangeSlider
                            variant="inline"
                            min={PREVIEW_ZOOM_MIN}
                            max={PREVIEW_ZOOM_MAX}
                            step={PREVIEW_ZOOM_STEP}
                            value={previewZoom}
                            onCommit={(value) => onPreviewZoomChange(value)}
                            aria-label="Масштаб перегляду схеми"
                            tooltip="Масштаб перегляду схеми"
                        />
                    </div>

                    <button
                        type="button"
                        className="pattern-tool-btn"
                        title="Вписати в вікно"
                        aria-label="Вписати в вікно"
                        onClick={fitPreviewToWindow}
                    >
                        <FitToWindowIcon />
                    </button>

                    {schemeMode === "editing" ? (
                        <PatternSchemeSizePopover
                            schemeSize={schemeSizeBeads}
                            minSchemeSize={minSchemeSizeBeads}
                            onChange={onSchemeSizeChange}
                        />
                    ) : null}
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
