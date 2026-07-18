import type { StateCreator } from "zustand";
import { getSetting, setSetting } from "../../lib/api";
import { useLibrary } from "../library";
import type {
  LibraryState,
  MangadexReaderFit,
  MangadexReaderMode,
  MangadexSlice,
} from "../types";

const DEFAULT_CONTENT_RATING = ["safe", "suggestive"];
const DEFAULT_LANG = "en";
const DEFAULT_MODE: MangadexReaderMode = "scroll";
const DEFAULT_FIT: MangadexReaderFit = "width";

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
> = (set) => ({
  mangadexEnabled: false,
  mangadexContentRating: DEFAULT_CONTENT_RATING,
  mangadexTranslatedLanguage: DEFAULT_LANG,
  mangadexOriginalLanguageFilter: null,
  mangadexReaderMode: DEFAULT_MODE,
  mangadexReaderFit: DEFAULT_FIT,

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
});

/** Pull persisted MangaDex settings from SQLite into the store. Called once
 *  on app boot (from the settings section / MangaDex page). Idempotent. */
export async function loadMangadexSettings(): Promise<void> {
  const [enabled, ratings, lang, origLang, mode, fit] = await Promise.all([
    getSetting("mangadex_enabled"),
    getSetting("mangadex_content_rating"),
    getSetting("mangadex_translated_language"),
    getSetting("mangadex_original_language_filter"),
    getSetting("mangadex_reader_mode"),
    getSetting("mangadex_reader_fit"),
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
  });
}
