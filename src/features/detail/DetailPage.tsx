import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLibrary } from "../../store/library";
import type { UserData } from "../../lib/types";
import { cleanDescription } from "../../lib/format";
import VideoPlayerOverlay from "../../components/VideoPlayerOverlay";
import { useDetailBackdrops } from "./hooks/useDetailBackdrops";
import { useMalData } from "./hooks/useMalData";
import { useDetailEntry } from "./hooks/useDetailEntry";
import { DetailHero } from "./sections/DetailHero";
import { DetailMeta } from "./sections/DetailMeta";
import { CharactersSection } from "./sections/CharactersSection";
import { StaffSection } from "./sections/StaffSection";
import { RelationsSection } from "./sections/RelationsSection";
import { RecommendationsSection } from "./sections/RecommendationsSection";
import { OwnedFilesTable, type ActiveVideo } from "./sections/OwnedFilesTable";
import { AnalysisSections } from "./sections/AnalysisSections";
import { NotesSection } from "./sections/NotesSection";

export default function DetailPage() {
  const { key = "" } = useParams();
  const navigate = useNavigate();
  const decodedKey = decodeURIComponent(key);
  const { entries, syncProgressToAnilist } = useLibrary();

  const { entry, setEntry, loading, user, update } = useDetailEntry(decodedKey);

  const media = entry?.media ?? null;

  useDetailBackdrops(media);
  const malData = useMalData(media?.idMal);

  const [showTrailer, setShowTrailer] = useState(false);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

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

  const title =
    media?.title.english || media?.title.romaji || entry?.title || "Unknown";
  const cover = media?.coverImage.extraLarge || media?.coverImage.large || null;
  const color = media?.coverImage.color || "#7c5cff";
  // Hero image keeps a graceful fallback chain (banner → cover) since it's a
  // framed 340px header, not the full-screen background.
  const heroImage =
    media?.bannerImage ||
    media?.coverImage?.extraLarge ||
    media?.coverImage?.large ||
    null;

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
      <DetailHero
        entry={entry}
        media={media}
        title={title}
        cover={cover}
        color={color}
        heroImage={heroImage}
        malData={malData}
        user={user}
        update={update}
        trailerUrl={trailerUrl}
        handleBack={handleBack}
        setShowTrailer={setShowTrailer}
      />

      <div className="px-6 pb-16">
        <DetailMeta
          media={media}
          showTrailer={showTrailer}
          trailerUrl={trailerUrl}
          description={description}
          studios={studios}
          tags={tags}
          color={color}
          navigate={navigate}
        />

        <CharactersSection characters={characters} />

        <StaffSection staff={staff} />

        <RelationsSection
          relations={relations}
          getTargetKey={getTargetKey}
          navigate={navigate}
        />

        <RecommendationsSection
          recs={recs}
          getTargetKey={getTargetKey}
          navigate={navigate}
        />

        <OwnedFilesTable entry={entry} setActiveVideo={setActiveVideo} />

        <AnalysisSections entry={entry} />

        <NotesSection
          entry={entry}
          user={user}
          setEntry={setEntry}
          update={update}
        />
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
                const isCompleted = nextProgress === max && media?.status === "FINISHED";
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
