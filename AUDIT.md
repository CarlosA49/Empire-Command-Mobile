# Release audit

Audit date: 2026-10-31

Release: 0.1.0

## Scope

The audit covered the deterministic game engine, AI turns, combat and conquest, city founding and production, save validation, Command Console actions, portrait and landscape touch flows, offline caching, the local development server, Android native configuration, APK contents/signing, and iOS project/package structure.

## Issues found and fixed

- Prevented Settlers and other civilian units from attacking units or cities.
- Prevented cities from being founded inside rival territory and guaranteed that every city center belongs to its city owner.
- Corrected conquest ranking so an eliminated faction with a stale score cannot be declared the winner.
- Made instant unit production report a blocked spawn instead of falsely reporting completion.
- Kept defending cities at one health when the attacker and city would otherwise fall simultaneously.
- Made the turn-80 Legacy victory trigger on turn 80 rather than turn 81.
- Prevented keyboard shortcuts from interrupting world-seed entry in an open dialog.
- Allowed a second tap on a friendly unit occupying a city to select the city beneath it.
- Hardened corrupted-save validation, offline cache updates, manifest MIME metadata, and malformed/local path handling in the development server.
- Corrected Android manifest ordering, SDK path escaping for lint, and themed launcher icon metadata.

## Verification completed

- 13 deterministic engine tests pass, including twelve long campaigns covering all map sizes and difficulties through as many as 85 turns.
- The browser smoke test passes at 390 × 844 and 844 × 390 touch viewports.
- Touch city selection, exact +100,000-gold command behavior, automatic save/restore, seed entry, and portrait/landscape rendering are exercised in a real Chromium browser.
- `npm audit --omit=dev` reports zero runtime dependency vulnerabilities.
- Capacitor Doctor reports Android healthy and all Capacitor packages aligned at 8.6.0.
- Android `lintDebug`, unit tests, and `assembleDebug` complete successfully.
- The APK has a valid v2 debug signature, package `com.empirecommand.mobile`, version `0.1.0`, minSdk 24, and targetSdk 36.
- The rebuilt Android APK and iOS package both contain the corrected engine bundle.
- The iOS plist is valid XML, the bundle identifier/version/deployment target are consistent, and the Xcode project uses Capacitor 8.6.0 through Swift Package Manager.

## Remaining platform constraint

The iOS project cannot be compiled or signed on this Windows machine. Apple’s toolchain requires macOS and Xcode 26 or newer, so a final device build still needs to be opened, compiled, and signed on a Mac. The synchronized Xcode project and complete offline web bundle are included in the release package.

The full dependency audit reports moderate advisories only in development tooling pulled by Capacitor CLI and the icon generator. Those packages are not bundled into the Android, iOS, or web runtime. Forcing npm’s proposed downgrade would make the Capacitor 8 projects incompatible.

No finite test suite can prove that software contains no defects, but all reproduced issues are fixed and every automated/native check available in this environment passes.
