import { useCallback, useState } from "react";
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

export default function App() {
    const imageUpload = useImageUpload();
    const patternModel = usePatternModel(imageUpload.bitmap);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);

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
                schemeSize:
                    patternModel.gridLayout === "lace"
                        ? undefined
                        : patternModel.schemeSizeBeads,
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
                        isUploadDragOver={imageUpload.isUploadDragOver}
                        onUploadDragOver={imageUpload.onUploadDragOver}
                        onUploadDragLeave={imageUpload.onUploadDragLeave}
                        onUploadDrop={imageUpload.onDropFile}
                        onFileSelect={imageUpload.onFile}
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
                        onExport={() => setExportDialogOpen(true)}
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
