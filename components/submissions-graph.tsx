"use client";

import * as React from "react";
import { TrendingUp, Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime, replyHref } from "@/lib/format";
import type { Submission, SubmissionType } from "@/data/submissions";

// ── Palette (Perplexity-Finance inspired) ──────────────────────────────
const LINE = "#2c7a4b"; // deep forest green
const AREA_TOP = "rgba(44,122,75,0.22)";
const AREA_BOT = "rgba(44,122,75,0.00)";
const VOL_BOOKING = "#74ab8c"; // sage green
const VOL_CONTACT = "#d79a9a"; // dusty rose
const GRID = "#ededea";
const AXIS_TEXT = "#8a8a82";

const DAY = 86_400_000;

// Responsive geometry: a wide, short viewBox on desktop; a narrower, taller
// one on mobile so the chart gets vertical room and axis text stays legible
// (text size is in viewBox units, so a narrower box renders larger text).
function useChartGeometry() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile
    ? {
        mobile,
        W: 440,
        H: 344,
        M: { left: 34, right: 12, top: 20 },
        PLOT_BOTTOM: 212,
        DASH_Y: 228,
        VOL_TOP: 240,
        VOL_BOTTOM: 312,
        X_LABEL_Y: 332,
        RIGHT: 440 - 12,
        axisFont: 13,
        barW: 7,
      }
    : {
        mobile,
        W: 820,
        H: 384,
        M: { left: 52, right: 20, top: 28 },
        PLOT_BOTTOM: 248,
        DASH_Y: 264,
        VOL_TOP: 278,
        VOL_BOTTOM: 348,
        X_LABEL_Y: 370,
        RIGHT: 820 - 20,
        axisFont: 11,
        barW: 7,
      };
}

function shortDate(t: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(t));
}

/** Smooth (midpoint-quadratic) path through points; stays well-behaved for
 *  monotonic data so the cumulative line never dips. */
function smoothLine(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    d += ` Q ${((mx + a.x) / 2).toFixed(2)},${a.y.toFixed(2)} ${mx.toFixed(
      2
    )},${my.toFixed(2)}`;
    d += ` Q ${((mx + b.x) / 2).toFixed(2)},${b.y.toFixed(2)} ${b.x.toFixed(
      2
    )},${b.y.toFixed(2)}`;
  }
  return d;
}

