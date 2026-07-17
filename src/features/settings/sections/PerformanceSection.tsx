import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getSetting, setSetting } from "../../../lib/api";
import { ToggleSwitch } from "../components/ToggleSwitch";

export function PerformanceSection() {
  const [hashMatching, setHashMatching] = useState(false);

  useEffect(() => {
    async function loadHashSetting() {
      const val = await getSetting("hash_matching");
      if (val === "true") {
        setHashMatching(true);
      } else {
        setHashMatching(false);
      }
    }
    loadHashSetting();
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
    >
      <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2 select-none">
        <span>⚡</span> Performance Options
      </h2>
      <p className="mt-1 text-xs text-yuui-muted">
        Configure optimization options to speed up scanning or matching times.
      </p>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.04]">
        <div className="flex-1">
          <span className="text-xs text-white/90 font-bold block">
            File Hash Matching (AniDB)
          </span>
          <span className="text-xs text-yuui-muted block mt-1 leading-relaxed">
            Reads the full contents of new video files to compute their ED2K hash for 100% accurate file-level matching on AniDB. <strong>Disabling this speeds up scanning significantly</strong> but relies solely on title parsing for AniList.
          </span>
        </div>
        <ToggleSwitch
          checked={hashMatching}
          onChange={async (e) => {
            const checked = e.target.checked;
            setHashMatching(checked);
            await setSetting("hash_matching", checked ? "true" : "false");
          }}
        />
      </div>
    </motion.section>
  );
}
