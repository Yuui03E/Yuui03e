import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "../../store/library";
import type { AniListMedia, StoredEntry } from "../../lib/types";

function CandidateCard({
  media,
  onPick,
  picking,
}: {
  media: AniListMedia;
  onPick: () => void;
  picking: boolean;
}) {
  const cover = media.coverImage.extraLarge || media.coverImage.large || null;
  const color = media.coverImage.color || "#7c5cff";
  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      onClick={onPick}
      disabled={picking}
      className="group relative w-[140px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-yuui-panel text-left disabled:opacity-50"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-3xl"
            style={{
              background: `linear-gradient(160deg, ${color}55, #141420)`,
            }}
          >
            🌸
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-white">
            {media.title.english || media.title.romaji || "Unknown"}
          </div>
          {media.seasonYear && (
            <div className="mt-0.5 text-[10px] text-white/60">
              {media.seasonYear} · {media.format ?? ""}
            </div>
          )}
          {media.averageScore != null && (
            <div className="mt-0.5 text-[10px] text-yuui-accent3">
              ★ {media.averageScore}
            </div>
          )}
        </div>
      </div>
      <div className="grid h-7 place-items-center bg-yuui-accent2/15 text-[11px] font-semibold text-yuui-accent2 transition-colors group-hover:bg-yuui-accent2/30">
        {picking ? "Pinning…" : "Pin this match"}
      </div>
    </motion.button>
  );
}

function SeriesRow({
  entry,
  searchAnilist,
  pinMatch,
}: {
  entry: StoredEntry;
  searchAnilist: (q: string) => Promise<AniListMedia[]>;
  pinMatch: (key: string, media: unknown) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(entry.title);
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  const runSearch = async () => {
    setSearching(true);
    setResults([]);
    try {
      const r = await searchAnilist(query);
      setResults(r);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const pick = async (media: AniListMedia) => {
    setPicking(String(media.id));
    try {
      await pinMatch(entry.key, media);
      setExpanded(false);
    } finally {
      setPicking(null);
    }
  };

  const ownedEps = useMemo(
    () =>
      entry.files
        .map((f) => f.episode)
        .filter(Boolean)
        .join(", ") || "—",
    [entry.files],
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-2xl"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white/90">
            {entry.title}
          </div>
          <div className="mt-0.5 truncate text-xs text-yuui-muted">
            {entry.episode_count} files · eps {ownedEps}
            {entry.release_groups[0] ? ` · ${entry.release_groups[0]}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-yellow-500/15 px-2 py-1 text-[10px] font-semibold text-yellow-300">
            REVIEW
          </span>
          {entry.confidence > 0 && (
            <span className="text-[10px] text-yuui-muted">
              {(entry.confidence * 100).toFixed(0)}% match
            </span>
          )}
          <span className="text-yuui-muted">{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-white/[0.06] p-4"
        >
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search AniList for the correct title…"
              className="glass flex-1 rounded-xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-yuui-muted"
            />
            <button
              onClick={runSearch}
              disabled={searching}
              className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
            >
              {searching ? "…" : "Search"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {results.map((m) => (
                <CandidateCard
                  key={m.id}
                  media={m}
                  onPick={() => pick(m)}
                  picking={picking === String(m.id)}
                />
              ))}
            </div>
          )}

          {!searching && results.length === 0 && expanded && (
            <p className="mt-3 text-xs text-yuui-muted">
              Run a search to see AniList candidates, then pin the correct one.
              Pinned matches survive re-scans.
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function ReviewPage() {
  const { entries, init, searchAnilist, pinMatch } = useLibrary();

  useEffect(() => {
    init();
  }, [init]);

  const review = entries.filter((e) => !e.matched);

  return (
    <div className="flex h-full flex-col pt-5">
      {/* Header */}
      <div className="px-6">
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-4xl font-bold"
        >
          Match <span className="text-gradient">Review</span>
        </motion.h1>
        <p className="mt-1 text-sm text-yuui-muted">
          {review.length > 0
            ? `${review.length} series need your confirmation.`
            : "All series matched — nothing to review. 🎉"}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
        {review.map((entry) => (
          <SeriesRow
            key={entry.key}
            entry={entry}
            searchAnilist={searchAnilist}
            pinMatch={pinMatch}
          />
        ))}

        {review.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="text-5xl">✓</div>
            <p className="text-yuui-muted">Every series has a match.</p>
          </div>
        )}
      </div>
    </div>
  );
}
