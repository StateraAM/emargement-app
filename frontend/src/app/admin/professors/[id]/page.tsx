"use client";
import { useParams } from "next/navigation";
import { useProfessorProfile } from "@/hooks/use-admin";
import { useState } from "react";

const tabs = [
  { key: "courses", label: "Seances" },
  { key: "aggregated", label: "Par cours" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function ProfessorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useProfessorProfile(id);
  const [activeTab, setActiveTab] = useState<TabKey>("courses");

  if (isLoading || !data) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--color-border-light)] rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-[var(--color-border-light)] rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--color-border-light)] rounded-2xl" />
        </div>
      </main>
    );
  }

  const { professor, stats } = data;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Professor header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {professor.last_name} {professor.first_name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{professor.email}</p>
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mt-2 ${
          professor.role === "admin"
            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
        }`}>
          {professor.role === "admin" ? "Admin" : "Professeur"}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatMini label="Cours donnes" value={stats.total_courses_given} />
        <StatMini label="Etudiants" value={stats.total_students} />
        <StatMini
          label="Taux moyen"
          value={`${stats.avg_attendance_rate}%`}
          color={stats.avg_attendance_rate >= 80 ? "success" : stats.avg_attendance_rate >= 60 ? "warning" : "danger"}
        />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border-light)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
        {activeTab === "courses" && <CoursesTable rows={data.courses} />}
        {activeTab === "aggregated" && <AggregatedTable rows={data.by_course_name} />}
      </div>
    </main>
  );
}

function StatMini({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorMap: Record<string, string> = {
    success: "text-[var(--color-success)]",
    danger: "text-[var(--color-danger)]",
    warning: "text-[var(--color-warning)]",
  };
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl p-4 shadow-sm border border-[var(--color-border-light)]">
      <p className={`text-xl font-bold ${color ? colorMap[color] : "text-[var(--color-text)]"}`}>{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}

function CoursesTable({ rows }: { rows: { course_name: string; date: string; room: string; student_count: number; attendance_rate: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Cours</th>
            <th className="text-left px-4 py-3 font-semibold">Date</th>
            <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Salle</th>
            <th className="text-center px-4 py-3 font-semibold">Etudiants</th>
            <th className="text-center px-4 py-3 font-semibold">Taux</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{r.course_name}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{r.date}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)] hidden sm:table-cell">{r.room || "\u2014"}</td>
              <td className="px-4 py-3 text-center text-[var(--color-text)]">{r.student_count}</td>
              <td className="px-4 py-3 text-center">
                <RateBadge rate={r.attendance_rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState />}
    </div>
  );
}

function AggregatedTable({ rows }: { rows: { course_name: string; total_sessions: number; avg_rate: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Cours</th>
            <th className="text-center px-4 py-3 font-semibold">Seances</th>
            <th className="text-center px-4 py-3 font-semibold">Taux moyen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {rows.map((r) => (
            <tr key={r.course_name} className="hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{r.course_name}</td>
              <td className="px-4 py-3 text-center text-[var(--color-text)]">{r.total_sessions}</td>
              <td className="px-4 py-3 text-center">
                <RateBadge rate={r.avg_rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState />}
    </div>
  );
}

function RateBadge({ rate }: { rate: number }) {
  return (
    <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-xs font-bold ${
      rate >= 80
        ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
        : rate >= 60
          ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
          : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
    }`}>
      {rate}%
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
      Aucune donnee
    </div>
  );
}
