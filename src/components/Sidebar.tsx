import { NavLink } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useLibrary } from "../store/library";
import { 
  Grid, 
  FileCheck, 
  Compass, 
  Calendar, 
  Settings,
  BarChart3,
  User
} from "lucide-react";

interface NavItemProps {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function SidebarNavItem({ to, label, Icon }: NavItemProps) {
  const content = (isActive: boolean) => (
    <div
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 select-none ${
        isActive
          ? "border-accent/20 bg-accent/10 text-accent font-semibold"
          : "border-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 h-4.5 w-[2.5px] rounded-full bg-accent" />
      )}
      <Icon className="h-4.5 w-4.5 shrink-0" />
    </div>
  );

  return (
    <NavLink to={to} end={to === "/"} className="group/item block">
      {({ isActive }) => (
        <Tooltip.Provider delayDuration={150}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              {content(isActive)}
            </Tooltip.Trigger>
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
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </NavLink>
  );
}

const navGroups = [
  {
    title: "Library",
    items: [
      { to: "/", label: "Library", Icon: Grid },
      { to: "/review", label: "Review", Icon: FileCheck },
      { to: "/stats", label: "Stats", Icon: BarChart3 },
    ]
  },
  {
    title: "Discover",
    items: [
      { to: "/discover", label: "Discover", Icon: Compass },
      { to: "/calendar", label: "Calendar", Icon: Calendar },
    ]
  },
  {
    title: "System",
    items: [
      { to: "/settings", label: "Settings", Icon: Settings },
    ]
  }
];

export default function Sidebar() {
  const { anilistUser } = useLibrary();

  return (
    <aside className="noselect flex flex-col h-full bg-black border-r border-border pt-4 pb-4 shrink-0 w-[56px] items-center justify-between">
      <div className="flex flex-col items-center w-full flex-1">
        {/* Logo Area */}
        <div className="h-10 flex items-center justify-center shrink-0 mb-4">
          <span className="text-xl shrink-0">🌸</span>
        </div>

        {/* Nav groups */}
        <div className="flex-1 flex flex-col gap-2 p-1 overflow-y-auto w-full items-center">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title} className="flex flex-col gap-1.5 items-center w-full">
              {groupIdx > 0 && (
                <hr className="border-border w-8 my-1" />
              )}
              
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  Icon={item.Icon}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Profile Button */}
      <div className="mt-auto pt-4 border-t border-border/40 w-full flex justify-center">
        <NavLink to="/profile" className="group/profile block select-none">
          {({ isActive }) => (
            <Tooltip.Provider delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    className={`relative h-9 w-9 rounded-full border flex items-center justify-center overflow-hidden transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "border-accent/30 ring-2 ring-accent/15"
                        : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    {anilistUser ? (
                      <img
                        src={anilistUser.avatarUrl}
                        alt={anilistUser.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4.5 w-4.5 text-muted-foreground group-hover/profile:text-foreground transition-colors" />
                    )}
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    sideOffset={10}
                    className="radix-tooltip-content z-[100]"
                  >
                    {anilistUser ? `${anilistUser.name}'s Profile` : "Connect AniList"}
                    <Tooltip.Arrow className="fill-surface-elevated" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
