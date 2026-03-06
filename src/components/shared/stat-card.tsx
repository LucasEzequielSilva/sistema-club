import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type StatVariant = "default" | "success" | "danger" | "warning" | "info" | "muted";

interface TrendProps {
  value: number;
  isPositive: boolean;
  label?: string;
}

interface StatCardProps {
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: StatVariant;
  className?: string;
  trend?: TrendProps;
}

const variantStyles: Record<StatVariant, { icon: string; value: string; bg: string; iconBg: string }> = {
  default: {
    bg: "bg-card border border-border",
    iconBg: "bg-muted",
    icon: "text-muted-foreground",
    value: "text-foreground",
  },
  success: {
    bg: "bg-card border border-border",
    iconBg: "bg-[var(--success-muted)]",
    icon: "text-[var(--success-muted-foreground)]",
    value: "text-[var(--success-muted-foreground)]",
  },
  danger: {
    bg: "bg-card border border-border",
    iconBg: "bg-[var(--danger-muted)]",
    icon: "text-[var(--danger-muted-foreground)]",
    value: "text-[var(--danger-muted-foreground)]",
  },
  warning: {
    bg: "bg-card border border-border",
    iconBg: "bg-[var(--warning-muted)]",
    icon: "text-[var(--warning-muted-foreground)]",
    value: "text-[var(--warning-muted-foreground)]",
  },
  info: {
    bg: "bg-card border border-border",
    iconBg: "bg-[var(--info-muted)]",
    icon: "text-[var(--info-muted-foreground)]",
    value: "text-[var(--info-muted-foreground)]",
  },
  muted: {
    bg: "bg-muted/50 border border-border",
    iconBg: "bg-background",
    icon: "text-muted-foreground",
    value: "text-muted-foreground",
  },
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = "default", className, trend }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("rounded-xl p-4 flex flex-col gap-3", styles.bg, className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground leading-none">{title}</p>
        {Icon && (
          <div className={cn("p-1.5 rounded-lg", styles.iconBg)}>
            <Icon className={cn("w-3.5 h-3.5", styles.icon)} />
          </div>
        )}
      </div>
      <div>
        <div className={cn("text-2xl font-bold tracking-tight", styles.value)}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium mt-1.5",
            trend.isPositive
              ? "text-green-600 bg-green-50"
              : "text-red-600 bg-red-50"
          )}>
            {trend.isPositive ? "▲" : "▼"} {Math.abs(trend.value).toFixed(1)}%
            {trend.label && <span className="text-[10px] opacity-70 ml-0.5">{trend.label}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
