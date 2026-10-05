import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/config/env";

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (aiClient) return aiClient;

  const { GEMINI_API_KEY } = getEnv();
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in environment");
  }

  aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return aiClient;
}

/**
 * Healthcare AI guardrails system instruction
 * Enforces strictly factual, draft-only content generation.
 */
export const HEALTHCARE_AI_SYSTEM_INSTRUCTION = `
You are a healthcare copy drafting assistant for verified doctors and clinics.
STRICT POLICIES:
1. All generated copy is DRAFT content for professional medical practitioner review.
2. DO NOT formulate medical diagnoses, treatment plans, prescriptions, or clinical triage.
3. DO NOT invent or fabricate medical qualifications, degrees, hospital affiliations, awards, certifications, statistics, or patient testimonials.
4. DO NOT generate website layout code, HTML, CSS, JavaScript, or themes. Focus strictly on polished text copy.
5. Maintain a professional, empathetic, and clear healthcare communication tone.
`;
