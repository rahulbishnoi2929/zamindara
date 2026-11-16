# Onboarding a captain

Start to finish: what you do in the Supabase dashboard, and what you do on
his phone. Budget twenty minutes for the first one and ten after that.

There is no SMS provider yet. India requires DLT registration with TRAI
before a real message can be sent and that takes weeks, so **you give each
captain his code yourself** and the app says so on screen.

---

## Before you leave the house

### 1 · Decide his code

Any six digits. Do not reuse one, and do not use anything guessable from his
number.

> **A test number is a permanent back door.** Anyone who knows the number
> and its code can sign in *as that captain* — see his jobs, accept work in
> his name, take his place in a queue. Treat the list like a list of
> passwords, because that is what it is.

### 2 · Add it in the dashboard

**Authentication → Sign In / Providers → Phone → Test Phone Numbers and
OTPs.**

Entries are comma-separated `number=code`, with the country code and no `+`
or spaces:

```
919876543210=482913,919876500011=771204
```

Set **Test OTPs Valid Until** to a date a few months out, then **Save**.

> **Never put these in `backend/supabase/config.toml`.** That file is in
> git, and `supabase config push` copies the whole block to the hosted
> project with a ten-year expiry. CI fails the build if a number outside
> the four fictional test fixtures appears there. To send schema changes
> up, use `supabase db push`, which pushes migrations and not that file.

### 3 · Check the sign-in wording is the honest one

```sql
select founder_code_signin from public.app_config;
```

It should be `true`. That makes the screen say *"Enter the code you were
given on the phone"* with *"No SMS will arrive"* underneath, instead of
claiming a message is on its way. If it is `false`:

```sql
update public.app_config set founder_code_signin = true;
```

The change reaches phones already in captains' hands on their next start.
No rebuild, no reinstall.

---

## With the captain, on his phone

### 4 · Install the app

Copy the APK across by cable or file transfer and tap it. Android will ask
about installing from unknown sources; allow it for the file manager.

Check the bottom of the home screen afterwards — it shows the version, like
`v0.1.0 · built in`. **Write that down next to his name.** When he rings in
April to say something is wrong, that line is how you know what he is
running.

> If Android refuses with *"App not installed"* or
> `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, his phone already has a build signed
> with a different key. It must be uninstalled first, and uninstalling takes
> any unsynced fields and jobs with it. See
> [SIGNING_AND_RELEASE.md](SIGNING_AND_RELEASE.md).

### 5 · Sign him in

1. He enters his ten-digit number.
2. He taps **ਅੱਗੇ ਵਧੋ** (Continue).
3. You read him his six-digit code. He enters it.
4. He is in.

If it refuses the code: check the number in the dashboard is written with
the country code and no `+`, and that **Test OTPs Valid Until** has not
passed.

### 6 · Set him up as a captain

In onboarding he chooses **ਕੈਪਟਨ**, then enters his name, his village, and
his machines — the type, whether he owns it or arranges it, and how much
notice an arranged one needs.

Then his rate for each kind of work. **This is his number, not yours.** The
app shows what has been paid nearby as a range; he picks what he charges.

### 7 · Verify him — and do not skip this

A captain who is not verified is **invisible**. He is never offered a single
job, and from his side the app simply looks dead.

You need to be staff for this. Once, ever:

```sql
insert into public.admins (phone) values ('<your ten-digit number>');
```

Then in the app: your home screen shows a **Verify captains** entry. Open
it, find him, tap verify. Do it there in the yard, looking at the machine —
that is better evidence than any document.

### 8 · Prove it works before you leave

Four checks. All of them, every time.

| Check | What you should see |
|---|---|
| He goes online | The card turns green |
| You post a job nearby from your phone | His phone rings within seconds, **with the screen off** |
| He accepts | Your phone shows his name |
| He opens the draw screen | A map, not a blank grey box |

If his phone does not ring with the screen off, the problem is almost always
Android power saving rather than the app. On most Indian handsets: Settings
→ Apps → Zamindara → Battery → **Unrestricted**, and in the phone's own
security or phone-manager app, turn **Autostart** on. Xiaomi, Realme, Oppo
and Vivo all need this and all hide it somewhere different.

---

## When the SMS paperwork comes through

1. Configure the provider in the dashboard.
2. `update public.app_config set founder_code_signin = false;`
3. Remove every test number from **Test Phone Numbers and OTPs**.

Step 3 is not optional. Those entries are standing back doors into real
captains' accounts, and they outlive the reason they existed.

---

## What this does not cover

- **Whether the dashboard accepts test numbers with no SMS provider
  configured.** Supabase's own documentation says a provider must be set up
  even though nothing is sent to test numbers, and does not say a
  placeholder works on a hosted project — only on a local one. If the
  dashboard refuses to save without credentials, stop and tell me: the
  answer changes what this document says, and choosing an SMS provider is
  not my decision to make.
- Farmers. They sign in the same way, but there is no verification step and
  no machines — they go straight to measuring a field.
