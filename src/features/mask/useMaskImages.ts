import { useEffect, useState } from "react";
import { MASK_ASSET_URLS } from "./maskAssets";
import { loadImageElement } from "./loadMaskImage";
import type { BuiltInMaskKind } from "./maskTypes";

type LoadedMaskImages = Record<BuiltInMaskKind, HTMLImageElement | null>;

const INITIAL: LoadedMaskImages = {
    circle: null,
    tie: null,
    gerdana: null,
};

export function useMaskImages(): LoadedMaskImages {
    const [images, setImages] = useState<LoadedMaskImages>(INITIAL);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const entries = await Promise.all(
                (Object.entries(MASK_ASSET_URLS) as [BuiltInMaskKind, string][]).map(
                    async ([kind, url]) => {
                        try {
                            const image = await loadImageElement(url);
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
