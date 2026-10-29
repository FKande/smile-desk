/** Joins class names, skipping falsy values. Deliberately tiny: the token
 *  system means components rarely need conflicting-class merging. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
