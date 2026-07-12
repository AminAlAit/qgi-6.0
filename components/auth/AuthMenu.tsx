"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import type { Route } from "next";
import { LogIn, LogOut } from "lucide-react";

/**
 * Sidebar auth control: shows the signed-in email + a sign-out button, or a
 * sign-in link when signed out. Collapses to icon-only in the narrow rail.
 * (SKIP_AUTH=true makes the session empty, so this shows "Sign in" until auth
 * is actually enforced.)
 */
export function AuthMenu({ collapsed }: { collapsed?: boolean }) {
  const { data: session, status } = useSession();
  if (status === "loading") return null;
  const email = session?.user?.email ?? null;

  if (!email) {
    return (
      <Link
        href={"/login" as Route}
        title="Sign in"
        aria-label="Sign in"
        className={`mx-2 mb-1 flex items-center gap-2 rounded px-3 py-2 text-[11px] tracking-widest uppercase transition-colors hover:bg-[var(--qgi-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)] ${
          collapsed ? "justify-center" : ""
        }`}
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <LogIn size={15} strokeWidth={1.5} aria-hidden="true" />
        {!collapsed && <span>Sign in</span>}
      </Link>
    );
  }

  return (
    // In the collapsed rail the email row is hidden, so carry it as a tooltip
    // on the wrapper — the user can still confirm which account is signed in.
    <div className="mx-2 mb-1" title={collapsed ? email : undefined}>
      {!collapsed && (
        <div
          className="px-3 pb-1 text-[10.5px] truncate"
          style={{ color: "var(--qgi-text-dim)" }}
          title={email}
        >
          {email}
        </div>
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        title="Sign out"
        aria-label="Sign out"
        className={`flex w-full items-center gap-2 rounded px-3 py-2 text-[11px] tracking-widest uppercase transition-colors hover:bg-[var(--qgi-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qgi-accent)] cursor-pointer ${
          collapsed ? "justify-center" : ""
        }`}
        style={{
          color: "var(--qgi-text-muted)",
          background: "transparent",
          border: "none",
        }}
      >
        <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
        {!collapsed && <span>Sign out</span>}
      </button>
    </div>
  );
}
