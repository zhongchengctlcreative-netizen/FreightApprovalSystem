
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { FinancialMetric } from '../types';

const STORAGE_KEY = 'freightguard_financial_mock';

// Default Mock Data for demonstration
const DEFAULT_METRICS: FinancialMetric[] = [
  { quarter: 'FY2026 Q2', category: 'CLEU', cost: 155729, revenue: 6938230 },
  { quarter: 'FY2026 Q2', category: 'CLPL', cost: 11988, revenue: 2589388 },
  { quarter: 'FY2026 Q2', category: 'CLI', cost: 48228, revenue: 3587111 },
  { quarter: 'FY2026 Q2', category: 'CLCI', cost: 6829, revenue: 573173 },
  { quarter: 'FY2026 Q2', category: 'INTER_PLANT', cost: 30000, revenue: 0 },
  { quarter: 'FY2026 Q2', category: 'TARGET', cost: 0, revenue: 0, target_revenue: 22000000 },

  { quarter: 'FY2026 Q1', category: 'CLEU', cost: 126378, revenue: 6513517 },
  { quarter: 'FY2026 Q1', category: 'CLPL', cost: 16000, revenue: 3243895 },
  { quarter: 'FY2026 Q1', category: 'CLI', cost: 48614, revenue: 3828528 },
  { quarter: 'FY2026 Q1', category: 'CLCI', cost: 10834, revenue: 417239 },
  { quarter: 'FY2026 Q1', category: 'INTER_PLANT', cost: 30000, revenue: 0 },
  { quarter: 'FY2026 Q1', category: 'TARGET', cost: 0, revenue: 0, target_revenue: 18600000 },
];

const loadMock = (): FinancialMetric[] => {
  if (typeof window === 'undefined') return DEFAULT_METRICS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_METRICS;
  } catch {
    return DEFAULT_METRICS;
  }
};

const saveMock = (data: FinancialMetric[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

let MOCK_DATA = loadMock();

export const financialService = {
  async getAllMetrics(): Promise<FinancialMetric[]> {
    if (!isSupabaseConfigured) {
      return [...MOCK_DATA];
    }
    
    try {
      const { data, error } = await supabase
        .from('financial_metrics')
        .select('*');
        
      if (error) {
        console.warn("Using mock financial data due to DB error:", error);
        return [...MOCK_DATA];
      }
      return data || [];
    } catch (e) {
      console.error(e);
      return [...MOCK_DATA];
    }
  },

  async upsertMetric(metric: FinancialMetric): Promise<void> {
    const normalizedMetric = {
        ...metric,
        quarter: metric.quarter.trim(),
        cost: metric.cost || 0,
        revenue: metric.revenue || 0,
        target_revenue: metric.target_revenue || 0
    };

    if (!isSupabaseConfigured) {
      const idx = MOCK_DATA.findIndex(m => m.quarter === normalizedMetric.quarter && m.category === normalizedMetric.category);
      if (idx > -1) {
        MOCK_DATA[idx] = { ...MOCK_DATA[idx], ...normalizedMetric };
      } else {
        MOCK_DATA.push(normalizedMetric);
      }
      saveMock(MOCK_DATA);
      return;
    }

    // DB Insert/Update
    const payload: any = {
      quarter: normalizedMetric.quarter,
      category: normalizedMetric.category,
      cost: normalizedMetric.cost,
      revenue: normalizedMetric.revenue,
      target_revenue: normalizedMetric.target_revenue,
      updated_at: new Date().toISOString()
    };
    
    // Explicitly pass ID if it exists to help with updates vs inserts
    if (metric.id) payload.id = metric.id;

    const { error } = await supabase
      .from('financial_metrics')
      .upsert(payload, { onConflict: 'quarter,category' });

    if (error) throw error;
  },

  async deleteQuarter(quarter: string): Promise<void> {
    const targetQ = quarter.trim();

    if (!isSupabaseConfigured) {
      MOCK_DATA = MOCK_DATA.filter(m => m.quarter.trim() !== targetQ);
      saveMock(MOCK_DATA);
      return;
    }

    // Robust Delete Strategy:
    // Fetch all metrics IDs where the quarter matches loosely (ignoring whitespace differences)
    // This is necessary because some DB rows might have trailing spaces "FY26 Q1 " vs "FY26 Q1"
    const { data: allMetrics, error: fetchError } = await supabase
        .from('financial_metrics')
        .select('id, quarter');
    
    if (fetchError) throw fetchError;

    // Filter in memory to find IDs to delete
    const idsToDelete = (allMetrics || [])
        .filter(m => m.quarter && m.quarter.trim() === targetQ)
        .map(m => m.id);

    if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
            .from('financial_metrics')
            .delete()
            .in('id', idsToDelete);
        
        if (deleteError) throw deleteError;
        console.log(`Deleted ${idsToDelete.length} metrics for quarter: ${targetQ}`);
    } else {
        console.log(`No financial metrics found for quarter: ${targetQ}`);
    }
  }
};
