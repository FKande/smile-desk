import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Staff alerts · Smile Desk",
  description: "Emergencies, hand-offs and callbacks raised by the Smile Desk assistant.",
  // An internal tool: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return <ToastProvider>{children}</ToastProvider>;
}
