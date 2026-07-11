import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ShaderBackground from "./components/ShaderBackground";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import LibraryPage from "./features/library/LibraryPage";
import DetailPage from "./features/detail/DetailPage";
import ReviewPage from "./features/review/ReviewPage";
import SettingsPage from "./features/settings/SettingsPage";
import CalendarPage from "./features/calendar/CalendarPage";
import DiscoverPage from "./features/discover/DiscoverPage";
import ProfilePage from "./features/library/ProfilePage";

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-transparent text-foreground font-sans">
      <ShaderBackground />

      {/* Custom borderless window control header */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="relative flex flex-col flex-1 min-w-0 overflow-hidden h-full">
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/"
                  element={
                    <Page>
                      <LibraryPage />
                    </Page>
                  }
                />
                <Route
                  path="/review"
                  element={
                    <Page>
                      <ReviewPage />
                    </Page>
                  }
                />
                <Route
                  path="/anime/:key"
                  element={
                    <Page>
                      <DetailPage />
                    </Page>
                  }
                />
                <Route
                  path="/discover"
                  element={
                    <Page>
                      <DiscoverPage />
                    </Page>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <Page>
                      <CalendarPage />
                    </Page>
                  }
                />
                <Route
                  path="/stats"
                  element={
                    <Page>
                      <ProfilePage defaultTab="stats" />
                    </Page>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <Page>
                      <ProfilePage />
                    </Page>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Page>
                      <SettingsPage />
                    </Page>
                  }
                />
              </Routes>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