export function SubmissionsGraph({ items }: { items: Submission[] }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const {
    mobile,
    W,
    H,
    M,
    PLOT_BOTTOM,
    DASH_Y,
    VOL_TOP,
    VOL_BOTTOM,
    X_LABEL_Y,
    RIGHT,
    axisFont,
    barW,
  } = useChartGeometry();

  const model = React.useMemo(() => {
    const rows = items
      .map((s) => ({ ...s, t: new Date(s.date).getTime() }))
      .sort((a, b) => a.t - b.t);

    const n = rows.length;
    const tFirst = rows[0].t;
    const tLast = rows[n - 1].t;
    const span = Math.max(tLast - tFirst, DAY);
    const tMin = tFirst - span * 0.06;
    const tMax = tLast + span * 0.04;

    const xOf = (t: number) =>
      M.left + ((t - tMin) / (tMax - tMin)) * (RIGHT - M.left);
    const yOf = (v: number) =>
      PLOT_BOTTOM - (v / n) * (PLOT_BOTTOM - M.top);

    // Cumulative line points (prefix a baseline anchor at 0).
    const subPoints = rows.map((s, i) => ({
      x: xOf(s.t),
      y: yOf(i + 1),
      cum: i + 1,
      s,
    }));
    const linePts = [{ x: xOf(tMin), y: yOf(0) }, ...subPoints];

    // Per-day volume (booking vs contact).
    const byDay = new Map<
      string,
      { t: number; booking: number; contact: number }
    >();
    for (const s of rows) {
      const key = new Date(s.t).toISOString().slice(0, 10);
      const noon = new Date(`${key}T12:00:00Z`).getTime();
      const cur = byDay.get(key) ?? { t: noon, booking: 0, contact: 0 };
      cur[s.type as SubmissionType] += 1;
      byDay.set(key, cur);
    }
    const days = [...byDay.values()];
    const maxDay = Math.max(1, ...days.map((d) => d.booking + d.contact));

    // Y ticks (0 … n, ~4 nice steps).
    const yTicks = Array.from(
      new Set([0, Math.round(n / 3), Math.round((2 * n) / 3), n])
    );
    // X ticks (4 evenly spaced real dates).
    const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => tMin + (tMax - tMin) * f);

    // Recent momentum: submissions within trailing 14 days of the last one.
    const recent = rows.filter((s) => s.t >= tLast - 14 * DAY).length;

    // Stats.
    const bookings = rows.filter((s) => s.type === "booking").length;
    const contacts = rows.filter((s) => s.type === "contact").length;
    const uniquePeople = new Set(rows.map((s) => s.email.toLowerCase())).size;

    // Repeat enquirers (by email), most active first.
    const byEmail = new Map<string, { name: string; count: number }>();
    for (const s of rows) {
      const k = s.email.toLowerCase();
      const cur = byEmail.get(k) ?? { name: s.name, count: 0 };
      cur.count += 1;
      byEmail.set(k, cur);
    }
    const repeats = [...byEmail.entries()]
      .filter(([, v]) => v.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([email, v]) => ({ email, ...v }));

    return {
      rows,
      n,
      tFirst,
      tLast,
      xOf,
      yOf,
      subPoints,
      linePts,
      days,
      maxDay,
      yTicks,
      xTicks,
      recent,
      bookings,
      contacts,
      uniquePeople,
      repeats,
    };
    // Geometry is fully derived from `mobile`, so it covers all layout deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mobile]);

  const linePath = smoothLine(model.linePts);
  // Close the area down to the baseline along the first/last x of the line.
  const areaClosed = `${linePath} L ${model.linePts[
    model.linePts.length - 1
  ].x.toFixed(2)},${PLOT_BOTTOM} L ${model.linePts[0].x.toFixed(
    2
  )},${PLOT_BOTTOM} Z`;

  const hoverPt = hover != null ? model.subPoints[hover] : null;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    // Nearest submission point by x.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < model.subPoints.length; i++) {
      const d = Math.abs(model.subPoints[i].x - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  }

  const tooltipLeft = hoverPt
    ? Math.min(Math.max((hoverPt.x / W) * 100, 12), 88)
    : 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      {/* Header: big value + momentum + date range */}
      <div className="flex items-start justify-between gap-4 p-5 pb-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {model.n}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              submissions
            </span>
            <span
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: LINE }}
            >
              <TrendingUp className="size-4" />+{model.recent} in last 14 days
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {shortDate(model.tFirst)}, {new Date(model.tFirst).getUTCFullYear()}{" "}
            – {shortDate(model.tLast)},{" "}
            {new Date(model.tLast).getUTCFullYear()}
          </p>
        </div>
        <span className="hidden select-none pt-1 text-sm font-medium tracking-tight text-muted-foreground/70 sm:block">
          canary cove
        </span>
      </div>

      {/* Chart */}
      <div className="relative px-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AREA_TOP} />
              <stop offset="100%" stopColor={AREA_BOT} />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines + y labels */}
          {model.yTicks.map((v) => {
            const y = model.yOf(v);
            return (
              <g key={`y-${v}`}>
                <line
                  x1={M.left}
                  y1={y}
                  x2={RIGHT}
                  y2={y}
                  stroke={GRID}
                  strokeWidth={1}
                />
                <text
                  x={M.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={axisFont}
                  fill={AXIS_TEXT}
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* Vertical gridlines + x labels */}
          {model.xTicks.map((t, i) => {
            const x = model.xOf(t);
            return (
              <g key={`x-${i}`}>
                <line
                  x1={x}
                  y1={M.top}
                  x2={x}
                  y2={PLOT_BOTTOM}
                  stroke={GRID}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={X_LABEL_Y}
                  textAnchor="middle"
                  fontSize={axisFont}
                  fill={AXIS_TEXT}
                >
                  {shortDate(t)}
                </text>
              </g>
            );
          })}

          {/* Area + line */}
          <path d={areaClosed} fill="url(#areaFill)" />
          <path
            d={linePath}
            fill="none"
            stroke={LINE}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dashed separator above volume */}
          <line
            x1={M.left}
            y1={DASH_Y}
            x2={RIGHT}
            y2={DASH_Y}
            stroke="#c9c9c2"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Volume bars (stacked booking + contact) */}
          {model.days.map((d, i) => {
            const total = d.booking + d.contact;
            const fullH = (total / model.maxDay) * (VOL_BOTTOM - VOL_TOP);
            const bookingH = (d.booking / total) * fullH;
            const contactH = (d.contact / total) * fullH;
            const x = model.xOf(d.t) - barW / 2;
            let cursorY = VOL_BOTTOM;
            const rects: React.ReactNode[] = [];
            if (d.booking > 0) {
              cursorY -= bookingH;
              rects.push(
                <rect
                  key="b"
                  x={x}
                  y={cursorY}
                  width={barW}
                  height={bookingH}
                  rx={1.5}
                  fill={VOL_BOOKING}
                />
              );
            }
            if (d.contact > 0) {
              cursorY -= contactH;
              rects.push(
                <rect
                  key="c"
                  x={x}
                  y={cursorY}
                  width={barW}
                  height={contactH}
                  rx={1.5}
                  fill={VOL_CONTACT}
                />
              );
            }
            return <g key={`v-${i}`}>{rects}</g>;
          })}

          {/* Hover crosshair + dot */}
          {hoverPt && (
            <g pointerEvents="none">
              <line
                x1={hoverPt.x}
                y1={M.top}
                x2={hoverPt.x}
                y2={VOL_BOTTOM}
                stroke="#b9b9b1"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={hoverPt.x}
                cy={hoverPt.y}
                r={4.5}
                fill={LINE}
                stroke="#fff"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {/* Hover tooltip (HTML overlay for crisp text) */}
        {hoverPt && (
          <div
            className="pointer-events-none absolute top-3 z-10 -translate-x-1/2 rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur"
            style={{ left: `${tooltipLeft}%` }}
          >
            <div className="font-medium tabular-nums">
              {formatDateTime(hoverPt.s.date).full}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block size-2 rounded-full"
                style={{
                  background:
                    hoverPt.s.type === "booking" ? VOL_BOOKING : VOL_CONTACT,
                }}
              />
              {hoverPt.s.name} · {hoverPt.s.type}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              #{hoverPt.cum} of {model.n} cumulative
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 pb-1 pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ background: VOL_BOOKING }}
          />
          Booking
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ background: VOL_CONTACT }}
          />
          Contact
        </span>
        <span className="ml-auto">daily volume · cumulative total</span>
      </div>

      {/* Stats grid (3 cols × 2 rows on sm+) */}
      <div className="mt-3 grid grid-cols-1 border-t sm:grid-cols-3">
        <Stat
          label="Total Submissions"
          value={model.n}
          className="border-b sm:border-r"
        />
        <Stat
          label="Bookings"
          value={model.bookings}
          className="border-b sm:border-r"
        />
        <Stat label="Contacts" value={model.contacts} className="border-b" />
        <Stat
          label="Unique People"
          value={model.uniquePeople}
          className="border-b sm:border-b-0 sm:border-r"
        />
        <Stat
          label="First"
          value={`${shortDate(model.tFirst)}, ${new Date(
            model.tFirst
          ).getUTCFullYear()}`}
          className="border-b sm:border-b-0 sm:border-r"
        />
        <Stat
          label="Latest"
          value={`${shortDate(model.tLast)}, ${new Date(
            model.tLast
          ).getUTCFullYear()}`}
        />
      </div>

      {/* Notable: repeat enquirers */}
      {model.repeats.length > 0 && (
        <div className="border-t p-5">
          <h3 className="mb-3 text-sm font-medium">Repeat enquirers</h3>
          <div className="flex flex-wrap gap-2">
            {model.repeats.map((r) => (
              <a
                key={r.email}
                href={replyHref({
                  name: r.name,
                  email: r.email,
                } as Submission)}
                className="group/chip inline-flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-3 pr-2 text-sm transition-all duration-200 hover:-translate-y-px hover:border-[#2c7a4b]/30 hover:bg-[#2c7a4b]/10 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`Reply to ${r.name}`}
              >
                <Mail className="size-3.5 text-muted-foreground transition-colors group-hover/chip:text-[#2c7a4b]" />
                <span className="font-medium transition-colors group-hover/chip:text-[#2c7a4b]">
                  {r.name}
                </span>
                <span className="rounded-full bg-background px-1.5 text-xs font-semibold tabular-nums">
                  ×{r.count}
                </span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Multiple submissions from the same email — likely still awaiting a
            reply.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-3.5",
        className
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
