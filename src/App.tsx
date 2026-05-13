import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BEAD_CATALOGS,
  formatHexWithHash,
  nearestBead,
  type PreparedBeadCatalog,
} from "./beadCatalog";
import {
  buildBrickGrid,
  extractPalette,
  parseHexColor,
  rgbToCss,
  type BrickCell,
  type GridLayout,
  type RGB,
} from "./beadMath";

const DEFAULT_BG = "#ffffff";
const BG_MATCH_SQ = 55 * 55; // допуск «схожості» на колір фону в RGB
const PALETTE_SAMPLE_STEP = 2;
const CARDINAL_UNITS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];
const CARDINAL_TEENS = [
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const CARDINAL_TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const CARDINAL_HUNDREDS = [
  "",
  "one hundred",
  "two hundred",
  "three hundred",
  "four hundred",
  "five hundred",
  "six hundred",
  "seven hundred",
  "eight hundred",
  "nine hundred",
];
const ORDINAL_UNITS = [
  "",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
];
const ORDINAL_TEENS = [
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
];
const ORDINAL_TENS = {
  20: "twentieth",
  30: "thirtieth",
  40: "fortieth",
  50: "fiftieth",
  60: "sixtieth",
  70: "seventieth",
  80: "eightieth",
  90: "ninetieth",
};

function cardinalToWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || value >= 1000) {
    return String(value);
  }

  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    parts.push(CARDINAL_HUNDREDS[hundreds]);
  }

  if (remainder >= 10 && remainder < 20) {
    parts.push(CARDINAL_TEENS[remainder - 10]);
    return parts.join(" ");
  }

  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;

  if (tens > 0) {
    parts.push(CARDINAL_TENS[tens]);
  }
  if (units > 0) {
    parts.push(CARDINAL_UNITS[units]);
  }

  return parts.join(" ");
}

function ordinalToWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || value >= 1000) {
    return String(value);
  }

  if (value < 10) {
    return ORDINAL_UNITS[value];
  }

  if (value >= 10 && value < 20) {
    return ORDINAL_TEENS[value - 10];
  }

  if (value % 10 === 0) {
    return ORDINAL_TENS[value as keyof typeof ORDINAL_TENS] ?? String(value);
  }

  const units = value % 10;
  const tensWord = CARDINAL_TENS[Math.floor(value / 10)];
  const unitForm = ORDINAL_UNITS[units];

  if (!tensWord || !unitForm) {
    return String(value);
  }

  return `${tensWord}-${unitForm}`;
}

function describeRun(
  count: number,
  paletteIndex: number,
): string {
  return `${cardinalToWords(count)} ${ordinalToWords(paletteIndex + 1)}.`;
}

function describeSkipRun(count: number): string {
  return `Skip ${count}.`;
}

function pluralizeUa(
  value: number,
  form1: string,
  form2: string,
  form5: string,
): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return form5;
  if (last === 1) return form1;
  if (last >= 2 && last <= 4) return form2;
  return form5;
}

type SpeechHighlight = {
  row: number;
  fromCol: number;
  toCol: number;
};

type SpeechStepKind = "run" | "skip" | "row-finished" | "pattern-finished";

type SpeechStep = {
  kind: SpeechStepKind;
  text: string;
  highlight: SpeechHighlight | null;
  count?: number;
  paletteIndex?: number;
};

