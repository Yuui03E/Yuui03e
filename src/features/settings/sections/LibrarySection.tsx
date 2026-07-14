import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useLibrary } from "../../../store/library";
import { pickMultiplePaths } from "../../../lib/api";

export function LibrarySection() {
  const { folders, addPaths, removePath, isSearching, rescan } = useLibrary();

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
    >
      <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2 select-none">
        <span>🗂️</span> Library Folders & Files
      </h2>
      <p className="mt-1 text-xs text-yuui-muted">
        The directories and individual video files scanned to build your local anime library.
      </p>

      {/* Action Buttons */}
      {/* Show a warning + sync status when a sync is in progress */}
      {isSearching && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
          <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin shrink-0" />
          <span className="text-xs text-yellow-200/90 font-medium flex-1">
            Sync in progress — adding or removing folders is paused until the current sync completes.
          </span>
          <button
            onClick={rescan}
            className="text-[10px] font-bold text-yellow-300 hover:text-yellow-200 cursor-pointer uppercase tracking-wider"
          >
            View Status →
          </button>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={async () => {
            const picked = await pickMultiplePaths(true);
            if (picked.length > 0) addPaths(picked);
          }}
          disabled={isSearching}
          className="glass rounded-xl px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.08] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          📁 Add Folders
        </button>
        <button
          onClick={async () => {
            const picked = await pickMultiplePaths(false);
            if (picked.length > 0) addPaths(picked);
          }}
          disabled={isSearching}
          className="glass rounded-xl px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.08] flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          🎬 Add Video Files
        </button>
      </div>

      {/* Path list */}
      <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {folders.map((path) => (
          <div key={path} className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.02] p-3 border border-white/[0.03] hover:bg-white/[0.04] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] text-yuui-muted font-bold uppercase tracking-wider block">
                {path.toLowerCase().endsWith(".mkv") || path.toLowerCase().endsWith(".mp4") || path.toLowerCase().endsWith(".avi") ? "File Path" : "Folder Path"}
              </span>
              <span className="text-xs text-white/80 font-mono truncate block mt-0.5" title={path}>
                {path}
              </span>
            </div>
            <button
              onClick={() => removePath(path)}
              disabled={isSearching}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer select-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </div>
        ))}
        {folders.length === 0 && (
          <div className="text-center py-8 text-xs text-yuui-muted select-none">No folders or files added yet.</div>
        )}
      </div>
    </motion.section>
  );
}
