"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { AdminSkeleton } from "@/components/skeleton";
import {
  useAnalyticsSummary,
  useAttendanceTrends,
  useCourseAnalytics,
  useStudentsAtRisk,
  useProfessorAnalytics,
} from "@/hooks/use-analytics";
import { exportChartAsPng, printAnalytics } from "@/lib/export-chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---------- Chart color helpers ----------

function useChartColors() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return {
    text: isDark ? "#a0aab4" : "#6b5f52",
    grid: isDark ? "#2a3a4e" : "#e2ddd3",
    bg: isDark ? "#162231" : "#ffffff",
    tooltipBg: isDark ? "#1b2838" : "#ffffff",
    tooltipBorder: isDark ? "#2a3a4e" : "#e2ddd3",
    present: isDark ? "#3daa6d" : "#2d7a4f",
    absent: isDark ? "#e05555" : "#b33a3a",
    late: isDark ? "#d4a42a" : "#a67c1a",
    accent: isDark ? "#d4b85a" : "#c8a951",
    primary: isDark ? "#4a8cc7" : "#1e3a5f",
    rateGood: "#22c55e",
    rateWarn: "#eab308",
    rateBad: "#ef4444",
  };
}

function rateColor(rate: number, colors: ReturnType<typeof useChartColors>) {
  if (rate >= 80) return colors.rateGood;
  if (rate >= 60) return colors.rateWarn;
  return colors.rateBad;
}

// ---------- Main Page ----------

