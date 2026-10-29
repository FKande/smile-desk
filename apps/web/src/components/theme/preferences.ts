"use client";

import { useSyncExternalStore } from "react";

/* Two patient preferences, both stored as attributes on <html>:
 *   data-theme      light | dark (absent = follow the OS)
 *   data-text-size  large | larger (absent = default)
 * ThemeScript applies the stored values before first paint; these hooks read
 * the attributes back (the DOM is the single source of truth) and persist
 * changes to localStorage. */

export const themeOptions = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themeOptions)[number];

export const textSizeOptions = ["default", "large", "larger"] as const;
export type TextSizePreference = (typeof textSizeOptions)[number];

export const THEME_STORAGE_KEY = "smile-desk:theme";
export const TEXT_SIZE_STORAGE_KEY = "smile-desk:text-size";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-text-size"],
  });
  return () => observer.disconnect();
}

function writeAttribute(attribute: string, storageKey: string, value: string | null) {
  const root = document.documentElement;
  if (value === null) root.removeAttribute(attribute);
  else root.setAttribute(attribute, value);
  try {
    if (value === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // preference still applies for this page view.
  }
}

export function useThemePreference() {
  const value = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") as ThemePreference | null) ?? "system",
    () => "system" as ThemePreference,
  );
  const set = (next: ThemePreference) =>
    writeAttribute("data-theme", THEME_STORAGE_KEY, next === "system" ? null : next);
  return [value, set] as const;
}

export function useTextSizePreference() {
  const value = useSyncExternalStore(
    subscribe,
    () =>
      (document.documentElement.getAttribute("data-text-size") as TextSizePreference | null) ?? "default",
    () => "default" as TextSizePreference,
  );
  const set = (next: TextSizePreference) =>
    writeAttribute("data-text-size", TEXT_SIZE_STORAGE_KEY, next === "default" ? null : next);
  return [value, set] as const;
}
