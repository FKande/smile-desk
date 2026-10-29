import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { buttonClasses } from "@/components/ui/button-styles";

/* Placeholder until the chat UI lands; it already runs on the design system. */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-(--chat-max-width) flex-col items-start justify-center gap-6 px-(--gutter) py-16">
      <span className="grid size-12 place-items-center rounded-xl bg-brand-solid text-on-brand">
        <Icon name="tooth" size="lg" />
      </span>
      <h1 className="text-heading font-bold">Smile Desk</h1>
      <p className="text-body text-secondary">
        The patient assistant is being built. In the meantime, the design system it runs on is live.
      </p>
      <Link href="/design-system" className={buttonClasses({ variant: "primary", size: "lg" })}>
        Open the design system
      </Link>
    </main>
  );
}
