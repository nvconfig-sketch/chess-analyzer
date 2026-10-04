"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import type { AnalyzedMove, LoadedGame } from "@/lib/types";
import { CLASSIFICATION_BADGES } from "@/lib/classification-badges";
import { formatWhiteCp, whiteCpFromFen } from "@/lib/eval";
import { gameTitle } from "@/lib/game";

type ExportFormat = "gif" | "webm";
type Speed = "slow" | "normal" | "fast";

type Props = {
  game: LoadedGame;
  analyzed: AnalyzedMove[];
  theme: "dark" | "light";
};

const ExportChessboard = dynamic(
  () => import("react-chessboard").then((module) => module.Chessboard),
  { ssr: false, loading: () => <div className="aspect-square w-full animate-pulse bg-zinc-800" /> },
);

const BOARD_SIZE = 480;
const FRAME_WIDTH = BOARD_SIZE + 32;
const FRAME_HEIGHT = 608;
const FRAME_DURATION: Record<Speed, number> = {
  slow: 1400,
  normal: 900,
  fast: 500,
};

export function GameExport({ game, analyzed, theme }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<ExportFormat>("gif");
  const [speed, setSpeed] = useState<Speed>("normal");
  const [includeArrows, setIncludeArrows] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [framePly, setFramePly] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: game.moves.length + 1 });
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const moves = game.moves;
  const currentMove = framePly > 0 ? moves[framePly - 1] : null;
  const currentAnalysis = framePly > 0 ? analyzed[framePly - 1] : null;
  const fen = currentMove?.afterFen ?? game.startFen;
  const bestMove = includeArrows ? currentAnalysis?.bestMove : null;
  const badge = includeAnnotations && currentMove && currentAnalysis
    ? CLASSIFICATION_BADGES[currentAnalysis.classification]
    : null;

  const openDialog = () => {
    setError(null);
    setDownloadUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    if (exporting) return;
    dialogRef.current?.close();
  };

  const exportGame = async () => {
    if (!frameRef.current || exporting) return;
    setExporting(true);
    setError(null);
    setProgress({ current: 0, total: moves.length + 1 });
    setDownloadUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });

    try {
      const { toCanvas } = await import("html-to-image");
      const gifLibrary = format === "gif" ? await import("gifenc") : null;
      const canvas = document.createElement("canvas");
      canvas.width = FRAME_WIDTH;
      canvas.height = FRAME_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available in this browser.");

      const frameDuration = FRAME_DURATION[speed];
      const frameCount = moves.length + 1;
      const gif = gifLibrary?.GIFEncoder();
      const mediaRecorder = format === "webm" ? createRecorder(canvas) : null;
      mediaRecorderRef.current = mediaRecorder;
      let recorderDone: Promise<Blob> | null = null;

      if (mediaRecorder) {
        recorderDone = new Promise<Blob>((resolve, reject) => {
          const chunks: BlobPart[] = [];
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          };
          mediaRecorder.onerror = () => reject(new Error("Video recording failed in this browser."));
          mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: mediaRecorder.mimeType || "video/webm" }));
        });
        mediaRecorder.start();
      }

      for (let ply = 0; ply < frameCount; ply += 1) {
        setFramePly(ply);
        await waitForPaint();

        const captured = await toCanvas(frameRef.current, {
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          pixelRatio: 1,
          backgroundColor: theme === "dark" ? "#0b0f14" : "#f4f4f5",
        });

        if (format === "gif") {
          const frameContext = captured.getContext("2d", { willReadFrequently: true });
          if (!frameContext) throw new Error("Could not read the rendered board frame.");
          if (!gifLibrary || !gif) throw new Error("GIF encoder is unavailable.");
          const image = frameContext.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
          const palette = gifLibrary.quantize(image.data, 256);
          const indexed = gifLibrary.applyPalette(image.data, palette);
          gif.writeFrame(indexed, FRAME_WIDTH, FRAME_HEIGHT, {
            palette,
            delay: frameDuration,
            repeat: ply === 0 ? 0 : undefined,
          });
        } else {
          context.drawImage(captured, 0, 0, canvas.width, canvas.height);
          await wait(frameDuration);
        }

        setProgress({ current: ply + 1, total: frameCount });
      }

      let blob: Blob;
      if (format === "gif") {
        if (!gif) throw new Error("GIF encoder is unavailable.");
        gif.finish();
        const encoded = gif.bytes();
        const output = new ArrayBuffer(encoded.byteLength);
        new Uint8Array(output).set(encoded);
        blob = new Blob([output], { type: "image/gif" });
      } else {
        if (!mediaRecorder || !recorderDone) throw new Error("WebM recording is not supported by this browser.");
        mediaRecorder.stop();
        blob = await recorderDone;
      }

      const safeTitle = gameTitle(game.headers).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
      const filename = `${safeTitle || "chess-game"}.${format}`;
      setDownloadName(filename);
      setDownloadUrl(URL.createObjectURL(blob));
    } catch (cause) {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      setError(cause instanceof Error ? cause.message : "Could not export this game.");
    } finally {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      setExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Export animation
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (exporting) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
        aria-labelledby="game-export-title"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="game-export-title" className="text-base font-semibold">Export game animation</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Frames use the current board theme, move badges, and selected engine overlays.
              </p>
            </div>
            <button type="button" onClick={closeDialog} disabled={exporting} className="min-h-11 min-w-11 rounded-md text-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800" aria-label="Close export settings">
              ×
            </button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">Format</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <FormatButton selected={format === "gif"} onClick={() => setFormat("gif")}>Animated GIF</FormatButton>
              <FormatButton selected={format === "webm"} onClick={() => setFormat("webm")}>Video (WebM)</FormatButton>
            </div>
          </fieldset>

          <label className="mt-4 block text-sm font-semibold" htmlFor="export-speed">Playback speed</label>
          <select id="export-speed" value={speed} onChange={(event) => setSpeed(event.target.value as Speed)} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>

          <fieldset className="mt-4 space-y-3">
            <legend className="text-sm font-semibold">Overlays</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={includeArrows} onChange={(event) => setIncludeArrows(event.target.checked)} className="size-4 accent-emerald-600" />
              Engine best-move arrows
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={includeAnnotations} onChange={(event) => setIncludeAnnotations(event.target.checked)} className="size-4 accent-emerald-600" />
              Move labels and classification badges
            </label>
          </fieldset>

          {exporting ? (
            <div className="mt-4" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${progress.total ? progress.current / progress.total * 100 : 0}%` }} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Rendering frame {progress.current} of {progress.total}…</p>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">{error}</p> : null}
          {downloadUrl ? (
            <a href={downloadUrl} download={downloadName} className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600">
              Download {downloadName}
            </a>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={closeDialog} disabled={exporting} className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700">Close</button>
            <button type="button" onClick={() => void exportGame()} disabled={exporting} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600">
              {exporting ? "Rendering…" : `Generate ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </dialog>

      <div className="pointer-events-none fixed -left-[2000px] top-0 z-[-1]" aria-hidden="true">
        <div ref={frameRef} style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, boxSizing: "border-box" }} className={`p-4 ${theme === "dark" ? "bg-[#0b0f14] text-zinc-100" : "bg-zinc-100 text-zinc-900"}`}>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Chess Analyzer</p>
              <h2 className="mt-1 text-lg font-semibold">{gameTitle(game.headers)}</h2>
            </div>
            {includeAnnotations && currentMove ? (
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm">{Math.ceil(framePly / 2)}{framePly % 2 ? "." : "..."} {currentMove.san}</p>
                {currentAnalysis ? <p className={`text-xs font-semibold ${badge?.style ?? ""}`}>{currentAnalysis.classification.toUpperCase()}</p> : null}
              </div>
            ) : null}
          </div>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg" style={{ height: BOARD_SIZE }}>
            <ExportChessboard
              options={{
                position: fen,
                boardOrientation: "white",
                allowDragging: false,
                allowDrawingArrows: false,
                arrows: bestMove ? [{ startSquare: bestMove.slice(0, 2), endSquare: bestMove.slice(2, 4), color: "rgba(16, 185, 129, 0.8)" }] : [],
                squareRenderer: ({ children, square }) => {
                  if (!badge || !currentMove || square !== currentMove.to) return <>{children}</>;
                  return <div className="relative h-full w-full">{children}<span className={`pointer-events-none absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold shadow ring-1 ring-white/90 dark:ring-zinc-950/90 ${badge.style}`}>{badge.symbol}</span></div>;
                },
                animationDurationInMs: 0,
                boardStyle: { width: "100%", height: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: "8px" },
                darkSquareStyle: { backgroundColor: theme === "dark" ? "#3d5a4c" : "#769656" },
                lightSquareStyle: { backgroundColor: theme === "dark" ? "#c5d5c0" : "#eeeed2" },
              }}
            />
          </div>
          {includeAnnotations ? (
            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span>{framePly === 0 ? "Starting position" : `Move ${framePly} / ${moves.length}`}</span>
              <span className="font-mono">{currentAnalysis ? formatWhiteCp(whiteCpFromFen(currentAnalysis.afterFen, currentAnalysis.evalAfter)) : ""}</span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function FormatButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium ${selected ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-600 dark:bg-emerald-600" : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"}`}>
      {children}
    </button>
  );
}

function createRecorder(canvas: HTMLCanvasElement): MediaRecorder {
  if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
    throw new Error("Video export is not supported in this browser. Choose Animated GIF instead.");
  }
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error("This browser cannot encode WebM video. Choose Animated GIF instead.");
  return new MediaRecorder(canvas.captureStream(20), { mimeType });
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function wait(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
