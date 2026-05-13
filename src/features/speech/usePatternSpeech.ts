import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrickCell } from "../../beadMath";
import {
    buildSpeechSequence,
    type SpeechHighlight,
    type SpeechStep,
} from "./speechSequence";
import { pluralizeUa } from "./speechText";

type UsePatternSpeechArgs = {
    cells: BrickCell[];
    hasPattern: boolean;
};

type PatternSpeechState = {
    speechPauseMs: number;
    setSpeechPauseMs: (value: number) => void;
    speechAutoPause: boolean;
    setSpeechAutoPause: (value: boolean) => void;
    speechSupported: boolean;
    isSpeaking: boolean;
    isSpeechPaused: boolean;
    currentSpeechStatusText: string;
    activeSpeechHighlight: SpeechHighlight | null;
    toggleSpeech: () => void;
};

export function usePatternSpeech({
    cells,
    hasPattern,
}: UsePatternSpeechArgs): PatternSpeechState {
    const [speechPauseMs, setSpeechPauseMs] = useState(900);
    const [speechAutoPause, setSpeechAutoPause] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isSpeechPaused, setIsSpeechPaused] = useState(false);
    const [activeSpeechStepIndex, setActiveSpeechStepIndex] = useState<
        number | null
    >(null);
    const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>(
        [],
    );
    const speechTokenRef = useRef(0);
    const speechPauseTimeoutRef = useRef<number | null>(null);
    const speechPauseMsRef = useRef(speechPauseMs);
    const speechAutoPauseRef = useRef(speechAutoPause);
    const speechNextStepIndexRef = useRef(0);
    const speechPauseAfterCurrentRef = useRef(false);
    const prevSpeechStepsRef = useRef<SpeechStep[] | null>(null);

    const speechSupported =
        typeof window !== "undefined" && "speechSynthesis" in window;
    const speechSteps = useMemo(() => buildSpeechSequence(cells), [cells]);
    const activeSpeechStep =
        activeSpeechStepIndex === null
            ? null
            : (speechSteps[activeSpeechStepIndex] ?? null);
    const activeSpeechHighlight =
        activeSpeechStepIndex === null
            ? null
            : (speechSteps[activeSpeechStepIndex]?.highlight ?? null);
    const currentSpeechStatusText = useMemo(() => {
        if (!activeSpeechStep) {
            return isSpeechPaused
                ? "Начитування на паузі."
                : "Начитування не запущене.";
        }

        if (activeSpeechStep.kind === "run") {
            const count = activeSpeechStep.count ?? 0;
            const paletteIndex = activeSpeechStep.paletteIndex ?? 0;
            const beadsText = `${count} ${pluralizeUa(
                count,
                "бісеринка",
                "бісеринки",
                "бісеринок",
            )}`;
            return `${beadsText} кольору ${paletteIndex + 1}.`;
        }

        if (activeSpeechStep.kind === "skip") {
            const count = activeSpeechStep.count ?? 0;
            const cellsText = `${count} ${pluralizeUa(
                count,
                "клітинка",
                "клітинки",
                "клітинок",
            )}`;
            return `Пропуск на ${cellsText}.`;
        }

        if (activeSpeechStep.kind === "row-finished") {
            return "Завершення ряду.";
        }

        return "Завершення схеми.";
    }, [activeSpeechStep, isSpeechPaused]);

    const preferredSpeechVoice = useMemo(() => {
        const englishVoices = speechVoices.filter((voice) =>
            voice.lang.toLowerCase().startsWith("en"),
        );

        return (
            englishVoices.find(
                (voice) => voice.lang.toLowerCase() === "en-us",
            ) ??
            englishVoices[0] ??
            null
        );
    }, [speechVoices]);

    useEffect(() => {
        speechPauseMsRef.current = speechPauseMs;
    }, [speechPauseMs]);

    useEffect(() => {
        speechAutoPauseRef.current = speechAutoPause;
    }, [speechAutoPause]);

    useEffect(() => {
        if (!speechSupported) return;

        const synth = window.speechSynthesis;
        const updateVoices = () => setSpeechVoices(synth.getVoices());

        updateVoices();
        synth.addEventListener("voiceschanged", updateVoices);
        return () => synth.removeEventListener("voiceschanged", updateVoices);
    }, [speechSupported]);

    const resetSpeech = useCallback(() => {
        speechTokenRef.current += 1;
        speechNextStepIndexRef.current = 0;
        speechPauseAfterCurrentRef.current = false;

        if (speechPauseTimeoutRef.current !== null) {
            window.clearTimeout(speechPauseTimeoutRef.current);
            speechPauseTimeoutRef.current = null;
        }

        if (speechSupported) {
            window.speechSynthesis.cancel();
        }

        setActiveSpeechStepIndex(null);
        setIsSpeechPaused(false);
        setIsSpeaking(false);
    }, [speechSupported]);

    const pauseSpeech = useCallback(() => {
        if (!isSpeaking) return;

        if (speechPauseTimeoutRef.current !== null) {
            window.clearTimeout(speechPauseTimeoutRef.current);
            speechPauseTimeoutRef.current = null;
            speechPauseAfterCurrentRef.current = false;

            if (speechNextStepIndexRef.current < speechSteps.length) {
                setIsSpeechPaused(true);
            } else {
                speechNextStepIndexRef.current = 0;
                setActiveSpeechStepIndex(null);
                setIsSpeechPaused(false);
            }

            setIsSpeaking(false);
            return;
        }

        speechPauseAfterCurrentRef.current = true;
    }, [isSpeaking, speechSteps.length]);

    const startSpeech = useCallback(() => {
        if (!speechSupported || speechSteps.length === 0) return;

        speechTokenRef.current += 1;
        speechPauseAfterCurrentRef.current = false;

        if (speechPauseTimeoutRef.current !== null) {
            window.clearTimeout(speechPauseTimeoutRef.current);
            speechPauseTimeoutRef.current = null;
        }

        window.speechSynthesis.cancel();

        const token = speechTokenRef.current;
        const synth = window.speechSynthesis;
        const voice =
            preferredSpeechVoice ??
            synth
                .getVoices()
                .find((candidate) =>
                    candidate.lang.toLowerCase().startsWith("en"),
                ) ??
            null;
        const resumeFromPaused =
            isSpeechPaused &&
            speechNextStepIndexRef.current < speechSteps.length;

        if (!resumeFromPaused) {
            speechNextStepIndexRef.current = 0;
            setActiveSpeechStepIndex(null);
        }

        const speakNext = () => {
            if (speechTokenRef.current !== token) return;

            const index = speechNextStepIndexRef.current;
            const step = speechSteps[index];
            if (!step) {
                speechNextStepIndexRef.current = 0;
                setActiveSpeechStepIndex(null);
                setIsSpeechPaused(false);
                setIsSpeaking(false);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(step.text);
            utterance.lang = voice?.lang ?? "en-US";
            utterance.rate = 1;
            utterance.pitch = 1;

            if (voice) {
                utterance.voice = voice;
            }

            utterance.onstart = () => {
                if (speechTokenRef.current !== token) return;
                setActiveSpeechStepIndex(index);
            };

            utterance.onend = () => {
                if (speechTokenRef.current !== token) return;

                const nextIndex = index + 1;
                speechNextStepIndexRef.current = nextIndex;

                if (speechPauseAfterCurrentRef.current) {
                    speechPauseAfterCurrentRef.current = false;
                    if (nextIndex < speechSteps.length) {
                        setIsSpeechPaused(true);
                        setIsSpeaking(false);
                        return;
                    }

                    speechNextStepIndexRef.current = 0;
                    setActiveSpeechStepIndex(null);
                    setIsSpeechPaused(false);
                    setIsSpeaking(false);
                    return;
                }

                if (nextIndex >= speechSteps.length) {
                    speechNextStepIndexRef.current = 0;
                    setActiveSpeechStepIndex(null);
                    setIsSpeechPaused(false);
                    setIsSpeaking(false);
                    return;
                }

                if (
                    speechAutoPauseRef.current &&
                    step.kind !== "row-finished"
                ) {
                    setIsSpeechPaused(true);
                    setIsSpeaking(false);
                    return;
                }

                const pauseMs = speechPauseMsRef.current;
                if (pauseMs <= 0) {
                    speakNext();
                    return;
                }

                speechPauseTimeoutRef.current = window.setTimeout(() => {
                    speechPauseTimeoutRef.current = null;
                    speakNext();
                }, pauseMs);
            };

            utterance.onerror = () => {
                if (speechTokenRef.current !== token) return;
                speechNextStepIndexRef.current = 0;
                speechPauseAfterCurrentRef.current = false;
                setActiveSpeechStepIndex(null);
                setIsSpeechPaused(false);
                setIsSpeaking(false);
            };

            synth.speak(utterance);
        };

        setIsSpeechPaused(false);
        setIsSpeaking(true);
        speakNext();
    }, [isSpeechPaused, preferredSpeechVoice, speechSteps, speechSupported]);

    const toggleSpeech = useCallback(() => {
        if (isSpeaking) {
            pauseSpeech();
            return;
        }

        startSpeech();
    }, [isSpeaking, pauseSpeech, startSpeech]);

    useEffect(() => resetSpeech, [resetSpeech]);

    useEffect(() => {
        if (
            prevSpeechStepsRef.current !== null &&
            prevSpeechStepsRef.current !== speechSteps
        ) {
            resetSpeech();
        }

        prevSpeechStepsRef.current = speechSteps;
    }, [speechSteps, resetSpeech]);

    useEffect(() => {
        if (!hasPattern) {
            resetSpeech();
        }
    }, [hasPattern, resetSpeech]);

    useEffect(() => {
        if (!hasPattern) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== "Space" || event.repeat) return;

            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName;
            if (
                target?.isContentEditable ||
                tagName === "INPUT" ||
                tagName === "TEXTAREA" ||
                tagName === "SELECT" ||
                tagName === "BUTTON"
            ) {
                return;
            }

            event.preventDefault();
            toggleSpeech();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [hasPattern, toggleSpeech]);

    return {
        speechPauseMs,
        setSpeechPauseMs,
        speechAutoPause,
        setSpeechAutoPause,
        speechSupported,
        isSpeaking,
        isSpeechPaused,
        currentSpeechStatusText,
        activeSpeechHighlight,
        toggleSpeech,
    };
}
