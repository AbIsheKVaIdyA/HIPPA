"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { createClient } from "@/lib/supabase/client";
import { dashboardPathForRole, type UserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function gate() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setChecking(false);
    }
    void gate();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nextParam =
      typeof window !== "undefined"
        ? safeNextPath(
            new URLSearchParams(window.location.search).get("next")
          )
        : null;
    let target = nextParam;
    if (!target && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role) {
        target = dashboardPathForRole(profile.role as UserRole);
      }
    }
    if (!target) target = "/";

    toast.success("Password saved. You can sign in with this email and password next time.");
    router.replace(target);
    router.refresh();
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
        <span className="inline-flex size-6 animate-pulse rounded-full bg-primary/30" />
        Checking your session…
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <Card className="glass-surface w-full max-w-md border-border/40">
        <CardHeader>
          <CardTitle className="text-xl">Create your password</CardTitle>
          <CardDescription>
            Choose a password for this account. It is stored securely by
            Supabase Auth (hashed); use it whenever you sign in from your portal.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(ev) => setConfirm(ev.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t bg-muted/40">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Save and continue"}
            </Button>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full"
              )}
            >
              Cancel
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
