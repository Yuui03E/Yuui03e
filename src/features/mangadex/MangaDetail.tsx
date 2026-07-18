import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  Clock,
  Heart,
  PlayCircle,
  Globe,
} from "lucide-react";
import { getMangaDetail, getChapters, getReadingProgress } from "./api";
import type { MangaInfo, ChapterInfo, ProgressRow } from "./api";
import { useFavorite } from "./hooks";

declare global {
  interface Window {
    __mdNav?: { mangaId?: string };
  }
}

/** Stash the current mangaId before navigating to the reader so the reader
 *  can locate sibling chapters. */
function goReader(navigate: (to: string) => void, mangaId: string, ch: string) {
  window.__mdNav = { mangaId };
  navigate(`/mangadex/reader/${ch}`);
}

export default function MangaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [manga, setManga] = useState<MangaInfo | null>(null);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [loading, setLoading] = useState(true);
  const { fav, toggle } = useFavorite(id);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setManga(null);
    setChapters([]);
    setProgress(null);
    // Fetch detail, chapters, and progress independently so a failure in
    // one (e.g. an empty chapter feed returning an error) doesn't wipe out
    // the others and leave the user staring at a "not found" screen.
    let alive = true;
    Promise.all([
      getMangaDetail(id).catch(() => null),
      getChapters(id).catch(() => [] as ChapterInfo[]),
      getReadingProgress(id).catch(() => null),
    ])
      .then(([m, c, p]) => {
        if (!alive) return;
        setManga(m);
        setChapters(c);
        setProgress(p);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-yuui-accent/30 border-t-yuui-accent" />
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <p className="text-yuui-muted">
          Couldn't load this manga. It may have been removed from MangaDex, or
          the request failed.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(0)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Retry
          </button>
          <button
            onClick={() => navigate("/mangadex")}
            className="rounded-xl bg-yuui-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Back to browse
          </button>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ongoing: "text-green-400",
    completed: "text-blue-400",
    cancelled: "text-red-400",
    hiatus: "text-yellow-400",
  };

  const ascending = [...chapters].sort((a, b) => {
    const an = parseFloat(a.chapter ?? "");
    const bn = parseFloat(b.chapter ?? "");
    if (isNaN(an)) return 1;
    if (isNaN(bn)) return -1;
    return an - bn;
  });

  let continueChapter: ChapterInfo | undefined = ascending[0];
  if (progress && progress.chapter_number != null) {
    const pn = parseFloat(progress.chapter_number);
    if (!isNaN(pn)) {
      continueChapter =
        ascending.find((c) => {
          const cn = parseFloat(c.chapter ?? "");
          return !isNaN(cn) && cn > pn;
        }) ?? ascending[0];
    }
  }

  const onFavoriteClick = () => toggle(manga);

  const getLanguageName = (code: string) => {
    const langMap: Record<string, string> = {
      ja: "Japanese (Manga)",
      ko: "Korean (Manhwa)",
      zh: "Chinese (Manhua)",
      en: "English",
    };
    return langMap[code] || code.toUpperCase();
  };

  const renderLinks = () => {
    if (!manga.links) return null;
    const items = [];

    const mapping = {
      mal: {
        label: "MyAnimeList",
        url: (id: string) => `https://myanimelist.net/manga/${id}`,
      },
      al: {
        label: "AniList",
        url: (id: string) => `https://anilist.co/manga/${id}`,
      },
      kt: {
        label: "Kitsu",
        url: (id: string) => `https://kitsu.io/manga/${id}`,
      },
      mu: {
        label: "MangaUpdates",
        url: (id: string) =>
          `https://www.mangaupdates.com/series.html?id=${id}`,
      },
      ap: {
        label: "Anime-Planet",
        url: (id: string) => `https://www.anime-planet.com/manga/${id}`,
      },
      raw: { label: "Official Raw", url: (url: string) => url },
      eng: { label: "Official English", url: (url: string) => url },
      amz: { label: "Amazon", url: (url: string) => url },
    };

    for (const [key, val] of Object.entries(manga.links)) {
      const cfg = mapping[key as keyof typeof mapping];
      if (cfg) {
        const url = cfg.url(val);
        items.push(
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <span>{cfg.label}</span>
            <span className="text-[10px] text-yuui-muted font-mono">↗</span>
          </a>,
        );
      }
    }

    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-yuui-muted">
          External Links
        </h3>
        <div className="flex flex-col gap-1.5">{items}</div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Cover banner */}
      <div className="relative flex-shrink-0 h-[300px] w-full overflow-hidden bg-white/5">
        {manga.coverUrl ? (
          <img
            src={manga.coverUrl}
            alt=""
            className="h-full w-full object-cover blur-xl opacity-40 scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-yuui-accent/20 to-[#0f0f16]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-yuui-bg via-yuui-bg/40 to-transparent" />
        <button
          onClick={() => navigate("/mangadex")}
          className="glass absolute left-6 top-6 z-10 rounded-xl px-3 py-1.5 text-sm hover:bg-white/[0.1] cursor-pointer active:scale-95 transition-all text-white"
        >
          ← Back
        </button>
      </div>

      {/* Cover + info overlay */}
      <div className="relative z-10 -mt-32 px-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row items-end gap-6">
          <div className="w-[180px] shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-card bg-white/5">
            {manga.coverUrl ? (
              <img
                src={manga.coverUrl}
                alt={manga.title}
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] h-full w-full items-center justify-center text-xs text-yuui-muted">
                No Cover
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-2 flex flex-col items-start gap-2">
            <h1 className="font-display text-3xl font-bold leading-tight text-white drop-shadow">
              {manga.title}
            </h1>
            {(manga.author || manga.artist) && (
              <p className="text-sm text-yuui-muted font-medium">
                {manga.author && `Story by ${manga.author}`}
                {manga.author &&
                  manga.artist &&
                  manga.author !== manga.artist &&
                  " · "}
                {manga.artist &&
                  manga.author !== manga.artist &&
                  `Art by ${manga.artist}`}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {manga.year && (
                <span className="glass rounded-full px-3 py-1 flex items-center gap-1.5 text-white/95">
                  <Calendar className="h-3.5 w-3.5 text-yuui-muted" />
                  {manga.year}
                </span>
              )}
              <span
                className={`glass rounded-full px-3 py-1 flex items-center gap-1.5 capitalize font-medium ${statusColors[manga.status] || "text-white/95"}`}
              >
                <Clock className="h-3.5 w-3.5 text-yuui-muted" />
                {manga.status}
              </span>
              <span className="glass rounded-full px-3 py-1 flex items-center gap-1.5 text-white/95">
                <BookOpen className="h-3.5 w-3.5 text-yuui-muted" />
                {chapters.length} chapters
              </span>
              {manga.publicationDemographic && (
                <span className="glass rounded-full px-3 py-1 capitalize text-yuui-accent3 font-semibold">
                  {manga.publicationDemographic}
                </span>
              )}
              <span className="glass rounded-full px-3 py-1 uppercase text-yuui-muted font-semibold tracking-wider text-[10px]">
                {manga.contentRating}
              </span>
            </div>
          </div>
          <button
            onClick={onFavoriteClick}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/55 backdrop-blur px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black/75 active:scale-[0.97]"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                fav ? "fill-rose-500 text-rose-500" : "text-white/80"
              }`}
            />
            {fav ? "Favorited" : "Favorite"}
          </button>
        </div>
      </div>

      {/* Main split grid */}
      <div className="px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left column info panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Format / language info */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-yuui-muted">
              Format Info
            </h3>
            <div className="space-y-1.5 text-xs text-white/85 border border-white/[0.04] bg-white/[0.01] rounded-2xl p-4">
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-yuui-muted">Original Lang</span>
                <span className="font-medium flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {getLanguageName(manga.originalLanguage)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/[0.04]">
                <span className="text-yuui-muted">Content Rating</span>
                <span className="font-medium capitalize">
                  {manga.contentRating}
                </span>
              </div>
              {manga.publicationDemographic && (
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span className="text-yuui-muted">Demographic</span>
                  <span className="font-medium capitalize">
                    {manga.publicationDemographic}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* External Links */}
          {renderLinks()}

          {/* Tags */}
          {manga.tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-yuui-muted">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {manga.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 text-[11px] text-yuui-muted font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column main panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Continue reading banner */}
          {progress && continueChapter && (
            <button
              onClick={() => goReader(navigate, manga.id, continueChapter!.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-yuui-accent/30 bg-yuui-accent/10 px-4 py-3 text-left transition-colors hover:bg-yuui-accent/20"
            >
              <PlayCircle className="h-6 w-6 text-yuui-accent" />
              <div className="flex-1">
                <span className="block text-sm font-semibold text-white/90">
                  {progress.progress >= 0.95
                    ? `Next up: Chapter ${continueChapter.chapter ?? "?"}`
                    : `Continue Reading · Chapter ${continueChapter.chapter ?? "?"}`}
                </span>
                <span className="block text-[11px] text-yuui-muted">
                  {progress.progress >= 0.95
                    ? "You finished the last-read chapter."
                    : `${Math.round(progress.progress * 100)}% of last-read chapter`}
                </span>
              </div>
            </button>
          )}

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-yuui-muted">
              Description
            </h3>
            <p className="text-sm leading-relaxed text-yuui-muted/95 whitespace-pre-line bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4">
              {manga.description || "No description available."}
            </p>
          </div>

          {/* Chapters */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-yuui-muted">
                Chapters
              </h3>
              <span className="text-xs text-yuui-muted">
                {chapters.length} total
              </span>
            </div>
            {chapters.length === 0 ? (
              <p className="text-sm text-yuui-muted py-6 text-center bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                No chapters available.
              </p>
            ) : (
              <div className="space-y-1">
                {chapters.map((ch) => {
                  const isLastRead =
                    progress?.chapter_id && progress.chapter_id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => goReader(navigate, manga.id, ch.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors border border-transparent hover:bg-white/[0.04] active:bg-white/[0.06] ${
                        isLastRead
                          ? "bg-yuui-accent/10 border-yuui-accent/20"
                          : "bg-white/[0.02] border-white/[0.04]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white/90 font-medium truncate block">
                          {ch.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-yuui-muted mt-0.5">
                          {ch.volume && <span>Vol. {ch.volume}</span>}
                          {ch.volume && <span className="opacity-40">•</span>}
                          <span>Ch. {ch.chapter || "?"}</span>
                          <span className="opacity-40">•</span>
                          <span className="uppercase font-mono">{ch.lang}</span>
                          <span className="opacity-40">•</span>
                          <span>{ch.pages} pages</span>
                          {ch.groupName && (
                            <span className="opacity-40">•</span>
                          )}
                          {ch.groupName && (
                            <span className="text-yuui-accent3 font-medium truncate max-w-[150px] md:max-w-xs">
                              {ch.groupName}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] text-yuui-muted ml-3">
                        {new Date(ch.publishAt).toLocaleDateString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
