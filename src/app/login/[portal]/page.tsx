import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="relative z-10 w-full max-w-md space-y-8">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex items-center gap-2 px-0 text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          All portals
        </Link>
        <PortalLoginForm
          portalSlug={portal.slug}
          portalTitle={`${portal.title} portal`}
          portalDescription={portal.description}
        />
      </div>
    </div>
  );
}
