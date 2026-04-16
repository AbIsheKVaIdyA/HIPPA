"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TimelineEvent = {
  at: string;
  kind: string;
  title: string;
  detail?: string;
  meta?: Record<string, string>;
};

type VisitBlock = {
  caseId: string;
  createdAt: string;
  isFollowUp: boolean;
  healthIssue: string | null;
  doctorName: string;
  vitals: { at: string; payload: Record<string, string> }[];
  notes: { at: string; authorName: string; body: string }[];
  files: { id: string; name: string; at: string }[];
};

export function PatientCareDashboard() {
  const [data, setData] = useState<{
    patientName: string;
    visits: VisitBlock[];
    timeline: TimelineEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/patient/my-care");
      const j = (await res.json()) as {
        patientName?: string;
        visits?: VisitBlock[];
        timeline?: TimelineEvent[];
        error?: string;
      };
      if (res.ok) {
        setData({
          patientName: j.patientName ?? "",
          visits: j.visits ?? [],
          timeline: j.timeline ?? [],
        });
      } else {
        setData(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-sm text-muted-foreground backdrop-blur-sm">
        <span className="inline-flex size-6 animate-pulse rounded-full bg-primary/35" />
        Loading your care record…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-surface rounded-2xl border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Could not load your care timeline.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="glass-surface rounded-2xl border-border/40 bg-gradient-to-br from-primary/8 via-card/80 to-transparent p-8">
        <p className="text-sm font-medium text-primary">Welcome back</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          {data.patientName || "Patient"}
        </h2>
      </div>

      <section className="space-y-5">
        <h3 className="page-section-title">Activity timeline</h3>
        <ol className="relative space-y-4 border-s border-border ps-6">
          {data.timeline.length === 0 ? (
            <li className="text-sm text-muted-foreground">No activity yet.</li>
          ) : (
            [...data.timeline].reverse().map((ev, i) => (
              <li key={`${ev.at}-${i}`} className="relative">
                <span className="absolute -start-[25px] mt-1.5 size-3 rounded-full border-2 border-primary bg-background" />
                <Card className="glass-surface border-border/40">
                  <CardHeader className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium">{ev.title}</CardTitle>
                      <Badge variant="outline" className="text-xs font-normal">
                        {new Date(ev.at).toLocaleString()}
                      </Badge>
                    </div>
                    {ev.kind === "vitals" && ev.meta ? (
                      <CardDescription className="text-xs">
                        {Object.entries(ev.meta)
                          .filter(([k, v]) => v && k !== "recordedAt")
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  {ev.detail ? (
                    <CardContent className="pt-0">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {ev.detail}
                      </p>
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            ))
          )}
        </ol>
      </section>

      <section className="space-y-5">
        <h3 className="page-section-title">Visits</h3>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.visits.map((v) => (
            <Card
              key={v.caseId}
              className="glass-surface overflow-hidden border-border/40"
            >
              <CardHeader className="border-b border-border/40 bg-muted/25 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {v.isFollowUp ? "Follow-up visit" : "Visit"}
                  </CardTitle>
                  {v.isFollowUp ? (
                    <Badge variant="secondary">2nd+</Badge>
                  ) : (
                    <Badge>New</Badge>
                  )}
                </div>
                <CardDescription>
                  {new Date(v.createdAt).toLocaleString()} · {v.doctorName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-sm">
                {v.healthIssue ? (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Reason for visit
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                      {v.healthIssue}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Vitals ({v.vitals.length})
                  </p>
                  <ul className="mt-1 space-y-2 text-muted-foreground">
                    {v.vitals.length === 0 ? (
                      <li className="text-xs">None yet.</li>
                    ) : (
                      v.vitals.map((x, idx) => (
                        <li key={idx} className="rounded-md border bg-background/50 px-2 py-1 text-xs">
                          <span className="text-foreground">
                            {new Date(x.at).toLocaleString()}
                          </span>
                          <br />
                          {Object.entries(x.payload)
                            .filter(([k, val]) => val && k !== "recordedAt")
                            .map(([k, val]) => `${k}: ${val}`)
                            .join(" · ")}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Notes ({v.notes.length})
                  </p>
                  <ul className="mt-1 space-y-2">
                    {v.notes.map((n, idx) => (
                      <li key={idx} className="rounded-md border px-2 py-2 text-xs">
                        <span className="font-medium text-foreground">{n.authorName}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {new Date(n.at).toLocaleString()}
                        </span>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {n.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Files ({v.files.length})
                  </p>
                  <ul className="mt-1 space-y-1">
                    {v.files.map((f) => (
                      <li key={f.id}>
                        <Link
                          href="#"
                          className={cn(
                            buttonVariants({ variant: "link", size: "sm" }),
                            "h-auto px-0 py-0 text-xs"
                          )}
                          onClick={async (e) => {
                            e.preventDefault();
                            const res = await fetch(
                              `/api/patient-cases/${v.caseId}/attachments/${f.id}`
                            );
                            const j = (await res.json()) as { url?: string };
                            if (j.url) window.open(j.url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          {f.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href={`/dashboard/patient/cases/${v.caseId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
                >
                  Open full visit
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
