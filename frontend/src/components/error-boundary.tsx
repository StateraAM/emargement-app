'use client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] mb-6">
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
        <h2
          className="text-2xl font-bold text-[var(--color-text)] mb-2"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          Une erreur est survenue
        </h2>
        <p className="text-[var(--color-text-secondary)] mb-6">
          Un probleme inattendu s&apos;est produit. Veuillez reessayer.
        </p>
        {error?.digest && (
          <p className="text-xs text-[var(--color-text-muted)] mb-4 font-mono">
            Code: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          Reessayer
        </button>
      </div>
    </div>
  );
}
