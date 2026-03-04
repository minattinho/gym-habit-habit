import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProcessedSession,
  MetricType,
  getMetricValue,
  getMetricLabel,
  getMetricUnit,
  markPRPoints,
} from "@/lib/exercise-stats";
import { Calendar } from "lucide-react";

interface ProgressChartProps {
  sessions: ProcessedSession[];
  metric: MetricType;
  isLoading?: boolean;
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.isPR) return <circle cx={cx} cy={cy} r={4} fill="hsl(var(--primary))" stroke="none" />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="hsl(var(--secondary))" stroke="hsl(var(--background))" strokeWidth={2} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="hsl(var(--secondary))" fontSize={10} fontWeight={700}>
        PR
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md text-sm space-y-1">
      <p className="font-medium">{data.fullDate}</p>
      <p className="text-muted-foreground">{data.workoutName || "Treino"}</p>
      <div className="border-t pt-1 mt-1 space-y-0.5">
        <p>
          <span className="text-muted-foreground">Métrica:</span>{" "}
          <span className="font-semibold">{data.metricValue}{data.unit}</span>
        </p>
        {data.bestSetLabel && (
          <p>
            <span className="text-muted-foreground">Melhor set:</span> {data.bestSetLabel}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Volume:</span> {data.volume}kg
        </p>
        <p>
          <span className="text-muted-foreground">Sets:</span> {data.totalSets}
        </p>
      </div>
      {data.isPR && (
        <p className="text-secondary font-semibold text-xs">🏆 Recorde pessoal!</p>
      )}
    </div>
  );
}

export function ProgressChart({ sessions, metric, isLoading }: ProgressChartProps) {
  const chartData = useMemo(() => {
    if (!sessions.length) return [];
    const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
    const prFlags = markPRPoints(sorted, metric);
    const unit = getMetricUnit(metric);

    return sorted.map((s, i) => ({
      date: format(s.date, "dd/MM", { locale: ptBR }),
      fullDate: format(s.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      workoutName: s.workoutName,
      metricValue: getMetricValue(s, metric),
      value: getMetricValue(s, metric),
      volume: s.volume,
      totalSets: s.sets.filter((set) => set.is_completed).length,
      bestSetLabel: s.bestSet ? `${s.bestSet.reps}×${s.bestSet.weight}kg` : null,
      isPR: prFlags[i],
      unit,
    }));
  }, [sessions, metric]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">Sem treinos neste período</h3>
          <p className="text-center text-sm text-muted-foreground">
            Tente ampliar o filtro de período para ver mais dados
          </p>
        </CardContent>
      </Card>
    );
  }

  const unit = getMetricUnit(metric);

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}${unit}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
