
import React, { useState, useMemo } from 'react';
import { FreightRequest, RequestStatus, User, DashboardData } from '../../types';
import { Check, X, AlertTriangle, Loader2, History, CheckCircle, XCircle, ThumbsUp, Ban, ShieldCheck, Lock, Bell, Send, MessageSquare, TrendingUp, RefreshCw, ClipboardCheck } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { useToast } from '../../contexts/ToastContext';

interface ActionSidebarProps {
  request: FreightRequest;
  currentUser: User | null;
  users: User[];
  onUpdateStatus: (id: string, status: RequestStatus, analysis?: string, remark?: string) => void;
  dashboardData?: DashboardData | null;
  isEditing?: boolean;
  editForm?: FreightRequest;
  setEditForm?: (form: FreightRequest) => void;
}

const ActionSidebar: React.FC<ActionSidebarProps> = ({ request, currentUser, users, onUpdateStatus, dashboardData, isEditing, editForm, setEditForm }) => {
  const { success, error } = useToast();
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveRemark, setApproveRemark] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  
  // Resubmit Modal State
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [resubmitNote, setResubmitNote] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isApprover = currentUser?.role === 'APPROVER';
  const isLogistics = currentUser?.role === 'LOGISTICS';
  const isOwner = (!!currentUser?.email && !!request.requesterEmail && currentUser.email.toLowerCase() === request.requesterEmail.toLowerCase())
             || (!!currentUser?.name && !!request.requester && currentUser.name.toLowerCase() === request.requester.toLowerCase());

  const isL1Stage = request.status === RequestStatus.PENDING;
  const isL2Stage = request.status === RequestStatus.PENDING_L2;
  const isApproved = request.status === RequestStatus.APPROVED;
  const isRejected = request.status === RequestStatus.REJECTED;
  const isTerminated = isRejected || request.status === RequestStatus.CANCELLED;

  const isFirstApprover = currentUser?.email && request.firstApprover && currentUser.email.toLowerCase() === request.firstApprover.toLowerCase();
  const isSecondApprover = currentUser?.email && request.secondApprover && currentUser.email.toLowerCase() === request.secondApprover.toLowerCase();

  let canApproveCurrentStage = false;
  if (isApprover) {
      if (isL1Stage) {
          canApproveCurrentStage = !!isFirstApprover || (!request.firstApprover);
      } else if (isL2Stage) {
          canApproveCurrentStage = !!isSecondApprover;
      }
  }

  let approvalBlockReason = '';
  if (!canApproveCurrentStage && isApprover && !isTerminated && !isApproved) {
      if (isL1Stage && isSecondApprover) approvalBlockReason = "Waiting for Level 1 Approval";
      else if (isL1Stage && !isFirstApprover) approvalBlockReason = "Not assigned as First Approver";
      else if (isL2Stage && isFirstApprover) approvalBlockReason = "Pending Level 2 Approval";
      else if (isL2Stage && !isSecondApprover) approvalBlockReason = "Not assigned as Second Approver";
  }

  const canRequesterCancel = currentUser?.role === 'REQUESTER' && isOwner && (isL1Stage || isL2Stage);
  const canPrivilegedCancel = (isAdmin || isLogistics) && (isL1Stage || isL2Stage || isApproved);
  const canSendReminder = (isL1Stage || isL2Stage) && (isOwner || isAdmin || isLogistics);
  const canResubmit = isRejected && (isOwner || isAdmin || isLogistics);
  
  const targetApproverEmail = isL1Stage ? request.firstApprover : request.secondApprover;

  const getApproverName = (email?: string) => {
      if (!email) return null;
      const user = users.find(u => u.email === email);
      return user ? user.name : email;
  };

  const firstApproverName = getApproverName(request.firstApprover);
  const secondApproverName = getApproverName(request.secondApprover);
  const currentTargetName = getApproverName(targetApproverEmail);

  const matchingRow = useMemo(() => {
      if (!request || !dashboardData) return null;
      const isAir = request.shippingMethod?.toLowerCase().includes('air');
      const list = isAir ? dashboardData.airBreakdown : dashboardData.destinationBreakdown;
      const destCode = (request.destCode || request.destination || '').toUpperCase().trim();
      return list.find(r => r.destination.toUpperCase() === destCode);
  }, [request, dashboardData]);

  const handleStatusChange = (status: RequestStatus) => {
    if (status === RequestStatus.REJECTED) setIsRejectModalOpen(true);
    else if (status === RequestStatus.APPROVED) setIsApproveModalOpen(true);
    else if (status === RequestStatus.CANCELLED) setIsCancelModalOpen(true);
    else onUpdateStatus(request.id, status, undefined);
  };

  const handleConfirmReject = () => {
    onUpdateStatus(request.id, RequestStatus.REJECTED, undefined, rejectReason);
    setIsRejectModalOpen(false);
    setRejectReason('');
  };

  const handleConfirmApprove = () => {
    onUpdateStatus(request.id, RequestStatus.APPROVED, undefined, approveRemark);
    setIsApproveModalOpen(false);
    setApproveRemark('');
  };

  const handleConfirmCancel = () => {
    onUpdateStatus(request.id, RequestStatus.CANCELLED, undefined, cancellationReason);
    setIsCancelModalOpen(false);
    setCancellationReason('');
  };

  const handleResubmitClick = () => {
      setIsResubmitModalOpen(true);
      setResubmitNote('');
      setIsVerified(false);
  };

  const handleConfirmResubmit = () => {
      const note = resubmitNote.trim() || "Resubmitted for approval";
      onUpdateStatus(request.id, RequestStatus.PENDING, undefined, note);
      setIsResubmitModalOpen(false);
  };

  const handleSendReminder = async () => {
      if (!currentUser) return;
      setIsSendingReminder(true);
      try {
          await notificationService.sendReminder(request, currentUser.name, reminderNote);
          success("Reminder email sent successfully.");
          setReminderNote('');
      } catch (e: any) {
          error(e.message || "Failed to send reminder.");
      } finally {
          setIsSendingReminder(false);
      }
  };
  
  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  const getAvg = (cost: number, weightOrCount: number) => weightOrCount > 0 ? cost / weightOrCount : 0;

  return (
    <div className="space-y-6 pdf-hidden">
      {(request.firstApprover || request.secondApprover) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ShieldCheck size={16} className="text-slate-500"/> Approval Workflow
            </h3>
            <div className="flex flex-col gap-4">
                {firstApproverName && (
                    <div className={`flex items-center gap-3 text-sm p-2 rounded-lg transition-colors ${isL1Stage ? 'bg-amber-50 border border-amber-100' : ''}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${request.status === RequestStatus.PENDING_L2 || request.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                            {request.status === RequestStatus.PENDING_L2 || request.status === RequestStatus.APPROVED ? <Check size={12} /> : '1'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${isL1Stage ? 'text-amber-800' : 'text-slate-700'}`}>{firstApproverName}</p>
                            <p className="text-xs text-slate-400">First Approver</p>
                        </div>
                        {isL1Stage && <span className="ml-auto text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Pending</span>}
                    </div>
                )}
                {secondApproverName && (
                    <>
                        <div className="pl-5 -my-3 text-slate-300"><div className={`h-6 w-0.5 ${request.status === RequestStatus.PENDING_L2 || request.status === RequestStatus.APPROVED ? 'bg-green-300' : 'bg-slate-200'}`}></div></div>
                        <div className={`flex items-center gap-3 text-sm p-2 rounded-lg transition-colors ${isL2Stage ? 'bg-blue-50 border border-blue-100' : ''}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                                request.status === RequestStatus.APPROVED 
                                    ? 'bg-green-100 text-green-700 border-green-200' 
                                    : request.status === RequestStatus.PENDING_L2 
                                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}>
                                {request.status === RequestStatus.APPROVED ? <Check size={12} /> : '2'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-semibold truncate ${isL2Stage ? 'text-blue-800' : 'text-slate-700'}`}>{secondApproverName}</p>
                                <p className="text-xs text-slate-400">Second Approver</p>
                            </div>
                            {isL2Stage && <span className="ml-auto text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Pending</span>}
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

      {/* Remarks Card */}
      <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-100 p-6">
         <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-amber-600" /> Remarks
         </h3>
         
         {isEditing && editForm && setEditForm ? (
            <textarea 
                rows={3} 
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-md resize-none text-sm focus:ring-2 focus:ring-amber-500/20 outline-none" 
                value={editForm.commodity || ''} 
                onChange={e => setEditForm({...editForm, commodity: e.target.value})} 
                placeholder="Enter remarks here..."
            />
         ) : (
            <div className="text-sm text-amber-900/80 whitespace-pre-wrap leading-relaxed italic bg-white/50 p-3 rounded-lg border border-amber-100/50">
                {request.commodity ? `"${request.commodity}"` : <span className="text-amber-400 not-italic">No remarks provided.</span>}
            </div>
         )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Actions</h3>
        <div className="space-y-3">
          {!isApproved && !isTerminated && (
              <>
                {canApproveCurrentStage ? (
                    <>
                    <button onClick={() => handleStatusChange(RequestStatus.APPROVED)} className="w-full py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                        <Check size={18} /> {isL1Stage && request.secondApprover ? 'Approve & Pass to L2' : 'Final Approve'}
                    </button>
                    <button onClick={() => handleStatusChange(RequestStatus.REJECTED)} className="w-full py-2.5 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors shadow-sm flex items-center justify-center gap-2">
                        <X size={18} /> Reject
                    </button>
                    </>
                ) : (
                    isApprover && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                            <div className="flex justify-center mb-1 text-slate-400"><Lock size={20} /></div>
                            <p className="text-sm font-semibold text-slate-600">Approval Locked</p>
                            <p className="text-xs text-slate-500 mt-1">{approvalBlockReason || "It is not your turn to approve."}</p>
                        </div>
                    )
                )}
              </>
          )}

          {canResubmit && (
              <button 
                onClick={handleResubmitClick} 
                className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} /> Resend for Approval
              </button>
          )}

           {(canPrivilegedCancel || canRequesterCancel) && (
            <button 
              onClick={() => handleStatusChange(RequestStatus.CANCELLED)} 
              className="w-full py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg hover:bg-slate-50 hover:text-red-600 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Ban size={16} /> Cancel Shipment
            </button>
          )}
          
          {!isApprover && isL1Stage && !isOwner && !isAdmin && ( <div className="text-sm text-slate-500 text-center italic bg-slate-50 p-3 rounded-lg">Waiting for First Approver.</div> )}
          {!isApprover && isL2Stage && !isOwner && !isAdmin && ( <div className="text-sm text-slate-500 text-center italic bg-slate-50 p-3 rounded-lg">Waiting for Second Approver.</div> )}
          
          {isApproved && ( <div className="bg-green-50 border border-green-100 p-4 rounded-lg"><div className="flex items-center gap-2 text-green-700 font-bold mb-2"><CheckCircle size={18} /> Approved</div><p className="text-xs text-green-800 mb-1">By: <span className="font-semibold">{request.approvedBy || 'Unknown'}</span></p><p className="text-xs text-green-800">Date: {formatDate(request.approvalDate)}</p>{request.approvalRemark && ( <div className="mt-2 pt-2 border-t border-green-200 text-xs text-green-800 italic">"{request.approvalRemark}"</div> )}</div> )}
          {request.status === RequestStatus.REJECTED && ( <div className="bg-red-50 border border-red-100 p-4 rounded-lg"><div className="flex items-center gap-2 text-red-700 font-bold mb-2"><XCircle size={18} /> Rejected</div><p className="text-xs text-red-800 mb-1">By: <span className="font-semibold">{request.rejectedBy || 'Unknown'}</span></p><p className="text-xs text-red-800">Date: {formatDate(request.rejectionDate)}</p>{request.rejectionReason && ( <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-800 italic">"{request.rejectionReason}"</div> )}</div> )}
          {request.status === RequestStatus.CANCELLED && ( <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg"><div className="flex items-center gap-2 text-slate-700 font-bold mb-2"><XCircle size={18} /> Cancelled</div><p className="text-xs text-slate-800 mb-1">By: <span className="font-semibold">{request.cancelledBy || 'Unknown'}</span></p><p className="text-xs text-slate-800">Date: {formatDate(request.cancellationDate)}</p>{request.cancellationReason && ( <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-800 italic">"{request.cancellationReason}"</div> )}</div> )}
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2"><History size={16} className="text-slate-400" /> History</h3>
        <div className="relative border-l-2 border-slate-100 ml-2 space-y-8 pb-2">
          
          {/* 1. Submission (Always First) */}
          <div className="ml-4 relative">
             <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-slate-200 border-4 border-white shadow-sm"></div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.submissionDate)}</p>
             <p className="text-sm font-bold text-slate-800">Request Submitted</p>
             <p className="text-xs text-slate-500">by {request.requester}</p>
          </div>
          
          {/* 2. Previous Rejection (Show if rejection history exists AND we are NOT currently in the Rejected state) */}
          {request.rejectionDate && request.status !== RequestStatus.REJECTED && request.status !== RequestStatus.CANCELLED && (
            <div className="ml-4 relative animate-fade-in opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
              <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-red-300 border-4 border-white shadow-sm"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.rejectionDate)}</p>
              <p className="text-sm font-bold text-red-800">Previously Rejected</p>
              <p className="text-xs text-slate-500">by <span className="font-semibold text-slate-700">{request.rejectedBy || 'Unknown'}</span></p>
              {request.rejectionReason && <p className="text-xs text-slate-500 mt-1 bg-red-50 p-2 rounded-md italic border border-red-100">"{request.rejectionReason}"</p>}
            </div>
          )}

          {/* 3. Resubmission (If recorded) */}
          {request.resubmissionDate && (
            <div className="ml-4 relative animate-fade-in">
              <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.resubmissionDate)}</p>
              <p className="text-sm font-bold text-indigo-700">Resubmitted</p>
              {request.resubmissionNote && <p className="text-xs text-slate-500 mt-1 bg-indigo-50 p-2 rounded-md italic border border-indigo-100">"{request.resubmissionNote}"</p>}
            </div>
          )}
          
          {/* 4. L1 Approval (Current Cycle) */}
          {request.l1ApprovalDate && (
            <div className="ml-4 relative animate-fade-in">
              <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-amber-500 border-4 border-white shadow-sm"></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.l1ApprovalDate)}</p>
              <p className="text-sm font-bold text-amber-700">Level 1 Approved</p>
              <p className="text-xs text-slate-500">by <span className="font-semibold text-slate-700">{request.l1ApprovedBy || 'Unknown'}</span></p>
              {request.l1ApprovalRemark && <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded-md italic border border-slate-100">"{request.l1ApprovalRemark}"</p>}
            </div>
          )}

          {/* 5. Final Status (Only show if the CURRENT status is Approved, Rejected, or Cancelled) */}
          {/* This prevents displaying stale rejection info when the item is pending (e.g. L2) */}
          {(request.status === RequestStatus.APPROVED || request.status === RequestStatus.REJECTED || request.status === RequestStatus.CANCELLED) && (
            <div className="ml-4 relative animate-fade-in">
              <div className={`absolute -left-[25px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm ${
                  request.status === 'APPROVED' ? 'bg-green-500' : 
                  request.status === 'REJECTED' ? 'bg-red-500' : 'bg-slate-500'
              }`}></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  {formatDate(request.approvalDate || request.rejectionDate || request.cancellationDate)}
              </p>
              <p className={`text-sm font-bold ${
                  request.status === 'APPROVED' ? 'text-green-700' : 
                  request.status === 'REJECTED' ? 'text-red-700' : 'text-slate-800'
              }`}>
                  Request {request.status}
              </p>
              <p className="text-xs text-slate-500">
                  by <span className="font-semibold text-slate-700">{request.approvedBy || request.rejectedBy || request.cancelledBy || 'Unknown'}</span>
              </p>
              {(request.approvalRemark || (request.status === 'REJECTED' && request.rejectionReason) || request.cancellationReason) && (
                  <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded-md italic border border-slate-100">
                      "{request.approvalRemark || (request.status === 'REJECTED' ? request.rejectionReason : request.cancellationReason)}"
                  </p>
              )}
            </div>
          )}
        </div>
      </div>

      {canSendReminder && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Bell size={16} className="text-indigo-600" /> Send Reminder
              </h3>
              
              <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                      Send a notification email to <span className="font-bold text-slate-800">{currentTargetName || 'Approver'}</span> regarding this pending {isL1Stage ? 'Level 1' : 'Level 2'} request.
                  </div>
                  
                  <div className="relative">
                      <MessageSquare size={14} className="absolute left-3 top-3 text-slate-400" />
                      <textarea 
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-slate-50"
                          rows={2}
                          placeholder="Add an optional note..."
                          value={reminderNote}
                          onChange={(e) => setReminderNote(e.target.value)}
                      />
                  </div>

                  <button 
                      onClick={handleSendReminder}
                      disabled={isSendingReminder || !targetApproverEmail}
                      className="w-full py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isSendingReminder ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {isSendingReminder ? 'Sending...' : 'Send Reminder Email'}
                  </button>
              </div>
          </div>
      )}

      {matchingRow && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp size={16} className="text-indigo-600" /> Shipment Analysis
                  </h3>
                  <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{matchingRow.destination}</div>
              </div>
              
              <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                          <tr>
                              <th className="p-2 text-left font-bold">Period</th>
                              <th className="p-2 text-center font-bold">Count</th>
                              <th className="p-2 text-right font-bold">Total Cost</th>
                              <th className="p-2 text-right font-bold">{matchingRow.isRail || !request.shippingMethod?.toLowerCase().includes('air') ? 'Avg Cost' : 'Avg / KG'}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          <tr>
                              <td className="p-2 font-medium text-slate-700 bg-green-50/50">Current Q</td>
                              <td className="p-2 text-center text-slate-700 font-bold">{matchingRow.current.count}</td>
                              <td className="p-2 text-right text-slate-700">{formatCurrency(matchingRow.current.cost)}</td>
                              <td className="p-2 text-right text-slate-700 font-mono">{formatCurrency(matchingRow.isRail || !request.shippingMethod?.toLowerCase().includes('air') ? getAvg(matchingRow.current.cost, matchingRow.current.count) : getAvg(matchingRow.current.cost, matchingRow.current.weight))}</td>
                          </tr>
                          <tr>
                              <td className="p-2 font-medium text-slate-600 bg-blue-50/50">Prev Q</td>
                              <td className="p-2 text-center text-slate-600">{matchingRow.previous.count}</td>
                              <td className="p-2 text-right text-slate-600">{formatCurrency(matchingRow.previous.cost)}</td>
                              <td className="p-2 text-right text-slate-600 font-mono">{formatCurrency(matchingRow.isRail || !request.shippingMethod?.toLowerCase().includes('air') ? getAvg(matchingRow.previous.cost, matchingRow.previous.count) : getAvg(matchingRow.previous.cost, matchingRow.previous.weight))}</td>
                          </tr>
                          <tr>
                              <td className="p-2 font-medium text-slate-500 bg-orange-50/50">Last Year</td>
                              <td className="p-2 text-center text-slate-500">{matchingRow.lastYear.count}</td>
                              <td className="p-2 text-right text-slate-500">{formatCurrency(matchingRow.lastYear.cost)}</td>
                              <td className="p-2 text-right text-slate-500 font-mono">{formatCurrency(matchingRow.isRail || !request.shippingMethod?.toLowerCase().includes('air') ? getAvg(matchingRow.lastYear.cost, matchingRow.lastYear.count) : getAvg(matchingRow.lastYear.cost, matchingRow.lastYear.weight))}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              <div className="mt-2 text-[10px] text-slate-400 text-center italic">
                  Breakdown for {matchingRow.isRail ? 'Rail' : request.shippingMethod?.toLowerCase().includes('air') ? 'Air' : 'Sea'} Shipments
              </div>
          </div>
      )}
      
      {isRejectModalOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"><div className="p-6"><div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 mx-auto"><AlertTriangle size={24} /></div><h3 className="text-xl font-bold text-center text-slate-900 mb-2">Reject Request</h3><p className="text-center text-slate-500 text-sm mb-6">Are you sure you want to reject this freight request? Please provide a reason.</p><textarea className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm" rows={3} placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></div><div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100"><button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100">Cancel</button><button onClick={handleConfirmReject} disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">Confirm Rejection</button></div></div></div> )}
      {isApproveModalOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"><div className="p-6"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600 mx-auto"><ThumbsUp size={24} /></div><h3 className="text-xl font-bold text-center text-slate-900 mb-2">{isL1Stage && request.secondApprover ? 'Approve Level 1' : 'Final Approval'}</h3><p className="text-center text-slate-500 text-sm mb-6">You are about to approve this shipment.{isL1Stage && request.secondApprover ? ' It will be forwarded to the Second Approver.' : ' It will be marked as fully approved.'}</p><textarea className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" rows={3} placeholder="Optional remarks..." value={approveRemark} onChange={e => setApproveRemark(e.target.value)} /></div><div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100"><button onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100">Cancel</button><button onClick={handleConfirmApprove} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700">Confirm Approval</button></div></div></div> )}
      {isCancelModalOpen && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"><div className="p-6"><div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-600 mx-auto"><Ban size={24} /></div><h3 className="text-xl font-bold text-center text-slate-900 mb-2">Cancel Shipment</h3><p className="text-center text-slate-500 text-sm mb-6">Provide a reason for cancelling this shipment. This action cannot be undone.</p><textarea className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm" rows={3} placeholder="Reason for cancellation..." value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} /></div><div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100"><button onClick={() => setIsCancelModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100">Back</button><button onClick={handleConfirmCancel} disabled={!cancellationReason.trim()} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">Confirm Cancellation</button></div></div></div> )}
      
      {/* Resubmit Verification Modal */}
      {isResubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="p-6">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600 mx-auto">
                        <RefreshCw size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Resubmit Request?</h3>
                    <p className="text-center text-slate-500 text-sm mb-4">
                        This will restart the approval workflow at Level 1.
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6 text-xs text-blue-800">
                        <div className="flex items-center gap-2 font-bold mb-1">
                            <ClipboardCheck size={14} /> Verification Required
                        </div>
                        <ul className="list-disc list-inside space-y-1 ml-1 opacity-90">
                            <li>Have you updated the Cost or Weight if required?</li>
                            <li>Is the Carrier and Route information correct?</li>
                            <li>Have you attached any missing documents?</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <textarea 
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50 focus:bg-white transition-colors" 
                            rows={2} 
                            placeholder="Optional note for the approver..." 
                            value={resubmitNote} 
                            onChange={e => setResubmitNote(e.target.value)} 
                        />
                        
                        <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors select-none">
                            <input 
                                type="checkbox" 
                                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                checked={isVerified} 
                                onChange={e => setIsVerified(e.target.checked)} 
                            />
                            <span className="text-xs font-semibold text-slate-700">I have verified that all shipment details are updated and correct.</span>
                        </label>
                    </div>
                </div>
                <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                    <button onClick={() => setIsResubmitModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100">Cancel</button>
                    <button 
                        onClick={handleConfirmResubmit} 
                        disabled={!isVerified} 
                        className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                        Confirm Resubmit
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ActionSidebar;
