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
    <div className="rule-list">
      {days.map((d) => {
        const isToday = d.weekday === todayWeekday;
        return (
          <div
            key={d.weekday}
            className={
              "flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6"
            }
          >
            <div className="flex w-36 shrink-0 items-baseline gap-2">
              <span
                className={
                  isToday
                    ? "font-serif text-lg text-primary"
                    : "font-serif text-lg text-foreground"
                }
              >
                {WEEKDAY_NAMES[d.weekday - 1]}
              </span>
              {isToday && (
                <span className="text-[0.65rem] font-semibold tracking-[0.16em] text-gold-ink uppercase">
                  Today
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-[0.95rem]">
              {d.isClosed ? (
                <span className="text-muted">Closed</span>
              ) : d.main || d.sides.length > 0 ? (
                <span>
                  {d.main && (
                    <span className="font-serif text-lg text-foreground">
                      {d.main}
                    </span>
                  )}
                  {d.sides.length > 0 && (
                    <span className="font-serif text-muted italic">
                      {d.main ? " · " : ""}
                      {d.sides.join(" · ")}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted italic">Menu to be announced</span>
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
