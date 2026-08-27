import clsx from "clsx";
import { CheckCircle2, Clock, AlertCircle, Circle } from "lucide-react";

type Status = "paid" | "pending" | "overdue" | "neutral";

interface StatusPillProps {
  status: Status;
  label?: string;
  className?: string;
}

const config: Record<
  Status,
  { icon: React.ElementType; className: string; defaultLabel: string }
> = {
  paid:    { icon: CheckCircle2, className: "pill-success",  defaultLabel: "Paid"    },
  pending: { icon: Clock,        className: "pill-warning",  defaultLabel: "Pending" },
  overdue: { icon: AlertCircle,  className: "pill-danger",   defaultLabel: "Overdue" },
  neutral: { icon: Circle,       className: "pill-neutral",  defaultLabel: "N/A"     },
};

export default function StatusPill({ status, label, className }: StatusPillProps) {
  const { icon: Icon, className: base, defaultLabel } = config[status];
  return (
    <span className={clsx("pill", base, className)}>
      <Icon size={12} />
      {label ?? defaultLabel}
    </span>
  );
}
