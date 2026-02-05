import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, TrendingUp, Calendar, Dumbbell } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
}

interface ProgressData {
  date: string;
  weight: number;
  volume: number;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  const { data: exercises, isLoading: loadingExercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, muscle_group")
        .or(`is_global.eq.true,user_id.eq.${user?.id}`)
        .order("name");

      if (error) throw error;
      return data as Exercise[];
    },
    enabled: !!user,
  });

  const { data: progressData, isLoading: loadingProgress } = useQuery({
    queryKey: ["exercise_progress", selectedExercise],
    queryFn: async () => {
      // Get all session sets for this exercise
      const { data: sessions, error } = await supabase
        .from("session_exercises")
        .select(`
          id,
          exercise_id,
          session_id,
          training_sessions!inner(started_at, user_id),
          session_sets(weight, reps, is_completed)
        `)
        .eq("exercise_id", selectedExercise)
        .eq("training_sessions.user_id", user?.id)
        .order("training_sessions(started_at)", { ascending: true });

      if (error) throw error;

      // Calculate max weight and total volume per session
      const progressByDate: Record<string, { weight: number; volume: number }> = {};

      for (const session of sessions || []) {
        const date = format(
          new Date((session.training_sessions as any).started_at),
          "dd/MM"
        );
        
        let maxWeight = 0;
        let totalVolume = 0;

        for (const set of session.session_sets || []) {
          if (set.is_completed && set.weight && set.reps) {
            maxWeight = Math.max(maxWeight, set.weight);
            totalVolume += set.weight * set.reps;
          }
        }

        if (maxWeight > 0) {
          if (!progressByDate[date]) {
            progressByDate[date] = { weight: 0, volume: 0 };
          }
          progressByDate[date].weight = Math.max(progressByDate[date].weight, maxWeight);
          progressByDate[date].volume += totalVolume;
        }
      }

      return Object.entries(progressByDate).map(([date, data]) => ({
        date,
        weight: data.weight,
        volume: data.volume,
      })) as ProgressData[];
    },
    enabled: !!selectedExercise && !!user,
  });

  const { data: pr } = useQuery({
    queryKey: ["personal_record", selectedExercise],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("weight, reps, achieved_at")
        .eq("exercise_id", selectedExercise)
        .eq("user_id", user?.id)
        .order("weight", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!selectedExercise && !!user,
  });

  if (loadingExercises) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Progresso</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe sua evolução em cada exercício
        </p>
      </div>

      <div className="mb-6">
        <Select value={selectedExercise} onValueChange={setSelectedExercise}>
          <SelectTrigger className="touch-target">
            <SelectValue placeholder="Selecione um exercício" />
          </SelectTrigger>
          <SelectContent>
            {exercises?.map((exercise) => (
              <SelectItem key={exercise.id} value={exercise.id}>
                {exercise.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedExercise ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">Selecione um exercício</h3>
            <p className="text-center text-sm text-muted-foreground">
              Escolha um exercício acima para ver sua evolução
            </p>
          </CardContent>
        </Card>
      ) : loadingProgress ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Trophy className="h-4 w-4 text-primary" />
                  Recorde (PR)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {pr ? `${pr.weight}kg` : "—"}
                </p>
                {pr && (
                  <p className="text-xs text-muted-foreground">
                    {pr.reps} reps
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  Sessões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {progressData?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">treinos</p>
              </CardContent>
            </Card>
          </div>

          {/* Weight Progress Chart */}
          {progressData && progressData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução de Carga</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `${value}kg`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 0 }}
                          name="Peso (kg)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Volume Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `${value}kg`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="volume"
                          stroke="hsl(142 71% 60%)"
                          strokeWidth={2}
                          dot={{ fill: "hsl(142 71% 60%)", strokeWidth: 0 }}
                          name="Volume (kg)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
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
        </div>
      )}
    </div>
  );
}
