// AI SDK v6 + Vercel AI Gateway: passing a "provider/model" string routes through the
// gateway automatically. Locally requires AI_GATEWAY_API_KEY; on Vercel it uses OIDC.
export const AI_MODEL =
  process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5";
