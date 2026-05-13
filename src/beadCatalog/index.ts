/**
 * Каталоги кольорів: Preciosa (номери з ibeadsmaster + орієнтовний hex),
 * інші бренди — RGB з відкритих CSV репозиторію beadcolors (MIT).
 */
import {
    deltaE76,
    parseHexColor,
    rgbToLab,
    type Lab,
    type RGB,
} from "../beadMath";
import beadcolorsBundle from "./beadcolors-catalogs.json";
import preciosa from "./preciosa-ibeadsmaster.json";

export type BeadCatalogEntry = {
    code: string;
    hex: string;
    name?: string;
    group?: string;
};

export type RawBeadCatalog = {
    id: string;
    label: string;
    sourceUrl: string;
    approximateColors: boolean;
    note: string;
    entries: BeadCatalogEntry[];
};

export type PreparedBeadCatalog = Omit<RawBeadCatalog, "entries"> & {
    items: (BeadCatalogEntry & { lab: Lab })[];
};

function prepare(raw: RawBeadCatalog): PreparedBeadCatalog {
    const { entries, ...rest } = raw;
    return {
        ...rest,
        items: entries.map((e) => ({
            ...e,
            lab: rgbToLab(parseHexColor(e.hex)),
        })),
    };
}

type BeadcolorsBundle = {
    repoUrl: string;
    catalogs: RawBeadCatalog[];
};

const fromBeadcolors = (beadcolorsBundle as BeadcolorsBundle).catalogs
    .map((c) => prepare(c))
    .sort((a, b) => a.label.localeCompare(b.label, "uk"));

export const BEAD_CATALOGS: PreparedBeadCatalog[] = [
    prepare(preciosa as RawBeadCatalog),
    ...fromBeadcolors,
];

/** Посилання на репозиторій з відкритими CSV (для підказок у UI). */
export const BEADCOLORS_REPO_URL = (beadcolorsBundle as BeadcolorsBundle)
    .repoUrl;

export function formatHexWithHash(hexOrRgb: string | RGB): string {
    if (typeof hexOrRgb === "string") {
        const t = hexOrRgb.trim();
        const body = t.startsWith("#") ? t.slice(1) : t;
        return `#${body.toUpperCase()}`;
    }
    const c = hexOrRgb;
    return `#${[c.r, c.g, c.b]
        .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
        .join("")}`;
}

export function nearestBead(
    rgb: RGB,
    catalog: PreparedBeadCatalog,
): {
    code: string;
    name?: string;
    beadHex: string;
    deltaE: number;
} {
    if (catalog.items.length === 0) {
        return { code: "—", beadHex: "#000000", deltaE: Infinity };
    }
    const lab = rgbToLab(rgb);
    let bestI = 0;
    let bestD = deltaE76(lab, catalog.items[0].lab);
    for (let i = 1; i < catalog.items.length; i++) {
        const d = deltaE76(lab, catalog.items[i].lab);
        if (d < bestD) {
            bestD = d;
            bestI = i;
        }
    }
    const e = catalog.items[bestI];
    return {
        code: e.code,
        name: e.name,
        beadHex: formatHexWithHash(e.hex),
        deltaE: bestD,
    };
}
