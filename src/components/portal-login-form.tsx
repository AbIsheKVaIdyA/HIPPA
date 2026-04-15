"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { type PortalSlug, slugToRole } from "@/lib/roles";

type PortalLoginFormProps = {
  portalSlug: PortalSlug;
  portalTitle: string;
  portalDescription: string;
};

export function PortalLoginForm({
  portalSlug,
  portalTitle,
  portalDescription,
}: PortalLoginFormProps) {
  const router = useRouter();
  const expectedRole = useMemo(() => slugToRole(portalSlug), [portalSlug]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expectedRole) {
      toast.error("Unknown portal.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          portal_slug: portalSlug,
        }),
      });

      const raw = await res.text();
      let payload: {
        ok?: boolean;
        mfa_required?: boolean;
        challenge_id?: string;
        email_masked?: string;
        redirect?: string;
        error?: string;
      } = {};
      try {
        payload = raw ? (JSON.parse(raw) as typeof payload) : {};
      } catch {
        toast.error(
          res.status >= 500
            ? "Server error during sign-in. Check the terminal running `npm run dev`."
            : "Unexpected response from server."
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setLoading(false);
        toast.error(payload.error ?? "Sign-in failed");
        return;
      }

      if (payload.mfa_required && payload.challenge_id) {
        const q = new URLSearchParams({ challenge: payload.challenge_id });
        if (payload.email_masked) q.set("m", payload.email_masked);
        router.push(`/auth/mfa?${q.toString()}`);
        setLoading(false);
        return;
      }

      if (!payload.ok || !payload.redirect) {
        setLoading(false);
        toast.error(payload.error ?? "Sign-in failed");
        return;
      }

      router.push(payload.redirect);
      router.refresh();
      setLoading(false);
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : "Network error";
      toast.error(
        msg === "Failed to fetch"
          ? "Could not reach the server. Is `npm run dev` running on this machine?"
          : msg
      );
    }
  }

  return (
    <Card className="glass-surface border-border/40 shadow-2xl shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-xl">{portalTitle}</CardTitle>
        <CardDescription>{portalDescription}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@organization.org"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t bg-muted/40 py-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
