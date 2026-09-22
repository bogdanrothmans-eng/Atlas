import type { ReactNode } from "react";

import { Brand } from "@/components/Brand";
import { Badge } from "@/components/ui/badge";

export function AccountShell({
  badge,
  children,
}: {
  badge: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col">
      <header className="bg-background flex h-14 items-center gap-3 border-b px-4 sm:px-6">
        <Brand />
        <Badge variant="secondary">{badge}</Badge>
      </header>
      <main className="flex flex-1 items-start justify-center p-4 sm:items-center sm:p-6">
        {children}
      </main>
    </div>
  );
}
