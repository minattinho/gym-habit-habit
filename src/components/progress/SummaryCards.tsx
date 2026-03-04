import { Calendar, Trophy, TrendingUp, Dumbbell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProcessedSession, PRInfo, computePRs } from "@/lib/exercise-stats";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardsProps {
  sessions: ProcessedSession[];
  isLoading?: boolean;
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${iconColor || "text-primary"}`} />
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
        </div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ sessions, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!sessions.length) return null;

  const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastSession = sorted[sorted.length - 1];
  const { prWeight, prE1rm, prVolume } = computePRs(sessions);

  const fmtDate = (d: Date) => format(d, "dd/MM/yy", { locale: ptBR });
  const fmtWorkout = (s: ProcessedSession | PRInfo) =>
    "workoutName" in s && s.workoutName ? s.workoutName : "Treino";

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon={Calendar}
        title="Última sessão"
        value={fmtDate(lastSession.date)}
        subtitle={
          lastSession.bestSet
            ? `Melhor: ${lastSession.bestSet.reps}×${lastSession.bestSet.weight}kg`
            : fmtWorkout(lastSession)
        }
      />
      <StatCard
        icon={Trophy}
        title="PR de carga"
        iconColor="text-amber-500"
        value={prWeight ? `${prWeight.value}kg` : "—"}
        subtitle={prWeight ? `${fmtDate(prWeight.date)} · ${prWeight.workoutName || "Treino"}` : "Sem dados"}
      />
      <StatCard
        icon={TrendingUp}
        title="1RM estimado"
        iconColor="text-secondary"
        value={prE1rm ? `${prE1rm.value}kg` : "—"}
        subtitle={prE1rm ? `${fmtDate(prE1rm.date)} · ${prE1rm.workoutName || "Treino"}` : "Sem dados"}
      />
      <StatCard
        icon={Dumbbell}
        title="PR de volume"
        value={prVolume ? `${prVolume.value}kg` : "—"}
        subtitle={prVolume ? `${fmtDate(prVolume.date)} · ${prVolume.workoutName || "Treino"}` : "Sem dados"}
      />
    </div>
  );
}
