import { useCallback, useLayoutEffect, useState } from "react";

export function usePatternRenderCommit() {
    const [isRendering, setIsRendering] = useState(false);
    const [renderNonce, setRenderNonce] = useState(0);

    const commitWithRendering = useCallback((apply: () => void) => {
        setIsRendering(true);

        requestAnimationFrame(() => {
            apply();
            setRenderNonce((nonce) => nonce + 1);
        });
    }, []);

    useLayoutEffect(() => {
        if (renderNonce === 0) return;

        const frameId = requestAnimationFrame(() => {
            setIsRendering(false);
        });

        return () => cancelAnimationFrame(frameId);
    }, [renderNonce]);

    return {
        isRendering,
        commitWithRendering,
    };
}
