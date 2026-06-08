import { useEffect } from "react";

export const SCHEME_PREVIEW_ZOOM_WHEEL_SELECTOR = ".pattern-wrap";

function isInsideSchemePreviewZoomWheelTarget(
    target: EventTarget | null,
): boolean {
    if (!(target instanceof Node)) return false;

    const root = document.querySelector(SCHEME_PREVIEW_ZOOM_WHEEL_SELECTOR);
    return root?.contains(target) ?? false;
}

export function useBlockPageCtrlWheelZoom(): void {
    useEffect(() => {
        const onWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            if (isInsideSchemePreviewZoomWheelTarget(event.target)) return;

            event.preventDefault();
        };

        window.addEventListener("wheel", onWheel, {
            passive: false,
            capture: true,
        });

        return () => {
            window.removeEventListener("wheel", onWheel, { capture: true });
        };
    }, []);
}
