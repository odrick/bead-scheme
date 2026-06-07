import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { ExportDialog } from "./components/export/ExportDialog";
import { SettingsPanel } from "./components/controls/SettingsPanel";
import { PaletteSection } from "./components/palette/PaletteSection";
import { OriginalImagePreview } from "./components/preview/OriginalImagePreview";
import { PatternPreview } from "./components/preview/PatternPreview";
import {
    downloadCanvasAsPng,
    exportFilename,
    renderPatternExport,
} from "./features/export/exportPatternImage";
import { useImageUpload } from "./features/image/useImageUpload";
import { usePatternModel } from "./features/pattern/usePatternModel";
import {
    buildProjectFile,
    downloadProjectFile,
    encodeImageToBase64,
    projectImageToDataUrl,
    readProjectFile,
    type BeadSchemeProject,
} from "./features/project/projectFile";

export default function App() {
    const imageUpload = useImageUpload();
    const patternModel = usePatternModel(imageUpload.bitmap);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const projectInputRef = useRef<HTMLInputElement>(null);
    const pendingProjectRef = useRef<BeadSchemeProject | null>(null);

    useEffect(() => {
        const pending = pendingProjectRef.current;
        if (!pending || !imageUpload.bitmap) return;

        pendingProjectRef.current = null;
        patternModel.loadProject(pending);
    }, [imageUpload.bitmap, patternModel]);

    const handleSaveProject = useCallback(async () => {
        if (!imageUpload.bitmap) return;

        try {
            const data = patternModel.exportProjectData();
            if (!data) return;

            const image = await encodeImageToBase64(imageUpload.bitmap);
            downloadProjectFile(buildProjectFile(image, data));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Не вдалося записати проєкт.";
            window.alert(message);
        }
    }, [imageUpload.bitmap, patternModel]);

    const handleLoadProject = useCallback(
        async (file: File | null) => {
            if (!file) return;

            try {
                const project = await readProjectFile(file);
                pendingProjectRef.current = project;
                imageUpload.loadFromDataUrl(projectImageToDataUrl(project.image));
            } catch (error) {
                pendingProjectRef.current = null;
                const message =
                    error instanceof Error
                        ? error.message
                        : "Не вдалося завантажити проєкт.";
                window.alert(message);
            }
        },
        [imageUpload],
    );

    const handleExportConfirm = useCallback(
        (labelPaletteIndices: boolean) => {
            setExportDialogOpen(false);
            if (!patternModel.hasPattern) return;

            const canvas = renderPatternExport({
                cells: patternModel.cells,
                cellSizePx: patternModel.cellSizePx,
                patternPalette: patternModel.patternPalette,
                gridLayout: patternModel.gridLayout,
                canvasBackground: patternModel.canvasBackground,
                labelPaletteIndices,
                schemeSize: patternModel.schemeSizeBeads,
            });

            downloadCanvasAsPng(
                canvas,
                exportFilename(),
            );
        },
        [patternModel],
    );

    return (
        <div className="app">
            <div className="layout">
                <div className="top-row">
                    <SettingsPanel
                        fileInputRef={imageUpload.fileInputRef}
                        projectInputRef={projectInputRef}
                        isUploadDragOver={imageUpload.isUploadDragOver}
                        onUploadDragOver={imageUpload.onUploadDragOver}
                        onUploadDragLeave={imageUpload.onUploadDragLeave}
                        onUploadDrop={imageUpload.onDropFile}
                        onFileSelect={imageUpload.onFile}
                        onProjectSelect={handleLoadProject}
                        paletteSize={patternModel.paletteSize}
                        onPaletteSizeChange={patternModel.setPaletteSize}
                        beadsPerRow={patternModel.beadsPerRow}
                        onBeadsPerRowChange={patternModel.setBeadsPerRow}
                        gridLayout={patternModel.gridLayout}
                        onGridLayoutChange={patternModel.setGridLayout}
                        backgroundMode={patternModel.backgroundMode}
                        onBackgroundModeChange={
                            patternModel.setBackgroundMode
                        }
                        backgroundHex={patternModel.backgroundHex}
                        onBackgroundHexChange={patternModel.setBackgroundHex}
                        previewZoom={patternModel.previewZoom}
                        onPreviewZoomChange={patternModel.setPreviewZoom}
                        canvasBackground={patternModel.canvasBackground}
                        onCanvasBackgroundChange={
                            patternModel.setCanvasBackground
                        }
                        onResetPattern={patternModel.resetPattern}
                        beadCount={patternModel.beadCount}
                        totalCells={patternModel.cells.length}
                        canExport={
                            patternModel.hasPattern && !!imageUpload.bitmap
                        }
                        canSaveProject={!!imageUpload.bitmap}
                        onExport={() => setExportDialogOpen(true)}
                        onSaveProject={handleSaveProject}
                    />

                    <OriginalImagePreview
                        bitmap={imageUpload.bitmap}
                        isDragOver={imageUpload.isOriginalDragOver}
                        onDragOver={imageUpload.onOriginalDragOver}
                        onDragLeave={imageUpload.onOriginalDragLeave}
                        onDrop={imageUpload.onDropFile}
                    />

                    <PatternPreview
                        bitmap={imageUpload.bitmap}
                        cells={patternModel.cells}
                        cellSizePx={patternModel.cellSizePx}
                        patternPalette={patternModel.patternPalette}
                        previewZoom={patternModel.previewZoom}
                        onPreviewZoomChange={patternModel.setPreviewZoom}
                        gridLayout={patternModel.gridLayout}
                        canvasBackground={patternModel.canvasBackground}
                        onCellPaletteIndexChange={
                            patternModel.setCellPaletteIndex
                        }
                        onCellEditStrokeEnd={patternModel.endCellEditStroke}
                        onCellEditBatch={patternModel.applyCellEditBatch}
                        onUndoCellEdit={patternModel.undoCellEdit}
                        onRedoCellEdit={patternModel.redoCellEdit}
                        canUndoCellEdit={patternModel.canUndoCellEdit}
                        canRedoCellEdit={patternModel.canRedoCellEdit}
                        schemeSizeBeads={patternModel.schemeSizeBeads}
                        minSchemeSizeBeads={patternModel.imageGridSizeBeads}
                        onSchemeSizeChange={patternModel.setSchemeSizeBeads}
                    />
                </div>

                <PaletteSection
                    palette={patternModel.patternPalette}
                    beadCounts={patternModel.beadCountsByPalette}
                    onColorChange={patternModel.setPaletteColor}
                    onColorReset={patternModel.resetPaletteColor}
                />
            </div>

            <ExportDialog
                open={exportDialogOpen}
                onConfirm={handleExportConfirm}
                onCancel={() => setExportDialogOpen(false)}
            />
        </div>
    );
}
