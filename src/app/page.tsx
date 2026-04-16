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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <div className="mx-auto flex max-w-[min(100%,92rem)] items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/20">
              <Activity className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight">CarePort</p>
              <p className="text-sm text-muted-foreground">Hospital access &amp; role portals</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[min(100%,92rem)] flex-1 flex-col gap-16 px-5 py-16 sm:px-8 lg:gap-20 lg:px-12 lg:py-20">
        <section className="max-w-3xl space-y-5">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Choose your portal
          </h1>
          <p className="text-pretty text-lg text-muted-foreground sm:text-xl">
            Sign in to the workspace that matches your role. Each portal is separated for privacy and
            compliance.
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

      <footer className="relative z-10 glass-header border-t py-6" />
    </div>
  );
}
