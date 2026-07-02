import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Instagram } from "lucide-react";

type StatusKey = "pending_details" | "creating" | "warming_up" | "ready" | "cancelled";

const STATUS: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pending_details: { label: "Setup needed", dot: "bg-warning", text: "text-warning", bg: "bg-[color-mix(in_oklab,var(--color-warning)_15%,transparent)]" },
  creating: { label: "Creating", dot: "bg-[var(--color-purple-accent)]", text: "text-[var(--color-purple-accent)]", bg: "bg-[color-mix(in_oklab,var(--color-purple-accent)_15%,transparent)]" },
  warming_up: { label: "Warmup", dot: "bg-warning", text: "text-warning", bg: "bg-[color-mix(in_oklab,var(--color-warning)_15%,transparent)]" },
  ready: { label: "Active", dot: "bg-success", text: "text-success", bg: "bg-[color-mix(in_oklab,var(--color-success)_15%,transparent)]" },
  cancelled: { label: "Suspended", dot: "bg-destructive", text: "text-destructive", bg: "bg-[color-mix(in_oklab,var(--color-destructive)_15%,transparent)]" },
};

export function AccountCard({
  id,
  username,
  label,
  status,
  photo,
}: {
  id: string;
  username: string | null;
  label: string | null;
  status: string;
  photo: string | null;
}) {
  const meta = STATUS[status] ?? STATUS.pending_details;
  const display = username ? `@${username}` : label ?? "Instagram account";

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="soft-card group relative overflow-hidden"
    >
      {/* Ambient hover glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full ambient-cyan opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex items-start gap-4 p-5">
        <div className="relative">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full gradient-accent text-background ring-2 ring-hairline">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <Instagram className="h-5 w-5" />
            )}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-background ${meta.dot}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{display}</div>
          <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-5 py-3">
        <Link
          to="/dashboard/accounts/$id"
          params={{ id }}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-[var(--color-cyan-accent)]"
        >
          {status === "pending_details" ? "Finish setup" : status === "ready" ? "Open calendar" : "View status"}
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </motion.div>
  );
}

