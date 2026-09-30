const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "public", "engine");
const srcDir = path.join(root, "node_modules", "stockfish", "bin");

fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(
  path.join(srcDir, "stockfish-19-lite-single.js"),
  path.join(dest, "stockfish.js"),
);
fs.copyFileSync(
  path.join(srcDir, "stockfish-19-lite-single.wasm"),
  path.join(dest, "stockfish.wasm"),
);
