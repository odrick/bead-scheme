import { useEffect, useRef } from "react";
import type { BrickCell, GridLayout, RGB } from "../../beadMath";
import {
    paintBrickPreview,
    type PaintBrickPreviewOptions,
} from "../../features/preview/canvasUtils";
import type { SpeechHighlight } from "../../features/speech/speechSequence";
import {
    SpeechSettingsPanel,
    SpeechToggleControls,
} from "../speech/SpeechControls";

type PatternPreviewProps = {
    bitmap: HTMLImageElement | null;
    hasPattern: boolean;
    cells: BrickCell[];
    cellSizePx: number;
    patternPalette: RGB[];
    ignoreBackground: boolean;
    previewZoom: number;
    gridLayout: GridLayout;
    activeSpeechHighlight: SpeechHighlight | null;
    isSpeaking: boolean;
    speechSupported: boolean;
    toggleSpeech: () => void;
    speechPauseMs: number;
    setSpeechPauseMs: (value: number) => void;
    speechAutoPause: boolean;
    setSpeechAutoPause: (value: boolean) => void;
    currentSpeechStatusText: string;
};

export function PatternPreview({
    bitmap,
    hasPattern,
    cells,
    cellSizePx,
    patternPalette,
    ignoreBackground,
    previewZoom,
    gridLayout,
    activeSpeechHighlight,
    isSpeaking,
    speechSupported,
    toggleSpeech,
    speechPauseMs,
    setSpeechPauseMs,
    speechAutoPause,
    setSpeechAutoPause,
    currentSpeechStatusText,
}: PatternPreviewProps) {
    const patternCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = patternCanvasRef.current;
        if (!canvas || !bitmap) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const options: PaintBrickPreviewOptions = {
            ignoreBackground,
            zoom: previewZoom,
            pad: 6,
            showEmptyAsTransparent: true,
            layout: gridLayout,
            activeHighlight: activeSpeechHighlight,
        };

        paintBrickPreview(ctx, cells, cellSizePx, patternPalette, options);
    }, [
        bitmap,
        cells,
        cellSizePx,
        patternPalette,
        ignoreBackground,
        previewZoom,
        gridLayout,
        activeSpeechHighlight,
    ]);

    return (
        <section className="preview-block preview-scheme">
            <div className="preview-header">
                <h2>Схема</h2>
                <SpeechToggleControls
                    hasPattern={hasPattern}
                    isSpeaking={isSpeaking}
                    speechSupported={speechSupported}
                    onToggleSpeech={toggleSpeech}
                />
            </div>

            <SpeechSettingsPanel
                hasPattern={hasPattern}
                speechPauseMs={speechPauseMs}
                onSpeechPauseMsChange={setSpeechPauseMs}
                speechAutoPause={speechAutoPause}
                onSpeechAutoPauseChange={setSpeechAutoPause}
                currentSpeechStatusText={currentSpeechStatusText}
                speechSupported={speechSupported}
            />

            <div className="pattern-wrap">
                <canvas ref={patternCanvasRef} className="pattern" />
            </div>
        </section>
    );
}
