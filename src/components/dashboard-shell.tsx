"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { isNavActive, type PortalNavItem } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  /** Shown under the CarePort mark in the sidebar (e.g. "Physician"). */
  portalLabel?: string;
  title: string;
  description?: string;
  navItems?: PortalNavItem[];
  children?: React.ReactNode;
};

const CONTENT_MAX =
  "mx-auto w-full max-w-[min(100%,92rem)] px-4 py-8 sm:px-6 lg:px-10 lg:py-10 pb-20";

export function DashboardShell({
  portalLabel,
  title,
  description,
  navItems,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const desc = description?.trim();
  const items = navItems ?? [];
  const showSidebar = items.length > 0;
  const hrefs = items.map((i) => i.href);

  return (
    <div className="flex min-h-screen">
      {showSidebar ? (
        <aside className="bg-sidebar/95 supports-[backdrop-filter]:bg-sidebar/80 sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 backdrop-blur-xl lg:flex">
          <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/20">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">CarePort</p>
              {portalLabel ? (
                <p className="truncate text-xs text-muted-foreground">{portalLabel}</p>
              ) : null}
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
            {items.map((item) => {
              const active = isNavActive(pathname, item.href, hrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1 border-t border-border/50 p-3">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-9 w-full justify-start text-muted-foreground"
              )}
            >
              All portals
            </Link>
            <SignOutButton className="w-full justify-center" />
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {showSidebar ? (
          <div className="flex gap-2 overflow-x-auto border-b border-border/50 bg-card/30 px-4 py-2 backdrop-blur-md lg:hidden">
            {items.map((item) => {
              const active = isNavActive(pathname, item.href, hrefs);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent bg-muted/50 text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        <header className="glass-header sticky top-0 z-20">
          <div
            className={cn(
              "flex max-w-[min(100%,92rem)] flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6 lg:items-center lg:px-10",
              showSidebar ? "lg:pl-8" : ""
            )}
          >
            <div className="min-w-0 space-y-1">
              {!showSidebar ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <Activity className="size-3.5 text-primary" />
                    CarePort
                  </span>
                  {portalLabel ? (
                    <span className="text-muted-foreground">· {portalLabel}</span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:hidden">
                  {portalLabel ?? "CarePort"}
                </p>
              )}
              <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                {title}
              </h1>
              {desc ? (
                <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {desc}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showSidebar ? (
                <>
                  <Link
                    href="/"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "lg:hidden")}
                  >
                    Home
                  </Link>
                  <SignOutButton className="lg:hidden" />
                </>
              ) : (
                <>
                  <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Home
                  </Link>
                  <SignOutButton />
                </>
              )}
            </div>
          </div>
        </header>

        <main className={CONTENT_MAX}>{children}</main>
      </div>
    </div>
  );
}
