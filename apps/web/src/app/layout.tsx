import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { ThemeScript } from "@/components/theme/ThemeScript";
import "./globals.css";

/* Atkinson Hyperlegible Next was drawn by the Braille Institute for low-vision
 * readers: distinct letterforms (I/l/1, O/0) matter when a patient reads back
 * a date of birth or a phone number. next/font self-hosts it at build time. */
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  display: "swap",
  // Next ships no fallback metrics for Atkinson, so skip the size-adjusted fallback.
  adjustFontFallback: false,
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  display: "swap",
  // Next ships no fallback metrics for Atkinson, so skip the size-adjusted fallback.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Smile Desk",
  description: "Book, reschedule and ask questions about your dental care, any time.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1215" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // ThemeScript sets data-theme / data-text-size before hydration, so the
    // attributes legitimately differ from the server render.
    <html lang="en" suppressHydrationWarning className={`${atkinson.variable} ${atkinsonMono.variable} h-full`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
