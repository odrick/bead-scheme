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
    readOnly?: boolean;
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
    readOnly = false,
}: SettingsPanelProps) {
    return (
        <aside className="panel">
            <fieldset className="panel-editing-fields" disabled={readOnly}>
                <label
                    className={`field upload-field ${!readOnly && isUploadDragOver ? "drag-over" : ""}`}
                    onDragOver={readOnly ? undefined : onUploadDragOver}
                    onDragLeave={readOnly ? undefined : onUploadDragLeave}
                    onDrop={readOnly ? undefined : onUploadDrop}
                >
                    <span className="label">Зображення</span>
                    <input
                        ref={fileInputRef}
                        className="upload-input-hidden"
                        type="file"
                        accept="image/*"
                        disabled={readOnly}
                        onChange={(event) =>
                            onFileSelect(event.target.files?.[0] ?? null)
                        }
                    />
                    <input
                        type="button"
                        className="upload-button"
                        value="Обрати зображення"
                        disabled={readOnly}
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
                    disabled={readOnly}
                    aria-label="Кількість кольорів у палітрі"
                />

                <DeferredRangeSlider
                    min={2}
                    max={400}
                    value={beadsPerRow}
                    onCommit={onBeadsPerRowChange}
                    title="Кількість бісеринок у ряду"
                    showNumberInput
                    disabled={readOnly}
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
                                disabled={readOnly}
                                onChange={() => onGridLayoutChange("brick")}
                            />
                            Цегла
                        </label>
                        <label className="layout-option">
                            <input
                                type="radio"
                                name="gridLayout"
                                checked={gridLayout === "straight"}
                                disabled={readOnly}
                                onChange={() => onGridLayoutChange("straight")}
                            />
                            Пряма
                        </label>
                        <label className="layout-option">
                            <input
                                type="radio"
                                name="gridLayout"
                                checked={gridLayout === "lace"}
                                disabled={readOnly}
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
                                disabled={readOnly}
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
                                disabled={readOnly}
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
                            disabled={readOnly}
                        />
                    </label>
                ) : null}

                <button
                    type="button"
                    className="recalculate-button"
                    disabled={readOnly}
                    onClick={onResetPattern}
                >
                    Скинути
                </button>
            </fieldset>

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
                    disabled={readOnly}
                    onChange={(event) => {
                        onProjectSelect(event.target.files?.[0] ?? null);
                        event.target.value = "";
                    }}
                />
                <button
                    type="button"
                    className="project-button"
                    disabled={readOnly}
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
