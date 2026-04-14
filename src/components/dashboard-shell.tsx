import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";

type DashboardShellProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function DashboardShell({
  title,
  description,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 glass-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Secure portal
            </p>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
              {description}
            </p>
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