function buildSpeechSequence(
  cells: BrickCell[],
): SpeechStep[] {
  if (cells.length === 0) return [];

  const rows = new Map<number, BrickCell[]>();
  for (const cell of cells) {
    const row = rows.get(cell.row);
    if (row) {
      row.push(cell);
    } else {
      rows.set(cell.row, [cell]);
    }
  }

  const orderedRows = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, rowCells]) => rowCells.sort((a, b) => a.col - b.col));

  const sequence: SpeechStep[] = [];
  orderedRows.forEach((rowCells) => {
    const runs: {
      paletteIndex: number;
      count: number;
      fromCol: number;
      toCol: number;
    }[] = [];
    const row = rowCells[0]?.row ?? 0;

    for (const cell of rowCells) {
      const last = runs[runs.length - 1];
      if (last && last.paletteIndex === cell.paletteIndex) {
        last.count += 1;
        last.toCol = cell.col;
      } else {
        runs.push({
          paletteIndex: cell.paletteIndex,
          count: 1,
          fromCol: cell.col,
          toCol: cell.col,
        });
      }
    }

    for (const run of runs) {
      if (run.paletteIndex >= 0) {
        sequence.push({
          kind: "run",
          text: describeRun(run.count, run.paletteIndex),
          highlight: {
            row,
            fromCol: run.fromCol,
            toCol: run.toCol,
          },
          count: run.count,
          paletteIndex: run.paletteIndex,
        });
      } else {
        sequence.push({
          kind: "skip",
          text: describeSkipRun(run.count),
          highlight: null,
          count: run.count,
        });
      }
    }

    sequence.push({ kind: "row-finished", text: "Row finished.", highlight: null });
  });

  if (sequence.length > 0) {
    sequence.push({
      kind: "pattern-finished",
      text: "Pattern finished.",
      highlight: null,
    });
  }

  return sequence;
}

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
    layout: GridLayout;
    activeHighlight?: SpeechHighlight | null;
  },
) {
  const {
    zoom,
    pad,
    ignoreBackground,
    showEmptyAsTransparent,
    layout,
    activeHighlight = null,
  } = options;
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
    layout === "brick"
      ? pad * 2 + (maxCol + 1) * cs + cs / 2
      : pad * 2 + (maxCol + 1) * cs;
  const height = pad * 2 + rows * cellSize * zoom;

  ctx.canvas.width = Math.max(1, Math.ceil(width));
  ctx.canvas.height = Math.max(1, Math.ceil(height));

  drawCheckerboard(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, "#f0f0f0", "#d8d8d8", 8);

  for (const cell of cells) {
    const ox =
      (layout === "brick" && cell.row % 2 === 1 ? cs / 2 : 0) + pad;
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
    const isActive =
      activeHighlight !== null &&
      cell.row === activeHighlight.row &&
      cell.col >= activeHighlight.fromCol &&
      cell.col <= activeHighlight.toCol;

    ctx.save();
    if (activeHighlight !== null && !isActive) {
      ctx.globalAlpha = 0.35;
    }
    ctx.fillStyle = rgbToCss(col);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.5, zoom * 0.35);
    ctx.stroke();
    ctx.restore();

    if (isActive) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius + Math.max(1.5, cs * 0.08), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 222, 89, 0.95)";
      ctx.lineWidth = Math.max(1.5, zoom * 1.15);
      ctx.shadowColor = "rgba(255, 222, 89, 0.7)";
      ctx.shadowBlur = Math.max(8, cs * 0.55);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius + Math.max(0.5, cs * 0.03), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(1, zoom * 0.7);
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
    }
  }
}

