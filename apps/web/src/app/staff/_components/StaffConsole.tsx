"use client";

import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/theme/PreferenceControls";
import { AlertQueue } from "./AlertQueue";

/** The page shell: header, then the live queue. */
export function StaffConsole() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-(--gutter) py-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-solid text-on-brand">
            <Icon name="bell" size="lg" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-heading font-bold">Staff alerts</h1>
            <p className="text-body-sm text-secondary">Emergencies, hand-offs and callbacks from the assistant</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <AlertQueue />
    </main>
  );
}
