
import { z } from 'zod';

export const requestSchema = z.object({
  originCode: z.string().min(1, "Origin is required"),
  originName: z.string(),
  destCode: z.string().min(1, "Destination is required"),
  destName: z.string(),
  etd: z.string().min(1, "ETD is required"),
  eta: z.string().optional(),
  weight: z.number().optional(),
  cartonCount: z.number().optional(),
  m3: z.number().optional(),
  shippingMethod: z.string().default("Sea"),
  meansOfConveyance: z.string().optional(),
  containerSize: z.string().optional(),
  forwarder: z.string().min(1, "Forwarder is required"),
  carrier: z.string().optional(),
  vesselName: z.string().optional(),
  price: z.number().min(0, "Price cannot be negative"),
  inventoryValue: z.preprocess((val) => (val === '' || val === null ? undefined : Number(val)), z.number().min(0, "Value cannot be negative").optional()),
  commodity: z.string().optional(),
  firstApprover: z.string().optional(),
  secondApprover: z.string().optional(),
  ccEmails: z.string().optional()
});

export type RequestFormValues = z.infer<typeof requestSchema>;

export const aiAnalysisSchema = z.object({
  riskAnalysis: z.string(),
  marketRateComparison: z.string(),
  recommendation: z.enum(['APPROVE', 'REJECT', 'INVESTIGATE']),
  reasoning: z.string(),
  riskScore: z.number().optional()
});

export type AIAnalysisSchema = z.infer<typeof aiAnalysisSchema>;
