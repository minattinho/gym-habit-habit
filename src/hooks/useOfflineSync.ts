import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushQueue, queueSize } from "@/lib/offlineQueue";
import { useNetworkStatus } from "./useNetworkStatus";

export function useOfflineSync() {
  const isOnline = useNetworkStatus();
  const prevOnline = useRef(isOnline);
  const queryClient = useQueryClient();

  useEffect(() => {
    const justReconnected = isOnline && !prevOnline.current;
    prevOnline.current = isOnline;

    if (!justReconnected) return;

    const pending = queueSize();
    if (pending === 0) return;

    toast.loading(`Sincronizando ${pending} ação(ões) salvas offline...`, { id: "offline-sync" });

    flushQueue().then(({ synced, failed }) => {
      if (failed === 0) {
        toast.success(`${synced} ação(ões) sincronizada(s) com sucesso!`, { id: "offline-sync" });
      } else {
        toast.warning(`${synced} sincronizadas, ${failed} falharam. Tente novamente.`, { id: "offline-sync" });
      }
      // Refresh all queries so UI reflects synced data
      queryClient.invalidateQueries();
    });
  }, [isOnline, queryClient]);
}
