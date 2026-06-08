type RenderingOverlayProps = {
    open: boolean;
};

export function RenderingOverlay({ open }: RenderingOverlayProps) {
    if (!open) return null;

    return (
        <div
            className="rendering-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="rendering-overlay-card">
                <span className="rendering-overlay-spinner" aria-hidden />
                <span className="rendering-overlay-label">Рендеринг</span>
            </div>
        </div>
    );
}
