import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2, Clock, CheckCircle, Save, MessageSquare, Dumbbell, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExerciseSelector } from "@/components/exercise/ExerciseSelector";
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
import { RestTimer } from "@/components/RestTimer";
import { NumberStepper } from "@/components/ui/number-stepper";

import { checkAndSubmitPRs, SessionSet, SessionExercise } from "@/lib/pr";

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [removeExerciseId, setRemoveExerciseId] = useState<string | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data: sessionData, error: sessionError } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("id", id)
        .single();

      if (sessionError) throw sessionError;

      const { data: exercisesData, error: exercisesError } = await supabase
        .from("session_exercises")
        .select("*, session_sets(*), exercises(image_url)")
        .eq("session_id", id)
        .order("order_index");

      if (exercisesError) throw exercisesError;

      // Sort sets by order_index
      const exercises = exercisesData.map((ex) => ({
        ...ex,
        image_url: (ex.exercises as any)?.image_url || null,
        session_sets: (ex.session_sets || []).sort(
          (a: SessionSet, b: SessionSet) => a.order_index - b.order_index
        ),
      }));

      setStartTime(new Date(sessionData.started_at));

      return { ...sessionData, exercises };
    },
    enabled: !!id,
  });

  // Timer
  useEffect(() => {
    if (!startTime || session?.completed_at) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, session?.completed_at]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(60);

  const updateSetMutation = useMutation({
    mutationFn: async ({
      setId,
      updates,
    }: {
      setId: string;
      updates: Partial<SessionSet>;
    }) => {
      const { error } = await supabase
        .from("session_sets")
        .update(updates)
        .eq("id", setId);

      if (error) throw error;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["session", id] });

      // Snapshot previous value
      const previousSession = queryClient.getQueryData(["session", id]);

      // Optimistically update cache
      queryClient.setQueryData(["session", id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          exercises: old.exercises.map((ex: any) => ({
            ...ex,
            session_sets: ex.session_sets.map((set: any) =>
              set.id === variables.setId
                ? { ...set, ...variables.updates }
                : set
            ),
          })),
        };
      });

      // Show rest timer immediately for completed sets
      if (variables.updates.is_completed) {
        setShowRestTimer(true);
      }

      return { previousSession };
    },
    onError: (_err, _variables, context: any) => {
      // Rollback on error
      if (context?.previousSession) {
        queryClient.setQueryData(["session", id], context.previousSession);
      }
    },
    onSettled: (_data, _error, variables) => {
      // Only refetch for is_completed changes (structural change)
      if (variables.updates.is_completed !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["session", id] });
      }
    },
  });

  const addSetMutation = useMutation({
    mutationFn: async (sessionExerciseId: string) => {
      const exercise = session?.exercises.find(
        (ex: SessionExercise) => ex.id === sessionExerciseId
      );
      const lastSet = exercise?.session_sets[exercise.session_sets.length - 1];

      const { error } = await supabase.from("session_sets").insert({
        session_exercise_id: sessionExerciseId,
        order_index: (exercise?.session_sets.length || 0),
        weight: lastSet?.weight || null,
        reps: lastSet?.reps || null,
        is_completed: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
  });

  // Remove a set from an exercise
  const removeSetMutation = useMutation({
    mutationFn: async ({ setId, sessionExerciseId }: { setId: string; sessionExerciseId: string }) => {
      const { error } = await supabase.from("session_sets").delete().eq("id", setId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
  });

  // Add a new exercise to the session
  const addExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId, exerciseName, imageUrl }: { exerciseId: string; exerciseName: string; imageUrl: string | null }) => {
      const maxOrder = session?.exercises?.length || 0;
      const { data: newExercise, error: exError } = await supabase
        .from("session_exercises")
        .insert({
          session_id: id!,
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          order_index: maxOrder,
        })
        .select()
        .single();

      if (exError) throw exError;

      // Create one default set
      const { error: setError } = await supabase.from("session_sets").insert({
        session_exercise_id: newExercise.id,
        order_index: 0,
        weight: null,
        reps: 12,
        is_completed: false,
      });
      if (setError) throw setError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      setShowExerciseSelector(false);
      toast.success("Exercício adicionado!");
    },
  });

  // Remove an exercise from the session
  const removeExerciseMutation = useMutation({
    mutationFn: async (sessionExerciseId: string) => {
      // Delete sets first, then the exercise
      const { error: setsError } = await supabase
        .from("session_sets")
        .delete()
        .eq("session_exercise_id", sessionExerciseId);
      if (setsError) throw setsError;

      const { error } = await supabase
        .from("session_exercises")
        .delete()
        .eq("id", sessionExerciseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      toast.success("Exercício removido");
    },
  });

  // Reorder exercise (swap with neighbor)
  const reorderExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId, direction }: { exerciseId: string; direction: "up" | "down" }) => {
      const exercises = session?.exercises || [];
      const idx = exercises.findIndex((e: SessionExercise) => e.id === exerciseId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= exercises.length) return;

      const current = exercises[idx];
      const swap = exercises[swapIdx];

      await Promise.all([
        supabase.from("session_exercises").update({ order_index: swap.order_index }).eq("id", current.id),
        supabase.from("session_exercises").update({ order_index: current.order_index }).eq("id", swap.id),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("training_sessions")
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: elapsedTime,
        })
        .eq("id", id);

      if (error) throw error;

      // Check for PRs
      if (session && user) {
        const prCount = await checkAndSubmitPRs(session, user.id, supabase);
        if (prCount > 0) {
          toast.success(`Parabéns! Você bateu ${prCount} novo(s) recorde(s)! 🏆`);
        }
      }
    },
    onSuccess: () => {
      toast.success("Treino finalizado! 💪");
      navigate("/");
    },
    onError: () => {
      toast.error("Erro ao finalizar treino");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCompleted = !!session?.completed_at;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur safe-top">
        <div className="container flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="-ml-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold line-clamp-1">
                {session?.workout_name || "Treino"}
              </h1>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-sm px-2 py-0.5 border-primary/20 bg-primary/5 text-primary">
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            {formatTime(elapsedTime)}
          </Badge>
        </div>
      </header>

      {/* Exercises */}
      <div className="container max-w-2xl space-y-6 px-4 py-6">
        {session?.exercises.map((exercise: SessionExercise, exIndex: number) => (
          <Card key={exercise.id} className="border-border shadow-soft overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center">
                    {(exercise as any).image_url ? (
                      <img src={(exercise as any).image_url} alt={exercise.exercise_name} className="h-full w-full object-cover" />
                    ) : (
                      <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="line-clamp-1">{exercise.exercise_name}</span>
                </CardTitle>
                {!isCompleted && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => reorderExerciseMutation.mutate({ exerciseId: exercise.id, direction: "up" })}
                      disabled={exIndex === 0 || reorderExerciseMutation.isPending}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => reorderExerciseMutation.mutate({ exerciseId: exercise.id, direction: "down" })}
                      disabled={exIndex === (session?.exercises?.length || 0) - 1 || reorderExerciseMutation.isPending}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => setRemoveExerciseId(exercise.id)}
                      disabled={removeExerciseMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Sets List */}
              <div className="space-y-3">
                {exercise.session_sets.map((set: SessionSet, index: number) => {
                  const isActive = !set.is_completed && !isCompleted;

                  return (
                    <div
                      key={set.id}
                      className={`relative flex flex-col gap-3 rounded-xl border p-3 transition-all duration-200 ${set.is_completed
                          ? "bg-muted/30 border-transparent opacity-70"
                          : isActive
                            ? "bg-card border-primary ring-1 ring-primary/20 shadow-sm scale-[1.01]"
                            : "bg-card border-border"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={set.is_completed ? "secondary" : "default"} className={`
                          ${set.is_completed ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}
                        `}>
                          Série {index + 1}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {!isCompleted && !set.is_completed && exercise.session_sets.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeSetMutation.mutate({ setId: set.id, sessionExerciseId: exercise.id })}
                              disabled={removeSetMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Checkbox
                            checked={set.is_completed}
                            onCheckedChange={(checked) =>
                              updateSetMutation.mutate({
                                setId: set.id,
                                updates: { is_completed: !!checked },
                              })
                            }
                            disabled={isCompleted}
                            className="h-6 w-6 rounded-full border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-transform active:scale-90"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Carga (Kg)
                          </span>
                          <NumberStepper
                            value={set.weight}
                            onChange={(val) =>
                              updateSetMutation.mutate({
                                setId: set.id,
                                updates: { weight: val },
                              })
                            }
                            step={1}
                            disabled={isCompleted || set.is_completed}
                            label="Weight"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Repetições
                          </span>
                          <NumberStepper
                            value={set.reps}
                            onChange={(val) =>
                              updateSetMutation.mutate({
                                setId: set.id,
                                updates: { reps: val },
                              })
                            }
                            step={1}
                            disabled={isCompleted || set.is_completed}
                            label="Reps"
                          />
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="mt-2">
                        {set.notes !== null && set.notes !== undefined ? (
                          <Input
                            value={set.notes || ""}
                            onChange={(e) =>
                              updateSetMutation.mutate({
                                setId: set.id,
                                updates: { notes: e.target.value || null },
                              })
                            }
                            className="h-7 text-xs"
                            placeholder="Observação desta série..."
                            disabled={isCompleted}
                          />
                        ) : (
                          !isCompleted && !set.is_completed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground px-2"
                              onClick={() =>
                                updateSetMutation.mutate({
                                  setId: set.id,
                                  updates: { notes: "" },
                                })
                              }
                            >
                              <MessageSquare className="mr-1 h-3 w-3" />
                              Adicionar observação
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Set Button */}
              {!isCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-primary/20 text-primary hover:bg-primary/5 hover:text-primary mt-2"
                  onClick={() => addSetMutation.mutate(exercise.id)}
                  disabled={addSetMutation.isPending}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar Série
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add Exercise Button */}
        {!isCompleted && (
          <Button
            variant="outline"
            className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/5 h-12"
            onClick={() => setShowExerciseSelector(true)}
          >
            <Plus className="mr-2 h-5 w-5" />
            Adicionar Exercício
          </Button>
        )}
      </div>

      {/* Finish Button */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur safe-bottom shadow-lg z-50">
          <div className="container max-w-2xl">
            <Button
              className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
              size="lg"
              onClick={() => setShowFinishDialog(true)}
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              FINALIZAR TREINO
            </Button>
          </div>
        </div>
      )}

      {/* Finish Dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent className="rounded-2xl max-w-xs mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Finalizar treino?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tempo total: <span className="font-bold text-foreground">{formatTime(elapsedTime)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:space-y-0">
            <AlertDialogAction
              className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-bold"
              onClick={() => finishSessionMutation.mutate()}
              disabled={finishSessionMutation.isPending}
            >
              {finishSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sim, finalizar"
              )}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-xl h-11 border-transparent text-muted-foreground hover:bg-muted">
              Continuar treinando
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Exercise Confirmation */}
      <AlertDialog open={!!removeExerciseId} onOpenChange={() => setRemoveExerciseId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-xs mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover exercício?</AlertDialogTitle>
            <AlertDialogDescription>
              O exercício e todas as suas séries serão removidos desta sessão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:space-y-0">
            <AlertDialogAction
              className="w-full rounded-xl h-11 bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90"
              onClick={() => {
                if (removeExerciseId) removeExerciseMutation.mutate(removeExerciseId);
                setRemoveExerciseId(null);
              }}
            >
              Remover
            </AlertDialogAction>
            <AlertDialogCancel className="w-full rounded-xl h-11 border-transparent text-muted-foreground hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RestTimer
        isOpen={showRestTimer}
        initialSeconds={restDuration}
        onClose={() => setShowRestTimer(false)}
      />

      <ExerciseSelector
        open={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        onSelect={(exerciseId, exerciseName, imageUrl) =>
          addExerciseMutation.mutate({ exerciseId, exerciseName, imageUrl })
        }
      />
    </div>
  );
}
