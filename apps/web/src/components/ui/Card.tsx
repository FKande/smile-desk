import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

const paddings = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;
export type CardPadding = keyof typeof paddings;

const surface =
  "flex flex-col gap-4 rounded-(--card-radius) border border-(color:--card-border) bg-(--card-bg) " +
  "text-default shadow-(--card-shadow)";

/* Hover lifts the card (stronger border and shadow) rather than tinting it,
 * so the content inside keeps its own colors. Same custom variants as Button,
 * so the catalog can freeze each state with data-state. */
const interactive =
  "w-full cursor-pointer text-left no-underline " +
  "transition-[border-color,box-shadow,transform] duration-(--duration-fast) ease-out " +
  "hovered:border-(color:--card-border-hover) hovered:shadow-(--card-shadow-hover) " +
  "pressed:scale-(--press-scale) focused:focus-ring " +
  "is-disabled:cursor-not-allowed is-disabled:opacity-60 is-disabled:shadow-none";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: CardPadding;
  ref?: Ref<HTMLDivElement>;
};

/** A resting surface. Compose with CardHeader, CardBody and CardFooter, or
 *  put anything inside: the card only owns the frame and the vertical rhythm. */
export function Card({ padding = "md", className, ...rest }: CardProps) {
  return <div className={cn(surface, paddings[padding], className)} {...rest} />;
}

type InteractiveBase = { padding?: CardPadding; className?: string; children: ReactNode };
type LinkCardProps = InteractiveBase & Omit<ComponentProps<typeof Link>, "className" | "children">;
type ButtonCardProps = InteractiveBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };
export type InteractiveCardProps = LinkCardProps | ButtonCardProps;

/** The whole card is one target: a link when given href, otherwise a button.
 *  A button only takes phrasing content, so inside the button form use spans
 *  (styled as blocks) rather than CardHeader's heading. */
export function InteractiveCard(props: InteractiveCardProps) {
  if (props.href !== undefined) {
    const { padding = "md", className, ...rest } = props;
    return <Link className={cn(surface, interactive, paddings[padding], className)} {...rest} />;
  }
  const { padding = "md", className, type = "button", ...rest } = props;
  return <button type={type} className={cn(surface, interactive, paddings[padding], className)} {...rest} />;
}

type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** A trailing control: a badge, an IconButton, a small link. */
  action?: ReactNode;
  /** Pick the level that fits the page outline. */
  titleAs?: "h2" | "h3" | "h4";
  className?: string;
};

export function CardHeader({ title, description, action, titleAs: Title = "h3", className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Title className="text-title font-semibold">{title}</Title>
        {description ? <p className="text-body-sm text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-3 text-body", className)} {...rest} />;
}

/** Actions or meta, separated from the body by a hairline. */
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-3 border-t border-subtle pt-4", className)}
      {...rest}
    />
  );
}
