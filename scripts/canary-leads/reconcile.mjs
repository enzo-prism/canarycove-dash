import { createHash } from "node:crypto"

export const FORM_IDS = Object.freeze({
  contact: "xvzarybk",
  booking: "xqeqllek",
})

const CLASSIFICATIONS = new Set(["lead", "spam", "email_capture", "review"])
const APPROVED_READER_ROWS = Symbol("approvedFormspreeReaderRows")

function text(value) {
  if (value === null || value === undefined) return undefined
  const result = String(value).trim()
  return result || undefined
}

function first(object, keys) {
  for (const key of keys) {
    const value = text(object?.[key])
    if (value !== undefined) return value
  }
  return undefined
}

function pageNumber(object, keys) {
  const value = first(object, keys)
  return value === undefined ? undefined : Number(value)
}

function pageRows(page) {
  const rows = page?.submissions ?? page?.results ?? page?.items
  if (!Array.isArray(rows)) throw new Error("Every export page must contain a submissions array")
  return rows
}

/**
 * Accepts the canonical complete-export bundle documented in README.md. A raw
 * one-page Formspree response is accepted only when its pagination proves that
 * it is the sole page. Naked arrays are deliberately rejected.
 */
export function rowsFromCompleteExport(bundle, expectedFormId) {
  if (!bundle || Array.isArray(bundle) || typeof bundle !== "object") {
    throw new Error("Export must be an object with completeness metadata; naked row arrays are unsafe")
  }

  if (bundle.form && typeof bundle.form === "object" && bundle.result) {
    const readerFormId = first(bundle.form, ["hashid"])
    if (readerFormId !== expectedFormId) {
      throw new Error(`Reader export form ${readerFormId ?? "missing"} does not match expected form ${expectedFormId}`)
    }
    const submissions = bundle.result?.submissions
    const fetchedPages = bundle.result?.fetched_pages
    const fetchedCount = bundle.result?.fetched_count
    if (!Array.isArray(submissions)) throw new Error("Reader export result.submissions must be an array")
    if (!Number.isInteger(fetchedPages) || fetchedPages < 1) {
      throw new Error("Reader export fetched_pages must be a positive integer")
    }
    if (!Number.isInteger(fetchedCount) || fetchedCount !== submissions.length) {
      throw new Error("Reader export fetched_count must exactly match submissions.length")
    }
    Object.defineProperty(submissions, APPROVED_READER_ROWS, { value: true })
    return submissions
  }

  const formId = first(bundle, ["formId", "form_id", "form"])
  if (formId && formId !== expectedFormId) {
    throw new Error(`Export form ${formId} does not match expected form ${expectedFormId}`)
  }

  if (Array.isArray(bundle.pages)) {
    if (bundle.pages.length === 0) throw new Error("Complete export must include at least one page")
    const declaredTotal = pageNumber(bundle, ["totalPages", "total_pages"]) ?? pageNumber(bundle.pages[0], ["totalPages", "total_pages", "last_page"])
    if (!Number.isInteger(declaredTotal) || declaredTotal < 1) {
      throw new Error("Paged export must declare totalPages")
    }
    if (bundle.pages.length !== declaredTotal) {
      throw new Error(`Incomplete export: received ${bundle.pages.length} of ${declaredTotal} pages`)
    }

    const seen = new Set()
    const rows = []
    for (const page of bundle.pages) {
      const number = pageNumber(page, ["page", "currentPage", "current_page"])
      if (!Number.isInteger(number) || number < 1 || number > declaredTotal || seen.has(number)) {
        throw new Error("Paged export has a missing, duplicate, or invalid page number")
      }
      const pageTotal = pageNumber(page, ["totalPages", "total_pages", "last_page"])
      if (pageTotal !== undefined && pageTotal !== declaredTotal) {
        throw new Error("Paged export has inconsistent totalPages metadata")
      }
      seen.add(number)
      rows.push(...pageRows(page))
    }
    for (let page = 1; page <= declaredTotal; page += 1) {
      if (!seen.has(page)) throw new Error(`Incomplete export: page ${page} is missing`)
    }
    return rows
  }

  const rows = pageRows(bundle)
  if (bundle.complete === true) return rows

  const currentPage = pageNumber(bundle, ["page", "currentPage", "current_page"])
  const totalPages = pageNumber(bundle, ["totalPages", "total_pages", "last_page"])
  if (currentPage === 1 && totalPages === 1) return rows

  throw new Error("Export completeness is not proven; use complete:true or save every declared page")
}

