import { listen } from "@tauri-apps/api/event";
import { syncLibrary } from "../../lib/api";
import type { StoredEntry } from "../../lib/types";
import type { LibraryState, SearchProgress } from "../types";

/**
 * The shared scan/match/persist driver. Wires up backend event listeners,
 * runs the sync, and tears listeners back down. Kept as a plain helper (not a
 * slice) because it's called from several sync-slice actions.
 */
export async function runSync(
  folder: string,
  set: (partial: Partial<LibraryState>) => void,
  get: () => LibraryState,
  prune = true,
) {
  let unlistenProgress: (() => void) | null = null;
  let unlistenEntry: (() => void) | null = null;
  let unlistenSearching: (() => void) | null = null;
  let unlistenComplete: (() => void) | null = null;

  try {
    set({
      status: "scanning",
      progress: "Starting sync...",
      error: null,
      isSearching: true,
      isPaused: false,
      searchProgress: null,
      searchHistory: [],
    });

    unlistenProgress = await listen<string>("sync:progress", (event) => {
      set({ progress: event.payload });
    });

    unlistenSearching = await listen<SearchProgress>("sync:searching", (event) => {
      const p = event.payload;
      set({ searchProgress: p });

      // Accumulate completed searches in history (max 200 entries)
      if (p.status !== "searching") {
        const history = get().searchHistory;
        const updated = [...history, p].slice(-200);
        set({ searchHistory: updated });
      }
    });

    unlistenEntry = await listen<StoredEntry>("sync:entry-updated", (event) => {
      // The backend now sends the FULL hydrated entry (read from the DB, no
      // network). Insert/replace it directly — no per-entry AniList refetch,
      // which was the second request stream causing 429 rate-limit storms.
      const entry = event.payload;
      if (!entry || !entry.key) return;

      const currentEntries = get().entries;
      const exists = currentEntries.some((e) => e.key === entry.key);
      if (exists) {
        set({
          entries: currentEntries.map((e) => (e.key === entry.key ? entry : e)),
        });
      } else {
        const updated = [...currentEntries, entry];
        updated.sort((a, b) => {
          const tA = a.media?.title.english || a.media?.title.romaji || a.title || "";
          const tB = b.media?.title.english || b.media?.title.romaji || b.title || "";
          return tA.localeCompare(tB);
        });
        set({ entries: updated });
      }
    });

    unlistenComplete = await listen("sync:complete", () => {
      set({ isSearching: false, isPaused: false });
    });

    const entries = await syncLibrary(folder, prune);
    set({ entries, status: "ready", progress: "", isSearching: false, isPaused: false, searchProgress: null });
  } catch (e) {
    set({ status: "error", error: String(e), progress: "", isSearching: false, isPaused: false });
  } finally {
    if (unlistenProgress) unlistenProgress();
    if (unlistenEntry) unlistenEntry();
    if (unlistenSearching) unlistenSearching();
    if (unlistenComplete) unlistenComplete();
  }
}
