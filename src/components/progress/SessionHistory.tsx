import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ProcessedSession, calcE1rm } from "@/lib/exercise-stats";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionHistoryProps {
  sessions: ProcessedSession[];
  exerciseId: string;
  isLoading?: boolean;
}

export function SessionHistory({ sessions, exerciseId, isLoading }: SessionHistoryProps) {
  const queryClient = useQueryClient();
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

  const updateSetMutation = useMutation({
    mutationFn: async ({ id, weight, reps }: { id: string; weight: number; reps: number }) => {
      const { error } = await supabase
        .from("session_sets")
        .update({ weight, reps })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise_progress", exerciseId] });
      setEditingSet(null);
      toast({ title: "Set atualizado" });
    },
    onError: () => toast({ title: "Erro ao atualizar set", variant: "destructive" }),
  });

  const deleteSetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("session_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise_progress", exerciseId] });
      setDeletingSetId(null);
      toast({ title: "Set excluído" });
    },
    onError: () => toast({ title: "Erro ao excluir set", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Histórico de sessões
      </h3>
      {sorted.map((session) => {
        const bestE1rm = session.bestSet?.e1rm ?? 0;

        return (
          <Card key={session.sessionId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">
                    {format(session.date, "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.workoutName || "Treino"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Vol: {session.volume}kg
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {session.sets
                  .filter((s) => s.is_completed)
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((set) => {
                    const hasData = set.weight != null && set.reps != null;
                    const isBest =
                      hasData &&
                      calcE1rm(set.weight!, set.reps!) === bestE1rm &&
                      bestE1rm > 0;
                    const isEditing = editingSet === set.id;

                    if (isEditing) {
                      return (
                        <div key={set.id} className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editReps}
                            onChange={(e) => setEditReps(e.target.value)}
                            className="w-12 h-7 text-xs px-1 text-center"
                            placeholder="reps"
                          />
                          <span className="text-xs">×</span>
                          <Input
                            type="number"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="w-14 h-7 text-xs px-1 text-center"
                            placeholder="kg"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() =>
                              updateSetMutation.mutate({
                                id: set.id,
                                weight: parseFloat(editWeight),
                                reps: parseInt(editReps),
                              })
                            }
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingSet(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div key={set.id} className="group flex items-center gap-0.5">
                        <Badge
                          variant={isBest ? "default" : "outline"}
                          className="text-xs cursor-default"
                        >
                          {hasData ? `${set.reps}×${set.weight}kg` : "—"}
                          {isBest && " ★"}
                        </Badge>
                        <div className="hidden group-hover:flex items-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => {
                              setEditingSet(set.id);
                              setEditWeight(String(set.weight ?? ""));
                              setEditReps(String(set.reps ?? ""));
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 text-destructive"
                            onClick={() => setDeletingSetId(set.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {session.hasIncompleteData && (
                <p className="text-[10px] text-muted-foreground mt-1 italic">
                  Alguns sets sem dados completos
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!deletingSetId} onOpenChange={(o) => !o && setDeletingSetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir set?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSetId && deleteSetMutation.mutate(deletingSetId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
