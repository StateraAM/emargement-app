"use client";
import { useParams } from "next/navigation";
import { useStudentProfile } from "@/hooks/use-admin";
import { useState } from "react";

const tabs = [
  { key: "courses", label: "Par cours" },
  { key: "professors", label: "Par professeur" },
  { key: "absences", label: "Absences recentes" },
  { key: "justifications", label: "Justificatifs" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useStudentProfile(id);
  const [activeTab, setActiveTab] = useState<TabKey>("courses");

  if (isLoading || !data) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--color-border-light)] rounded-lg" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[var(--color-border-light)] rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--color-border-light)] rounded-2xl" />
        </div>
      </main>
    );
  }

  const { student, stats } = data;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Student header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {student.last_name} {student.first_name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{student.email}</p>
        {student.is_alternance && (
          <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] mt-2">
            Alternance
          </span>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatMini label="Total cours" value={stats.total_courses} />
        <StatMini label="Present" value={stats.attended} color="success" />
        <StatMini label="Absent" value={stats.absent} color="danger" />
        <StatMini label="Retard" value={stats.late} color="warning" />
        <StatMini
          label="Taux"
          value={`${stats.attendance_rate}%`}
          color={stats.attendance_rate >= 80 ? "success" : stats.attendance_rate >= 60 ? "warning" : "danger"}
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
        {activeTab === "courses" && <CourseTable rows={data.by_course} />}
        {activeTab === "professors" && <ProfessorTable rows={data.by_professor} />}
        {activeTab === "absences" && <AbsenceTable rows={data.recent_absences} />}
        {activeTab === "justifications" && <JustificationTable rows={data.justifications} />}
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

function CourseTable({ rows }: { rows: { course_name: string; total: number; attended: number; absent: number; late: number; rate: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Cours</th>
            <th className="text-center px-4 py-3 font-semibold">Total</th>
            <th className="text-center px-4 py-3 font-semibold">Pres.</th>
            <th className="text-center px-4 py-3 font-semibold">Abs.</th>
            <th className="text-center px-4 py-3 font-semibold">Ret.</th>
            <th className="text-center px-4 py-3 font-semibold">Taux</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {rows.map((r) => (
            <tr key={r.course_name} className="hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{r.course_name}</td>
              <td className="px-4 py-3 text-center text-[var(--color-text-muted)]">{r.total}</td>
              <td className="px-4 py-3 text-center text-[var(--color-success)] font-medium">{r.attended}</td>
              <td className="px-4 py-3 text-center text-[var(--color-danger)] font-medium">{r.absent}</td>
              <td className="px-4 py-3 text-center text-[var(--color-warning)] font-medium">{r.late}</td>
              <td className="px-4 py-3 text-center">
                <RateBadge rate={r.rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState />}
    </div>
  );
}

function ProfessorTable({ rows }: { rows: { professor_name: string; total: number; attended: number; absent: number; late: number; rate: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Professeur</th>
            <th className="text-center px-4 py-3 font-semibold">Total</th>
            <th className="text-center px-4 py-3 font-semibold">Pres.</th>
            <th className="text-center px-4 py-3 font-semibold">Abs.</th>
            <th className="text-center px-4 py-3 font-semibold">Ret.</th>
            <th className="text-center px-4 py-3 font-semibold">Taux</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {rows.map((r) => (
            <tr key={r.professor_name} className="hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{r.professor_name}</td>
              <td className="px-4 py-3 text-center text-[var(--color-text-muted)]">{r.total}</td>
              <td className="px-4 py-3 text-center text-[var(--color-success)] font-medium">{r.attended}</td>
              <td className="px-4 py-3 text-center text-[var(--color-danger)] font-medium">{r.absent}</td>
              <td className="px-4 py-3 text-center text-[var(--color-warning)] font-medium">{r.late}</td>
              <td className="px-4 py-3 text-center">
                <RateBadge rate={r.rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState />}
    </div>
  );
}

function AbsenceTable({ rows }: { rows: { course_name: string; date: string; status: string; justification_status: string | null }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Cours</th>
            <th className="text-left px-4 py-3 font-semibold">Date</th>
            <th className="text-center px-4 py-3 font-semibold">Statut</th>
            <th className="text-center px-4 py-3 font-semibold">Justification</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{r.course_name}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                {new Date(r.date).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  r.status === "absent"
                    ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                    : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                }`}>
                  {r.status === "absent" ? "Absent" : "Retard"}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {r.justification_status ? (
                  <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                    r.justification_status === "approved"
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                      : r.justification_status === "pending"
                        ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                        : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                  }`}>
                    {r.justification_status === "approved" ? "Approuve" : r.justification_status === "pending" ? "En attente" : "Refuse"}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">&mdash;</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState />}
    </div>
  );
}

function JustificationTable({ rows }: { rows: { id: string; course_name: string; date: string; reason: string; status: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-semibold">Cours</th>
            <th className="text-left px-4 py-3 font-semibold">Date</th>
            <th className="text-left px-4 py-3 font-semibold">Raison</th>
            <th className="text-center px-4 py-3 font-semibold">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-[var(--color-surface)] transition-colors">
              <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{r.course_name}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                {new Date(r.date).toLocaleDateString("fr-FR")}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--color-text)] max-w-[200px] truncate">{r.reason}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                  r.status === "approved"
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    : r.status === "pending"
                      ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                      : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                }`}>
                  {r.status === "approved" ? "Approuve" : r.status === "pending" ? "En attente" : "Refuse"}
                </span>
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
