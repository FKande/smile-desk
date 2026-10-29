"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Icon } from "@/components/icons/Icon";
import { ThemeToggle } from "@/components/theme/PreferenceControls";
import { Button } from "@/components/ui/Button";
import { readAdminToken, subscribeAdminToken, writeAdminToken } from "@/lib/staff-client";
import { AlertQueue } from "./AlertQueue";
import { TokenForm } from "./TokenForm";

/** The page shell: header, then either the token form or the queue. The
 *  token is undefined until hydration (the server has no storage). */
export function StaffConsole() {
  const token = useSyncExternalStore(subscribeAdminToken, readAdminToken, () => undefined);
  const [tokenError, setTokenError] = useState<string | null>(null);

  function signIn(next: string) {
    setTokenError(null);
    writeAdminToken(next);
  }

  // Stable, so the queue's polling effect doesn't restart on every render.
  const rejectToken = useCallback(() => {
    writeAdminToken(null);
    setTokenError("That token didn't work. Check it and try again.");
  }, []);

  function signOut() {
    setTokenError(null);
    writeAdminToken(null);
  }

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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {token ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          ) : null}
        </div>
      </header>

      {token === undefined ? (
        <Skeleton radius="xl" className="h-56" />
      ) : token ? (
        // Keyed by token so a new sign-in starts from a clean queue.
        <AlertQueue key={token} token={token} onUnauthorized={rejectToken} />
      ) : (
        <TokenForm error={tokenError} onSubmit={signIn} />
      )}
    </main>
  );
}
