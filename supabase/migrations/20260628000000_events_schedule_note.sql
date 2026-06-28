-- A staff-typed status string surfaced in the member-facing "Upcoming on the
-- course" schedule on the Golf facility page — e.g. "Field full · 162/162",
-- "Registration opens Jul 21", "Course closed". Free text, not capacity
-- tracking (GolfGenius owns real registration counts).
alter table calendar_events add column schedule_note text;
