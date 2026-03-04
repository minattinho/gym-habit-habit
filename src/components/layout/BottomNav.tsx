import { NavLink } from "@/components/NavLink";
import { Dumbbell, History, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: Dumbbell, label: "Treinos" },
  { to: "/history", icon: History, label: "Histórico" },
  { to: "/progress", icon: TrendingUp, label: "Progresso" },
  { to: "/profile", icon: User, label: "Perfil" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 safe-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className="flex-1"
            activeClassName=""
          >
            {({ isActive }) => (
              <div
                className={cn(
                  "relative mx-auto flex w-fit flex-col items-center gap-0.5 rounded-xl px-4 py-2 transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive && "scale-110"
                  )}
                />
                <span className="text-[10px] font-semibold tracking-wide">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
