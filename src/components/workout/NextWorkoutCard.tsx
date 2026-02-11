import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Play, Dumbbell } from "lucide-react";

interface Workout {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  exercise_count?: number;
}

interface NextWorkoutCardProps {
  workouts: Workout[];
  onStartSession: (workout: Workout) => void;
}

export default function NextWorkoutCard({ workouts, onStartSession }: NextWorkoutCardProps) {
  const { user } = useAuth();

  const { data: lastSession } = useQuery({
    queryKey: ["last-completed-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("workout_id, workout_name")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!workouts || workouts.length === 0) return null;

  // Rotation logic
  let nextWorkout: Workout;
  let lastWorkoutName: string | null = null;

  if (lastSession?.workout_id) {
    const lastIndex = workouts.findIndex((w) => w.id === lastSession.workout_id);
    lastWorkoutName = lastSession.workout_name || null;

    if (lastIndex >= 0) {
      nextWorkout = workouts[(lastIndex + 1) % workouts.length];
    } else {
      nextWorkout = workouts[0];
    }
  } else {
    nextWorkout = workouts[0];
  }

  const workoutColor = nextWorkout.color || "#10B981";

  return (
    <div
      className="relative overflow-hidden rounded-card border-2 bg-card p-6 shadow-lg mb-8"
      style={{ borderColor: workoutColor }}
    >
      {/* Glow background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(ellipse at top left, ${workoutColor}, transparent 70%)`,
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: workoutColor }}
          >
            <Zap className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Próximo Treino
          </span>
        </div>

        {lastWorkoutName && (
          <p className="text-sm text-muted-foreground mb-1">
            Seu último treino foi <strong className="text-foreground">{lastWorkoutName}</strong>. Hoje é dia de:
          </p>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">{nextWorkout.name}</h2>
          <Badge variant="secondary" className="bg-secondary/10 text-secondary hover:bg-secondary/20">
            <Dumbbell className="mr-1 h-3 w-3" />
            {nextWorkout.exercise_count ?? 0}
          </Badge>
        </div>

        <Button
          size="lg"
          className="w-full text-lg font-bold shadow-md transition-transform active:scale-[0.98]"
          onClick={() => onStartSession(nextWorkout)}
          style={{
            backgroundColor: workoutColor,
            borderColor: workoutColor,
            color: "white",
          }}
        >
          <Play className="mr-2 h-5 w-5 fill-current" />
          INICIAR AGORA
        </Button>
      </div>
    </div>
  );
}
