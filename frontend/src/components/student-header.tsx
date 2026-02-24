"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

interface StudentHeaderProps {
  title?: string;
  showBack?: boolean;
}

export function StudentHeader({ title, showBack }: StudentHeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <header className="bg-[var(--color-primary)] text-white sticky top-0 z-40">
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => router.push("/student")}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              {title || "Emargement"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white/90">
                  {user.first_name} {user.last_name}
                </p>
              </div>
            )}
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Quitter
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
