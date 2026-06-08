import {
    parseProjectFile,
    type BeadSchemeProject,
} from "./projectFile";

export const AUTOSAVE_STORAGE_KEY = "bead-scheme:auto-project";

export type ProjectAutosaveErrorKind = "quota" | "unknown";

export class ProjectAutosaveError extends Error {
    readonly kind: ProjectAutosaveErrorKind;

    constructor(kind: ProjectAutosaveErrorKind, message: string) {
        super(message);
        this.name = "ProjectAutosaveError";
        this.kind = kind;
    }
}

export function isQuotaExceededError(error: unknown): boolean {
    if (!(error instanceof DOMException)) return false;

    return (
        error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
}

export function loadProjectFromLocalStorage(): BeadSchemeProject | null {
    try {
        const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
        if (!raw) return null;

        return parseProjectFile(raw);
    } catch (error) {
        console.warn("Не вдалося завантажити автозбережений проєкт.", error);

        try {
            localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        } catch {
            // ignore cleanup errors
        }

        return null;
    }
}

export function saveProjectToLocalStorage(project: BeadSchemeProject): void {
    const json = JSON.stringify(project);

    try {
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, json);
        return;
    } catch (error) {
        if (!isQuotaExceededError(error)) {
            throw new ProjectAutosaveError(
                "unknown",
                "Не вдалося зберегти проєкт у localStorage.",
            );
        }
    }

    try {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, json);
    } catch (retryError) {
        if (isQuotaExceededError(retryError)) {
            throw new ProjectAutosaveError(
                "quota",
                "Проєкт занадто великий для localStorage (перевищено ліміт сховища).",
            );
        }

        throw new ProjectAutosaveError(
            "unknown",
            "Не вдалося зберегти проєкт у localStorage.",
        );
    }
}

export function clearProjectLocalStorage(): void {
    try {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    } catch {
        // ignore
    }
}
