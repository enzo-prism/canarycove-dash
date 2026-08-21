#!/usr/bin/env node
import { readFile, rename, mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { FORM_IDS, freshManifest, reconcile, renderSubmissionsModule, rowsFromCompleteExport, seedExisting } from "./reconcile.mjs"

function usage() {
  return `Usage:
  pnpm leads:reconcile -- --contact <complete-export.json> --booking <complete-export.json> [options]

Options:
  --manifest <path>  Private decision manifest (default: data/private/formspree-reconciliation.json)
  --exported-at <ISO> Export timestamp; defaults to the later export's exportedAt
  --write             Save new review decisions to the private manifest
  --apply             Write the manifest and regenerate data/submissions.ts (requires zero review rows)
  --seed-existing     Strictly seed a new manifest from the current dashboard and summary
  --help              Show this help

The default is a dry run. This command only reads saved exports; it never sends
email, submits a form, changes Formspree settings, deploys, or pushes git commits.`
}

function parseArgs(argv) {
  const options = { manifest: "data/private/formspree-reconciliation.json", write: false, apply: false, seed_existing: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help") options.help = true
    else if (arg === "--write") options.write = true
    else if (arg === "--apply") options.apply = true
    else if (arg === "--seed-existing") options.seed_existing = true
    else if (["--contact", "--booking", "--manifest", "--exported-at"].includes(arg)) {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`)
      options[arg.slice(2).replaceAll("-", "_")] = value
      index += 1
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

async function optionalManifest(path) {
  try {
    return await json(path)
  } catch (error) {
    if (error?.code === "ENOENT") return freshManifest()
    throw error
  }
}

function exportTimestamp(bundle) {
  return bundle.exportedAt ?? bundle.exported_at ?? bundle.result?.exportedAt ?? bundle.result?.exported_at ?? bundle.result?.fetched_at
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, path)
}

async function atomicText(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, value)
  await rename(temporary, path)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (!options.contact || !options.booking) throw new Error("Both --contact and --booking complete exports are required")

  const contactBundle = await json(resolve(options.contact))
  const bookingBundle = await json(resolve(options.booking))
  const contactRows = rowsFromCompleteExport(contactBundle, FORM_IDS.contact)
  const bookingRows = rowsFromCompleteExport(bookingBundle, FORM_IDS.booking)
  const exportedAt = options.exported_at ?? [exportTimestamp(contactBundle), exportTimestamp(bookingBundle)].filter(Boolean).sort().at(-1)
  const manifestPath = resolve(options.manifest)
  const manifest = await optionalManifest(manifestPath)
  const existing = options.seed_existing || options.apply
    ? await import(new URL(`../../data/submissions.ts?apply=${Date.now()}`, import.meta.url))
    : undefined
  let result
  if (options.seed_existing) {
    if (Object.keys(manifest.decisions).length) throw new Error("--seed-existing requires a new or empty private manifest")
    result = seedExisting({
      contactRows,
      bookingRows,
      existingSubmissions: existing?.submissions,
      existingSummary: existing?.submissionImportSummary,
      exportedAt,
    })
  } else {
    result = reconcile({ contactRows, bookingRows, manifest, exportedAt })
  }

  console.log(JSON.stringify({ mode: options.apply ? "apply" : options.write ? "write-manifest" : "dry-run", summary: result.summary, delta: result.delta, reviewKeys: result.reviewKeys }, null, 2))

  if (options.write || options.apply) await atomicJson(manifestPath, result.manifest)
  if (options.apply) {
    if (result.reviewKeys.length) throw new Error("Dashboard not changed: resolve every review row in the private manifest, then rerun --apply")
    await atomicText(resolve("data/submissions.ts"), renderSubmissionsModule(result, existing?.submissions))
  }
}

main().catch((error) => {
  console.error(`Canary Cove reconciliation failed: ${error.message}`)
  process.exitCode = 1
})
