import type { DragEventHandler, RefObject } from "react";
import { type PreparedBeadCatalog } from "../../beadCatalog";
import { BackgroundColorField } from "./BackgroundColorField";
import type { BackgroundMode, GridLayout } from "../../beadMath";
import type { CanvasBackground } from "../../features/preview/canvasUtils";
import {
    PREVIEW_ZOOM_MAX,
    PREVIEW_ZOOM_MIN,
    PREVIEW_ZOOM_STEP,
} from "../../features/preview/previewZoom";

type SettingsPanelProps = {
    fileInputRef: RefObject<HTMLInputElement | null>;
    isUploadDragOver: boolean;
    onUploadDragOver: DragEventHandler<HTMLElement>;
    onUploadDragLeave: DragEventHandler<HTMLElement>;
    onUploadDrop: DragEventHandler<HTMLElement>;
    onFileSelect: (file: File | null) => void;
    paletteSize: number;
    onPaletteSizeChange: (value: number) => void;
    beadsPerRow: number;
    onBeadsPerRowChange: (value: number) => void;
    gridLayout: GridLayout;
    onGridLayoutChange: (value: GridLayout) => void;
    backgroundMode: BackgroundMode;
    onBackgroundModeChange: (value: BackgroundMode) => void;
    backgroundHex: string;
    onBackgroundHexChange: (value: string) => void;
    catalogs: PreparedBeadCatalog[];
    beadCatalog: PreparedBeadCatalog;
    onBeadCatalogChange: (value: string) => void;
    useManufacturerPalette: boolean;
    onUseManufacturerPaletteChange: (value: boolean) => void;
    previewZoom: number;
    onPreviewZoomChange: (value: number) => void;
    canvasBackground: CanvasBackground;
    onCanvasBackgroundChange: (value: CanvasBackground) => void;
    beadCount: number;
    totalCells: number;
    canExport: boolean;
    onExport: () => void;
};

