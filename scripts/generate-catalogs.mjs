/**
 * Генерує JSON-каталоги для застосунку.
 * Усі CSV: https://github.com/maxcleme/beadcolors/tree/master/raw (MIT)
 * Preciosa: data/preciosa-ibeadsmaster.md + орієнтовний hex по групі кольору.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "src", "beadCatalog");

const BEADCOLORS_BASE =
    "https://raw.githubusercontent.com/maxcleme/beadcolors/master/raw";

/** Усі відкриті CSV з beadcolors/raw (крім дублікатів імен файлів). */
const BEADCOLOR_CSV = [
    { id: "artkal-a", file: "artkal_a.csv", label: "Artkal A" },
    { id: "artkal-c", file: "artkal_c.csv", label: "Artkal C" },
    { id: "artkal-m", file: "artkal_m.csv", label: "Artkal M" },
    { id: "artkal-r", file: "artkal_r.csv", label: "Artkal R" },
    { id: "artkal-s", file: "artkal_s.csv", label: "Artkal S" },
    { id: "diamond-dotz", file: "diamondDotz.csv", label: "Diamond Dotz" },
    { id: "hama", file: "hama.csv", label: "Hama midi" },
    { id: "hama-maxi", file: "hama_maxi.csv", label: "Hama maxi" },
    { id: "hama-mini", file: "hama_mini.csv", label: "Hama mini" },
    { id: "mard", file: "mard.csv", label: "Mard" },
    { id: "nabbi", file: "nabbi.csv", label: "Nabbi" },
    { id: "perler", file: "perler.csv", label: "Perler" },
    { id: "perler-caps", file: "perler_caps.csv", label: "Perler caps" },
    { id: "perler-mini", file: "perler_mini.csv", label: "Perler mini" },
    { id: "yant", file: "yant.csv", label: "Yant" },
];

