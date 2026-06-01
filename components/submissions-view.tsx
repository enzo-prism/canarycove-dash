"use client";

import * as React from "react";
import {
  Mail,
  Phone,
  CalendarDays,
  Users,
  Send,
  CalendarCheck,
  MessageSquareText,
  LayoutList,
  Table2,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatTripDate,
  replyHref,
  telHref,
} from "@/lib/format";
import { SubmissionsGraph } from "@/components/submissions-graph";
import type { Submission } from "@/data/submissions";

type View = "list" | "table" | "graph";
const STORAGE_KEY = "cc-submissions-view";
const BRAND = "#2c7a4b";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, type }: { name: string; type: Submission["type"] }) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset transition-colors",
        type === "booking"
          ? "bg-[#2c7a4b]/10 text-[#2c7a4b] ring-[#2c7a4b]/15"
          : "bg-muted text-muted-foreground ring-border"
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

function TypeBadge({ type }: { type: Submission["type"] }) {
  const isBooking = type === "booking";
  const Icon = isBooking ? CalendarCheck : MessageSquareText;
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1 capitalize",
        isBooking
          ? "border-transparent bg-[#2c7a4b] text-white"
          : "text-muted-foreground"
      )}
    >
      <Icon className="size-3" />
      {type}
    </Badge>
  );
}

