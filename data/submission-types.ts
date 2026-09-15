export type SubmissionType = "booking" | "contact";

export interface Submission {
  id: string;
  type: SubmissionType;
  name: string;
  email: string;
  phone?: string;
  date: string;
  message?: string;
  arrival?: string;
  departure?: string;
  guests?: string;
  pagePath?: string;
  referral?: string;
  referrer?: string;
  sourceForm?: string;
}
