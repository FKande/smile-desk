import { mockEnabled, notFound, openTurn, scriptTurn, streamTurn } from "../../_mock";

/** Mock of POST /chat/stream (dev only; see ../../_mock.ts). */
export async function POST(request: Request) {
  if (!mockEnabled()) return notFound();
  const turn = await openTurn(request);
  if (turn instanceof Response) return turn;

  const script = scriptTurn(turn.conversationId, turn.conversation, turn.message);
  if ("status" in script) return Response.json(script.body, { status: script.status });

  const body = streamTurn(turn.conversationId, turn.conversation, turn.message, script, request.signal);
  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform" },
  });
}
