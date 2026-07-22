import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "../../../store/library";
import { loadMangadexSettings } from "../../../store/slices/mangadexSlice";
import { ToggleSwitch } from "../components/ToggleSwitch";

const CONTENT_RATINGS = [
  "safe",
  "suggestive",
  "erotica",
  "pornographic",
] as const;

const TRANSLATED_LANGS = [
  { code: "", label: "Any (All Languages)" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "es-la", label: "Spanish (Latin America)" },
  { code: "pt-br", label: "Portuguese (Brazil)" },
  { code: "pt-pt", label: "Portuguese (Portugal)" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "pl", label: "Polish" },
  { code: "ar", label: "Arabic" },
  { code: "th", label: "Thai" },
  { code: "tl", label: "Tagalog / Filipino" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "zh-hk", label: "Chinese (Traditional)" },
  { code: "uk", label: "Ukrainian" },
  { code: "hi", label: "Hindi" },
] as const;

const LANGS = TRANSLATED_LANGS.filter((l) => l.code !== "");

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.04]">
      <div className="flex-1">
        <span className="text-xs text-white/90 font-bold block">{title}</span>
        <span className="text-xs text-yuui-muted block mt-1 leading-relaxed">
          {desc}
        </span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function MangadexSection() {
  const {
    mangadexEnabled,
    setMangadexEnabled,
    mangadexContentRating,
    setMangadexContentRating,
    mangadexTranslatedLanguage,
    setMangadexTranslatedLanguage,
    mangadexOriginalLanguageFilter,
    setMangadexOriginalLanguageFilter,
    mangadexReaderMode,
    setMangadexReaderMode,
    mangadexReaderFit,
    setMangadexReaderFit,
  } = useLibrary();

  const [checked, setChecked] = useState(mangadexEnabled);

  useEffect(() => {
    loadMangadexSettings().then(() => {
      setChecked(useLibrary.getState().mangadexEnabled);
    });
  }, []);

  const toggleRating = (rating: string, on: boolean) => {
    const set = new Set(mangadexContentRating);
    if (on) set.add(rating);
    else set.delete(rating);
    if (set.size === 0) set.add("safe"); // never allow empty
    setMangadexContentRating(Array.from(set));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
    >
      <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2 select-none">
        <span>📖</span> MangaDex Integration
      </h2>
      <p className="mt-1 text-xs text-yuui-muted">
        Configure how Yuui browses and reads manga from MangaDex's open catalog.
      </p>

      <Section
        title="Show MangaDex in Sidebar"
        desc="When toggled on, a MangaDex icon will appear in the navigation sidebar so you can browse manga directly from the app."
      >
        <ToggleSwitch
          checked={checked}
          onChange={async (e) => {
            const value = e.target.checked;
            setChecked(value);
            await setMangadexEnabled(value);
          }}
        />
      </Section>

      <Section
        title="Content Rating"
        desc="MangaDex classifies every title. Choose which ratings appear in browse & search."
      >
        <div className="flex flex-wrap gap-2 justify-end">
          {CONTENT_RATINGS.map((r) => (
            <button
              key={r}
              onClick={() =>
                toggleRating(r, !mangadexContentRating.includes(r))
              }
              className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-all ${
                mangadexContentRating.includes(r)
                  ? "bg-yuui-accent text-white"
                  : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Translated Language"
        desc="Filter chapter updates and reader by translated language (select Any for all languages)."
      >
        <select
          value={mangadexTranslatedLanguage}
          onChange={(e) => setMangadexTranslatedLanguage(e.target.value)}
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/90 outline-none focus:border-yuui-accent/40"
        >
          {TRANSLATED_LANGS.map((l) => (
            <option key={l.code} value={l.code} className="bg-yuui-surface">
              {l.label}
            </option>
          ))}
        </select>
      </Section>

      <Section
        title="Original Language Filter"
        desc="Restrict browsing to manga originally published in a specific language (or any)."
      >
        <select
          value={mangadexOriginalLanguageFilter ?? ""}
          onChange={(e) =>
            setMangadexOriginalLanguageFilter(e.target.value || null)
          }
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/90 outline-none focus:border-yuui-accent/40"
        >
          <option value="" className="bg-yuui-surface">
            Any
          </option>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code} className="bg-yuui-surface">
              {l.label}
            </option>
          ))}
        </select>
      </Section>

      <Section
        title="Reader Mode"
        desc="Vertical = continuous webtoon-style scroll (default). Paged = one page at a time."
      >
        <div className="flex gap-2">
          {(["paged", "scroll"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMangadexReaderMode(m)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold capitalize transition-all ${
                mangadexReaderMode === m
                  ? "bg-yuui-accent text-white"
                  : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Page Fit"
        desc="How each page is sized in the reader (paged mode)."
      >
        <div className="flex gap-2">
          {(["width", "height", "original"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setMangadexReaderFit(f)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold capitalize transition-all ${
                mangadexReaderFit === f
                  ? "bg-yuui-accent text-white"
                  : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12]"
              }`}
            >
              {f === "width"
                ? "Fit Width"
                : f === "height"
                  ? "Fit Height"
                  : "Original"}
            </button>
          ))}
        </div>
      </Section>
    </motion.section>
  );
}
