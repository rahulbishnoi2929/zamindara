# Stage 5 — notifications: design note

Written 20 Nov 2026, before any code, as the brief asks. Waiting for the founder's OK.

## What the brief asks

1. Detect whether a full-screen intent is allowed on this device. If not, fall back to a high-priority heads-up alert and deep-link to the setting.
2. Add a "phone setup" screen to captain onboarding: full-screen permission, battery optimisation off, autostart on, and a test ping at the end.
3. No voice or SMS provider.

## What the code can and cannot do today

- **No full-screen notification exists yet, and none can be added without native code.** The job ping is a maximum-priority heads-up on its own channel, which can ring through Do Not Disturb when `loud_ping` is on.
  - `expo-notifications` has no full-screen intent option (checked in `node_modules/expo-notifications`).
  - Pushes from the server arrive through Expo's own Firebase handler, which can't show one either.
  - A real "incoming call" screen over the lock screen needs four things: our own Kotlin Firebase handler, a call-style screen, a config plugin, and an APK rebuild for every try. That is **2–3 days**, and none of it can be tested in CI, only on a phone.
- **Some things can be detected from JavaScript, with no new dependency:**
  - whether notifications are allowed;
  - whether the captain has turned the "Work requests" channel down, or stopped it ringing through Do Not Disturb. Android lets him do both, and `getNotificationChannelAsync` reads them back.
- **Some things can be opened but not detected:**
  - The battery-optimisation list opens with `Linking.sendIntent`, but reading whether the app is exempt needs native code.
  - Autostart has no standard Android setting. Xiaomi, Vivo, Oppo and Realme each hide it somewhere different. We can only open the app's info page and say what to look for.

## Proposal (about half a day, no new dependency, no native code)

1. **Full-screen: not now.** Our ping already is the brief's fallback, a maximum-priority heads-up. The real full-screen ping becomes its own item if a first-phone test shows heads-up pings being missed.
2. **A "phone setup" screen.** It is the last step of captain onboarding and is also reachable from his home screen. Each row shows ✓ or ✗ and has one button:
   1. Notifications allowed: detected; the button asks for permission.
   2. Work-request alert at full strength: detected from the channel; the button opens that channel's settings.
   3. Battery saver off for Zamindara: not detectable; the button opens the battery list, and he ticks "done".
   4. Autostart on: not detectable; the button opens the app's info page with a one-line hint, and he ticks "done".
   5. Test ping: rings in 10 seconds so he can lock the phone first. It uses the channel real pings use right now (loud or quiet, per the founder's switch). He answers "I heard it" or "I didn't".
3. **His home screen shows a warning line** when row 1 or 2 is ✗ (a "missed pings" risk), and the line opens the setup screen.
4. **Ticks stay on the phone only.** Nothing new goes to the server.

```
┌──────────────────────────────────┐
│ ਫ਼ੋਨ ਤਿਆਰ ਕਰੋ (Phone setup)        │
│ So you never miss a work call.   │
│                                  │
│ ✓ Notifications allowed          │
│ ✗ Work alert is turned down      │
│   [ Fix ]                        │
│ ☐ Battery saver off              │
│   [ Open ]   [ Done ]            │
│ ☐ Autostart on                   │
│   "Find Autostart, turn it on"   │
│   [ Open ]   [ Done ]            │
│                                  │
│ [ Test ping in 10 s ]            │
│  → [ I heard it ] [ I didn't ]   │
├──────────────────────────────────┤
│ [ Done ]                         │
└──────────────────────────────────┘
```

Tests: unit tests for the row-status logic (which rows are ✓ from given permission and channel readings). The settings buttons and the ping need a phone; that becomes the manual check.
