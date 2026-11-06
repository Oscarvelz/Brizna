# Brizna for Android

A thin WebView app around https://oscarvelz.github.io/Brizna/ (package `com.oscarvelz.brizna`, min Android 11).
Web releases arrive on their own (the page is loaded live; the service worker keeps it working offline).

- Bridge: `window.BriznaNative` (see `src/spa/native.ts`, feature-detected; the browser/PWA never see it):
  Back (`BriznaBack` → `atRoot`), bar colours, downloads into Downloads/Brizna, the share sheet, printing,
  BiometricPrompt for the fingerprint lock, local reminders (`Notify.kt`: AlarmManager, re-armed after reboot),
  the battery exemption, the "Hoy" home-screen widget (`HoyWidget.kt`), update offer from GitHub releases
  `android-N` (asset `Brizna.apk`), renderer-crash recovery.
- Build: `.github/workflows/android.yml` on the `source` branch (only when `android/` changes). versionCode = `android/version.txt`.
- Signing: the key is private and never committed. CI uploads `brizna-unsigned-N`; the APK is signed privately
  (apksigner, alias `brizna`) and pushed to the orphan branch `android-signed` (`Brizna.apk`, `VERSION`=N, `NOTES.md`),
  whose workflow publishes release `android-N`. All updates must use the same key
  (certificate SHA-256 7e:ae:31:f1:…:dc:02:32).
- Download: https://github.com/Oscarvelz/Brizna/releases/latest/download/Brizna.apk
- Storage is separate from Chrome: sign in once (Nube) or restore a backup.
