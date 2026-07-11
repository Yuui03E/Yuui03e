import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useLibrary } from "../../store/library";
import { pickMultiplePaths, getSetting, setSetting } from "../../lib/api";

export default function SettingsPage() {
  const { folders, addPaths, removePath, init, anilistUser, loginAnilist, logoutAnilist, isSearching, rescan } = useLibrary();
  const [hashMatching, setHashMatching] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadHashSetting() {
      const val = await getSetting("hash_matching");
      if (val === "false") {
        setHashMatching(false);
      } else {
        setHashMatching(true);
      }
    }
    loadHashSetting();
  }, []);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      await loginAnilist(tokenInput.trim());
      setTokenInput("");
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pt-5 pb-8">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-4xl font-bold"
        >
          App <span className="text-gradient">Settings</span>
        </motion.h1>
        <p className="mt-1 text-sm text-yuui-muted">
          Manage your library folders and system diagnostics.
        </p>
      </div>

      <div className="mt-8 flex-1 space-y-6 max-w-3xl">
        {/* Library Section */}
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

        {/* Performance Settings Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2 select-none">
            <span>⚡</span> Performance Options
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            Configure optimization options to speed up scanning or matching times.
          </p>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.04]">
            <div className="flex-1">
              <span className="text-xs text-white/90 font-bold block">
                File Hash Matching (AniDB)
              </span>
              <span className="text-xs text-yuui-muted block mt-1 leading-relaxed">
                Reads the full contents of new video files to compute their ED2K hash for 100% accurate file-level matching on AniDB. <strong>Disabling this speeds up scanning significantly</strong> but relies solely on title parsing for AniList.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hashMatching}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setHashMatching(checked);
                  await setSetting("hash_matching", checked ? "true" : "false");
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white/80 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yuui-accent"></div>
            </label>
          </div>
        </motion.section>

        {/* System Info Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>⚙️</span> System Information
          </h2>
          <div className="mt-4 grid gap-4 grid-cols-2 text-xs">
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">
                Frontend
              </span>
              <span className="text-white/80 font-mono mt-1 block">
                React 19 + Vite 8 + TS
              </span>
            </div>
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">
                Backend Shell
              </span>
              <span className="text-white/80 font-mono mt-1 block">
                Tauri v2 + Rust
              </span>
            </div>
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">
                Local Database
              </span>
              <span className="text-white/80 font-mono mt-1 block">
                SQLite via SQLx
              </span>
            </div>
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">
                Hashing Engine
              </span>
              <span className="text-white/80 font-mono mt-1 block">
                MD4 (ED2K)
              </span>
            </div>
          </div>
        </motion.section>

        {/* AniList Integration Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>🌸</span> AniList Synchronization
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            Connect your AniList account to sync your watch progress, scores, and list status in real-time.
          </p>

          {anilistUser ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.04]">
              <div className="flex items-center gap-3">
                <img
                  src={anilistUser.avatarUrl}
                  alt={anilistUser.name}
                  className="h-10 w-10 rounded-full border border-white/10"
                />
                <div>
                  <span className="text-xs text-yuui-muted font-medium uppercase tracking-wider block">
                    Connected Account
                  </span>
                  <span className="text-sm font-semibold text-white/90 block mt-0.5">
                    {anilistUser.name}
                  </span>
                </div>
              </div>
              <button
                onClick={logoutAnilist}
                className="glass shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-all hover:bg-red-500/10 border border-red-500/20 cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-yuui-muted font-medium uppercase tracking-wider">
                  Personal Access Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Paste AniList token..."
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="flex-1 glass rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/[0.04] bg-white/[0.01]"
                  />
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting || !tokenInput.trim()}
                    className="glass shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
                  >
                    {isConnecting ? "Connecting..." : "Connect"}
                  </button>
                </div>
                {errorMsg && (
                  <span className="text-[11px] font-medium text-red-400 mt-1 block">
                    ⚠ {errorMsg}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-yuui-muted leading-relaxed">
                To connect, go to the{" "}
                <a
                  href="https://anilist.co/settings/developer"
                  target="_blank"
                  rel="noreferrer"
                  className="text-yuui-accent hover:underline font-bold"
                >
                  AniList Developer Settings
                </a>{" "}
                page, click <strong>Create New Token</strong>, copy the generated token, and paste it above.
              </div>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
