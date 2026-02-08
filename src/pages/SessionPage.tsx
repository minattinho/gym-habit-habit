import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Loader2, Trophy, Clock, CheckCircle } from "lucide-react";
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

  // ... (existing code)

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCompleted = !!session?.completed_at;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {session?.workout_name || "Treino"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-lg font-mono">
            <Clock className="h-5 w-5 text-primary" />
            {formatTime(elapsedTime)}
          </div>
        </div>
      </header>

      {/* Exercises */}
      <div className="container max-w-2xl space-y-6 px-4 py-6">
        {session?.exercises.map((exercise: SessionExercise) => (
          <Card key={exercise.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{exercise.exercise_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Header Row */}
              <div className="grid grid-cols-[40px_1fr_1fr_48px] gap-2 text-xs font-medium text-muted-foreground">
                <span className="text-center">Série</span>
                <span className="text-center">Peso (kg)</span>
                <span className="text-center">Reps</span>
                <span className="text-center">✓</span>
              </div>

              {/* Sets */}
              {exercise.session_sets.map((set: SessionSet, index: number) => (
                <div
                  key={set.id}
                  className={`grid grid-cols-[40px_1fr_1fr_48px] gap-2 items-center ${set.is_completed ? "opacity-60" : ""
                    }`}
                >
                  <span className="text-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={set.weight || ""}
                    onChange={(e) =>
                      updateSetMutation.mutate({
                        setId: set.id,
                        updates: { weight: parseFloat(e.target.value) || null },
                      })
                    }
                    disabled={isCompleted}
                    className="h-12 text-center text-lg font-semibold"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ""}
                    onChange={(e) =>
                      updateSetMutation.mutate({
                        setId: set.id,
                        updates: { reps: parseInt(e.target.value) || null },
                      })
                    }
                    disabled={isCompleted}
                    className="h-12 text-center text-lg font-semibold"
                  />
                  <div className="flex justify-center">
                    <Checkbox
                      checked={set.is_completed}
                      onCheckedChange={(checked) =>
                        updateSetMutation.mutate({
                          setId: set.id,
                          updates: { is_completed: !!checked },
                        })
                      }
                      disabled={isCompleted}
                      className="h-7 w-7 rounded-full"
                    />
                  </div>
                </div>
              ))}

              {/* Add Set Button */}
              {!isCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
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
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur safe-bottom">
          <div className="container max-w-2xl">
            <Button
              className="w-full touch-target glow-primary"
              size="lg"
              onClick={() => setShowFinishDialog(true)}
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              Finalizar Treino
            </Button>
          </div>
        </div>
      )}

      {/* Finish Dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar treino?</AlertDialogTitle>
            <AlertDialogDescription>
              Tempo total: {formatTime(elapsedTime)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar treinando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finishSessionMutation.mutate()}
              disabled={finishSessionMutation.isPending}
            >
              {finishSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Finalizar"
              )}
            </AlertDialogAction>
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
