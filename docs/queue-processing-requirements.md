# Mark-sheet queue processing requirements

This project applies the supplied production specification with the following
queue-specific rules:

1. A captured image is assigned a durable local UUID before upload.
2. Each queued sheet is visible and individually tappable in Flutter.
3. Tapping a queued sheet uploads it once and requests idempotent processing.
4. Successful OCR persists detected values as advisory `AI` mark values.
5. OCR unavailability, quota exhaustion, timeout, or unreadable handwriting must
   not leave a sheet queued indefinitely.
6. On OCR failure, NestJS creates one structured `ExtractedMark` and verification
   item for every scorable marking-scheme question with status
   `MANUAL_ENTRY_REQUIRED` and no invented value.
7. The sheet moves to `REVIEW_REQUIRED`, where faculty enter or verify values
   against the private stored image.
8. OCR values are never overwritten; reviewer values remain separate and audited.
9. Retrying upload completion is idempotent and must not duplicate question rows.
10. Publishing remains forbidden until all question values are reviewed and the
    normal verification/calculation workflow succeeds.

This replaces any interpretation that an external OCR provider must succeed
before a captured mark sheet can become a systemized database entry.
