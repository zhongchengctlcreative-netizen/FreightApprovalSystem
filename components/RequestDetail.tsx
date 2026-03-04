
import React, { useState, useEffect, useCallback } from 'react';
import { FreightRequest, User, DashboardData } from '../types';
import ShipmentHeader from './detail/ShipmentHeader';
import ActionSidebar from './detail/ActionSidebar';
import ShipmentRoute from './detail/ShipmentRoute';
import ShipmentSpecs from './detail/ShipmentSpecs';
import ShipmentLogistics from './detail/ShipmentLogistics';
import ShipmentTimeline from './detail/ShipmentTimeline';
import FileManagement from './FileManagement';
import { History } from 'lucide-react';

interface RequestDetailProps {
  request: FreightRequest;
  currentUser: User | null;
  users: User[];
  onBack: () => void;
  backLabel?: string;
  onUpdateStatus: (id: string, status: any, analysis?: string, remark?: string) => void;
  onUpdateRequestDetails: (id: string, updates: Partial<FreightRequest>) => void;
  dashboardData?: DashboardData | null;
}

const RequestDetail: React.FC<RequestDetailProps> = ({ request, currentUser, users, onBack, backLabel, onUpdateStatus, onUpdateRequestDetails, dashboardData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<FreightRequest>(request);

  const isOwner = (!!currentUser?.email && !!request.requesterEmail && currentUser.email.toLowerCase() === request.requesterEmail?.toLowerCase())
             || (!!currentUser?.name && !!request.requester && currentUser.name.toLowerCase() === request.requester.toLowerCase());

  const canManageFiles = currentUser?.role === 'ADMIN' || currentUser?.role === 'APPROVER' || currentUser?.role === 'LOGISTICS' || isOwner;

  useEffect(() => {
    if (!isEditing) setEditForm(request);
  }, [request, isEditing]);

  // Auto-calculate Transit Analysis fields
  useEffect(() => {
    if (!isEditing) return;

    // Modified diffDays to return null instead of undefined for clearing values
    const diffDays = (startStr?: string | null, endStr?: string | null): number | null => {
      if (!startStr || !endStr) return null;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      const diffTime = end.getTime() - start.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Formula involves +1
    };

    setEditForm(prev => {
      let changed = false;
      const updates: any = {};

      // Helper to update if changed (handling undefined/null)
      const updateIfDifferent = (key: keyof FreightRequest, newVal: number | null | undefined) => {
          const currentVal = prev[key];
          // Check inequality. Treat null/undefined as same 'empty' state for comparison
          const currentEmpty = currentVal === null || currentVal === undefined;
          const newEmpty = newVal === null || newVal === undefined;
          
          if (currentEmpty && newEmpty) return;
          
          if (currentVal !== newVal) {
              updates[key] = newVal;
              changed = true;
          }
      };

      // 1. CRD to ETD default
      if (prev.crdToEtd === undefined || prev.crdToEtd === null || prev.crdToEtd === 0) {
         updates.crdToEtd = 7;
         changed = true;
      }

      // 2. Origin Transit = ATD - ETD + 1
      updateIfDifferent('transitDayOrigin', diffDays(prev.etd, prev.atd));

      // 3. Vessel Transit = ATA - ATD + 1
      updateIfDifferent('transitDayVessel', diffDays(prev.atd, prev.ata));

      // 4. Dest Transit = ATA - ETA + 1
      updateIfDifferent('transitDayDest', diffDays(prev.eta, prev.ata));

      // 5. In Warehouse = Delivery Date - ATA + 1
      updateIfDifferent('arrivalInWarehouse', diffDays(prev.ata, prev.deliveryDate));

      if (changed) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [
    isEditing,
    editForm.etd, 
    editForm.atd, 
    editForm.eta, 
    editForm.ata, 
    editForm.deliveryDate,
    editForm.crdToEtd
  ]);

  const handleSaveEdit = useCallback(() => {
    // Total Leadtime Calculation: Sum of transit fields
    // EXCLUDED: transitDayOrigin and transitDayDest as per requirements
    const newTotal = (Number(editForm.crdToEtd) || 0) + 
                     (Number(editForm.transitDayVessel) || 0) +
                     (Number(editForm.arrivalInWarehouse) || 0);
    
    const finalForm = { ...editForm, totalLeadTime: newTotal };
    onUpdateRequestDetails(request.id, finalForm);
    setIsEditing(false);
  }, [editForm, onUpdateRequestDetails, request.id]);

  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      <ShipmentHeader
        request={request}
        isEditing={isEditing}
        onBack={onBack}
        backLabel={backLabel}
        onToggleEdit={() => setIsEditing(!isEditing)}
        onSave={handleSaveEdit}
        onCancel={() => { setEditForm(request); setIsEditing(false); }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
        <div className="lg:col-span-2 space-y-6">
          <div id="printable-report" className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
            <ShipmentRoute request={request} editForm={editForm} isEditing={isEditing} setEditForm={setEditForm} />
            <ShipmentSpecs request={request} editForm={editForm} isEditing={isEditing} setEditForm={setEditForm} />
            <ShipmentLogistics request={request} editForm={editForm} isEditing={isEditing} setEditForm={setEditForm} />
            <ShipmentTimeline request={request} editForm={editForm} isEditing={isEditing} setEditForm={setEditForm} />
          </div>

          <FileManagement request={request} canUpload={canManageFiles} />
        </div>

        <div className="no-print pdf-hidden">
            <ActionSidebar
            request={request}
            currentUser={currentUser}
            onUpdateStatus={onUpdateStatus}
            users={users}
            dashboardData={dashboardData}
            isEditing={isEditing}
            editForm={editForm}
            setEditForm={setEditForm}
            />
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;
