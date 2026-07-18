import { motion } from "framer-motion";
import { LibrarySection } from "./sections/LibrarySection";
import { ThemeSection } from "./sections/ThemeSection";
import { PerformanceSection } from "./sections/PerformanceSection";
import { SystemInfoSection } from "./sections/SystemInfoSection";
import { TmdbSection } from "./sections/TmdbSection";
import { AnilistSection } from "./sections/AnilistSection";
import { MangadexSection } from "./sections/MangadexSection";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pt-5 pb-8">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-4xl font-bold"
        >
          App <span className="text-gradient">Settings</span>
        </motion.h1>
        <p className="mt-1 text-sm text-yuui-muted">
          Manage your library folders and system diagnostics.
        </p>
      </div>

      <div className="mt-8 flex-1 space-y-6 max-w-3xl">
        {/* Library Section */}
        <LibrarySection />

        {/* Theme & Personalization Section */}
        <ThemeSection />

        {/* Performance Settings Section */}
        <PerformanceSection />

        {/* System Info Section */}
        <SystemInfoSection />

        {/* TMDB Backdrops Section */}
        <TmdbSection />

        {/* AniList Integration Section */}
        <AnilistSection />

        {/* MangaDex Integration Section */}
        <MangadexSection />
      </div>
    </div>
  );
}
