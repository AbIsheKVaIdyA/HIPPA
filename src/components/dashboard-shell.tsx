import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";

type DashboardShellProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function DashboardShell({
  title,
  description,
  children,
}: DashboardShellProps) {
  const desc = description?.trim();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 glass-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {desc ? (
              <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
                {desc}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Home
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 pb-16">{children}</main>
    </div>
  );
}
