import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function PageBanner({
  title,
  description,
  image,
  children,
}: {
  title: string;
  description: string;
  image: string;
  children?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <img src={image} alt="" className="h-32 w-full object-cover" />
      <CardContent className="space-y-3 py-5">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}
