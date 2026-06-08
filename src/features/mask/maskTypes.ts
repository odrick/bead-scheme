export type MaskKind = "none" | "circle" | "tie" | "gerdana" | "custom";

export type StoredMaskImage = {
    mimeType: string;
    base64: string;
};

export type ImageMaskSettings = {
    kind: MaskKind;
    /** Множник до базового масштабу «вписати в зображення». */
    scale: number;
    /** Центр маски в координатах оригінального зображення (пікселі). */
    offsetX: number;
    offsetY: number;
    customImage?: StoredMaskImage;
};

export const MASK_KIND_LABELS: Record<MaskKind, string> = {
    none: "немає",
    circle: "круг",
    tie: "галстук",
    gerdana: "гердана",
    custom: "своя",
};

export type BuiltInMaskKind = Exclude<MaskKind, "none" | "custom">;

export const MASK_SCALE_MIN = 0.25;
export const MASK_SCALE_MAX = 3;
export const MASK_SCALE_STEP = 0.01;
export const DEFAULT_MASK_SCALE = 1;

export function defaultMaskSettings(): ImageMaskSettings {
    return {
        kind: "none",
        scale: DEFAULT_MASK_SCALE,
        offsetX: 0,
        offsetY: 0,
    };
}

export function serializeMaskSettings(
    settings: ImageMaskSettings,
): ImageMaskSettings {
    if (settings.kind !== "custom") {
        const { customImage: _removed, ...rest } = settings;
        return rest;
    }

    return settings;
}

export function centerMaskOnImage(
    imageWidth: number,
    imageHeight: number,
    settings: ImageMaskSettings,
): ImageMaskSettings {
    return {
        ...settings,
        offsetX: imageWidth / 2,
        offsetY: imageHeight / 2,
    };
}
