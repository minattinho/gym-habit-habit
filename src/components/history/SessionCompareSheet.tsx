import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, TrendingUp, TrendingDown, Minus, Star, Dumbbell } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SessionCompareSheetProps {
  sessionId: string | null;
  onClose: () => void;
}

interface SessionSet {
  id: string;
  order_index: number;
  weight: number | null;
  reps: number | null;
  is_completed: boolean;
}

interface SessionExercise {
  id: string;
  exercise_id: string;
  exercise_name: string;
  order_index: number;
  session_sets: SessionSet[];
}

interface SessionHeader {
  id: string;
  workout_id: string | null;
  workout_name: string | null;
  started_at: string;
  duration_seconds: number | null;
}

function computeVolume(exercises: SessionExercise[]): number {
  return exercises.reduce((total, ex) => {
    const exVol = ex.session_sets
      .filter((s) => s.is_completed && s.weight != null && s.reps != null)
      .reduce((sum, s) => sum + s.weight! * s.reps!, 0);
    return total + exVol;
  }, 0);
}

function countCompletedSets(exercises: SessionExercise[]): number {
  return exercises.reduce(
    (total, ex) => total + ex.session_sets.filter((s) => s.is_completed).length,
    0
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}min`;
  }
  return `${mins}min`;
}

function DiffBadge({ diff, unit = "" }: { diff: number | null; unit?: string }) {
  if (diff === null) return null;
  if (diff === 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-white/40">
        <Minus className="h-3 w-3" /> igual
      </span>
    );
  if (diff > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-medium">
        <TrendingUp className="h-3 w-3" /> +{diff.toFixed(diff % 1 === 0 ? 0 : 1)}{unit}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-400">
      <TrendingDown className="h-3 w-3" /> {diff.toFixed(diff % 1 === 0 ? 0 : 1)}{unit}
    </span>
  );
}

function SetRow({
  index,
  current,
  previous,
}: {
  index: number;
  current: SessionSet | undefined;
  previous: { weight: number | null; reps: number | null } | undefined;
}) {
  const hasCurrentData = current && (current.weight != null || current.reps != null);
  const hasPrevData = previous && (previous.weight != null || previous.reps != null);

  if (!hasCurrentData && !hasPrevData) return null;

  const weightDiff =
    current?.weight != null && previous?.weight != null
      ? current.weight - previous.weight
      : null;
  const repsDiff =
    current?.reps != null && previous?.reps != null
      ? current.reps - previous.reps
      : null;

  const isImproved =
    (weightDiff !== null && weightDiff > 0) || (repsDiff !== null && repsDiff > 0 && weightDiff === 0);
  const isDecreased =
    (weightDiff !== null && weightDiff < 0) || (repsDiff !== null && repsDiff < 0 && weightDiff === 0);

  const formatSet = (s: { weight: number | null; reps: number | null } | undefined) => {
    if (!s) return "—";
    const w = s.weight != null ? `${s.weight}kg` : "—";
    const r = s.reps != null ? `×${s.reps}` : "";
    return `${w}${r}`;
  };

  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <span className="w-5 text-xs text-white/30 shrink-0">S{index + 1}</span>
      <span
        className={`flex-1 font-mono text-xs ${
          current?.is_completed ? "text-white" : "text-white/40 line-through"
        }`}
      >
        {formatSet(current ? { weight: current.weight, reps: current.reps } : undefined)}
      </span>
      {hasPrevData && (
        <>
          <span className="text-white/20 text-xs">vs</span>
          <span className="flex-1 font-mono text-xs text-white/50">
            {formatSet(previous)}
          </span>
          <span className="w-4 shrink-0">
            {isImproved && <TrendingUp className="h-3 w-3 text-emerald-400" />}
            {isDecreased && !isImproved && <TrendingDown className="h-3 w-3 text-red-400" />}
          </span>
        </>
      )}
    </div>
  );
}

export function SessionCompareSheet({ sessionId, onClose }: SessionCompareSheetProps) {
  // Query 1: current session header
  const { data: currentHeader, isLoading: loadingHeader } = useQuery<SessionHeader>({
    queryKey: ["compare-header", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, workout_id, workout_name, started_at, duration_seconds")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      return data as SessionHeader;
    },
    enabled: !!sessionId,
  });

  // Query 2: current session exercises + sets
  const { data: currentExercises = [], isLoading: loadingExercises } = useQuery<SessionExercise[]>({
    queryKey: ["compare-exercises-current", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercises")
        .select("id, exercise_id, exercise_name, order_index, session_sets(id, order_index, weight, reps, is_completed)")
        .eq("session_id", sessionId!)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as SessionExercise[];
    },
    enabled: !!sessionId,
  });

  // Query 3: previous session header (needs workout_id from Q1)
  const { data: prevHeader } = useQuery<SessionHeader | null>({
    queryKey: ["compare-prev-header", currentHeader?.workout_id, sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, workout_id, workout_name, started_at, duration_seconds")
        .eq("workout_id", currentHeader!.workout_id!)
        .not("completed_at", "is", null)
        .neq("id", sessionId!)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SessionHeader | null;
    },
    enabled: !!currentHeader?.workout_id,
  });

  // Query 4: previous session exercises + sets
  const { data: prevExercises = [] } = useQuery<SessionExercise[]>({
    queryKey: ["compare-exercises-prev", prevHeader?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercises")
        .select("id, exercise_id, exercise_name, order_index, session_sets(id, order_index, weight, reps, is_completed)")
        .eq("session_id", prevHeader!.id)
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as SessionExercise[];
    },
    enabled: !!prevHeader?.id,
  });

  // Query 5: PR count for current session
  const { data: prCount = 0 } = useQuery<number>({
    queryKey: ["compare-prs", sessionId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("personal_records")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!sessionId,
  });

  const isLoading = loadingHeader || loadingExercises;

  // Build previous sets map: exercise_id -> sets sorted by order_index
  const prevSetsMap: Record<string, { weight: number | null; reps: number | null }[]> = {};
  for (const ex of prevExercises) {
    prevSetsMap[ex.exercise_id] = [...ex.session_sets]
      .sort((a, b) => a.order_index - b.order_index)
      .map((s) => ({ weight: s.weight, reps: s.reps }));
  }

  // Compute metrics
  const currentVolume = computeVolume(currentExercises);
  const prevVolume = prevHeader ? computeVolume(prevExercises) : null;
  const volumeDiff = prevVolume != null && prevVolume > 0
    ? Math.round(((currentVolume - prevVolume) / prevVolume) * 100)
    : null;

  const currentSets = countCompletedSets(currentExercises);
  const prevSets = prevHeader ? countCompletedSets(prevExercises) : null;
  const setsDiff = prevSets != null ? currentSets - prevSets : null;

  const currentDurMins = currentHeader?.duration_seconds
    ? Math.floor(currentHeader.duration_seconds / 60)
    : null;
  const prevDurMins = prevHeader?.duration_seconds
    ? Math.floor(prevHeader.duration_seconds / 60)
    : null;
  const durDiff = currentDurMins != null && prevDurMins != null
    ? currentDurMins - prevDurMins
    : null;

  const hasPrevSession = !!prevHeader;
  const isFirstSession = currentHeader && !currentHeader.workout_id
    ? false // free session
    : currentHeader && prevHeader === null && !loadingHeader; // loaded but no prev

  return (
    <Sheet open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader className="text-left shrink-0">
          <SheetTitle>{currentHeader?.workout_name || "Treino Livre"}</SheetTitle>
          <p className="text-sm text-muted-foreground">Comparação de sessões</p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 mt-4">
            <div className="space-y-5 pr-1">
              {/* Date header */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-1">
                    Esta sessão
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {currentHeader
                      ? format(new Date(currentHeader.started_at), "dd 'de' MMM, yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                    Anterior
                  </p>
                  <p className="text-sm font-semibold text-white/70">
                    {prevHeader
                      ? format(new Date(prevHeader.started_at), "dd 'de' MMM, yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* No previous session notice */}
              {!hasPrevSession && currentHeader?.workout_id && (
                <div className="rounded-xl border border-dashed border-white/20 p-4 text-center">
                  <p className="text-sm text-white/50">Primeira sessão deste treino</p>
                  <p className="text-xs text-white/30 mt-1">
                    Complete mais sessões para ver a comparação
                  </p>
                </div>
              )}

              {/* Summary metrics */}
              <div className="space-y-2">
                {/* Volume */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Dumbbell className="h-4 w-4 text-white/40" />
                    Volume
                  </div>
                  <div className="flex items-center gap-3">
                    {hasPrevSession && prevVolume != null && (
                      <span className="text-xs text-white/40">{prevVolume.toLocaleString("pt-BR")}kg</span>
                    )}
                    <span className="font-semibold text-white text-sm">
                      {currentVolume.toLocaleString("pt-BR")}kg
                    </span>
                    {hasPrevSession && (
                      <DiffBadge diff={volumeDiff} unit="%" />
                    )}
                  </div>
                </div>

                {/* Duration */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-white/40 text-base leading-none">⏱</span>
                    Duração
                  </div>
                  <div className="flex items-center gap-3">
                    {hasPrevSession && prevHeader && (
                      <span className="text-xs text-white/40">{formatDuration(prevHeader.duration_seconds)}</span>
                    )}
                    <span className="font-semibold text-white text-sm">
                      {formatDuration(currentHeader?.duration_seconds ?? null)}
                    </span>
                    {hasPrevSession && (
                      <DiffBadge diff={durDiff} unit="min" />
                    )}
                  </div>
                </div>

                {/* Sets */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-white/40 text-base leading-none">🔁</span>
                    Séries concluídas
                  </div>
                  <div className="flex items-center gap-3">
                    {hasPrevSession && prevSets != null && (
                      <span className="text-xs text-white/40">{prevSets}</span>
                    )}
                    <span className="font-semibold text-white text-sm">{currentSets}</span>
                    {hasPrevSession && <DiffBadge diff={setsDiff} />}
                  </div>
                </div>

                {/* PRs */}
                {prCount > 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                      <Star className="h-4 w-4" />
                      Recordes pessoais
                    </div>
                    <span className="font-bold text-yellow-400">{prCount} PR{prCount !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>

              {/* Exercise breakdown */}
              {currentExercises.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40 px-1">
                    Exercícios
                  </p>
                  {currentExercises.map((exercise) => {
                    const sortedSets = [...exercise.session_sets].sort(
                      (a, b) => a.order_index - b.order_index
                    );
                    const prevSetsForEx = prevSetsMap[exercise.exercise_id] ?? [];

                    return (
                      <div
                        key={exercise.id}
                        className="rounded-xl bg-white/5 border border-white/10 p-4"
                      >
                        <p className="text-sm font-semibold text-white mb-2">
                          {exercise.exercise_name}
                        </p>
                        <div className="space-y-0.5">
                          {sortedSets.map((set, i) => (
                            <SetRow
                              key={set.id}
                              index={i}
                              current={set}
                              previous={prevSetsForEx[i]}
                            />
                          ))}
                          {/* show prev sets that don't have a current counterpart */}
                          {prevSetsForEx.length > sortedSets.length &&
                            prevSetsForEx.slice(sortedSets.length).map((prevSet, i) => (
                              <SetRow
                                key={`prev-only-${i}`}
                                index={sortedSets.length + i}
                                current={undefined}
                                previous={prevSet}
                              />
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
