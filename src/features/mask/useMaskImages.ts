import { useEffect, useState } from "react";
import { MASK_ASSET_URLS } from "./maskAssets";
import type { MaskKind } from "./maskTypes";

type LoadedMaskImages = Record<Exclude<MaskKind, "none">, HTMLImageElement | null>;

const INITIAL: LoadedMaskImages = {
    circle: null,
    tie: null,
    gerdana: null,
};

function loadMaskImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Не вдалося завантажити маску: ${url}`));
        img.src = url;
    });
}

export function useMaskImages(): LoadedMaskImages {
    const [images, setImages] = useState<LoadedMaskImages>(INITIAL);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const entries = await Promise.all(
                (Object.entries(MASK_ASSET_URLS) as [Exclude<MaskKind, "none">, string][]).map(
                    async ([kind, url]) => {
                        try {
                            const image = await loadMaskImage(url);
                            return [kind, image] as const;
                        } catch (error) {
                            console.warn(error);
                            return [kind, null] as const;
                        }
                    },
                ),
            );

            if (cancelled) return;

            setImages({
                circle: entries.find(([kind]) => kind === "circle")?.[1] ?? null,
                tie: entries.find(([kind]) => kind === "tie")?.[1] ?? null,
                gerdana: entries.find(([kind]) => kind === "gerdana")?.[1] ?? null,
            });
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return images;
}