function rowPayload(row) {
  const payload = row?.data ?? row?.payload ?? row
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Submission data must be an object")
  }
  return payload
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]))
  }
  return value
}

function fingerprint(row) {
  return JSON.stringify(canonicalValue(row))
}

function sourceHash(row) {
  return createHash("sha256").update(fingerprint(row)).digest("hex")
}

export function normalizeRows(rows, formType) {
  const formId = FORM_IDS[formType]
  if (!formId) throw new Error(`Unknown form type: ${formType}`)
  const unique = new Map()

  const approvedReaderRows = rows[APPROVED_READER_ROWS] === true
  for (const row of rows) {
    const providerId = first(row, ["id", "_id", "submission_id", "submissionId"])
    const submittedAt = first(row, ["submittedAt", "submitted_at", "createdAt", "created_at", "timestamp", "date", "_date"])
    if (!submittedAt || Number.isNaN(Date.parse(submittedAt))) {
      throw new Error(`Every ${formId} row needs a valid submission timestamp`)
    }
    const data = rowPayload(row)
    const explicitForm = first(data, ["form_key", "formKey"])
    if (explicitForm && ![formType, "email_capture"].includes(explicitForm)) {
      throw new Error(`Submission ${providerId} has unexpected form_key ${explicitForm}`)
    }
    if (formType === "booking" && explicitForm === "email_capture") {
      throw new Error(`Booking form submission ${providerId} cannot be email_capture`)
    }

    const normalizedDate = new Date(submittedAt).toISOString()
    let key
    let identity
    if (providerId) {
      key = `${formId}:${providerId}`
      identity = "provider-id"
    } else if (approvedReaderRows) {
      const email = first(data, ["email", "_replyto"])?.toLowerCase()
      if (!email) throw new Error(`Approved reader row for ${formId} without a provider ID requires an email`)
      const digest = createHash("sha256").update(`${formId}\n${normalizedDate}\n${email}`).digest("hex")
      key = `${formId}:fallback:${digest}`
      identity = "timestamp-email-fallback"
    } else {
      throw new Error(`Every canonical ${formId} row needs an immutable provider ID`)
    }
    const normalized = { key, formId, formType, providerId, submittedAt: normalizedDate, data, identity }
    const prior = unique.get(key)
    if (prior && identity === "timestamp-email-fallback") {
      throw new Error(`Ambiguous approved-reader fallback identity for ${key}`)
    }
    if (prior && fingerprint(prior) !== fingerprint(normalized)) {
      throw new Error(`Conflicting duplicate submission ${key}`)
    }
    unique.set(key, normalized)
  }

  return [...unique.values()].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.key.localeCompare(b.key))
}

function automaticClassification(row) {
  const formKey = first(row.data, ["form_key", "formKey"])
  const leadSource = first(row.data, ["lead_source", "leadSource", "source"])
  if (formKey === "email_capture" || leadSource === "email_capture" || leadSource === "Homepage updates signup") {
    return "email_capture"
  }
  const codexTest = first(row.data, ["_codex_test", "codex_test"])
  if (codexTest?.toLowerCase() === "true") return "spam"
  return "review"
}

function isEmailCapture(row) {
  return automaticClassification(row) === "email_capture"
}

function dashboardId(row) {
  const prefix = row.formType === "booking" ? "b" : "c"
  const day = row.submittedAt.slice(0, 10).replaceAll("-", "")
  const digest = createHash("sha256").update(row.key).digest("hex").slice(0, 12)
  return `${prefix}-${day}-${digest}`
}

export function freshManifest() {
  return { version: 1, decisions: {} }
}

