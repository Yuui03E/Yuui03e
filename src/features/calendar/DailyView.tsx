import { motion, AnimatePresence } from "framer-motion";
import AiringCard from "../../components/AiringCard";
import type { AiringEpisode } from "./api";
import type { Day } from "./types";

interface DailyViewProps {
  days: Day[];
  schedule: AiringEpisode[];
  filterEpisodes: (eps: AiringEpisode[]) => AiringEpisode[];
  activeTab: number;
  setActiveTab: (tab: number) => void;
  activeDayEpisodes: AiringEpisode[];
  inLibraryIds: Set<any>;
  posterWidth: number;
  layoutMode: "board" | "grid" | "list";
}

export default function DailyView({
  days,
  schedule,
  filterEpisodes,
  activeTab,
  setActiveTab,
  activeDayEpisodes,
  inLibraryIds,
  posterWidth,
  layoutMode,
}: DailyViewProps) {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Weekday Selector Tabs */}
      <div className="flex gap-2 border-b border-white/[0.04] px-6 py-3 shrink-0 overflow-x-auto select-none scrollbar-none">
        {days.map((day, i) => {
          const isActive = activeTab === i;
          const dayStart = day.timestamp;
          const dayEnd = dayStart + 24 * 60 * 60;
          const dayEpsCount = filterEpisodes(
            schedule.filter((ep) => ep.airingAt >= dayStart && ep.airingAt < dayEnd)
          ).length;

          return (
            <button
              key={day.timestamp}
              onClick={() => setActiveTab(i)}
              className={`relative flex flex-col items-center px-5 py-2 rounded-xl transition-all cursor-pointer ${
                isActive ? "text-white" : "text-yuui-muted hover:text-white"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="calendar-tab-active"
                  className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <span className="text-xs font-semibold relative z-10">{day.name}</span>
              <div className="flex items-center gap-1.5 mt-0.5 relative z-10">
                <span className="text-[9px]">{day.dateStr}</span>
                {dayEpsCount > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[8px] font-bold font-mono">
                    {dayEpsCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day Episodes Grid/List */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeDayEpisodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="text-5xl">💤</div>
            <p className="text-yuui-muted font-medium text-sm">
              No scheduled episodes airing on this day matching the filters.
            </p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid gap-6 pb-10"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${
                layoutMode === "grid" ? posterWidth + 40 : posterWidth + 240
              }px, 1fr))`,
            }}
          >
            <AnimatePresence mode="popLayout">
              {activeDayEpisodes.map((ep) => (
                <motion.div
                  key={ep.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <AiringCard
                    ep={ep}
                    inLibrary={inLibraryIds.has(ep.media.id)}
                    cardStyle={layoutMode}
                    posterWidth={posterWidth}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
