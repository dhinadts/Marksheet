# AI-MARKS mobile

Flutter capture client for authenticated examination valuation workflows.

## Phase 7 capabilities

- Tenant-qualified login with access tokens and rotating refresh tokens stored in platform secure storage
- Automatic one-time refresh and retry for expired access tokens
- Riverpod state management, GoRouter navigation, and Dio networking
- Data-driven university, college, department, academic-year, class, subject, and published paper-version selection
- Exact question-paper-version and marking-scheme-version UUID retention for capture context
- Camera preview, paper guide, manual capture, flash, camera switching, and gallery fallback
- On-device resolution, brightness, overexposure/glare, and sharpness preflight
- Retake workflow and a secure-metadata offline capture queue boundary

Question numbers, parts, maximum marks, tenant identifiers, credentials, and API URLs are
not embedded in application logic. The API base URL is supplied at build/run time:

```sh
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
```

`10.0.2.2` reaches the host from an Android emulator. Use the development machine's LAN
address for a physical device and HTTPS in deployed environments.

## Verification

```sh
flutter pub get
dart run build_runner build
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3001
```

Phase 8 must provide the signed upload and mark-sheet creation APIs before the validated
capture can leave the local queue. Image preflight is advisory and does not claim document
boundary, perspective, or production-grade glare detection accuracy.
