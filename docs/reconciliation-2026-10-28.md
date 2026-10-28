# October 28 reconciliation and release evidence

## Source and scope

Official Formspree dashboard JSON exports on October 28, 2026 with both Inbox
and Spam selected. Independent provider totals: contact 28 inbox + 20 spam =
48 exported records; booking 29 inbox + 5 spam = 34 exported records.
All 82 identities are unique. Export time recorded as
2026-10-28T17:00:34.526Z. Latest source submission: October 27 UTC.

The provider spam folder contained genuine guest enquiries. Every new record
was reviewed; existing filtered rows were also checked. Classification after
review: 35 genuine Formspree enquiries, 42 spam/tests, five explicit email
captures. The 77 operational records exclude captures. One existing Typeform
row is retained separately: 36 visible enquiries total, 28 unique senders,
24 booking requests and 12 contact requests. There are eight enquiries in the
September 30–October 27 UTC reporting period.

## Migration

The old Mac mini checkout was left untouched. Its August 31 uncommitted data
and 43-decision manifest were preserved privately. Current Git main and PR #5
were the published identity baseline, not that stale working file.

All 43 old manifest keys and classifications were retained. Source fingerprints
were explicitly rebaselined from the independently reviewed official exports;
the old raw exports are unavailable, so byte-identical historical payloads
cannot be asserted. One local-only dashboard ID was replaced with its already
published curated ID. All previously published dashboard IDs and presentation
fields are preserved, except six explicitly reviewed timestamp corrections.
Those source correspondences were checked by name/email, date and stay/request
facts; the two separate same-person follow-ups remain distinct.

Ten genuine enquiries were absent from PR #5, eleven from production main.
This includes older missed records and the pending October 21 enquiry.
The importer regenerated one canonical data module; unused split modules were
removed to avoid competing stale copies.

## Validation

- Complete counts and unique source identities independently audited.
- Every approved Formspree lead maps to one exact dashboard identity.
- Zero unresolved classifications and no duplicate dashboard IDs.
- Existing Typeform row retained exactly.
- Same exports, timestamp and current manifest render identical bytes.
- Regression tests cover incomplete exports, collisions, follow-ups, timezone
  stability, split TypeScript imports, held external rows, reviewed timestamp
  corrections and unchanged files on validation failure.
- Direct TypeScript check and Next.js production build passed.

Private exports, identity corrections, decision manifest and detailed audit are
kept outside Git. Production readiness still requires main deployment READY and
readback of all expected IDs/counts; preview success alone is insufficient.
