"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function MfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge")?.trim() ?? "";
  const emailMasked = searchParams.get("m")?.trim() ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!challengeId) {
      toast.error("Missing verification session. Sign in again.");
      router.replace("/");
    }
  }, [challengeId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    const digits = code.replace(/\D/g, "").slice(0, 6);
    if (digits.length !== 6) {
      toast.error("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/verify-mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId, otp: digits }),
    });

    const payload = (await res.json()) as {
      ok?: boolean;
      redirect?: string;
      error?: string;
    };

    if (!res.ok || !payload.ok || !payload.redirect) {
      setLoading(false);
      toast.error(payload.error ?? "Verification failed");
      if (res.status === 410 || res.status === 423) {
        router.replace("/");
      }
      return;
    }

    router.push(payload.redirect);
    router.refresh();
    setLoading(false);
  }

  if (!challengeId) {
    return null;
  }

  return (
    <Card className="glass-surface mx-auto w-full max-w-md border-border/40 shadow-2xl shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-xl">Check your email</CardTitle>
        <CardDescription>
          We sent a 6-digit code
          {emailMasked ? ` to ${emailMasked}` : " to your inbox"}. Enter it below to
          finish signing in.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification code</Label>
            <Input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="font-mono text-lg tracking-widest"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t bg-muted/40 py-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Continue"}
          </Button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "default" }), "w-full")}
          >
            Cancel and return home
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function MfaPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <p className="text-muted-foreground text-sm">Loading verification…</p>
        }
      >
        <MfaVerifyForm />
      </Suspense>
    </div>
  );
}
