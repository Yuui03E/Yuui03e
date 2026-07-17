import { convertFileSrc } from "@tauri-apps/api/core";
import { useLibrary } from "../../../store/library";
import { THEME_PRESETS, ACCENT_PRESETS, hexToHsl, hslToHex } from "../../../lib/theme";

export function ThemePreview() {
  const themeColor = useLibrary((s) => s.themeColor);
  const customBackgroundColor = useLibrary((s) => s.customBackgroundColor);
  const themeAccent = useLibrary((s) => s.themeAccent);
  const customAccentColor = useLibrary((s) => s.customAccentColor);
  const appBackgroundImage = useLibrary((s) => s.appBackgroundImage);
  const appBackgroundImageOpacity = useLibrary((s) => s.appBackgroundImageOpacity);
  const appBackgroundImageBlur = useLibrary((s) => s.appBackgroundImageBlur);

  return (
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
  );
}
