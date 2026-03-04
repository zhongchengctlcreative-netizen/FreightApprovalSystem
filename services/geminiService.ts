
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { FreightRequest, AIAnalysisResult } from '../types';
import { aiAnalysisSchema } from './validationSchemas';

const cleanJson = (text: string): string => {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  // Attempt to fix trailing commas (simple regex approach for common cases)
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return cleaned.trim();
};

export const analyzeFreightRequest = async (request: FreightRequest): Promise<AIAnalysisResult> => {
  // If Supabase is not configured, we cannot call the Edge Function.
  // Fallback to a mock response or error to prevent crashing.
  if (!isSupabaseConfigured) {
      console.warn("Supabase not configured. Cannot call AI Edge Function.");
      return {
        riskAnalysis: "AI Service unavailable (Mock Mode).",
        marketRateComparison: "Unknown",
        recommendation: "INVESTIGATE",
        reasoning: "System is running in local/mock mode. Configure Supabase to enable AI.",
        riskScore: 50
      };
  }

  try {
    const { data, error } = await supabase.functions.invoke('analyze-freight', {
      body: { request }
    });

    if (error) throw error;
    if (!data || !data.analysis) throw new Error("No analysis received from Edge Function");

    const text = data.analysis;
    
    // Parse and Validate with Zod
    const parsed = JSON.parse(cleanJson(text));
    const validated = aiAnalysisSchema.safeParse(parsed);

    if (!validated.success) {
        console.error("AI Response Validation Error:", validated.error);
        throw new Error("AI response structure invalid.");
    }

    return validated.data;

  } catch (error: any) {
    console.error("Error analyzing freight:", error);
    
    let errorMessage = "AI Service unavailable.";
    if (error.message) errorMessage = `Analysis failed: ${error.message}`;

    return {
      riskAnalysis: "Analysis unavailable due to service error.",
      marketRateComparison: "Unknown",
      recommendation: "INVESTIGATE",
      reasoning: errorMessage,
      riskScore: 50
    };
  }
};
