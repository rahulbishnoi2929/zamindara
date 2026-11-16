# Signing and releasing the APK

There is no Play Store in this plan. You build an APK on your own machine
and put it on captains' phones by hand. This is how.

---

## The one thing to understand first

Android identifies an app by **its signature**, not its name. If a phone has
an app signed with key A, Android will refuse to install an update signed
with key B. It does not ask, and there is no override.

So:

- Build a release APK with **the same key, every time, forever**.
- A captain carrying a build signed with the wrong key cannot be given a
  correct one later. He has to **uninstall first**, and uninstalling takes
  his unsynced fields and jobs with it.

That is why the build plugin throws rather than warns if it cannot do its
job, and why the build prints a yellow line when it falls back to the debug
key. A debug-signed APK is for you, never for anybody else.

---

## 1 · Make your keystore — once, ever

Pick a password you will not lose. Write it somewhere that is not this
laptop. Then:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore zamindara-release.keystore -alias zamindara -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password twice and then for your name, organisation, city,
state and country code. Those answers appear in the certificate; they do not
have to be a registered company. `Zamindara`, `Fazilka`, `Punjab`, `IN` is
fine.

`-validity 10000` is about 27 years. Make it long. A certificate that
expires is a certificate that stops you shipping.

**Do not put this file in the project folder.** Put it somewhere like
`C:\Users\rahul\keys\zamindara-release.keystore`.

---

## 2 · Back it up, properly

This file and its password are the only things that let you update the app
on a phone that already has it.

- Keep **two copies in two places** — for example an encrypted USB stick
  kept at home, and a password manager or an encrypted archive in your
  email to yourself.
- Store the **password with neither copy**. A keystore and its password in
  the same folder is one theft, not two.
- Never commit it. `.gitignore` already covers `*.keystore`, `*.jks` and
  `keystore.properties`, and CI fails if one appears — but the real
  protection is keeping it outside the project folder entirely.

### If you lose it

You cannot recover it. There is no reset. What happens:

1. You make a new keystore and sign future builds with that.
2. Every captain who already has the app must **uninstall** it before he can
   install the new one.
3. Anything on his phone that has not synced is gone — unmeasured fields,
   jobs posted with no signal.

With ten captains that is a bad afternoon of phone calls. With five hundred
it is the end of the season. Back it up today, before there is anything on
anyone's phone worth losing.

---

## 3 · Tell gradle where it is

Put the four values in **`~/.gradle/gradle.properties`** — your home folder,
not the project. On this machine that is
`C:\Users\rahul\.gradle\gradle.properties`:

```properties
ZAMINDARA_STORE_FILE=C:/Users/rahul/keys/zamindara-release.keystore
ZAMINDARA_STORE_PASSWORD=the password you chose
ZAMINDARA_KEY_ALIAS=zamindara
ZAMINDARA_KEY_PASSWORD=the password you chose
```

Forward slashes, even on Windows. (Backslashes are escape characters in a
properties file; `\r` becomes a carriage return and gradle then complains
that the filename syntax is incorrect.)

Nothing in the repository ever contains these. The config plugin writes only
the *names* into the generated gradle file; the values live here.

---

## 4 · Build it

```bash
cd frontend && npx expo prebuild --platform android --clean
```

```bash
echo "sdk.dir=C:/Users/rahul/AppData/Local/Android/Sdk" > frontend/android/local.properties
```

```bash
cd frontend/android && ./gradlew assembleRelease
```

The APK lands at:

```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

> `--clean` deletes `android/` and writes it again, which is what re-applies
> the signing plugin. It also deletes `local.properties`, which is why the
> second command is there. The first build after a clean takes around 45
> minutes; later ones are minutes.

**Watch for this line.** If the build prints

```
Zamindara: no ZAMINDARA_STORE_FILE set, release APK is signed with the DEBUG key.
```

then step 3 did not take effect. Stop. Do not give that APK to anyone.

---

## 5 · Check what signed it

Before handing out any build:

```bash
"C:/Users/rahul/AppData/Local/Android/Sdk/build-tools/37.0.0/apksigner.bat" verify --print-certs --verbose frontend/android/app/build/outputs/apk/release/app-release.apk
```

You want a line reading:

```
V2 Signer: certificate DN: CN=<your name from step 1>, ...
```

If it says `CN=Android Debug`, the key was not picked up — go back to step 3
and do not hand that APK to anyone.

Note the `certificate SHA-256 digest` the first time, and compare it on
later builds. The same digest means the same key, which means the update
will install over the old one.

> **Not `keytool -printcert -jarfile`.** That only reads v1 (JAR) signatures,
> and this APK is signed with v2 — so keytool answers "Not a signed jar
> file" on a perfectly well-signed APK. It looks exactly like a failure and
> is not one. Use `apksigner`.

## 6 · Put it on a phone

```bash
adb install -r frontend/android/app/build/outputs/apk/release/app-release.apk
```

Or copy the file to the phone and tap it; Android will ask about installing
from unknown sources.

`-r` reinstalls over an existing copy and keeps its data — but only if the
signature matches. If `adb` says `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the
keys differ: that phone has a build signed with a different key, and it must
be uninstalled first.

---

## 7 · Telling phones an update exists

There is no store, so nothing notifies a captain. One row does:

```sql
update public.app_config
set latest_version = '0.2.0',
    latest_apk_url = 'https://wherever-you-host-it/app-release.apk',
    update_note_pa = 'ਨਵਾਂ: ...',
    update_note_hi = 'नया: ...',
    update_note_en = 'New: ...';
```

Every app reads that row on start and shows a notice with a Download button.
Leave `latest_apk_url` null and it says a version exists without offering a
download.

`minimum_supported_version` is the harder switch: below it, the app tells
the captain it is too old. Raise it only when an old build is genuinely
unsafe to keep using, because a captain in a field cannot act on it
immediately.

### Which changes need a new APK at all

Most do not. A JavaScript change — screens, text, prices, logic, bug fixes,
anything in `packages/` — reaches every phone over the air with
`eas update`, with no download and nothing asked of the captain. See
[SETUP.md](../SETUP.md) step 2b.

A new APK is needed only for native changes: a new library, a new Android
permission, anything in the `android` block of `app.json`, or an Expo SDK
upgrade. The `fingerprint` runtime policy enforces this — an over-the-air
update is never delivered to an app whose native side does not match.
