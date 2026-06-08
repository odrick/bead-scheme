import { useCallback, useEffect, useRef } from "react";
import {
    buildProjectFile,
    encodeImageToBase64,
    type BeadSchemeProject,
    type ProjectExportData,
} from "./projectFile";
import {
    loadProjectFromLocalStorage,
    ProjectAutosaveError,
    saveProjectToLocalStorage,
} from "./projectLocalStorage";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_IDLE_TIMEOUT_MS = 5000;

type CachedImage = {
    bitmap: HTMLImageElement;
    image: BeadSchemeProject["image"];
};

type UseProjectAutosaveOptions = {
    bitmap: HTMLImageElement | null;
    projectData: ProjectExportData | null;
    onRestore: (project: BeadSchemeProject) => void;
};

type AutosaveController = {
    saveNow: () => void;
};

function scheduleIdleTask(task: () => void): () => void {
    if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(() => task(), {
            timeout: AUTOSAVE_IDLE_TIMEOUT_MS,
        });
        return () => cancelIdleCallback(id);
    }

    const timeoutId = window.setTimeout(task, 0);
    return () => window.clearTimeout(timeoutId);
}

export function useProjectAutosave({
    bitmap,
    projectData,
    onRestore,
}: UseProjectAutosaveOptions): AutosaveController {
    const bitmapRef = useRef(bitmap);
    const projectDataRef = useRef(projectData);
    const onRestoreRef = useRef(onRestore);

    const cachedImageRef = useRef<CachedImage | null>(null);
    const lastSavedDataRef = useRef<string>("");
    const saveDebounceRef = useRef<number | null>(null);
    const cancelIdleRef = useRef<(() => void) | null>(null);
    const saveGenerationRef = useRef(0);
    const isSavingRef = useRef(false);
    const quotaWarningShownRef = useRef(false);
    const initialRestoreDoneRef = useRef(false);

    bitmapRef.current = bitmap;
    projectDataRef.current = projectData;
    onRestoreRef.current = onRestore;

    const cancelPending = useCallback(() => {
        if (saveDebounceRef.current !== null) {
            window.clearTimeout(saveDebounceRef.current);
            saveDebounceRef.current = null;
        }
        if (cancelIdleRef.current) {
            cancelIdleRef.current();
            cancelIdleRef.current = null;
        }
    }, []);

    const performSave = async (generation: number) => {
        if (generation !== saveGenerationRef.current) return;

        const currentBitmap = bitmapRef.current;
        const currentData = projectDataRef.current;

        if (!currentBitmap || !currentData) return;
        if (isSavingRef.current) return;

        const dataFingerprint = JSON.stringify(currentData);
        if (dataFingerprint === lastSavedDataRef.current) return;

        isSavingRef.current = true;

        try {
            let cached = cachedImageRef.current;

            if (!cached || cached.bitmap !== currentBitmap) {
                const image = await encodeImageToBase64(currentBitmap);

                if (generation !== saveGenerationRef.current) return;

                cached = { bitmap: currentBitmap, image };
                cachedImageRef.current = cached;
            }

            const project = buildProjectFile(cached.image, currentData);
            saveProjectToLocalStorage(project);
            lastSavedDataRef.current = dataFingerprint;
        } catch (error) {
            if (
                error instanceof ProjectAutosaveError &&
                error.kind === "quota" &&
                !quotaWarningShownRef.current
            ) {
                quotaWarningShownRef.current = true;
                console.warn(error.message);
            } else if (!(error instanceof ProjectAutosaveError)) {
                console.warn("Помилка автозбереження проєкту.", error);
            }
        } finally {
            isSavingRef.current = false;
        }
    };

    const queueSave = useCallback((immediate = false) => {
        cancelPending();

        const run = () => {
            saveDebounceRef.current = null;
            const generation = saveGenerationRef.current;

            cancelIdleRef.current = scheduleIdleTask(() => {
                cancelIdleRef.current = null;
                void performSave(generation);
            });
        };

        if (immediate) {
            run();
            return;
        }

        saveDebounceRef.current = window.setTimeout(run, AUTOSAVE_DEBOUNCE_MS);
    }, [cancelPending]);

    const saveNow = useCallback(() => {
        queueSave(true);
    }, [queueSave]);

    // Restore from localStorage on mount
    useEffect(() => {
        if (initialRestoreDoneRef.current) return;
        initialRestoreDoneRef.current = true;

        const stored = loadProjectFromLocalStorage();
        if (!stored) return;

        // Pre-populate the image cache so we don't need to re-encode after restore
        cachedImageRef.current = null;

        onRestoreRef.current(stored);
    }, []);

    // Queue save on any state change
    useEffect(() => {
        if (!bitmap || !projectData) return;
        queueSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bitmap, projectData]);

    // Flush on page hide / visibility change
    useEffect(() => {
        const flush = () => queueSave(true);

        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") flush();
        };

        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            cancelPending();
            saveGenerationRef.current += 1;
        };
    }, [queueSave, cancelPending]);

    return { saveNow };
}
