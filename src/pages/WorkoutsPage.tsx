import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pencil, Copy, Trash2, Loader2, Dumbbell, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NextWorkoutCard from "@/components/workout/NextWorkoutCard";

interface Workout {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  exercise_count?: number;
}

export default function WorkoutsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<string | null>(null);

  const { data: workouts, isLoading } = useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const { data: workoutsData, error } = await supabase
        .from("workouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get exercise counts for each workout
      const workoutsWithCounts = await Promise.all(
        (workoutsData || []).map(async (workout) => {
          const { count } = await supabase
            .from("workout_exercises")
            .select("*", { count: "exact", head: true })
            .eq("workout_id", workout.id);

          return { ...workout, exercise_count: count || 0 };
        })
      );

      return workoutsWithCounts as Workout[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      toast.success("Treino excluído com sucesso!");
      setDeleteWorkoutId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir treino");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (workout: Workout) => {
      // Create new workout
      const { data: newWorkout, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          name: `${workout.name} (cópia)`,
          description: workout.description,
          color: workout.color,
          user_id: user!.id,
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      // Copy exercises
      const { data: exercises, error: exercisesError } = await supabase
        .from("workout_exercises")
        .select("*")
        .eq("workout_id", workout.id);

      if (exercisesError) throw exercisesError;

      if (exercises && exercises.length > 0) {
        for (const ex of exercises) {
          const { data: newExercise, error: insertError } = await supabase
            .from("workout_exercises")
            .insert({
              workout_id: newWorkout.id,
              exercise_id: ex.exercise_id,
              sets_count: ex.sets_count,
              target_reps: ex.target_reps,
              target_weight: ex.target_weight,
              rest_seconds: ex.rest_seconds,
              order_index: ex.order_index,
              notes: ex.notes,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // Copy sets
          const { data: existingSets } = await supabase
            .from("workout_sets")
            .select("reps, weight, order_index")
            .eq("workout_exercise_id", ex.id);

          if (existingSets && existingSets.length > 0) {
            const newSets = existingSets.map((s: { reps: number | null; weight: number | null; order_index: number }) => ({
              workout_exercise_id: newExercise.id,
              reps: s.reps,
              weight: s.weight,
              order_index: s.order_index,
            }));

            await supabase.from("workout_sets").insert(newSets);
          }
        }
      }

      return newWorkout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      toast.success("Treino duplicado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao duplicar treino");
    },
  });

  const startSession = async (workout: Workout) => {
    try {
      // 1. Create session + fetch exercises in parallel
      const [sessionResult, exercisesResult] = await Promise.all([
        supabase
          .from("training_sessions")
          .insert({
            user_id: user!.id,
            workout_id: workout.id,
            workout_name: workout.name,
          })
          .select()
          .single(),
        supabase
          .from("workout_exercises")
          .select("*, exercises(name)")
          .eq("workout_id", workout.id)
          .order("order_index"),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (exercisesResult.error) throw exercisesResult.error;

      const session = sessionResult.data;
      const workoutExercises = exercisesResult.data || [];

      if (workoutExercises.length === 0) {
        navigate(`/session/${session.id}`);
        return;
      }

      // 2. Batch insert all session exercises at once
      const sessionExerciseRows = workoutExercises.map((we) => ({
        session_id: session.id,
        exercise_id: we.exercise_id,
        exercise_name: (we.exercises as any)?.name || "Exercício",
        order_index: we.order_index,
      }));

      // Fetch all workout_sets for all exercises in one query
      const weIds = workoutExercises.map((we) => we.id);
      const [seResult, allSetsResult] = await Promise.all([
        supabase.from("session_exercises").insert(sessionExerciseRows).select(),
        supabase
          .from("workout_sets")
          .select("workout_exercise_id, reps, weight, order_index")
          .in("workout_exercise_id", weIds)
          .order("order_index"),
      ]);

      if (seResult.error) throw seResult.error;

      const sessionExercises = seResult.data;
      const allWorkoutSets = allSetsResult.data || [];

      // 3. Build all session_sets in memory, then batch insert
      const allSessionSets: Array<{
        session_exercise_id: string;
        order_index: number;
        weight: number | null;
        reps: number | null;
        is_completed: boolean;
      }> = [];

      for (let i = 0; i < workoutExercises.length; i++) {
        const we = workoutExercises[i];
        const se = sessionExercises[i];
        const specificSets = allWorkoutSets.filter(
          (s) => s.workout_exercise_id === we.id
        );

        if (specificSets.length > 0) {
          for (let j = 0; j < specificSets.length; j++) {
            allSessionSets.push({
              session_exercise_id: se.id,
              order_index: j,
              weight: specificSets[j].weight,
              reps: specificSets[j].reps,
              is_completed: false,
            });
          }
        } else {
          for (let j = 0; j < we.sets_count; j++) {
            allSessionSets.push({
              session_exercise_id: se.id,
              order_index: j,
              weight: we.target_weight,
              reps: we.target_reps,
              is_completed: false,
            });
          }
        }
      }

      if (allSessionSets.length > 0) {
        const { error: setsError } = await supabase
          .from("session_sets")
          .insert(allSessionSets);
        if (setsError) throw setsError;
      }

      navigate(`/session/${session.id}`);
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Erro ao iniciar treino");
    }
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Treinos</h1>
          <p className="text-muted-foreground mt-1">
            {workouts?.length || 0} treino{workouts?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild size="icon" className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all glow-primary">
          <Link to="/workout/new">
            <Plus className="h-6 w-6" />
          </Link>
        </Button>
      </div>

      {workouts && workouts.length > 0 && (
        <NextWorkoutCard workouts={workouts} onStartSession={startSession} />
      )}

      {workouts?.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-background p-4 shadow-sm">
              <Dumbbell className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Nenhum treino ainda</h3>
            <p className="mb-6 max-w-xs text-sm text-muted-foreground">
              Crie seu primeiro treino para começar a acompanhar seu progresso
            </p>
            <Button asChild size="lg" className="rounded-full px-8">
              <Link to="/workout/new">
                Criar Treino
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workouts?.map((workout) => (
            <div
              key={workout.id}
              className="group relative overflow-hidden rounded-card border bg-card text-card-foreground shadow-soft transition-all hover:translate-y-[-2px] hover:shadow-lg"
            >
              <div
                className="absolute inset-x-0 top-0 h-1.5 opacity-90"
                style={{ backgroundColor: workout.color || "#10B981" }}
              />

              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="line-clamp-1 text-xl font-bold tracking-tight text-foreground">
                      {workout.name}
                    </h3>
                    {workout.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {workout.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-secondary/10 text-secondary hover:bg-secondary/20">
                    <Dumbbell className="mr-1 h-3 w-3" />
                    {workout.exercise_count}
                  </Badge>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="w-full font-bold shadow-sm transition-transform active:scale-[0.98]"
                    onClick={() => startSession(workout)}
                    style={{
                      backgroundColor: workout.color || undefined,
                      borderColor: workout.color || undefined,
                      color: 'white'
                    }}
                  >
                    <Play className="mr-2 h-5 w-5 fill-current" />
                    INICIAR TREINO
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-full hover:bg-muted"
                      asChild
                    >
                      <Link to={`/workout/${workout.id}`}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-full hover:bg-muted"
                      onClick={() => duplicateMutation.mutate(workout)}
                      disabled={duplicateMutation.isPending}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copiar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-full hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteWorkoutId(workout.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteWorkoutId}
        onOpenChange={() => setDeleteWorkoutId(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treino?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O treino e todos os exercícios
              associados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
              onClick={() => deleteWorkoutId && deleteMutation.mutate(deleteWorkoutId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
