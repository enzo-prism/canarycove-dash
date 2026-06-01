import type { Submission } from "@/data/submissions";

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
  return { date, time, full: `${date} · ${time} UTC` };
}

export function formatTripDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function replyHref(s: Submission) {
  const subject = encodeURIComponent("Re: Your Canary Cove enquiry");
  const greeting = s.name ? s.name.split(" ")[0] : "there";
  const body = encodeURIComponent(`Hi ${greeting},\n\n`);
  return `mailto:${s.email}?subject=${subject}&body=${body}`;
}
