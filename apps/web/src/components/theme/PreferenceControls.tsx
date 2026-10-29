"use client";

import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import {
  useTextSizePreference,
  useThemePreference,
  type TextSizePreference,
  type ThemePreference,
} from "./preferences";

const themeChoices: SegmentedOption<ThemePreference>[] = [
  { value: "system", label: "Match my device", icon: "monitor", iconOnly: true },
  { value: "light", label: "Light", icon: "sun", iconOnly: true },
  { value: "dark", label: "Dark", icon: "moon", iconOnly: true },
];

const textSizeChoices: SegmentedOption<TextSizePreference>[] = [
  { value: "default", label: "A" },
  { value: "large", label: "A+" },
  { value: "larger", label: "A++" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useThemePreference();
  return (
    <SegmentedControl
      legend="Color theme"
      options={themeChoices}
      value={theme}
      onChange={setTheme}
      className={className}
    />
  );
}

export function TextSizeToggle({ className }: { className?: string }) {
  const [size, setSize] = useTextSizePreference();
  return (
    <SegmentedControl
      legend="Text size"
      options={textSizeChoices}
      value={size}
      onChange={setSize}
      className={className}
    />
  );
}
