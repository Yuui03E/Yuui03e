import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { graphqlAnilist } from "../../../lib/api";
import { searchGlobalMedia } from "./api";

interface SearchAddTabProps {
  coverSize: number;
  selectedRowKey: string | null;
  setSelectedRowKey: (key: string | null) => void;
  setSelectedMedia: (media: any | null) => void;
}

export default function SearchAddTab({
  coverSize,
  selectedRowKey,
  setSelectedRowKey,
  setSelectedMedia,
}: SearchAddTabProps) {
  // Global search state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<any>(null);

  // Global search triggers
  const handleGlobalSearch = async () => {
    if (!globalSearchQuery.trim()) return;
    setSearchingGlobal(true);
    try {
      const resp = await searchGlobalMedia(graphqlAnilist, globalSearchQuery);
      setGlobalSearchResults(resp?.data?.Page?.media || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setSearchingGlobal(false);
    }
  };

  const handleQueryChange = (val: string) => {
    setGlobalSearchQuery(val);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (val.trim().length >= 3) {
      const timeout = setTimeout(async () => {
        setSearchingGlobal(true);
        try {
          const resp = await searchGlobalMedia(graphqlAnilist, val);
          setGlobalSearchResults(resp?.data?.Page?.media || []);
        } catch (e) {
          console.warn(e);
        } finally {
          setSearchingGlobal(false);
        }
      }, 400); // 400ms debounce
      setSearchTimeout(timeout);
    } else if (val.trim().length === 0) {
      setGlobalSearchResults([]);
    }
  };

  return (
    <motion.div
      key="search-tab"
      initial={{ opacity: 0, x: 5 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -5 }}
      className="space-y-4 h-full overflow-y-auto pr-1 pb-8"
    >
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search AniList globally..."
          value={globalSearchQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
          className="flex-1 rounded-xl px-3.5 py-2 text-xs text-white outline-none border border-white/[0.05] bg-white/[0.01] focus:border-yuui-accent/60 transition-colors"
        />
        <button onClick={handleGlobalSearch} disabled={searchingGlobal} className="rounded-xl px-5 bg-gradient-to-r from-yuui-accent to-yuui-accent2 hover:scale-[1.02] transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 text-white">
          <Search className="h-4 w-4" />
          {searchingGlobal ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 justify-start">
        {globalSearchResults.map((media) => {
          const isSelected = selectedRowKey === `global-${media.id}`;
          const cardWidth = coverSize * 1.8;
          return (
            <div
              key={media.id}
              onClick={() => {
                if (isSelected) {
                  setSelectedMedia(null);
                  setSelectedRowKey(null);
                } else {
                  setSelectedMedia(media);
                  setSelectedRowKey(`global-${media.id}`);
                }
              }}
              style={{ width: `${cardWidth}px` }}
              className={`glass rounded-3xl p-3 border transition-all relative flex flex-col justify-between cursor-pointer group select-none shrink-0 ${
                isSelected
                  ? "border-yuui-accent shadow-[0_0_15px_rgba(255,95,162,0.35)] scale-[1.02]"
                  : "border-white/[0.04] hover:border-white/10 hover:scale-[1.01] bg-yuui-surface/20"
              }`}
            >
              <div>
                <img
                  src={media.coverImage.large}
                  alt="cover"
                  className="w-full aspect-[2/3] object-cover rounded-2xl border border-white/5 bg-white/5"
                />
                <span className="text-xs font-bold text-white/90 line-clamp-2 mt-3 leading-tight text-center">{media.title.english || media.title.romaji}</span>
                <div className="flex justify-between items-center text-[10px] text-yuui-muted mt-2 select-none font-mono px-1">
                  <span>{media.format}</span>
                  <span>{media.episodes ? `${media.episodes} eps` : "Airing"}</span>
                </div>
              </div>
              
              <button
                className={`mt-4 w-full py-1.5 border rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-yuui-accent text-white border-yuui-accent"
                    : "bg-white/5 border-white/[0.04] text-white hover:bg-yuui-accent hover:border-yuui-accent"
                }`}
              >
                {isSelected ? "Editing in Sidebar" : "+ Add to List"}
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