function ViewTabs({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  const options: { value: View; label: string; Icon: typeof LayoutList }[] = [
    { value: "list", label: "List", Icon: LayoutList },
    { value: "table", label: "Table", Icon: Table2 },
    { value: "graph", label: "Graph", Icon: BarChart3 },
  ];
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="flex items-center gap-1 border-b"
    >
      {options.map(({ value, label, Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(value)}
            className={cn(
              "group -mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 pb-2.5 pt-1.5 text-[15px] font-medium transition-colors duration-200",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4 transition-colors",
                active ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground"
              )}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ListView({ items }: { items: Submission[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((s) => {
        const { full } = formatDateTime(s.date);
        return (
          <Card
            key={s.id}
            className="transition-all duration-200 hover:border-foreground/15 hover:shadow-md"
          >
            <CardHeader className="gap-2 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} type={s.type} />
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {full}
                    </span>
                  </div>
                </div>
                <TypeBadge type={s.type} />
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 text-sm">
                <a
                  href={`mailto:${s.email}`}
                  className="group/link inline-flex w-fit items-center gap-2 rounded-sm text-foreground transition-colors hover:text-[#2c7a4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Mail className="size-4 text-muted-foreground transition-colors group-hover/link:text-[#2c7a4b]" />
                  {s.email}
                </a>
                {s.phone && (
                  <a
                    href={telHref(s.phone)}
                    className="group/link inline-flex w-fit items-center gap-2 rounded-sm text-foreground transition-colors hover:text-[#2c7a4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Phone className="size-4 text-muted-foreground transition-colors group-hover/link:text-[#2c7a4b]" />
                    {s.phone}
                  </a>
                )}
              </div>

              {(s.arrival || s.guests) && (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  {s.arrival && s.departure && (
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="size-4 text-muted-foreground" />
                      {formatTripDate(s.arrival)} → {formatTripDate(s.departure)}
                    </span>
                  )}
                  {s.guests && (
                    <span className="inline-flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      {s.guests}
                    </span>
                  )}
                </div>
              )}

              {s.message && (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {s.message}
                </p>
              )}

              <div className="flex justify-end">
                <Button asChild size="sm" className="group/btn">
                  <a href={replyHref(s)}>
                    <Send className="size-4 transition-transform duration-200 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
                    Reply by email
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TableView({ items }: { items: Submission[] }) {
  return (
    <>
      {/* Mobile: compact cards (a dense table can't fit on a phone) */}
      <div className="flex flex-col gap-3 sm:hidden">
        {items.map((s) => {
          const { date, time } = formatDateTime(s.date);
          return (
            <div
              key={s.id}
              className="rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:border-foreground/15 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {date} · {time} UTC
                  </div>
                </div>
                <TypeBadge type={s.type} />
              </div>

              <div className="mt-3 flex flex-col gap-1 text-sm">
                <a
                  href={`mailto:${s.email}`}
                  className="group/link inline-flex w-fit max-w-full items-center gap-2 truncate text-foreground transition-colors hover:text-[#2c7a4b]"
                >
                  <Mail className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/link:text-[#2c7a4b]" />
                  <span className="truncate">{s.email}</span>
                </a>
                {s.phone && (
                  <a
                    href={telHref(s.phone)}
                    className="group/link inline-flex w-fit items-center gap-2 text-muted-foreground transition-colors hover:text-[#2c7a4b]"
                  >
                    <Phone className="size-4 shrink-0 transition-colors group-hover/link:text-[#2c7a4b]" />
                    {s.phone}
                  </a>
                )}
              </div>

              {s.arrival && s.departure && (
                <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0" />
                  {formatTripDate(s.arrival)} → {formatTripDate(s.departure)}
                  {s.guests && <span>· {s.guests}</span>}
                </div>
              )}

              {s.message && (
                <p className="mt-2 line-clamp-2 text-sm text-foreground/90">
                  {s.message}
                </p>
              )}

              <Button asChild size="sm" className="group/btn mt-3 w-full">
                <a href={replyHref(s)}>
                  <Send className="size-4 transition-transform duration-200 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
                  Reply by email
                </a>
              </Button>
            </div>
          );
        })}
      </div>

      {/* Desktop / tablet: full data table */}
      <Card className="hidden overflow-hidden sm:block">
        <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[92px]">Type</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-[112px]">Contacted</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Trip</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="w-[60px] text-right">Reply</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => {
            const { date, time } = formatDateTime(s.date);
            return (
              <TableRow key={s.id} className="group/row">
                <TableCell>
                  <TypeBadge type={s.type} />
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <div>{date}</div>
                  <div className="text-xs">{time} UTC</div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[170px] flex-col gap-0.5">
                    <a
                      href={`mailto:${s.email}`}
                      className="w-fit max-w-full truncate rounded-sm transition-colors hover:text-[#2c7a4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={s.email}
                    >
                      {s.email}
                    </a>
                    {s.phone && (
                      <a
                        href={telHref(s.phone)}
                        className="w-fit whitespace-nowrap rounded-sm text-muted-foreground transition-colors hover:text-[#2c7a4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {s.phone}
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.arrival && s.departure ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="whitespace-nowrap">
                        {formatTripDate(s.arrival)} → {formatTripDate(s.departure)}
                      </span>
                      {s.guests && (
                        <span className="text-xs">{s.guests}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.message ? (
                    <p
                      className="line-clamp-3 max-w-[260px] text-foreground/90"
                      title={s.message}
                    >
                      {s.message}
                    </p>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    asChild
                    size="icon"
                    variant="outline"
                    className="group/btn size-8 text-muted-foreground transition-all duration-200 hover:border-[#2c7a4b]/30 hover:bg-[#2c7a4b]/10 hover:text-[#2c7a4b] group-hover/row:border-foreground/20"
                  >
                    <a
                      href={replyHref(s)}
                      aria-label={`Reply by email to ${s.name}`}
                      title="Reply by email"
                    >
                      <Send className="size-4 transition-transform duration-200 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </Card>
    </>
  );
}

export function SubmissionsView({ items }: { items: Submission[] }) {
  const [view, setView] = React.useState<View>("list");

  // Restore the last-used view from localStorage after mount.
  React.useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "table" || saved === "graph")
      setView(saved);
  }, []);

  const changeView = React.useCallback((v: View) => {
    setView(v);
    window.localStorage.setItem(STORAGE_KEY, v);
  }, []);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <ViewTabs view={view} onChange={changeView} />
        <Badge variant="secondary" className="mb-2 shrink-0">
          {items.length} total
        </Badge>
      </div>

      {view === "list" && <ListView items={items} />}
      {view === "table" && <TableView items={items} />}
      {view === "graph" && <SubmissionsGraph items={items} />}
    </>
  );
}
