import type { Submission } from "./submission-types";

export const recentSubmissions: Submission[] = [
  {
    id: "b-20260915-andrea-stohlmann",
    type: "booking",
    name: "Andrea Stohlmann",
    email: "astohlmann@gmail.com",
    phone: "7866225654",
    date: "2026-09-15T01:55:00.000Z",
    arrival: "2026-12-23",
    departure: "2027-01-03",
    guests: "6 adults, 6 children",
    message: "Villa",
    pagePath: "/book",
    referral: "other",
    sourceForm: "booking"
  },
  {
    id: "b-20260910-melissa-scanlon-main-house",
    type: "booking",
    name: "melissa scanlon",
    email: "melissa.scanlon623@gmail.com",
    phone: "15712940113",
    date: "2026-09-10T18:27:33.000Z",
    arrival: "2027-03-22",
    departure: "2027-03-27",
    guests: "6 adults, 6 children",
    message: "Main House",
    pagePath: "/book",
    referrer: "https://mainhouse.canarycove.com/",
    sourceForm: "booking"
  },
  {
    id: "b-20260910-melissa-scanlon",
    type: "booking",
    name: "Melissa Scanlon",
    email: "melissa.scanlon623@gmail.com",
    phone: "5712940113",
    date: "2026-09-10T13:51:29.000Z",
    arrival: "2027-03-22",
    departure: "2027-03-27",
    guests: "6 adults, 6 children",
    message: "Spring break for 3 families with kids ranging from 15-9yrs old. Would like to do activities like fishing, snorkeling, swimming w rays ect. Also just down time at the beach.",
    pagePath: "/book",
    referral: "google",
    sourceForm: "booking"
  }
];
