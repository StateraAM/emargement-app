"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCourseStudents } from "@/hooks/use-courses";
import {
  validateAttendance,
  getAttendanceStatus,
  getAttendanceRecords,
  updateAttendance,
  type AttendanceStatus,
  type AttendanceRecord,
} from "@/hooks/use-attendance";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { CourseSkeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { API_URL } from "@/lib/api";
import { showToast } from "@/lib/toast";

interface LiveSignature {
  student_id: string;
  student_name: string;
  signed_at: string;
}

type Status = "present" | "absent" | "late";

const statusConfig: Record<
  Status,
  { bg: string; border: string; text: string; label: string; icon: string }
> = {
  present: {
    bg: "bg-[var(--color-success-bg)]",
    border: "border-[var(--color-success-border)]",
    text: "text-[var(--color-success)]",
    label: "Present",
    icon: "M9 12l2 2 4-4",
  },
  absent: {
    bg: "bg-[var(--color-danger-bg)]",
    border: "border-[var(--color-danger-border)]",
    text: "text-[var(--color-danger)]",
    label: "Absent",
    icon: "M18 6L6 18M6 6l12 12",
  },
  late: {
    bg: "bg-[var(--color-warning-bg)]",
    border: "border-[var(--color-warning-border)]",
    text: "text-[var(--color-warning)]",
    label: "Retard",
    icon: "M12 6v6l4 2",
  },
};

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const { professor, loading: authLoading } = useAuth();
  const { data: students, isLoading } = useCourseStudents(id);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [liveSignatures, setLiveSignatures] = useState<LiveSignature[]>([]);
  const router = useRouter();

  const handleWsMessage = useCallback((msg: { type: string; student_id: string; student_name: string; signed_at: string }) => {
    if (msg.type === "signature") {
      setLiveSignatures((prev) => {
        if (prev.some((s) => s.student_id === msg.student_id)) return prev;
        return [...prev, { student_id: msg.student_id, student_name: msg.student_name, signed_at: msg.signed_at }];
      });
      showToast.success(`${msg.student_name} a signe`);
    }
  }, []);

  const { connected: wsConnected } = useWebSocket({
    courseId: id,
    enabled: submitted,
    onMessage: handleWsMessage,
  });

  const isValidated = attendanceStatus?.validated ?? false;
  const isEditable = attendanceStatus?.editable ?? true;
  const disabled = isValidated && !isEditable;

  useEffect(() => {
    if (!authLoading && !professor) router.push("/login");
  }, [authLoading, professor, router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getAttendanceStatus(id);
        if (cancelled) return;
        setAttendanceStatus(status);
        if (status.validated) {
          const records = await getAttendanceRecords(id);
          if (cancelled) return;
          const prePopulated: Record<string, Status> = {};
          records.forEach((r: AttendanceRecord) => {
            if (r.status === "present" || r.status === "absent" || r.status === "late") {
              prePopulated[r.student_id] = r.status as Status;
            }
          });
          setStatuses(prePopulated);
        }
      } catch {
        // Status endpoint not available or course not validated yet — use defaults
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (authLoading || isLoading || statusLoading) {
    return <CourseSkeleton />;
  }

  const getStatus = (studentId: string): Status =>
    statuses[studentId] || "absent";

  const toggleStatus = (studentId: string) => {
    if (disabled) return;
    const current = getStatus(studentId);
    const next: Status =
      current === "absent" ? "present" : current === "present" ? "late" : "absent";
    setStatuses((prev) => ({ ...prev, [studentId]: next }));
  };

  const markAll = (status: Status) => {
    if (!students) return;
    const newStatuses: Record<string, Status> = {};
    students.forEach((s) => (newStatuses[s.id] = status));
    setStatuses(newStatuses);
  };

  const handleSubmit = async () => {
    if (!students || disabled) return;
    setSubmitting(true);
    try {
      const entries = students.map((s) => ({
        student_id: s.id,
        status: getStatus(s.id),
      }));
      if (isValidated) {
        await updateAttendance(id, entries);
      } else {
        await validateAttendance(id, entries);
      }
      setSubmitted(true);
    } catch {
      showToast.error("Erreur lors de la validation");
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = students?.filter(
    (s) => getStatus(s.id) === "present"
  ).length ?? 0;
  const lateCount = students?.filter(
    (s) => getStatus(s.id) === "late"
  ).length ?? 0;
  const absentCount = (students?.length ?? 0) - presentCount - lateCount;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex flex-col items-center justify-center p-4 animate-fade-in">
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 shadow-sm border border-[var(--color-border-light)] text-center max-w-sm w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-bg)] mb-5">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h2
            className="text-2xl font-bold text-[var(--color-text)] mb-2"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Appel valide
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-2 text-sm">
            {presentCount} present{presentCount > 1 ? "s" : ""} &middot;{" "}
            {lateCount} retard{lateCount > 1 ? "s" : ""} &middot;{" "}
            {absentCount} absent{absentCount > 1 ? "s" : ""}
          </p>
          <p className="text-[var(--color-text-muted)] mb-6 text-sm">
            Les emails de signature ont ete envoyes aux etudiants presents.
          </p>

          <button
            onClick={() => setShowQr(!showQr)}
            className="flex items-center justify-center gap-2 mx-auto text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] text-sm font-medium mb-4 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            {showQr ? "Masquer le QR code" : "Afficher le QR code"}
          </button>

          {showQr && (
            <div className="bg-white p-4 rounded-xl border border-[var(--color-border-light)] mb-6 animate-fade-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_URL}/api/v1/attendance/${id}/qr`}
                alt="QR Code de signature"
                className="mx-auto w-48 h-48"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                Les etudiants peuvent scanner ce QR code pour signer
              </p>
            </div>
          )}

          {/* Live Signatures */}
          <div className="text-left mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Signatures en direct
              </h3>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  wsConnected
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wsConnected
                      ? "bg-[var(--color-success)] animate-pulse-soft"
                      : "bg-[var(--color-warning)]"
                  }`}
                />
                {wsConnected ? "Connecte" : "Reconnexion..."}
              </span>
            </div>

            {liveSignatures.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                En attente de signatures...
              </p>
            ) : (
              <div className="space-y-2">
                {liveSignatures.map((sig) => (
                  <div
                    key={sig.student_id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-success-bg)] border border-[var(--color-success-border)] animate-fade-in"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-success)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--color-success)]">
                      {sig.student_name}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                      {new Date(sig.signed_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-[var(--color-primary)] text-white py-3 rounded-xl font-semibold hover:bg-[var(--color-primary-dark)] transition-all active:scale-[0.98]"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="bg-[var(--color-primary)] text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors text-sm"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Retour
          </button>
          <div className="h-4 w-px bg-white/20" />
          <h1 className="font-semibold text-sm flex-1">Faire l&apos;appel</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 animate-fade-in">
        {/* Validated banner */}
        {isValidated && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-[var(--color-primary)] text-white">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span className="font-semibold text-sm">Appel valide</span>
          </div>
        )}

        {/* Non-editable message */}
        {disabled && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm font-medium">
              Modification impossible — la moitie du cours est depassee
            </span>
          </div>
        )}

        {/* Summary bar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            {students?.length} etudiant{(students?.length ?? 0) > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-success)] font-semibold">
              {presentCount} P
            </span>
            <span className="text-[var(--color-warning)] font-semibold">
              {lateCount} R
            </span>
            <span className="text-[var(--color-danger)] font-semibold">
              {absentCount} A
            </span>
          </div>
        </div>

        {/* Quick actions */}
        {!disabled && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => markAll("present")}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success)] font-medium border border-[var(--color-success-border)] hover:bg-[var(--color-success)]/20 transition-colors"
            >
              Tous presents
            </button>
            <button
              onClick={() => markAll("absent")}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger)] font-medium border border-[var(--color-danger-border)] hover:bg-[var(--color-danger)]/20 transition-colors"
            >
              Tous absents
            </button>
          </div>
        )}

        {/* Student list */}
        <div className="space-y-2 stagger-children">
          {students?.map((student) => {
            const status = getStatus(student.id);
            const config = statusConfig[status];
            return (
              <button
                key={student.id}
                onClick={() => toggleStatus(student.id)}
                disabled={disabled}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "active:scale-[0.98]"
                } ${config.bg} ${config.border}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${config.text} bg-[var(--color-surface-card)]/60`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={config.icon} />
                      </svg>
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--color-text)] text-[15px]">
                        {student.last_name}{" "}
                        <span className="font-normal">
                          {student.first_name}
                        </span>
                      </span>
                      {student.is_alternance && (
                        <span className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
                          Alternance
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${config.text} px-2.5 py-1 rounded-lg bg-[var(--color-surface-card)]/50`}
                  >
                    {config.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Submit */}
        {!disabled && (
          <div className="sticky bottom-0 pt-4 pb-6 mt-4 bg-gradient-to-t from-[var(--color-surface)] via-[var(--color-surface)] to-transparent">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-[var(--color-primary)] text-white py-3.5 rounded-xl font-semibold hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg shadow-[var(--color-primary)]/20"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Validation en cours...
                </span>
              ) : isValidated ? (
                "Modifier l'appel"
              ) : (
                "Valider l'appel"
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
