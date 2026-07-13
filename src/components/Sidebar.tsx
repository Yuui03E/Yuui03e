import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useLibrary } from "../store/library";
import logoImg from "../assets/yuui_logo_better.png";
import {
  Grid,
  FileCheck,
  Compass,
  Calendar,
  Settings,
  User,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Library", Icon: Grid },
  { to: "/review", label: "Review", Icon: FileCheck },
  { to: "/discover", label: "Discover", Icon: Compass },
  { to: "/calendar", label: "Calendar", Icon: Calendar },
  { to: "/settings", label: "Settings", Icon: Settings },
];

// Shared box + icon dimensions so every option matches.
const BTN_CLS =
  "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 select-none no-drag";
const ICON_CLS = "h-7 w-7 shrink-0"; // 28px size

function TipContent({ label }: { label: string }) {
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        side="right"
        sideOffset={10}
        className="radix-tooltip-content z-[100]"
      >
        {label}
        <Tooltip.Arrow className="fill-surface-elevated" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

function SidebarNavItem({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `${BTN_CLS} relative group/item ${
          isActive
            ? "border-accent/20 bg-accent/10 text-accent"
            : "border-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
        }`
      }
    >
      {({ isActive }) => (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <span className="flex h-full w-full items-center justify-center select-none">
              {isActive && (
                <span className="absolute left-0 h-5.5 w-[2.5px] rounded-full bg-accent" />
              )}
              <Icon className={ICON_CLS} />
            </span>
          </Tooltip.Trigger>
          <TipContent label={label} />
        </Tooltip.Root>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { anilistUser } = useLibrary();
  const [hidden, setHidden] = useState(
    () => localStorage.getItem("yuui_sidebar_hidden") === "true",
  );

  const setSidebarHidden = (v: boolean) => {
    setHidden(v);
    localStorage.setItem("yuui_sidebar_hidden", String(v));
  };

  return (
    <Tooltip.Provider delayDuration={150}>
      <AnimatePresence initial={false}>
        {!hidden && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 56, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            className="noselect flex h-full shrink-0 flex-col items-center overflow-hidden border-r border-border bg-black py-3"
          >
            {/* Yuui logo mark */}
            <div className="flex h-11 w-11 items-center justify-center select-none no-drag mb-4 relative">
              <img
                src={logoImg}
                alt="Yuui"
                className="h-8.5 w-8.5 object-contain select-none pointer-events-none"
              />
            </div>

            {/* Top: navigation — one evenly-spaced, aligned column */}
            <div className="flex flex-col items-center gap-2">
              {NAV_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  Icon={item.Icon}
                />
              ))}
            </div>

            {/* Bottom: collapse toggle, then Profile at the very bottom */}
            <div className="mt-auto flex flex-col items-center gap-2">
              <button
                onClick={() => setSidebarHidden(true)}
                className={`${BTN_CLS} border-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground`}
              >
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="flex h-full w-full items-center justify-center">
                      <PanelLeftClose className={ICON_CLS} />
                    </span>
                  </Tooltip.Trigger>
                  <TipContent label="Hide sidebar" />
                </Tooltip.Root>
              </button>

              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `${BTN_CLS} relative overflow-hidden group/profile ${
                    isActive
                      ? "border-accent/25 bg-accent/10"
                      : "border-transparent hover:bg-surface-elevated"
                  }`
                }
              >
                {({ isActive }) => (
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="flex h-full w-full items-center justify-center">
                        {isActive && (
                          <span className="absolute left-0 h-5.5 w-[2.5px] rounded-full bg-accent" />
                        )}
                        {anilistUser ? (
                          <img
                            src={anilistUser.avatarUrl}
                            alt={anilistUser.name}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-7 w-7 shrink-0 text-muted-foreground group-hover/profile:text-foreground transition-colors" />
                        )}
                      </span>
                    </Tooltip.Trigger>
                    <TipContent
                      label={
                        anilistUser
                          ? `${anilistUser.name}'s Profile`
                          : "Connect AniList"
                      }
                    />
                  </Tooltip.Root>
                )}
              </NavLink>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Floating reopen button when hidden — bottom-left corner */}
      <AnimatePresence>
        {hidden && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setSidebarHidden(false)}
            title="Show sidebar"
            className={`${BTN_CLS} fixed left-3 bottom-4 z-[80] border-border bg-black/80 text-muted-foreground shadow-lg backdrop-blur hover:bg-surface-elevated hover:text-foreground`}
          >
            <PanelLeft className={ICON_CLS} />
          </motion.button>
        )}
      </AnimatePresence>
    </Tooltip.Provider>
  );
}
