import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, ChevronRight } from "lucide-react";
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Histórico</h1>
        <p className="mt-1 text-muted-foreground">
          {sessions?.length || 0} treino{sessions?.length !== 1 ? "s" : ""} realizado{sessions?.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sessions?.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-background p-4 shadow-sm">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Nenhum treino realizado</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Complete seu primeiro treino para começar a ver seu histórico aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions?.map((session) => (
            <Link key={session.id} to={`/session/${session.id}/details`} className="block group">
              <Card className="transition-all hover:bg-muted/30 hover:shadow-md hover:border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">
                        {session.workout_name || "Treino Livre"}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
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
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                        Concluído
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="animate-pulse">
                        Em andamento
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground/80 bg-muted/50 px-2 py-1 rounded inline-block">
                      {formatDistanceToNow(new Date(session.started_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
