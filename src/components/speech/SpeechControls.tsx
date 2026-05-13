type SpeechControlsProps = {
    hasPattern: boolean;
    isSpeaking: boolean;
    speechSupported: boolean;
    onToggleSpeech: () => void;
    speechPauseMs: number;
    onSpeechPauseMsChange: (value: number) => void;
    speechAutoPause: boolean;
    onSpeechAutoPauseChange: (value: boolean) => void;
    currentSpeechStatusText: string;
};

export function SpeechToggleControls({
    hasPattern,
    isSpeaking,
    speechSupported,
    onToggleSpeech,
}: Pick<
    SpeechControlsProps,
    "hasPattern" | "isSpeaking" | "speechSupported" | "onToggleSpeech"
>) {
    if (!hasPattern) return null;

    return (
        <div className="speech-controls">
            <button
                type="button"
                className="speech-toggle"
                onClick={onToggleSpeech}
                disabled={!speechSupported}
            >
                {isSpeaking ? "Стоп" : "Старт"}
            </button>
            <span className="speech-shortcut">Space</span>
        </div>
    );
}

export function SpeechSettingsPanel({
    hasPattern,
    speechPauseMs,
    onSpeechPauseMsChange,
    speechAutoPause,
    onSpeechAutoPauseChange,
    currentSpeechStatusText,
    speechSupported,
}: Pick<
    SpeechControlsProps,
    | "hasPattern"
    | "speechPauseMs"
    | "onSpeechPauseMsChange"
    | "speechAutoPause"
    | "onSpeechAutoPauseChange"
    | "currentSpeechStatusText"
    | "speechSupported"
>) {
    if (!hasPattern) return null;

    return (
        <div className="speech-panel">
            <label className="field speech-field">
                <span className="label">
                    Пауза між фразами:{" "}
                    <strong>{(speechPauseMs / 1000).toFixed(1)} с</strong>
                </span>
                <input
                    type="range"
                    min={0}
                    max={4}
                    step={0.1}
                    value={speechPauseMs / 1000}
                    onChange={(event) =>
                        onSpeechPauseMsChange(
                            Math.round(
                                Number.parseFloat(event.target.value) * 1000,
                            ),
                        )
                    }
                />
            </label>

            <label className="field checkbox speech-checkbox">
                <input
                    type="checkbox"
                    checked={speechAutoPause}
                    onChange={(event) =>
                        onSpeechAutoPauseChange(event.target.checked)
                    }
                />
                <span>
                    <span className="label">Автоматична пауза</span>
                </span>
            </label>

            <p className="speech-status">{currentSpeechStatusText}</p>

            {!speechSupported && (
                <p className="speech-hint speech-error">
                    У цьому браузері озвучення недоступне.
                </p>
            )}
        </div>
    );
}
