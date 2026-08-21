# Canary Cove lead dashboard

Internal dashboard for genuine booking and contact enquiries submitted through `canarycove.com`.

Production dashboard: `https://canarycove-dash.vercel.app`

## Canonical lead flow

1. Canary Cove's website sends accepted contact and booking submissions to Formspree through the website's first-party forms backend.
2. Review the raw rows from both Canary Cove Formspree forms:
   - Contact: `xvzarybk`
   - Booking: `xqeqllek`
3. Classify each new row as a genuine guest enquiry or obvious spam/test traffic. Do not discard a real follow-up merely because the same person submitted earlier.
4. Apply every approved genuine row once through `node scripts/canary-leads/cli.mjs`, preserving the submitted facts exactly. Never hand-edit the generated `data/submissions.ts` file, and never invent a name, date, guest count, contact detail, or booking status.
5. Reconcile against the immutable Formspree submission ID when it is available. A repeated API row must not create a second dashboard entry; a separate follow-up submission remains a separate entry.
6. Update `submissionImportSummary` from the same complete export: reconciliation time, raw count, visible genuine rows, filtered rows, per-form counts, and excluded email-capture rows.
7. Run the validation gate, deploy the dashboard update, and read back production. The lead is handled by this workflow only after the new row and the updated reconciliation date are visible on the production dashboard.

The dashboard is Canary Cove's operational lead source of truth. Formspree is the raw intake source used to reconcile it.

## Daily automation

The `sync-canary-cove-leads` automation runs every day at 8:00 AM in `America/Los_Angeles`.

1. Use the approved Formspree reader to fetch every page from both forms and save the complete reader envelopes.
2. Give the reconciliation an explicit UTC timestamp because the approved reader envelope does not include `exportedAt`:

   ```bash
   EXPORTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
   node scripts/canary-leads/cli.mjs \
     --contact /path/to/contact-complete.json \
     --booking /path/to/booking-complete.json \
     --exported-at "$EXPORTED_AT"
   ```

3. Treat unresolved rows as a hard stop. The importer fails closed: classify each new row as `lead` or `spam`, review the exact data diff, and obtain current authorization before applying, committing, pushing, or deploying a changed dashboard.
4. When the complete export produces no new rows and no data diff, do not create a commit or deployment. Read back the reconciliation counts and production dashboard instead.
5. After an authorized changed-data release, confirm the production URL shows the new lead, updated totals, and new reconciliation date before considering the sync complete.

Use the direct local binaries for the automation validation gate:

```bash
node --test scripts/canary-leads/*.test.mjs
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/next build
```

The local `pnpm build` wrapper can stop before Next.js runs when pnpm enforces its ignored-build policy for Sharp. Do not use `pnpm approve-builds` as a routine automation workaround; the direct commands above are the supported automation path.

## Verified production baseline

Verified on August 21, 2026 at `https://canarycove-dash.vercel.app`:

- Contact form export: 23 rows, including the 2 email captures below
- Booking form export: 18 rows
- Homepage email captures: 2 rows, tracked separately
- Operational contact and booking rows: 39
- Genuine enquiries visible on the dashboard: 19
- Spam or test rows filtered: 20
- Unresolved review rows: 0
- Reconciled data commit: `4ab7758`
- Production label: `39 raw Formspree rows · 19 guest enquiries · 20 spam/test rows filtered · Formspree reconciled through Aug 21, 2026`

## Notification policy

- Do not add Consi or `canarycove@gmail.com` as a Formspree notification recipient.
- Do not forward or recreate individual Formspree notification emails for Consi.
- Do not use email delivery to Consi as a completion check. Confirm the lead on the production dashboard instead.
- Do not restart or reconnect Bookingmood. It is not part of the current website or lead workflow.
- Do not treat a Formspree notification, an email draft, or a local data edit as proof that the dashboard was updated.

## Data boundaries

- This dashboard includes genuine contact and booking enquiries only.
- Homepage email-capture rows are tracked separately.
- Keep lead details inside the Formspree-to-dashboard workflow. Do not copy private contact information into Notion task bodies, release notes, chat updates, or general documentation.
- Preserve distinct follow-up submissions, but never duplicate the same Formspree row.
- The dashboard records enquiries, not confirmed availability, replies, quotes, or bookings. Do not infer those outcomes from a submission.

