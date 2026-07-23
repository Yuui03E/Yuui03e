// Yande.re API Client & Download Helper
// Documentation: https://yande.re/wiki/show?title=api_v2

import { invoke } from "@tauri-apps/api/core";

export interface YandePost {
  id: number;
  tags: string;
  created_at: number;
  author: string;
  creator_id: number;
  source: string;
  score: number;
  md5: string;
  file_size: number;
  file_ext: string;
  file_url: string;
  raw_file_url?: string;
  preview_url: string;
  preview_width: number;
  preview_height: number;
  sample_url: string;
  sample_width: number;
  sample_height: number;
  sample_file_size?: number;
  jpeg_url: string;
  jpeg_width: number;
  jpeg_height: number;
  jpeg_file_size?: number;
  rating: "s" | "q" | "e";
  width: number;
  height: number;
}

export interface YandeTag {
  id: number;
  name: string;
  count: number;
  type: number; // 0 = general, 1 = artist, 3 = copyright/series, 4 = character, 5 = circle, 6 = fault
}

export interface FetchYandePostsOptions {
  page?: number;
  limit?: number;
  tags?: string[];
  ratings?: ("s" | "q" | "e")[];
  aspectFilter?: "all" | "desktop" | "mobile";
  sort?: "recent" | "popular" | "random";
}

const YANDE_BASE_URL = "https://yande.re";

/** Internal helper: Fetch JSON via Tauri Rust proxy (to bypass CORS) or fallback browser fetch. */
async function fetchYandeJson<T>(url: string): Promise<T> {
  try {
    return await invoke<T>("yandere_get", { url });
  } catch (tauriErr) {
    console.warn("Tauri invoke yandere_get failed, falling back to window.fetch:", tauriErr);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Yande.re API error: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }
}

/** Fetch posts from Yande.re with pagination, tag query, and ratings filter. */
export async function fetchYandePosts(options: FetchYandePostsOptions = {}): Promise<YandePost[]> {
  const {
    page = 1,
    limit = 30,
    tags = [],
    ratings = ["s", "q"],
    aspectFilter = "all",
    sort = "recent",
  } = options;

  const queryTags: string[] = [...tags];

  // Add rating tag filters
  if (ratings.length > 0 && ratings.length < 3) {
    if (ratings.length === 1) {
      const rMap = { s: "safe", q: "questionable", e: "explicit" };
      queryTags.push(`rating:${rMap[ratings[0]]}`);
    } else {
      if (!ratings.includes("e")) {
        queryTags.push("-rating:explicit");
      }
    }
  }

  // Sorting tags
  if (sort === "popular") {
    queryTags.push("order:score");
  } else if (sort === "random") {
    queryTags.push("order:random");
  }

  // Aspect ratio filters
  if (aspectFilter === "desktop") {
    queryTags.push("width:>=1920");
  } else if (aspectFilter === "mobile") {
    queryTags.push("height:>=1920");
  }

  const tagsParam = encodeURIComponent(queryTags.join(" "));
  const url = `${YANDE_BASE_URL}/post.json?limit=${limit}&page=${page}${tagsParam ? `&tags=${tagsParam}` : ""}`;

  const data = await fetchYandeJson<YandePost[]>(url);
  
  // Extra client-side filter for fine aspect ratio matching if requested
  if (aspectFilter === "desktop") {
    return data.filter((p) => p.width / p.height >= 1.3);
  } else if (aspectFilter === "mobile") {
    return data.filter((p) => p.height / p.width >= 1.2);
  }

  return data;
}

/** Search Yande.re tags for auto-completion. Uses wildcard matching like Yande.re website. */
export async function searchYandeTags(query: string, limit = 15): Promise<YandeTag[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  // Try wildcard prefix matching (e.g. hinata* or *hinata*)
  const wildcardQuery = clean.endsWith("*") || clean.startsWith("*") ? clean : `*${clean}*`;
  const url = `${YANDE_BASE_URL}/tag.json?name=${encodeURIComponent(wildcardQuery)}&limit=${limit}&order=count`;
  try {
    const results = await fetchYandeJson<YandeTag[]>(url);
    if (results && results.length > 0) {
      return results.sort((a, b) => b.count - a.count);
    }
    // Fallback prefix search if wildcard yielded empty
    const fallbackUrl = `${YANDE_BASE_URL}/tag.json?name=${encodeURIComponent(clean)}*&limit=${limit}`;
    const fallbackResults = await fetchYandeJson<YandeTag[]>(fallbackUrl);
    return fallbackResults.sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}


/** Download file directly to local disk (default Downloads folder or custom user setting). */
export async function downloadYandeImage(
  id: string,
  url: string,
  filename: string,
  customDir?: string | null
): Promise<string> {
  try {
    return await invoke<string>("download_artwork_file", {
      id: String(id),
      url,
      filename,
      customDir: customDir || null,
    });
  } catch (tauriErr) {
    console.warn("Tauri download_artwork_file failed, fallback to browser link:", tauriErr);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to download image file");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return filename;
  }
}


