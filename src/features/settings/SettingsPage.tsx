import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useLibrary } from "../../store/library";
import { pickMultiplePaths, getSetting, setSetting, testTmdbKey, pickBackgroundImage } from "../../lib/api";
import { THEME_PRESETS, ACCENT_PRESETS, hexToHsl, hslToHex } from "../../lib/theme";

export default function SettingsPage() {
  const { folders, addPaths, removePath, init, anilistUser, loginAnilist, logoutAnilist, isSearching, rescan } = useLibrary();
  const imageBackdropEnabled = useLibrary((s) => s.imageBackdropEnabled);
  const setImageBackdropEnabled = useLibrary((s) => s.setImageBackdropEnabled);

  const themeColor = useLibrary((s) => s.themeColor);
  const setThemeColor = useLibrary((s) => s.setThemeColor);
  const customBackgroundColor = useLibrary((s) => s.customBackgroundColor);
  const setCustomBackgroundColor = useLibrary((s) => s.setCustomBackgroundColor);
  const themeAccent = useLibrary((s) => s.themeAccent);
  const setThemeAccent = useLibrary((s) => s.setThemeAccent);
  const customAccentColor = useLibrary((s) => s.customAccentColor);
  const setCustomAccentColor = useLibrary((s) => s.setCustomAccentColor);
  const appBackgroundImage = useLibrary((s) => s.appBackgroundImage);
  const setAppBackgroundImage = useLibrary((s) => s.setAppBackgroundImage);
  const appBackgroundImageOpacity = useLibrary((s) => s.appBackgroundImageOpacity);
  const setAppBackgroundImageOpacity = useLibrary((s) => s.setAppBackgroundImageOpacity);
  const appBackgroundImageBlur = useLibrary((s) => s.appBackgroundImageBlur);
  const setAppBackgroundImageBlur = useLibrary((s) => s.setAppBackgroundImageBlur);
  const [hashMatching, setHashMatching] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tmdbKey, setTmdbKey] = useState("");
  const [tmdbTesting, setTmdbTesting] = useState(false);
  // null = untested; "valid"/"invalid" = last validation result.
  const [tmdbStatus, setTmdbStatus] = useState<"valid" | "invalid" | null>(null);
  const [tmdbMsg, setTmdbMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadHashSetting() {
      const val = await getSetting("hash_matching");
      if (val === "false") {
        setHashMatching(false);
      } else {
        setHashMatching(true);
      }
    }
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
    loadHashSetting();
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

        {/* Theme & Personalization Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <div className="flex items-center gap-2.5 mb-6 select-none">
            <span className="text-xl">🎨</span>
            <div>
              <h2 className="text-lg font-semibold text-white/90 font-display">
                Theme & Personalization
              </h2>
              <p className="text-xs text-yuui-muted mt-0.5">
                Customize the look and feel of Yuui with dynamic themes, accent colors, and background images.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Settings Controls */}
            <div className="lg:col-span-7 space-y-6">
              {/* Base Theme Color selection */}
              <div>
                <div className="flex flex-col mb-3">
                  <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                    Base Dark Palette
                  </span>
                  <span className="text-[11px] text-yuui-muted mt-0.5">
                    Choose the default workspace background shading.
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {THEME_PRESETS.map((t) => {
                    const isActive = themeColor === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setThemeColor(t.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "border-accent bg-accent/10 shadow-glow"
                            : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08]"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full border border-white/20 mb-2 relative overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: t.background }}
                        >
                          <div className="absolute inset-y-0 right-0 w-1/2 border-l border-white/10" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }} />
                        </div>
                        <span className="text-[11px] font-semibold text-white/80">
                          {t.name}
                        </span>
                      </button>
                    );
                  })}

                  {/* Custom Dark Theme option */}
                  <div
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 ${
                      themeColor === "custom"
                        ? "border-accent bg-accent/10 shadow-glow"
                        : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08]"
                    }`}
                  >
                    <button
                      onClick={() => setThemeColor("custom")}
                      className="w-8 h-8 rounded-full border border-white/20 mb-2 relative overflow-hidden flex items-center justify-center cursor-pointer"
                      style={{ backgroundColor: themeColor === "custom" ? customBackgroundColor : "#18181b" }}
                    >
                      <span className="text-sm">🎨</span>
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-semibold text-white/80 select-none">
                        Custom Base
                      </span>
                      {themeColor === "custom" && (
                        <input
                          type="color"
                          value={customBackgroundColor}
                          onChange={(e) => setCustomBackgroundColor(e.target.value)}
                          className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accent Color selection */}
              <div className="border-t border-white/[0.04] pt-6">
                <div className="flex flex-col mb-3">
                  <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                    Accent Color
                  </span>
                  <span className="text-[11px] text-yuui-muted mt-0.5">
                    Highlights primary buttons, tabs, active indicators, and icons.
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((acc) => {
                    const isActive = themeAccent === acc.id;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => setThemeAccent(acc.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "border-accent bg-accent/15 text-white"
                            : "border-white/[0.04] bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${acc.accent}, ${acc.accent2})`,
                          }}
                        />
                        {acc.name}
                      </button>
                    );
                  })}

                  {/* Custom Accent Color Option */}
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                      themeAccent === "custom"
                        ? "border-accent bg-accent/15"
                        : "border-white/[0.04] bg-white/[0.02]"
                    }`}
                  >
                    <button
                      onClick={() => setThemeAccent("custom")}
                      className="text-[11px] font-semibold text-white/70 hover:text-white cursor-pointer"
                    >
                      🎨 Custom Accent
                    </button>
                    {themeAccent === "custom" && (
                      <input
                        type="color"
                        value={customAccentColor}
                        onChange={(e) => setCustomAccentColor(e.target.value)}
                        className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Background Image Options */}
              <div className="border-t border-white/[0.04] pt-6 space-y-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                    Desktop Background Image
                  </span>
                  <span className="text-[11px] text-yuui-muted mt-0.5">
                    Overlay a custom artwork as the application backdrop.
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Toggle/Trigger to pick a local file */}
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.03]">
                    <div className="flex-1">
                      <span className="text-xs text-white/90 font-semibold block">
                        Desktop Wallpaper Overlay
                      </span>
                      <span className="text-[11px] text-yuui-muted block mt-0.5 leading-relaxed">
                        Configure a custom desktop image. Resolves local paths instantly.
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        if (appBackgroundImage) {
                          await setAppBackgroundImage("");
                        } else {
                          const path = await pickBackgroundImage();
                          if (path) await setAppBackgroundImage(path);
                        }
                      }}
                      className={`glass px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${
                        appBackgroundImage
                          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-red-500/20"
                          : "text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      {appBackgroundImage ? "Clear Image" : "Select Image"}
                    </button>
                  </div>

                  {/* Show sliders and URL options if active */}
                  {appBackgroundImage && (
                    <div className="space-y-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] p-4 animate-fadeIn">
                      {/* Source details */}
                      <div className="text-xs">
                        <span className="text-[10px] text-yuui-muted font-bold uppercase tracking-wider block">
                          Current Source
                        </span>
                        <span className="text-white/70 font-mono block mt-1 truncate max-w-full" title={appBackgroundImage}>
                          {appBackgroundImage}
                        </span>
                      </div>

                      {/* URL input fallback */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-yuui-muted font-bold uppercase tracking-wider">
                          Or Paste Web Image URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://example.com/background.jpg"
                          value={appBackgroundImage.startsWith("http") ? appBackgroundImage : ""}
                          onChange={(e) => setAppBackgroundImage(e.target.value)}
                          className="glass w-full rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/[0.04] bg-white/[0.01]"
                        />
                      </div>

                      {/* Sliders for Blur and Opacity */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/80 font-medium">Blur Radius</span>
                            <span className="text-yuui-muted font-mono">{appBackgroundImageBlur}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            value={appBackgroundImageBlur}
                            onChange={(e) => setAppBackgroundImageBlur(Number(e.target.value))}
                            className="w-full accent-accent cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/80 font-medium">Overlay Opacity</span>
                            <span className="text-yuui-muted font-mono">{Math.round(appBackgroundImageOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(appBackgroundImageOpacity * 100)}
                            onChange={(e) => setAppBackgroundImageOpacity(Number(e.target.value) / 100)}
                            className="w-full accent-accent cursor-pointer h-1.5 bg-white/10 rounded-full appearance-none outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Live Preview Mockup */}
            <div className="lg:col-span-5 flex flex-col justify-start">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col h-full sticky top-4 select-none">
                <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-widest block mb-3">
                  Live Theme Preview
                </span>

                {/* The Miniature Mockup Window */}
                <div 
                  className="relative flex flex-col w-full h-[220px] rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl transition-all duration-300"
                  style={{ 
                    backgroundColor: themeColor === "custom" ? customBackgroundColor : THEME_PRESETS.find(t => t.id === themeColor)?.background || "#12131a"
                  }}
                >
                  {/* Custom Background Image Mockup Layer */}
                  {appBackgroundImage && (
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: `url(${appBackgroundImage.startsWith("http") ? appBackgroundImage : convertFileSrc(appBackgroundImage)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity: appBackgroundImageOpacity,
                        filter: `blur(${appBackgroundImageBlur / 2}px)`
                      }}
                    />
                  )}

                  {/* TitleBar Mockup */}
                  <div className="relative z-10 flex items-center justify-between px-3 py-1.5 bg-black/20 border-b border-white/[0.04] w-full">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-[8px] text-white/40 font-mono tracking-wider">yuui_preview</span>
                    <div className="w-8" />
                  </div>

                  {/* Content Layout Mockup */}
                  <div className="relative z-10 flex flex-1 overflow-hidden w-full">
                    {/* Mini Sidebar */}
                    <div 
                      className="w-8 border-r border-white/[0.05] flex flex-col items-center py-2 gap-1.5"
                      style={{ 
                        backgroundColor: themeColor === "custom" ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.2)"
                      }}
                    >
                      {/* Mini Sidebar nav indicators */}
                      <div className="w-4 h-4 rounded bg-white/10 relative flex items-center justify-center">
                        {/* Active indicator */}
                        <span className="absolute left-0 w-[1.5px] h-2.5 rounded-full" style={{ backgroundColor: themeAccent === "custom" ? customAccentColor : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent || "#ff5fa2" }} />
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeAccent === "custom" ? customAccentColor : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent || "#ff5fa2", opacity: 0.8 }} />
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-white/5" />
                      <div className="w-3.5 h-3.5 rounded-full bg-white/5" />
                    </div>

                    {/* Mini Main Content */}
                    <div className="flex-1 p-3 flex flex-col gap-2 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-12 rounded bg-white/20" />
                        <span className="h-1.5 w-6 rounded" style={{ backgroundColor: themeAccent === "custom" ? customAccentColor : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent || "#ff5fa2" }} />
                      </div>

                      {/* Mini Cards Grid */}
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <div 
                          className="rounded-lg p-2 border flex flex-col justify-between animate-fadeIn"
                          style={{ 
                            backgroundColor: themeColor === "custom" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)",
                            borderColor: themeColor === "custom" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.06)"
                          }}
                        >
                          <div className="w-full h-8 rounded bg-white/5" />
                          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                            <div className="h-full rounded-full" style={{ width: "65%", backgroundColor: themeAccent === "custom" ? customAccentColor : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent || "#ff5fa2" }} />
                          </div>
                        </div>

                        <div 
                          className="rounded-lg p-2 border flex flex-col justify-between animate-fadeIn"
                          style={{ 
                            backgroundColor: themeColor === "custom" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)",
                            borderColor: themeColor === "custom" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.06)"
                          }}
                        >
                          <div className="w-full h-8 rounded bg-white/5" />
                          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                            <div className="h-full rounded-full" style={{ width: "30%", backgroundColor: themeAccent === "custom" ? customAccentColor : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent || "#ff5fa2" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Palette swatches summary */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] font-mono text-yuui-muted">
                  <div className="flex flex-col gap-1 items-center bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                    <span>Background</span>
                    <div className="w-3.5 h-3.5 rounded border border-white/10 shadow-sm" style={{ backgroundColor: themeColor === "custom" ? customBackgroundColor : THEME_PRESETS.find(t => t.id === themeColor)?.background || "#12131a" }} />
                  </div>
                  <div className="flex flex-col gap-1 items-center bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                    <span>Accent Primary</span>
                    <div className="w-3.5 h-3.5 rounded border border-white/10 shadow-sm" style={{ backgroundColor: themeAccent === "custom" ? customAccentColor : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent || "#ff5fa2" }} />
                  </div>
                  <div className="flex flex-col gap-1 items-center bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                    <span>Secondary Glow</span>
                    <div className="w-3.5 h-3.5 rounded border border-white/10 shadow-sm" style={{ backgroundColor: themeAccent === "custom" ? (hslToHex((hexToHsl(customAccentColor).h + 300) % 360, Math.min(100, hexToHsl(customAccentColor).s + 10), Math.max(35, hexToHsl(customAccentColor).l - 5))) : ACCENT_PRESETS.find(a => a.id === themeAccent)?.accent2 || "#7c5cff" }} />
                  </div>
                </div>
              </div>
            </div>
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

        {/* TMDB Backdrops Section */}
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
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={imageBackdropEnabled}
                onChange={(e) => setImageBackdropEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white/80 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yuui-accent"></div>
            </label>
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
