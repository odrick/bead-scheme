import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBrickGrid,
  extractPalette,
  parseHexColor,
  rgbToCss,
  type BrickCell,
  type RGB,
} from "./beadMath";

const DEFAULT_BG = "#ffffff";
const BG_MATCH_SQ = 55 * 55; // допуск «схожості» на колір фону в RGB
const PALETTE_SAMPLE_STEP = 2;

function loadImageToImageData(
  source: HTMLImageElement | HTMLCanvasElement,
): ImageData {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string,
  dark: string,
  size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const n = Math.ceil(w / size) + 2;
  const m = Math.ceil(h / size) + 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? light : dark;
      ctx.fillRect(x + i * size, y + j * size, size, size);
    }
  }
  ctx.restore();
}

function paintBrickPreview(
  ctx: CanvasRenderingContext2D,
  cells: BrickCell[],
  cellSize: number,
  palette: RGB[],
  options: {
    ignoreBackground: boolean;
    zoom: number;
    pad: number;
    showEmptyAsTransparent: boolean;
  },
) {
  const { zoom, pad, ignoreBackground, showEmptyAsTransparent } = options;
  const cs = cellSize * zoom;
  const radius = cs * 0.48;

  let maxCol = 0;
  for (const cell of cells) {
    maxCol = Math.max(maxCol, cell.col);
  }
  const rows =
    cells.length === 0
      ? 0
      : Math.max(...cells.map((c) => c.row)) + 1;
  const width =
    pad * 2 + (maxCol + 1) * cellSize * zoom + (cellSize * zoom) / 2;
  const height = pad * 2 + rows * cellSize * zoom;

  ctx.canvas.width = Math.max(1, Math.ceil(width));
  ctx.canvas.height = Math.max(1, Math.ceil(height));

  drawCheckerboard(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, "#f0f0f0", "#d8d8d8", 8);

  for (const cell of cells) {
    const ox = (cell.row % 2 === 1 ? cs / 2 : 0) + pad;
    const cx = ox + cell.col * cs + cs / 2;
    const cy = pad + cell.row * cs + cs / 2;

    if (cell.paletteIndex < 0) {
      if (showEmptyAsTransparent && ignoreBackground) {
        drawCheckerboard(
          ctx,
          cx - radius,
          cy - radius,
          radius * 2,
          radius * 2,
          "#e8e8e8",
          "#c8c8c8",
          4,
        );
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      continue;
    }

    const col = palette[cell.paletteIndex];
    ctx.fillStyle = rgbToCss(col);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.5, zoom * 0.35);
    ctx.stroke();
  }
}

