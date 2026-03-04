
import { useState, useCallback, useEffect } from 'react';
import { useFreightRequestsQuery, useDashboardDataQuery, useShipmentMutations, useRequestByIdQuery } from './useFreightQueries';
import { FreightFilters, RequestStatus, User, FreightRequest } from '../types';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';

export const useFreightData = () => {
  // We keep local state for params to feed into the query hook
  const [requestParams, setRequestParams] = useState<{
    page: number;
    pageSize: number;
    statusFilter: string;
    searchTerm: string;
    filters?: FreightFilters;
  }>({
    page: 1,
    pageSize: 50,
    statusFilter: 'ALL',
    searchTerm: '',
    filters: undefined
  });

  const { data: requestsData, isLoading: requestsLoading, refetch: refreshRequests } = useFreightRequestsQuery(requestParams);
  const { data: dashboardData, refetch: fetchDashboardData } = useDashboardDataQuery();
  const { createRequest, updateStatus, updateRequestDetails, deleteRequests, fixMissingQuarters } = useShipmentMutations();
  const queryClient = useQueryClient();

  // --- Realtime Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('freight-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'freight_raw_full' },
        (payload) => {
          console.log('[Realtime] Change received:', payload);
          // Invalidate lists and dashboard to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          
          // If a specific row was updated/inserted, invalidate that specific query as well
          if (payload.new && (payload.new as any).id) {
             queryClient.invalidateQueries({ queryKey: ['request', (payload.new as any).id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fetchRequests = useCallback((params: { page: number; pageSize: number; statusFilter: string; searchTerm: string; filters?: FreightFilters }) => {
    setRequestParams(params);
  }, []);

  const fetchRequestById = useCallback(async (id: string) => {
    // We try to get data from cache first, otherwise fetch
    return await queryClient.fetchQuery({
        queryKey: ['request', id],
        queryFn: () => import('../services/freightService').then(mod => mod.freightService.getRequestById(id)),
        staleTime: 1000 * 60 // 1 minute stale
    });
  }, [queryClient]);

  // Wrapper for updateStatus to match previous signature
  const handleUpdateStatus = useCallback(async (
      id: string, 
      status: RequestStatus, 
      analysisStr?: any, 
      remark?: string, 
      user?: User | null,
      skipRefresh: boolean = false
  ) => {
      // If analysisStr is string, parse it, if object use as is (legacy support)
      let analysis = analysisStr;
      if (typeof analysisStr === 'string') {
          try { analysis = JSON.parse(analysisStr); } catch {}
      }
      await updateStatus({ id, status, analysis, remark, user });
      // React Query handles invalidation automatically in the mutation hook
  }, [updateStatus]);

  const handleCreateRequest = useCallback(async (data: any, user: User | null) => {
      return await createRequest({ data, user });
  }, [createRequest]);

  const handleUpdateDetails = useCallback(async (id: string, updates: Partial<FreightRequest>) => {
      await updateRequestDetails({ id, updates });
  }, [updateRequestDetails]);

  return {
    requests: requestsData?.requests || [],
    totalCount: requestsData?.totalCount || 0,
    loading: requestsLoading,
    dashboardData: dashboardData || null,
    
    fetchRequests,
    refreshRequests, // Directly mapped to query refetch
    fetchDashboardData, // Directly mapped to query refetch
    fetchRequestById,
    
    createRequest: handleCreateRequest,
    updateStatus: handleUpdateStatus,
    updateRequestDetails: handleUpdateDetails,
    deleteRequests,
    fixMissingQuarters
  };
};
