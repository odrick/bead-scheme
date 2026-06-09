import { useEffect, useRef, useState, type ReactNode } from "react";

type DeferredRangeSliderBaseProps = {
    min: number;
    max: number;
    step?: number;
    value: number;
    onCommit: (value: number) => void;
    onDraftChange?: (value: number) => void;
    disabled?: boolean;
    "aria-label"?: string;
    tooltip?: string;
};

type DeferredRangeSliderProps = DeferredRangeSliderBaseProps &
    (
        | {
              title: string;
              showNumberInput: true;
              variant?: "default";
              label?: never;
          }
        | {
              title?: never;
              showNumberInput?: false;
              variant?: "default";
              label: (value: number) => ReactNode;
          }
        | {
              title?: never;
              showNumberInput?: never;
              label?: never;
              variant: "inline";
          }
    );

export function DeferredRangeSlider({
    min,
    max,
    step,
    value,
    onCommit,
    onDraftChange,
    disabled = false,
    "aria-label": ariaLabel,
    tooltip,
    ...rest
}: DeferredRangeSliderProps) {
    const [draft, setDraft] = useState(value);
    const [inputDraft, setInputDraft] = useState(String(value));
    const isDraggingRef = useRef(false);
    const isInputFocusedRef = useRef(false);

    const variant = "variant" in rest ? rest.variant ?? "default" : "default";
    const showNumberInput = "showNumberInput" in rest && rest.showNumberInput;
    const title = "title" in rest ? rest.title : undefined;
    const label = "label" in rest ? rest.label : undefined;

    useEffect(() => {
        if (!isDraggingRef.current && !isInputFocusedRef.current) {
            setDraft(value);
            setInputDraft(String(value));
        }
    }, [value]);

    const parseValue = (raw: string, fallback = draft) => {
        const parsed =
            step !== undefined
                ? Number.parseFloat(raw)
                : Number.parseInt(raw, 10);

        if (Number.isNaN(parsed)) return fallback;

        return Math.min(max, Math.max(min, parsed));
    };

    const commit = (next: number) => {
        if (disabled) return;

        setDraft(next);
        setInputDraft(String(next));

        if (next !== value) {
            onCommit(next);
        }
    };

    const updateDraft = (next: number) => {
        if (disabled) return;

        setDraft(next);
        onDraftChange?.(next);

        if (!isInputFocusedRef.current) {
            setInputDraft(String(next));
        }
    };

    const commitInput = () => {
        const next = parseValue(inputDraft);
        isInputFocusedRef.current = false;
        commit(next);
    };

    const resetInput = () => {
        isInputFocusedRef.current = false;
        setInputDraft(String(value));
        setDraft(value);
    };

    const rangeInput = (
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={draft}
            disabled={disabled}
            aria-label={
                showNumberInput ? `${ariaLabel}, повзунок` : ariaLabel
            }
            title={tooltip}
            onPointerDown={(event) => {
                if (disabled) return;
                isDraggingRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }

                if (!isDraggingRef.current) return;

                isDraggingRef.current = false;
                commit(parseValue(event.currentTarget.value));
            }}
            onPointerCancel={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }

                isDraggingRef.current = false;
                setDraft(value);
                onDraftChange?.(value);

                if (!isInputFocusedRef.current) {
                    setInputDraft(String(value));
                }
            }}
            onChange={(event) => {
                const next = parseValue(event.currentTarget.value);
                updateDraft(next);

                if (!isDraggingRef.current) {
                    commit(next);
                }
            }}
        />
    );

    if (variant === "inline") {
        return (
            <div className="deferred-range-inline" title={tooltip}>
                {rangeInput}
            </div>
        );
    }

    return (
        <div className="field">
            <span className="label deferred-range-label">
                {showNumberInput && title ? (
                    <>
                        {title}:{" "}
                        <input
                            type="number"
                            className="deferred-range-value-input"
                            min={min}
                            max={max}
                            step={step ?? 1}
                            value={inputDraft}
                            disabled={disabled}
                            aria-label={ariaLabel}
                            onFocus={() => {
                                isInputFocusedRef.current = true;
                            }}
                            onChange={(event) => {
                                setInputDraft(event.target.value);
                            }}
                            onBlur={commitInput}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.currentTarget.blur();
                                } else if (event.key === "Escape") {
                                    resetInput();
                                    event.currentTarget.blur();
                                }
                            }}
                        />
                    </>
                ) : (
                    label?.(draft)
                )}
            </span>
            {rangeInput}
        </div>
    );
}
