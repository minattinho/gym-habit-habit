import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Loader2, Clock, CheckCircle, Save } from "lucide-react";
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
        .select("*, session_sets(*)")
        .eq("session_id", id)
        .order("order_index");

      if (exercisesError) throw exercisesError;

      // Sort sets by order_index
      const exercises = exercisesData.map((ex) => ({
        ...ex,
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      if (variables.updates.is_completed) {
        setShowRestTimer(true);
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
        {session?.exercises.map((exercise: SessionExercise) => (
          <Card key={exercise.id} className="border-border shadow-soft overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b border-border/50">
              <CardTitle className="text-base font-bold">{exercise.exercise_name}</CardTitle>
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
                        <div className="flex items-center gap-3">
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

      <RestTimer
        isOpen={showRestTimer}
        initialSeconds={restDuration}
        onClose={() => setShowRestTimer(false)}
      />
    </div>
  );
}
