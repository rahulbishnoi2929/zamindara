# Scaling notes

One line per task: **what would break first at 100,000 users.** Recorded, not
fixed. The point is that the choice was seen, not that it was solved.

| Task | What breaks first at 100,000 users |
|---|---|
| Stage 1.1 — `app_config` version row | Nothing in the table itself: one row, read once per app start. What breaks is the **download link** — `latest_apk_url` points at a single host serving a ~70 MB file, so a release day is 100,000 × 70 MB of egress from whatever is behind that URL. The row is fine; the thing it points at is not. |
| Stage 1.1 — signed release APK | Now 43 MB after dropping the emulator architectures. At 100,000 users the problem is not the build, it is that **every one of them downloads 43 MB over mobile data from one host** on each native release. Per-architecture splits would halve it again (an arm64 phone does not need the armeabi-v7a copy), and minification would take most of the remaining 29 MB of dex. Both are the same fix at 10 users as at 100,000. |
