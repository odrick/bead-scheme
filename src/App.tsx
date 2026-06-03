import "./App.css";
import { BEAD_CATALOGS } from "./beadCatalog";
import { SettingsPanel } from "./components/controls/SettingsPanel";
import { PaletteSection } from "./components/palette/PaletteSection";
import { OriginalImagePreview } from "./components/preview/OriginalImagePreview";
import { PatternPreview } from "./components/preview/PatternPreview";
import { useImageUpload } from "./features/image/useImageUpload";
import { usePatternModel } from "./features/pattern/usePatternModel";

export default function App() {
    const imageUpload = useImageUpload();
    const patternModel = usePatternModel(imageUpload.bitmap);

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
                        backgroundHex={patternModel.backgroundHex}
                        onBackgroundHexChange={patternModel.setBackgroundHex}
                        ignoreBackground={patternModel.ignoreBackground}
                        onIgnoreBackgroundChange={
                            patternModel.setIgnoreBackground
                        }
                        catalogs={BEAD_CATALOGS}
                        beadCatalog={patternModel.beadCatalog}
                        onBeadCatalogChange={patternModel.setBeadCatalogId}
                        useManufacturerPalette={
                            patternModel.useManufacturerPalette
                        }
                        onUseManufacturerPaletteChange={
                            patternModel.setUseManufacturerPalette
                        }
                        previewZoom={patternModel.previewZoom}
                        onPreviewZoomChange={patternModel.setPreviewZoom}
                        canvasBackground={patternModel.canvasBackground}
                        onCanvasBackgroundChange={
                            patternModel.setCanvasBackground
                        }
                        beadCount={patternModel.beadCount}
                        totalCells={patternModel.cells.length}
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
                    />
                </div>

                <PaletteSection
                    palette={patternModel.palette}
                    beadMatches={patternModel.beadMatches}
                />
            </div>
        </div>
    );
}
