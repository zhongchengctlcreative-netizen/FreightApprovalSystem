
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface Forwarder { // Renamed from Carrier
  id?: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const MOCK_FORWARDERS_KEY = 'freightguard_carriers_mock'; // key can stay the same
const DEFAULT_FORWARDERS: Forwarder[] = [ // Renamed
  { id: '1', name: 'Maersk Line', status: 'ACTIVE' },
  { id: '2', name: 'MSC', status: 'ACTIVE' },
  { id: '3', name: 'CMA CGM', status: 'ACTIVE' },
  { id: '4', name: 'Hapag-Lloyd', status: 'ACTIVE' },
  { id: '5', name: 'ONE', status: 'ACTIVE' },
  { id: '6', name: 'FedEx', status: 'ACTIVE' },
  { id: '7', name: 'DHL', status: 'ACTIVE' }
];

const loadMock = (): Forwarder[] => { // Renamed
  if (typeof window === 'undefined') return DEFAULT_FORWARDERS;
  const stored = localStorage.getItem(MOCK_FORWARDERS_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_FORWARDERS;
};

const saveMock = (data: Forwarder[]) => { // Renamed
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOCK_FORWARDERS_KEY, JSON.stringify(data));
};

let MOCK_DATA = loadMock();

export const forwarderService = { // Renamed
  async getAllForwarders(): Promise<Forwarder[]> { // Renamed
    if (!isSupabaseConfigured) return [...MOCK_DATA];
    
    try {
      const { data, error } = await supabase
        .from('carriers') // DB table name is unchanged
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn("Forwarder fetch failed, using mock", e); // Updated log
      return [...MOCK_DATA];
    }
  },

  async upsertForwarder(forwarder: Forwarder, oldName?: string, updateHistorical: boolean = false): Promise<void> { // Renamed
    if (!isSupabaseConfigured) {
      if (forwarder.id) {
        const idx = MOCK_DATA.findIndex(c => c.id === forwarder.id);
        if (idx > -1) MOCK_DATA[idx] = { ...forwarder };
        else MOCK_DATA.push(forwarder);
      } else {
        const newForwarder = { ...forwarder, id: Math.random().toString(36).substr(2, 9) };
        MOCK_DATA.push(newForwarder);
      }
      saveMock(MOCK_DATA);
      return;
    }

    const payload: any = {
      name: forwarder.name,
      status: forwarder.status
    };
    if (forwarder.id) payload.id = forwarder.id;

    const { error } = await supabase.from('carriers').upsert(payload); // DB table name unchanged

    if (error) throw error;

    // Snapshot update logic: If name changed and flag is true, update historical data
    if (updateHistorical && oldName) {
       console.log(`Updating historical records from '${oldName}' to '${forwarder.name}'`);
       
       const { data: rawData } = await supabase.from('freight_raw_full').select('carrier, forwarder');
       
       if (rawData) {
           const carrierNamesToUpdate = Array.from(new Set(
               rawData.map(d => d.carrier)
                      .filter(c => c && c.trim().toUpperCase() === oldName.trim().toUpperCase())
           ));
           
           const forwarderNamesToUpdate = Array.from(new Set(
               rawData.map(d => d.forwarder)
                      .filter(c => c && c.trim().toUpperCase() === oldName.trim().toUpperCase())
           ));

           if (carrierNamesToUpdate.length > 0) {
               const { error: historyError1 } = await supabase
                 .from('freight_raw_full')
                 .update({ carrier: forwarder.name })
                 .in('carrier', carrierNamesToUpdate);
               
               if (historyError1) {
                 console.error("Failed to update historical carrier records", historyError1);
               }
           }

           if (forwarderNamesToUpdate.length > 0) {
               const { error: historyError2 } = await supabase
                 .from('freight_raw_full')
                 .update({ forwarder: forwarder.name })
                 .in('forwarder', forwarderNamesToUpdate);
               
               if (historyError2) {
                 console.error("Failed to update historical forwarder records", historyError2);
               }
           }
       }
    }
  },

  async deleteForwarder(id: string): Promise<void> { // Renamed
    if (!isSupabaseConfigured) {
      MOCK_DATA = MOCK_DATA.filter(c => c.id !== id);
      saveMock(MOCK_DATA);
      return;
    }

    const { error } = await supabase.from('carriers').delete().eq('id', id); // DB table name unchanged
    if (error) throw error;
  }
};
