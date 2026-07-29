import { Inbox } from "lucide-react";

import { SubmissionsView } from "@/components/submissions-view";
import { submissionImportSummary, submissions } from "@/data/submissions";

export default function Page() {
  const sorted = [...submissions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const reconciledDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(submissionImportSummary.exportedAt));

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <header className="mb-7 flex items-center gap-3 sm:mb-8">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2c7a4b]/10 text-[#2c7a4b] ring-1 ring-inset ring-[#2c7a4b]/15 sm:size-11">
            <Inbox className="size-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
              Form Submissions
            </h1>
            <p className="text-sm text-muted-foreground">
              Enquiries from canarycove.com
            </p>
          </div>
        </header>

        <SubmissionsView items={sorted} />

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          {submissionImportSummary.rawRows} raw Formspree rows ·{" "}
          {submissionImportSummary.visibleRows} guest enquiries ·{" "}
          {submissionImportSummary.filteredRows} spam/test rows filtered ·{" "}
          reconciled {reconciledDate}
        </footer>
      </div>
    </main>
  );
}
