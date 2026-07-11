import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useLibrary } from "../../store/library";
import type { StoredEntry, UserData } from "../../lib/types";
import {
  cleanDescription,
  countdown,
  formatBytes,
  humanizeEnum,
} from "../../lib/format";
import VideoPlayerOverlay from "../../components/VideoPlayerOverlay";

const STATUS_OPTIONS = [
  "Watching",
  "Completed",
  "Planning",
  "Paused",
  "Dropped",
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-lg font-semibold text-white/90">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Avatar({
  src,
  name,
  sub,
}: {
  src?: string | null;
  name?: string | null;
  sub?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-yuui-panel">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-yuui-accent/15 text-lg">
            👤
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-white/90">{name ?? "—"}</div>
        {sub && <div className="truncate text-xs text-yuui-muted">{sub}</div>}
      </div>
    </div>
  );
}

export default function DetailPage() {
  const { key = "" } = useParams();
  const navigate = useNavigate();
  const decodedKey = decodeURIComponent(key);
  const { fetchEntry, saveUserData, setActiveBackdrop, entries, syncProgressToAnilist } = useLibrary();

  const getTargetKey = (id: number) => {
    const local = entries.find((e) => e.media?.id === id && e.files && e.files.length > 0);
    return local ? local.key : `anilist:${id}`;
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const [entry, setEntry] = useState<StoredEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);

  const [activeVideo, setActiveVideo] = useState<{
    path: string;
    episode: number;
    title: string;
  } | null>(null);
  const [malData, setMalData] = useState<{
    score: number | null;
    rank: number | null;
    popularity: number | null;
  } | null>(null);

  const media = entry?.media ?? null;
  const title =
    media?.title.english || media?.title.romaji || entry?.title || "Unknown";
  const banner =
    media?.bannerImage ||
    media?.coverImage?.extraLarge ||
    media?.coverImage?.large ||
    null;

  useEffect(() => {
    if (banner) {
      setActiveBackdrop(banner);
    }
    return () => {
      setActiveBackdrop(null);
    };
  }, [banner, setActiveBackdrop]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEntry(null);
    setActiveBackdrop(null);
    fetchEntry(decodedKey).then((e) => {
      if (alive) {
        setEntry(e);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [decodedKey, fetchEntry, setActiveBackdrop]);

  const cover = media?.coverImage.extraLarge || media?.coverImage.large || null;
  const color = media?.coverImage.color || "#7c5cff";

  // Fetch MAL details from Jikan dynamically
  const idMal = media?.idMal;
  useEffect(() => {
    if (!idMal) {
      setMalData(null);
      return;
    }
    let alive = true;
    fetch(`https://api.jikan.moe/v4/anime/${idMal}`)
      .then((r) => r.json())
      .then((res) => {
        if (alive && res.data) {
          setMalData({
            score: res.data.score,
            rank: res.data.rank,
            popularity: res.data.popularity,
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [idMal]);



  const description = useMemo(
    () => cleanDescription(media?.description),
    [media?.description],
  );

  const tags = (media?.tags ?? []).filter((t) => !t.isMediaSpoiler);

  const characters = media?.characters?.edges ?? [];
  const staff = media?.staff?.edges ?? [];
  const relations = (media?.relations?.edges ?? []).filter(
    (e) => e.node?.coverImage?.extraLarge || e.node?.coverImage?.large,
  );
  const recs = (media?.recommendations?.nodes ?? [])
    .map((r) => r.mediaRecommendation)
    .filter(Boolean);
  const studios = media?.studios?.nodes ?? [];

  const trailerUrl =
    media?.trailer?.site === "youtube" && media?.trailer?.id
      ? `https://www.youtube.com/embed/${media.trailer.id}`
      : null;

  const user: UserData = entry?.user ?? {
    status: null,
    score: null,
    progress: 0,
    notes: null,
    favorite: false,
  };

  const update = async (patch: Partial<UserData>) => {
    if (!entry) return;
    const next = { ...user, ...patch };
    setEntry({ ...entry, user: next });
    await saveUserData(entry.key, next);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-yuui-accent" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-5xl">🫥</div>
        <p className="text-yuui-muted font-sans text-sm">That title couldn't be found.</p>
        <button
          onClick={handleBack}
          className="glass rounded-2xl px-4 py-2 text-xs font-semibold text-white/90 hover:text-white cursor-pointer transition-all"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="relative">
        <div className="relative h-[340px] w-full overflow-hidden">
          {banner ? (
            <motion.img
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              src={banner}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(120% 120% at 50% 0%, ${color}66, #07070c 70%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-yuui-bg via-yuui-bg/40 to-transparent" />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, ${color}22, transparent 60%)`,
            }}
          />
        </div>

        <button
          onClick={handleBack}
          className="glass absolute left-6 top-6 z-10 rounded-xl px-3 py-1.5 text-sm hover:bg-white/[0.1] cursor-pointer active:scale-95 transition-all"
        >
          ← Back
        </button>

        {/* Hero content */}
        <div className="relative z-10 -mt-40 px-6">
          <div className="flex items-end gap-6">
            <motion.div
              layoutId={`cover-${entry.key}`}
              className="w-[190px] shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-card"
            >
              {cover ? (
                <img
                  src={cover}
                  alt={title}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div
                  className="grid aspect-[2/3] w-full place-items-center text-5xl"
                  style={{
                    background: `linear-gradient(160deg, ${color}55, #141420)`,
                  }}
                >
                  🌸
                </div>
              )}
            </motion.div>

            <div className="min-w-0 flex-1 pb-2">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-4xl font-bold leading-tight text-white drop-shadow"
              >
                {title}
              </motion.h1>
              {media?.title.native && (
                <p className="mt-1 text-sm text-yuui-muted">
                  {media.title.native}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {media?.format && (
                  <span className="glass rounded-full px-3 py-1">
                    {humanizeEnum(media.format)}
                  </span>
                )}
                {media?.status && (
                  <span className="glass rounded-full px-3 py-1">
                    {humanizeEnum(media.status)}
                  </span>
                )}
                {media?.seasonYear && (
                  <span className="glass rounded-full px-3 py-1">
                    {media.season ? `${humanizeEnum(media.season)} ` : ""}
                    {media.seasonYear}
                  </span>
                )}
                {media?.episodes != null && (
                  <span className="glass rounded-full px-3 py-1">
                    {media.episodes} eps
                  </span>
                )}
                {media?.averageScore != null && (
                  <span className="rounded-full bg-yuui-accent3/15 px-3 py-1 text-yuui-accent3 font-semibold">
                    ★ AniList {media.averageScore}%
                  </span>
                )}
                {malData?.score != null && (
                  <span className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-400 font-semibold">
                    ★ MAL {malData.score}/10
                  </span>
                )}
                {malData?.rank != null && (
                  <span className="glass rounded-full px-3 py-1 text-white/70">
                    Rank #{malData.rank}
                  </span>
                )}
                <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">
                  {entry.episode_count} owned
                </span>
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <select
                  value={user.status ?? ""}
                  onChange={(e) => update({ status: e.target.value || null })}
                  className="glass rounded-xl bg-transparent px-3 py-2 text-sm outline-none border border-white/[0.05]"
                >
                  <option value="" className="bg-yuui-panel font-sans">
                    Set status…
                  </option>
                  {STATUS_OPTIONS.map((s) => (
                    <option
                      key={s}
                      value={s}
                      className="bg-yuui-panel font-sans"
                    >
                      {s}
                    </option>
                  ))}
                </select>

                {/* Score Selector */}
                <select
                  value={user.score ?? ""}
                  onChange={(e) =>
                    update({
                      score: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="glass rounded-xl bg-transparent px-3 py-2 text-sm outline-none border border-white/[0.05]"
                >
                  <option value="" className="bg-yuui-panel font-sans">
                    Score…
                  </option>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => (
                    <option
                      key={s}
                      value={s}
                      className="bg-yuui-panel font-sans"
                    >
                      {s}/10
                    </option>
                  ))}
                </select>

                {/* Watch Progress Incrementer */}
                <div className="glass flex items-center rounded-xl px-2.5 py-1 text-sm border border-white/[0.05] bg-white/[0.01]">
                  <span className="text-yuui-muted select-none px-2 font-medium text-xs uppercase tracking-wider font-sans">
                    Progress: {user.progress} /{" "}
                    {media?.episodes ?? entry.episode_count}
                  </span>
                  <button
                    onClick={() =>
                      update({ progress: Math.max(0, user.progress - 1) })
                    }
                    disabled={user.progress <= 0}
                    className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center font-bold text-white transition-colors disabled:opacity-30"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      const max = media?.episodes ?? entry.episode_count;
                      if (user.progress < max) {
                        const nextProgress = user.progress + 1;
                        const patch: Partial<UserData> = {
                          progress: nextProgress,
                        };
                        if (
                          nextProgress === max &&
                          user.status !== "Completed"
                        ) {
                          patch.status = "Completed";
                        }
                        update(patch);
                      }
                    }}
                    disabled={
                      user.progress >= (media?.episodes ?? entry.episode_count)
                    }
                    className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center font-bold text-white transition-colors disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => update({ favorite: !user.favorite })}
                  className={`rounded-xl px-4 py-2 text-sm transition-colors font-semibold ${
                    user.favorite
                      ? "bg-yuui-accent/20 text-yuui-accent border border-yuui-accent/30"
                      : "glass hover:bg-white/[0.08]"
                  }`}
                >
                  {user.favorite ? "♥ Favorited" : "♡ Favorite"}
                </button>

                {trailerUrl && (
                  <button
                    onClick={() => setShowTrailer((v) => !v)}
                    className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-3 py-2 text-sm font-semibold text-white shadow-glow"
                  >
                    ▶ Trailer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-16">
        {/* Airing countdown */}
        {media?.nextAiringEpisode && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-yuui-accent2/15 px-4 py-2 text-sm text-yuui-accent2">
            ◷ Ep {media.nextAiringEpisode.episode} in{" "}
            {countdown(media.nextAiringEpisode.timeUntilAiring)}
          </div>
        )}

        {/* Trailer embed */}
        {showTrailer && trailerUrl && (
          <div className="mt-6 aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10">
            <iframe
              src={trailerUrl}
              title="Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        )}

        {/* Synopsis */}
        {description && (
          <Section title="Synopsis">
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-white/75">
              {description}
            </p>
          </Section>
        )}

        {/* Meta grid: studios, genres, tags */}
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {(studios.length > 0 || (media?.genres?.length ?? 0) > 0) && (
            <div>
              {studios.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-xs uppercase tracking-wider text-yuui-muted">
                    Studios
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {studios.map((s) => (
                      <span
                        key={s.id}
                        className="glass rounded-lg px-3 py-1 text-sm"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(media?.genres?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-yuui-muted">
                    Genres
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {media!.genres.map((g) => (
                      <button
                        key={g}
                        onClick={() =>
                          navigate(`/discover?genre=${encodeURIComponent(g)}`)
                        }
                        className="rounded-lg px-3 py-1 text-sm cursor-pointer hover:scale-105 active:scale-95 transition-all text-left"
                        style={{ background: `${color}22`, color: "#e9e9f2" }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-yuui-muted">
                Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t.name}
                    onClick={() =>
                      navigate(`/discover?tag=${encodeURIComponent(t.name)}`)
                    }
                    className="glass rounded-lg px-2.5 py-1 text-xs text-white/70 cursor-pointer hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all text-left"
                  >
                    {t.name}
                    {t.rank != null && (
                      <span className="ml-1 text-yuui-muted">{t.rank}%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Characters */}
        {characters.length > 0 && (
          <Section title="Characters & Voice Actors">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((c, i) => {
                const va = c.voiceActors?.[0];
                return (
                  <div
                    key={`${c.node?.id}-${i}`}
                    className="glass flex items-center justify-between gap-3 rounded-2xl p-3"
                  >
                    <div
                      onClick={() =>
                        c.node?.id &&
                        openUrl(
                          `https://anilist.co/character/${c.node.id}`,
                        ).catch(() => {})
                      }
                      className="cursor-pointer group flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] min-w-0"
                    >
                      <Avatar
                        src={c.node?.image?.large}
                        name={c.node?.name?.full}
                        sub={c.role ? humanizeEnum(c.role) : null}
                      />
                    </div>
                    {va && (
                      <div
                        onClick={() =>
                          va.id &&
                          openUrl(`https://anilist.co/staff/${va.id}`).catch(
                            () => {},
                          )
                        }
                        className="cursor-pointer group flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] text-right min-w-0"
                      >
                        <Avatar
                          src={va.image?.large}
                          name={va.name?.full}
                          sub="JP"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Staff */}
        {staff.length > 0 && (
          <Section title="Staff">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {staff.map((s, i) => (
                <Avatar
                  key={`${s.node?.id}-${i}`}
                  src={s.node?.image?.large}
                  name={s.node?.name?.full}
                  sub={s.role}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Relations */}
        {relations.length > 0 && (
          <Section title="Relations">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {relations.map((r, i) => {
                const targetKey = getTargetKey(r.node.id);
                return (
                  <button
                    key={`${r.node.id}-${i}`}
                    onClick={() =>
                      navigate(`/anime/${encodeURIComponent(targetKey)}`)
                    }
                    className="w-[120px] shrink-0 text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-all bg-transparent border-none p-0 outline-none"
                  >
                    <div className="overflow-hidden rounded-xl border border-white/10 group-hover:border-yuui-accent/50 transition-colors">
                      <img
                        src={
                          r.node.coverImage.extraLarge ||
                          r.node.coverImage.large ||
                          ""
                        }
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-yuui-accent2">
                      {humanizeEnum(r.relationType)}
                    </div>
                    <div className="line-clamp-2 text-xs text-white/70 group-hover:text-white transition-colors">
                      {r.node.title.english || r.node.title.romaji}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <Section title="Recommended">
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recs.map((r, i) => {
                const targetKey = getTargetKey(r!.id);
                return (
                  <button
                    key={`${r!.id}-${i}`}
                    onClick={() =>
                      navigate(`/anime/${encodeURIComponent(targetKey)}`)
                    }
                    className="w-[120px] shrink-0 text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-all bg-transparent border-none p-0 outline-none"
                  >
                    <div className="overflow-hidden rounded-xl border border-white/10 group-hover:border-yuui-accent/50 transition-colors">
                      <img
                        src={
                          r!.coverImage.extraLarge || r!.coverImage.large || ""
                        }
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-white/70 group-hover:text-white transition-colors">
                      {r!.title.english || r!.title.romaji}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Owned files */}
        <Section title={`Your Files (${entry.files.length})`}>
          <div className="max-w-4xl overflow-hidden rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-yuui-muted">
                <tr>
                  <th className="px-4 py-2">Ep</th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Group</th>
                  <th className="px-4 py-2">Quality</th>
                  <th className="px-4 py-2 text-right">Size</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entry.files.map((f) => (
                  <tr
                    key={f.path}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-2 text-yuui-muted">
                      {f.episode ?? "—"}
                    </td>
                    <td className="max-w-[360px] truncate px-4 py-2 text-white/80">
                      {f.file_name}
                    </td>
                    <td className="px-4 py-2 text-white/70">
                      {f.release_group ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-white/70">
                      {[f.resolution, f.codec].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-white/60 font-mono">
                      {formatBytes(f.size_bytes)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() =>
                            setActiveVideo({
                              path: f.path,
                              episode: f.episode || 0,
                              title: f.file_name,
                            })
                          }
                          className="rounded-lg bg-yuui-accent/20 hover:bg-yuui-accent/35 px-3 py-1 text-xs font-semibold text-yuui-accent hover:text-white transition-all duration-200"
                        >
                          ▶ Play
                        </button>
                        <button
                          onClick={() => invoke("play_video", { path: f.path })}
                          title="Open with default system media player"
                          className="rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60 hover:text-white transition-all duration-200"
                        >
                          ↗ Ext
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Phase 2: Missing episodes tracker ("what to buy") */}
        {entry.analysis && entry.analysis.missing_episodes.length > 0 && (
          <Section
            title={`Missing Episodes — ${entry.analysis.missing_episodes.length} to get`}
          >
            <div className="flex flex-wrap gap-1.5">
              {entry.analysis.missing_episodes.map((ep) => (
                <span
                  key={ep}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/15 text-xs font-semibold text-red-300"
                >
                  {ep}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-yuui-muted">
              Owned {entry.analysis.owned_episodes.length}
              {entry.analysis.total_episodes != null
                ? ` of ${entry.analysis.total_episodes}`
                : ""}
              {entry.analysis.unknown_episode_files > 0 &&
                ` · ${entry.analysis.unknown_episode_files} unnumbered`}
            </p>
          </Section>
        )}

        {/* Phase 2: Completion bar */}
        {entry.analysis?.completion != null && (
          <div className="mt-6">
            <div className="mb-1 flex justify-between text-xs text-yuui-muted">
              <span>Completion</span>
              <span>{Math.round(entry.analysis.completion * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yuui-accent to-yuui-accent2"
                style={{
                  width: `${Math.round(entry.analysis.completion * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Phase 2: Duplicate detection */}
        {entry.analysis && entry.analysis.duplicates.length > 0 && (
          <Section title={`Duplicates — ${entry.analysis.duplicates.length}`}>
            <div className="space-y-2">
              {entry.analysis.duplicates.map((d) => (
                <div
                  key={d.episode}
                  className="glass flex items-center justify-between gap-3 rounded-xl p-3"
                >
                  <div>
                    <div className="text-sm text-white/90">
                      Episode {d.episode}
                    </div>
                    <div className="text-xs text-yuui-muted">{d.reason}</div>
                  </div>
                  <span className="rounded-md bg-yellow-500/15 px-2 py-1 text-xs text-yellow-300">
                    {d.redundant.length} redundant
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Phase 2: Quality upgrades */}
        {entry.analysis && entry.analysis.upgrades.length > 0 && (
          <Section
            title={`Quality Upgrades — ${entry.analysis.upgrades.length}`}
          >
            <div className="flex flex-wrap gap-2">
              {entry.analysis.upgrades.map((u) => (
                <div
                  key={u.episode}
                  className="glass rounded-xl px-3 py-2 text-xs"
                  title={u.note}
                >
                  <span className="text-white/80">Ep {u.episode}</span>
                  <span className="ml-2 text-yuui-muted">
                    {u.current_best_resolution ?? "?"}
                  </span>
                  <span className="ml-2 text-yuui-accent2">
                    ↑ {entry.analysis!.best_resolution}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Phase 2: Per-release-group coverage */}
        {entry.analysis && entry.analysis.groups.length > 0 && (
          <Section title="Release Group Coverage">
            <div className="space-y-2">
              {entry.analysis.groups.map((g) => (
                <div
                  key={g.group}
                  className="glass flex items-center justify-between gap-3 rounded-xl p-3"
                >
                  <div>
                    <div className="text-sm text-white/90">{g.group}</div>
                    <div className="mt-0.5 text-xs text-yuui-muted">
                      {g.owned_episodes.length} episodes · {g.file_count} files
                    </div>
                  </div>
                  <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
                    {g.owned_episodes.slice(0, 20).map((ep) => (
                      <span
                        key={ep}
                        className="grid h-6 w-6 place-items-center rounded bg-white/5 text-[10px] text-white/60"
                      >
                        {ep}
                      </span>
                    ))}
                    {g.owned_episodes.length > 20 && (
                      <span className="text-[10px] text-yuui-muted">
                        +{g.owned_episodes.length - 20}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Notes */}
        <Section title="Notes">
          <textarea
            value={user.notes ?? ""}
            onChange={(e) =>
              setEntry({ ...entry, user: { ...user, notes: e.target.value } })
            }
            onBlur={(e) => update({ notes: e.target.value || null })}
            placeholder="Private notes about this series…"
            className="glass min-h-[100px] w-full max-w-3xl rounded-2xl bg-transparent p-4 text-sm outline-none placeholder:text-yuui-muted"
          />
        </Section>
      </div>

      {activeVideo &&
        (() => {
          const nextEpisodeNum = activeVideo.episode + 1;
          const nextFile = entry.files.find(
            (f) => f.episode === nextEpisodeNum,
          );

          return (
            <VideoPlayerOverlay
              filePath={activeVideo.path}
              episodeNumber={activeVideo.episode}
              title={activeVideo.title}
              onClose={() => setActiveVideo(null)}
              onWatched={async () => {
                const nextProgress = Math.max(
                  user.progress,
                  activeVideo.episode,
                );
                const max = media?.episodes ?? entry.episode_count;
                const isCompleted = nextProgress === max;
                const patch: Partial<UserData> = { progress: nextProgress };
                if (isCompleted && user.status !== "Completed") {
                  patch.status = "Completed";
                }
                await update(patch);
                if (media?.id) {
                  await syncProgressToAnilist(media.id, activeVideo.episode, isCompleted);
                }
              }}
              hasNextEpisode={!!nextFile}
              onPlayNext={() => {
                if (nextFile) {
                  setActiveVideo({
                    path: nextFile.path,
                    episode: nextFile.episode || 0,
                    title: nextFile.file_name,
                  });
                } else {
                  setActiveVideo(null);
                }
              }}
            />
          );
        })()}
    </div>
  );
}
