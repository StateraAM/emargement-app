"use client";
import { useAuth } from "@/hooks/use-auth";
import { useAdminCourseDetail } from "@/hooks/use-admin";
import { AdminSkeleton } from "@/components/skeleton";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface AuditModal {
  student_name: string;
  signed_at: string | null;
  qr_signed_at: string | null;
  signature_data: string | null;
  signature_ip: string | null;
  signature_user_agent: string | null;
}

export default function CourseDetailPage() {
  const { professor, loading, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const { data: course } = useAdminCourseDetail(courseId);
  const [modal, setModal] = useState<AuditModal | null>(null);

  useEffect(() => {
    if (!loading && (!professor || !isAdmin)) router.push("/login");
  }, [loading, professor, isAdmin, router]);

  if (loading || !course) {
    return <AdminSkeleton />;
  }

  const startDate = new Date(course.start_time);
  const endDate = new Date(course.end_time);
  const formattedDate = startDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

  const signedCount = course.students.filter((s) => s.signed_at || s.qr_signed_at).length;
  const presentCount = course.students.filter((s) => s.status === "present" || s.status === "late").length;
  const absentCount = course.students.filter((s) => s.status === "absent").length;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Retour au dashboard
      </Link>

      {/* Course Info Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
        <h1
          className="text-xl font-bold text-[var(--color-text)] mb-3"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          {course.name}
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-4">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Salle {course.room}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{course.professor_name}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formattedDate}, {formattedTime}</span>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[var(--color-border-light)]">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-success-bg)] text-xs font-bold text-[var(--color-success)]">
              {presentCount}
            </span>
            <span className="text-sm text-[var(--color-success)] font-medium">Present{presentCount > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-warning-bg)] text-xs font-bold text-[var(--color-warning)]">
              {signedCount < presentCount ? presentCount - signedCount : 0}
            </span>
            <span className="text-sm text-[var(--color-warning)] font-medium">En attente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-danger-bg)] text-xs font-bold text-[var(--color-danger)]">
              {absentCount}
            </span>
            <span className="text-sm text-[var(--color-danger)] font-medium">Absent{absentCount > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
              {course.students.length}
            </span>
            <span className="text-sm text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Total assiduite</span>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-semibold">Nom</th>
                <th className="text-center px-5 py-3 font-semibold">Etat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {course.students.map((s) => {
                const signedTime = s.signed_at || s.qr_signed_at;
                const hasSigned = !!signedTime;
                return (
                  <tr key={s.student_id} className="hover:bg-[var(--color-surface)] transition-colors">
                    {/* Name + signing info */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[var(--color-text)]">
                        {s.student_name}
                      </div>
                      {hasSigned && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Signe le {new Date(signedTime!).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} {new Date(signedTime!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {s.qr_signed_at && !s.signed_at && " (QR)"}
                        </div>
                      )}
                    </td>

                    {/* Status badge + signature drawing */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-4">
                        <span
                          className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-full ${
                            s.status === "present"
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                              : s.status === "late"
                                ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                                : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                          }`}
                        >
                          {s.status === "present" ? "Present" : s.status === "late" ? "Retard" : "Absent"}
                        </span>

                        {/* Inline signature drawing */}
                        {hasSigned && s.signature_data ? (
                          <button
                            onClick={() => setModal({
                              student_name: s.student_name,
                              signed_at: s.signed_at,
                              qr_signed_at: s.qr_signed_at,
                              signature_data: s.signature_data,
                              signature_ip: s.signature_ip,
                              signature_user_agent: s.signature_user_agent,
                            })}
                            className="flex-shrink-0 w-20 h-14 rounded-lg border border-[var(--color-border-light)] bg-white flex items-center justify-center overflow-hidden hover:border-[var(--color-primary)] hover:shadow-sm transition-all cursor-pointer"
                            title="Voir les details d'audit"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.signature_data}
                              alt={`Signature de ${s.student_name}`}
                              className="max-w-[72px] max-h-[48px] object-contain"
                            />
                          </button>
                        ) : hasSigned ? (
                          <button
                            onClick={() => setModal({
                              student_name: s.student_name,
                              signed_at: s.signed_at,
                              qr_signed_at: s.qr_signed_at,
                              signature_data: s.signature_data,
                              signature_ip: s.signature_ip,
                              signature_user_agent: s.signature_user_agent,
                            })}
                            className="flex-shrink-0 w-20 h-14 rounded-lg border border-dashed border-[var(--color-success-border)] bg-[var(--color-success-bg)] flex items-center justify-center hover:border-[var(--color-primary)] transition-all cursor-pointer"
                            title="Voir les details d'audit"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </button>
                        ) : (
                          <div className="flex-shrink-0 w-20 h-14 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {course.students.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
            Aucun etudiant inscrit a ce cours
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl border border-[var(--color-border-light)] max-w-lg w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-playfair)" }}>
                Audit — {modal.student_name}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Larger signature */}
              {modal.signature_data && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    Signature electronique
                  </p>
                  <div className="bg-white rounded-xl border border-[var(--color-border-light)] p-6 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={modal.signature_data}
                      alt={`Signature de ${modal.student_name}`}
                      className="max-h-48 w-auto"
                    />
                  </div>
                </div>
              )}

              {/* Audit Info */}
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Informations d&apos;audit
                </p>
                <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-light)] divide-y divide-[var(--color-border-light)]">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Methode</span>
                    <span className="text-xs font-semibold text-[var(--color-text)]">
                      {modal.qr_signed_at && !modal.signed_at ? "QR Code" : "Email"}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Date & heure</span>
                    <span className="text-xs font-semibold text-[var(--color-text)]">
                      {new Date(modal.signed_at || modal.qr_signed_at!).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </span>
                  </div>
                  {modal.signature_ip && (
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">Adresse IP</span>
                      <span className="text-xs font-mono font-semibold text-[var(--color-text)]">
                        {modal.signature_ip}
                      </span>
                    </div>
                  )}
                  {modal.signature_user_agent && (
                    <div className="px-4 py-2.5">
                      <span className="text-xs text-[var(--color-text-muted)] block mb-1">User-Agent</span>
                      <span className="text-xs font-mono text-[var(--color-text-secondary)] break-all">
                        {modal.signature_user_agent}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
