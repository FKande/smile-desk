import { mockEnabled, notFound, openTurn, recordTurn, scriptTurn } from "../_mock";

/** Mock of POST /chat, the non-streaming fallback (dev only). */
export async function POST(request: Request) {
  if (!mockEnabled()) return notFound();
  const turn = await openTurn(request);
  if (turn instanceof Response) return turn;

  const script = scriptTurn(turn.conversationId, turn.conversation, turn.message);
  if ("status" in script) return Response.json(script.body, { status: script.status });
  recordTurn(turn.conversation, turn.message, script.reply);
  return Response.json(script.reply);
}
