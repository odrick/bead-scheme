import { formatHexWithHash } from "../../beadCatalog";
import { rgbToCss, type RGB } from "../../beadMath";

type PaletteMatch = {
    code: string;
    name?: string;
    beadHex: string;
    deltaE: number;
};

type PaletteSectionProps = {
    palette: RGB[];
    beadMatches: PaletteMatch[];
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
                            {match && (
                                <span className="bead-match">
                                    <span
                                        className="bead-code"
                                        title="Найближчий номер"
                                    >
                                        № {match.code}
                                    </span>
                                    <span
                                        className="bead-cat-hex"
                                        title="Колір у каталозі для підбору"
                                    >
                                        {match.beadHex}
                                    </span>
                                    {match.name ? (
                                        <span className="bead-name">
                                            {match.name}
                                        </span>
                                    ) : null}
                                    <span
                                        className="bead-de"
                                        title="ΔE (CIE76)"
                                    >
                                        ΔE {match.deltaE.toFixed(1)}
                                    </span>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
