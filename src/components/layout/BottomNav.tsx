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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 text-muted-foreground transition-colors",
              "hover:text-primary"
            )}
            activeClassName="text-primary"
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    isActive && "scale-110"
                  )}
                />
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
