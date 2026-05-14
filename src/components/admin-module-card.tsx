"use client";

import {
  Building2,
  ClipboardList,
  MessageSquare,
  PlusCircle,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Building2,
  ClipboardList,
  UtensilsCrossed,
  PlusCircle,
  MessageSquare,
  Users,
};

export type ModuleCardConfig = {
  href: string;
  title: string;
  description: string;
  iconKey: keyof typeof ICONS;
  featured?: boolean;
  badgeCount?: number;
};

type Props = {
  module: ModuleCardConfig;
};

export function AdminModuleCard({ module }: Props) {
  const Icon = ICONS[module.iconKey] ?? Building2;
  const featured = Boolean(module.featured);

  return (
    <Link href={module.href} className={cn("group block h-full", featured && "md:col-span-2")}>
      <Card
        className={cn(
          "h-full border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5 transition duration-200",
          "hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-900/10",
          featured && "border-emerald-200/80 ring-emerald-500/15 md:min-h-[11rem]",
        )}
      >
        <CardHeader className={cn("pb-2 pt-4", featured && "md:flex md:flex-row md:items-start md:gap-4")}>
          <div
            className={cn(
              "mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white",
              featured && "md:h-14 md:w-14 md:rounded-2xl",
            )}
          >
            <Icon className={cn("h-5 w-5", featured && "md:h-7 md:w-7")} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className={cn("text-base leading-tight", featured && "md:text-lg")}>{module.title}</CardTitle>
              {module.badgeCount != null && module.badgeCount > 0 ? (
                <Badge variant="secondary" className="bg-amber-100 text-[10px] font-bold text-amber-900">
                  {module.badgeCount > 99 ? "99+" : module.badgeCount}
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-xs leading-snug text-slate-600">{module.description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-4 pt-0">
          <span className="text-xs font-semibold text-blue-700 group-hover:underline">Modüle git →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
