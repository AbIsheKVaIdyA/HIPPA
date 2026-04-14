"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserRole } from "@/lib/roles";
import { loginPathForRole } from "@/lib/roles";

const STAFF_ROLES: { value: UserRole; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "front_desk", label: "Front desk" },
];

export function InviteStaffForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("doctor");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/invites/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, role }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Invite failed.");
        return;
      }
      const login = loginPathForRole(role);
      toast.success("Invite sent", {
        description: `They will open the email link, set a password, then reach their portal. Later they sign in at ${login}.`,
      });
      setEmail("");
      setFullName("");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass-surface border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Invite staff</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <p className="sr-only" aria-live="polite">
              Selected role:{" "}
              {STAFF_ROLES.find((r) => r.value === role)?.label ?? role}
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Invite role"
            >
              {STAFF_ROLES.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  size="sm"
                  variant={role === r.value ? "default" : "outline"}
                  aria-pressed={role === r.value}
                  onClick={() => setRole(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-email">Work email</Label>
            <Input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="colleague@hospital.org"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-name">Full name</Label>
            <Input
              id="staff-name"
              required
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              placeholder="Jordan Lee"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/40">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Sending…" : "Send invite"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
