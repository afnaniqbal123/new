# Mobile App Checklist (OWASP MASVS-flavored)

Use when Stage 1 detects an Android (`AndroidManifest.xml`, Gradle) or iOS
(`Info.plist`, `.xcodeproj`) app, or a cross-platform framework (Flutter,
React Native). Read alongside `checklist-common-cwe.md` for
crypto/injection basics that still apply client-side.

## A. Data Storage

- Sensitive data (tokens, PII, credentials) stored in plaintext
  `SharedPreferences`/`UserDefaults`/local SQLite instead of platform
  secure storage (Android Keystore-backed EncryptedSharedPreferences, iOS
  Keychain).
- Sensitive data logged to system logs (`Log.d`, `print`, `NSLog`) that
  persist in device logs or crash reporters.
- Sensitive data included in backups (Android `allowBackup="true"` without
  exclusion rules, iOS data not marked `NSFileProtectionComplete`).

## B. Network Communication

- Certificate pinning present for high-sensitivity apps (banking, health)
  — absence isn't automatically a finding for every app, but note it as
  `info`/`low` when relevant.
- TLS misconfig: `TrustAllCerts`/custom `TrustManager` that accepts any
  certificate, `NSAllowsArbitraryLoads` enabling cleartext traffic in
  `Info.plist`, `usesCleartextTraffic="true"` in Android manifest.

## C. Authentication & Session

- Biometric auth implemented as a local UI gate only, without binding to a
  cryptographic key release (i.e., biometric prompt that just sets a
  boolean rather than unlocking a Keystore/Keychain-protected key) — this
  can often be bypassed by patching the app or hooking the check.
- Auth tokens with no expiry, stored insecurely (see Data Storage above).

## D. Platform Interaction / Attack Surface

- Exported Android components (`exported="true"` on Activities, Services,
  BroadcastReceivers, ContentProviders) that don't validate the caller,
  reachable from any other app on the device.
- Intent handling that trusts data from an implicit intent without
  validation (Android), or URL scheme handlers (iOS/Android deep links)
  that perform sensitive actions based on unvalidated deep-link
  parameters.
- WebViews: `setJavaScriptEnabled(true)` combined with
  `addJavascriptInterface` exposing app functionality to loaded web
  content, or loading untrusted/attacker-influenced URLs in a WebView with
  JS enabled.

## E. Code Quality / Hardening

- Hardcoded API keys/secrets in the app binary (these are always
  extractable from a shipped APK/IPA — treat any embedded secret as
  effectively public, not just "found in source").
- Root/jailbreak detection and anti-tampering are best-effort, not a
  security boundary — don't rate an app's overall security higher just
  because these checks exist, but do note their absence as `info` if the
  app also stores/processes high-value secrets client-side.

## F. Cross-Platform Framework Notes (React Native / Flutter)

- React Native: JS bundle is easily unpacked/read even with Hermes bytecode
  compilation adding only mild friction — don't treat business logic in
  the JS bundle as hidden from an attacker.
- Flutter: platform channel handlers that accept method calls from Dart
  without validating arguments before performing privileged native
  actions.

---

Cite the specific MASVS control ID (e.g. "MASVS-STORAGE-1") in `citations`
when a finding maps cleanly, so the user can cross-reference the official
standard.
