import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { queueSize } from "@/lib/offlineQueue";
import { useState, useEffect } from "react";

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const [pending, setPending] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setPending(queueSize());
    } else {
      // Was offline, now online — briefly show reconnected
      if (pending > 0 || showReconnected) {
        setShowReconnected(true);
        const t = setTimeout(() => setShowReconnected(false), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [isOnline]);

  // Keep pending count fresh while offline
  useEffect(() => {
    if (isOnline) return;
    const interval = setInterval(() => setPending(queueSize()), 1000);
    return () => clearInterval(interval);
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md">
        <Wifi className="h-4 w-4 shrink-0" />
        Conexão restaurada — sincronizando dados...
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      Sem conexão — dados salvos localmente
      {pending > 0 && <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">{pending} pendente{pending !== 1 ? "s" : ""}</span>}
    </div>
  );
}
