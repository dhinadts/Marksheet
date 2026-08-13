# User guides

Administrator, reviewer, and capture workflows will be documented alongside their implementation.
# Flutter capture workflow

1. Sign in with the tenant UUID and assigned account. Access and rotating refresh tokens
   remain in platform secure storage.
2. Select the active university, college, department, academic year, class, and subject.
3. Select a published question-paper version. The client retains both the exact paper
   version UUID and its published marking-scheme version UUID.
4. Align the complete mark sheet with the camera guide, then capture manually or select an
   existing image.
5. Review the local resolution, brightness, overexposure, and sharpness checks. Retake any
   capture that does not pass.
6. Add an accepted capture to the device queue. Phase 8 will exchange queued captures for
   server mark-sheet records and signed upload destinations.

The client never derives question limits or totals from the photographed sheet and does not
embed question numbers, maximum marks, tenant identifiers, credentials, or service URLs.
