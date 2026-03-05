import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Clock, ChevronRight, GitCompareArrows } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { SessionCompareSheet } from "@/components/history/SessionCompareSheet";

interface TrainingSession {
  id: string;
  workout_id: string | null;
  workout_name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
}

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [allSessions, setAllSessions] = useState<TrainingSession[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [compareSessionId, setCompareSessionId] = useState<string | null>(null);

  const { data: total } = useQuery({
    queryKey: ["training_sessions_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("training_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { isLoading, isFetching } = useQuery({
    queryKey: ["training_sessions", page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (error) throw error;

      const sessions = (data ?? []) as TrainingSession[];
      setAllSessions((prev) =>
        page === 0 ? sessions : [...prev, ...sessions]
      );
      setHasMore(sessions.length === PAGE_SIZE);
      return sessions;
    },
    enabled: !!user,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}min`;
    }
    return `${mins}min`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 pb-32">
      <div className="mb-8 animate-slide-up">
        <h1 className="text-3xl font-bold tracking-tight text-white">Histórico</h1>
        <p className="mt-1 text-white/60">
          {total ?? 0} treino{total !== 1 ? "s" : ""} realizado{total !== 1 ? "s" : ""}
        </p>
      </div>

      {allSessions.length === 0 ? (
        <div className="glass rounded-2xl border border-dashed border-white/20">
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="mb-4 rounded-full bg-white/10 p-4">
              <Calendar className="h-8 w-8 text-white/50" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-white">Nenhum treino realizado</h3>
            <p className="max-w-xs text-sm text-white/60">
              Complete seu primeiro treino para começar a ver seu histórico aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {allSessions.map((session, index) => (
            <Link
              key={session.id}
              to={`/session/${session.id}`}
              className="block group animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="glass rounded-2xl shadow-xl transition-all hover:translate-y-[-2px] hover:shadow-2xl hover:bg-white/[0.08]">
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold text-white">
                        {session.workout_name || "Treino Livre"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-sm text-white/60">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDuration(session.duration_seconds)}</span>
                        </div>
                        <span>•</span>
                        <span>
                          {format(new Date(session.started_at), "dd 'de' MMM", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    {session.completed_at ? (
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        Concluído
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="animate-pulse">
                        Em andamento
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="px-5 pb-4 pt-0">
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded inline-block">
                      {formatDistanceToNow(new Date(session.started_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      {session.completed_at && session.workout_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 px-2 text-xs text-white/50 hover:text-white hover:bg-white/10"
                          onClick={(e) => {
                            e.preventDefault();
                            setCompareSessionId(session.id);
                          }}
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" />
                          Comparar
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setPage((p) => p + 1)}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Carregar mais
            </Button>
          )}
        </div>
      )}

      <SessionCompareSheet
        sessionId={compareSessionId}
        onClose={() => setCompareSessionId(null)}
      />
    </div>
  );
}
