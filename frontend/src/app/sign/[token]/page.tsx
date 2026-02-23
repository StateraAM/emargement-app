"use client";
import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import SignaturePad from "signature_pad";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SignatureInfo {
  course_name: string;
  course_date: string;
  professor_name: string;
  student_name: string;
  already_signed: boolean;
}

export default function SignaturePage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [info, setInfo] = useState<SignatureInfo | null>(null);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/signatures/info/${token}`)
      .then((r) => {
        if (r.status === 410) throw new Error("expired");
        if (!r.ok) throw new Error("invalid");
        return r.json();
      })
      .then((data) => {
        setInfo(data);
        if (data.already_signed) setSigned(true);
      })
      .catch((e) => {
        setError(
          e.message === "expired"
            ? "Ce lien de signature a expire. Veuillez contacter votre professeur."
            : "Lien invalide ou introuvable."
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || signed || loading || error) return;

    sigPadRef.current = new SignaturePad(canvas, {
      penColor: "#000000",
      backgroundColor: "rgb(255, 255, 255)",
    });

    return () => {
      sigPadRef.current?.off();
    };
  }, [signed, loading, error]);

  const handleClear = () => {
    sigPadRef.current?.clear();
  };

  const handleSign = async () => {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setError("Veuillez dessiner votre signature avant de valider.");
      return;
    }

    setSigning(true);
    setError("");
    try {
      const signatureData = sigPadRef.current.toDataURL();
      const r = await fetch(`${API_URL}/api/v1/signatures/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_data: signatureData }),
      });
      if (!r.ok) throw new Error("sign_failed");
      const data = await r.json();
      if (data.signed || data.already_signed) setSigned(true);
    } catch {
      setError("Erreur lors de la signature. Veuillez reessayer.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Chargement...</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4">
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 shadow-sm border border-[var(--color-border-light)] text-center max-w-sm w-full animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-danger-bg)] mb-5">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">
            Lien invalide
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4">
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 shadow-sm border border-[var(--color-border-light)] text-center max-w-sm w-full animate-fade-in">
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
            Presence signee
          </h2>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Votre presence au cours{" "}
            <strong className="text-[var(--color-text)]">
              {info?.course_name}
            </strong>{" "}
            a ete enregistree avec succes.
          </p>
          <div className="mt-6 pt-6 border-t border-[var(--color-border-light)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              Vous pouvez fermer cette page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4">
      <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 shadow-sm border border-[var(--color-border-light)] max-w-sm w-full animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-primary)] mb-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <h1
            className="text-xl font-bold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Signer ma presence
          </h1>
        </div>

        {/* Course info */}
        <div className="space-y-3 mb-6 bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border-light)]">
          <InfoRow label="Cours" value={info?.course_name ?? ""} />
          <InfoRow label="Date" value={info?.course_date ?? ""} />
          <InfoRow label="Professeur" value={info?.professor_name ?? ""} />
          <InfoRow label="Etudiant" value={info?.student_name ?? ""} bold />
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mb-5 text-center leading-relaxed">
          En signant ci-dessous, vous confirmez votre presence physique a ce
          cours. Votre adresse IP sera enregistree.
        </p>

        {/* Signature canvas */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">
            Votre signature
          </label>
          <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl bg-white">
            <canvas
              ref={canvasRef}
              width={350}
              height={180}
              style={{ display: "block", cursor: "crosshair", touchAction: "none" }}
            />
          </div>
          <button
            onClick={handleClear}
            className="mt-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-medium"
          >
            Effacer la signature
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[var(--color-danger)] text-sm bg-[var(--color-danger-bg)] px-4 py-2.5 rounded-xl border border-[var(--color-danger-border)] mb-4">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        <button
          onClick={handleSign}
          disabled={signing}
          className="w-full bg-[var(--color-success)] text-white py-3.5 rounded-xl font-semibold hover:bg-[var(--color-success)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm"
        >
          {signing ? (
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
              Signature en cours...
            </span>
          ) : (
            "Valider ma signature"
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-sm text-[var(--color-text-muted)] shrink-0">
        {label}
      </span>
      <span
        className={`text-sm text-right ${bold ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}`}
      >
        {value}
      </span>
    </div>
  );
}
