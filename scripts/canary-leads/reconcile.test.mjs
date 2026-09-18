import assert from "node:assert/strict"
import test from "node:test"
import { freshManifest, mergeExistingSubmissions, reconcile, renderSubmissionsModule, rowsFromCompleteExport, seedExisting } from "./reconcile.mjs"

function row(id, submittedAt, data = {}) {
  return { id, submittedAt, data: { name: "Guest", email: "guest@example.com", ...data } }
}

function decidedManifest(decisions) {
  return { version: 1, decisions }
}

test("requires complete pagination and accepts all contiguous pages", () => {
  const incomplete = { formId: "xvzarybk", totalPages: 2, pages: [{ page: 1, totalPages: 2, submissions: [] }] }
  assert.throws(() => rowsFromCompleteExport(incomplete, "xvzarybk"), /Incomplete export/)

  const complete = {
    formId: "xvzarybk",
    totalPages: 2,
    pages: [
      { page: 2, totalPages: 2, submissions: [row("second", "2026-08-02T00:00:00Z")] },
      { page: 1, totalPages: 2, submissions: [row("first", "2026-08-01T00:00:00Z")] },
    ],
  }
  assert.equal(rowsFromCompleteExport(complete, "xvzarybk").length, 2)
  assert.throws(() => rowsFromCompleteExport([row("unsafe", "2026-08-01T00:00:00Z")], "xvzarybk"), /naked row arrays/)
})

test("accepts the approved reader envelope only with strict count metadata", () => {
  const submission = row("reader", "2026-08-01T00:00:00Z")
  const valid = { form: { hashid: "xvzarybk" }, result: { submissions: [submission], fetched_pages: 1, fetched_count: 1 } }
  assert.deepEqual(rowsFromCompleteExport(valid, "xvzarybk"), [submission])
  assert.throws(() => rowsFromCompleteExport({ ...valid, form: { hashid: "wrong" } }, "xvzarybk"), /does not match expected form/)
  assert.throws(() => rowsFromCompleteExport({ ...valid, result: { ...valid.result, fetched_pages: 0 } }, "xvzarybk"), /positive integer/)
  assert.throws(() => rowsFromCompleteExport({ ...valid, result: { ...valid.result, fetched_pages: "1" } }, "xvzarybk"), /positive integer/)
  assert.throws(() => rowsFromCompleteExport({ ...valid, result: { ...valid.result, fetched_count: 2 } }, "xvzarybk"), /exactly match/)
})

