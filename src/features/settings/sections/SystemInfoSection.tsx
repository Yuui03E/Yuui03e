import { motion } from "framer-motion";

export function SystemInfoSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
    >
      <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
        <span>⚙️</span> System Information
      </h2>
      <div className="mt-4 grid gap-4 grid-cols-2 text-xs">
        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
          <span className="text-yuui-muted block font-medium">
            Frontend
          </span>
          <span className="text-white/80 font-mono mt-1 block">
            React 19 + Vite 8 + TS
          </span>
        </div>
        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
          <span className="text-yuui-muted block font-medium">
            Backend Shell
          </span>
          <span className="text-white/80 font-mono mt-1 block">
            Tauri v2 + Rust
          </span>
        </div>
        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
          <span className="text-yuui-muted block font-medium">
            Local Database
          </span>
          <span className="text-white/80 font-mono mt-1 block">
            SQLite via SQLx
          </span>
        </div>
        <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
          <span className="text-yuui-muted block font-medium">
            Hashing Engine
          </span>
          <span className="text-white/80 font-mono mt-1 block">
            MD4 (ED2K)
          </span>
        </div>
      </div>
    </motion.section>
  );
}
