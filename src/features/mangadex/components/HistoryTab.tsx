import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, Square, CheckSquare2, Trash2 } from "lucide-react";
import type { HistoryRow } from "../api";
import { deleteHistoryEntries } from "../api";

interface HistoryTabProps {
  history: HistoryRow[];
  cardSize: number;
  onClear: () => void;
  onBrowse: () => void;
  onRefresh: () => void;
}

/** Recently-read chapters list rendered as a grid of large cards with multi-select support. */
export default function HistoryTab({
  history,
  cardSize,
  onClear,
  onBrowse,
  onRefresh,
}: HistoryTabProps) {
  const navigate = useNavigate();
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCardClick = (chapterId: string) => {
    if (isSelectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(chapterId)) {
          next.delete(chapterId);
        } else {
          next.add(chapterId);
        }
        return next;
      });
    } else {
      navigate(`/mangadex/reader/${chapterId}`);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map((h) => h.chapter_id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteHistoryEntries(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete history items:", err);
    }
  };

  return (
    <div className="mt-0 flex-1">
      <div className="mb-3 flex flex-wrap gap-2 items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-yuui-muted">
            {history.length} recently-read chapter
            {history.length !== 1 ? "s" : ""}
          </p>
          {history.length > 0 && !isSelectMode && (
            <button
              onClick={() => setIsSelectMode(true)}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold border border-border bg-white/[0.02] hover:bg-white/[0.06] text-white/80 cursor-pointer"
            >
              Select
            </button>
          )}
          {isSelectMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold border border-border bg-white/[0.02] hover:bg-white/[0.06] text-white/85 cursor-pointer"
              >
                {selectedIds.size === history.length ? "Deselect All" : "Select All"}
              </button>
              <button
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold border border-transparent hover:bg-white/[0.06] text-white/70 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSelectMode && selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer border border-rose-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedIds.size})
            </button>
          )}
          {history.length > 0 && !isSelectMode && (
            <button
              onClick={onClear}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HistoryIcon className="h-10 w-10 text-yuui-muted/40" />
          <p className="mt-3 text-sm text-yuui-muted">
            No reading history yet. Open a chapter and it'll show up here.
          </p>
          <button
            onClick={onBrowse}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white cursor-pointer"
          >
            Find something to read
          </button>
        </div>
      ) : (
        <div
          className="grid gap-6 mt-4"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
          }}
        >
          {history.map((h) => {
            const savedPage = localStorage.getItem(`yuui_md_page_${h.chapter_id}`);
            const isSelected = selectedIds.has(h.chapter_id);

            return (
              <div key={h.chapter_id} className="flex flex-col gap-2 select-none">
                {/* Poster container card */}
                <div 
                  onClick={() => handleCardClick(h.chapter_id)}
                  className={`relative group aspect-[3/4] rounded-xl overflow-hidden border bg-yuui-panel shadow-card cursor-pointer transition-all ${
                    isSelected ? "border-accent ring-2 ring-accent/20" : "border-white/[0.06] hover:border-white/[0.15]"
                  }`}
                >
                  {/* Hover glow */}
                  <div className="absolute -inset-1 rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-40 bg-yuui-accent/30" />
                  
                  {/* Cover Art */}
                  {h.cover_url ? (
                    <img
                      src={h.cover_url}
                      alt={h.title ?? ""}
                      className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                        isSelected ? "scale-[0.98] opacity-80" : ""
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-4xl bg-gradient-to-br from-accent/20 to-[#0f0f16]">📖</div>
                  )}

                  {/* Multi-select checkmark indicator */}
                  {isSelectMode && (
                    <div className="absolute top-2.5 left-2.5 z-30 p-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white">
                      {isSelected ? (
                        <CheckSquare2 className="h-4 w-4 text-accent animate-pulse" />
                      ) : (
                        <Square className="h-4 w-4 opacity-50" />
                      )}
                    </div>
                  )}

                  {/* Chapter badge top-right */}
                  {h.chapter_number && (
                    <div className="absolute right-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur z-10 uppercase tracking-wide">
                      Ch. {h.chapter_number}
                    </div>
                  )}

                  {/* Text Title Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent p-3 pt-8 z-10 pointer-events-none">
                    <span className="line-clamp-2 block text-xs font-bold leading-tight text-white drop-shadow">
                      {h.title ?? "Unknown Title"}
                    </span>
                  </div>

                  {/* Progress Indicator line locked to the bottom edge of the poster cover */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 z-20">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${Math.round(h.progress * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Read metadata information displayed safely below the card */}
                <div className="flex flex-col gap-0.5 px-1 leading-tight text-[11px] text-muted-foreground font-mono">
                  <span className="text-white/75 font-semibold truncate">
                    {savedPage ? `Page ${savedPage}` : `${Math.round(h.progress * 100)}% read`}
                  </span>
                  <span className="text-[9px] opacity-75">
                    {new Date(h.read_at * 1000).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
