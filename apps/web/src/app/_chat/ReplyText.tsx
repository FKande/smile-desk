import { Fragment } from "react";
import { toBlocks, toSegments } from "@/lib/reply-text";

/** Maya's plain text as paragraphs and bullet lists. Everything renders as
 *  React text (never HTML), and phone numbers become tap-to-call links. */
export function ReplyText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 whitespace-normal">
      {toBlocks(text).map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-muted">
            {block.items.map((item, j) => (
              <li key={j}>
                <Line text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <Line text={line} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

function Line({ text }: { text: string }) {
  return toSegments(text).map((segment, i) =>
    segment.kind === "phone" ? (
      <a
        key={i}
        href={segment.href}
        className="whitespace-nowrap font-semibold underline underline-offset-2 focused:focus-ring"
      >
        {segment.text}
      </a>
    ) : (
      <Fragment key={i}>{segment.text}</Fragment>
    ),
  );
}
