import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Play, Pencil, Copy, Trash2, Loader2, Dumbbell } from "lucide-react";
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
        const newExercises = exercises.map((ex) => ({
          workout_id: newWorkout.id,
          exercise_id: ex.exercise_id,
          sets_count: ex.sets_count,
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          rest_seconds: ex.rest_seconds,
          order_index: ex.order_index,
          notes: ex.notes,
        }));

        const { error: insertError } = await supabase
          .from("workout_exercises")
          .insert(newExercises);

        if (insertError) throw insertError;
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
      // Create training session
      const { data: session, error: sessionError } = await supabase
        .from("training_sessions")
        .insert({
          user_id: user!.id,
          workout_id: workout.id,
          workout_name: workout.name,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Get workout exercises
      const { data: workoutExercises, error: exercisesError } = await supabase
        .from("workout_exercises")
        .select("*, exercises(name)")
        .eq("workout_id", workout.id)
        .order("order_index");

      if (exercisesError) throw exercisesError;

      // Create session exercises and sets
      for (const we of workoutExercises || []) {
        const { data: sessionExercise, error: seError } = await supabase
          .from("session_exercises")
          .insert({
            session_id: session.id,
            exercise_id: we.exercise_id,
            exercise_name: (we.exercises as any)?.name || "Exercício",
            order_index: we.order_index,
          })
          .select()
          .single();

        if (seError) throw seError;

        // Create empty sets
        const sets = Array.from({ length: we.sets_count }, (_, i) => ({
          session_exercise_id: sessionExercise.id,
          order_index: i,
          weight: we.target_weight,
          reps: we.target_reps,
          is_completed: false,
        }));

        await supabase.from("session_sets").insert(sets);
      }

      // Navigate to session
      window.location.href = `/session/${session.id}`;
    } catch (error) {
      console.error("Error starting session:", error);
      toast.error("Erro ao iniciar treino");
    }
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus Treinos</h1>
          <p className="text-sm text-muted-foreground">
            {workouts?.length || 0} treino{workouts?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild className="touch-target">
          <Link to="/workout/new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Treino
          </Link>
        </Button>
      </div>

      {workouts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Dumbbell className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">Nenhum treino ainda</h3>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Crie seu primeiro treino para começar a acompanhar seu progresso
            </p>
            <Button asChild>
              <Link to="/workout/new">
                <Plus className="mr-2 h-4 w-4" />
                Criar Treino
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workouts?.map((workout) => (
            <Card key={workout.id} className="overflow-hidden">
              <div
                className="h-1"
                style={{ backgroundColor: workout.color || "#22c55e" }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{workout.name}</CardTitle>
                    {workout.description && (
                      <CardDescription className="mt-1">
                        {workout.description}
                      </CardDescription>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {workout.exercise_count} exercício
                    {workout.exercise_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="touch-target flex-1"
                    onClick={() => startSession(workout)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="touch-target"
                    asChild
                  >
                    <Link to={`/workout/${workout.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="touch-target"
                    onClick={() => duplicateMutation.mutate(workout)}
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="touch-target text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setDeleteWorkoutId(workout.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteWorkoutId}
        onOpenChange={() => setDeleteWorkoutId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treino?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O treino e todos os exercícios
              associados serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteWorkoutId && deleteMutation.mutate(deleteWorkoutId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
