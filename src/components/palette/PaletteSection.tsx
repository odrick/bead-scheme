import { rgbToCss, type RGB } from "../../beadMath";

type PaletteSectionProps = {
    palette: RGB[];
    beadCounts: number[];
};

export function PaletteSection({
    palette,
    beadCounts,
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
                        <span
                            className="dot"
                            style={{ background: rgbToCss(color) }}
                        />
                        <span className="bead-count">
                            {beadCounts[index] ?? 0}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
