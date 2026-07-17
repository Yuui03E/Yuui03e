import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import { useTabState } from "./profile/hooks/useTabState";
import { useProfileData } from "./profile/hooks/useProfileData";
import { useFilterState } from "./profile/hooks/useFilterState";
import { useProfileStats } from "./profile/hooks/useProfileStats";
import ConnectAccountView from "./profile/ConnectAccountView";
import ProfileLoading from "./profile/ProfileLoading";
import ProfileHeader from "./profile/ProfileHeader";
import ProfileSidebar from "./profile/ProfileSidebar";
import OverviewTab from "./profile/OverviewTab";
import FavoritesTab from "./profile/FavoritesTab";
import SearchAddTab from "./profile/SearchAddTab";
import ActivityFeed from "./profile/ActivityFeed";

export default function ProfilePage() {
  const { saveUserData, anilistUser, logoutAnilist, loginAnilist, entries } = useLibrary();

  const { activeTab, setActiveTab } = useTabState();

  const { profile, onlineEntries, loadingProfile, refetch } = useProfileData(anilistUser);

  const [coverSize, setCoverSize] = useState(64);

  const { listFilter, setListFilter } = useFilterState();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [selectedGlobalMedia, setSelectedGlobalMedia] = useState<any | null>(null);

  const { activeEntries, stats, watchingCount, completedCount, planningCount, filteredMiddleList } =
    useProfileStats(onlineEntries, listFilter, searchQuery);

  const handleSetSelectedRowKey = (key: string | null) => {
    setSelectedRowKey(key);
    if (key === null || !key.startsWith("global-")) {
      setSelectedGlobalMedia(null);
    }
  };

  // Selected entry for Quick Edit
  const selectedEntry = useMemo(() => {
    if (selectedGlobalMedia) {
      const existing = activeEntries.find((e) => e.media?.id === selectedGlobalMedia.id);
      if (existing) {
        return existing;
      }
      return {
        key: `global-${selectedGlobalMedia.id}`,
        title: selectedGlobalMedia.title.english || selectedGlobalMedia.title.romaji || selectedGlobalMedia.title.userPreferred,
        episode_count: selectedGlobalMedia.episodes || 12,
        media: selectedGlobalMedia,
        user: {
          progress: 0,
          status: "Planning",
          score: 0,
        },
        isNew: true,
      };
    }
    return activeEntries.find((e) => e.key === selectedRowKey) || null;
  }, [activeEntries, selectedRowKey, selectedGlobalMedia]);

  // Resizing widths
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [feedWidth, setFeedWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingFeed, setIsResizingFeed] = useState(false);

  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    document.body.style.cursor = "col-resize";
  };

  const startResizeFeed = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingFeed(true);
    document.body.style.cursor = "col-resize";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(180, Math.min(450, e.clientX - 24));
        setSidebarWidth(newWidth);
      }
      if (isResizingFeed) {
        const windowWidth = window.innerWidth;
        const newWidth = Math.max(180, Math.min(450, windowWidth - e.clientX - 24));
        setFeedWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingFeed(false);
      document.body.style.cursor = "";
    };

    if (isResizingSidebar || isResizingFeed) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar, isResizingFeed]);

  // 1. Logged Out View - Locked to Connect Account card
  if (!anilistUser) {
    return <ConnectAccountView loginAnilist={loginAnilist} />;
  }

  // 2. Loading State
  if (loadingProfile) {
    return <ProfileLoading />;
  }

  // 3. Authenticated Dashboard
  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto text-white space-y-5 select-none scrollbar-thin">

      {/* Profile Header Banner */}
      <ProfileHeader
        profile={profile}
        anilistUser={anilistUser}
        logoutAnilist={logoutAnilist}
        stats={stats}
        coverSize={coverSize}
        setCoverSize={setCoverSize}
      />

      {/* Resizable Layout: Left Navigation Sidebar, Center Content, and Activity Feed */}
      <div className="flex gap-1.5 items-stretch flex-grow min-h-0 overflow-hidden w-full h-[75vh]">

        {/* LEFT COLUMN: Combined Navigation Menu (width: sidebarWidth) */}
        <div style={{ width: `${sidebarWidth}px` }} className="shrink-0 flex flex-col min-h-0 overflow-hidden">
          <ProfileSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedEntry={selectedEntry}
            selectedRowKey={selectedRowKey}
            setSelectedRowKey={handleSetSelectedRowKey}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            listFilter={listFilter}
            setListFilter={setListFilter}
            stats={stats}
            watchingCount={watchingCount}
            completedCount={completedCount}
            planningCount={planningCount}
            saveUserData={saveUserData}
            refetch={refetch}
            entries={entries}
          />
        </div>

        {/* RESIZE HANDLE 1 */}
        <div
          onMouseDown={startResizeSidebar}
          className={`w-1 hover:w-1.5 shrink-0 cursor-col-resize transition-all self-stretch flex items-center justify-center group ${
            isResizingSidebar ? "bg-yuui-accent/30" : "bg-transparent hover:bg-white/10"
          }`}
        >
          <div className="w-[1px] h-10 bg-white/10 group-hover:bg-yuui-accent group-hover:h-16 transition-all" />
        </div>

        {/* CENTER COLUMN: Content Area (flex-1) */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <AnimatePresence mode="wait">

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <OverviewTab
                key="overview-tab"
                listFilter={listFilter}
                filteredMiddleList={filteredMiddleList}
                selectedRowKey={selectedRowKey}
                setSelectedRowKey={setSelectedRowKey}
                coverSize={coverSize}
              />
            )}

            {/* TAB 2: FAVORITES */}
            {activeTab === "favorites" && (
              <FavoritesTab key="favorites-tab" profile={profile} coverSize={coverSize} />
            )}

            {/* TAB 3: GLOBAL SEARCH */}
            {activeTab === "search" && (
              <SearchAddTab
                key="search-tab"
                coverSize={coverSize}
                selectedRowKey={selectedRowKey}
                setSelectedRowKey={handleSetSelectedRowKey}
                setSelectedMedia={setSelectedGlobalMedia}
              />
            )}

          </AnimatePresence>
        </div>

        {/* RESIZE HANDLE 2 */}
        <div
          onMouseDown={startResizeFeed}
          className={`w-1 hover:w-1.5 shrink-0 cursor-col-resize transition-all self-stretch flex items-center justify-center group ${
            isResizingFeed ? "bg-yuui-accent/30" : "bg-transparent hover:bg-white/10"
          }`}
        >
          <div className="w-[1px] h-10 bg-white/10 group-hover:bg-yuui-accent group-hover:h-16 transition-all" />
        </div>

        {/* RIGHT COLUMN: AniList Activity Feed (width: feedWidth) */}
        <div style={{ width: `${feedWidth}px` }} className="shrink-0 flex flex-col min-h-0 overflow-hidden">
          {profile && <ActivityFeed userId={profile.id} />}
        </div>

      </div>
    </div>
  );
}
