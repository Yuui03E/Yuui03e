import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "../../../store/library";
import { getSetting, setSetting, testTmdbKey } from "../../../lib/api";
import { ToggleSwitch } from "../components/ToggleSwitch";

export function TmdbSection() {
  const imageBackdropEnabled = useLibrary((s) => s.imageBackdropEnabled);
  const setImageBackdropEnabled = useLibrary((s) => s.setImageBackdropEnabled);

  const [tmdbKey, setTmdbKey] = useState("");
  const [tmdbTesting, setTmdbTesting] = useState(false);
  // null = untested; "valid"/"invalid" = last validation result.
  const [tmdbStatus, setTmdbStatus] = useState<"valid" | "invalid" | null>(null);
  const [tmdbMsg, setTmdbMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadTmdbKey() {
      const val = await getSetting("tmdb_api_key");
      if (val) {
        setTmdbKey(val);
        // Confirm the saved key is still accepted so the user sees live status.
        setTmdbTesting(true);
        try {
          await testTmdbKey(val);
          setTmdbStatus("valid");
          setTmdbMsg("API key verified — high-res backgrounds are active.");
        } catch (e) {
          setTmdbStatus("invalid");
          setTmdbMsg(String(e));
        } finally {
          setTmdbTesting(false);
        }
      }
    }
    loadTmdbKey();
  }, []);

  // Validate the key against TMDB, then persist it only if accepted.
  const handleSaveTmdb = async () => {
    const key = tmdbKey.trim();
    setTmdbTesting(true);
    setTmdbStatus(null);
    setTmdbMsg(null);
    if (!key) {
      // Empty = user is clearing the key. Save it and revert to AniList banner.
      await setSetting("tmdb_api_key", "");
      setTmdbStatus(null);
      setTmdbMsg("Key cleared — using the AniList banner.");
      setTmdbTesting(false);
      return;
    }
    try {
      await testTmdbKey(key);
      await setSetting("tmdb_api_key", key);
      setTmdbStatus("valid");
      setTmdbMsg("API key accepted and saved.");
    } catch (e) {
      // Rejected — do NOT save, so a bad key can't silently disable backgrounds.
      setTmdbStatus("invalid");
      setTmdbMsg(String(e));
    } finally {
      setTmdbTesting(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
    >
      <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
        <span>🖼️</span> High-Res Backgrounds (TMDB)
        {tmdbTesting ? (
          <span className="ml-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-yuui-muted">
            Checking…
          </span>
        ) : tmdbStatus === "valid" ? (
          <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
            ● Connected
          </span>
        ) : tmdbStatus === "invalid" ? (
          <span className="ml-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20">
            ● Rejected
          </span>
        ) : null}
      </h2>
      <p className="mt-1 text-xs text-yuui-muted">
        AniList provides only one low-res banner per series. Add a free TMDB API
        key to pull full-resolution landscape artwork for the detail-page
        background — multiple images crossfade in a live slideshow.
      </p>

      {/* Master toggle — off by default (live animated background only). */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.04]">
        <div className="flex-1">
          <span className="text-xs text-white/90 font-bold block">
            Use anime image background
          </span>
          <span className="text-xs text-yuui-muted block mt-1 leading-relaxed">
            When on, opening an anime shows its artwork in the background of that
            detail page. When off, the app keeps its <strong>live animated background</strong> everywhere (default).
          </span>
        </div>
        <ToggleSwitch
          checked={imageBackdropEnabled}
          onChange={(e) => setImageBackdropEnabled(e.target.checked)}
        />
      </div>

      <div className={`mt-4 space-y-4 transition-opacity ${imageBackdropEnabled ? "" : "opacity-40 pointer-events-none"}`}>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-yuui-muted font-medium uppercase tracking-wider">
            TMDB API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Paste TMDB API key..."
              value={tmdbKey}
              onChange={(e) => {
                setTmdbKey(e.target.value);
                // Editing invalidates the previous verdict.
                setTmdbStatus(null);
                setTmdbMsg(null);
              }}
              className="flex-1 glass rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/[0.04] bg-white/[0.01]"
            />
            <button
              onClick={handleSaveTmdb}
              disabled={tmdbTesting}
              className="glass shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
            >
              {tmdbTesting ? "Checking…" : "Verify & Save"}
            </button>
          </div>
          {tmdbMsg && (
            <span
              className={`text-[11px] font-medium mt-1 block ${
                tmdbStatus === "invalid" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {tmdbStatus === "invalid" ? "⚠ " : "✓ "}
              {tmdbMsg}
            </span>
          )}
        </div>
        <div className="text-[11px] text-yuui-muted leading-relaxed">
          Create a free account at{" "}
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noreferrer"
            className="text-yuui-accent hover:underline font-bold"
          >
            TMDB API Settings
          </a>
          , request an API key (the <strong>API Read Access Token</strong> is not
          needed — use the shorter <strong>v3 API Key</strong>), and paste it above.
          Leave blank to keep using the AniList banner.
        </div>
      </div>
    </motion.section>
  );
}
