
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { FreightRequest, RequestStatus, FreightFilters } from '../types';
import { mockDataStore } from './mockDataStore';
import { getLocalOverrides, mapRowToRequest } from './freightHelpers';

export const shipmentReadService = {
  isUsingMockData: () => !isSupabaseConfigured,

  async getRequestById(id: string): Promise<FreightRequest | null> {
    if (!isSupabaseConfigured) {
      return mockDataStore.getData().find(r => r.id === id) || null;
    }

    try {
      // Try fetching with relationships first
      const { data, error } = await supabase
        .from('freight_raw_full')
        .select('*, destinations(region)')
        .eq('id', id)
        .single();

      if (error) {
        // Fallback: Fetch without relationships if FK is missing
        if (error.code === 'PGRST200') {
             const { data: fallbackData } = await supabase
                .from('freight_raw_full')
                .select('*')
                .eq('id', id)
                .single();
             if (fallbackData) {
                 const localOverrides = getLocalOverrides();
                 return mapRowToRequest(fallbackData, localOverrides[fallbackData.id] || {});
             }
        }
        console.warn("Fetch by ID failed:", error.message);
        return null;
      }

      if (!data) return null;

      const localOverrides = getLocalOverrides();
      return mapRowToRequest(data, localOverrides[data.id] || {});
    } catch (e) {
      console.error("Error fetching request by ID", e);
      return null;
    }
  },

  async getRequestsByQuarter(quarter: string): Promise<FreightRequest[]> {
    if (!isSupabaseConfigured) {
        return mockDataStore.getData().filter(r => r.quarter === quarter && r.status === 'APPROVED');
    }

    try {
        const { data, error } = await supabase
            .from('freight_raw_full')
            .select('*')
            .eq('quarter', quarter)
            .eq('status', 'APPROVED');
            
        if (error) throw error;
        
        return (data || []).map((row: any) => mapRowToRequest(row));
    } catch (e) {
        console.error("Failed to fetch requests by quarter", e);
        return [];
    }
  },

  async getRequests(options?: {
    page?: number;
    pageSize?: number;
    statusFilter?: string;
    searchTerm?: string;
    filters?: FreightFilters;
  }): Promise<{ requests: FreightRequest[]; totalCount: number }> {
    
    if (!isSupabaseConfigured) {
      console.warn("Supabase not configured. Advanced filtering is unavailable in mock mode.");
      return { requests: [], totalCount: 0 };
    }

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Helper to build the base query filters (reusable for main and fallback queries)
    const buildQuery = (q: any) => {
        if (options?.filters) {
            const f = options.filters;
            if (f.id) q = q.ilike('id', `%${f.id}%`);
            if (f.status && f.status.length > 0) q = q.in('status', f.status);
            if (f.origin) q = q.or(`origin.ilike.%${f.origin}%,origin_code.ilike.%${f.origin}%`);
            if (f.destination) q = q.or(`destination.ilike.%${f.destination}%,destination_code.ilike.%${f.destination}%`);
            if (f.mode) q = q.ilike('shipping_method', `%${f.mode}%`);
            // Forwarder filter now checks 'forwarder' column, falling back to 'carrier' for legacy data
            if (f.forwarder) q = q.or(`forwarder.ilike.%${f.forwarder}%,carrier.ilike.%${f.forwarder}%`);
            if (f.quarter) q = q.ilike('quarter', `%${f.quarter}%`);
            if (f.requester) q = q.ilike('requester_name', `%${f.requester}%`);
            if (f.minWeight) q = q.gte('weight_kg', f.minWeight);
            if (f.maxWeight) q = q.lte('weight_kg', f.maxWeight);
            if (f.minCost) q = q.or(`estimated_cost.gte.${f.minCost},total_actual_cost.gte.${f.minCost}`);
            if (f.maxCost) q = q.or(`estimated_cost.lte.${f.maxCost},total_actual_cost.lte.${f.maxCost}`);
        }

        if (options?.statusFilter && options.statusFilter !== 'ALL') {
            if (options.statusFilter === 'ALL_PENDING') q = q.in('status', ['PENDING', 'PENDING_L2']);
            else if (options.statusFilter === 'MISSING_COST') {
                q = q.or('estimated_cost.is.null,estimated_cost.eq.0');
                q = q.or('total_actual_cost.is.null,total_actual_cost.eq.0');
            } else if (options.statusFilter === 'MISSING_QUARTER') {
                q = q.or('quarter.is.null,quarter.eq.-,quarter.eq.N/A,quarter.eq.""');
            } else q = q.eq('status', options.statusFilter);
        }

        if (options?.searchTerm) {
            const term = `%${options.searchTerm}%`;
            // Updated to search in both new 'forwarder' and 'carrier' columns
            q = q.or(`id.ilike.${term},origin.ilike.${term},destination.ilike.${term},forwarder.ilike.${term},carrier.ilike.${term},shipping_method.ilike.${term},requester_name.ilike.${term},bl_awb.ilike.${term},container_number.ilike.${term}`);
        }
        
        return q;
    };

    // 1. Attempt Advanced Query with Joins
    try {
        let query = supabase.from('freight_raw_full')
            // Removed explicit !hints to let PostgREST resolve naturally
            .select('*, destinations(region), carriers(status)', { count: 'exact' });
        
        query = buildQuery(query);

        // Apply Embedded Filters (Only works if joins succeed)
        if (options?.filters?.region) query = query.eq('destinations.region', options.filters.region);
        if (options?.filters?.forwarderStatus) query = query.eq('carriers.status', options.filters.forwarderStatus);

        query = query.order('id', { ascending: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        const localOverrides = getLocalOverrides();
        const mappedRequests = (data || []).map((row: any) => 
            mapRowToRequest(row, localOverrides[row.id] || {})
        );
        return { requests: mappedRequests, totalCount: count || 0 };

    } catch (e: any) {
        // 2. Fallback: If relationship missing (PGRST200), run basic query
        if (e.code === 'PGRST200' || e.message?.includes('relationship') || e.message?.includes('foreign key')) {
            console.warn("Advanced filtering unavailable (DB Relationships missing). Running fallback query.");
            
            let fallbackQuery = supabase.from('freight_raw_full').select('*', { count: 'exact' });
            fallbackQuery = buildQuery(fallbackQuery); // Apply standard filters
            fallbackQuery = fallbackQuery.order('id', { ascending: false }).range(from, to);

            const { data, error, count } = await fallbackQuery;
            
            if (error) {
                console.error('Fallback query failed:', error);
                return { requests: [], totalCount: 0 };
            }

            const localOverrides = getLocalOverrides();
            const mappedRequests = (data || []).map((row: any) => 
                mapRowToRequest(row, localOverrides[row.id] || {})
            );
            return { requests: mappedRequests, totalCount: count || 0 };
        }

        console.error('Error fetching requests:', e);
        return { requests: [], totalCount: 0 };
    }
  },

  async getNextSN(year2Digit: number): Promise<number> {
    if (!isSupabaseConfigured) return 1;
    try {
        const { count, error } = await supabase
            .from('freight_raw_full')
            .select('*', { count: 'exact', head: true })
            .eq('year', year2Digit);
        if (error) return 1;
        return (count || 0) + 1;
    } catch (e) {
        return 1;
    }
  }
};