export default function App() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<HTMLImageElement | null>(null);
  const [isUploadDragOver, setIsUploadDragOver] = useState(false);
  const [isOriginalDragOver, setIsOriginalDragOver] = useState(false);
  const [paletteSize, setPaletteSize] = useState(10);
  const [beadsPerRow, setBeadsPerRow] = useState(60);
  const [gridLayout, setGridLayout] = useState<GridLayout>("brick");
  const [backgroundHex, setBackgroundHex] = useState(DEFAULT_BG);
  const [ignoreBackground, setIgnoreBackground] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(1.2);
  const [useManufacturerPalette, setUseManufacturerPalette] = useState(false);
  const [speechPauseMs, setSpeechPauseMs] = useState(900);
  const [speechAutoPause, setSpeechAutoPause] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [activeSpeechStepIndex, setActiveSpeechStepIndex] = useState<number | null>(
    null,
  );
  const [beadCatalogId, setBeadCatalogId] = useState(
    BEAD_CATALOGS[0]?.id ?? "preciosa-ibeadsmaster",
  );

  const patternCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechTokenRef = useRef(0);
  const speechPauseTimeoutRef = useRef<number | null>(null);
  const speechPauseMsRef = useRef(speechPauseMs);
  const speechAutoPauseRef = useRef(speechAutoPause);
  const speechNextStepIndexRef = useRef(0);
  const speechPauseAfterCurrentRef = useRef(false);
  const prevSpeechStepsRef = useRef<SpeechStep[] | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);

  const backgroundRgb = useMemo(
    () => parseHexColor(backgroundHex),
    [backgroundHex],
  );

  const beadCatalog: PreparedBeadCatalog = useMemo(() => {
    return (
      BEAD_CATALOGS.find((c) => c.id === beadCatalogId) ?? BEAD_CATALOGS[0]
    );
  }, [beadCatalogId]);

  const onFile = useCallback((f: File | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    const url = URL.createObjectURL(f);
    setFileUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const onDropFile = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsUploadDragOver(false);
      setIsOriginalDragOver(false);
      onFile(e.dataTransfer.files?.[0] ?? null);
    },
    [onFile],
  );

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

  const cellSizePx = useMemo(() => {
    if (!bitmap || bitmap.width <= 0) return 1;
    return bitmap.width / Math.max(2, beadsPerRow);
  }, [bitmap, beadsPerRow]);

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
    const gridCells = buildBrickGrid(imageData, cellSizePx, pal, {
      ignoreBackground,
      background: backgroundRgb,
      bgThresholdSq: BG_MATCH_SQ,
      layout: gridLayout,
    });
    return { palette: pal, cells: gridCells };
  }, [
    bitmap,
    paletteSize,
    cellSizePx,
    backgroundRgb,
    ignoreBackground,
    gridLayout,
  ]);

  const beadMatches = useMemo(() => {
    return palette.map((c) => nearestBead(c, beadCatalog));
  }, [palette, beadCatalog]);

  const patternPalette = useMemo(() => {
    if (!useManufacturerPalette) return palette;
    return palette.map((c, i) => {
      const m = beadMatches[i];
      return m?.beadHex ? parseHexColor(m.beadHex) : c;
    });
  }, [palette, beadMatches, useManufacturerPalette]);
  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const hasPattern = useMemo(
    () => cells.some((cell) => cell.paletteIndex >= 0),
    [cells],
  );
  const speechSteps = useMemo(() => buildSpeechSequence(cells), [cells]);
  const activeSpeechStep =
    activeSpeechStepIndex === null ? null : speechSteps[activeSpeechStepIndex] ?? null;
  const activeSpeechHighlight =
    activeSpeechStepIndex === null
      ? null
      : speechSteps[activeSpeechStepIndex]?.highlight ?? null;
  const currentSpeechStatusText = useMemo(() => {
    if (!activeSpeechStep) {
      if (isSpeechPaused) return "Начитування на паузі.";
      return "Начитування не запущене.";
    }

    if (activeSpeechStep.kind === "run") {
      const count = activeSpeechStep.count ?? 0;
      const paletteIndex = activeSpeechStep.paletteIndex ?? 0;
      const color = patternPalette[paletteIndex] ?? palette[paletteIndex];
      const colorText = color
        ? `кольору ${paletteIndex + 1}`
        : `кольору ${paletteIndex + 1}`;
      const beadsText = `${count} ${pluralizeUa(
        count,
        "бісеринка",
        "бісеринки",
        "бісеринок",
      )}`;
      return isSpeaking
        ? `${beadsText} ${colorText}.`
        : `${beadsText} ${colorText}.`;
    }

    if (activeSpeechStep.kind === "skip") {
      const count = activeSpeechStep.count ?? 0;
      const cellsText = `${count} ${pluralizeUa(
        count,
        "клітинка",
        "клітинки",
        "клітинок",
      )}`;
      return isSpeaking
        ? `Пропуск на ${cellsText}.`
        : `Пропуск на ${cellsText}.`;
    }

    if (activeSpeechStep.kind === "row-finished") {
      return isSpeaking
        ? "Завершення ряду."
        : "Завершення ряду.";
    }

    return isSpeaking
      ? "Завершення схеми."
      : "Завершення схеми.";
  }, [activeSpeechStep, isSpeaking, isSpeechPaused, palette, patternPalette]);
  const preferredSpeechVoice = useMemo(() => {
    const englishVoices = speechVoices.filter((voice) =>
      voice.lang.toLowerCase().startsWith("en"),
    );

    return (
      englishVoices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
      englishVoices[0] ??
      null
    );
  }, [speechVoices]);

  useEffect(() => {
    speechPauseMsRef.current = speechPauseMs;
  }, [speechPauseMs]);

  useEffect(() => {
    speechAutoPauseRef.current = speechAutoPause;
  }, [speechAutoPause]);

  useEffect(() => {
    if (!speechSupported) return;

    const synth = window.speechSynthesis;
    const updateVoices = () => setSpeechVoices(synth.getVoices());

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);
    return () => synth.removeEventListener("voiceschanged", updateVoices);
  }, [speechSupported]);

  const resetSpeech = useCallback(() => {
    speechTokenRef.current += 1;
    speechNextStepIndexRef.current = 0;
    speechPauseAfterCurrentRef.current = false;

    if (speechPauseTimeoutRef.current !== null) {
      window.clearTimeout(speechPauseTimeoutRef.current);
      speechPauseTimeoutRef.current = null;
    }

    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    setActiveSpeechStepIndex(null);
    setIsSpeechPaused(false);
    setIsSpeaking(false);
  }, [speechSupported]);

  const pauseSpeech = useCallback(() => {
    if (!isSpeaking) return;

    if (speechPauseTimeoutRef.current !== null) {
      window.clearTimeout(speechPauseTimeoutRef.current);
      speechPauseTimeoutRef.current = null;
      speechPauseAfterCurrentRef.current = false;
      if (speechNextStepIndexRef.current < speechSteps.length) {
        setIsSpeechPaused(true);
      } else {
        speechNextStepIndexRef.current = 0;
        setActiveSpeechStepIndex(null);
        setIsSpeechPaused(false);
      }
      setIsSpeaking(false);
      return;
    }

    speechPauseAfterCurrentRef.current = true;
  }, [isSpeaking, speechSteps.length]);

  const startSpeech = useCallback(() => {
    if (!speechSupported || speechSteps.length === 0) return;

    speechTokenRef.current += 1;
    speechPauseAfterCurrentRef.current = false;

    if (speechPauseTimeoutRef.current !== null) {
      window.clearTimeout(speechPauseTimeoutRef.current);
      speechPauseTimeoutRef.current = null;
    }

    if (speechSupported) {
      window.speechSynthesis.cancel();
    }

    const token = speechTokenRef.current;
    const synth = window.speechSynthesis;
    const voice =
      preferredSpeechVoice ??
      synth
        .getVoices()
        .find((candidate) => candidate.lang.toLowerCase().startsWith("en")) ??
      null;
    const resumeFromPaused =
      isSpeechPaused && speechNextStepIndexRef.current < speechSteps.length;

    if (!resumeFromPaused) {
      speechNextStepIndexRef.current = 0;
      setActiveSpeechStepIndex(null);
    }

    const speakNext = () => {
      if (speechTokenRef.current !== token) return;

      const index = speechNextStepIndexRef.current;
      const step = speechSteps[index];
      if (!step) {
        speechNextStepIndexRef.current = 0;
        setActiveSpeechStepIndex(null);
        setIsSpeechPaused(false);
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(step.text);
      utterance.lang = voice?.lang ?? "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        if (speechTokenRef.current !== token) return;
        setActiveSpeechStepIndex(index);
      };

      utterance.onend = () => {
        if (speechTokenRef.current !== token) return;

        const nextIndex = index + 1;
        speechNextStepIndexRef.current = nextIndex;

        if (speechPauseAfterCurrentRef.current) {
          speechPauseAfterCurrentRef.current = false;
          if (nextIndex < speechSteps.length) {
            setIsSpeechPaused(true);
            setIsSpeaking(false);
            return;
          }

          speechNextStepIndexRef.current = 0;
          setActiveSpeechStepIndex(null);
          setIsSpeechPaused(false);
          setIsSpeaking(false);
          return;
        }

        if (nextIndex >= speechSteps.length) {
          speechNextStepIndexRef.current = 0;
          setActiveSpeechStepIndex(null);
          setIsSpeechPaused(false);
          setIsSpeaking(false);
          return;
        }

        if (
          speechAutoPauseRef.current &&
          step.kind !== "row-finished"
        ) {
          setIsSpeechPaused(true);
          setIsSpeaking(false);
          return;
        }

        const pauseMs = speechPauseMsRef.current;
        if (pauseMs <= 0) {
          speakNext();
          return;
        }

        speechPauseTimeoutRef.current = window.setTimeout(() => {
          speechPauseTimeoutRef.current = null;
          speakNext();
        }, pauseMs);
      };

      utterance.onerror = () => {
        if (speechTokenRef.current !== token) return;
        speechNextStepIndexRef.current = 0;
        speechPauseAfterCurrentRef.current = false;
        setActiveSpeechStepIndex(null);
        setIsSpeechPaused(false);
        setIsSpeaking(false);
      };

      synth.speak(utterance);
    };

    setIsSpeechPaused(false);
    setIsSpeaking(true);
    speakNext();
  }, [isSpeechPaused, preferredSpeechVoice, speechSteps, speechSupported]);

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      pauseSpeech();
      return;
    }
    startSpeech();
  }, [isSpeaking, pauseSpeech, startSpeech]);

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
    paintBrickPreview(pctx, cells, cellSizePx, patternPalette, {
      ignoreBackground,
      zoom: previewZoom,
      pad: 6,
      showEmptyAsTransparent: true,
      layout: gridLayout,
      activeHighlight: activeSpeechHighlight,
    });
  }, [
    bitmap,
    cells,
    cellSizePx,
    palette,
    patternPalette,
    ignoreBackground,
    previewZoom,
    gridLayout,
    activeSpeechHighlight,
  ]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  useEffect(() => resetSpeech, [resetSpeech]);

  useEffect(() => {
    if (
      prevSpeechStepsRef.current !== null &&
      prevSpeechStepsRef.current !== speechSteps
    ) {
      resetSpeech();
    }

    prevSpeechStepsRef.current = speechSteps;
  }, [speechSteps, resetSpeech]);

  useEffect(() => {
    if (!hasPattern) {
      resetSpeech();
    }
  }, [hasPattern, resetSpeech]);

  useEffect(() => {
    if (!hasPattern) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        tagName === "BUTTON"
      ) {
        return;
      }

      event.preventDefault();
      toggleSpeech();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasPattern, toggleSpeech]);

  return (
    <div className="app">
      <div className="layout">
        <div className="top-row">
          <aside className="panel">
            <label
              className={`field upload-field ${isUploadDragOver ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsUploadDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsUploadDragOver(false);
              }}
              onDrop={onDropFile}
            >
              <span className="label">Зображення</span>
              <input
                ref={fileInputRef}
                className="upload-input-hidden"
                type="file"
                accept="image/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <input
                type="button"
                className="upload-button"
                value="Обрати зображення"
                onClick={() => fileInputRef.current?.click()}
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
                Кількість бісеринок у ряду: <strong>{beadsPerRow}</strong>
              </span>
              <input
                type="range"
                min={2}
                max={400}
                value={beadsPerRow}
                onChange={(e) =>
                  setBeadsPerRow(Number.parseInt(e.target.value, 10))
                }
              />
            </label>

            <div className="field">
              <span className="label">Тип сітки схеми</span>
              <div className="layout-toggle">
                <label className="layout-option">
                  <input
                    type="radio"
                    name="gridLayout"
                    checked={gridLayout === "brick"}
                    onChange={() => setGridLayout("brick")}
                  />
                  Цегла
                </label>
                <label className="layout-option">
                  <input
                    type="radio"
                    name="gridLayout"
                    checked={gridLayout === "straight"}
                    onChange={() => setGridLayout("straight")}
                  />
                  Пряма
                </label>
              </div>
            </div>

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
              <span>Не враховувати фон</span>
            </label>

            <label className="field">
              <span className="label">Виробник</span>
              <select
                className="select-catalog"
                value={beadCatalog.id}
                onChange={(e) => setBeadCatalogId(e.target.value)}
              >
                {BEAD_CATALOGS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {beadCatalog.approximateColors ? null : (
                <span className="catalog-hint">
                  RGB з відкритого CSV у{" "}
                  <a
                    href={beadCatalog.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    beadcolors
                  </a>
                  .
                </span>
              )}
            </label>

            <label className="field checkbox">
              <input
                type="checkbox"
                checked={useManufacturerPalette}
                onChange={(e) => setUseManufacturerPalette(e.target.checked)}
              />
              <span>В палітрі виробника</span>
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
                min={0.01}
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

          <section
            className={`preview-block preview-original ${isOriginalDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsOriginalDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsOriginalDragOver(false);
            }}
            onDrop={onDropFile}
          >
            <h2>Оригінал</h2>
            {!bitmap && (
              <p className="hint">
                Оберіть файл зображення або перетягніть його сюди.
              </p>
            )}
            {bitmap && <canvas ref={sourceCanvasRef} className="thumb" />}
          </section>

          <section className="preview-block preview-scheme">
            <div className="preview-header">
              <h2>Схема</h2>
              {hasPattern && (
                <div className="speech-controls">
                  <button
                    type="button"
                    className="speech-toggle"
                    onClick={toggleSpeech}
                    disabled={!speechSupported}
                  >
                    {isSpeaking ? "Стоп" : "Старт"}
                  </button>
                  <span className="speech-shortcut">Space</span>
                </div>
              )}
            </div>
            {hasPattern && (
              <div className="speech-panel">
                <label className="field speech-field">
                  <span className="label">
                    Пауза між фразами:{" "}
                    <strong>{(speechPauseMs / 1000).toFixed(1)} с</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={0.1}
                    value={speechPauseMs / 1000}
                    onChange={(e) =>
                      setSpeechPauseMs(
                        Math.round(Number.parseFloat(e.target.value) * 1000),
                      )
                    }
                  />
                </label>
                <label className="field checkbox speech-checkbox">
                  <input
                    type="checkbox"
                    checked={speechAutoPause}
                    onChange={(e) => setSpeechAutoPause(e.target.checked)}
                  />
                  <span>
                    <span className="label">Автоматична пауза</span>
                  </span>
                </label>
                <p className="speech-status">{currentSpeechStatusText}</p>
                {!speechSupported && (
                  <p className="speech-hint speech-error">
                    У цьому браузері озвучення недоступне.
                  </p>
                )}
              </div>
            )}
            <div className="pattern-wrap">
              <canvas ref={patternCanvasRef} className="pattern" />
            </div>
          </section>
        </div>

        {palette.length > 0 && (
          <section className="palette-section">
            <h2>Палітра ({palette.length})</h2>
            <ul className="palette">
              {palette.map((c, i) => {
                const m = beadMatches[i];
                return (
                  <li key={i} className="swatch" title={`Слот ${i + 1}`}>
                    <span className="dot" style={{ background: rgbToCss(c) }} />
                    <span className="idx">{i + 1}</span>
                    <span className="hex">{formatHexWithHash(c)}</span>
                    {m && (
                      <span className="bead-match">
                        <span className="bead-code" title="Найближчий номер">
                          № {m.code}
                        </span>
                        <span
                          className="bead-cat-hex"
                          title="Колір у каталозі для підбору"
                        >
                          {m.beadHex}
                        </span>
                        {m.name ? (
                          <span className="bead-name">{m.name}</span>
                        ) : null}
                        <span className="bead-de" title="ΔE (CIE76)">
                          ΔE {m.deltaE.toFixed(1)}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <style>{`
        :global(html),
        :global(body) {
          color-scheme: dark;
        }

        .app {
          --bg: rgba(18, 20, 24, 0.78);
          --card: rgba(22, 24, 28, 0.72);
          --card-strong: rgba(26, 28, 33, 0.82);
          --border: rgba(255, 255, 255, 0.12);
          --muted: rgba(255, 255, 255, 0.78);
          --muted2: rgba(255, 255, 255, 0.58);
          --shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
          --shadow-soft: 0 14px 34px rgba(0, 0, 0, 0.46);
          --radius: 14px;
          --radius-sm: 12px;
          --accent: #a1a1aa;
          --accent-2: #d4d4d8;

          max-width: none;
          margin: 0;
          margin-left: 10px;
          margin-right: 10px;
          padding: 0;
          border-radius: 0;
          background: var(--bg);
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }

        .header h1 {
          margin: 0 0 0.35rem;
          font-size: 1.7rem;
          font-weight: 720;
          letter-spacing: -0.02em;
          color: rgba(255, 255, 255, 0.92);
        }
        .sub {
          margin: 0;
          color: var(--muted);
          font-size: 0.98rem;
          line-height: 1.4;
        }

        .layout {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 0;
          padding-top: 1.15rem;
        }

        .top-row {
          display: grid;
          grid-template-columns: 320px minmax(180px, 320px) minmax(0, 1fr);
          gap: 1rem;
          height: 80vh;
          align-items: stretch;
          min-width: 0;
          min-height: 0;
        }

        .panel {
          flex: 0 0 320px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem 1rem 1.1rem;
          box-shadow: var(--shadow-soft);
          position: static;
          height: 100%;
          overflow: auto;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-bottom: 1rem;
        }
        .field.checkbox {
          flex-direction: row;
          align-items: flex-start;
          gap: 0.55rem;
        }
        .field.checkbox input {
          margin-top: 0.18rem;
          accent-color: var(--accent);
        }

        .label {
          font-size: 0.88rem;
          color: rgba(226, 232, 240, 0.82);
        }
        .cell-derive {
          font-weight: 450;
          font-size: 0.8rem;
          color: var(--muted2);
        }

        input[type="file"],
        input[type="color"],
        select {
          width: 100%;
        }

        input[type="file"] {
          padding: 0.45rem 0.55rem;
          background: var(--card-strong);
          border-radius: 10px;
          border: 1px solid var(--border);
          color: rgba(255, 255, 255, 0.88);
        }

        input[type="color"] {
          height: 38px;
          padding: 0.15rem;
          background: var(--card-strong);
          border-radius: 10px;
          border: 1px solid var(--border);
        }

        input[type="range"] {
          width: 100%;
          accent-color: var(--accent);
        }

        /* Consistent dark range styling (Chrome/Edge/Safari/Firefox) */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 34px;
          background: transparent;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          margin-top: -6px;
          border-radius: 999px;
          background: var(--accent);
          border: 1px solid var(--accent);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
        }
        input[type="range"]:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.22);
          outline-offset: 4px;
          border-radius: 12px;
        }
        input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: var(--accent);
          border: 1px solid var(--accent);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
        }

        .layout-toggle {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .layout-option {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.86rem;
          color: rgba(226, 232, 240, 0.82);
          cursor: pointer;
        }
        .layout-option input {
          margin-top: 0.15rem;
          accent-color: var(--accent);
        }

        .select-catalog {
          padding: 0.5rem 0.65rem;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-size: 0.9rem;
          background: var(--card-strong);
          color: rgba(255, 255, 255, 0.88);
        }
        .select-catalog:focus {
          outline: 2px solid rgba(255, 255, 255, 0.18);
          outline-offset: 2px;
        }

        .catalog-hint {
          font-size: 0.76rem;
          color: var(--muted2);
          line-height: 1.35;
        }
        .catalog-hint a {
          color: rgba(226, 232, 240, 0.9);
          text-decoration-color: rgba(255, 255, 255, 0.25);
        }

        .upload-field {
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          background: var(--card);
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .upload-input-hidden {
          display: none;
        }
        .upload-button {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(226, 232, 240, 0.92);
          border-radius: 10px;
          padding: 0.52rem 0.7rem;
          font-size: 0.9rem;
          font-weight: 650;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .upload-button:hover {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
        }
        .upload-hint {
          font-size: 0.8rem;
          color: rgba(226, 232, 240, 0.62);
        }

        .hint {
          color: rgba(226, 232, 240, 0.7);
        }

        .drag-over {
          border-color: rgba(125, 211, 252, 0.8) !important;
          box-shadow:
            inset 0 0 0 1px rgba(125, 211, 252, 0.45),
            0 0 0 2px rgba(125, 211, 252, 0.12);
          background: rgba(12, 74, 110, 0.2) !important;
        }

        .preview-block {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem 1rem 1rem;
          box-shadow: var(--shadow-soft);
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
        }
        .preview-block h2 {
          margin: 0 0 0.6rem;
          font-size: 0.98rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: rgba(226, 232, 240, 0.9);
        }
        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.6rem;
        }
        .preview-header h2 {
          margin: 0;
        }
        .speech-controls {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .speech-toggle {
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: rgba(226, 232, 240, 0.92);
          border-radius: 10px;
          padding: 0.45rem 0.9rem;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .speech-toggle:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.12);
        }
        .speech-toggle:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .speech-shortcut {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.74rem;
          color: rgba(226, 232, 240, 0.62);
          padding: 0.2rem 0.45rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .speech-panel {
          margin-bottom: 0.75rem;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(2, 6, 23, 0.32);
        }
        .speech-field {
          margin-bottom: 0.55rem;
        }
        .speech-checkbox {
          margin-bottom: 0.55rem;
        }
        .speech-hint {
          margin: 0;
          font-size: 0.77rem;
          line-height: 1.45;
          color: rgba(226, 232, 240, 0.64);
        }
        .speech-status {
          margin: 0;
          padding: 0.62rem 0.7rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 0.8rem;
          line-height: 1.45;
          color: rgba(241, 245, 249, 0.92);
        }
        .speech-hint + .speech-hint {
          margin-top: 0.3rem;
        }
        .speech-error {
          color: rgba(252, 165, 165, 0.88);
        }

        .thumb {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.32);
        }

        .pattern-wrap {
          overflow: auto;
          width: 100%;
          min-width: 0;
          min-height: 0;
          flex: 1 1 0;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: var(--card);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        .pattern {
          display: block;
        }

        .stats {
          font-size: 0.86rem;
          color: rgba(226, 232, 240, 0.74);
          line-height: 1.55;
        }

        .palette-section {
          margin-top: 0;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.85rem 1rem 1rem;
          box-shadow: var(--shadow-soft);
          min-width: 0;
        }
        .palette-section h2 {
          font-size: 0.98rem;
          margin: 0 0 0.6rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: rgba(226, 232, 240, 0.9);
        }

        .palette {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .swatch {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.35rem 0.5rem;
          background: rgba(2, 6, 23, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 0.45rem 0.55rem;
          font-size: 0.78rem;
          max-width: 100%;
        }

        .dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 10px 18px rgba(0, 0, 0, 0.35);
          flex-shrink: 0;
        }
        .idx {
          font-weight: 750;
          min-width: 1.2em;
          color: rgba(226, 232, 240, 0.9);
        }
        .hex {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color: rgba(226, 232, 240, 0.62);
        }

        .bead-match {
          display: inline-flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem 0.5rem;
          padding-left: 0.45rem;
          border-left: 1px solid rgba(148, 163, 184, 0.16);
          margin-left: 0.05rem;
        }
        .bead-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.86);
        }
        .bead-cat-hex {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.72rem;
          color: rgba(226, 232, 240, 0.62);
        }
        .bead-name {
          color: rgba(226, 232, 240, 0.68);
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bead-de {
          font-size: 0.72rem;
          color: rgba(226, 232, 240, 0.5);
        }

        @media (max-width: 800px) {
          .app {
            max-width: calc(100vw - 1.25rem);
            padding: 1rem;
          }
          .top-row {
            grid-template-columns: 1fr;
            height: auto;
          }
          .panel {
            height: auto;
          }
          .preview-block {
            height: auto;
          }
        }
      `}</style>
    </div>
  );
}
