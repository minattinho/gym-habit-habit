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
import { ArrowLeft, Plus, Trash2, Loader2, GripVertical, Copy, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ExerciseSelector } from "@/components/exercise/ExerciseSelector";

interface WorkoutSet {
  reps: number | null;
  weight: number | null;
  notes: string | null;
}

interface WorkoutExercise {
  id?: string;
  exercise_id: string;
  exercise_name: string;
  sets: WorkoutSet[];
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

      // Fetch sets for each exercise
      const exercisesWithSets = await Promise.all(
        workoutExercises.map(async (we) => {
          const { data: sets } = await supabase
            .from("workout_sets")
            .select("reps, weight, order_index")
            .eq("workout_exercise_id", we.id)
            .order("order_index");

          if (sets && sets.length > 0) {
            return {
              id: we.id,
              exercise_id: we.exercise_id,
              exercise_name: (we.exercises as { name: string } | null)?.name || "Exercício",
              sets: sets.map((s: { reps: number | null; weight: number | null; notes?: string | null }) => ({ reps: s.reps, weight: s.weight, notes: s.notes || null })),
              rest_seconds: we.rest_seconds,
              order_index: we.order_index,
            };
          } else {
            // Fallback for old data structure (migration on the fly)
            return {
              id: we.id,
              exercise_id: we.exercise_id,
              exercise_name: (we.exercises as any)?.name || "Exercício",
              sets: Array.from({ length: we.sets_count }).map(() => ({
                reps: we.target_reps,
                weight: we.target_weight,
                notes: null,
              })),
              rest_seconds: we.rest_seconds,
              order_index: we.order_index,
            };
          }
        })
      );

      setName(workout.name);
      setDescription(workout.description || "");
      setColor(workout.color || COLORS[0]);
      setExercises(exercisesWithSets);

      return workout;
    },
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let workoutId = id;

      if (isEditing) {
        // Update workout
        const { error: workoutError } = await supabase
          .from("workouts")
          .update({ name, description, color })
          .eq("id", id);

        if (workoutError) throw workoutError;

        // Delete existing exercises (cascade should delete sets, but we can be safe)
        // Note: cascading delete on workout_exercises -> workout_sets is assumed or we delete manually if logic requires
        // Ideally we would sync, but deleting all and re-inserting is easier for now given the complexity
        await supabase.from("workout_exercises").delete().eq("workout_id", id);
      } else {
        // Create workout
        const { data: workout, error: workoutError } = await supabase
          .from("workouts")
          .insert({ name, description, color, user_id: user!.id })
          .select()
          .single();

        if (workoutError) throw workoutError;
        workoutId = workout.id;
      }

      if (!workoutId) throw new Error("No workout ID");

      // Insert new exercises and sets
      for (const [index, ex] of exercises.entries()) {
        const { data: we, error: weError } = await supabase
          .from("workout_exercises")
          .insert({
            workout_id: workoutId,
            exercise_id: ex.exercise_id,
            sets_count: ex.sets.length,
            // Keep generic targets mainly for backward compat/summary if needed, or null
            target_reps: null,
            target_weight: null,
            rest_seconds: ex.rest_seconds,
            order_index: index,
          })
          .select()
          .single();

        if (weError) throw weError;

        if (ex.sets.length > 0) {
          const setsToInsert = ex.sets.map((s, i) => ({
            workout_exercise_id: we.id,
            reps: s.reps,
            weight: s.weight,
            notes: s.notes,
            order_index: i,
          }));
          
          const { error: setsError } = await supabase
            .from("workout_sets")
            .insert(setsToInsert);

          if (setsError) throw setsError;
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
        sets: [
          { reps: 12, weight: null, notes: null },
          { reps: 12, weight: null, notes: null },
          { reps: 12, weight: null, notes: null },
        ],
        rest_seconds: 90,
        order_index: exercises.length,
      },
    ]);
    setShowExerciseSelector(false);
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: number | string | null) => {
    const newExercises = [...exercises];
    (newExercises[exerciseIndex].sets[setIndex] as any)[field] = value;
    setExercises(newExercises);
  };

  const addSet = (exerciseIndex: number) => {
    const newExercises = [...exercises];
    const previousSet = newExercises[exerciseIndex].sets[newExercises[exerciseIndex].sets.length - 1];
    newExercises[exerciseIndex].sets.push({
      reps: previousSet ? previousSet.reps : 12,
      weight: previousSet ? previousSet.weight : null,
      notes: null,
    });
    setExercises(newExercises);
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    if (newExercises[exerciseIndex].sets.length > 1) {
      newExercises[exerciseIndex].sets.splice(setIndex, 1);
      setExercises(newExercises);
    }
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
    <div className="min-h-screen bg-background pb-20">
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
                      className={`h-8 w-8 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-white" : ""
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
                <div className="space-y-6">
                  {exercises.map((exercise, exerciseIndex) => (
                    <div
                      key={exerciseIndex}
                      className="rounded-lg border border-border bg-card overflow-hidden"
                    >
                      <div className="flex items-center justify-between bg-muted/30 p-3 border-b border-border">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{exercise.exercise_name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => removeExercise(exerciseIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="p-3 space-y-2">
                        <div className="grid grid-cols-[32px_1fr_32px_32px] gap-2 mb-1 px-1">
                          <span className="text-xs text-center text-muted-foreground font-medium">#</span>
                          <span className="text-xs text-center text-muted-foreground font-medium">Reps</span>
                          <span></span>
                          <span></span>
                        </div>

                        {exercise.sets.map((set, setIndex) => (
                          <div key={setIndex} className="space-y-1">
                            <div className="grid grid-cols-[32px_1fr_32px_32px] gap-2 items-center">
                              <span className="text-sm text-center font-medium bg-muted/50 rounded h-8 flex items-center justify-center">
                                {setIndex + 1}
                              </span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                value={set.reps || ""}
                                onChange={(e) => updateSet(exerciseIndex, setIndex, "reps", parseInt(e.target.value) || null)}
                                className="h-8 text-center"
                                placeholder="0"
                              />
                              <Button
                                type="button"
                                variant={set.notes ? "secondary" : "ghost"}
                                size="icon"
                                className={`h-8 w-8 ${set.notes ? "text-primary" : "text-muted-foreground"}`}
                                onClick={() => {
                                  const current = set.notes || "";
                                  const newNotes = current ? null : " ";
                                  updateSet(exerciseIndex, setIndex, "notes", newNotes);
                                }}
                                title="Observação"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removeSet(exerciseIndex, setIndex)}
                                disabled={exercise.sets.length <= 1}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            {set.notes !== null && (
                              <Input
                                value={set.notes || ""}
                                onChange={(e) => updateSet(exerciseIndex, setIndex, "notes", e.target.value || null)}
                                className="h-7 text-xs ml-[40px]"
                                placeholder="Observação desta série..."
                                autoFocus
                              />
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 border-dashed"
                          onClick={() => addSet(exerciseIndex)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Adicionar Série
                        </Button>
                      </div>
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
