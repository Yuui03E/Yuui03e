import { useLibrary } from "../../../store/library";
import { Image as ImageIcon, Shield, EyeOff, RotateCcw, Folder, FolderOpen } from "lucide-react";
import { pickFolder } from "../../../lib/api/dialogs";

export function YandereSection() {
  const {
    yandereEnabled,
    setYandereEnabled,
    yandereRatings,
    setYandereRatings,
    yandereBlurNSFW,
    setYandereBlurNSFW,
    yandereDownloadDir,
    setYandereDownloadDir,
    setAppBackgroundImage,
    setToastMsg,
  } = useLibrary();

  const handleToggleRating = async (rating: "s" | "q" | "e") => {
    if (yandereRatings.includes(rating)) {
      if (yandereRatings.length > 1) {
        await setYandereRatings(yandereRatings.filter((r) => r !== rating));
      }
    } else {
      await setYandereRatings([...yandereRatings, rating]);
    }
  };

  const handlePickDownloadDir = async () => {
    const selected = await pickFolder();
    if (selected) {
      await setYandereDownloadDir(selected);
      setToastMsg(`Set download location to ${selected}`);
    }
  };

  const handleResetBg = async () => {
    await setAppBackgroundImage("");
    setToastMsg("Reset app background to default");
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-surface/30 p-5 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Yande.re Anime Wallpapers & Artworks</h3>
            <p className="text-xs text-muted-foreground">
              Configure Yande.re artwork exploration, safety ratings, and download locations.
            </p>
          </div>
        </div>

        {/* Enable Toggle */}
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={yandereEnabled}
            onChange={(e) => setYandereEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <div className="peer h-6 w-11 rounded-full bg-surface-elevated after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-focus:outline-none" />
        </label>
      </div>

      {yandereEnabled && (
        <div className="space-y-4 pt-3 border-t border-border/30 text-xs">
          {/* Wallpaper Download Location */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-accent" /> Artwork Download Location
              </span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Downloads default to system Downloads directory unless a custom folder is chosen.
              </p>
              <span className="inline-block mt-1 text-[11px] font-mono text-yuui-muted bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.05]">
                {yandereDownloadDir ? yandereDownloadDir : "Default (System Downloads Folder)"}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePickDownloadDir}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-surface-elevated/40 hover:bg-surface-elevated text-foreground font-semibold text-xs transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Choose Folder
              </button>
              {yandereDownloadDir && (
                <button
                  onClick={() => setYandereDownloadDir(null)}
                  className="text-xs text-muted-foreground hover:text-white underline"
                >
                  Reset Default
                </button>
              )}
            </div>
          </div>

          {/* Default Rating Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/30">
            <div>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-accent" /> Default Safety Rating Filter
              </span>
              <p className="text-muted-foreground text-[11px]">
                Choose allowed content ratings when searching Yande.re.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleToggleRating("s")}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase text-[10px] transition-colors border ${
                  yandereRatings.includes("s")
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                Safe
              </button>
              <button
                onClick={() => handleToggleRating("q")}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase text-[10px] transition-colors border ${
                  yandereRatings.includes("q")
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                Questionable
              </button>
              <button
                onClick={() => handleToggleRating("e")}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase text-[10px] transition-colors border ${
                  yandereRatings.includes("e")
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                Explicit
              </button>
            </div>
          </div>

          {/* NSFW Blur toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <EyeOff className="h-3.5 w-3.5 text-amber-400" /> Blur NSFW Previews
              </span>
              <p className="text-muted-foreground text-[11px]">
                Keep Questionable and Explicit thumbnails blurred until hovered.
              </p>
            </div>

            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={yandereBlurNSFW}
                onChange={(e) => setYandereBlurNSFW(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-surface-elevated after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
            </label>
          </div>

          {/* Reset App Background */}
          <div className="flex items-center justify-between pt-3 border-t border-border/30">
            <div>
              <span className="font-semibold text-foreground">App Background Image</span>
              <p className="text-muted-foreground text-[11px]">
                Reset custom background back to default animated shader.
              </p>
            </div>

            <button
              onClick={handleResetBg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/40 bg-surface-elevated/40 hover:bg-surface-elevated text-foreground font-semibold text-xs transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear Background
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
