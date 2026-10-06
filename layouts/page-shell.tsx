import type { ReactNode } from "react";

export function PageShell({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return aside ? (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      <section className="min-w-0 space-y-4 lg:col-span-2">{children}</section>
      <aside className="min-w-0 space-y-4">{aside}</aside>
    </div>
  ) : (
    <section className="space-y-4">{children}</section>
  );
}
