import { formatHexWithHash } from "../../beadCatalog";
import { rgbToCss, type RGB } from "../../beadMath";

type PaletteSectionProps = {
    palette: RGB[];
    beadMatches: { code: string }[];
    beadCounts: number[];
};

export function PaletteSection({
    palette,
    beadMatches,
    beadCounts,
}: PaletteSectionProps) {
    if (palette.length === 0) return null;

    return (
        <section className="palette-section">
            <h2>Палітра ({palette.length})</h2>
            <ul className="palette">
                {palette.map((color, index) => {
                    const match = beadMatches[index];

                    return (
                        <li
                            key={index}
                            className="swatch"
                            title={`Слот ${index + 1}, ${beadCounts[index] ?? 0} бісеринок`}
                        >
                            <span
                                className="dot"
                                style={{ background: rgbToCss(color) }}
                            />
                            <span className="idx">{index + 1}</span>
                            <span className="hex">
                                {formatHexWithHash(color)}
                            </span>
                            <span className="bead-code">
                                {match ? `${match.code} ` : ""}(
                                {beadCounts[index] ?? 0})
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
