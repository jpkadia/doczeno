import { GoogleGenAI } from "@google/genai";

const MODEL_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown for failing / rate-limited models
const unhealthyModelUntil = new Map<string, number>();

/**
 * Returns candidate Gemini models ordered so currently healthy low-latency models are tried first.
 * Models that recently returned 404/429/503/timeout are deprioritized for 5 minutes to avoid
 * wasting 3-10s per chat turn re-hitting failing models.
 */
export function getOrderedCandidateModels(primaryModel?: string): string[] {
  const baseList = Array.from(
    new Set([
      primaryModel || "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
    ])
  );

  const now = Date.now();
  const healthy: string[] = [];
  const cooledDown: string[] = [];

  for (const m of baseList) {
    const until = unhealthyModelUntil.get(m);
    if (until && until > now) {
      cooledDown.push(m);
    } else {
      if (until) unhealthyModelUntil.delete(m);
      healthy.push(m);
    }
  }

  return healthy.length > 0 ? [...healthy, ...cooledDown] : baseList;
}

export function markModelUnhealthy(modelName: string, statusCode?: number): void {
  // Put 404/429/503 or timeouts on cooldown; skip brief 400 validation issues unless persistent
  if (!statusCode || statusCode === 404 || statusCode === 429 || statusCode >= 500 || statusCode === 408) {
    unhealthyModelUntil.set(modelName, Date.now() + MODEL_COOLDOWN_MS);
  }
}

export function markModelHealthy(modelName: string): void {
  unhealthyModelUntil.delete(modelName);
}

/**
 * Executes a Gemini generateContent call bounded by a strict timeout so slow upstream sockets
 * fail fast and switch to the next healthy fallback model immediately.
 */
export async function generateContentBounded(params: {
  client: GoogleGenAI;
  model: string;
  contents: any;
  config: Record<string, any>;
  timeoutMs?: number;
}) {
  const timeoutMs = params.timeoutMs ?? 10000;
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`Gemini request timed out after ${timeoutMs}ms`);
      err.status = 408;
      err.code = "GEMINI_TIMEOUT";
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      params.client.models.generateContent({
        model: params.model,
        contents: params.contents,
        config: params.config,
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
