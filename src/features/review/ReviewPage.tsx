import { motion } from "framer-motion";
import { useLibrary } from "../../store/library";
import SeriesRow from "./SeriesRow";

export default function ReviewPage() {
  const { entries, searchAnilist, pinMatch } = useLibrary();

  const review = entries.filter((e) => !e.matched);

  return (
    <div className="flex h-full flex-col pt-5">
      {/* Header */}
      <div className="px-6">
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-4xl font-bold"
        >
          Match <span className="text-gradient">Review</span>
        </motion.h1>
        <p className="mt-1 text-sm text-yuui-muted">
          {review.length > 0
            ? `${review.length} series need your confirmation.`
            : "All series matched — nothing to review. 🎉"}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6 scroll-smooth scrollbar-thin">
        {review.map((entry) => (
          <SeriesRow
            key={entry.key}
            entry={entry}
            searchAnilist={searchAnilist}
            pinMatch={pinMatch}
          />
        ))}

        {review.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="text-5xl">✓</div>
            <p className="text-yuui-muted">Every series has a match.</p>
          </div>
        )}
      </div>
    </div>
  );
}
