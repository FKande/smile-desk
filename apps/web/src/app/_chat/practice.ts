import type { AppointmentType } from "@/components/chat/AppointmentCard";

/* Practice facts the chat screen shows. They mirror apps/api/src/practice
 * (the source of truth the assistant answers from); a multi-location build
 * would fetch them per location instead. */

export const ASSISTANT_NAME = "Maya";
export const PRACTICE_NAME = "Smile Desk Dental";
export const PRACTICE_PHONE = "(415) 555-0100";
export const PRACTICE_LOCATION = "Smile Desk Dental, 120 Market St, Suite 400, San Francisco";
export const PRACTICE_HOURS = "Open Mon–Sat, 8 AM – 6 PM";

/** The API's typeLabel → the card's visit type, and the visit length. */
export const VISIT_TYPES: Record<string, { type: AppointmentType; duration: string }> = {
  Cleaning: { type: "cleaning", duration: "60 min" },
  "General checkup": { type: "checkup", duration: "30 min" },
  "Emergency visit": { type: "emergency", duration: "30 min" },
};
