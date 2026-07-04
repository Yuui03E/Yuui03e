import { motion } from "framer-motion";

export default function Placeholder({
  title,
  icon,
  note,
}: {
  title: string;
  icon: string;
  note: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-6xl"
      >
        {icon}
      </motion.div>
      <h1 className="font-display text-3xl font-bold">
        <span className="text-gradient">{title}</span>
      </h1>
      <p className="max-w-md text-sm text-yuui-muted">{note}</p>
      <span className="glass rounded-full px-4 py-1.5 text-xs uppercase tracking-widest text-yuui-muted">
        Coming in a later phase
      </span>
    </div>
  );
}
