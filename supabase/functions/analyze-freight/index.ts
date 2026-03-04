import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@0.1.3"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { request } = await req.json()
    const apiKey = Deno.env.get('API_KEY')
    if (!apiKey) {
      throw new Error('Missing API_KEY environment variable')
    }

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `
      You are an expert Logistics & Supply Chain Analyst. Your task is to analyze this freight shipment request and provide a risk assessment and approval recommendation.
      
      Shipment Data:
      - Route: ${request.origin} -> ${request.destination}
      - Carrier: ${request.forwarder} (Line: ${request.carrier || 'N/A'})
      - Weight: ${request.weight} kg
      - Cost: $${request.price}
      - Commodity: ${request.commodity || 'General Cargo'}
      - Transport: ${request.shippingMethod} (${request.containerSize || 'N/A'})
      - ETD: ${request.etd}
      
      Instructions:
      1. Analyze the Cost vs Weight ratio. Is it typical for this route/mode?
      2. Identify potential geopolitical or logistical risks for the origin/destination pair.
      3. Decide if this requires investigation or can be approved.
      4. Assign a Risk Score between 0 and 100 (0 = Safe/Standard, 100 = High Risk/Anomaly).
      
      Output JSON format:
      {
        "riskAnalysis": "Detailed assessment of route and carrier risks.",
        "marketRateComparison": "Assessment of price competitiveness (e.g. 'High', 'Low', 'Fair').",
        "recommendation": "APPROVE" | "REJECT" | "INVESTIGATE",
        "reasoning": "Final verdict justification.",
        "riskScore": Number (0-100)
      }
    `

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 1024 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskAnalysis: { type: Type.STRING },
            marketRateComparison: { type: Type.STRING },
            recommendation: { type: Type.STRING, enum: ['APPROVE', 'REJECT', 'INVESTIGATE'] },
            reasoning: { type: Type.STRING },
            riskScore: { type: Type.NUMBER }
          },
          required: ['riskAnalysis', 'marketRateComparison', 'recommendation', 'reasoning', 'riskScore']
        }
      }
    })

    const text = response.text
    return new Response(JSON.stringify({ analysis: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})