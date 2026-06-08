import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { SchemeSizeBeads } from "../../features/pattern/schemeGrid";
import type { BrickLayoutMetrics } from "../../features/preview/canvasUtils";
import { getCanvasPointerCoords } from "../../features/preview/canvasUtils";
import {
    leftCurtainWidthPx,
    pointerXToLeftCurtainBeads,
    pointerYToTopCurtainBeads,
    topCurtainHeightPx,
    WEAVING_CURTAIN_OPACITY,
} from "../../features/preview/weavingCurtains";

type DragTarget = "left" | "top";

const EDGE_HIT_PX = 8;

type WeavingCurtainsOverlayProps = {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    metrics: BrickLayoutMetrics;
    canvasWidth: number;
    canvasHeight: number;
    schemeSize: SchemeSizeBeads;
    leftBeads: number;
    topBeads: number;
    onLeftBeadsChange: (value: number) => void;
    onTopBeadsChange: (value: number) => void;
};

export function WeavingCurtainsOverlay({
    canvasRef,
    metrics,
    canvasWidth,
    canvasHeight,
    schemeSize,
    leftBeads,
    topBeads,
    onLeftBeadsChange,
    onTopBeadsChange,
}: WeavingCurtainsOverlayProps) {
    const dragTargetRef = useRef<DragTarget | null>(null);

    const applyPointer = useCallback(
        (clientX: number, clientY: number) => {
            const canvas = canvasRef.current;
            if (!canvas || !dragTargetRef.current) return;

            const { x, y } = getCanvasPointerCoords(canvas, clientX, clientY);

            if (dragTargetRef.current === "left") {
                onLeftBeadsChange(
                    pointerXToLeftCurtainBeads(x, metrics, schemeSize.width),
                );
                return;
            }

            onTopBeadsChange(
                pointerYToTopCurtainBeads(y, metrics, schemeSize.height),
            );
        },
        [
            canvasRef,
            metrics,
            onLeftBeadsChange,
            onTopBeadsChange,
            schemeSize.height,
            schemeSize.width,
        ],
    );

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            if (!dragTargetRef.current) return;
            applyPointer(event.clientX, event.clientY);
        };

        const onMouseUp = () => {
            dragTargetRef.current = null;
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [applyPointer]);

    const startDrag = (target: DragTarget, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        dragTargetRef.current = target;
        applyPointer(event.clientX, event.clientY);
    };

    const leftWidth = leftCurtainWidthPx(leftBeads, metrics);
    const topHeight = topCurtainHeightPx(topBeads, metrics);
    const curtainFill = `rgba(0, 0, 0, ${WEAVING_CURTAIN_OPACITY})`;

    const leftEdgeX = leftWidth > 0 ? leftWidth : 0;
    const topEdgeY = topHeight > 0 ? topHeight : 0;

    return (
        <div
            className="weaving-curtains"
            style={{ width: canvasWidth, height: canvasHeight }}
            aria-hidden
        >
            {leftWidth > 0 ? (
                <div
                    className="weaving-curtain"
                    style={{
                        left: 0,
                        top: 0,
                        width: leftWidth,
                        height: canvasHeight,
                        background: curtainFill,
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                />
            ) : null}

            {topHeight > 0 ? (
                <div
                    className="weaving-curtain"
                    style={{
                        left: leftWidth,
                        top: 0,
                        width: Math.max(0, canvasWidth - leftWidth),
                        height: topHeight,
                        background: curtainFill,
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                />
            ) : null}

            <div
                className="weaving-curtain-edge weaving-curtain-edge--vertical"
                style={{
                    left: Math.max(0, leftEdgeX - EDGE_HIT_PX / 2),
                    top: 0,
                    width: EDGE_HIT_PX,
                    height: canvasHeight,
                }}
                title="Шторка зліва"
                onMouseDown={(event) => startDrag("left", event)}
            />

            <div
                className="weaving-curtain-edge weaving-curtain-edge--horizontal"
                style={{
                    left: 0,
                    top: Math.max(0, topEdgeY - EDGE_HIT_PX / 2),
                    width: canvasWidth,
                    height: EDGE_HIT_PX,
                }}
                title="Шторка зверху"
                onMouseDown={(event) => startDrag("top", event)}
            />
        </div>
    );
}
