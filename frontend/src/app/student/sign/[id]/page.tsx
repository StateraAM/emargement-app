"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { StudentHeader } from "@/components/student-header";
import SignaturePad from "signature_pad";

interface RecordInfo {
  id: string;
  course_name: string;
  course_date: string;
  professor_name: string;
  status: string;
  signed_at: string | null;
}

export default function StudentSignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, isStudent } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  const [info, setInfo] = useState<RecordInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isStudent)) {
      router.push("/login");
    }
  }, [authLoading, user, isStudent, router]);

  useEffect(() => {
    if (!authLoading && user && isStudent) {
      api
        .get<RecordInfo>(`/api/v1/student/attendance/${id}`)
        .then((data) => {
          setInfo(data);
          if (data.signed_at) setSigned(true);
        })
        .catch(() => setError("Impossible de charger les informations."))
        .finally(() => setLoading(false));
    }
  }, [authLoading, user, isStudent, id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || signed || loading || error) return;

    const parent = canvas.parentElement;
    if (parent) {
      const width = parent.clientWidth;
      canvas.width = width;
      canvas.height = 180;
      canvas.style.width = width + "px";
      canvas.style.height = "180px";
    }

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "#000000",
    });
    sigPadRef.current = pad;

    return () => {
      pad.off();
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
      await api.post(`/api/v1/student/sign/${id}`, {
        signature_data: signatureData,
      });
      setSigned(true);
    } catch {
      setError("Erreur lors de la signature. Veuillez reessayer.");
    } finally {
      setSigning(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-3 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-muted)] text-sm">Chargement...</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)]">
        <StudentHeader title="Signer ma presence" showBack />
        <div className="flex items-center justify-center p-4 mt-8">
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
            <div className="mt-6">
              <button
                onClick={() => router.push("/student")}
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97] transition-all"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <StudentHeader title="Signer ma presence" showBack />
      <div className="flex items-center justify-center p-4 mt-4">
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 shadow-sm border border-[var(--color-border-light)] max-w-sm w-full animate-fade-in">

        {/* Course info */}
        {info && (
          <div className="space-y-3 mb-6 bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border-light)]">
            <InfoRow label="Cours" value={info.course_name} />
            <InfoRow label="Date" value={info.course_date} />
            <InfoRow label="Professeur" value={info.professor_name} />
          </div>
        )}

        {/* Signature canvas */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">
            Votre signature
          </label>
          <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height: "180px", display: "block", touchAction: "none" }}
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
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-sm text-[var(--color-text-muted)] shrink-0">
        {label}
      </span>
      <span className="text-sm text-right text-[var(--color-text-secondary)]">
        {value}
      </span>
    </div>
  );
}
