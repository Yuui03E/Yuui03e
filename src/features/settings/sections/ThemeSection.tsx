import { motion } from "framer-motion";
import { useLibrary } from "../../../store/library";
import { pickBackgroundImage } from "../../../lib/api";
import { THEME_PRESETS, ACCENT_PRESETS } from "../../../lib/theme";
import { ThemePreview } from "./ThemePreview";

export function ThemeSection() {
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

  return (
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
                      await setAppBackgroundImage("").catch(console.error);
                    } else {
                      const path = await pickBackgroundImage();
                      if (path) await setAppBackgroundImage(path).catch(console.error);
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
          <ThemePreview />
        </div>
      </div>
    </motion.section>
  );
}
