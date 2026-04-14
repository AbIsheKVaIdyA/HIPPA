import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  Building2,
  ClipboardList,
  HeartPulse,
  Shield,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PORTALS, loginPathForSlug, type PortalSlug } from "@/lib/roles";
import { cn } from "@/lib/utils";

const iconFor: Record<PortalSlug, ReactNode> = {
  admin: <Shield className="size-6 text-white" />,
  doctor: <Stethoscope className="size-6 text-white" />,
  nurse: <HeartPulse className="size-6 text-white" />,
  "front-desk": <ClipboardList className="size-6 text-white" />,
  patient: <UserRound className="size-6 text-white" />,
  "partner-hospital": <Building2 className="size-6 text-white" />,
};

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="relative z-10 glass-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/20">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">CarePort</p>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Secure hospital access · role-separated portals
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="hidden shrink-0 border border-border/60 bg-secondary/80 backdrop-blur sm:inline-flex"
          >
            PHI-aware layout
          </Badge>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-14">
        <section className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-primary">Hospital workspace</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Choose your portal
          </h1>
          <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every card opens a dedicated sign-in for that team. Your credentials
            only unlock the portal that matches the role you were assigned—other
            areas stay off limits even if you try them from this page.
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {PORTALS.map((portal) => (
            <Card
              key={portal.slug}
              className={cn(
                "glass-surface transition duration-300",
                "hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
              )}
            >
              <CardHeader className="gap-4">
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md ring-1 ring-black/5 dark:ring-white/10",
                    portal.gradient
                  )}
                >
                  {iconFor[portal.slug]}
                </div>
                <div>
                  <CardTitle className="text-lg tracking-tight">{portal.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {portal.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-xs leading-relaxed text-muted-foreground">
                Sign-in is enforced by your account role. Wrong portal, wrong
                access—by design.
              </CardContent>
              <CardFooter className="border-t border-border/50 bg-muted/25 backdrop-blur-sm">
                <Link
                  href={loginPathForSlug(portal.slug)}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "w-full shadow-md shadow-primary/15"
                  )}
                >
                  Open portal
                </Link>
              </CardFooter>
            </Card>
          ))}
        </section>
      </main>

      <footer className="relative z-10 glass-header border-t py-8 text-center text-xs leading-relaxed text-muted-foreground">
        <p className="mx-auto max-w-xl px-4">
          Built for HIPAA-minded workflows—configure Supabase RLS, audit logging,
          and BAAs before handling real PHI.
        </p>
      </footer>
    </div>
  );
}
