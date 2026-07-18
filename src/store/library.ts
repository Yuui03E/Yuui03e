import { create } from "zustand";
import type { LibraryState } from "./types";
import { createThemeSlice } from "./slices/themeSlice";
import { createBackdropSlice } from "./slices/backdropSlice";
import { createAnilistSlice } from "./slices/anilistSlice";
import { createSyncSlice } from "./slices/syncSlice";
import { createEntrySlice } from "./slices/entrySlice";
import { createMangadexSlice } from "./slices/mangadexSlice";

export type { LibraryState } from "./types";

export const useLibrary = create<LibraryState>()((...a) => ({
  ...createThemeSlice(...a),
  ...createBackdropSlice(...a),
  ...createAnilistSlice(...a),
  ...createSyncSlice(...a),
  ...createEntrySlice(...a),
  ...createMangadexSlice(...a),
}));
