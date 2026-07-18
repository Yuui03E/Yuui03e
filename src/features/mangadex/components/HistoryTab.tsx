import { useNavigate } from "react-router-dom";
import { History as HistoryIcon } from "lucide-react";
import type { HistoryRow } from "../api";

interface HistoryTabProps {
  history: HistoryRow[];
  onClear: () => void;
  onBrowse: () => void;
}

/** Recently-read chapters list with a clear button. */
export default function HistoryTab({
  history,
  onClear,
  onBrowse,
}: HistoryTabProps) {
  const navigate = useNavigate();

  return (
    <div className="mt-6 flex-1">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-yuui-muted">
          {history.length} recently-read chapter
          {history.length !== 1 ? "s" : ""}
        </p>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400"
          >
            Clear history
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HistoryIcon className="h-10 w-10 text-yuui-muted/40" />
          <p className="mt-3 text-sm text-yuui-muted">
            No reading history yet. Open a chapter and it'll show up here.
          </p>
          <button
            onClick={onBrowse}
            className="mt-4 rounded-xl bg-yuui-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Find something to read
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <button
              key={h.chapter_id}
              onClick={() => navigate(`/mangadex/reader/${h.chapter_id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-yuui-surface/40 p-3 text-left transition-colors hover:border-white/[0.15]"
            >
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                {h.cover_url ? (
                  <img
                    src={h.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block truncate text-sm font-semibold text-white/90">
                  {h.title ?? "Unknown title"}
                </span>
                <span className="block text-xs text-yuui-muted">
                  Chapter {h.chapter_number ?? "?"} ·{" "}
                  {Math.round(h.progress * 100)}% read ·{" "}
                  {new Date(h.read_at * 1000).toLocaleString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
