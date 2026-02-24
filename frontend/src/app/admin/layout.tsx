"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";

const breadcrumbLabels: Record<string, string> = {
  admin: "Admin",
  analytics: "Analytique",
  students: "Etudiants",
  professors: "Professeurs",
  justifications: "Justificatifs",
  "students-at-risk": "Etudiants a risque",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { professor, logout } = useAuth();

  const tabs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Analytique", href: "/admin/analytics" },
  ];

  // Build breadcrumbs from pathname segments (skip if on /admin root)
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.length > 1
    ? segments.map((seg, i) => ({
        label: breadcrumbLabels[seg] || decodeURIComponent(seg),
        href: "/" + segments.slice(0, i + 1).join("/"),
        isLast: i === segments.length - 1,
      }))
    : [];

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <header className="bg-[var(--color-primary)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Emargement
          </h1>
          <div className="flex items-center gap-3">
            {professor && (
              <span className="text-sm text-white/80 hidden sm:inline">
                {professor.first_name} {professor.last_name}
              </span>
            )}
            <ThemeToggle />
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="bg-[var(--color-surface-card)] border-b border-[var(--color-border-light)] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const isActive = tab.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)] rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="max-w-6xl mx-auto px-4 py-2">
          <nav className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <span>/</span>}
                {crumb.isLast ? (
                  <span className="text-[var(--color-text)] font-medium">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-[var(--color-text)] transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}

      {children}
    </div>
  );
}
