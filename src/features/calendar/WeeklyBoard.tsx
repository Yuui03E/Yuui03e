import { motion, AnimatePresence } from "framer-motion";
import AiringCard from "../../components/AiringCard";
import { AiringEpisode } from "./api";
import type { Day } from "./types";

interface WeeklyBoardProps {
  days: Day[];
  schedule: AiringEpisode[];
  filterEpisodes: (eps: AiringEpisode[]) => AiringEpisode[];
  inLibraryIds: Set<any>;
  posterWidth: number;
}

export default function WeeklyBoard({
  days,
  schedule,
  filterEpisodes,
  inLibraryIds,
  posterWidth,
}: WeeklyBoardProps) {
  return (
    <div className="h-full w-full overflow-x-auto px-6 py-4 flex gap-4 items-start scrollbar-none select-none">
      {days.map((day, i) => {
        const dayStart = day.timestamp;
        const dayEnd = dayStart + 24 * 60 * 60;
        const dayEpisodes = schedule.filter((ep) => ep.airingAt >= dayStart && ep.airingAt < dayEnd);
        const filteredDayEpisodes = filterEpisodes(dayEpisodes);
        const isToday = i === 0;

        return (
          <div
            key={day.timestamp}
            className={`w-[290px] shrink-0 flex flex-col h-full rounded-2xl border p-3 ${
              isToday
                ? "bg-yuui-accent/5 border-yuui-accent/20"
                : "bg-white/[0.01] border-white/[0.03]"
            }`}
          >
            {/* Day Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div>
                <h3 className={`font-display text-sm font-bold ${isToday ? "text-yuui-accent" : "text-white"}`}>
                  {day.name}
                </h3>
                <span className="text-[10px] text-yuui-muted font-medium block mt-0.5">
                  {day.dateStr}
                </span>
              </div>
              <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                isToday ? "bg-yuui-accent/20 text-yuui-accent" : "bg-white/5 text-white/50"
              }`}>
                {filteredDayEpisodes.length}
              </span>
            </div>

            {/* Day Episodes list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 scrollbar-none">
              {filteredDayEpisodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <span className="text-xl opacity-30">💤</span>
                  <span className="text-[10px] text-yuui-muted mt-1.5">No airings</span>
                </div>
              ) : (
                <motion.div layout className="space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {filteredDayEpisodes.map((ep) => (
                      <motion.div
                        key={ep.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <AiringCard
                          ep={ep}
                          inLibrary={inLibraryIds.has(ep.media.id)}
                          cardStyle="board"
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
      })}
    </div>
  );
}
