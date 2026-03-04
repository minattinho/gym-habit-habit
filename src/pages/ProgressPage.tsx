import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseSearchSelect } from "@/components/progress/ExerciseSearchSelect";
import { SummaryCards } from "@/components/progress/SummaryCards";
import { ProgressChart } from "@/components/progress/ProgressChart";
import { SessionHistory } from "@/components/progress/SessionHistory";
import {
  ProcessedSession,
  SessionData,
  MetricType,
  processSession,
  filterByPeriod,
  getMetricLabel,
} from "@/lib/exercise-stats";

type PeriodType = "30d" | "90d" | "1y" | "all";

export default function ProgressPage() {
  const { user } = useAuth();
  const [selectedExercise, setSelectedExercise] = useState("");
  const [period, setPeriod] = useState<PeriodType>("all");
  const [metric, setMetric] = useState<MetricType>("e1rm");
  const [selectorOpen, setSelectorOpen] = useState(false);

  // All exercises
  const { data: exercises = [], isLoading: loadingExercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, muscle_group")
        .or(`is_global.eq.true,user_id.eq.${user?.id}`)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; muscle_group: string }[];
    },
    enabled: !!user,
  });

  // Recent exercises
  const { data: recentIds = [] } = useQuery({
    queryKey: ["recent_exercises", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercises")
        .select("exercise_id, created_at, training_sessions!inner(user_id)")
        .eq("training_sessions.user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const row of data || []) {
        if (!seen.has(row.exercise_id) && ids.length < 5) {
          seen.add(row.exercise_id);
          ids.push(row.exercise_id);
        }
      }
      return ids;
    },
    enabled: !!user,
  });

  // Main progress data
  const { data: rawSessions, isLoading: loadingProgress } = useQuery({
    queryKey: ["exercise_progress", selectedExercise],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercises")
        .select(`
          id,
          exercise_id,
          session_id,
          training_sessions!inner(started_at, workout_name, completed_at, user_id),
          session_sets(id, weight, reps, is_completed, order_index)
        `)
        .eq("exercise_id", selectedExercise)
        .eq("training_sessions.user_id", user?.id)
        .not("training_sessions.completed_at", "is", null);

      if (error) throw error;
      return (data || []).map((row): SessionData => ({
        sessionId: row.id,
        date: new Date((row.training_sessions as any).started_at),
        workoutName: (row.training_sessions as any).workout_name,
        sets: (row.session_sets || []).map((s: any) => ({
          id: s.id,
          weight: s.weight,
          reps: s.reps,
          is_completed: s.is_completed,
          order_index: s.order_index,
        })),
      }));
    },
    enabled: !!selectedExercise && !!user,
  });

  const allSessions = useMemo(
    () => (rawSessions || []).map(processSession),
    [rawSessions]
  );

  const filteredSessions = useMemo(
    () => filterByPeriod(allSessions, period),
    [allSessions, period]
  );

  if (loadingExercises) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Progresso</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe sua evolução em cada exercício
        </p>
      </div>

      {/* Exercise Selector */}
      <ExerciseSearchSelect
        exercises={exercises}
        recentExerciseIds={recentIds}
        value={selectedExercise}
        onSelect={setSelectedExercise}
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
      />

      {!selectedExercise ? (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">Selecione um exercício</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Escolha um exercício acima para ver sua evolução
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectorOpen(true)}
            >
              Ver recentes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <SummaryCards sessions={allSessions} isLoading={loadingProgress} />

          {/* Filters */}
          <div className="flex items-center justify-between gap-2">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(v) => v && setPeriod(v as PeriodType)}
              size="sm"
              className="bg-muted rounded-lg p-0.5"
            >
              <ToggleGroupItem value="30d" className="text-xs px-2.5 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">30d</ToggleGroupItem>
              <ToggleGroupItem value="90d" className="text-xs px-2.5 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">90d</ToggleGroupItem>
              <ToggleGroupItem value="1y" className="text-xs px-2.5 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">1a</ToggleGroupItem>
              <ToggleGroupItem value="all" className="text-xs px-2.5 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">Tudo</ToggleGroupItem>
            </ToggleGroup>

            <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="e1rm">1RM estimado</SelectItem>
                <SelectItem value="weight">Carga</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="reps">Reps</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Chart */}
          <ProgressChart
            sessions={filteredSessions}
            metric={metric}
            isLoading={loadingProgress}
          />

          {/* No data ever */}
          {!loadingProgress && allSessions.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">Sem dados ainda</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Treine este exercício para ver seu progresso aqui
                </p>
              </CardContent>
            </Card>
          )}

          {/* Session History */}
          <SessionHistory
            sessions={filteredSessions}
            exerciseId={selectedExercise}
            isLoading={loadingProgress}
          />
        </>
      )}
    </div>
  );
}
