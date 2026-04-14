import { cn } from "@/lib/utils";

/**
 * Fixed decorative layers (mesh + generated art + wash) behind app content.
 */
export function AppAmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className={cn(
          "absolute inset-0",
          "bg-[radial-gradient(ellipse_120%_85%_at_0%_-25%,oklch(0.72_0.12_195/0.38),transparent_58%)]",
          "dark:bg-[radial-gradient(ellipse_120%_85%_at_0%_-25%,oklch(0.42_0.14_200/0.45),transparent_55%)]"
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_100%_-10%,oklch(0.78_0.1_285/0.2),transparent_52%)] dark:opacity-70" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,oklch(0.82_0.06_195/0.14),transparent_55%)] dark:opacity-40"
      />
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center opacity-[0.2] mix-blend-soft-light",
          "dark:opacity-[0.12] dark:mix-blend-overlay"
        )}
        style={{
          backgroundImage: "url(/images/careport-ambient.png)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-background/90 to-background dark:from-background/55 dark:via-background/96 dark:to-background" />
    </div>
  );
}
