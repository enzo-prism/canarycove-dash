import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

async function applyFixture(t, { manifest, existing, corrections, expectedStatus = 1, splitData = false }) {
  const root = await mkdtemp(join(tmpdir(), "canary-apply-test-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, "scripts/canary-leads"), { recursive: true })
  await mkdir(join(root, "data/private"), { recursive: true })
  for (const filename of ["cli.mjs", "reconcile.mjs"]) {
    await copyFile(new URL(filename, import.meta.url), join(root, "scripts/canary-leads", filename))
  }
  await writeFile(join(root, "package.json"), '{"type":"module"}\n')
  const manifestPath = join(root, "data/private/formspree-reconciliation.json")
  const dashboardPath = join(root, "data/submissions.ts")
  await writeFile(manifestPath, JSON.stringify(manifest))
  if (splitData) {
    await writeFile(join(root, "data/submissions-fixture.ts"), `export const fixtureRows = ${JSON.stringify(existing)};\n`)
    await writeFile(dashboardPath, 'import { fixtureRows } from "./submissions-fixture";\nexport const submissions = fixtureRows;\n')
  } else {
    await writeFile(dashboardPath, `export const submissions = ${JSON.stringify(existing)};\n`)
  }
  await writeFile(join(root, "contact.json"), JSON.stringify({
    formId: "xvzarybk", complete: true,
    submissions: [{ id: "known", submittedAt: "2026-08-01T00:00:00Z", data: { name: "Guest", email: "guest@example.com" } }],
  }))
  await writeFile(join(root, "booking.json"), JSON.stringify({ formId: "xqeqllek", complete: true, submissions: [] }))
  if (corrections !== undefined) await writeFile(join(root, "corrections.json"), JSON.stringify(corrections))
  const before = await Promise.all([readFile(manifestPath, "utf8"), readFile(dashboardPath, "utf8")])
  const run = spawnSync(process.execPath, [
    "scripts/canary-leads/cli.mjs", "--contact", "contact.json", "--booking", "booking.json",
    "--exported-at", "2026-08-02T00:00:00Z", "--apply",
    ...(corrections !== undefined ? ["--identity-corrections", "corrections.json"] : []),
  ], { cwd: root, encoding: "utf8" })
  assert.equal(run.status, expectedStatus, run.stderr)
  const after = await Promise.all([readFile(manifestPath, "utf8"), readFile(dashboardPath, "utf8")])
  if (expectedStatus !== 0) assert.deepEqual(after, before)
  return { ...run, dashboard: after[1], manifest: JSON.parse(after[0]) }
}

test("apply leaves both files unchanged when a new row still needs review", async (t) => {
  const run = await applyFixture(t, { manifest: { version: 1, decisions: {} }, existing: [] })
  assert.match(run.stderr, /resolve every review row/)
})

test("apply validates curated source identities before writing the manifest", async (t) => {
  const run = await applyFixture(t, {
    manifest: { version: 1, decisions: { "xvzarybk:known": { classification: "lead", dashboardId: "existing" } } },
    existing: [{ id: "existing", type: "contact", sourceForm: "contact", date: "2026-08-01T00:00:00Z", name: "Guest", email: "different@example.com" }],
  })
  assert.match(run.stderr, /no longer matches its exact source identity/)
})

const correctionFixture = {
  manifest: { version: 1, decisions: { "xvzarybk:known": { classification: "lead", dashboardId: "existing" } } },
  existing: [{ id: "existing", type: "contact", sourceForm: "contact", date: "2026-08-01T00:00:01Z", name: "Curated Guest", email: "Guest@Example.com", message: "Preserve this display text" }],
}
const validCorrection = { dashboardId: "existing", fromDate: "2026-08-01T00:00:01Z", toDate: "2026-08-01T00:00:00.000Z", sourceKey: "xvzarybk:known" }

test("explicit exact source correction preserves dashboard ID and curated fields", async (t) => {
  const run = await applyFixture(t, { ...correctionFixture, corrections: [validCorrection], expectedStatus: 0 })
  assert.equal(JSON.parse(run.stdout).correctionCount, 1)
  assert.match(run.dashboard, /"id": "existing"/)
  assert.match(run.dashboard, /"date": "2026-08-01T00:00:00.000Z"/)
  assert.match(run.dashboard, /"name": "Curated Guest"/)
  assert.match(run.dashboard, /"message": "Preserve this display text"/)
})

test("invalid identity correction fails before changing either output", async (t) => {
  const run = await applyFixture(t, { ...correctionFixture, corrections: [{ ...validCorrection, fromDate: "2026-08-01T00:00:02Z" }] })
  assert.match(run.stderr, /dates do not exactly match/)
})

test("apply loads split TypeScript data with extensionless relative imports", async (t) => {
  const run = await applyFixture(t, { ...correctionFixture, corrections: [validCorrection], expectedStatus: 0, splitData: true })
  assert.equal(JSON.parse(run.stdout).correctionCount, 1)
  assert.match(run.dashboard, /"id": "existing"/)
  assert.match(run.dashboard, /"date": "2026-08-01T00:00:00.000Z"/)
})
