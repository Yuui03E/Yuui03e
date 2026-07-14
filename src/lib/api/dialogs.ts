// Native dialog / path pickers.
import { open } from "@tauri-apps/plugin-dialog";

/** Open the native folder picker; returns selected path or null. */
export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Choose an anime library folder",
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}

/** Open the native path picker for multiple folders or files. */
export async function pickMultiplePaths(
  selectFolders: boolean,
): Promise<string[]> {
  const selected = await open({
    directory: selectFolders,
    multiple: true,
    title: selectFolders
      ? "Select Anime Library folders"
      : "Select Anime video files",
    filters: selectFolders
      ? undefined
      : [
          {
            name: "Video Files",
            extensions: ["mp4", "mkv", "avi", "webm", "m4v"],
          },
        ],
  });
  if (!selected) return [];
  if (Array.isArray(selected)) return selected;
  return [selected];
}

/** Open the native file selector to pick a background image. */
export async function pickBackgroundImage(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Select Background Image",
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif"],
      },
    ],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}