## Update checklist

- [ ] Read all pages from both Formspree forms.
- [ ] Compare source submission IDs with the last reconciled export.
- [ ] Separate genuine rows from spam/test rows.
- [ ] Apply each approved genuine submission once through `node scripts/canary-leads/cli.mjs`; never hand-edit the generated `data/submissions.ts` file.
- [ ] Update every `submissionImportSummary` count from the same export.
- [ ] Run the direct test, typecheck, and Next.js build commands documented above.
- [ ] Review the data diff for accidental edits or exposed secrets.
- [ ] Deploy through the repository's normal `main`/Vercel flow.
- [ ] Confirm the production dashboard shows the new lead, totals, and reconciliation date.

## Local development

```bash
pnpm install
pnpm dev
```

Production build:

```bash
./node_modules/.bin/next build
```

The dashboard reads its importer-generated data from `data/submissions.ts`. The UI sorts rows newest-first at render time. Never hand-edit this generated file; reconcile and apply changes through `node scripts/canary-leads/cli.mjs`.

## Deterministic reconciliation command

Use the importer with saved, complete JSON exports from both Formspree forms:

```bash
EXPORTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node scripts/canary-leads/cli.mjs \
  --contact /path/to/contact-complete.json \
  --booking /path/to/booking-complete.json \
  --exported-at "$EXPORTED_AT"
```

The default is a dry run. New contact or booking rows are marked `review`, explicit homepage `email_capture` rows are separated automatically, and `_codex_test=true` rows are filtered as tests. The command never guesses that an ordinary submission is spam or genuine.

To save review decisions in the ignored, private manifest:

```bash
EXPORTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node scripts/canary-leads/cli.mjs \
  --contact /path/to/contact-complete.json \
  --booking /path/to/booking-complete.json \
  --exported-at "$EXPORTED_AT" \
  --write
```

Edit `data/private/formspree-reconciliation.json` and change each `review` classification to `lead` or `spam`. Then use `--apply`. Apply fails closed until every row is resolved, and atomically regenerates `data/submissions.ts` only from that same complete export.

The private manifest keys each decision by `<form ID>:<immutable Formspree submission ID>` and records a source hash so changed content under an immutable ID fails loudly. Dashboard IDs are stable hashes, so provider IDs are not copied into the public dashboard data. The same submission is idempotent across reruns; separate submission IDs from the same email remain separate follow-ups.

Accepted complete-export shapes are either:

- `{ "formId": "...", "exportedAt": "...", "complete": true, "submissions": [...] }`
- `{ "formId": "...", "exportedAt": "...", "totalPages": 2, "pages": [{ "page": 1, "totalPages": 2, "submissions": [...] }, ...] }`
- the approved `formspree_reader.py` envelope: `{ "form": { "hashid": "..." }, "result": { "submissions": [...], "fetched_pages": 1, "fetched_count": 23 } }`

The reader envelope is accepted only when its form ID matches, `fetched_pages` is positive, and `fetched_count` exactly equals the included row count. When this approved reader transport omits provider IDs, the importer uses the documented fallback of form ID, exact `_date`, and normalized email. The composite is hashed so email is never exposed in the manifest key. Duplicate fallback identities are rejected as ambiguous. Generic exports still require immutable provider IDs. Naked arrays and missing pages are rejected. The command reads saved files only. It cannot submit forms, send email, change Formspree recipients, notify Consi, deploy, or push commits.

For the first run only, `--seed-existing --write` can create the private manifest from the current curated dashboard. It matches each visible lead by source form, exact timestamp, and normalized email, preserves the current dashboard ID, and refuses all fuzzy or ambiguous matches. It classifies the remaining historical operational rows as spam only when every existing summary count exactly matches the complete exports. Homepage email captures remain separate and do not contribute to `rawRows` or `contactRows`.

Focused importer tests:

```bash
node --test scripts/canary-leads/*.test.mjs
```
