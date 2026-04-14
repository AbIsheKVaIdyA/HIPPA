import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <Card className="glass-surface w-full max-w-md border-border/40">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            Your account is not permitted to open this portal. Use the portal
            that matches the role you were assigned, or contact your
            administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/" className={cn(buttonVariants(), "w-full text-center")}>
            Back to portals
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