export function reconcile({ contactRows, bookingRows, manifest = freshManifest(), exportedAt }) {
  if (manifest?.version !== 1 || !manifest.decisions || typeof manifest.decisions !== "object") {
    throw new Error("Manifest must have version 1 and a decisions object")
  }
  if (!exportedAt || Number.isNaN(Date.parse(exportedAt))) throw new Error("A valid exportedAt timestamp is required")

  const normalizedContactRows = normalizeRows(contactRows, "contact")
  const normalizedBookingRows = normalizeRows(bookingRows, "booking")
  const rows = [...normalizedContactRows, ...normalizedBookingRows]
  const seenKeys = new Set()
  const next = structuredClone(manifest)
  let newDecisionRows = 0

  for (const row of rows) {
    seenKeys.add(row.key)
    let decision = next.decisions[row.key]
    if (!decision) {
      decision = { classification: automaticClassification(row), sourceHash: sourceHash(row) }
      if (decision.classification === "lead") decision.dashboardId = dashboardId(row)
      next.decisions[row.key] = decision
      newDecisionRows += 1
    } else if (decision.sourceHash && decision.sourceHash !== sourceHash(row)) {
      throw new Error(`Source data changed for stable submission identity ${row.key}`)
    } else if (!decision.sourceHash) {
      decision.sourceHash = sourceHash(row)
    }
    if (!CLASSIFICATIONS.has(decision.classification)) {
      throw new Error(`Invalid classification for ${row.key}: ${decision.classification}`)
    }
    const automatic = automaticClassification(row)
    if (automatic === "email_capture" && decision.classification !== "email_capture") {
      throw new Error(`Submission ${row.key} is explicitly email_capture and must remain separate`)
    }
    if (automatic === "spam" && decision.classification === "lead") {
      throw new Error(`Submission ${row.key} is explicitly ${automatic} and cannot be classified as a lead`)
    }
    if (decision.classification === "lead" && !decision.dashboardId) decision.dashboardId = dashboardId(row)
  }

  const staleManifestKeys = Object.keys(next.decisions).filter((key) => !seenKeys.has(key)).sort()
  if (staleManifestKeys.length) {
    throw new Error(`Complete exports are missing ${staleManifestKeys.length} manifest submission(s): ${staleManifestKeys.join(", ")}`)
  }

  const classified = rows.map((row) => ({ ...row, decision: next.decisions[row.key] }))
  const leads = classified.filter((row) => row.decision.classification === "lead")
  const review = classified.filter((row) => row.decision.classification === "review")
  const spam = classified.filter((row) => row.decision.classification === "spam")
  const emailCapture = classified.filter(isEmailCapture)
  const contactOperationalRows = normalizedContactRows.filter((row) => !isEmailCapture(row))
  const dashboardIds = leads.map((row) => row.decision.dashboardId)
  if (new Set(dashboardIds).size !== dashboardIds.length) {
    throw new Error("Lead decisions contain duplicate dashboard IDs")
  }

  const summary = {
    exportedAt: new Date(exportedAt).toISOString(),
    rawRows: contactOperationalRows.length + normalizedBookingRows.length,
    visibleRows: leads.length,
    filteredRows: spam.length,
    contactRows: contactOperationalRows.length,
    bookingRows: normalizedBookingRows.length,
    excludedEmailCaptureRows: emailCapture.length,
    reviewRows: review.length,
    sourceFiles: [
      `Formspree API ${FORM_IDS.contact} contact complete export`,
      `Formspree API ${FORM_IDS.booking} booking complete export`,
    ],
  }

  return {
    manifest: next,
    summary,
    leads: leads.map(toSubmission),
    reviewKeys: review.map((row) => row.key),
    delta: { newDecisionRows, zeroDelta: newDecisionRows === 0 },
  }
}

function matchKey(formType, submittedAt, email) {
  const normalizedEmail = text(email)?.toLowerCase()
  if (!normalizedEmail) return undefined
  const parsedDate = Date.parse(submittedAt)
  if (Number.isNaN(parsedDate)) return undefined
  return `${formType}:${new Date(parsedDate).toISOString()}:${normalizedEmail}`
}

