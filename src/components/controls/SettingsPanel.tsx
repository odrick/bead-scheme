import type { DragEventHandler, RefObject } from "react";
import { type PreparedBeadCatalog } from "../../beadCatalog";
import type { GridLayout } from "../../beadMath";

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
    backgroundHex: string;
    onBackgroundHexChange: (value: string) => void;
    ignoreBackground: boolean;
    onIgnoreBackgroundChange: (value: boolean) => void;
    catalogs: PreparedBeadCatalog[];
    beadCatalog: PreparedBeadCatalog;
    onBeadCatalogChange: (value: string) => void;
    useManufacturerPalette: boolean;
    onUseManufacturerPaletteChange: (value: boolean) => void;
    previewZoom: number;
    onPreviewZoomChange: (value: number) => void;
    beadCount: number;
    totalCells: number;
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
    backgroundHex,
    onBackgroundHexChange,
    ignoreBackground,
    onIgnoreBackgroundChange,
    catalogs,
    beadCatalog,
    onBeadCatalogChange,
    useManufacturerPalette,
    onUseManufacturerPaletteChange,
    previewZoom,
    onPreviewZoomChange,
    beadCount,
    totalCells,
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
                </div>
            </div>

            <label className="field">
                <span className="label">Колір фону (для виключення)</span>
                <input
                    type="color"
                    value={backgroundHex}
                    onChange={(event) =>
                        onBackgroundHexChange(event.target.value)
                    }
                />
            </label>

            <label className="field checkbox">
                <input
                    type="checkbox"
                    checked={ignoreBackground}
                    onChange={(event) =>
                        onIgnoreBackgroundChange(event.target.checked)
                    }
                />
                <span>Не враховувати фон</span>
            </label>

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
                    min={0.01}
                    max={3}
                    step={0.05}
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
        </aside>
    );
}
