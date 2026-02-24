"use client";
import { useParams, useRouter } from "next/navigation";
import { useJustificationDetail, addJustificationComment, reviewJustification } from "@/hooks/use-admin";
import { API_URL } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { mutate } from "swr";
import { useState } from "react";
import Link from "next/link";

export default function JustificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useJustificationDetail(id);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  if (isLoading || !data) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--color-border-light)] rounded-lg" />
          <div className="h-32 bg-[var(--color-border-light)] rounded-2xl" />
          <div className="h-64 bg-[var(--color-border-light)] rounded-2xl" />
        </div>
      </main>
    );
  }

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await addJustificationComment(id, comment.trim());
      setComment("");
      await mutate(`admin-justification-${id}`);
      showToast.success("Commentaire ajoute.");
    } catch {
      showToast.error("Erreur lors de l'ajout du commentaire.");
    } finally {
      setSending(false);
    }
  };

  const handleReview = async (decision: "approved" | "rejected") => {
    setReviewLoading(true);
    try {
      await reviewJustification(id, decision);
      await mutate(`admin-justification-${id}`);
      await mutate((key: string) => typeof key === "string" && key.startsWith("admin-justifications"));
      showToast.success(decision === "approved" ? "Justificatif approuve." : "Justificatif refuse.");
    } catch {
      showToast.error("Erreur lors de la review.");
    } finally {
      setReviewLoading(false);
    }
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-2xl font-bold text-[var(--color-text)]"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Justificatif
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              <Link href={`/admin/students/${data.student_id}`} className="hover:underline text-[var(--color-accent)]">
                {data.student_name}
              </Link>
              {" "}&mdash; {data.course_name} ({data.course_date})
            </p>
          </div>
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
            data.status === "approved"
              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : data.status === "pending"
                ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
          }`}>
            {data.status === "approved" ? "Approuve" : data.status === "pending" ? "En attente" : "Refuse"}
          </span>
        </div>
      </div>

      {/* Reason */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-5 mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Raison</h2>
        <p className="text-sm text-[var(--color-text)]">{data.reason}</p>
        {data.reviewed_by_name && (
          <p className="text-xs text-[var(--color-text-muted)] mt-3">
            Revu par {data.reviewed_by_name} le {data.reviewed_at ? new Date(data.reviewed_at).toLocaleDateString("fr-FR") : ""}
          </p>
        )}
      </div>

      {/* Files */}
      {data.file_urls.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-5 mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Pieces jointes</h2>
          <div className="space-y-3">
            {data.file_urls.map((url, i) => (
              <div key={i}>
                {isImage(url) ? (
                  <img
                    src={`${API_URL}${url}`}
                    alt={`Piece jointe ${i + 1}`}
                    className="max-w-full max-h-96 rounded-lg border border-[var(--color-border-light)]"
                  />
                ) : (
                  <a
                    href={`${API_URL}${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                    Fichier {i + 1}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation thread */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-5 mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Conversation</h2>
        {data.comments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Aucun commentaire</p>
        ) : (
          <div className="space-y-3">
            {data.comments.map((c) => (
              <div key={c.id} className={`flex ${c.author_type === "admin" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                  c.author_type === "admin"
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text)]"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{c.author_name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      c.author_type === "admin"
                        ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                        : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    }`}>
                      {c.author_type === "admin" ? "Admin" : "Etudiant"}
                    </span>
                  </div>
                  <p className="text-sm">{c.message}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {new Date(c.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment input */}
        <div className="mt-4 flex gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
            rows={2}
          />
          <button
            disabled={sending || !comment.trim()}
            onClick={handleComment}
            className="self-end text-sm font-semibold px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {sending ? "..." : "Envoyer"}
          </button>
        </div>
      </div>

      {/* Action buttons */}
      {data.status === "pending" && (
        <div className="flex gap-3">
          <button
            disabled={reviewLoading}
            onClick={() => handleReview("approved")}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-[var(--color-success)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Approuver
          </button>
          <button
            disabled={reviewLoading}
            onClick={() => handleReview("rejected")}
            className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-[var(--color-danger)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Refuser
          </button>
        </div>
      )}
    </main>
  );
}
