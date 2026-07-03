import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CalendarPost = {
  id: string;
  scheduled_at: string;
  caption: string;
  account_label?: string | null;
  bunny_video_id?: string | null;
  bunny_library_id?: string | null;
  thumbnail_url?: string | null;
};

export function CalendarGrid({
  posts,
  onCreate,
  onEditPost,
}: {
  posts: CalendarPost[];
  onCreate: (date: Date) => void;
  onEditPost?: (post: CalendarPost) => void;
}) {
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(new Date()));
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveringPost, setHoveringPost] = useState(false);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor));
    const end = endOfWeek(endOfMonth(monthAnchor));
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [monthAnchor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const p of posts) {
      const key = format(new Date(p.scheduled_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  return (
    <div className="soft-card overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setMonthAnchor((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center text-sm font-semibold">
            {format(monthAnchor, "MMMM yyyy")}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setMonthAnchor((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => setMonthAnchor(startOfMonth(new Date()))}>
          Today
        </Button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-hairline bg-surface-2/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = isSameMonth(d, monthAnchor);
          const key = format(d, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(d, new Date());
          const isHovered = hovered === key;

          return (
            <div
              key={d.toISOString()}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
              className={`group relative min-h-[7.5rem] cursor-pointer border-b border-r border-hairline p-2.5 transition ${
                inMonth ? "bg-background" : "bg-surface-2/30 text-muted-foreground/50"
              } hover:bg-surface-2/60`}
              onClick={() => onCreate(d)}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-medium ${
                    isToday
                      ? "gradient-accent text-background shadow-[0_4px_12px_-4px_var(--color-cyan-accent)]"
                      : "text-foreground/80"
                  }`}
                >
                  {format(d, "d")}
                </span>
                {dayPosts.length > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
                    {dayPosts.length}
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1">
                {dayPosts.slice(0, 2).map((p) => (
                  <div
                    key={p.id}
                    className="truncate rounded-md border border-hairline bg-surface px-1.5 py-1 text-[11px] text-foreground/80"
                  >
                    <span className="mr-1 font-medium text-[var(--color-cyan-accent)]">
                      {format(new Date(p.scheduled_at), "HH:mm")}
                    </span>
                    {p.caption?.slice(0, 22) || "Video post"}
                  </div>
                ))}
                {dayPosts.length > 2 && (
                  <div className="pl-1 text-[10px] text-muted-foreground">+{dayPosts.length - 2} more</div>
                )}
              </div>

              <AnimatePresence>
                {isHovered && inMonth && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 grid place-items-center"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]">
                      <Plus className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
