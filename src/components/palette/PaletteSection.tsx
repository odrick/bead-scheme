import { rgbToCss, rgbToHex, type RGB } from "../../beadMath";

type PaletteSectionProps = {
    palette: RGB[];
    beadCounts: number[];
    onColorChange: (index: number, hex: string) => void;
    onColorReset: (index: number) => void;
};

export function PaletteSection({
    palette,
    beadCounts,
    onColorChange,
    onColorReset,
}: PaletteSectionProps) {
    if (palette.length === 0) return null;

    return (
        <section className="palette-section">
            <h2>Палітра ({palette.length})</h2>
            <ul className="palette">
                {palette.map((color, index) => (
                    <li
                        key={index}
                        className="swatch"
                        title={`${beadCounts[index] ?? 0} бісеринок`}
                    >
                        <label
                            className="dot-picker"
                            aria-label={`Змінити колір ${index + 1}`}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                onColorReset(index);
                            }}
                        >
                            <span
                                className="dot"
                                style={{ background: rgbToCss(color) }}
                            />
                            <input
                                className="palette-color-input"
                                type="color"
                                value={rgbToHex(color)}
                                aria-label={`Колір палітри ${index + 1}`}
                                onChange={(event) =>
                                    onColorChange(index, event.target.value)
                                }
                            />
                        </label>
                        <span className="bead-count">
                            {beadCounts[index] ?? 0}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
