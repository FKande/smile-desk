import type { Metadata } from "next";
import { DocShell } from "./_kit/DocShell";

export const metadata: Metadata = {
  title: "Design system · Smile Desk",
  description: "Tokens, components and chat patterns behind the Smile Desk patient assistant.",
};

/* Living catalog at /design-system. It renders the real components from
 * src/components and paints swatches straight from the CSS tokens, so it
 * cannot drift from the product. */
export default function DesignSystemLayout({ children }: LayoutProps<"/design-system">) {
  return <DocShell>{children}</DocShell>;
}
