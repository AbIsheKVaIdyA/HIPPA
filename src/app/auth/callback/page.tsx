"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { completeSessionFromUrl } from "@/lib/auth/complete-session-from-url";

export default function AuthCallbackPage() {
  const router = useRouter();
  const ran = useRef(false);
  const [hint, setHint] = useState("Completing sign-in…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      if (typeof window === "undefined") return;

      const supabase = createClient();
      const href = window.location.href;

      const result = await completeSessionFromUrl(supabase, href);
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

      setHint("Redirecting…");
      const next = new URL(window.location.href).searchParams.get("next");
      const qs =
        next && next.startsWith("/") && !next.startsWith("//")
          ? `?next=${encodeURIComponent(next)}`
          : "";
      router.replace(`/auth/auth-code-error${qs}`);
    }

    void run();
  }, [router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
      <p>{hint}</p>
    </div>
  );
}
