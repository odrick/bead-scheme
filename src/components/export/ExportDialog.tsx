type ExportDialogProps = {
    open: boolean;
    onConfirm: (labelPaletteIndices: boolean) => void;
    onCancel: () => void;
};

export function ExportDialog({ open, onConfirm, onCancel }: ExportDialogProps) {
    if (!open) return null;

    return (
        <div
            className="export-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCancel();
            }}
        >
            <div
                className="export-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-dialog-title"
            >
                <h3 id="export-dialog-title" className="export-dialog-title">
                    Експорт схеми
                </h3>
                <p className="export-dialog-text">
                    Позначати бісеринки номерами з палітри?
                </p>
                <div className="export-dialog-actions">
                    <button
                        type="button"
                        className="export-dialog-btn export-dialog-btn-primary"
                        onClick={() => onConfirm(true)}
                    >
                        Так
                    </button>
                    <button
                        type="button"
                        className="export-dialog-btn"
                        onClick={() => onConfirm(false)}
                    >
                        Ні
                    </button>
                    <button
                        type="button"
                        className="export-dialog-btn export-dialog-btn-muted"
                        onClick={onCancel}
                    >
                        Скасувати
                    </button>
                </div>
            </div>
        </div>
    );
}
