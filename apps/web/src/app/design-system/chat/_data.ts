import type { QuickReply } from "@/components/chat/QuickReplies";
import type { SlotDay } from "@/components/chat/SlotPicker";

/* Sample data for the chat catalog. A plain module (not "use client") so both
 * the server page and the client demos can read real values from it. */

export const greetingReplies: QuickReply[] = [
  { value: "book", label: "Book a visit", icon: "calendar" },
  { value: "new", label: "I'm a new patient", icon: "user" },
  { value: "change", label: "Change or cancel a visit", icon: "refresh" },
  { value: "insurance", label: "Insurance and payment", icon: "credit-card" },
  { value: "emergency", label: "It's an emergency", icon: "siren" },
];

export const visitReplies: QuickReply[] = [
  { value: "cleaning", label: "Cleaning", icon: "sparkles" },
  { value: "checkup", label: "General checkup", icon: "stethoscope" },
  { value: "emergency", label: "Something hurts", icon: "siren" },
];

export const earlyNextWeek: SlotDay[] = [
  {
    id: "mon",
    label: "Mon, Nov 3",
    slots: [
      { id: "mon-0800", label: "8:00 AM", available: false },
      { id: "mon-0845", label: "8:45 AM" },
    ],
  },
  {
    id: "tue",
    label: "Tue, Nov 4",
    slots: [
      { id: "tue-0800", label: "8:00 AM" },
      { id: "tue-0900", label: "9:00 AM", available: false },
      { id: "tue-0930", label: "9:30 AM", available: false },
    ],
  },
  {
    id: "wed",
    label: "Wed, Nov 5",
    slots: [{ id: "wed-0815", label: "8:15 AM" }],
  },
];

export const laterInWeek: SlotDay[] = [
  {
    id: "thu",
    label: "Thu, Nov 6",
    slots: [
      { id: "thu-1000", label: "10:00 AM" },
      { id: "thu-1130", label: "11:30 AM" },
    ],
  },
  {
    id: "fri",
    label: "Fri, Nov 7",
    slots: [
      { id: "fri-0945", label: "9:45 AM", available: false },
      { id: "fri-1015", label: "10:15 AM" },
      { id: "fri-1100", label: "11:00 AM" },
    ],
  },
];

export const familyBlocks: SlotDay[] = [
  {
    id: "sat",
    label: "Sat, Nov 8",
    slots: [
      { id: "sat-0900", label: "9:00", endLabel: "12:00 PM", detail: "4 back-to-back cleanings" },
      { id: "sat-1300", label: "1:00", endLabel: "4:00 PM", detail: "4 back-to-back cleanings", available: false },
    ],
  },
  {
    id: "mon2",
    label: "Mon, Nov 10",
    slots: [{ id: "mon2-1430", label: "2:30", endLabel: "5:30 PM", detail: "4 back-to-back cleanings" }],
  },
];

export const family = [
  { name: "Maria Gonzalez", time: "9:00 AM" },
  { name: "Daniel Gonzalez", time: "9:45 AM" },
  { name: "Sofia Gonzalez, 9", time: "10:30 AM" },
  { name: "Leo Gonzalez, 6", time: "11:15 AM" },
];
