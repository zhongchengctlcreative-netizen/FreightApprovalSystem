
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { freightService } from '../services/freightService';
import { fileService } from '../services/fileService';
import { FreightFilters, FreightRequest, RequestStatus, User } from '../types';

export const useFreightRequestsQuery = (params: { page: number; pageSize: number; statusFilter: string; searchTerm: string; filters?: FreightFilters }) => {
  return useQuery({
    queryKey: ['requests', params],
    queryFn: () => freightService.getRequests(params),
    placeholderData: (previousData) => previousData
  });
};

export const useDashboardDataQuery = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => freightService.getDashboardData(),
  });
};

export const useRequestByIdQuery = (id: string) => {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => freightService.getRequestById(id),
    enabled: !!id
  });
};

export const useShipmentMutations = () => {
  const queryClient = useQueryClient();

  const createRequestMutation = useMutation({
    mutationFn: async ({ data, user }: { data: any; user: User | null }) => {
      const { files, ...dataPayload } = data;
      const requesterName = (user?.name || dataPayload.requester || '').toUpperCase();
      const requesterEmail = user?.email || dataPayload.requesterEmail;
      
      const payload = { ...dataPayload, requester: requesterName, requesterEmail: requesterEmail };
      const created = await freightService.createRequest(payload);
      
      // Handle file uploads if the request was created successfully and files exist
      if (created && created.id && files) {
         try {
             // Ensure we have a standard array of files
             const fileList = Array.isArray(files) ? files : Array.from(files);
             
             if (fileList.length > 0) {
                 await Promise.all(fileList.map((f: any) => fileService.uploadFile(created.id, f)));
             }
         } catch (err) { 
             console.warn("File upload encountered issues (request still created):", err); 
         }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, analysis, remark, user }: { id: string; status: RequestStatus; analysis?: any; remark?: string; user?: User | null }) => {
      const actorName = (user?.name || 'Unknown User').toUpperCase();
      return freightService.updateStatus(id, status, analysis, remark, actorName);
    },
    onMutate: async ({ id, status, user, remark }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['request', id] });
      await queryClient.cancelQueries({ queryKey: ['requests'] });

      // Snapshot the previous value
      const previousRequest = queryClient.getQueryData<FreightRequest>(['request', id]);

      // Optimistically update the individual request cache
      queryClient.setQueryData<FreightRequest | undefined>(['request', id], (old) => {
        if (!old) return old;
        const now = new Date().toISOString();
        const actorName = (user?.name || 'Unknown').toUpperCase();
        
        // Determine actual target status (replicating backend logic)
        let targetStatus = status;
        if (status === RequestStatus.APPROVED) {
            if (old.status === RequestStatus.PENDING && old.secondApprover) {
                targetStatus = RequestStatus.PENDING_L2;
            }
        }

        let updates: Partial<FreightRequest> = { status: targetStatus };
        
        if (targetStatus === RequestStatus.APPROVED) {
            updates = { 
                ...updates, 
                approvedBy: actorName, 
                approvalDate: now,
                approvalRemark: remark
            };
        } else if (targetStatus === RequestStatus.PENDING_L2) {
            updates = {
                ...updates,
                l1ApprovedBy: actorName,
                l1ApprovalDate: now,
                l1ApprovalRemark: remark
            };
        } else if (targetStatus === RequestStatus.REJECTED) {
            updates = {
                ...updates,
                rejectedBy: actorName,
                rejectionDate: now,
                rejectionReason: remark
            };
        } else if (targetStatus === RequestStatus.CANCELLED) {
            updates = {
                ...updates,
                cancelledBy: actorName,
                cancellationDate: now,
                cancellationReason: remark
            };
        } else if (targetStatus === RequestStatus.PENDING) {
            // Resubmission Case: Clear all approvals
            updates = {
                ...updates,
                l1ApprovedBy: null,
                l1ApprovalDate: null,
                l1ApprovalRemark: null,
                approvedBy: null,
                approvalDate: null,
                approvalRemark: null,
                // We typically keep rejection history until it is overwritten or just keep it for record,
                // but for UI logic "Previous Rejection" block handles historical display.
                // We set resubmission fields:
                resubmissionDate: now,
                resubmissionNote: remark
            };
        }

        return { ...old, ...updates };
      });

      // Optimistically update list caches
      queryClient.setQueriesData<{ requests: FreightRequest[], totalCount: number }>({ queryKey: ['requests'] }, (old) => {
         if (!old) return old;
         // We can't easily replicate the detailed logic for the list view without full object access
         // so we just update status to make it responsive
         return {
             ...old,
             requests: old.requests.map(r => r.id === id ? { ...r, status } : r)
         };
      });

      return { previousRequest };
    },
    onError: (err, newTodo, context: any) => {
      // Rollback to previous value on error
      if (context?.previousRequest) {
        queryClient.setQueryData(['request', newTodo.id], context.previousRequest);
      }
    },
    onSettled: (_, __, { id }) => {
      // Always refetch after error or success to ensure data is consistent
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FreightRequest> }) => {
      if (updates.requester) updates.requester = updates.requester.toUpperCase();
      return freightService.updateRequestDetails(id, updates);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => freightService.deleteRequests(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const fixQuartersMutation = useMutation({
    mutationFn: async () => freightService.fixMissingQuarters(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  return {
    createRequest: createRequestMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    updateRequestDetails: updateDetailsMutation.mutateAsync,
    deleteRequests: deleteMutation.mutateAsync,
    fixMissingQuarters: fixQuartersMutation.mutateAsync
  };
};
