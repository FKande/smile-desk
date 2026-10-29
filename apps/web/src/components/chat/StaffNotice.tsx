import { useId, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/cn";

export type StaffNoticeProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  title?: string;
  /** What happens next, in a sentence or two. */
  children?: ReactNode;
  /** Small print: expected response time, a reference. */
  meta?: ReactNode;
  icon?: "headset" | "bell";
};

/** Handoff to a person: the assistant has passed the conversation (or a
 *  question it should not answer alone) to the front desk. Info-toned,
 *  because nothing is wrong; someone is simply taking over. */
export function StaffNotice({
  title = "A team member will follow up",
  children,
  meta,
  icon = "headset",
  className,
  ...rest
}: StaffNoticeProps) {
  const titleId = useId();
  return (
    <section
      data-tone="info"
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-(--card-radius) border border-(color:--tone-border) bg-(--tone-subtle) p-4",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--tone-element) text-(color:--tone-text)"
      >
        <Icon name={icon} size="md" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={titleId} className="text-label font-semibold text-(color:--tone-text)">
          {title}
        </h3>
        {children ? <div className="text-body-sm text-default">{children}</div> : null}
        {meta ? <p className="text-caption text-secondary">{meta}</p> : null}
      </div>
    </section>
  );
}