/**
 * Builds the one-time private baseline from already-curated dashboard rows.
 * Matching deliberately uses only the documented fallback identity. No fuzzy
 * match is permitted and every historical count must reconcile first.
 */
export function seedExisting({ contactRows, bookingRows, existingSubmissions, existingSummary, exportedAt }) {
  if (!Array.isArray(existingSubmissions) || !existingSummary) {
    throw new Error("Existing dashboard submissions and summary are required for seeding")
  }
  const contact = normalizeRows(contactRows, "contact")
  const booking = normalizeRows(bookingRows, "booking")
  const captures = contact.filter(isEmailCapture)
  const operational = [...contact.filter((row) => !isEmailCapture(row)), ...booking]
  const expected = {
    rawRows: operational.length,
    visibleRows: existingSubmissions.length,
    filteredRows: operational.length - existingSubmissions.length,
    contactRows: contact.length - captures.length,
    bookingRows: booking.length,
    excludedEmailCaptureRows: captures.length,
  }
  for (const [field, value] of Object.entries(expected)) {
    if (existingSummary[field] !== value) {
      throw new Error(`Cannot seed: existing summary ${field}=${existingSummary[field]} does not match complete exports (${value})`)
    }
  }

  const sourceByFallback = new Map()
  for (const row of operational) {
    const key = matchKey(row.formType, row.submittedAt, first(row.data, ["email", "_replyto"]))
    if (!key) throw new Error(`Cannot seed: source row ${row.key} lacks a valid fallback identity`)
    const matches = sourceByFallback.get(key) ?? []
    matches.push(row)
    sourceByFallback.set(key, matches)
  }

  const decisions = {}
  const usedSourceKeys = new Set()
  for (const current of existingSubmissions) {
    const formType = current.sourceForm ?? current.type
    if (!["contact", "booking"].includes(formType)) {
      throw new Error(`Cannot seed: dashboard row ${current.id ?? "missing-id"} has no valid source form`)
    }
    const key = matchKey(formType, current.date, current.email)
    const matches = key ? sourceByFallback.get(key) ?? [] : []
    if (matches.length !== 1) {
      throw new Error(`Cannot seed: dashboard row ${current.id ?? "missing-id"} has ${matches.length} exact source matches`)
    }
    const source = matches[0]
    if (!current.id || usedSourceKeys.has(source.key)) {
      throw new Error(`Cannot seed: dashboard/source match is missing an ID or reused (${source.key})`)
    }
    usedSourceKeys.add(source.key)
    decisions[source.key] = { classification: "lead", dashboardId: current.id, sourceHash: sourceHash(source) }
  }

  for (const row of operational) {
    if (!decisions[row.key]) decisions[row.key] = { classification: "spam", sourceHash: sourceHash(row) }
  }
  for (const row of captures) {
    decisions[row.key] = { classification: "email_capture", sourceHash: sourceHash(row) }
  }

  const result = reconcile({ contactRows, bookingRows, manifest: { version: 1, decisions }, exportedAt })
  if (result.summary.visibleRows !== existingSubmissions.length || result.summary.filteredRows !== existingSummary.filteredRows) {
    throw new Error("Cannot seed: final reconciliation does not preserve the existing dashboard summary")
  }
  return result
}

