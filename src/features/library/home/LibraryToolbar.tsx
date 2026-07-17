import type { Dispatch, SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  FolderX,
} from "lucide-react";
import { pickMultiplePaths } from "../../../lib/api";

export function LibraryToolbar({
  query,
  setQuery,
  searchFocused,
  setSearchFocused,
  rescan,
  busy,
  folder,
  folders,
  addPaths,
  removePath,
  removeFolderOpen,
  setRemoveFolderOpen,
  setToastMsg,
}: {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  searchFocused: boolean;
  setSearchFocused: Dispatch<SetStateAction<boolean>>;
  rescan: () => Promise<void>;
  busy: boolean;
  folder: string | null;
  folders: string[];
  addPaths: (paths: string[]) => Promise<void>;
  removePath: (path: string) => Promise<void>;
  removeFolderOpen: boolean;
  setRemoveFolderOpen: Dispatch<SetStateAction<boolean>>;
  setToastMsg: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <div className="flex flex-col gap-2 px-0 pt-2">
      <div className="flex items-center gap-1.5">
        <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2 min-w-0">
          <Search className="h-3.5 w-3.5 text-yuui-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search by title, genre, studio, resolution, favorites..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-yuui-muted"
          />
          {query && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery("");
              }}
              className="text-yuui-muted hover:text-white text-xs px-1 select-none cursor-pointer shrink-0"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={() => rescan().catch(console.error)}
          disabled={busy || !folder}
          className="glass rounded-xl px-3 py-2 text-xs transition-colors hover:bg-white/[0.08] disabled:opacity-40"
        >
          <span className="flex items-center gap-1.5">
            <RefreshCw
              className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
            />
            Rescan
          </span>
        </button>

        <button
          onClick={async () => {
            const current = folders;
            const paths = await pickMultiplePaths(true);
            if (paths.length === 0) return;
            const dups = paths.filter((p) => current.includes(p));
            const newPaths = paths.filter((p) => !current.includes(p));
            if (newPaths.length > 0) await addPaths(newPaths).catch(console.error);
            if (dups.length > 0) {
              const msg = dups.length === 1
                ? `"${dups[0].split("\\").pop()?.split("/").pop() ?? dups[0]}" is already in your library`
                : `${dups.length} folders already exist in your library`;
              setToastMsg(msg);
              setTimeout(() => setToastMsg(null), 3500);
            }
          }}
          disabled={busy}
          className="glass rounded-xl px-3 py-2 text-xs transition-all duration-300 disabled:opacity-40 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/15 hover:text-emerald-400 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)]"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Folder
          </span>
        </button>

        {/* Remove Folder button */}
        {folders.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setRemoveFolderOpen(!removeFolderOpen)}
              className={`glass rounded-xl px-3 py-2 text-xs transition-all duration-300 disabled:opacity-40 cursor-pointer ${
                removeFolderOpen
                  ? "border-red-500/80 bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                  : "hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)]"
              }`}
              title="Remove a folder"
            >
              <span className="flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </span>
            </button>

            {removeFolderOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setRemoveFolderOpen(false)}
                />
                <div className="absolute top-full mt-1.5 right-0 min-w-[240px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                  {folders.map((p) => (
                    <button
                      key={p}
                      onClick={async () => {
                        await removePath(p).catch(console.error);
                        setRemoveFolderOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left text-white/80 hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <FolderX className="h-3.5 w-3.5 shrink-0 text-red-400/60" />
                      <span className="truncate" title={p}>
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {searchFocused && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-yuui-muted"
          >
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-yuui-accent" /> Filter
              suggestions:
            </span>
            {[
              { label: "favorites", val: "favorites" },
              { label: "genre:Action", val: "genre:Action" },
              { label: "studio:Trigger", val: "studio:Trigger" },
              { label: "year:2018", val: "year:2018" },
              { label: "res:1080p", val: "res:1080p" },
              { label: "codec:h265", val: "codec:h265" },
            ].map((s) => (
              <button
                key={s.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery((prev) => {
                    const trimmed = prev.trim();
                    return trimmed ? `${trimmed} ${s.val}` : s.val;
                  });
                }}
                className="glass px-2 py-0.5 rounded-md hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer text-[10px]"
              >
                {s.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
