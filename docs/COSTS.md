# Costs

Every external service the code touches, what we use it for, the free limit, expected use, and what happens at the limit.

**Rule:** nothing here may need a card, until there is revenue to put on one. Limits were read from each provider's own pages on **20 November 2026**, not from memory, and are linked. Re-check them before each season: providers change free tiers without notice.

Usage figures marked *est.* are estimates, not measurements. They assume about 10 farmers per captain: 10 captains is roughly 110 users, and 100 captains roughly 1,100.

## The ledger

| Service | What for | Free limit (source) | 10 captains | 100 captains | At the limit |
|---|---|---|---|---|---|
| **Supabase** — database | Every field, job and profile | 500 MB per project ([pricing](https://supabase.com/pricing)) | < 5 MB *est.* | < 50 MB *est.* | Not stated for Free on the pricing page |
| **Supabase** — egress | Every sync pass | 5 GB / month ([pricing](https://supabase.com/pricing)) | < 0.5 GB *est.* | ~1 GB *est.* since incremental sync (entry 48); was ~5–10 GB | Not stated for Free on the pricing page |
| **Supabase** — auth | Phone sign-in | 50,000 monthly active users ([pricing](https://supabase.com/pricing)) | ~110 | ~1,100 | — |
| **Supabase** — edge functions | `notify-dispatch`, one call per dispatched job | 500,000 invocations / month ([pricing](https://supabase.com/pricing)) | < 1,000 | < 10,000 | — |
| **Supabase** — projects | One project | 2 active; **paused after 1 week of inactivity** ([pricing](https://supabase.com/pricing)) | — | — | Paused project: the app cannot sync until you unpause it in the dashboard. Out of season, check weekly. |
| **Supabase** — backups | — | **None on Free.** Daily backups are Pro and above ([backups](https://supabase.com/docs/guides/platform/backups)) | Our nightly job instead: [BACKUP_AND_RESTORE](BACKUP_AND_RESTORE.md) | | |
| **SMS** for sign-in codes | — | Not used. Captains get a fixed code you set in the dashboard ([ONBOARDING_A_CAPTAIN](ONBOARDING_A_CAPTAIN.md)). Free does not say it sends SMS itself; a provider would be a paid third party. | — | — | **Not your call to make alone:** listed in the brief as a decision for later |
| **Expo push** (`exp.host`) | Ringing a captain for a job | Free to send. 600 notifications/second per project, 100 per request ([sending](https://docs.expo.dev/push-notifications/sending-notifications/)). The page states no price and no SLA. | ~1 per job | ~1 per job | 429 error, so retry. We send ≤ 5 per job. |
| **Firebase Cloud Messaging** | Required by Expo push to reach **Android** | Not checked | — | — | ⚠️ **Not set up.** Remote pings cannot reach an Android phone until a Firebase project's FCM credentials are uploaded to Expo. It is a separate Google account, so it is flagged here, not created. Until then only the on-device ping works. |
| **Expo Update** (`u.expo.dev`) | JS updates over the air | 1,000 monthly active users, 100 GiB bandwidth, unlimited updates ([pricing](https://expo.dev/pricing)) | ~110 | **~1,100 — over** | "The Free plan has no update overage pricing; it is limited to its included monthly active users." Phones beyond 1,000 keep the code they have. The second limit we hit. |
| **Expo Build** | — | 15 Android builds / month ([pricing](https://expo.dev/pricing)) | 0 | 0 | Not used: APKs are built on your machine ([SIGNING_AND_RELEASE](SIGNING_AND_RELEASE.md)) |
| **Google Maps SDK for Android** | Satellite map for drawing fields | Map loads **without a map ID: unlimited, free** (SKU "Maps SDK"). With a map ID it becomes "Dynamic Maps", 10,000 free then $7 per 1,000 ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)). | — | — | **Never add a map ID** without reading this row. Whether the key needs a billing account is not stated on those pages. It is part of the setup step that is still pending. |
| **GitHub** — Actions | CI on every push, nightly backup | $12 / month of compute, about 2,000 standard Linux minutes ([billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)) | ~300 min *est.* | ~300 min *est.* | With no card on file: "usage is blocked", not billed. CI stops until the month resets. |
| **GitHub** — artifact storage | 30 nightly backups | 500 MB, shared with Packages ([billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)) | < 5 MB | < 100 MB *est.* | Cut `retention-days` in `backup.yml` |
| **APK download host** | `app_config.latest_apk_url` | **Not chosen.** A private GitHub repo's release files need a GitHub login, so captains cannot download from there. | — | — | Decision for you. Until then, update by cable, or rely on over-the-air JS updates. |

GitHub minutes, measured: a CI run is 4 jobs of 1–2 minutes each, billed per job rounded up, so about 5 minutes per push. At 50 pushes a month that is ~250 minutes; the nightly backup is ~60. Both are well under 2,000.

## The first thing that breaks

**Was:** Supabase egress, because every sync pass re-downloaded every field and job. **Fixed in entry 48:** a pass now downloads only rows changed since the last one. Measured at 879 bytes for an idle pass, against about 880 bytes *per job ever held* before.

**Now:** Expo Update's **1,000 monthly active users** is the first free limit, at around 100 captains with their farmers. Beyond it, phones simply keep the JavaScript they have. That means a plan change, or self-hosting updates. Egress is worth re-measuring in the Supabase dashboard after the first real week.

## Not verified

- **Behaviour at the Supabase Free limits.** The pricing page does not say whether exceeding a Free limit blocks, restricts or pauses.
- **Firebase/FCM limits and sign-up terms.** Not read, because it is not set up.
- **Whether a Google Maps API key needs a billing account.** The pages read do not say.
- Every *est.* figure. These get replaced with dashboard numbers after the first real week.
