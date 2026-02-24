"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Analytique", href: "/admin/analytics" },
  ];

  return (
    <div>
      {/* Tab navigation bar - sits below the page header */}
      <nav className="bg-[var(--color-surface-card)] border-b border-[var(--color-border-light)] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4">
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
      {children}
    </div>
  );
}
