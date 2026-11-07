# Brizna for Android

A thin WebView app around https://oscarvelz.github.io/Brizna/ (package `com.oscarvelz.brizna`, min Android 11).
Web releases arrive on their own (the page is loaded live; the service worker keeps it working offline).

- Bridge: `window.BriznaNative` (see `src/spa/native.ts`, feature-detected; the browser/PWA never see it):
  Back (`BriznaBack` → `atRoot`), bar colours, downloads into Downloads/Brizna, the share sheet, printing,
  BiometricPrompt for the fingerprint lock, local reminders (`Notify.kt`: AlarmManager, re-armed after reboot),
  the battery exemption, the "Hoy" home-screen widget (`HoyWidget.kt`) and the "Panel" tablet widget
  (`PanelWidget.kt`, android-5: the day with its client list, the week at a glance and Por cobrar with its top
  debtors, fed by the same setWidget snapshot — its panel fields added by the page in web 1.5.09 — and refreshed
  by the same save/tick/boot machinery), and (android-6) the phone widgets grow up: "Hoy" gains a tall 4x4 size
  with the day's client list and per-zone taps (Por cobrar goes to Cobros), a third widget "Semana"
  (`SemanaWidget.kt`: the next seven days at a glance plus today's next client, tap the strip for Agenda), and
  every widget gets placement options (`WidgetConfigActivity` + `WidgetLook`: follow the app / always day /
  always night, and Por cobrar on/off, per widget id), update offer from GitHub releases
  `android-N` (asset `Brizna.apk`), renderer-crash recovery, and (android-3) "A inglés" on the phone with
  Google ML Kit (`Translate.kt`, `translate`/`translateState`; the Spanish model downloads once on any network and stays),
  and (android-4) "Dictar" with the phone's speech recognizer (`Dictate.kt`, `dictate`/`dictateStop`/`dictateCancel`/
  `dictateState`; on-device recognizer first, partial text streamed; RECORD_AUDIO asked on the first tap; Brizna's own
  pages may also get getUserMedia audio through `onPermissionRequest`).
- APK: arm64-v8a only, native libraries compressed (android-3 with 4 ABIs was 70.8 MB).
- Build: `.github/workflows/android.yml` on the `source` branch (only when `android/` changes). versionCode = `android/version.txt`.
- Signing: the key is private and never committed. CI uploads `brizna-unsigned-N`; the APK is signed privately
  (apksigner, alias `brizna`) and pushed to the orphan branch `android-signed` (`Brizna.apk`, `VERSION`=N, `NOTES.md`),
  whose workflow publishes release `android-N`. All updates must use the same key
  (certificate SHA-256 7e:ae:31:f1:…:dc:02:32).
- Download: https://github.com/Oscarvelz/Brizna/releases/latest/download/Brizna.apk
- Storage is separate from Chrome: sign in once (Nube) or restore a backup.
