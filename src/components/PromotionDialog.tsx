"use client";

type Props = {
  from: string;
  to: string;
  color: "w" | "b";
  onChoose: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
};

const PIECES: Array<{ id: "q" | "r" | "b" | "n"; label: string }> = [
  { id: "q", label: "Queen" },
  { id: "r", label: "Rook" },
  { id: "b", label: "Bishop" },
  { id: "n", label: "Knight" },
];

export function PromotionDialog({ from, to, color, onChoose, onCancel }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-900">
        <p className="text-sm font-semibold">Promote pawn {from}→{to}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PIECES.map((piece) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => onChoose(piece.id)}
              className="min-h-11 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {color === "w" ? piece.label : piece.label.toLowerCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 min-h-11 w-full text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
