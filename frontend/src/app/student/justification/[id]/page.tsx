"use client";
import { useAuth } from "@/hooks/use-auth";
import { StudentSkeleton } from "@/components/skeleton";
import { StudentHeader } from "@/components/student-header";
import { API_URL, api } from "@/lib/api";
import { showToast } from "@/lib/toast";
import useSWR, { mutate } from "swr";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface JustificationComment {
  id: string;
  author_type: string;
  author_name: string;
  message: string;
  created_at: string;
}

interface StudentJustificationDetail {
  id: string;
  course_name: string;
  course_date: string;
  reason: string;
  file_urls: string[];
  status: string;
  created_at: string;
  comments: JustificationComment[];
}

function isImageFile(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

function AuthImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => setSrc(URL.createObjectURL(blob)))
      .catch(() => {});
    return () => { if (src) URL.revokeObjectURL(src); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  if (!src) return <div className="h-32 rounded-xl bg-[var(--color-surface)] animate-pulse" />;
  return <img src={src} alt={alt} className="max-w-full max-h-96 h-auto" />;
}

export default function StudentJustificationDetailPage() {
  const { user, loading, isStudent } = useAuth();
  const router = useRouter();
  const params = useParams();
  const justificationId = params.id as string;
  const cacheKey = `student-justification-${justificationId}`;
  const { data: detail } = useSWR<StudentJustificationDetail>(cacheKey, {
    fetcher: () => api.get<StudentJustificationDetail>(`/api/v1/student/justifications/${justificationId}`),
  });
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isStudent)) router.push("/login");
  }, [loading, user, isStudent, router]);

  const handleDownload = useCallback(async (fileUrl: string, filename: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}${fileUrl}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { showToast.error("Erreur lors du telechargement."); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/v1/student/justifications/${justificationId}/comment`, { message: comment.trim() });
      setComment("");
      await mutate(cacheKey);
      showToast.success("Reponse envoyee.");
    } catch {
      showToast.error("Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  if (loading || !detail) {
    return <StudentSkeleton />;
  }

  const statusBadge = detail.status === "pending"
    ? { text: "En attente", cls: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]" }
    : detail.status === "approved"
      ? { text: "Approuvee", cls: "bg-[var(--color-success-bg)] text-[var(--color-success)]" }
      : { text: "Refusee", cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]" };

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <StudentHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
        {/* Back link */}
        <Link
          href="/student"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Retour
        </Link>

        {/* Header Card */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)]" style={{ fontFamily: "var(--font-playfair)" }}>
                Mon justificatif
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Soumis le {new Date(detail.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.cls}`}>
              {statusBadge.text}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1">Cours</p>
              <p className="font-semibold text-[var(--color-text)]">{detail.course_name}</p>
              <p className="text-[var(--color-text-muted)] text-xs">{detail.course_date}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1">Raison</p>
            <p className="text-sm text-[var(--color-text)]">{detail.reason}</p>
          </div>
        </div>

        {/* File Viewer */}
        {detail.file_urls.length > 0 && (
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
              Pieces jointes
            </h2>
            <div className="space-y-4">
              {detail.file_urls.map((url, i) => {
                const filename = url.split("/").pop() || `fichier-${i + 1}`;
                return (
                  <div key={i} className="flex flex-col gap-2">
                    {isImageFile(url) ? (
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">{filename}</p>
                        <button onClick={() => handleDownload(url, filename)} className="cursor-pointer">
                          <div className="rounded-xl overflow-hidden border border-[var(--color-border-light)] inline-block hover:opacity-90 transition-opacity">
                            <AuthImage url={url} alt={`Piece jointe ${i + 1}`} />
                          </div>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(url, filename)}
                        className="inline-flex items-center gap-2.5 text-sm font-semibold px-4 py-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        {filename}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversation Thread */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
            Conversation
          </h2>

          {detail.comments.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-4">Aucun message pour le moment.</p>
          ) : (
            <div className="space-y-4 mb-6">
              {detail.comments.map((c) => (
                <div key={c.id} className={`flex gap-3 ${c.author_type === "student" ? "justify-end" : ""}`}>
                  <div className={`max-w-[80%] ${c.author_type === "student" ? "order-1" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        c.author_type === "admin"
                          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                          : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      }`}>
                        {c.author_type === "admin" ? "Admin" : "Moi"}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">{c.author_name}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {new Date(c.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <div className={`rounded-xl px-4 py-3 text-sm ${
                      c.author_type === "student"
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                        : "bg-[var(--color-surface)] text-[var(--color-text)]"
                    }`}>
                      {c.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply Input */}
          <div className="flex gap-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ecrire une reponse..."
              className="flex-1 text-sm px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] resize-none"
              rows={2}
            />
            <button
              onClick={handleSendComment}
              disabled={sending || !comment.trim()}
              className="self-end text-sm font-semibold px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "..." : "Envoyer"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
