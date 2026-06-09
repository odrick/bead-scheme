import { useCallback, useEffect, useRef, useState } from "react";
import {
    isEyedropperSupported,
    pickScreenColor,
} from "../../features/color/eyedropper";

const COMMIT_DEBOUNCE_MS = 180;

type BackgroundColorFieldProps = {
    value: string;
    onCommit: (hex: string) => void;
    disabled?: boolean;
};

export function BackgroundColorField({
    value,
    onCommit,
    disabled = false,
}: BackgroundColorFieldProps) {
    const [draftHex, setDraftHex] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const draftHexRef = useRef(value);
    const committedHexRef = useRef(value);
    const onCommitRef = useRef(onCommit);
    const commitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const eyedropperAvailable = isEyedropperSupported();

    onCommitRef.current = onCommit;
    committedHexRef.current = value;
    draftHexRef.current = draftHex;

    useEffect(() => {
        setDraftHex(value);
        draftHexRef.current = value;
    }, [value]);

    const commit = useCallback((hex: string) => {
        if (disabled) return;

        setDraftHex(hex);
        draftHexRef.current = hex;
        if (hex !== committedHexRef.current) {
            onCommitRef.current(hex);
        }
    }, [disabled]);

    const flushCommit = useCallback(() => {
        if (commitDebounceRef.current) {
            clearTimeout(commitDebounceRef.current);
            commitDebounceRef.current = null;
        }

        const hex = draftHexRef.current;
        if (hex !== committedHexRef.current) {
            commit(hex);
        }
    }, [commit]);

    const scheduleCommit = useCallback(() => {
        if (commitDebounceRef.current) {
            clearTimeout(commitDebounceRef.current);
        }

        commitDebounceRef.current = setTimeout(() => {
            commitDebounceRef.current = null;
            flushCommit();
        }, COMMIT_DEBOUNCE_MS);
    }, [flushCommit]);

    const applyDraft = useCallback(
        (hex: string) => {
            if (disabled) return;

            draftHexRef.current = hex;
            setDraftHex(hex);
            scheduleCommit();
        },
        [disabled, scheduleCommit],
    );

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        const onNativeInput = () => {
            applyDraft(input.value);
        };

        const onNativeChange = () => {
            applyDraft(input.value);
            flushCommit();
        };

        input.addEventListener("input", onNativeInput);
        input.addEventListener("change", onNativeChange);
        input.addEventListener("blur", flushCommit);

        const onRelease = () => {
            flushCommit();
        };

        document.addEventListener("pointerup", onRelease, true);
        document.addEventListener("mouseup", onRelease, true);
        window.addEventListener("focus", onRelease);

        return () => {
            input.removeEventListener("input", onNativeInput);
            input.removeEventListener("change", onNativeChange);
            input.removeEventListener("blur", flushCommit);
            document.removeEventListener("pointerup", onRelease, true);
            document.removeEventListener("mouseup", onRelease, true);
            window.removeEventListener("focus", onRelease);

            if (commitDebounceRef.current) {
                clearTimeout(commitDebounceRef.current);
            }
        };
    }, [applyDraft, flushCommit]);

    const handleEyedropper = useCallback(async () => {
        if (disabled) return;

        if (commitDebounceRef.current) {
            clearTimeout(commitDebounceRef.current);
            commitDebounceRef.current = null;
        }

        const picked = await pickScreenColor();
        if (picked) commit(picked);
    }, [commit, disabled]);

    return (
        <div className="color-field-row">
            <input
                ref={inputRef}
                type="color"
                value={draftHex}
                disabled={disabled}
                onChange={(event) => applyDraft(event.target.value)}
            />
            <button
                type="button"
                className="eyedropper-button"
                disabled={disabled || !eyedropperAvailable}
                title={
                    eyedropperAvailable
                        ? "Піпетка — вибрати колір з екрана"
                        : "Піпетка доступна в Chrome та Edge"
                }
                aria-label="Піпетка — вибрати колір з екрана"
                onClick={() => void handleEyedropper()}
            >
                <EyedropperIcon />
            </button>
        </div>
    );
}

function EyedropperIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="m2 22 1-1h3l9-9" />
            <path d="M15 6l3 3" />
            <path d="m18 9 4-4-2-2-4 4" />
            <path d="m8 14 2 2" />
        </svg>
    );
}
