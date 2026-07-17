import { motion } from "framer-motion";

interface NextEpisodePromptProps {
  nextCountdown: number;
  onPlayNext: () => void;
  onCancel: () => void;
}

export default function NextEpisodePrompt({
  nextCountdown,
  onPlayNext,
  onCancel,
}: NextEpisodePromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm z-40"
    >
      <div className="glass-strong p-8 rounded-3xl text-center max-w-sm border border-white/[0.08] bg-yuui-surface/60 space-y-6">
        <div className="text-4xl">🍿</div>
        <div>
          <h3 className="text-lg font-bold text-white">
            Episode Completed!
          </h3>
          <p className="mt-1.5 text-xs text-yuui-muted">
            Next episode starts in{" "}
            <span className="text-yuui-accent font-bold font-mono">
              {nextCountdown}s
            </span>
            ...
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onPlayNext}
            className="w-full rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 py-2.5 text-xs font-semibold text-white shadow-glow hover:opacity-90 transition-all cursor-pointer"
          >
            Play Now
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl bg-white/5 hover:bg-white/[0.1] py-2 text-xs font-semibold text-white/70 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}
