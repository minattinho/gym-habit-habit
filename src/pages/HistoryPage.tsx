import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Clock, Dumbbell } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface TrainingSession {
  id: string;
  workout_name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
}

export default function HistoryPage() {
  const { user } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["training_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as TrainingSession[];
    },
    enabled: !!user,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}min`;
    }
    return `${mins}min ${secs}s`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          {sessions?.length || 0} sessão{sessions?.length !== 1 ? "ões" : ""} de treino
        </p>
      </div>

      {sessions?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">Nenhum treino realizado</h3>
            <p className="text-center text-sm text-muted-foreground">
              Inicie um treino na aba "Treinos" para ver seu histórico aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions?.map((session) => (
            <Link key={session.id} to={`/session/${session.id}/details`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {session.workout_name || "Treino Livre"}
                    </CardTitle>
                    {!session.completed_at && (
                      <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                        Em andamento
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(session.started_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(session.duration_seconds)}</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(session.started_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
