"use client";
import Link from "next/link";
import type { Course } from "@/hooks/use-courses";

export function CourseCard({ course }: { course: Course }) {
  const start = new Date(course.start_time);
  const end = new Date(course.end_time);
  const now = new Date();
  const isActive = now >= start && now <= end;
  const isPast = now > end;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border transition-all duration-300 course-card-hover
        ${
          isActive
            ? "border-[var(--color-accent)] bg-[var(--color-surface-elevated)] shadow-md"
            : isPast
              ? "border-[var(--color-border-light)] bg-[var(--color-surface-card)] opacity-70"
              : "border-[var(--color-border)] bg-[var(--color-surface-card)] hover:shadow-md hover:border-[var(--color-accent)]/50"
        }
      `}
    >
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)]" />
      )}

      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3
            className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-text)] leading-tight"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {course.name}
          </h3>
          {isActive && (
            <span className="shrink-0 ml-3 text-[11px] font-semibold uppercase tracking-wider bg-[var(--color-accent)] text-white px-2.5 py-1 rounded-full">
              En cours
            </span>
          )}
          {isPast && (
            <span className="shrink-0 ml-3 text-[11px] font-semibold uppercase tracking-wider bg-[var(--color-text-muted)] text-white px-2.5 py-1 rounded-full">
              Termine
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)] mb-1">
          <span className="flex items-center gap-1.5">
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatTime(start)} &mdash; {formatTime(end)}
          </span>
          <span className="flex items-center gap-1.5">
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
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Salle {course.room}
          </span>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {course.student_count} etudiant{course.student_count > 1 ? "s" : ""}{" "}
          inscrit{course.student_count > 1 ? "s" : ""}
        </p>

        <Link
          href={`/course/${course.id}`}
          className={`
            inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200
            ${
              isPast
                ? "bg-[var(--color-border-light)] text-[var(--color-text-muted)] cursor-default pointer-events-none"
                : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] active:scale-[0.97]"
            }
          `}
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
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          Faire l&apos;appel
        </Link>
      </div>
    </div>
  );
}
