type Summary = {
  total: number;
  correct: number;
  accuracy: number;
  takeaways: string[];
};

type Props = {
  summary: Summary | null;
  onClose?: () => void;
  onRetry?: () => void;
};

export function MistakeDrillSummary({ summary, onClose, onRetry }: Props) {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl dark:border-emerald-900 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
              Mistake drill complete
            </p>
            <h3 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Review summary
            </h3>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 min-w-10 rounded-md text-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close summary"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Accuracy</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
            {summary.accuracy}%
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.correct} / {summary.total} positions solved correctly
          </p>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Key takeaways</h4>
          <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            {summary.takeaways.map((takeaway) => (
              <li key={takeaway} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 min-h-11 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Retry drill
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
