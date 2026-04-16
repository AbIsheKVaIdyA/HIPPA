import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PortalLoginForm } from "@/components/portal-login-form";
import { PORTALS, type PortalSlug } from "@/lib/roles";
import { cn } from "@/lib/utils";

function isPortalSlug(value: string): value is PortalSlug {
  return PORTALS.some((p) => p.slug === value);
}

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal: portalParam } = await params;
  if (!isPortalSlug(portalParam)) {
    notFound();
  }

  const portal = PORTALS.find((p) => p.slug === portalParam)!;

  return (
    <div className="relative flex min-h-screen flex-col lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,28rem)]">
      <div className="login-hero-panel relative z-10 hidden flex-col justify-between border-b border-border/50 p-10 lg:flex lg:border-b-0 lg:border-r lg:p-12 xl:p-16">
        <div>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-10 inline-flex w-fit items-center gap-2 px-0 text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowLeft className="size-4" />
            All portals
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/20">
              <Activity className="size-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">CarePort</p>
              <p className="text-sm text-muted-foreground">{portal.title}</p>
            </div>
          </div>
          <h1 className="mt-10 max-w-md text-balance text-3xl font-semibold tracking-tight xl:text-4xl">
            {portal.title}
          </h1>
          <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground">
            {portal.description}
          </p>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          Use the credentials provided by your organization. Sessions are secured and audited.
        </p>
      </div>

      <div className="login-form-panel relative z-10 flex flex-1 flex-col justify-center px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
        <div className="mx-auto w-full max-w-md space-y-8 lg:mx-0">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "inline-flex items-center gap-2 px-0 text-muted-foreground hover:text-foreground lg:hidden"
            )}
          >
            <ArrowLeft className="size-4" />
            All portals
          </Link>
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              <span className="font-semibold">CarePort</span>
            </div>
            <p className="text-sm text-muted-foreground">{portal.title}</p>
          </div>
          <PortalLoginForm
            portalSlug={portal.slug}
            portalTitle={`${portal.title} portal`}
            portalDescription={portal.description}
          />
        </div>
      </div>
    </div>
  );
}
