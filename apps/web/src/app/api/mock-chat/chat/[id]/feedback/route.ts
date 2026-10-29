import { getConversation, mockEnabled, notFound } from "../../../_mock";

/** Mock of POST /chat/:id/feedback (dev only). */
export async function POST(request: Request, ctx: RouteContext<"/api/mock-chat/chat/[id]/feedback">) {
  if (!mockEnabled()) return notFound();
  const conversation = getConversation((await ctx.params).id);
  if (!conversation) return notFound();
  const body = (await request.json().catch(() => null)) as { rating?: unknown; comment?: unknown } | null;
  if (body?.rating !== 1 && body?.rating !== -1) {
    return Response.json({ error: "invalid_input", message: "rating must be 1 or -1" }, { status: 400 });
  }
  conversation.feedback.push({
    rating: body.rating,
    comment: typeof body.comment === "string" ? body.comment : undefined,
  });
  return new Response(null, { status: 204 });
}
