import { subDays, subYears, isAfter } from "date-fns";

export interface SetData {
  id: string;
  weight: number | null;
  reps: number | null;
  is_completed: boolean;
  order_index: number;
}

export interface SessionData {
  sessionId: string;
  date: Date;
  workoutName: string | null;
  sets: SetData[];
}

export interface ProcessedSession {
  sessionId: string;
  date: Date;
  workoutName: string | null;
  sets: SetData[];
  bestSet: { weight: number; reps: number; e1rm: number } | null;
  volume: number;
  maxWeight: number;
  maxE1rm: number;
  maxReps: number;
  hasIncompleteData: boolean;
}

export interface PRInfo {
  value: number;
  date: Date;
  workoutName: string | null;
  weight?: number;
  reps?: number;
}

export function calcE1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function processSession(session: SessionData): ProcessedSession {
  const completeSets = session.sets.filter(
    (s) => s.is_completed && s.weight != null && s.reps != null && s.weight > 0 && s.reps > 0
  );
  const hasIncompleteData = completeSets.length < session.sets.filter((s) => s.is_completed).length;

  let bestSet: ProcessedSession["bestSet"] = null;
  let volume = 0;
  let maxWeight = 0;
  let maxE1rm = 0;
  let maxReps = 0;

  for (const set of completeSets) {
    const w = set.weight!;
    const r = set.reps!;
    const e1rm = calcE1rm(w, r);
    volume += w * r;
    if (w > maxWeight) maxWeight = w;
    if (r > maxReps) maxReps = r;
    if (e1rm > maxE1rm) {
      maxE1rm = e1rm;
      bestSet = { weight: w, reps: r, e1rm };
    }
  }

  return {
    ...session,
    bestSet,
    volume,
    maxWeight,
    maxE1rm,
    maxReps,
    hasIncompleteData,
  };
}

export function filterByPeriod(
  sessions: ProcessedSession[],
  period: "30d" | "90d" | "1y" | "all"
): ProcessedSession[] {
  if (period === "all") return sessions;
  const now = new Date();
  const cutoff =
    period === "30d" ? subDays(now, 30) : period === "90d" ? subDays(now, 90) : subYears(now, 1);
  return sessions.filter((s) => isAfter(s.date, cutoff));
}

export type MetricType = "e1rm" | "weight" | "volume" | "reps";

export function getMetricValue(session: ProcessedSession, metric: MetricType): number {
  switch (metric) {
    case "e1rm": return session.maxE1rm;
    case "weight": return session.maxWeight;
    case "volume": return session.volume;
    case "reps": return session.maxReps;
  }
}

export function getMetricLabel(metric: MetricType): string {
  switch (metric) {
    case "e1rm": return "1RM estimado";
    case "weight": return "Carga";
    case "volume": return "Volume";
    case "reps": return "Reps";
  }
}

export function getMetricUnit(metric: MetricType): string {
  switch (metric) {
    case "e1rm": return "kg";
    case "weight": return "kg";
    case "volume": return "kg";
    case "reps": return "";
  }
}

export function computePRs(sessions: ProcessedSession[]) {
  // Sessions should be sorted by date ascending
  const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());

  let prWeight: PRInfo | null = null;
  let prE1rm: PRInfo | null = null;
  let prVolume: PRInfo | null = null;

  for (const s of sorted) {
    if (s.maxWeight > 0 && (!prWeight || s.maxWeight > prWeight.value)) {
      prWeight = { value: s.maxWeight, date: s.date, workoutName: s.workoutName };
    }
    if (s.maxE1rm > 0 && (!prE1rm || s.maxE1rm > prE1rm.value)) {
      prE1rm = { value: s.maxE1rm, date: s.date, workoutName: s.workoutName };
    }
    if (s.volume > 0 && (!prVolume || s.volume > prVolume.value)) {
      prVolume = { value: s.volume, date: s.date, workoutName: s.workoutName };
    }
  }

  return { prWeight, prE1rm, prVolume };
}

export function markPRPoints(
  sessions: ProcessedSession[],
  metric: MetricType
): boolean[] {
  let maxSoFar = -Infinity;
  return sessions.map((s) => {
    const val = getMetricValue(s, metric);
    if (val > maxSoFar && val > 0) {
      maxSoFar = val;
      return true;
    }
    return false;
  });
}
