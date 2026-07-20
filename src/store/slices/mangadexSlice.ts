import type { StateCreator } from "zustand";
import { getSetting, setSetting } from "../../lib/api";
import { useLibrary } from "../library";
import type {
  LibraryState,
  MangadexReaderFit,
  MangadexReaderMode,
  MangadexReaderPrefs,
  MangadexSlice,
} from "../types";

const DEFAULT_CONTENT_RATING = ["safe", "suggestive"];
const DEFAULT_LANG = "en";
const DEFAULT_MODE: MangadexReaderMode = "scroll";
const DEFAULT_FIT: MangadexReaderFit = "width";

export const DEFAULT_READER_PREFS: MangadexReaderPrefs = {
  direction: "ltr",
  quality: "best",
  imageQuality: "data",
  background: "black",
  pageGap: 0,
  zoom: 100,
  brightness: 100,
  doublePage: false,
  menuAutoHideMs: 500,
  menuPinned: false,
  keys: {
    prevPage: "arrowleft",
    nextPage: "arrowright",
    scrollUp: "arrowup",
    scrollDown: "arrowdown",
    toggleMode: "m",
    cycleFit: "f",
    prevChapter: "p",
    nextChapter: "n",
    toggleControls: "h",
  },
};

/** Parse a JSON-encoded setting (stored as a string) into the expected type,
 *  returning `fallback` on any parse failure or missing key. */
function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const createMangadexSlice: StateCreator<
  LibraryState,
  [],
  [],
  MangadexSlice
> = (set, get) => ({
  mangadexEnabled: false,
  mangadexContentRating: DEFAULT_CONTENT_RATING,
  mangadexTranslatedLanguage: DEFAULT_LANG,
  mangadexOriginalLanguageFilter: null,
  mangadexReaderMode: DEFAULT_MODE,
  mangadexReaderFit: DEFAULT_FIT,
  mangadexReaderPrefs: DEFAULT_READER_PREFS,

  setMangadexEnabled: async (enabled) => {
    set({ mangadexEnabled: enabled });
    await setSetting("mangadex_enabled", enabled ? "true" : "false");
  },

  setMangadexContentRating: async (ratings) => {
    set({ mangadexContentRating: ratings });
    await setSetting("mangadex_content_rating", JSON.stringify(ratings));
  },

  setMangadexTranslatedLanguage: async (lang) => {
    set({ mangadexTranslatedLanguage: lang });
    await setSetting("mangadex_translated_language", lang);
  },

  setMangadexOriginalLanguageFilter: async (lang) => {
    set({ mangadexOriginalLanguageFilter: lang });
    await setSetting("mangadex_original_language_filter", lang ?? "");
  },

  setMangadexReaderMode: async (mode) => {
    set({ mangadexReaderMode: mode });
    await setSetting("mangadex_reader_mode", mode);
  },

  setMangadexReaderFit: async (fit) => {
    set({ mangadexReaderFit: fit });
    await setSetting("mangadex_reader_fit", fit);
  },

  setMangadexReaderPrefs: async (patch) => {
    const prev = get().mangadexReaderPrefs;
    // Deep-merge `keys` so a partial keybinding patch doesn't wipe the rest.
    const next = {
      ...prev,
      ...patch,
      keys: { ...prev.keys, ...patch.keys },
    };
    set({ mangadexReaderPrefs: next });
    await setSetting("mangadex_reader_prefs", JSON.stringify(next));
  },
});

/** Pull persisted MangaDex settings from SQLite into the store. Called once
 *  on app boot (from the settings section / MangaDex page). Idempotent. */
export async function loadMangadexSettings(): Promise<void> {
  const [enabled, ratings, lang, origLang, mode, fit, prefs] =
    await Promise.all([
      getSetting("mangadex_enabled"),
      getSetting("mangadex_content_rating"),
      getSetting("mangadex_translated_language"),
      getSetting("mangadex_original_language_filter"),
      getSetting("mangadex_reader_mode"),
      getSetting("mangadex_reader_fit"),
      getSetting("mangadex_reader_prefs"),
    ]);

  useLibrary.setState({
    mangadexEnabled: enabled === "true",
    mangadexContentRating: parseJson(ratings, DEFAULT_CONTENT_RATING),
    mangadexTranslatedLanguage: lang ?? DEFAULT_LANG,
    mangadexOriginalLanguageFilter:
      origLang && origLang.length > 0 ? origLang : null,
    mangadexReaderMode: mode === "scroll" ? "scroll" : DEFAULT_MODE,
    mangadexReaderFit:
      fit === "height" || fit === "original" ? fit : DEFAULT_FIT,
    mangadexReaderPrefs: (() => {
      const stored = parseJson<Partial<MangadexReaderPrefs>>(prefs, {});
      return {
        ...DEFAULT_READER_PREFS,
        ...stored,
        // Deep-merge keybindings so new default actions appear for old blobs.
        keys: { ...DEFAULT_READER_PREFS.keys, ...stored.keys },
      };
    })(),
  });
}
