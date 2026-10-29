// Provider-neutral conversation model. The transcript is append-only: each
// assistant turn also keeps the provider's raw output (`native`) so it can be
// replayed byte-for-byte to the same provider, which preserves thinking /
// reasoning state and the prompt-cache prefix. A different provider rebuilds
// the turn from the neutral fields instead.

export type ProviderName = 'anthropic' | 'openai';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  /** JSON string handed back to the model. */
  output: string;
  isError: boolean;
}

export type TranscriptItem =
  | { kind: 'user'; text: string; context?: string }
  | {
      kind: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      native?: { provider: ProviderName; model: string; data: unknown };
    }
  | { kind: 'tool_results'; results: ToolResult[] };

/** JSON Schema for a tool's input. Kept strict-mode compatible for both providers. */
export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
}

export interface TurnRequest {
  conversationId: string;
  system: string;
  transcript: TranscriptItem[];
  tools: ToolSpec[];
  /** Receives reply text as the model generates it. Setting it forces a streaming request. */
  onTextDelta?: (text: string) => void;
  /** Text streamed so far for this turn is void (the turn is being re-issued). */
  onReset?: () => void;
}

export type StopReason = 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface TurnResult {
  provider: ProviderName;
  model: string;
  text: string;
  toolCalls: ToolCall[];
  native: unknown;
  stopReason: StopReason;
  usage: TurnUsage;
  /** Settings the model didn't support and that were adjusted for this request. */
  warnings: string[];
}

export interface LlmProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  runTurn(request: TurnRequest): Promise<TurnResult>;
}
