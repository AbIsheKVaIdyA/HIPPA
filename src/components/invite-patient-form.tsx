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
import { loginPathForRole } from "@/lib/roles";

export function InvitePatientForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/invites/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Invite failed.");
        return;
      }
      const login = loginPathForRole("patient");
      toast.success("Patient invite sent", {
        description: `Same steps as staff: email link → set password → patient dashboard. Later they sign in at ${login}.`,
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite patient</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient-email">Patient email</Label>
            <Input
              id="patient-email"
              type="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="patient@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient-name">Legal name</Label>
            <Input
              id="patient-name"
              required
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              placeholder="Alex Rivera"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/40">
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? "Sending…" : "Send patient invite"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
