import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ExerciseSelector } from "@/components/exercise/ExerciseSelector";

interface WorkoutExercise {
  id?: string;
  exercise_id: string;
  exercise_name: string;
  sets_count: number;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  order_index: number;
}

const COLORS = [
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export default function WorkoutFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);

  // Fetch workout data if editing
  const { isLoading } = useQuery({
    queryKey: ["workout", id],
    queryFn: async () => {
      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .select("*")
        .eq("id", id)
        .single();

      if (workoutError) throw workoutError;

      const { data: workoutExercises, error: exercisesError } = await supabase
        .from("workout_exercises")
        .select("*, exercises(name)")
        .eq("workout_id", id)
        .order("order_index");

      if (exercisesError) throw exercisesError;

      setName(workout.name);
      setDescription(workout.description || "");
      setColor(workout.color || COLORS[0]);
      setExercises(
        workoutExercises.map((we) => ({
          id: we.id,
          exercise_id: we.exercise_id,
          exercise_name: (we.exercises as any)?.name || "Exercício",
          sets_count: we.sets_count,
          target_reps: we.target_reps,
          target_weight: we.target_weight,
          rest_seconds: we.rest_seconds,
          order_index: we.order_index,
        }))
      );

      return workout;
    },
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        // Update workout
        const { error: workoutError } = await supabase
          .from("workouts")
          .update({ name, description, color })
          .eq("id", id);

        if (workoutError) throw workoutError;

        // Delete existing exercises
        await supabase.from("workout_exercises").delete().eq("workout_id", id);

        // Insert new exercises
        if (exercises.length > 0) {
          const { error: exercisesError } = await supabase
            .from("workout_exercises")
            .insert(
              exercises.map((ex, index) => ({
                workout_id: id,
                exercise_id: ex.exercise_id,
                sets_count: ex.sets_count,
                target_reps: ex.target_reps,
                target_weight: ex.target_weight,
                rest_seconds: ex.rest_seconds,
                order_index: index,
              }))
            );

          if (exercisesError) throw exercisesError;
        }
      } else {
        // Create workout
        const { data: workout, error: workoutError } = await supabase
          .from("workouts")
          .insert({ name, description, color, user_id: user!.id })
          .select()
          .single();

        if (workoutError) throw workoutError;

        // Insert exercises
        if (exercises.length > 0) {
          const { error: exercisesError } = await supabase
            .from("workout_exercises")
            .insert(
              exercises.map((ex, index) => ({
                workout_id: workout.id,
                exercise_id: ex.exercise_id,
                sets_count: ex.sets_count,
                target_reps: ex.target_reps,
                target_weight: ex.target_weight,
                rest_seconds: ex.rest_seconds,
                order_index: index,
              }))
            );

          if (exercisesError) throw exercisesError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      toast.success(isEditing ? "Treino atualizado!" : "Treino criado!");
      navigate("/");
    },
    onError: (error) => {
      console.error("Error saving workout:", error);
      toast.error("Erro ao salvar treino");
    },
  });

  const addExercise = (exerciseId: string, exerciseName: string) => {
    setExercises([
      ...exercises,
      {
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        sets_count: 3,
        target_reps: 12,
        target_weight: null,
        rest_seconds: 90,
        order_index: exercises.length,
      },
    ]);
    setShowExerciseSelector(false);
  };

  const updateExercise = (index: number, updates: Partial<WorkoutExercise>) => {
    setExercises(
      exercises.map((ex, i) => (i === index ? { ...ex, ...updates } : ex))
    );
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Digite um nome para o treino");
      return;
    }
    saveMutation.mutate();
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 max-w-2xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {isEditing ? "Editar Treino" : "Novo Treino"}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="container max-w-2xl px-4 py-6">
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Treino</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Treino A - Peito e Tríceps"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva seu treino..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-8 w-8 rounded-full transition-transform ${
                        color === c ? "scale-125 ring-2 ring-white" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercises */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Exercícios</CardTitle>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowExerciseSelector(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {exercises.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhum exercício adicionado
                </p>
              ) : (
                <div className="space-y-4">
                  {exercises.map((exercise, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
                    >
                      <GripVertical className="mt-1 h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 space-y-3">
                        <p className="font-medium">{exercise.exercise_name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Séries</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={exercise.sets_count}
                              onChange={(e) =>
                                updateExercise(index, {
                                  sets_count: parseInt(e.target.value) || 1,
                                })
                              }
                              min={1}
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Reps</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={exercise.target_reps || ""}
                              onChange={(e) =>
                                updateExercise(index, {
                                  target_reps: parseInt(e.target.value) || null,
                                })
                              }
                              placeholder="12"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Peso (kg)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={exercise.target_weight || ""}
                              onChange={(e) =>
                                updateExercise(index, {
                                  target_weight: parseFloat(e.target.value) || null,
                                })
                              }
                              placeholder="—"
                              className="h-9"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeExercise(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full touch-target"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              "Salvar Alterações"
            ) : (
              "Criar Treino"
            )}
          </Button>
        </div>
      </form>

      <ExerciseSelector
        open={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        onSelect={addExercise}
      />
    </div>
  );
}
