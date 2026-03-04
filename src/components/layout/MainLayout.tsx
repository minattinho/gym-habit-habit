import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function MainLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-emerald-950">
      {/* Ambient orbs */}
      <div
        className="pointer-events-none fixed left-1/2 top-[-8%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-float"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-[-8%] right-[-8%] h-72 w-72 rounded-full bg-secondary/15 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed left-[-5%] top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl animate-float"
        style={{ animationDelay: "1s" }}
        aria-hidden
      />

      <main className="relative pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
