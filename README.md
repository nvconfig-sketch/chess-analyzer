# Chess Analyzer

Client-side chess analysis with **Next.js**, **react-chessboard**, **chess.js**, and **Stockfish 19** (WASM). Optional **Gemini** notes explain why a move was strong or weak.

## Run it

Node.js 20+ is required.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Paste PGN, upload a `.pgn` file, or load a FEN
- Step through moves (First / Previous / Next / Last, or arrow keys)
- Play extra moves on the board (including promotion)
- Eval bar plus Stockfish best-move arrow
- Game review tags: book, best, inaccuracy, mistake, blunder, great, brilliant
- AI player personality profile for White, based on analyzed move patterns and evaluation metrics
- `/api/explain` coaching text (Gemini when configured, otherwise a local note)

## Gemini (optional)

Create `.env.local` in the project root:

```
GEMINI_API_KEY=your_key_here
```

Restart `npm run dev`. The API routes use Gemini 2.0 Flash for move explanations and player personality profiles. Move explanations have a local fallback; generating a personality profile requires `GEMINI_API_KEY`. The profile is generated for White from the analyzed PGN metrics; the grandmaster comparison is intended as a tentative style resemblance, not a skill rating.

## Stockfish

The lite single-thread engine is copied to `public/engine/` on `npm install` so the browser can load it as a worker. Full-game review uses depth 12; live eval on the current position uses depth 14.
