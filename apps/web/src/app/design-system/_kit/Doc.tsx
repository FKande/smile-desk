import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Catalog building blocks. They frame and label real components; they never
 * re-create product markup (the "no-drift" rule borrowed from Eigen): every
 * demo imports the component from its real path, shown in the source chip. */

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <p className="text-label font-semibold text-brand-text">Smile Desk design system</p>
      <h1 className="text-display font-bold">{title}</h1>
      {children ? <div className="max-w-3xl text-body text-secondary">{children}</div> : null}
    </header>
  );
}

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-8 flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-subtle pb-4">
        <h2 id={`${id}-title`} className="text-heading font-bold">
          {title}
        </h2>
        {description ? <div className="max-w-3xl text-body-sm text-secondary">{description}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SourcePath({ path }: { path: string }) {
  return (
    <code className="inline-flex w-fit items-center rounded-sm bg-subtle px-2 py-0.5 font-mono text-caption text-muted">
      {path}
    </code>
  );
}

type Schemes = "both" | "current";

/**
 * A titled demo frame. By default it renders its children twice, in a light
 * pane and a dark pane, each pinned with data-theme. That works because every
 * token is a light-dark() pair resolved per subtree (styles/semantic.css).
 * Use schemes="current" for interactive or heavy demos (one copy, page theme).
 */
export function Stage({
  title,
  source,
  description,
  schemes = "both",
  stacked = false,
  padded = true,
  className,
  children,
}: {
  title?: string;
  source?: string;
  description?: ReactNode;
  schemes?: Schemes;
  /** Stack the light and dark panes vertically (for wide demos) instead of side by side. */
  stacked?: boolean;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const panes: Array<"light" | "dark" | null> = schemes === "both" ? ["light", "dark"] : [null];
  return (
    <figure className="flex flex-col gap-3">
      {title || source || description ? (
        <figcaption className="flex flex-col gap-1.5">
          {title ? <span className="text-title font-semibold">{title}</span> : null}
          {source ? <SourcePath path={source} /> : null}
          {description ? <span className="max-w-3xl text-body-sm text-secondary">{description}</span> : null}
        </figcaption>
      ) : null}
      <div className={cn("grid gap-3", schemes === "both" && !stacked && "xl:grid-cols-2")}>
        {panes.map((scheme) => (
          <div
            key={scheme ?? "current"}
            data-theme={scheme ?? undefined}
            className={cn(
              "relative min-w-0 overflow-hidden rounded-xl border border-subtle bg-canvas text-default",
              padded && "p-5 sm:p-6",
              className,
            )}
          >
            {scheme ? (
              <span className="absolute right-3 top-3 rounded-full bg-surface px-2 py-0.5 text-caption text-muted">
                {scheme === "light" ? "Light" : "Dark"}
              </span>
            ) : null}
            {children}
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Rows × columns of the same component with merged props, e.g. variants ×
 *  states. Cells are rendered by the caller so the real component is used. */
export function StateGrid<P extends object>({
  rows,
  columns,
  render,
}: {
  rows: { label: string; props: Partial<P> }[];
  columns: { label: string; props: Partial<P> }[];
  render: (props: Partial<P>) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-x-3 border-spacing-y-3 text-left">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Variant
            </th>
            {columns.map((column) => (
              <th key={column.label} scope="col" className="pb-1 text-caption font-semibold text-muted">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="whitespace-nowrap pr-2 text-caption font-semibold text-muted">
                {row.label}
              </th>
              {columns.map((column) => (
                <td key={column.label} className="align-middle">
                  {render({ ...row.props, ...column.props })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A small callout for usage rules ("do / don't") and deliberate exceptions. */
export function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside
      data-tone="info"
      className="flex max-w-3xl flex-col gap-1 rounded-lg border border-(color:--tone-border) bg-(--tone-subtle) px-4 py-3"
    >
      <span className="text-label font-semibold text-(color:--tone-text)">{title}</span>
      <div className="text-body-sm text-default">{children}</div>
    </aside>
  );
}
