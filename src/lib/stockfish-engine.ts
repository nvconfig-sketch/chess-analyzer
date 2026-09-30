import type { EngineScore } from "./types";
import { parseUciScore } from "./eval";

export type EngineAnalysis = {
  bestMove: string | null;
  score: EngineScore | null;
  pv: string[];
  depth: number;
};

type Job = {
  fen: string;
  depth: number;
  resolve: (value: EngineAnalysis) => void;
  reject: (error: Error) => void;
};

export class StockfishEngine {
  private worker: Worker | null = null;
  private boot: Promise<void> | null = null;
  private jobs: Job[] = [];
  private active: Job | null = null;
  private latest: EngineAnalysis = emptyAnalysis();

  async start(): Promise<void> {
    if (this.boot) return this.boot;

    this.boot = new Promise<void>((resolve, reject) => {
      const worker = new Worker("/engine/stockfish.js");
      this.worker = worker;
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };

      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line === "uciok") {
          worker.postMessage("setoption name Hash value 32");
          worker.postMessage("isready");
          return;
        }
        if (line === "readyok" && !this.active) {
          window.clearTimeout(timeout);
          finish();
          return;
        }
        this.handleLine(line);
      };

      worker.onerror = (event) => {
        const error = new Error(event.message || "Stockfish worker error");
        this.active?.reject(error);
        this.active = null;
        finish(error);
      };

      const timeout = window.setTimeout(() => {
        finish(new Error("Stockfish did not become ready in time"));
      }, 20000);

      worker.postMessage("uci");
    });

    try {
      await this.boot;
    } catch (error) {
      this.boot = null;
      this.worker?.terminate();
      this.worker = null;
      throw error;
    }
  }

  async analyze(fen: string, depth = 12): Promise<EngineAnalysis> {
    await this.start();
    return new Promise<EngineAnalysis>((resolve, reject) => {
      this.jobs.push({ fen, depth, resolve, reject });
      this.pump();
    });
  }

  dispose(): void {
    this.jobs.forEach((job) => job.reject(new Error("Engine disposed")));
    this.jobs = [];
    this.active?.reject(new Error("Engine disposed"));
    this.active = null;
    this.worker?.postMessage("quit");
    this.worker?.terminate();
    this.worker = null;
    this.boot = null;
  }

  private handleLine(line: string): void {
    if (line.startsWith("info ")) {
      this.ingestInfo(line);
      return;
    }
    if (line.startsWith("bestmove")) {
      const bestMove = line.split(/\s+/)[1];
      const result: EngineAnalysis = {
        ...this.latest,
        bestMove: bestMove && bestMove !== "(none)" ? bestMove : this.latest.bestMove,
      };
      this.active?.resolve(result);
      this.active = null;
      this.pump();
    }
  }

  private ingestInfo(line: string): void {
    const parts = line.split(/\s+/);
    let score = this.latest.score;
    let depth = this.latest.depth;
    let pv = this.latest.pv;

    for (let i = 0; i < parts.length; i += 1) {
      const token = parts[i];
      if (token === "depth" && parts[i + 1]) depth = Number(parts[i + 1]) || depth;
      else if (token === "score" && parts[i + 1] && parts[i + 2]) {
        score = parseUciScore(parts[i + 1], parts[i + 2]) ?? score;
      } else if (token === "pv") {
        pv = parts.slice(i + 1);
        break;
      }
    }

    this.latest = { ...this.latest, score, depth, pv };
  }

  private pump(): void {
    if (this.active || !this.worker) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.active = job;
    this.latest = emptyAnalysis();
    this.worker.postMessage("ucinewgame");
    this.worker.postMessage(`position fen ${job.fen}`);
    this.worker.postMessage(`go depth ${job.depth}`);
  }
}

function emptyAnalysis(): EngineAnalysis {
  return { bestMove: null, score: null, pv: [], depth: 0 };
}
