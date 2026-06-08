import type { DragEventHandler, RefObject } from "react";
import { BackgroundColorField } from "./BackgroundColorField";
import { DeferredRangeSlider } from "./DeferredRangeSlider";
import type { BackgroundMode, GridLayout } from "../../beadMath";
import { PROJECT_FILE_EXTENSION } from "../../features/project/projectFile";

type SettingsPanelProps = {
    fileInputRef: RefObject<HTMLInputElement | null>;
    projectInputRef: RefObject<HTMLInputElement | null>;
    isUploadDragOver: boolean;
    onUploadDragOver: DragEventHandler<HTMLElement>;
    onUploadDragLeave: DragEventHandler<HTMLElement>;
    onUploadDrop: DragEventHandler<HTMLElement>;
    onFileSelect: (file: File | null) => void;
    onProjectSelect: (file: File | null) => void;
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
    onResetPattern: () => void;
    canExport: boolean;
    canSaveProject: boolean;
    onExport: () => void;
    onSaveProject: () => void;
};

export function SettingsPanel({
    fileInputRef,
    projectInputRef,
    isUploadDragOver,
    onUploadDragOver,
    onUploadDragLeave,
    onUploadDrop,
    onFileSelect,
    onProjectSelect,
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
    onResetPattern,
    canExport,
    canSaveProject,
    onExport,
    onSaveProject,
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

            <DeferredRangeSlider
                min={2}
                max={50}
                value={paletteSize}
                onCommit={onPaletteSizeChange}
                title="Кількість кольорів у палітрі"
                showNumberInput
                aria-label="Кількість кольорів у палітрі"
            />

            <DeferredRangeSlider
                min={2}
                max={400}
                value={beadsPerRow}
                onCommit={onBeadsPerRowChange}
                title="Кількість бісеринок у ряду"
                showNumberInput
                aria-label="Кількість бісеринок у ряду"
            />

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

            <button
                type="button"
                className="recalculate-button"
                onClick={onResetPattern}
            >
                Скинути
            </button>

            <div className="project-actions">
                <button
                    type="button"
                    className="project-button"
                    disabled={!canSaveProject}
                    onClick={onSaveProject}
                >
                    Зберегти
                </button>
                <input
                    ref={projectInputRef}
                    className="upload-input-hidden"
                    type="file"
                    accept={`.${PROJECT_FILE_EXTENSION},application/json`}
                    onChange={(event) => {
                        onProjectSelect(event.target.files?.[0] ?? null);
                        event.target.value = "";
                    }}
                />
                <button
                    type="button"
                    className="project-button"
                    onClick={() => projectInputRef.current?.click()}
                >
                    Завантажити
                </button>
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
