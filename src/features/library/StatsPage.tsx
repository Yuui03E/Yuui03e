import { useMemo } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "../../store/library";
import { BarChart3 } from "lucide-react";

export default function StatsPage() {
  const { entries, folder } = useLibrary();

  const stats = useMemo(() => {
    let totalWatchedEps = 0;
    let totalSize = 0;
    let scoredCount = 0;
    let totalScoreSum = 0;
    let completedCount = 0;

    const genres: Record<string, number> = {};
    const formats: Record<string, number> = {};
    const studios: Record<string, number> = {};

    entries.forEach((e) => {
      const epProgress = e.user?.progress ?? 0;
      totalWatchedEps += epProgress;

      const entrySize = e.files.reduce((sum, f: any) => sum + f.size_bytes, 0);
      totalSize += entrySize;

      // Completion (progress equals total episodes or marked completed)
      const maxEps = e.media?.episodes ?? e.episode_count ?? 1;
      if (e.user?.status === "Completed" || (epProgress >= maxEps && maxEps > 0)) {
        completedCount += 1;
      }

      // Ratings
      if (e.user?.score) {
        scoredCount += 1;
        totalScoreSum += e.user.score;
      } else if (e.media?.averageScore) {
        // Fallback to AniList average score (convert 0-100 to 0-10)
        scoredCount += 1;
        totalScoreSum += e.media.averageScore / 10;
      }

      // Genres
      if (e.media?.genres) {
        e.media.genres.forEach((g: string) => {
          genres[g] = (genres[g] || 0) + 1;
        });
      }

      // Formats
      if (e.media?.format) {
        formats[e.media.format] = (formats[e.media.format] || 0) + 1;
      } else {
        formats["UNKNOWN"] = (formats["UNKNOWN"] || 0) + 1;
      }

      // Studios (Main)
      const mainStudios = e.media?.studios?.nodes;
      if (Array.isArray(mainStudios)) {
        mainStudios.forEach((s: any) => {
          if (s?.name) {
            studios[s.name] = (studios[s.name] || 0) + 1;
          }
        });
      }
    });

    const totalHours = Math.round((totalWatchedEps * 24) / 60);
    const totalDays = (totalHours / 24).toFixed(1);

    const averageRating = scoredCount > 0 ? (totalScoreSum / scoredCount).toFixed(1) : "—";
    const completionRate = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0;

    const topGenres = Object.entries(genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topStudios = Object.entries(studios)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Format breakdown for charts
    const formatBreakdown = Object.entries(formats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Find longest anime in collection
    const longestAnime = [...entries]
      .sort((a, b) => b.episode_count - a.episode_count)
      .slice(0, 5)
      .map((e) => ({
        title: e.media?.title.english || e.media?.title.romaji || e.title,
        episodes: e.episode_count,
      }));

    return {
      totalDays,
      totalHours,
      totalSize,
      averageRating,
      completionRate,
      topGenres,
      topStudios,
      formatBreakdown,
      longestAnime,
      completedCount,
    };
  }, [entries]);

  // Donut chart configuration
  const donutData = useMemo(() => {
    const total = stats.formatBreakdown.reduce((sum, item) => sum + item.count, 0);
    let cumulativePercent = 0;
    
    // Aesthetic Colors for donut slices
    const sliceColors = [
      "#7c5cff", // Accent violet
      "#ff5fa2", // Hot pink
      "#00e1d9", // Cyan
      "#f59e0b", // Amber
      "#10b981", // Emerald
      "#6b7280", // Gray
    ];

    return stats.formatBreakdown.map((item, idx) => {
      const percent = total > 0 ? (item.count / total) * 100 : 0;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      // Coordinate math for SVG pie slice (donut)
      const getCoordinatesForPercent = (p: number) => {
        const x = Math.cos(2 * Math.PI * p);
        const y = Math.sin(2 * Math.PI * p);
        return [x, y];
      };

      const [startX, startY] = getCoordinatesForPercent(startPercent / 100);
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent / 100);
      const largeArcFlag = percent > 50 ? 1 : 0;

      // Radius is 1, donut path
      const pathData = total > 0 ? [
        `M ${startX} ${startY}`,
        `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        `L 0 0`,
      ].join(" ") : "";

      return {
        ...item,
        percent: percent.toFixed(1),
        pathData,
        color: sliceColors[idx % sliceColors.length],
      };
    });
  }, [stats.formatBreakdown]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pt-5 pb-8">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-4xl font-bold"
        >
          Collection <span className="text-gradient">Statistics</span>
        </motion.h1>
        <p className="mt-1 text-sm text-yuui-muted">
          {folder || "No folder configured"}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
          <BarChart3 className="h-12 w-12 text-yuui-muted/50 mb-2 select-none" />
          <h2 className="text-lg font-semibold text-white/95">No data available</h2>
          <p className="text-sm text-yuui-muted max-w-sm">
            Configure an anime folder in settings and run a sync to generate detailed statistics.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 max-w-5xl">
          {/* Metrics summary row */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Total Watch Time</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">
                {stats.totalDays} <span className="text-xs font-semibold text-yuui-muted font-sans">Days</span>
              </div>
              <p className="mt-1 text-[10px] text-yuui-muted">~{stats.totalHours} estimated hours</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Average Rating</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">
                {stats.averageRating} <span className="text-xs font-semibold text-yuui-muted font-sans">/ 10</span>
              </div>
              <p className="mt-1 text-[10px] text-yuui-muted">Based on your ratings & AniList</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Completion Rate</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">
                {stats.completionRate}%
              </div>
              <p className="mt-1 text-[10px] text-yuui-muted">{stats.completedCount} / {entries.length} completed</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-3xl p-5 border border-white/[0.05] bg-yuui-surface/20"
            >
              <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider block">Library Size</span>
              <div className="mt-2 text-2xl font-bold font-display text-white">
                {(stats.totalSize / (1024 * 1024 * 1024)).toFixed(1)} <span className="text-xs font-semibold text-yuui-muted font-sans">GB</span>
              </div>
              <p className="mt-1 text-[10px] text-yuui-muted">
                {(stats.totalSize / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB total local disk storage
              </p>
            </motion.div>
          </div>

          {/* Graphical charts grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Genres bar chart */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass rounded-3xl p-6 border border-white/[0.05] bg-yuui-surface/25 flex flex-col justify-between"
            >
              <div>
                <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider font-display mb-4">Top Genres</h2>
                <div className="space-y-4">
                  {stats.topGenres.map(([genre, count], idx) => {
                    const maxCount = stats.topGenres[0]?.[1] || 1;
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={genre} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-white/80">{genre}</span>
                          <span className="text-yuui-muted">{count} titles</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 + idx * 0.05 }}
                            className="h-full bg-gradient-to-r from-yuui-accent to-yuui-accent2 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {stats.topGenres.length === 0 && <p className="text-xs text-yuui-muted">No genres indexed</p>}
                </div>
              </div>
            </motion.section>

            {/* Format Distribution donut chart */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-3xl p-6 border border-white/[0.05] bg-yuui-surface/25 flex flex-col justify-between"
            >
              <div>
                <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider font-display mb-4">Format Distribution</h2>
                <div className="flex items-center gap-6">
                  {/* SVG Donut */}
                  <div className="relative h-28 w-28 shrink-0">
                    <svg viewBox="-1.1 -1.1 2.2 2.2" className="h-full w-full -rotate-90">
                      {donutData.length === 0 ? (
                        <circle r="1" fill="none" stroke="#222" strokeWidth="0.3" />
                      ) : (
                        donutData.map((item, idx) => (
                          <path
                            key={idx}
                            d={item.pathData}
                            fill={item.color}
                          />
                        ))
                      )}
                      {/* Inner mask cutout */}
                      <circle r="0.65" fill="#09090f" />
                    </svg>
                  </div>

                  {/* Legends list */}
                  <div className="flex-1 space-y-2">
                    {donutData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-white/80 font-medium">{item.name}</span>
                        </div>
                        <span className="text-yuui-muted font-mono">{item.percent}% <span className="text-[10px]">({item.count})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Bottom lists (Studios + Longest Anime) */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Studios */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass rounded-3xl p-6 border border-white/[0.05] bg-yuui-surface/25"
            >
              <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider font-display mb-4">Top Studios</h2>
              <div className="divide-y divide-white/[0.04] space-y-2.5">
                {stats.topStudios.map(([studio, count], idx) => (
                  <div key={studio} className="flex items-center justify-between text-xs pt-2.5 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold font-mono text-yuui-accent w-4">#{idx + 1}</span>
                      <span className="text-white/80 font-medium">{studio}</span>
                    </div>
                    <span className="text-yuui-muted font-mono">{count} matching titles</span>
                  </div>
                ))}
                {stats.topStudios.length === 0 && (
                  <p className="text-xs text-yuui-muted pt-2">No studios indexed</p>
                )}
              </div>
            </motion.section>

            {/* Longest Anime */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-3xl p-6 border border-white/[0.05] bg-yuui-surface/25"
            >
              <h2 className="text-sm font-bold text-white/90 uppercase tracking-wider font-display mb-4">Largest Series</h2>
              <div className="divide-y divide-white/[0.04] space-y-2.5">
                {stats.longestAnime.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs pt-2.5 first:pt-0 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold font-mono text-yuui-accent2 w-4">#{idx + 1}</span>
                      <span className="text-white/80 font-medium truncate">{item.title}</span>
                    </div>
                    <span className="text-yuui-muted font-mono shrink-0">{item.episodes} episodes</span>
                  </div>
                ))}
                {stats.longestAnime.length === 0 && (
                  <p className="text-xs text-yuui-muted pt-2">No video files found</p>
                )}
              </div>
            </motion.section>
          </div>
        </div>
      )}
    </div>
  );
}
