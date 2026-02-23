"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useNotifications,
  useUnreadCount,
  markAsRead,
  markAllAsRead,
} from "@/hooks/use-notifications";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD}j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { notifications, mutate: mutateNotifs } = useNotifications();
  const { count, mutate: mutateCount } = useUnreadCount();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    mutateNotifs();
    mutateCount();
  };

  const handleNotifClick = async (notif: {
    id: string;
    type: string;
    is_read: boolean;
    record_id?: string;
  }) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
      mutateNotifs();
      mutateCount();
    }
    if (notif.type === "signature_request" && notif.record_id) {
      setOpen(false);
      router.push(`/student/sign/${notif.record_id}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-[var(--color-danger)] text-white rounded-full px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-[var(--color-surface-card)] rounded-2xl shadow-lg border border-[var(--color-border-light)] z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-light)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Notifications
            </h3>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-light)] font-medium transition-colors"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Aucune notification
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-[var(--color-surface)] transition-colors ${
                    !notif.is_read ? "bg-[var(--color-accent)]/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notif.is_read && (
                      <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                    )}
                    <div className={notif.is_read ? "pl-5" : ""}>
                      <p className="text-sm font-medium text-[var(--color-text)] leading-tight">
                        {notif.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
