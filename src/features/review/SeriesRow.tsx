import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen, AlertCircle } from "lucide-react";
import { useDebounce } from "../../lib/hooks/useDebounce";
import type { AniListMedia, StoredEntry } from "../../lib/types";
import CandidateCard from "./CandidateCard";

interface SeriesRowProps {
  entry: StoredEntry;
  searchAnilist: (q: string) => Promise<AniListMedia[]>;
  pinMatch: (key: string, media: unknown) => Promise<void>;
}

export default function SeriesRow({
  entry,
  searchAnilist,
  pinMatch,
}: SeriesRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState(entry.title);
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const latestSearchQuery = useRef("");
  const debouncedQuery = useDebounce(query, 400);

  const runSearch = async (searchVal: string) => {
    if (!searchVal.trim()) return;
    latestSearchQuery.current = searchVal;
    setSearching(true);
    setErrorMsg(null);
    setResults([]);
    try {
      const r = await searchAnilist(searchVal);
      if (latestSearchQuery.current === searchVal) {
        setResults(r);
        if (r.length === 0) {
          setErrorMsg("No results found on AniList for this query.");
        }
      }
    } catch (e: any) {
      if (latestSearchQuery.current === searchVal) {
        setErrorMsg(e?.message || "Failed to search AniList.");
      }
    } finally {
      if (latestSearchQuery.current === searchVal) {
        setSearching(false);
      }
    }
  };

  // Debounced search trigger
  useEffect(() => {
    if (debouncedQuery.trim().length >= 4) {
      runSearch(debouncedQuery);
    } else if (debouncedQuery.trim().length === 0) {
      setResults([]);
    }
  }, [debouncedQuery]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setErrorMsg(null); // Clear error message immediately on keystroke
  };

  // Auto-search on mount when expanded
  useEffect(() => {
    if (expanded && results.length === 0 && query.trim().length >= 3) {
      runSearch(query);
    }
  }, [expanded]);

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
          <span className="flex items-center rounded-md bg-yellow-500/15 px-2 py-1 text-[10px] font-semibold text-yellow-300 leading-none">
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
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
              placeholder="Search AniList for the correct title…"
              className="glass flex-1 rounded-xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-yuui-muted"
            />
            <button
              onClick={() => runSearch(query)}
              disabled={searching}
              className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50 cursor-pointer"
            >
              {searching ? "…" : "Search"}
            </button>
            {entry.files[0]?.path && (
              <button
                onClick={() => revealItemInDir(entry.files[0].path)}
                title="Reveal folder location"
                className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-2 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
              >
                <FolderOpen className="h-5 w-5" />
              </button>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
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

          {errorMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!searching && results.length === 0 && !errorMsg && expanded && (
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