test("uses a non-PII timestamp/email fallback only for approved reader rows without IDs", () => {
  const envelope = {
    form: { hashid: "xvzarybk" },
    result: {
      submissions: [{ _date: "2026-08-01T00:00:00Z", email: "Guest@Example.com", name: "Guest" }],
      fetched_pages: 1,
      fetched_count: 1,
    },
  }
  const rows = rowsFromCompleteExport(envelope, "xvzarybk")
  const result = reconcile({ contactRows: rows, bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-02T00:00:00Z" })
  const [key] = Object.keys(result.manifest.decisions)
  assert.match(key, /^xvzarybk:fallback:[a-f0-9]{64}$/)
  assert.equal(key.includes("guest@example.com"), false)
})

test("preserves no-ID approved-reader follow-ups but rejects ambiguous fallback collisions", () => {
  const submissions = [
    { _date: "2026-08-01T00:00:00Z", email: "same@example.com", name: "Guest", message: "First" },
    { _date: "2026-08-02T00:00:00Z", email: "same@example.com", name: "Guest", message: "Follow-up" },
  ]
  const rows = rowsFromCompleteExport(
    { form: { hashid: "xvzarybk" }, result: { submissions, fetched_pages: 1, fetched_count: 2 } },
    "xvzarybk",
  )
  const result = reconcile({ contactRows: rows, bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-03T00:00:00Z" })
  assert.equal(Object.keys(result.manifest.decisions).length, 2)

  const collisionRows = rowsFromCompleteExport(
    {
      form: { hashid: "xvzarybk" },
      result: {
        submissions: [submissions[0], { ...submissions[0], message: "Different row, same fallback identity" }],
        fetched_pages: 1,
        fetched_count: 2,
      },
    },
    "xvzarybk",
  )
  assert.throws(
    () => reconcile({ contactRows: collisionRows, bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-03T00:00:00Z" }),
    /Ambiguous approved-reader fallback identity/,
  )

  const initialSingle = rowsFromCompleteExport(
    { form: { hashid: "xvzarybk" }, result: { submissions: [submissions[0]], fetched_pages: 1, fetched_count: 1 } },
    "xvzarybk",
  )
  const first = reconcile({ contactRows: initialSingle, bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-03T00:00:00Z" })
  const changedSingle = rowsFromCompleteExport(
    {
      form: { hashid: "xvzarybk" },
      result: { submissions: [{ ...submissions[0], message: "Changed after baseline" }], fetched_pages: 1, fetched_count: 1 },
    },
    "xvzarybk",
  )
  assert.throws(
    () => reconcile({ contactRows: changedSingle, bookingRows: [], manifest: first.manifest, exportedAt: "2026-08-04T00:00:00Z" }),
    /Source data changed for stable submission identity/,
  )
})

test("still requires provider IDs for generic canonical exports", () => {
  const canonical = rowsFromCompleteExport(
    { formId: "xvzarybk", complete: true, submissions: [{ _date: "2026-08-01T00:00:00Z", email: "guest@example.com" }] },
    "xvzarybk",
  )
  assert.throws(
    () => reconcile({ contactRows: canonical, bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-03T00:00:00Z" }),
    /needs an immutable provider ID/,
  )
})

test("deduplicates repeated provider rows and is idempotent on rerun", () => {
  const duplicate = row("same", "2026-08-01T00:00:00Z")
  const first = reconcile({ contactRows: [duplicate, structuredClone(duplicate)], bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-03T00:00:00Z" })
  assert.equal(first.summary.rawRows, 1)
  assert.equal(first.delta.newDecisionRows, 1)
  const second = reconcile({ contactRows: [duplicate], bookingRows: [], manifest: first.manifest, exportedAt: "2026-08-03T00:00:00Z" })
  assert.deepEqual(second.manifest, first.manifest)
  assert.deepEqual(second.delta, { newDecisionRows: 0, zeroDelta: true })
})

test("preserves separate follow-ups from the same email", () => {
  const rows = [
    row("followup-1", "2026-08-01T00:00:00Z", { message: "First request" }),
    row("followup-2", "2026-08-02T00:00:00Z", { message: "Following up" }),
  ]
  const decisions = {
    "xvzarybk:followup-1": { classification: "lead", dashboardId: "c-one" },
    "xvzarybk:followup-2": { classification: "lead", dashboardId: "c-two" },
  }
  const result = reconcile({ contactRows: rows, bookingRows: [], manifest: decidedManifest(decisions), exportedAt: "2026-08-03T00:00:00Z" })
  assert.equal(result.leads.length, 2)
  assert.deepEqual(result.leads.map((lead) => lead.id), ["c-one", "c-two"])
})

test("builds a normalized booking display name from firstName and lastName", () => {
  const bookingRows = [
    row("split-booking-name", "2026-08-02T00:00:00Z", {
      name: undefined,
      form_key: "booking",
      firstName: "  Grace   Marie ",
      lastName: " Barfield  ",
    }),
  ]
  const manifest = decidedManifest({
    "xqeqllek:split-booking-name": { classification: "lead", dashboardId: "b-split-name" },
  })
  const result = reconcile({ contactRows: [], bookingRows, manifest, exportedAt: "2026-08-03T00:00:00Z" })
  assert.equal(result.leads[0].name, "Grace Marie Barfield")
})

test("rejects a lead with no explicit or split name components", () => {
  const bookingRows = [row("missing-booking-name", "2026-08-02T00:00:00Z", { name: undefined, form_key: "booking" })]
  const manifest = decidedManifest({
    "xqeqllek:missing-booking-name": { classification: "lead", dashboardId: "b-missing-name" },
  })
  assert.throws(
    () => reconcile({ contactRows: [], bookingRows, manifest, exportedAt: "2026-08-03T00:00:00Z" }),
    /missing a name or email/,
  )
})

test("maps real booking guest and request fields to current dashboard semantics", () => {
  const bookingRows = [
    row("real-booking-fields", "2026-08-02T00:00:00Z", {
      form_key: "booking",
      adultGuests: "4",
      childGuests: "4 children ages 13 and 17",
      requests: "Family trip",
    }),
    row("single-adult", "2026-08-03T00:00:00Z", {
      form_key: "booking",
      adult_guests: 1,
      child_guests: "0",
      requests: "Honeymoon",
    }),
  ]
  const manifest = decidedManifest({
    "xqeqllek:real-booking-fields": { classification: "lead", dashboardId: "b-real-fields" },
    "xqeqllek:single-adult": { classification: "lead", dashboardId: "b-single-adult" },
  })
  const result = reconcile({ contactRows: [], bookingRows, manifest, exportedAt: "2026-08-04T00:00:00Z" })
  assert.deepEqual(
    result.leads.map(({ guests, message }) => ({ guests, message })),
    [
      { guests: "4 adults, 4 children ages 13 and 17", message: "Family trip" },
      { guests: "1 adult", message: "Honeymoon" },
    ],
  )
})

test("rejects implausible adultGuests before a misclassified row can be applied", () => {
  const bookingRows = [
    row("phone-as-guests", "2026-08-02T00:00:00Z", {
      form_key: "booking",
      adultGuests: "5805417004",
    }),
  ]
  const manifest = decidedManifest({
    "xqeqllek:phone-as-guests": { classification: "lead", dashboardId: "b-bad-guests" },
  })
  assert.throws(
    () => reconcile({ contactRows: [], bookingRows, manifest, exportedAt: "2026-08-04T00:00:00Z" }),
    /implausible adultGuests/,
  )
})

test("derives all summary counts from the same complete row set", () => {
  const contactRows = [
    row("lead", "2026-08-01T00:00:00Z"),
    row("spam", "2026-08-01T01:00:00Z"),
    row("email", "2026-08-01T02:00:00Z", { form_key: "email_capture", source: "Homepage updates signup" }),
  ]
  const bookingRows = [row("review", "2026-08-01T03:00:00Z", { form_key: "booking" })]
  const manifest = decidedManifest({
    "xvzarybk:lead": { classification: "lead", dashboardId: "c-lead" },
    "xvzarybk:spam": { classification: "spam" },
  })
  const result = reconcile({ contactRows, bookingRows, manifest, exportedAt: "2026-08-03T00:00:00Z" })
  assert.deepEqual(result.summary, {
    exportedAt: "2026-08-03T00:00:00.000Z",
    rawRows: 3,
    visibleRows: 1,
    filteredRows: 1,
    contactRows: 2,
    bookingRows: 1,
    excludedEmailCaptureRows: 1,
    reviewRows: 1,
    sourceFiles: [
      "Formspree API xvzarybk contact complete export",
      "Formspree API xqeqllek booking complete export",
    ],
  })
})

test("strictly seeds current dashboard IDs and classifies only parity-proven remainder as spam", () => {
  const contactRows = [
    row("lead-source", "2026-08-01T00:00:00Z", { form_key: "contact" }),
    row("spam-source", "2026-08-02T00:00:00Z", { form_key: "contact", email: "spam@example.com" }),
    row("capture", "2026-08-03T00:00:00Z", { form_key: "email_capture", email: "updates@example.com" }),
  ]
  const existingSubmissions = [{ id: "existing-dashboard-id", type: "contact", sourceForm: "contact", date: "2026-08-01T00:00:00.000Z", email: "GUEST@example.com" }]
  const existingSummary = { rawRows: 2, visibleRows: 1, filteredRows: 1, contactRows: 2, bookingRows: 0, excludedEmailCaptureRows: 1 }
  const result = seedExisting({ contactRows, bookingRows: [], existingSubmissions, existingSummary, exportedAt: "2026-08-04T00:00:00Z" })
  assert.equal(result.manifest.decisions["xvzarybk:lead-source"].dashboardId, "existing-dashboard-id")
  assert.equal(result.manifest.decisions["xvzarybk:spam-source"].classification, "spam")
  assert.equal(result.manifest.decisions["xvzarybk:capture"].classification, "email_capture")
  assert.deepEqual(result.summary, { ...existingSummary, exportedAt: "2026-08-04T00:00:00.000Z", reviewRows: 0, sourceFiles: result.summary.sourceFiles })

  const ambiguous = [...contactRows, row("lead-source-copy", "2026-08-01T00:00:00Z", { form_key: "contact" })]
  assert.throws(
    () => seedExisting({ contactRows: ambiguous, bookingRows: [], existingSubmissions, existingSummary: { ...existingSummary, rawRows: 3, contactRows: 3, filteredRows: 2 }, exportedAt: "2026-08-04T00:00:00Z" }),
    /has 2 exact source matches/,
  )
  assert.throws(
    () => seedExisting({ contactRows, bookingRows: [], existingSubmissions, existingSummary: { ...existingSummary, rawRows: 999 }, exportedAt: "2026-08-04T00:00:00Z" }),
    /does not match complete exports/,
  )
})

test("reports a zero-delta complete reconciliation", () => {
  const contactRows = [row("known", "2026-08-01T00:00:00Z")]
  const manifest = decidedManifest({ "xvzarybk:known": { classification: "spam" } })
  const result = reconcile({ contactRows, bookingRows: [], manifest, exportedAt: "2026-08-03T00:00:00Z" })
  assert.equal(result.delta.zeroDelta, true)
  assert.equal(result.summary.reviewRows, 0)
  assert.equal(result.summary.filteredRows, 1)
})

test("fails closed on changed immutable source content or unresolved apply", () => {
  const original = row("immutable", "2026-08-01T00:00:00Z", { message: "Original" })
  const first = reconcile({ contactRows: [original], bookingRows: [], manifest: freshManifest(), exportedAt: "2026-08-03T00:00:00Z" })
  assert.throws(() => renderSubmissionsModule(first), /Cannot apply with 1 unresolved row/)

  const changed = row("immutable", "2026-08-01T00:00:00Z", { message: "Changed later" })
  assert.throws(
    () => reconcile({ contactRows: [changed], bookingRows: [], manifest: first.manifest, exportedAt: "2026-08-03T00:00:00Z" }),
    /Source data changed for stable submission identity/,
  )
})

test("zero-delta apply preserves curated existing fields while mapping a new lead", () => {
  const normalizedLeads = [
    {
      id: "existing-id",
      type: "booking",
      name: "Grace Barfield",
      email: "grace@example.com",
      phone: "+1 713-553-4033",
      date: "2026-08-01T00:00:00.000Z",
      guests: "2 adults",
      sourceForm: "booking",
    },
    {
      id: "new-id",
      type: "contact",
      name: "New Guest",
      email: "new@example.com",
      date: "2026-08-02T00:00:00.000Z",
      message: "New enquiry",
      sourceForm: "contact",
    },
  ]
  const curated = {
    id: "existing-id",
    type: "booking",
    name: "GRACE BARFIELD",
    email: "Grace@Example.com",
    phone: "(713) 553-4033",
    date: "2026-08-01T00:00:00Z",
    guests: "Two adults",
    message: " Curated spacing is preserved ",
    sourceForm: "booking",
  }
  const merged = mergeExistingSubmissions(normalizedLeads, [curated])
  assert.deepEqual(merged.map((lead) => lead.id), ["new-id", "existing-id"])
  assert.deepEqual(merged.find((lead) => lead.id === "existing-id"), curated)
  assert.deepEqual(merged.find((lead) => lead.id === "new-id"), normalizedLeads[1])
  assert.notEqual(merged.find((lead) => lead.id === "existing-id"), curated)
})

test("apply merge keeps Typeform held leads that are not in Formspree exports", () => {
  const formspreeLead = {
    id: "existing-id",
    type: "booking",
    name: "Grace Barfield",
    email: "grace@example.com",
    date: "2026-08-01T00:00:00.000Z",
    sourceForm: "booking",
  }
  const heldLead = {
    id: "c-20260918-held-guest",
    type: "contact",
    name: "Held Guest",
    email: "held@example.com",
    phone: "+1 555-0100",
    date: "2026-09-18T12:42:18.000Z",
    message: "Typeform",
    sourceForm: "typeform",
  }
  const merged = mergeExistingSubmissions([formspreeLead], [heldLead, formspreeLead])
  assert.deepEqual(merged.map((lead) => lead.id), ["c-20260918-held-guest", "existing-id"])
  assert.deepEqual(merged.find((lead) => lead.id === "c-20260918-held-guest"), heldLead)
  assert.throws(
    () => mergeExistingSubmissions([{ ...formspreeLead, id: heldLead.id }], [heldLead]),
    /collides with a source row/,
  )
})

test("apply merge rejects duplicate IDs and changed exact source identity", () => {
  const lead = { id: "same-id", type: "contact", name: "Guest", email: "guest@example.com", date: "2026-08-01T00:00:00Z", sourceForm: "contact" }
  assert.throws(() => mergeExistingSubmissions([lead, { ...lead }], []), /maps to multiple source rows/)
  assert.throws(() => mergeExistingSubmissions([lead], [{ ...lead }, { ...lead }]), /is duplicated/)
  assert.throws(
    () => mergeExistingSubmissions([lead], [{ ...lead, email: "changed@example.com" }]),
    /no longer matches its exact source identity/,
  )
  assert.throws(() => mergeExistingSubmissions([], [lead]), /no longer maps to a source row/)
})
