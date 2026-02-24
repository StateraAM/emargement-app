"use client";
import { useAuth } from "@/hooks/use-auth";
import { StudentSkeleton } from "@/components/skeleton";
import { StudentHeader } from "@/components/student-header";
import { API_URL, api } from "@/lib/api";
import { showToast } from "@/lib/toast";

import useSWR, { mutate } from "swr";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FilePreview } from "@/components/file-preview";

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
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isStudent)) router.push("/login");
  }, [loading, user, isStudent, router]);


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

  const handleUploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/v1/student/justifications/${justificationId}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Erreur");
      }
      setFiles([]);
      await mutate(cacheKey);
      showToast.success("Fichiers envoyes.");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi.");
    } finally {
      setUploading(false);
    }
  };

  const hasAdminComment = detail?.comments?.some((c) => c.author_type === "admin") ?? false;

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
            <div className="space-y-6">
              {detail.file_urls.map((url, i) => (
                <FilePreview key={i} url={url} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* File Upload — shown when admin asked for more info */}
        {detail.status === "pending" && hasAdminComment && (
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 shadow-sm border border-[var(--color-border-light)] mb-6">
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
              Ajouter des fichiers
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              L&apos;administration a demande des informations complementaires. Vous pouvez ajouter des fichiers (PDF, JPG, PNG).
            </p>

            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-sm font-semibold">Choisir des fichiers</span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) setFiles(Array.from(e.target.files));
                }}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm text-[var(--color-text)] bg-[var(--color-surface)] rounded-lg px-3 py-2 border border-[var(--color-border-light)]">
                    <span className="truncate">{f.name}</span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors ml-2 shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleUploadFiles}
                  disabled={uploading}
                  className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {uploading ? "Envoi en cours..." : `Envoyer ${files.length} fichier${files.length > 1 ? "s" : ""}`}
                </button>
              </div>
            )}
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
