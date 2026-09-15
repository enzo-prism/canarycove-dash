import type { Submission } from "./submission-types";

export const midASubmissions: Submission[] = [
  {
    id: "b-20260908-bruce-goldstein",
    type: "booking",
    name: "Bruce Goldstein",
    email: "brugomail@yahoo.com",
    phone: "77203461234",
    date: "2026-09-08T20:47:38.000Z",
    arrival: "2026-12-31",
    departure: "2027-01-03",
    guests: "6 adults",
    message: "Villa",
    pagePath: "/book",
    sourceForm: "booking"
  },
  {
    id: "b-20260830-katie-gump",
    type: "booking",
    name: "Katie Gump",
    email: "gumpkatie@gmail.com",
    phone: "+1 330-240-4404",
    date: "2026-08-30T23:09:35.000Z",
    arrival: "2027-03-13",
    departure: "2027-03-20",
    guests: "8 adults, 1 child",
    message: "Main House. Returning guest. friend hang out; secret beach; snorkel; possible dives? Hi Gil! Hi Consi!",
    pagePath: "/book",
    referral: "returning-guest",
    referrer: "https://www.google.com/",
    sourceForm: "booking"
  },
  {
    id: "c-20260805-sue-rob-keller",
    type: "contact",
    name: "Sue & Rob Keller",
    email: "skuck2011@gmail.com",
    date: "2026-08-05T23:18:49.681Z",
    message: "Hello Gil & Consi!\nHow are you?\n\nI know we just saw you guys in March when we were there with Trent & Sonja but we want to come back and see you in 2027!\n\nRob & I would like to bring two new couples to the island.....we are thinking February 20th to the 27th. Can you tell me if the villa is available that week?\n\nIt would be 3 couples (total of 6 adults) and two young kids (ages 11 & 9) so we would utilize the bunk room for them.\n\nLooking forward to hearing back from you soon! Thank you!\n\nSue",
    pagePath: "/contact",
    referrer: "https://www.google.com/",
    sourceForm: "contact"
  },
  {
    id: "b-20260706-grace-barfield",
    type: "booking",
    name: "Grace Barfield",
    email: "grace@foundluxurytravel.com",
    phone: "+1 713-553-4033",
    date: "2026-07-06T21:56:27.188Z",
    arrival: "2026-12-21",
    departure: "2026-12-28",
    guests: "1 adult",
    message: "Honeymoon",
    pagePath: "/book",
    referral: "google",
    sourceForm: "booking"
  },
  {
    id: "b-20260627-carla-sears",
    type: "booking",
    name: "Carla Sears",
    email: "goodjobgoodjob@bellsouth.net",
    phone: "+1 205-222-4118",
    date: "2026-06-27T17:45:01.419Z",
    arrival: "2026-12-12",
    departure: "2026-12-19",
    guests: "8 adults",
    message: "golf cart for stay service to and from the airport",
    pagePath: "/book",
    referral: "other-search",
    referrer: "https://www.google.com/",
    sourceForm: "booking"
  }
];
