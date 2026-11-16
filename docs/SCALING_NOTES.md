# Scaling notes

One line per task: **what would break first at 100,000 users.** Recorded, not
fixed. The point is that the choice was seen, not that it was solved.

| Task | What breaks first at 100,000 users |
|---|---|
| Stage 1.1 — `app_config` version row | Nothing in the table itself: one row, read once per app start. What breaks is the **download link** — `latest_apk_url` points at a single host serving a ~70 MB file, so a release day is 100,000 × 70 MB of egress from whatever is behind that URL. The row is fine; the thing it points at is not. |
