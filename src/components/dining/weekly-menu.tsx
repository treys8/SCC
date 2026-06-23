const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type WeeklyDay = {
  weekday: number; // 1=Mon … 7=Sun
  isClosed: boolean;
  note: string | null;
  main: string | null;
  sides: string[];
};

/**
 * Read-only view of the recurring weekly lunch buffet (the chef's main + sides
 * per day) for the Dining page, with the club's current day highlighted. Closed
 * days are shown so the buffet's run (Tue–Fri) reads at a glance.
 */
export function WeeklyMenu({
  days,
  todayWeekday,
}: {
  days: WeeklyDay[];
  todayWeekday: number;
}) {
  if (days.length === 0) return null;
  return (
    <div className="card divide-y divide-border overflow-hidden">
      {days.map((d) => {
        const isToday = d.weekday === todayWeekday;
        return (
          <div
            key={d.weekday}
            className={
              "flex items-baseline gap-4 px-4 py-3 sm:px-5" +
              (isToday ? " bg-primary/[0.04]" : "")
            }
          >
            <div className="w-28 shrink-0 text-sm font-medium text-foreground">
              {WEEKDAY_NAMES[d.weekday - 1]}
              {isToday && (
                <span className="ml-1.5 text-caption font-medium text-accent-600">
                  Today
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              {d.isClosed ? (
                <span className="text-muted">Closed</span>
              ) : d.main || d.sides.length > 0 ? (
                <span>
                  {d.main && (
                    <span className="font-medium text-foreground">{d.main}</span>
                  )}
                  {d.sides.length > 0 && (
                    <span className="text-muted">
                      {d.main ? " · " : ""}
                      {d.sides.join(" · ")}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted">Menu to be announced</span>
              )}
              {d.note && (
                <p className="mt-0.5 text-caption text-muted">{d.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
