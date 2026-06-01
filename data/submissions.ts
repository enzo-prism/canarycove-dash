// Canary Cove — website form submissions
//
// Source: Formspree CSV exports (manually curated by AI agent).
//   - Booking form  → formspree_xqeqllek
//   - Contact form  → formspree_xvzarybk
//
// Obvious bot/spam rows (dotted-variant Gmail addresses with gibberish
// names/messages, nonsense guest counts, and the test@test.com row) have
// been removed. Only genuine guest enquiries remain.
//
// `date` is the raw submission timestamp from the export (UTC, ISO 8601).

export type SubmissionType = "booking" | "contact";

export interface Submission {
  id: string;
  type: SubmissionType;
  name: string;
  email: string;
  phone?: string;
  date: string; // ISO 8601
  message?: string;
  // Booking-only trip details
  arrival?: string;
  departure?: string;
  guests?: string;
}

export const submissions: Submission[] = [
  {
    id: "c-20260601",
    type: "contact",
    name: "Bryant Craig",
    email: "craigdvm@gmail.com",
    phone: "580-541-7004",
    date: "2026-06-01T12:25:53Z",
    message:
      "I have sent several booking requests and called last week. Just checking to see what the status of my request is currently. They were sent with the email craigdvm@gmail.com, you can send directly back to that email or call me at 580-541-7004. — Bryant Craig",
  },
  {
    id: "b-20260526",
    type: "booking",
    name: "Bryant Craig",
    email: "craigdvm@gmail.com",
    phone: "+1 580-541-7004",
    date: "2026-05-26T15:39:23Z",
    arrival: "2026-09-12",
    departure: "2026-09-19",
    guests: "6 adults",
    message:
      "We will have 6 for the majority of the stay but might just have 2-4 for part of it.",
  },
  {
    id: "b-20260525",
    type: "booking",
    name: "Cyndra Crossman",
    email: "cyndra.rae@yahoo.com",
    phone: "+1 602-503-1919",
    date: "2026-05-25T23:56:59Z",
    arrival: "2027-01-28",
    departure: "2027-02-02",
    guests: "12 adults, 1 child (age 4)",
    message:
      "40th birthday celebration. Not exactly sure how many people but maybe 10-12?",
  },
  {
    id: "c-20260520",
    type: "contact",
    name: "Bryant Craig",
    email: "craigdvm@gmail.com",
    date: "2026-05-20T15:03:09Z",
    message:
      "We are looking to book for September 11th to the 18th, can you let us know if this is available?",
  },
  {
    id: "b-20260516",
    type: "booking",
    name: "Bryant Craig",
    email: "craigdvm@gmail.com",
    phone: "(580) 541-7004",
    date: "2026-05-16T13:18:46Z",
    arrival: "2026-09-12",
    departure: "2026-09-19",
    guests: "4 adults",
    message: "Slow pace — fishing, snorkeling, sight seeing.",
  },
  {
    id: "b-20260502",
    type: "booking",
    name: "Bryant Craig",
    email: "craigdvm@gmail.com",
    phone: "580-541-7004",
    date: "2026-05-02T15:45:08Z",
    arrival: "2026-09-13",
    departure: "2026-09-19",
    guests: "6 adults",
    message:
      "Relax and fun with friends. Will want to snorkel a little and one or more will want to do a couple days of fishing with a guide.",
  },
  {
    id: "b-20260429-blade",
    type: "booking",
    name: "Blade Cruickshank",
    email: "blade.cruickshank@gmail.com",
    phone: "+1 405-434-8827",
    date: "2026-04-29T19:23:57Z",
    arrival: "2026-10-31",
    departure: "2026-11-07",
    guests: "6 adults",
    message:
      "Hi Canary Cove Team! I'm so excited to try and coordinate a trip to come back. We are looking at 3 couples. We will probably do snorkeling and maybe a fishing day and a day or two in town. We are considering renting a golf cart to explore a few spots but maybe only a couple of the days.",
  },
  {
    id: "c-20260429-val",
    type: "contact",
    name: "Val Kaye",
    email: "val@sisterhoodtravels.com",
    date: "2026-04-29T16:29:36Z",
    message:
      "Hello, this is my 3rd email request for a reach out for information to book your establishment and I have not heard back from anyone. I have called both phone numbers and no answer. I am hoping to get some information from you for our group. If someone could please reply I would appreciate it. Thank you, Val Kaye.",
  },
  {
    id: "b-20260427",
    type: "booking",
    name: "Jon Kurtyka",
    email: "jonkurtyka@yahoo.com",
    phone: "(215) 292-1040",
    date: "2026-04-27T15:46:02Z",
    arrival: "2026-05-21",
    departure: "2026-05-24",
    guests: "2 adults",
    message: "Birthday celebration.",
  },
  {
    id: "b-20260424-rich",
    type: "booking",
    name: "Rich Schones",
    email: "schonesfamily@gmail.com",
    phone: "+1 949-394-1213",
    date: "2026-04-24T18:49:44Z",
    arrival: "2026-09-18",
    departure: "2026-09-24",
    guests: "6 adults",
    message:
      "Parents, 2 daughters and their husbands for my wife's birthday. Looking for price.",
  },
  {
    id: "c-20260424-val",
    type: "contact",
    name: "Val Kaye",
    email: "val@sisterhoodtravels.com",
    date: "2026-04-24T16:58:40Z",
    message:
      "Hello, I am following up to my previous email for information please. Val Kaye, Travel Planner, Sisterhood Travels.",
  },
  {
    id: "b-20260424-erin",
    type: "booking",
    name: "Erin Jones",
    email: "erinj58@yahoo.com",
    phone: "+1 470-460-0412",
    date: "2026-04-24T06:14:57Z",
    arrival: "2027-04-15",
    departure: "2027-04-19",
    guests: "14 adults",
    message: "Family vacation.",
  },
  {
    id: "c-20260421-val",
    type: "contact",
    name: "Val Kaye",
    email: "val@sisterhoodtravels.com",
    date: "2026-04-21T19:58:19Z",
    message:
      "Hello — We are interested in a possible buyout of your location for a women's group trip in January 2028 (possibly the last week in January). There are a lot of logistics and questions we have to see if this is the right fit for our tour, and we have many questions on pricing and what is included and what is not. Do you have a person I can work with to coordinate with? Thank you, Val Kaye, Sisterhood Travels.",
  },
  {
    id: "c-20260420-lori",
    type: "contact",
    name: "Lori Devine",
    email: "lori@marallinace.org",
    date: "2026-04-20T21:15:35Z",
    message:
      "Hello, I am working with MarAlliance, and Canary Cove is listed as the preferred accommodations for our February trips. I am attempting to automate our system for reservations and payments by using the WeTravel platform. Is there someone I can email an invitation to? I also need to check availability and rates for Feb 20-27th 2027. Please feel free to reach out to me. Thank you! Lori Devine, Expeditions Coordinator.",
  },
];
