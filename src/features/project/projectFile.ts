import type {
    BackgroundMode,
    GridLayout,
    RGB,
} from "../../beadMath";
import type { CellEditChange } from "../pattern/cellEditHistory";
import type { SchemeSizeBeads } from "../pattern/schemeGrid";
import type { CanvasBackground } from "../preview/canvasUtils";

export const PROJECT_FORMAT_VERSION = 1;
export const PROJECT_FILE_EXTENSION = "bsp";

export type BeadSchemeProject = {
    version: typeof PROJECT_FORMAT_VERSION;
    image: {
        mimeType: string;
        base64: string;
    };
    settings: {
        paletteSize: number;
        beadsPerRow: number;
        gridLayout: GridLayout;
        backgroundMode: BackgroundMode;
        backgroundHex: string;
        previewZoom: number;
        canvasBackground: CanvasBackground;
        schemeSize: SchemeSizeBeads;
    };
    paletteColors: Record<string, RGB>;
    cellEdits: Record<string, number>;
    editHistory: {
        undo: CellEditChange[][];
        redo: CellEditChange[][];
    };
};

export type ProjectExportData = Omit<BeadSchemeProject, "image">;

const GRID_LAYOUTS: GridLayout[] = ["brick", "straight", "lace"];
const BACKGROUND_MODES: BackgroundMode[] = ["transparent", "color"];
const CANVAS_BACKGROUNDS: CanvasBackground[] = [
    "checkerboard",
    "white",
    "black",
];

export function projectImageToDataUrl(image: BeadSchemeProject["image"]): string {
    return `data:${image.mimeType};base64,${image.base64}`;
}

export async function encodeImageToBase64(
    image: HTMLImageElement,
): Promise<BeadSchemeProject["image"]> {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Не вдалося створити canvas для збереження зображення.");
    }

    ctx.drawImage(image, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);

    if (!match) {
        throw new Error("Не вдалося закодувати зображення.");
    }

    return { mimeType: match[1], base64: match[2] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRgb(value: unknown): value is RGB {
    if (!isRecord(value)) return false;

    return (
        typeof value.r === "number" &&
        typeof value.g === "number" &&
        typeof value.b === "number"
    );
}

function isCellEditChange(value: unknown): value is CellEditChange {
    if (!isRecord(value)) return false;

    return (
        typeof value.row === "number" &&
        typeof value.col === "number" &&
        typeof value.from === "number" &&
        typeof value.to === "number"
    );
}

function parsePaletteColors(value: unknown): Record<string, RGB> {
    if (!isRecord(value)) return {};

    const result: Record<string, RGB> = {};

    for (const [key, color] of Object.entries(value)) {
        if (isRgb(color)) {
            result[key] = color;
        }
    }

    return result;
}

function parseCellEdits(value: unknown): Record<string, number> {
    if (!isRecord(value)) return {};

    const result: Record<string, number> = {};

    for (const [key, paletteIndex] of Object.entries(value)) {
        if (typeof paletteIndex === "number") {
            result[key] = paletteIndex;
        }
    }

    return result;
}

function parseEditHistory(value: unknown): BeadSchemeProject["editHistory"] {
    if (!isRecord(value)) {
        return { undo: [], redo: [] };
    }

    const parseSteps = (steps: unknown): CellEditChange[][] => {
        if (!Array.isArray(steps)) return [];

        return steps
            .filter((step): step is CellEditChange[] => Array.isArray(step))
            .map((step) => step.filter(isCellEditChange));
    };

    return {
        undo: parseSteps(value.undo),
        redo: parseSteps(value.redo),
    };
}

export function parseProjectFile(text: string): BeadSchemeProject {
    let parsed: unknown;

    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("Файл проєкту містить некоректний JSON.");
    }

    if (!isRecord(parsed)) {
        throw new Error("Некоректний формат файлу проєкту.");
    }

    if (parsed.version !== PROJECT_FORMAT_VERSION) {
        throw new Error(
            `Непідтримувана версія проєкту: ${String(parsed.version)}.`,
        );
    }

    if (!isRecord(parsed.image)) {
        throw new Error("У файлі проєкту відсутнє зображення.");
    }

    const mimeType = parsed.image.mimeType;
    const base64 = parsed.image.base64;

    if (typeof mimeType !== "string" || typeof base64 !== "string" || !base64) {
        throw new Error("Зображення у файлі проєкту пошкоджене.");
    }

    if (!isRecord(parsed.settings)) {
        throw new Error("У файлі проєкту відсутні налаштування.");
    }

    const settings = parsed.settings;
    const schemeSize = settings.schemeSize;

    if (
        !isRecord(schemeSize) ||
        typeof schemeSize.width !== "number" ||
        typeof schemeSize.height !== "number"
    ) {
        throw new Error("Некоректний розмір схеми у файлі проєкту.");
    }

    if (
        typeof settings.paletteSize !== "number" ||
        typeof settings.beadsPerRow !== "number" ||
        typeof settings.backgroundHex !== "string" ||
        typeof settings.previewZoom !== "number" ||
        !GRID_LAYOUTS.includes(settings.gridLayout as GridLayout) ||
        !BACKGROUND_MODES.includes(settings.backgroundMode as BackgroundMode) ||
        !CANVAS_BACKGROUNDS.includes(
            settings.canvasBackground as CanvasBackground,
        )
    ) {
        throw new Error("Некоректні налаштування у файлі проєкту.");
    }

    return {
        version: PROJECT_FORMAT_VERSION,
        image: { mimeType, base64 },
        settings: {
            paletteSize: settings.paletteSize,
            beadsPerRow: settings.beadsPerRow,
            gridLayout: settings.gridLayout as GridLayout,
            backgroundMode: settings.backgroundMode as BackgroundMode,
            backgroundHex: settings.backgroundHex,
            previewZoom: settings.previewZoom,
            canvasBackground: settings.canvasBackground as CanvasBackground,
            schemeSize: {
                width: schemeSize.width,
                height: schemeSize.height,
            },
        },
        paletteColors: parsePaletteColors(parsed.paletteColors),
        cellEdits: parseCellEdits(parsed.cellEdits),
        editHistory: parseEditHistory(parsed.editHistory),
    };
}

export async function readProjectFile(file: File): Promise<BeadSchemeProject> {
    const text = await file.text();
    return parseProjectFile(text);
}

export function buildProjectFile(
    image: BeadSchemeProject["image"],
    data: ProjectExportData,
): BeadSchemeProject {
    return {
        ...data,
        image,
    };
}

export function projectFilename(): string {
    const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);

    return `bead-scheme-${stamp}.${PROJECT_FILE_EXTENSION}`;
}

export function downloadProjectFile(project: BeadSchemeProject): void {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = projectFilename();
    anchor.click();

    URL.revokeObjectURL(url);
}
