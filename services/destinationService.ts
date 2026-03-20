
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface Destination {
  id?: string;
  code: string;
  description: string;
  region: string;
  ccEmails?: string;
}

const MOCK_KEY = 'freightguard_destinations_mock';
const DEFAULT_DESTS: Destination[] = [
  { id: 'd1', code: 'LAX', description: 'Los Angeles', region: 'OTHER' },
  { id: 'd2', code: 'SHA', description: 'Shanghai', region: 'OTHER' },
  { id: 'd3', code: 'SIN', description: 'Singapore', region: 'OTHER' },
  { id: 'd4', code: 'HKG', description: 'Hong Kong', region: 'OTHER' },
  { id: 'd5', code: 'RMD', description: 'Rotterdam', region: 'CLEU' }
];

const loadMock = (): Destination[] => {
  if (typeof window === 'undefined') return DEFAULT_DESTS;
  const stored = localStorage.getItem(MOCK_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_DESTS;
};

const saveMock = (data: Destination[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOCK_KEY, JSON.stringify(data));
};

let MOCK_DATA = loadMock();

export const destinationService = {
  async getAll(): Promise<Destination[]> {
    if (!isSupabaseConfigured) return [...MOCK_DATA];
    try {
      const { data, error } = await supabase.from('destinations').select('*').order('code', { ascending: true });
      if (error) throw error;
      
      // Map DB column cc_emails to frontend ccEmails
      return (data || []).map((d: any) => ({
        id: d.id,
        code: d.code,
        description: d.description,
        region: d.region,
        ccEmails: d.cc_emails
      }));
    } catch (e) {
      return [...MOCK_DATA];
    }
  },

  async upsert(dest: Partial<Destination>, oldCode?: string, updateHistorical: boolean = false): Promise<void> {
    // We use trim() but NO toUpperCase() to support user preference for lowercase/mixed-case codes.
    const normalized = { ...dest, code: (dest.code || '').trim() };
    
    if (!isSupabaseConfigured) {
      if (normalized.id) {
        const idx = MOCK_DATA.findIndex(d => d.id === normalized.id);
        if (idx > -1) MOCK_DATA[idx] = { ...MOCK_DATA[idx], ...normalized as Destination };
      } else {
        MOCK_DATA.push({ ...(normalized as Destination), id: Math.random().toString(36).substr(2, 9) });
      }
      saveMock(MOCK_DATA);
      return;
    }

    // Map frontend ccEmails to DB column cc_emails
    const payload: any = {
      code: normalized.code,
      description: normalized.description,
      region: normalized.region,
      cc_emails: normalized.ccEmails
    };
    if (normalized.id) payload.id = normalized.id;

    // 1. Update Master Record
    const { error } = await supabase.from('destinations').upsert(payload);
    if (error) throw error;

    // 2. Update Historical Records
    if (updateHistorical && oldCode) {
        console.log(`[DestinationService] Updating history: ${oldCode} -> ${normalized.code}`);
        
        // Fetch all distinct destination_codes and origin_codes to find exact matches ignoring case and whitespace
        const { data: rawData } = await supabase.from('freight_raw_full').select('destination_code, origin_code');
        
        if (rawData) {
            const destCodesToUpdate = Array.from(new Set(
                rawData.map(d => d.destination_code)
                       .filter(c => c && c.trim().toUpperCase() === oldCode.trim().toUpperCase())
            ));
            
            const originCodesToUpdate = Array.from(new Set(
                rawData.map(d => d.origin_code)
                       .filter(c => c && c.trim().toUpperCase() === oldCode.trim().toUpperCase())
            ));

            if (destCodesToUpdate.length > 0) {
                const destUpdatePayload: any = { destination_code: normalized.code };
                if (normalized.description) destUpdatePayload.destination = normalized.description;
                
                const { error: destError } = await supabase.from('freight_raw_full')
                    .update(destUpdatePayload)
                    .in('destination_code', destCodesToUpdate);
                if (destError) console.error("Failed to update historical destination records", destError);
            }

            if (originCodesToUpdate.length > 0) {
                const originUpdatePayload: any = { origin_code: normalized.code };
                if (normalized.description) originUpdatePayload.origin = normalized.description;

                const { error: originError } = await supabase.from('freight_raw_full')
                    .update(originUpdatePayload)
                    .in('origin_code', originCodesToUpdate);
                if (originError) console.error("Failed to update historical origin records", originError);
            }
        }
    }
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      MOCK_DATA = MOCK_DATA.filter(d => d.id !== id);
      saveMock(MOCK_DATA);
      return;
    }

    // We must chain .select() to get the deleted rows back for verification
    const { data, error } = await supabase
      .from('destinations')
      .delete()
      .eq('id', id)
      .select();
    
    if (error) {
      console.error("Supabase delete error:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      // If we are here, it means the ID didn't match any row or it was already deleted.
      console.warn(`Delete operation: Destination '${id}' not found or already deleted.`);
    }
  }
};
