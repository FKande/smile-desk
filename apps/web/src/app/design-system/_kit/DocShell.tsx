"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { TextSizeToggle, ThemeToggle } from "@/components/theme/PreferenceControls";
import { cn } from "@/lib/cn";
import { NAV } from "./nav";

/** Catalog chrome: sticky sidebar (nav + preference toggles) beside a
 *  scrolling content column. Collapses to a stacked header on narrow screens. */
export function DocShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-skip-link) focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="border-b border-subtle bg-surface lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 p-5">
          <Link href="/design-system" className="flex items-center gap-2.5 rounded-md focused:focus-ring">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-solid text-on-brand">
              <Icon name="tooth" size="md" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-label font-bold">Smile Desk</span>
              <span className="text-caption text-muted">Design system</span>
            </span>
          </Link>

          <nav aria-label="Design system">
            <ul className="flex flex-wrap gap-1 lg:flex-col">
              {NAV.map((entry) => {
                const active = pathname === entry.href;
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center rounded-md px-3 text-label font-semibold transition-colors duration-(--duration-fast)",
                        "focused:focus-ring",
                        active ? "bg-brand-subtle text-brand-text" : "text-secondary hover:bg-hover hover:text-default",
                      )}
                    >
                      {entry.label}
                    </Link>
                    {active ? (
                      <ul className="mb-2 mt-1 hidden flex-col border-l border-subtle pl-3 lg:ml-3 lg:flex">
                        {entry.anchors.map((anchor) => (
                          <li key={anchor.id}>
                            <a
                              href={`#${anchor.id}`}
                              className="flex min-h-8 items-center rounded-sm px-2 text-caption text-muted hover:text-default focused:focus-ring"
                            >
                              {anchor.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Side by side on phones so the header stays short; stacked in the sidebar. */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-subtle pt-5 lg:flex-col">
            <div className="flex flex-col gap-2">
              <span className="text-caption font-semibold text-muted">Theme</span>
              <ThemeToggle className="self-start" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption font-semibold text-muted">Text size</span>
              <TextSizeToggle className="self-start" />
            </div>
          </div>
        </div>
      </aside>

      <main id="content" className="min-w-0 px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-16">{children}</div>
      </main>
    </div>
  );
}
