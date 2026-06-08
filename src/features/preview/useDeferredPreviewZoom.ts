import {
    useCallback,
    useEffect,
    useRef,
    type Dispatch,
    type SetStateAction,
} from "react";
import {
    clampPreviewZoom,
    PREVIEW_ZOOM_APPLY_INTERVAL_MS,
} from "./previewZoom";

export type PreviewZoomAppliedListener = (
    fromZoom: number,
    toZoom: number,
) => void;

export function useDeferredPreviewZoom(
    previewZoom: number,
    onPreviewZoomChange: Dispatch<SetStateAction<number>>,
    onZoomApplied?: PreviewZoomAppliedListener,
) {
    const appliedRef = useRef(previewZoom);
    const pendingRef = useRef(previewZoom);
    const dirtyRef = useRef(false);
    const onChangeRef = useRef(onPreviewZoomChange);
    onChangeRef.current = onPreviewZoomChange;
    const onZoomAppliedRef = useRef(onZoomApplied);
    onZoomAppliedRef.current = onZoomApplied;

    useEffect(() => {
        appliedRef.current = previewZoom;
        if (!dirtyRef.current) {
            pendingRef.current = previewZoom;
        }
    }, [previewZoom]);

    const applyPending = useCallback(() => {
        if (!dirtyRef.current) return;

        dirtyRef.current = false;
        const next = clampPreviewZoom(pendingRef.current);
        pendingRef.current = next;

        const from = appliedRef.current;
        if (next === from) return;

        appliedRef.current = next;
        onChangeRef.current(next);
        onZoomAppliedRef.current?.(from, next);
    }, []);

    useEffect(() => {
        const id = window.setInterval(
            applyPending,
            PREVIEW_ZOOM_APPLY_INTERVAL_MS,
        );

        return () => {
            window.clearInterval(id);
            if (dirtyRef.current) {
                const from = appliedRef.current;
                const next = clampPreviewZoom(pendingRef.current);
                if (next !== from) {
                    appliedRef.current = next;
                    onChangeRef.current(next);
                    onZoomAppliedRef.current?.(from, next);
                }
            }
        };
    }, [applyPending]);

    const requestPreviewZoom = useCallback((value: SetStateAction<number>) => {
        const prev = pendingRef.current;
        const next = clampPreviewZoom(
            typeof value === "function" ? value(prev) : value,
        );
        pendingRef.current = next;
        dirtyRef.current = true;
    }, []);

    const commitPreviewZoom = useCallback(() => {
        dirtyRef.current = true;
        applyPending();
    }, [applyPending]);

    const applyPreviewZoomNow = useCallback((value: SetStateAction<number>) => {
        const prev = appliedRef.current;
        const next = clampPreviewZoom(
            typeof value === "function" ? value(prev) : value,
        );
        pendingRef.current = next;
        dirtyRef.current = false;

        if (next === appliedRef.current) return;

        appliedRef.current = next;
        onChangeRef.current(next);
    }, []);

    return {
        requestPreviewZoom,
        commitPreviewZoom,
        applyPreviewZoomNow,
    };
}
