"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Input";

type TokenFormProps = {
  /** Shown under the field, e.g. after the API rejected the stored token. */
  error: string | null;
  onSubmit: (token: string) => void;
};

/** Asked once per browser: the token is kept in localStorage until Sign out. */
export function TokenForm({ error, onSubmit }: TokenFormProps) {
  const [value, setValue] = useState("");
  const [emptyError, setEmptyError] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = value.trim();
    if (!token) {
      setEmptyError(true);
      return;
    }
    onSubmit(token);
  }

  return (
    <Card className="max-w-md">
      <CardHeader
        titleAs="h2"
        title="Sign in to the alert queue"
        description="Enter the admin token for this office. It stays on this device until you sign out."
      />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Admin token"
          type="password"
          autoComplete="current-password"
          required
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setEmptyError(false);
          }}
          error={emptyError ? "Enter the admin token." : (error ?? undefined)}
        />
        <Button type="submit" iconEnd="arrow-right" className="self-start">
          Show alerts
        </Button>
      </form>
    </Card>
  );
}