export default function AnalyticsPage() {
  const { professor, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: summary } = useAnalyticsSummary();
  const { data: trends } = useAttendanceTrends(period);
  const { data: courses } = useCourseAnalytics();
  const { data: atRisk } = useStudentsAtRisk(70);
  const { data: professors } = useProfessorAnalytics();
  const colors = useChartColors();

  useEffect(() => {
    if (!loading && (!professor || !isAdmin)) router.push("/login");
  }, [loading, professor, isAdmin, router]);

  if (loading || !summary) {
    return <AdminSkeleton />;
  }

  return (
      <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
        {/* Export toolbar */}
        <div className="flex justify-end gap-2 mb-4 no-print">
          <button
            onClick={() => printAnalytics()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[var(--color-surface-card)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimer
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 stagger-children">
          <SummaryCard
            label="Etudiants"
            value={summary.total_students}
            icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2M9 7a4 4 0 100-8 4 4 0 000 8z"
          />
          <SummaryCard
            label="Cours"
            value={summary.total_courses}
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
          <SummaryCard
            label="Taux moyen"
            value={`${summary.global_attendance_rate}%`}
            accent={summary.global_attendance_rate >= 75}
            warning={summary.global_attendance_rate < 75}
            icon="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z"
          />
          <SummaryCard
            label="Etudiants a risque"
            value={atRisk?.length ?? 0}
            warning={(atRisk?.length ?? 0) > 0}
            icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </div>

        {/* Attendance Trends */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Tendances de presence
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(["daily", "weekly", "monthly"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      period === p
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
                    }`}
                  >
                    {p === "daily" ? "Jour" : p === "weekly" ? "Semaine" : "Mois"}
                  </button>
                ))}
              </div>
              <ChartExportButton chartId="chart-trends" filename="tendances-presence" />
            </div>
          </div>
          <div id="chart-trends" className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 shadow-sm">
            {trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: colors.text }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: colors.text }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: colors.text }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: colors.text }}
                  />
                  <Line
                    type="monotone"
                    dataKey="present"
                    name="Presents"
                    stroke={colors.present}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colors.present }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absent"
                    name="Absents"
                    stroke={colors.absent}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colors.absent }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="late"
                    name="Retards"
                    stroke={colors.late}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colors.late }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-[var(--color-text-muted)] text-sm">
                Aucune donnee disponible
              </div>
            )}
          </div>
        </section>

        {/* Course Comparison */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Comparaison par cours
            </h2>
            <ChartExportButton chartId="chart-courses" filename="comparaison-cours" />
          </div>
          <div id="chart-courses" className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 shadow-sm">
            {courses && courses.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, courses.length * 40)}>
                <BarChart
                  data={courses.map((c) => ({
                    name: c.course_name || c.name || "—",
                    rate: c.attendance_rate ?? c.rate ?? 0,
                  }))}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: colors.text }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                    unit="%"
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: colors.text }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}%`, "Taux"]}
                  />
                  <Bar
                    dataKey="rate"
                    name="Taux de presence"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                    fill={colors.primary}
                    // Color each bar by rate
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const fill = rateColor(payload.rate, colors);
                      return <rect x={x} y={y} width={width} height={height} rx={6} fill={fill} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-[var(--color-text-muted)] text-sm">
                Aucune donnee disponible
              </div>
            )}
          </div>
        </section>

        {/* Students at Risk */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2
              className="text-xl font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Etudiants a risque
            </h2>
            {atRisk && atRisk.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
                {atRisk.length} etudiant{atRisk.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] shadow-sm overflow-hidden">
            {atRisk && atRisk.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3 font-semibold">Nom</th>
                      <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                      <th className="text-center px-4 py-3 font-semibold">Cours total</th>
                      <th className="text-center px-4 py-3 font-semibold">Absences</th>
                      <th className="text-center px-4 py-3 font-semibold">Taux de presence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-light)]">
                    {atRisk.map((s) => {
                      const name = s.student_name || `${s.last_name || ""} ${s.first_name || ""}`.trim();
                      const rate = s.attendance_rate ?? s.rate ?? 0;
                      return (
                        <tr key={s.student_id} className="hover:bg-[var(--color-surface)] transition-colors">
                          <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{name}</td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)] hidden md:table-cell">{s.email}</td>
                          <td className="px-4 py-3 text-center text-[var(--color-text-secondary)]">{s.total_courses}</td>
                          <td className="px-4 py-3 text-center text-[var(--color-danger)] font-medium">{s.absent}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                                rate >= 60
                                  ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                                  : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                              }`}
                            >
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
                Aucun etudiant en dessous du seuil de 70%
              </div>
            )}
          </div>
        </section>

        {/* Professor Comparison */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Statistiques par professeur
            </h2>
            <ChartExportButton chartId="chart-professors" filename="statistiques-professeurs" />
          </div>
          <div id="chart-professors" className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-light)] p-4 shadow-sm">
            {professors && professors.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, professors.length * 50)}>
                <BarChart
                  data={professors.map((p) => ({
                    name: p.professor_name || `${p.last_name || ""} ${p.first_name || ""}`.trim(),
                    courses: p.total_courses ?? p.courses_count ?? 0,
                    rate: p.average_attendance_rate ?? 0,
                  }))}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: colors.text }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: colors.text }}
                    tickLine={false}
                    axisLine={{ stroke: colors.grid }}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: colors.tooltipBg,
                      border: `1px solid ${colors.tooltipBorder}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: colors.text }} />
                  <Bar
                    dataKey="courses"
                    name="Nb de cours"
                    fill={colors.primary}
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                  <Bar
                    dataKey="rate"
                    name="Taux moyen (%)"
                    fill={colors.accent}
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-[var(--color-text-muted)] text-sm">
                Aucune donnee disponible
              </div>
            )}
          </div>
        </section>
      </main>
  );
}

// ---------- Summary Card ----------

function SummaryCard({
  label,
  value,
  icon,
  accent,
  warning,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl p-5 shadow-sm border border-[var(--color-border-light)] transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            warning
              ? "bg-[var(--color-danger-bg)]"
              : accent
                ? "bg-[var(--color-success-bg)]"
                : "bg-[var(--color-primary)]/10"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={
              warning
                ? "var(--color-danger)"
                : accent
                  ? "var(--color-success)"
                  : "var(--color-primary)"
            }
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--color-text)]">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">
        {label}
      </p>
    </div>
  );
}

// ---------- Chart Export Button ----------

function ChartExportButton({ chartId, filename }: { chartId: string; filename: string }) {
  return (
    <button
      onClick={() => exportChartAsPng(chartId, filename)}
      className="no-print flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--color-surface)]"
      title="Telecharger en PNG"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      PNG
    </button>
  );
}
