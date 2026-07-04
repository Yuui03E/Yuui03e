import { NavLink } from "react-router-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import { 
  Grid, 
  FileCheck, 
  Compass, 
  Calendar, 
  Settings
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
  return (
    <aside className="noselect flex flex-col h-full bg-surface border-r border-border pt-4 pb-4 shrink-0 w-[56px] items-center">
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
    </aside>
  );
}
