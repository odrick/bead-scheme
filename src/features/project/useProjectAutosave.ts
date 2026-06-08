import { useEffect, useRef } from "react";
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

function exportDataFingerprint(projectData: ProjectExportData): string {
    return JSON.stringify(projectData);
}

function fingerprintProjectData(
    projectData: ProjectExportData,
    image: BeadSchemeProject["image"],
    bitmap: HTMLImageElement,
): string {
    return JSON.stringify({
        projectData,
        imageLength: image.base64.length,
        imageMime: image.mimeType,
        width: bitmap.naturalWidth,
        height: bitmap.naturalHeight,
    });
}

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
}: UseProjectAutosaveOptions): void {
    const bitmapRef = useRef(bitmap);
    const projectDataRef = useRef(projectData);
    const onRestoreRef = useRef(onRestore);

    const cachedImageRef = useRef<CachedImage | null>(null);
    const lastSavedFingerprintRef = useRef("");
    const saveDebounceRef = useRef<number | null>(null);
    const cancelIdleRef = useRef<(() => void) | null>(null);
    const saveGenerationRef = useRef(0);
    const isSavingRef = useRef(false);
    const quotaWarningShownRef = useRef(false);
    const initialRestoreDoneRef = useRef(false);
    const suppressSaveRef = useRef(false);
    const pendingRestoreFingerprintRef = useRef<string | null>(null);
    const restoredImageRef = useRef<BeadSchemeProject["image"] | null>(null);

    bitmapRef.current = bitmap;
    projectDataRef.current = projectData;
    onRestoreRef.current = onRestore;

    const performSave = async (generation: number) => {
        if (generation !== saveGenerationRef.current) return;

        const currentBitmap = bitmapRef.current;
        const currentData = projectDataRef.current;

        if (!currentBitmap || !currentData) return;
        if (isSavingRef.current) return;

        isSavingRef.current = true;

        try {
            let encodedImage = cachedImageRef.current;

            if (!encodedImage || encodedImage.bitmap !== currentBitmap) {
                const image = await encodeImageToBase64(currentBitmap);

                if (generation !== saveGenerationRef.current) return;

                encodedImage = {
                    bitmap: currentBitmap,
                    image,
                };
                cachedImageRef.current = encodedImage;
            }

            const fingerprint = fingerprintProjectData(
                currentData,
                encodedImage.image,
                currentBitmap,
            );

            if (fingerprint === lastSavedFingerprintRef.current) return;

            const project = buildProjectFile(encodedImage.image, currentData);
            saveProjectToLocalStorage(project);
            lastSavedFingerprintRef.current = fingerprint;
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

    const queueSave = (immediate = false) => {
        if (suppressSaveRef.current) return;

        if (saveDebounceRef.current !== null) {
            window.clearTimeout(saveDebounceRef.current);
            saveDebounceRef.current = null;
        }

        if (cancelIdleRef.current) {
            cancelIdleRef.current();
            cancelIdleRef.current = null;
        }

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
    };

    useEffect(() => {
        if (initialRestoreDoneRef.current) return;

        initialRestoreDoneRef.current = true;

        const stored = loadProjectFromLocalStorage();
        if (!stored) return;

        cachedImageRef.current = null;
        restoredImageRef.current = stored.image;
        suppressSaveRef.current = true;
        pendingRestoreFingerprintRef.current = exportDataFingerprint({
            version: stored.version,
            settings: stored.settings,
            paletteColors: stored.paletteColors,
            cellEdits: stored.cellEdits,
            editHistory: stored.editHistory,
        });

        onRestoreRef.current(stored);
    }, []);

    useEffect(() => {
        if (!bitmap || !projectData) return;

        const pendingRestore = pendingRestoreFingerprintRef.current;

        if (pendingRestore) {
            if (exportDataFingerprint(projectData) !== pendingRestore) return;

            const restoredImage = restoredImageRef.current;
            if (!restoredImage) return;

            cachedImageRef.current = {
                bitmap,
                image: restoredImage,
            };

            lastSavedFingerprintRef.current = fingerprintProjectData(
                projectData,
                restoredImage,
                bitmap,
            );
            pendingRestoreFingerprintRef.current = null;
            restoredImageRef.current = null;
            suppressSaveRef.current = false;
            return;
        }

        queueSave();
    }, [bitmap, projectData]);

    useEffect(() => {
        const flush = () => queueSave(true);

        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                flush();
            }
        };

        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", onVisibilityChange);

            if (saveDebounceRef.current !== null) {
                window.clearTimeout(saveDebounceRef.current);
            }

            if (cancelIdleRef.current) {
                cancelIdleRef.current();
            }

            saveGenerationRef.current += 1;
        };
    }, []);
}