function toSubmission(row) {
  const data = row.data
  const explicitName = first(data, ["name", "full_name", "fullName"])
  const firstName = first(data, ["firstName", "first_name"])
  const lastName = first(data, ["lastName", "last_name"])
  const name = (explicitName ?? [firstName, lastName].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim()
  const email = first(data, ["email", "_replyto"])
  if (!name || !email) {
    throw new Error(`Lead ${row.key} is missing a name or email and cannot be applied safely`)
  }
  const adultGuests = first(data, ["adultGuests", "adult_guests"])
  let guests = first(data, ["guests", "guest_count"])
  if (adultGuests !== undefined) {
    if (!/^\d+$/.test(adultGuests)) {
      throw new Error(`Lead ${row.key} has an invalid adultGuests value`)
    }
    const adultCount = Number(adultGuests)
    if (!Number.isSafeInteger(adultCount) || adultCount < 1 || adultCount > 100) {
      throw new Error(`Lead ${row.key} has an implausible adultGuests value`)
    }
    const childGuests = first(data, ["childGuests", "child_guests"])
    const adultText = `${adultCount} ${adultCount === 1 ? "adult" : "adults"}`
    guests = childGuests && childGuests !== "0" ? `${adultText}, ${childGuests}` : adultText
  }
  const submission = {
    id: row.decision.dashboardId,
    type: row.formType,
    name,
    email,
    phone: first(data, ["phone", "telephone"]),
    date: row.submittedAt,
    message: first(data, ["message", "notes", "requests"]),
    arrival: first(data, ["arrival", "arrival_date", "check_in"]),
    departure: first(data, ["departure", "departure_date", "check_out"]),
    guests,
    pagePath: first(data, ["page_path", "pagePath"]),
    referral: first(data, ["referral", "lead_source"]),
    referrer: first(data, ["referrer"]),
    sourceForm: row.formType,
  }
  return Object.fromEntries(Object.entries(submission).filter(([, value]) => value !== undefined))
}

export function renderSubmissionsModule(result, existingSubmissions = []) {
  if (result.reviewKeys.length) {
    throw new Error(`Cannot apply with ${result.reviewKeys.length} unresolved row(s); classify them in the private manifest first`)
  }
  const mergedLeads = mergeExistingSubmissions(result.leads, existingSubmissions)
  const serializedSummary = JSON.stringify(result.summary, null, 2)
  const serializedLeads = JSON.stringify(mergedLeads, null, 2)
  return `// Generated by pnpm leads:reconcile --apply. Do not edit by hand.\n\nexport type SubmissionType = "booking" | "contact";\n\nexport interface Submission {\n  id: string;\n  type: SubmissionType;\n  name: string;\n  email: string;\n  phone?: string;\n  date: string;\n  message?: string;\n  arrival?: string;\n  departure?: string;\n  guests?: string;\n  pagePath?: string;\n  referral?: string;\n  referrer?: string;\n  sourceForm?: string;\n}\n\nexport const submissionImportSummary = ${serializedSummary} as const;\n\nexport const submissions: Submission[] = ${serializedLeads};\n`
}

/**
 * Preserves curated presentation fields for existing dashboard IDs while
 * requiring the documented source identity to remain exact. Output is
 * deterministically newest-first, matching the curated data file.
 */
export function mergeExistingSubmissions(normalizedLeads, existingSubmissions = []) {
  if (!Array.isArray(normalizedLeads) || !Array.isArray(existingSubmissions)) {
    throw new Error("Apply merge requires normalized and existing submission arrays")
  }
  const normalizedById = new Map()
  for (const lead of normalizedLeads) {
    if (!lead.id || normalizedById.has(lead.id)) {
      throw new Error(`Dashboard ID ${lead.id ?? "missing"} maps to multiple source rows`)
    }
    normalizedById.set(lead.id, lead)
  }

  const existingById = new Map()
  for (const existing of existingSubmissions) {
    if (!existing.id || existingById.has(existing.id)) {
      throw new Error(`Existing dashboard ID ${existing.id ?? "missing"} is duplicated`)
    }
    existingById.set(existing.id, existing)
  }

  for (const [id, existing] of existingById) {
    const normalized = normalizedById.get(id)
    if (!normalized) throw new Error(`Existing dashboard ID ${id} no longer maps to a source row`)
    const existingIdentity = matchKey(existing.sourceForm ?? existing.type, existing.date, existing.email)
    const normalizedIdentity = matchKey(normalized.sourceForm ?? normalized.type, normalized.date, normalized.email)
    if (!existingIdentity || existingIdentity !== normalizedIdentity) {
      throw new Error(`Existing dashboard ID ${id} no longer matches its exact source identity`)
    }
  }

  return normalizedLeads
    .map((lead) => structuredClone(existingById.get(lead.id) ?? lead))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id))
}
