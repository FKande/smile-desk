/* Single source of truth for the catalog's navigation and section anchors.
 * Every page section id must appear here, and vice versa. */
export type NavEntry = {
  href: string;
  label: string;
  anchors: { id: string; label: string }[];
};

export const NAV: NavEntry[] = [
  {
    href: "/design-system",
    label: "Foundations",
    anchors: [
      { id: "tiers", label: "Token tiers" },
      { id: "primitives", label: "Primitive ramps" },
      { id: "semantic", label: "Semantic colors" },
      { id: "intents", label: "Intents" },
      { id: "typography", label: "Typography" },
      { id: "shape", label: "Radius & elevation" },
      { id: "motion", label: "Motion" },
      { id: "layers", label: "Sizing & layers" },
      { id: "responsive", label: "Responsive" },
      { id: "icons", label: "Icons" },
    ],
  },
  {
    href: "/design-system/controls",
    label: "Controls",
    anchors: [
      { id: "button", label: "Button" },
      { id: "icon-button", label: "IconButton" },
      { id: "field", label: "Field & Input" },
      { id: "textarea", label: "Textarea" },
      { id: "select", label: "Select" },
      { id: "checkbox", label: "Checkbox" },
      { id: "switch", label: "Switch" },
      { id: "segmented", label: "SegmentedControl" },
    ],
  },
  {
    href: "/design-system/surfaces",
    label: "Surfaces & feedback",
    anchors: [
      { id: "card", label: "Card" },
      { id: "badge", label: "Badge" },
      { id: "alert", label: "Alert" },
      { id: "avatar", label: "Avatar" },
      { id: "dialog", label: "Dialog" },
      { id: "toast", label: "Toast" },
    ],
  },
  {
    href: "/design-system/loaders",
    label: "Loaders",
    anchors: [
      { id: "spinner", label: "Spinner" },
      { id: "skeleton", label: "Skeleton" },
      { id: "progress", label: "ProgressBar" },
      { id: "tooth-loader", label: "ToothLoader" },
      { id: "reduced-motion", label: "Reduced motion" },
    ],
  },
  {
    href: "/design-system/chat",
    label: "Chat",
    anchors: [
      { id: "conversation", label: "Full conversation" },
      { id: "bubbles", label: "Message bubbles" },
      { id: "typing", label: "Typing indicator" },
      { id: "quick-replies", label: "Quick replies" },
      { id: "slots", label: "Slot picker" },
      { id: "appointment", label: "Appointment card" },
      { id: "emergency", label: "Emergency & staff notices" },
      { id: "composer", label: "Composer" },
      { id: "header", label: "Chat header" },
    ],
  },
];