export default function App() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<HTMLImageElement | null>(null);
  const [paletteSize, setPaletteSize] = useState(10);
  const [cellSize, setCellSize] = useState(10);
  const [backgroundHex, setBackgroundHex] = useState(DEFAULT_BG);
  const [ignoreBackground, setIgnoreBackground] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(1.2);

  const patternCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);

  const backgroundRgb = useMemo(
    () => parseHexColor(backgroundHex),
    [backgroundHex],
  );

  const onFile = useCallback((f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  useEffect(() => {
    if (!fileUrl) {
      setBitmap(null);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setBitmap(img);
    img.src = fileUrl;
    return () => {
      img.onload = null;
    };
  }, [fileUrl]);

  const { palette, cells } = useMemo(() => {
    if (!bitmap || bitmap.width === 0) {
      return { palette: [] as RGB[], cells: [] as BrickCell[] };
    }
    const imageData = loadImageToImageData(bitmap);
    const pal = extractPalette(imageData, paletteSize, {
      ignoreBackground,
      background: backgroundRgb,
      bgThresholdSq: BG_MATCH_SQ,
      sampleStep: PALETTE_SAMPLE_STEP,
    });
    const gridCells = buildBrickGrid(imageData, cellSize, pal, {
      ignoreBackground,
      background: backgroundRgb,
      bgThresholdSq: BG_MATCH_SQ,
    });
    return { palette: pal, cells: gridCells };
  }, [
    bitmap,
    paletteSize,
    cellSize,
    backgroundRgb,
    ignoreBackground,
  ]);

  useEffect(() => {
    const sc = sourceCanvasRef.current;
    const pc = patternCanvasRef.current;
    if (!sc || !pc || !bitmap) return;

    const sctx = sc.getContext("2d")!;
    const maxW = 420;
    const scale = Math.min(1, maxW / bitmap.width);
    sc.width = Math.round(bitmap.width * scale);
    sc.height = Math.round(bitmap.height * scale);
    sctx.imageSmoothingEnabled = scale < 1;
    sctx.drawImage(bitmap, 0, 0, sc.width, sc.height);

    const pctx = pc.getContext("2d")!;
    paintBrickPreview(pctx, cells, cellSize, palette, {
      ignoreBackground,
      zoom: previewZoom,
      pad: 6,
      showEmptyAsTransparent: true,
    });
  }, [bitmap, cells, cellSize, palette, ignoreBackground, previewZoom]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  return (
    <div className="app">
      <header className="header">
        <h1>Схема для вишивання бісером</h1>
        <p className="sub">
          Палітра з найчастіших кольорів, кірпічна сітка зі зміщенням парних рядів.
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          <label className="field">
            <span className="label">Зображення</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="field">
            <span className="label">
              Кількість кольорів у палітрі:{" "}
              <strong>{paletteSize}</strong>
            </span>
            <input
              type="range"
              min={2}
              max={50}
              value={paletteSize}
              onChange={(e) =>
                setPaletteSize(Number.parseInt(e.target.value, 10))
              }
            />
          </label>

          <label className="field">
            <span className="label">
              Розмір клітинки (px на оригіналі):{" "}
              <strong>{cellSize}</strong>
            </span>
            <input
              type="range"
              min={2}
              max={80}
              value={cellSize}
              onChange={(e) =>
                setCellSize(Number.parseInt(e.target.value, 10))
              }
            />
          </label>

          <label className="field">
            <span className="label">Колір фону (для виключення)</span>
            <input
              type="color"
              value={backgroundHex}
              onChange={(e) => setBackgroundHex(e.target.value)}
            />
          </label>

          <label className="field checkbox">
            <input
              type="checkbox"
              checked={ignoreBackground}
              onChange={(e) => setIgnoreBackground(e.target.checked)}
            />
            <span>
              Не враховувати фон (пікселі близькі до кольору фону не входять у
              палітру і показуються як «дірки»)
            </span>
          </label>

          <label className="field">
            <span className="label">
              Масштаб перегляду схеми:{" "}
              <strong>
                {previewZoom < 1
                  ? previewZoom.toFixed(2)
                  : previewZoom.toFixed(1)}
                ×
              </strong>
            </span>
            <input
              type="range"
              min={0.15}
              max={3}
              step={0.05}
              value={previewZoom}
              onChange={(e) =>
                setPreviewZoom(Number.parseFloat(e.target.value))
              }
            />
          </label>

          <div className="stats">
            <div>
              Бісеринок на схемі:{" "}
              <strong>
                {cells.filter((c) => c.paletteIndex >= 0).length}
              </strong>
            </div>
            <div>
              Клітинок (разом із фоном): <strong>{cells.length}</strong>
            </div>
          </div>
        </aside>

        <main className="main">
          {!bitmap && (
            <p className="hint">Оберіть файл зображення, щоб побачити схему.</p>
          )}
          {bitmap && (
            <div className="previews">
              <div className="preview-block">
                <h2>Оригінал</h2>
                <canvas ref={sourceCanvasRef} className="thumb" />
              </div>
              <div className="preview-block grow">
                <h2>Кірпічна сітка</h2>
                <div className="pattern-wrap">
                  <canvas ref={patternCanvasRef} className="pattern" />
                </div>
              </div>
            </div>
          )}

          {palette.length > 0 && (
            <section className="palette-section">
              <h2>Палітра ({palette.length})</h2>
              <ul className="palette">
                {palette.map((c, i) => (
                  <li key={i} className="swatch" title={`#${i + 1}`}>
                    <span
                      className="dot"
                      style={{ background: rgbToCss(c) }}
                    />
                    <span className="idx">{i + 1}</span>
                    <span className="hex">
                      {c.r.toString(16).padStart(2, "0")}
                      {c.g.toString(16).padStart(2, "0")}
                      {c.b.toString(16).padStart(2, "0")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>

      <style>{`
        .app {
          max-width: min(1760px, calc(100vw - 2rem));
          margin: 0 auto;
          padding: 1.25rem 1rem 2rem;
        }
        .header h1 {
          margin: 0 0 0.35rem;
          font-size: 1.65rem;
          font-weight: 650;
        }
        .sub {
          margin: 0;
          color: #444;
          font-size: 0.95rem;
        }
        .layout {
          display: flex;
          gap: 1.5rem;
          margin-top: 1.25rem;
          align-items: flex-start;
        }
        .panel {
          flex: 0 0 280px;
          background: #faf8f5;
          border: 1px solid #c9c2b8;
          border-radius: 10px;
          padding: 1rem 1rem 1.1rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-bottom: 1rem;
        }
        .field.checkbox {
          flex-direction: row;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .field.checkbox input {
          margin-top: 0.2rem;
        }
        .label {
          font-size: 0.88rem;
          color: #333;
        }
        .main {
          flex: 1;
          min-width: 0;
        }
        .hint {
          color: #555;
        }
        .previews {
          display: grid;
          grid-template-columns: minmax(140px, 240px) minmax(0, 1fr);
          gap: 1.25rem;
          align-items: start;
        }
        .preview-block {
          background: #faf8f5;
          border: 1px solid #c9c2b8;
          border-radius: 10px;
          padding: 0.75rem 1rem 1rem;
        }
        .preview-block.grow {
          min-width: 0;
          width: 100%;
        }
        .preview-block h2 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          font-weight: 600;
        }
        .thumb {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          border: 1px solid #bbb;
        }
        .pattern-wrap {
          overflow: auto;
          width: 100%;
          min-height: 48vh;
          max-height: min(78vh, 900px);
          border-radius: 6px;
          border: 1px solid #bbb;
          background: #fff;
        }
        .pattern {
          display: block;
        }
        .stats {
          font-size: 0.85rem;
          color: #444;
          line-height: 1.5;
        }
        .palette-section {
          margin-top: 1.25rem;
        }
        .palette-section h2 {
          font-size: 1rem;
          margin: 0 0 0.5rem;
        }
        .palette {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .swatch {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: #fff;
          border: 1px solid #c9c2b8;
          border-radius: 8px;
          padding: 0.25rem 0.45rem;
          font-size: 0.78rem;
        }
        .dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .idx {
          font-weight: 600;
          min-width: 1.2em;
        }
        .hex {
          font-family: ui-monospace, monospace;
          color: #555;
        }
        @media (max-width: 800px) {
          .layout {
            flex-direction: column;
          }
          .panel {
            flex: 1;
            width: 100%;
          }
          .previews {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
