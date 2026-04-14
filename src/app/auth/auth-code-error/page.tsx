"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { completeSessionFromUrl } from "@/lib/auth/complete-session-from-url";

/**
 * If the user landed here with tokens still in the hash (e.g. after an old
 * server-only callback), recover the session client-side.
 */
export default function AuthCodeErrorPage() {
  const router = useRouter();
  const tried = useRef(false);
  const [recovering, setRecovering] = useState(true);
  const [nextHint, setNextHint] = useState<string | null>(null);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;

    async function run() {
      if (typeof window === "undefined") return;

      setNextHint(new URLSearchParams(window.location.search).get("next"));

      const hasHashTokens =
        window.location.hash.includes("access_token") &&
        window.location.hash.includes("refresh_token");

      if (!hasHashTokens) {
        setRecovering(false);
        return;
      }

      const supabase = createClient();
      const result = await completeSessionFromUrl(
        supabase,
        window.location.href
      );

      if (result.ok) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
        router.replace(result.redirect);
        router.refresh();
        return;
      }

      setRecovering(false);
    }

    void run();
  }, [router]);

  if (recovering) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
        <span className="inline-flex size-6 animate-pulse rounded-full bg-primary/30" />
        Checking your link…
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <Card className="glass-surface w-full max-w-md border-border/40">
        <CardHeader>
          <CardTitle>Sign-in link issue</CardTitle>
          <CardDescription>
            This link is invalid or has expired. Request a new invite from your
            administrator or front desk, then try again from the email you
            receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextHint ? (
            <p className="text-xs text-muted-foreground">
              Intended redirect was lost; ask your admin to resend the invite.
            </p>
          ) : null}
          <Link href="/" className={cn(buttonVariants(), "w-full text-center")}>
            Back to portals
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
