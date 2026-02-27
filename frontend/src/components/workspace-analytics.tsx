"use client";

import { useMemo } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { WorkspaceEntry } from "@/lib/types";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const MATCH_COLORS: Record<string, string> = {
  matched: "var(--chart-2)",
  fuzzy: "var(--chart-4)",
  unmatched: "var(--chart-1)",
};

interface WorkspaceAnalyticsProps {
  entries: WorkspaceEntry[];
}

export function WorkspaceAnalytics({ entries }: WorkspaceAnalyticsProps) {
  const topCited = useMemo(() => {
    return [...entries]
      .sort((a, b) => b.occurrence_count - a.occurrence_count)
      .slice(0, 10);
  }, [entries]);

  const yearData = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of entries) {
      const year = entry.reference.year;
      if (year) counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year: String(year), count }));
  }, [entries]);

  const matchData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const s = entry.reference.match_status;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({
      name: status,
      value: count,
    }));
  }, [entries]);

  const venueData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const venue = entry.reference.venue;
      if (venue) counts.set(venue, (counts.get(venue) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([venue, count]) => ({
        venue: venue.length > 30 ? `${venue.slice(0, 27)}...` : venue,
        count,
      }));
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Analytics
        </h3>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Most Cited */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Most Cited References
            </h4>
            <ol className="space-y-1">
              {topCited.map((entry, idx) => (
                <li key={entry.id} className="flex items-baseline gap-2 text-xs">
                  <span className="text-muted-foreground tabular-nums w-5 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <span className="truncate">{entry.reference.title || "Untitled"}</span>
                  <span className="text-muted-foreground shrink-0 ml-auto tabular-nums">
                    x{entry.occurrence_count}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Match Quality Pie */}
          {matchData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Match Quality
              </h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={matchData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={36}
                      paddingAngle={2}
                      isAnimationActive={false}
                      label={({ name, value }) => `${name} (${value})`}
                    >
                      {matchData.map((d) => (
                        <Cell
                          key={d.name}
                          fill={MATCH_COLORS[d.name] || CHART_COLORS[0]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.375rem",
                        color: "var(--foreground)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Year Distribution */}
          {yearData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Year Distribution
              </h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearData}>
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "currentColor", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "currentColor", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.375rem",
                        color: "var(--foreground)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={CHART_COLORS[1]}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Venues */}
          {venueData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Top Venues
              </h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={venueData} layout="vertical">
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: "currentColor", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="venue"
                      tick={{ fill: "currentColor", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.375rem",
                        color: "var(--foreground)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={CHART_COLORS[2]}
                      radius={[0, 3, 3, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
