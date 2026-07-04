import { create } from "zustand";
import type { AniListMedia, StoredEntry, UserData } from "../lib/types";
import {
  defaultAnimePath,
  getEntry,
  getLibrary,
  pickFolder,
  searchAnilist as apiSearchAnilist,
  setManualMatch as apiSetManualMatch,
  setUserData as apiSetUserData,
  syncLibrary,
  getSetting,
  setSetting,
} from "../lib/api";

type Status = "idle" | "loading" | "scanning" | "matching" | "ready" | "error";

interface LibraryState {
  folder: string | null;
  entries: StoredEntry[];
  status: Status;
  progress: string;
  error: string | null;
  activeBackdrop: string | null;
  cardSize: number;
  setCardSize: (size: number) => void;

  /** Load persisted library instantly; only scan if the store is empty. */
  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  rescan: () => Promise<void>;

  /** Fetch a single hydrated + rich-detail entry (for detail pages). */
  fetchEntry: (key: string) => Promise<StoredEntry | null>;
  /** Persist watch status / score / notes / favorite and update local state. */
  saveUserData: (key: string, data: UserData) => Promise<void>;
  /** Pin a manual match, then refresh that entry from the DB. */
  pinMatch: (key: string, media: unknown) => Promise<void>;
  /** Search AniList for manual match-fix candidates. */
  searchAnilist: (query: string) => Promise<AniListMedia[]>;
  setActiveBackdrop: (url: string | null) => void;
}

async function runSync(
  folder: string,
  set: (partial: Partial<LibraryState>) => void,
) {
  try {
    set({ status: "scanning", progress: "Scanning & matching…", error: null });
    const entries = await syncLibrary(folder);
    set({ entries, status: "ready", progress: "" });
  } catch (e) {
    set({ status: "error", error: String(e), progress: "" });
  }
}

export const useLibrary = create<LibraryState>((set, get) => ({
  folder: null,
  entries: [],
  status: "idle",
  progress: "",
  error: null,
  activeBackdrop: null,
  setActiveBackdrop: (url) => set({ activeBackdrop: url }),
  cardSize: Number(localStorage.getItem("yuui_card_size")) || 180,
  setCardSize: (size) => {
    localStorage.setItem("yuui_card_size", String(size));
    set({ cardSize: size });
  },

  init: async () => {
    if (get().status !== "idle") return;
    try {
      set({ status: "loading", progress: "Loading library…" });
      
      // Load library folder from settings if exists, otherwise fallback to default
      let path = await getSetting("library_folder");
      if (!path) {
        path = await defaultAnimePath();
        await setSetting("library_folder", path);
      }
      set({ folder: path });

      // Instant load from the persisted DB first.
      const stored = await getLibrary();
      if (stored.length > 0) {
        set({ entries: stored, status: "ready", progress: "" });
        return;
      }

      // Empty store → do a first scan+match+persist.
      await runSync(path, set);
    } catch (e) {
      set({ status: "error", error: String(e), progress: "" });
    }
  },

  chooseFolder: async () => {
    const picked = await pickFolder();
    if (!picked) return;
    set({ folder: picked });
    await setSetting("library_folder", picked);
    await runSync(picked, set);
  },

  rescan: async () => {
    const folder = get().folder;
    if (!folder) return;
    await runSync(folder, set);
  },

  fetchEntry: async (key: string) => {
    // Serve from local state immediately if present; still refresh in bg.
    const local = get().entries.find((e) => e.key === key) ?? null;
    try {
      const fresh = await getEntry(key);
      if (fresh) {
        set({
          entries: get().entries.map((e) => (e.key === key ? fresh : e)),
        });
        return fresh;
      }
    } catch {
      // fall back to local
    }
    return local;
  },

  saveUserData: async (key: string, data: UserData) => {
    const entry = get().entries.find((e) => e.key === key);
    const mediaId = entry?.media?.id;

    await apiSetUserData(key, data);
    set({
      entries: get().entries.map((e) =>
        e.key === key ? { ...e, user: data } : e,
      ),
    });

    if (mediaId) {
      // Sync list entry
      const token = await getSetting("anilist_token");
      if (token) {
        let status = data.status?.toUpperCase() || "PLANNING";
        if (status === "WATCHING") status = "CURRENT";

        const query = `
          mutation ($mediaId: Int, $status: MediaListStatus, $score: Float, $progress: Int, $notes: String) {
            SaveMediaListEntry(mediaId: $mediaId, status: $status, score: $score, progress: $progress, notes: $notes) {
              id
            }
          }
        `;

        const variables = {
          mediaId,
          status,
          score: data.score,
          progress: data.progress,
          notes: data.notes,
        };

        try {
          await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ query, variables }),
          });

          // If favorite changed, toggle it
          if (entry && entry.user.favorite !== data.favorite) {
            const favQuery = `
              mutation ($animeId: Int) {
                ToggleFavorite(animeId: $animeId, type: ANIME) {
                  anime { nodes { id } }
                }
              }
            `;
            await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({ query: favQuery, variables: { animeId: mediaId } }),
            });
          }
        } catch (e) {
          console.error("AniList sync failed:", e);
        }
      }
    }
  },

  pinMatch: async (key: string, media: unknown) => {
    await apiSetManualMatch(key, media);
    const fresh = await getEntry(key);
    if (fresh) {
      set({
        entries: get().entries.map((e) => (e.key === key ? fresh : e)),
      });
    }
  },

  searchAnilist: (query: string) => apiSearchAnilist(query),
}));
