import { getConversation, mockEnabled, notFound } from "../../../_mock";

/** Mock of GET /chat/:id/messages (dev only). */
export async function GET(_request: Request, ctx: RouteContext<"/api/mock-chat/chat/[id]/messages">) {
  if (!mockEnabled()) return notFound();
  const conversation = getConversation((await ctx.params).id);
  return conversation ? Response.json(conversation.messages) : notFound();
}
