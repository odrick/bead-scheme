import type { BuiltInMaskKind, ImageMaskSettings } from "./maskTypes";

export type AvailableMaskImages = Record<BuiltInMaskKind, HTMLImageElement | null> & {
    custom: HTMLImageElement | null;
};

export function resolveMaskImage(
    settings: Pick<ImageMaskSettings, "kind">,
    maskImages: AvailableMaskImages,
): HTMLImageElement | null {
    if (settings.kind === "none") return null;
    if (settings.kind === "custom") return maskImages.custom;

    return maskImages[settings.kind];
}

export function maskImageKey(settings: ImageMaskSettings): string {
    if (settings.kind === "custom" && settings.customImage) {
        return `custom:${settings.customImage.mimeType}:${settings.customImage.base64.length}`;
    }

    return settings.kind;
}