export function SettingsPanel({
    fileInputRef,
    isUploadDragOver,
    onUploadDragOver,
    onUploadDragLeave,
    onUploadDrop,
    onFileSelect,
    paletteSize,
    onPaletteSizeChange,
    beadsPerRow,
    onBeadsPerRowChange,
    gridLayout,
    onGridLayoutChange,
    backgroundMode,
    onBackgroundModeChange,
    backgroundHex,
    onBackgroundHexChange,
    catalogs,
    beadCatalog,
    onBeadCatalogChange,
    useManufacturerPalette,
    onUseManufacturerPaletteChange,
    previewZoom,
    onPreviewZoomChange,
    canvasBackground,
    onCanvasBackgroundChange,
    beadCount,
    totalCells,
    canExport,
    onExport,
}: SettingsPanelProps) {
    return (
        <aside className="panel">
            <label
                className={`field upload-field ${isUploadDragOver ? "drag-over" : ""}`}
                onDragOver={onUploadDragOver}
                onDragLeave={onUploadDragLeave}
                onDrop={onUploadDrop}
            >
                <span className="label">Зображення</span>
                <input
                    ref={fileInputRef}
                    className="upload-input-hidden"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                        onFileSelect(event.target.files?.[0] ?? null)
                    }
                />
                <input
                    type="button"
                    className="upload-button"
                    value="Обрати зображення"
                    onClick={() => fileInputRef.current?.click()}
                />
            </label>

            <label className="field">
                <span className="label">
                    Кількість кольорів у палітрі: <strong>{paletteSize}</strong>
                </span>
                <input
                    type="range"
                    min={2}
                    max={50}
                    value={paletteSize}
                    onChange={(event) =>
                        onPaletteSizeChange(
                            Number.parseInt(event.target.value, 10),
                        )
                    }
                />
            </label>

            <label className="field">
                <span className="label">
                    Кількість бісеринок у ряду: <strong>{beadsPerRow}</strong>
                </span>
                <input
                    type="range"
                    min={2}
                    max={400}
                    value={beadsPerRow}
                    onChange={(event) =>
                        onBeadsPerRowChange(
                            Number.parseInt(event.target.value, 10),
                        )
                    }
                />
            </label>

            <div className="field">
                <span className="label">Тип сітки схеми</span>
                <div className="layout-toggle">
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="gridLayout"
                            checked={gridLayout === "brick"}
                            onChange={() => onGridLayoutChange("brick")}
                        />
                        Цегла
                    </label>
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="gridLayout"
                            checked={gridLayout === "straight"}
                            onChange={() => onGridLayoutChange("straight")}
                        />
                        Пряма
                    </label>
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="gridLayout"
                            checked={gridLayout === "lace"}
                            onChange={() => onGridLayoutChange("lace")}
                        />
                        Ажурна
                    </label>
                </div>
            </div>

            <div className="field">
                <span className="label">Фон</span>
                <div className="layout-toggle">
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="imageBackground"
                            checked={backgroundMode === "transparent"}
                            onChange={() =>
                                onBackgroundModeChange("transparent")
                            }
                        />
                        Прозорий
                    </label>
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="imageBackground"
                            checked={backgroundMode === "color"}
                            onChange={() => onBackgroundModeChange("color")}
                        />
                        Колір
                    </label>
                </div>
            </div>

            {backgroundMode === "color" ? (
                <label className="field">
                    <span className="label">Колір фону</span>
                    <BackgroundColorField
                        value={backgroundHex}
                        onCommit={onBackgroundHexChange}
                    />
                </label>
            ) : null}

            <label className="field">
                <span className="label">Виробник</span>
                <select
                    className="select-catalog"
                    value={beadCatalog.id}
                    onChange={(event) =>
                        onBeadCatalogChange(event.target.value)
                    }
                >
                    {catalogs.map((catalog) => (
                        <option key={catalog.id} value={catalog.id}>
                            {catalog.label}
                        </option>
                    ))}
                </select>
                {beadCatalog.approximateColors ? null : (
                    <span className="catalog-hint">
                        RGB з відкритого CSV у{" "}
                        <a
                            href={beadCatalog.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            beadcolors
                        </a>
                        .
                    </span>
                )}
            </label>

            <label className="field checkbox">
                <input
                    type="checkbox"
                    checked={useManufacturerPalette}
                    onChange={(event) =>
                        onUseManufacturerPaletteChange(event.target.checked)
                    }
                />
                <span>В палітрі виробника</span>
            </label>

            <div className="field">
                <span className="label">Фон канвасу схеми</span>
                <div className="layout-toggle">
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="canvasBackground"
                            checked={canvasBackground === "checkerboard"}
                            onChange={() =>
                                onCanvasBackgroundChange("checkerboard")
                            }
                        />
                        Шахматка
                    </label>
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="canvasBackground"
                            checked={canvasBackground === "white"}
                            onChange={() => onCanvasBackgroundChange("white")}
                        />
                        Білий
                    </label>
                    <label className="layout-option">
                        <input
                            type="radio"
                            name="canvasBackground"
                            checked={canvasBackground === "black"}
                            onChange={() => onCanvasBackgroundChange("black")}
                        />
                        Чорний
                    </label>
                </div>
            </div>

            <label className="field">
                <span className="label">
                    Масштаб перегляду схеми:{" "}
                    <strong>
                        {previewZoom < 1
                            ? previewZoom.toFixed(2)
                            : previewZoom.toFixed(1)}
                        ×
                    </strong>
                </span>
                <input
                    type="range"
                    min={PREVIEW_ZOOM_MIN}
                    max={PREVIEW_ZOOM_MAX}
                    step={PREVIEW_ZOOM_STEP}
                    value={previewZoom}
                    onChange={(event) =>
                        onPreviewZoomChange(
                            Number.parseFloat(event.target.value),
                        )
                    }
                />
            </label>

            <div className="stats">
                <div>
                    Бісеринок на схемі: <strong>{beadCount}</strong>
                </div>
                <div>
                    Клітинок (разом із фоном): <strong>{totalCells}</strong>
                </div>
            </div>

            <button
                type="button"
                className="export-button"
                disabled={!canExport}
                onClick={onExport}
            >
                Експорт
            </button>
        </aside>
    );
}
