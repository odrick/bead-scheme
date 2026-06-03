import { formatHexWithHash } from "../../beadCatalog";
import { rgbToCss, type RGB } from "../../beadMath";

type PaletteSectionProps = {
    palette: RGB[];
    beadMatches: { code: string }[];
};

export function PaletteSection({ palette, beadMatches }: PaletteSectionProps) {
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
                            title={`Слот ${index + 1}`}
                        >
                            <span
                                className="dot"
                                style={{ background: rgbToCss(color) }}
                            />
                            <span className="idx">{index + 1}</span>
                            <span className="hex">
                                {formatHexWithHash(color)}
                            </span>
                            {match ? (
                                <span className="bead-code">{match.code}</span>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
