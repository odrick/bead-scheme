import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { ExportDialog } from "./components/export/ExportDialog";
import { SettingsPanel } from "./components/controls/SettingsPanel";
import { RenderingOverlay } from "./components/overlay/RenderingOverlay";
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
import { usePatternRenderCommit } from "./features/pattern/usePatternRenderCommit";
import {
    buildProjectFile,
    downloadProjectFile,
    encodeImageToBase64,
    projectImageToDataUrl,
    readProjectFile,
    type BeadSchemeProject,
} from "./features/project/projectFile";
import { useProjectAutosave } from "./features/project/useProjectAutosave";

export default function App() {
    const imageUpload = useImageUpload();
    const patternModel = usePatternModel(imageUpload.bitmap);
    const { isRendering, commitWithRendering } = usePatternRenderCommit();
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [previewAutoFitKey, setPreviewAutoFitKey] = useState(0);
    const [pendingLoad, setPendingLoad] = useState<{
        project: BeadSchemeProject;
        imageUrl: string;
    } | null>(null);
    const projectInputRef = useRef<HTMLInputElement>(null);
    const skipBitmapAutoFitRef = useRef(false);

    const projectDataForAutosave = useMemo(
        () => patternModel.exportProjectData(),
        [patternModel.exportProjectData],
    );

    const schedulePendingLoad = useCallback(
        (project: BeadSchemeProject) => {
            const imageUrl = projectImageToDataUrl(project.image);
            skipBitmapAutoFitRef.current = true;
            imageUpload.loadFromDataUrl(imageUrl);
            setPendingLoad({ project, imageUrl });
        },
        [imageUpload],
    );

    useProjectAutosave({
        bitmap: imageUpload.bitmap,
        projectData: projectDataForAutosave,
        onRestore: schedulePendingLoad,
    });

    // Apply a pending project load once the correct bitmap is ready.
    // Using state (not a ref) for pendingLoad ensures the effect re-runs
    // even when the image URL hasn't changed (same image, different project data).
    useEffect(() => {
        if (!pendingLoad || !imageUpload.bitmap) return;
        if (imageUpload.bitmapUrl !== pendingLoad.imageUrl) return;

        setPendingLoad(null);
        patternModel.loadProject(pendingLoad.project);
        setPreviewAutoFitKey((key) => key + 1);
    }, [pendingLoad, imageUpload.bitmap, imageUpload.bitmapUrl, patternModel]);

    // Auto-fit zoom when a new image is uploaded (not when loading a saved project).
    useEffect(() => {
        if (!imageUpload.bitmap) return;

        if (skipBitmapAutoFitRef.current) {
            skipBitmapAutoFitRef.current = false;
            return;
        }

        setPreviewAutoFitKey((key) => key + 1);
    }, [imageUpload.bitmap]);

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
                schedulePendingLoad(project);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Не вдалося завантажити проєкт.";
                window.alert(message);
            }
        },
        [schedulePendingLoad],
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
                        onPaletteSizeChange={(value) =>
                            commitWithRendering(() =>
                                patternModel.setPaletteSize(value),
                            )
                        }
                        beadsPerRow={patternModel.beadsPerRow}
                        onBeadsPerRowChange={(value) =>
                            commitWithRendering(() =>
                                patternModel.setBeadsPerRow(value),
                            )
                        }
                        gridLayout={patternModel.gridLayout}
                        onGridLayoutChange={patternModel.setGridLayout}
                        backgroundMode={patternModel.backgroundMode}
                        onBackgroundModeChange={
                            patternModel.setBackgroundMode
                        }
                        backgroundHex={patternModel.backgroundHex}
                        onBackgroundHexChange={patternModel.setBackgroundHex}
                        previewZoom={patternModel.previewZoom}
                        onPreviewZoomChange={(value) =>
                            commitWithRendering(() =>
                                patternModel.setPreviewZoom(value),
                            )
                        }
                        labelPaletteIndices={patternModel.labelPaletteIndices}
                        onLabelPaletteIndicesChange={
                            patternModel.setLabelPaletteIndices
                        }
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
                        autoFitZoomKey={previewAutoFitKey}
                        bitmap={imageUpload.bitmap}
                        cells={patternModel.cells}
                        cellSizePx={patternModel.cellSizePx}
                        patternPalette={patternModel.patternPalette}
                        previewZoom={patternModel.previewZoom}
                        onPreviewZoomChange={patternModel.setPreviewZoom}
                        labelPaletteIndices={patternModel.labelPaletteIndices}
                        gridLayout={patternModel.gridLayout}
                        canvasBackground={patternModel.canvasBackground}
                        onCellPaletteIndexChange={
                            patternModel.setCellPaletteIndex
                        }
                        onCellEditStrokeEnd={patternModel.endCellEditStroke}
                        onCellEditBatch={patternModel.applyCellEditBatch}
                        onRestoreCell={patternModel.restoreCellAt}
                        baseCells={patternModel.baseCells}
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

            <RenderingOverlay open={isRendering} />
        </div>
    );
}
