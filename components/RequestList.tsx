
import React, { useState, useEffect } from 'react';
import { FreightRequest, RequestStatus, User } from '../types';
import { Search, ChevronRight, Truck, ThumbsUp, X, AlertTriangle, CheckSquare, Loader2, Info, Plane, Ship, Train, ShieldAlert, ShieldCheck, User as UserIcon, Copy } from 'lucide-react';
import Pagination from './Pagination';
import { Skeleton } from './ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useLocation } from 'react-router-dom';

interface RequestListProps {
  requests: FreightRequest[];
  onSelect: (request: FreightRequest) => void;
  onBulkUpdate: (ids: string[], status: RequestStatus, remark?: string) => void;
  currentUser: User | null;
  users: User[]; // Added users list for name resolution
  loading: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

const RequestList: React.FC<RequestListProps> = (props) => {
  const { 
    requests, onSelect, onBulkUpdate, currentUser, users, loading,
    totalCount, currentPage, pageSize, onPageChange,
    searchTerm, onSearchTermChange
  } = props;
  
  const { success: toastSuccess, error: toastError } = useToast();
  const location = useLocation();
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Modal states for bulk actions
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);
  const [bulkApproveRemark, setBulkApproveRemark] = useState('');
  
  const canApprove = currentUser && currentUser.role === 'APPROVER';
  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    setSelectedRequests(new Set());
    setIsSelectModeActive(false);
  }, [searchTerm, currentPage]);

  // Restore Scroll Position and Highlight
  useEffect(() => {
    const state = location.state as { lastId?: string } | null;
    if (state?.lastId && !loading && requests.length > 0) {
        // If the ID exists in current page
        if (requests.some(r => r.id === state.lastId)) {
            setHighlightId(state.lastId);
            // Slight delay to ensure DOM render
            setTimeout(() => {
                const element = document.getElementById(`row-${state.lastId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }
  }, [location.state, loading, requests]);

  const handleSelectOne = (id: string) => {
    const newSelection = new Set(selectedRequests);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedRequests(newSelection);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedRequests(new Set(requests.map(r => r.id)));
    else setSelectedRequests(new Set());
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toastSuccess("Log ID copied");
  };

  const handleConfirmBulkReject = () => {
    onBulkUpdate(Array.from(selectedRequests), RequestStatus.REJECTED, bulkRejectReason);
    setIsBulkRejectModalOpen(false);
    setBulkRejectReason('');
    setSelectedRequests(new Set());
    setIsSelectModeActive(false);
  };

  const checkAuthorizationForRequest = (req: FreightRequest): boolean => {
      if (!currentUser) return false;
      if (currentUser.role !== 'APPROVER') return false;

      const isL1 = req.status === RequestStatus.PENDING;
      const isL2 = req.status === RequestStatus.PENDING_L2;
      const isFirst = currentUser.email?.toLowerCase() === req.firstApprover?.toLowerCase();
      const isSecond = currentUser.email?.toLowerCase() === req.secondApprover?.toLowerCase();

      if (isL1) return !!isFirst || (!req.firstApprover);
      if (isL2) return !!isSecond;

      return false;
  };

  const handleConfirmBulkApprove = () => {
    const selectedIds = Array.from(selectedRequests);
    const authorizedIds = selectedIds.filter(id => {
        const req = requests.find(r => r.id === id);
        return req ? checkAuthorizationForRequest(req) : false;
    });

    if (authorizedIds.length === 0) {
        toastError("Not authorized to approve selected requests.");
        return;
    }

    if (authorizedIds.length < selectedIds.length) {
        if (!confirm(`You are only authorized to approve ${authorizedIds.length} out of ${selectedIds.length} selected requests. Proceed with those?`)) {
            return;
        }
    }

    onBulkUpdate(authorizedIds, RequestStatus.APPROVED, bulkApproveRemark);
    setIsBulkApproveModalOpen(false);
    setBulkApproveRemark('');
    setSelectedRequests(new Set());
    setIsSelectModeActive(false);
  };

  const getStatusColor = (status: RequestStatus) => {
    switch(status) {
      case RequestStatus.APPROVED: return 'bg-green-100 text-green-700';
      case RequestStatus.REJECTED: return 'bg-red-100 text-red-700';
      case RequestStatus.PENDING: return 'bg-amber-100 text-amber-700';
      case RequestStatus.PENDING_L2: return 'bg-blue-100 text-blue-700';
      case RequestStatus.CANCELLED: return 'bg-slate-100 text-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTransportIcon = (method?: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('air')) return <Plane size={14} />;
    if (m.includes('rail')) return <Train size={14} />;
    if (m.includes('sea')) return <Ship size={14} />;
    return <Truck size={14} />;
  };
  
  const getRiskIndicator = (analysisStr?: string) => {
    if (!analysisStr) return null;
    try {
        const json = JSON.parse(analysisStr);
        const rec = json.recommendation;
        if (rec === 'REJECT') {
            return <div title="AI Risk: High" className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-bold"><ShieldAlert size={10} /> HIGH RISK</div>;
        }
        if (rec === 'INVESTIGATE') {
            return <div title="AI Risk: Medium" className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-bold"><AlertTriangle size={10} /> CHECK</div>;
        }
        if (rec === 'APPROVE') {
            return <div title="AI Risk: Low" className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-bold"><ShieldCheck size={10} /> SAFE</div>;
        }
        return null;
    } catch (e) { return null; }
  };

  const getApproverInfo = (req: FreightRequest) => {
    const resolveName = (email?: string) => {
        if (!email) return 'Unknown';
        const u = users.find(user => user.email.toLowerCase() === email.toLowerCase());
        return u ? u.name : email;
    };

    if (req.status === RequestStatus.PENDING) {
        return { label: 'Waiting L1', name: resolveName(req.firstApprover), color: 'text-amber-600' };
    }
    if (req.status === RequestStatus.PENDING_L2) {
        return { label: 'Waiting L2', name: resolveName(req.secondApprover), color: 'text-blue-600' };
    }
    if (req.status === RequestStatus.APPROVED) {
        return { label: 'Approved By', name: req.approvedBy || 'Unknown', color: 'text-green-600' };
    }
    if (req.status === RequestStatus.REJECTED) {
        return { label: 'Rejected By', name: req.rejectedBy || 'Unknown', color: 'text-red-600' };
    }
    if (req.status === RequestStatus.CANCELLED) {
        return { label: 'Cancelled By', name: req.cancelledBy || 'Unknown', color: 'text-slate-500' };
    }
    return null;
  };

  const isAllSelected = requests.length > 0 && selectedRequests.size === requests.length;
  const isAnythingSelected = selectedRequests.size > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
      {/* Header & Controls */}
      <div className={`p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between transition-all duration-300 ${isAnythingSelected ? 'bg-indigo-50' : 'bg-slate-50'}`}>
        {isAnythingSelected ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                 />
                 <span className="font-semibold text-indigo-900">{selectedRequests.size} Selected</span>
              </div>
              <div className="h-6 w-px bg-indigo-200"></div>
              <div className="flex gap-2">
                 {canApprove && (
                     <>
                     <button onClick={() => setIsBulkApproveModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded shadow-sm hover:bg-green-700">
                        <ThumbsUp size={14} /> Approve
                     </button>
                     <button onClick={() => setIsBulkRejectModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded shadow-sm hover:bg-red-50">
                        <X size={14} /> Reject
                     </button>
                     </>
                 )}
              </div>
            </div>
            <button onClick={() => setSelectedRequests(new Set())} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </>
        ) : (
          <>
             <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-800">Pending Approvals</h2>
                <p className="text-sm text-slate-500">All shipments awaiting L1 or L2 approval.</p>
             </div>
             <div className="flex items-center gap-3 w-full md:w-auto">
                {(canApprove || isAdmin) && (
                    <button 
                        onClick={() => setIsSelectModeActive(!isSelectModeActive)}
                        className={`p-2 rounded-lg border transition-colors ${isSelectModeActive ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        title="Toggle Selection Mode"
                    >
                        <CheckSquare size={20} />
                    </button>
                )}
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search Log No, Origin, Method..." 
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                    />
                </div>
             </div>
          </>
        )}
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {loading ? (
             // Skeleton Loader
             Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-lg flex items-center gap-4">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="w-1/3 h-4" />
                        <Skeleton className="w-1/2 h-3" />
                    </div>
                    <Skeleton className="w-20 h-8" />
                </div>
             ))
        ) : requests.length > 0 ? (
            requests.map((req) => {
                const approverInfo = getApproverInfo(req);
                const isHighlighted = highlightId === req.id;
                return (
                <div 
                    key={req.id}
                    id={`row-${req.id}`} // Identifier for scroll
                    onClick={() => !isSelectModeActive && onSelect(req)}
                    className={`
                        group bg-white p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-4
                        ${isSelectModeActive && selectedRequests.has(req.id) ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'}
                        ${isHighlighted ? '!bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400 shadow-md' : ''}
                    `}
                >
                    {(isSelectModeActive || isAnythingSelected) && (
                        <div className="flex items-center justify-center self-stretch md:self-auto" onClick={(e) => e.stopPropagation()}>
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={selectedRequests.has(req.id)}
                                onChange={() => handleSelectOne(req.id)}
                            />
                        </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <div className="group/copy flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
                                <span className="font-mono text-sm font-bold text-indigo-700">{req.id}</span>
                                <button 
                                    onClick={(e) => handleCopyId(e, req.id)}
                                    className="text-indigo-400 hover:text-indigo-700 transition-colors p-0.5 rounded opacity-0 group-hover/copy:opacity-100 focus:opacity-100"
                                    title="Copy Log ID"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wider border border-slate-200">
                                {getTransportIcon(req.shippingMethod)} {req.shippingMethod}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${getStatusColor(req.status)}`}>
                                {req.status === 'PENDING' ? 'PENDING L1' : req.status === 'PENDING_L2' ? 'PENDING L2' : req.status}
                            </span>
                            {getRiskIndicator(req.aiAnalysis)}
                        </div>
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-lg">
                            <span title={req.origin}>{req.originCode || req.origin}</span>
                            <span className="text-slate-300">→</span>
                            <span title={req.destination}>{req.destCode || req.destination}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 font-medium"><Truck size={12} className="text-slate-400" /> {req.forwarder}</span>
                            <span>•</span>
                            <span>ETD: {req.etd ? new Date(req.etd).toLocaleDateString() : 'N/A'}</span>
                            {approverInfo && (
                                <>
                                    <span className="hidden md:inline">•</span>
                                    <span className={`flex items-center gap-1 font-medium ${approverInfo.color} w-full md:w-auto mt-1 md:mt-0`}>
                                        <UserIcon size={12} /> {approverInfo.label}: {approverInfo.name}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="text-right min-w-[100px]">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Total Cost</p>
                        <p className="text-xl font-bold text-slate-800">
                             {req.totalFreightCost ? `$${req.totalFreightCost.toLocaleString()}` : (req.price ? `$${req.price.toLocaleString()}` : '-')}
                        </p>
                        {req.totalFreightCost ? (
                            <p className="text-[10px] text-green-600 font-medium">Actual</p>
                        ) : (
                            <p className="text-[10px] text-amber-600 font-medium">Estimated</p>
                        )}
                    </div>
                    
                    {!isSelectModeActive && (
                        <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" size={20} />
                    )}
                </div>
            )})
        ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                    <Truck size={32} />
                </div>
                <p className="font-medium text-slate-600">No pending requests found.</p>
                <p className="text-sm text-slate-500">All requests are up to date.</p>
            </div>
        )}
      </div>

      <Pagination 
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />

      {/* Bulk Reject Modal */}
      {isBulkRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
              <div className="p-6">
                 <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 mx-auto">
                    <AlertTriangle size={24} />
                 </div>
                 <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Bulk Reject</h3>
                 <p className="text-center text-slate-500 text-sm mb-6">
                    You are about to reject {selectedRequests.size} requests. This action cannot be undone easily.
                 </p>
                 <textarea 
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    rows={3}
                    placeholder="Reason for rejection (applied to all)..."
                    value={bulkRejectReason}
                    onChange={e => setBulkRejectReason(e.target.value)}
                 />
              </div>
              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                 <button onClick={() => setIsBulkRejectModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100">Cancel</button>
                 <button onClick={handleConfirmBulkReject} disabled={!bulkRejectReason.trim()} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">Confirm Reject All</button>
              </div>
           </div>
        </div>
      )}

      {/* Bulk Approve Modal */}
      {isBulkApproveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
              <div className="p-6">
                 <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600 mx-auto">
                    <ThumbsUp size={24} />
                 </div>
                 <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Bulk Approve</h3>
                 
                 <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm text-blue-800 flex items-start gap-2">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>The system will only process requests where you are the authorized approver for the current stage.</p>
                 </div>

                 <p className="text-center text-slate-500 text-sm mb-6">
                    You have selected {selectedRequests.size} requests.
                 </p>
                 <textarea 
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    rows={3}
                    placeholder="Optional approval remarks..."
                    value={bulkApproveRemark}
                    onChange={e => setBulkApproveRemark(e.target.value)}
                 />
              </div>
              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                 <button onClick={() => setIsBulkApproveModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100">Cancel</button>
                 <button onClick={handleConfirmBulkApprove} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">Confirm Approve</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default RequestList;
