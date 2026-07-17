import { useState } from "react";
import { motion } from "framer-motion";
import type {
  AniListMediaDetail,
  StoredEntry,
  UserData,
} from "../../../lib/types";
import { humanizeEnum } from "../../../lib/format";
import { TRACK_STATUSES } from "../../../lib/anilistStatus";
import HeroDropdown from "../components/HeroDropdown";

export function DetailHero({
  entry,
  media,
  title,
  cover,
  color,
  heroImage,
  malData,
  user,
  update,
  trailerUrl,
  handleBack,
  setShowTrailer,
}: {
  entry: StoredEntry;
  media: AniListMediaDetail | null;
  title: string;
  cover: string | null;
  color: string;
  heroImage: string | null;
  malData: {
    score: number | null;
    rank: number | null;
    popularity: number | null;
  } | null;
  user: UserData;
  update: (patch: Partial<UserData>) => Promise<void>;
  trailerUrl: string | null;
  handleBack: () => void;
  setShowTrailer: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isScoreOpen, setIsScoreOpen] = useState(false);

  const isFinished = media?.status === "FINISHED";
  const statusOptions = isFinished
    ? [...TRACK_STATUSES]
    : TRACK_STATUSES.filter((s) => s !== "Completed");
  return (
    <div className="relative">
      <div className="relative h-[340px] w-full overflow-hidden">
        {heroImage ? (
          <motion.img
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            src={heroImage}
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
              {/* Status Dropdown */}
              <HeroDropdown
                triggerLabel={user.status || "Set status…"}
                options={[
                  { value: null, label: "Set status…" },
                  ...statusOptions.map((s) => ({ value: s, label: s })),
                ]}
                selectedValue={user.status || null}
                onSelect={(v) => update({ status: v as string | null })}
                isOpen={isStatusOpen}
                onToggle={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsScoreOpen(false);
                }}
                onClose={() => setIsStatusOpen(false)}
                menuMinWidth={130}
              />

              {/* Score Dropdown */}
              <HeroDropdown
                triggerLabel={user.score ? `${user.score}/10` : "Score…"}
                options={[
                  { value: null, label: "Score…" },
                  ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => ({
                    value: s,
                    label: `${s}/10`,
                  })),
                ]}
                selectedValue={user.score ?? null}
                onSelect={(v) => update({ score: v as number | null })}
                isOpen={isScoreOpen}
                onToggle={() => {
                  setIsScoreOpen(!isScoreOpen);
                  setIsStatusOpen(false);
                }}
                onClose={() => setIsScoreOpen(false)}
                menuMinWidth={100}
              />

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
                        user.status !== "Completed" &&
                        isFinished
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
  );
}