/** Якорі RGB для груп ibeadsmaster (орієнтовно для підбору найближчого номера). */
const ANCHORS = {
    білий: [252, 252, 252],
    молочний: [248, 242, 228],
    "світло-сірий": [198, 198, 196],
    "темно-сірий": [78, 80, 82],
    чорний: [28, 28, 30],
    червоний: [198, 38, 48],
    кораловий: [248, 128, 118],
    кармін: [183, 28, 52],
    бордовий: [110, 22, 38],
    баклажан: [72, 38, 88],
    сливовий: [118, 50, 98],
    гвоздика: [212, 72, 92],
    рожевий: [236, 140, 180],
    помаранчевий: [235, 118, 40],
    гарбузовий: [210, 90, 30],
    "лососево-рожевий": [248, 150, 140],
    жовтий: [240, 210, 40],
    лимонний: [232, 238, 120],
    банановий: [236, 218, 120],
    абрикосовий: [236, 180, 120],
    персиковий: [238, 190, 150],
    бежевий: [220, 200, 175],
    фісташковий: [190, 210, 150],
    оливковий: [130, 135, 70],
    "трав'яний": [100, 160, 80],
    "весняна зелень": [90, 185, 95],
    "м'ятний": [150, 215, 195],
    смарагдовий: [20, 145, 90],
    вірідіан: [30, 110, 95],
    аквамарин: [95, 200, 185],
    бірюзовий: [40, 185, 185],
    "синьо-зелений": [35, 120, 115],
    джинс: [45, 75, 120],
    синій: [38, 70, 165],
    небесний: [110, 175, 235],
    блакитний: [100, 185, 220],
    волошковий: [95, 120, 210],
    індіго: [55, 55, 130],
    пурпурний: [120, 40, 110],
    фіолетовий: [130, 70, 170],
    фуксія: [215, 50, 150],
    лавандовий: [180, 165, 215],
    коричневий: [115, 75, 55],
    каштановий: [92, 58, 42],
    "кава з молоком": [185, 155, 130],
    медовий: [210, 155, 75],
    золотий: [212, 168, 55],
    бронзовий: [165, 120, 70],
    мідний: [180, 110, 65],
    срібний: [185, 185, 190],
    безбарвний: [235, 235, 245],
};

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, Math.round(n)));
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((x) => clamp(x, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function codePerturbRgb(anchor, code) {
    let h = 0;
    for (let i = 0; i < code.length; i++) {
        h = Math.imul(31, h) + code.charCodeAt(i);
    }
    const u = (h & 0xffff) / 0xffff;
    const v = ((h >>> 8) & 0xffff) / 0xffff;
    const w = ((h >>> 16) & 0xffff) / 0xffff;
    const dr = (u - 0.5) * 22;
    const dg = (v - 0.5) * 22;
    const db = (w - 0.5) * 22;
    const [r, g, b] = anchor;

    return [
        clamp(r + dr, 0, 255),
        clamp(g + dg, 0, 255),
        clamp(b + db, 0, 255),
    ];
}

function normalizeGroupTitle(title) {
    return title
        .trim()
        .toLowerCase()
        .replace(/\u2019/g, "'")
        .replace(/['ʼ`]/g, "'");
}

function parsePreciosaMd(mdPath) {
    const text = fs.readFileSync(mdPath, "utf8");
    const lines = text.split(/\r?\n/);
    const entries = [];
    let currentKey = null;

    const headerRe = /^## Колір бісеру:\s*(.+)\s*$/;
    const codeRe = /^\s{2,}([0-9][0-9a-z-]*)\s*$/i;

    for (const line of lines) {
        const hm = line.match(headerRe);
        if (hm) {
            currentKey = normalizeGroupTitle(hm[1]);
            continue;
        }
        if (!currentKey) continue;
        const cm = line.match(codeRe);
        if (cm) {
            const code = cm[1].toLowerCase();
            const anchor = ANCHORS[currentKey];
            if (!anchor) {
                console.warn("No anchor for group:", currentKey);
                continue;
            }
            const [r, g, b] = codePerturbRgb(anchor, code);
            entries.push({
                code,
                hex: rgbToHex(r, g, b),
                group: currentKey,
            });
        }
    }

    return {
        id: "preciosa-ibeadsmaster",
        label: "Preciosa",
        sourceUrl: "https://ibeadsmaster.com/biser-color-number/",
        approximateColors: true,
        note: "Номери офіційні; hex орієнтовний за групою кольору сайту (для підбору найближчого номера).",
        entries,
    };
}

async function fetchCsv(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} ${res.status}`);

    return res.text();
}

function csvToCatalog(def, text) {
    const { id, file, label } = def;
    const entries = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const parts = line.split(",");
        if (parts.length < 5) continue;
        const code = parts[0].trim();
        const name = parts[1].trim();
        const r = Number.parseInt(parts[2], 10);
        const g = Number.parseInt(parts[3], 10);
        const b = Number.parseInt(parts[4], 10);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) continue;
        entries.push({
            code,
            name,
            hex: rgbToHex(r, g, b),
        });
    }

    return {
        id,
        label,
        sourceUrl: `https://github.com/maxcleme/beadcolors/blob/master/raw/${file}`,
        approximateColors: false,
        note: `RGB з відкритого CSV raw/${file} (проєкт beadcolors, MIT).`,
        entries,
    };
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });

    const mdPath = path.join(root, "data", "preciosa-ibeadsmaster.md");
    if (!fs.existsSync(mdPath)) {
        console.error("Missing", mdPath);
        process.exit(1);
    }

    const preciosa = parsePreciosaMd(mdPath);
    fs.writeFileSync(
        path.join(outDir, "preciosa-ibeadsmaster.json"),
        JSON.stringify(preciosa),
        "utf8",
    );
    console.log("preciosa:", preciosa.entries.length, "entries");

    const beadcolorsCatalogs = [];
    for (const def of BEADCOLOR_CSV) {
        const url = `${BEADCOLORS_BASE}/${def.file}`;
        const text = await fetchCsv(url);
        const cat = csvToCatalog(def, text);
        beadcolorsCatalogs.push(cat);
        console.log(cat.id + ":", cat.entries.length, "entries");
    }

    const bundle = {
        repoUrl: "https://github.com/maxcleme/beadcolors",
        catalogs: beadcolorsCatalogs,
    };
    fs.writeFileSync(
        path.join(outDir, "beadcolors-catalogs.json"),
        JSON.stringify(bundle),
        "utf8",
    );

    for (const legacy of ["perler.json", "hama.json"]) {
        const p = path.join(outDir, legacy);
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
