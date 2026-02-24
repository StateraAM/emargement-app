"use client";
import { API_URL } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { useEffect, useState, useCallback } from "react";

export function isImageFile(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
}

export function isPdfFile(url: string): boolean {
  return /\.pdf$/i.test(url);
}

function useAuthBlob(url: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => setBlobUrl(URL.createObjectURL(blob)))
      .catch(() => {});
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return blobUrl;
}

function AuthImage({ url, alt }: { url: string; alt: string }) {
  const src = useAuthBlob(url);
  if (!src) return <div className="h-48 rounded-xl bg-[var(--color-surface)] animate-pulse" />;
  return <img src={src} alt={alt} className="max-w-full max-h-[500px] h-auto rounded-xl" />;
}

function AuthPdf({ url }: { url: string }) {
  const src = useAuthBlob(url);
  if (!src) return <div className="h-[500px] rounded-xl bg-[var(--color-surface)] animate-pulse" />;
  return (
    <iframe
      src={src}
      className="w-full h-[500px] rounded-xl border border-[var(--color-border-light)]"
      title="PDF preview"
    />
  );
}

function DownloadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Telecharger
    </button>
  );
}

export function FilePreview({ url, index }: { url: string; index: number }) {
  const filename = url.split("/").pop() || `fichier-${index + 1}`;

  const handleDownload = useCallback(async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { showToast.error("Erreur lors du telechargement."); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [url, filename]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)] font-medium">{filename}</p>
        <DownloadButton onClick={handleDownload} />
      </div>
      {isImageFile(url) ? (
        <div className="rounded-xl overflow-hidden border border-[var(--color-border-light)] inline-block">
          <AuthImage url={url} alt={`Piece jointe ${index + 1}`} />
        </div>
      ) : isPdfFile(url) ? (
        <AuthPdf url={url} />
      ) : (
        <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {filename}
        </div>
      )}
    </div>
  );
}
