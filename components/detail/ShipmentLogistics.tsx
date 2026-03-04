
import React from 'react';
import { FreightRequest } from '../../types';
import { Anchor, FileText, Container, Hash, Timer, Ship } from 'lucide-react';

interface ShipmentLogisticsProps {
  request: FreightRequest;
  editForm: FreightRequest;
  isEditing: boolean;
  setEditForm: (form: FreightRequest) => void;
}

const InfoItem: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label><div className="flex items-center gap-3 text-sm font-semibold text-slate-700 bg-slate-50/50 px-3 py-2 rounded-md border border-slate-100">{icon}{children}</div></div>
);

const EditItem: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label><div className="flex items-center gap-2">{icon}{children}</div></div>
);

const TransitDayBox: React.FC<{ label: string; value: number | undefined; isEditing: boolean; onChange: (val: number) => void; className?: string; icon?: React.ReactNode }> = 
({ label, value, isEditing, onChange, className = 'bg-slate-50 border-slate-200', icon }) => (
  <div className={`${className} p-3 rounded-lg border flex flex-col items-center relative overflow-hidden`}>
    {icon}
    <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 h-8 flex items-center justify-center text-center leading-tight">{label}</p>
    <div className="flex-1 flex items-center justify-center w-full">
      {isEditing ? <input type="number" className="w-full text-center bg-white border rounded py-1 font-bold" value={value || 0} onChange={e => onChange(Number(e.target.value))} /> : <p className="text-xl font-bold text-slate-900">{value || '-'}</p>}
    </div>
  </div>
);

const ShipmentLogistics: React.FC<ShipmentLogisticsProps> = ({ request, editForm, isEditing, setEditForm }) => {
  return (
    <>
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Logistics & Tracking</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {isEditing ? (
          <>
            <EditItem label="Sea/Air Port" icon={<Anchor size={16} className="text-slate-400" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.seaPort || ''} onChange={e => setEditForm({...editForm, seaPort: e.target.value})} /></EditItem>
            <EditItem label="Carrier Line" icon={<Ship size={16} className="text-slate-400" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.carrier || ''} onChange={e => setEditForm({...editForm, carrier: e.target.value})} /></EditItem>
            <EditItem label="Vessel Name" icon={<Ship size={16} className="text-slate-400 opacity-50" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.vesselName || ''} onChange={e => setEditForm({...editForm, vesselName: e.target.value})} /></EditItem>
            <EditItem label="BL / AWB" icon={<FileText size={16} className="text-slate-400" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.blAwb || ''} onChange={e => setEditForm({...editForm, blAwb: e.target.value})} /></EditItem>
            <EditItem label="Container #" icon={<Container size={16} className="text-slate-400" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.containerNumber || ''} onChange={e => setEditForm({...editForm, containerNumber: e.target.value})} /></EditItem>
            <EditItem label="Invoice #" icon={<FileText size={16} className="text-slate-400" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.invoiceNumber || ''} onChange={e => setEditForm({...editForm, invoiceNumber: e.target.value})} /></EditItem>
            <EditItem label="Tax Invoice #" icon={<Hash size={16} className="text-slate-400" />}><input type="text" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-sm" value={editForm.taxInvoiceNumber || ''} onChange={e => setEditForm({...editForm, taxInvoiceNumber: e.target.value})} /></EditItem>
          </>
        ) : (
          <>
            <InfoItem label="Sea/Air Port" icon={<Anchor size={16} className="text-slate-400 flex-shrink-0" />}>{request.seaPort || 'N/A'}</InfoItem>
            <InfoItem label="Carrier Line" icon={<Ship size={16} className="text-slate-400 flex-shrink-0" />}>{request.carrier || 'N/A'}</InfoItem>
            <InfoItem label="Vessel Name" icon={<Ship size={16} className="text-slate-400 flex-shrink-0 opacity-50" />}>{request.vesselName || 'N/A'}</InfoItem>
            <InfoItem label="BL / AWB" icon={<FileText size={16} className="text-slate-400 flex-shrink-0" />}>{request.blAwb || 'N/A'}</InfoItem>
            <InfoItem label="Container #" icon={<Container size={16} className="text-slate-400 flex-shrink-0" />}>{request.containerNumber || 'N/A'}</InfoItem>
            <InfoItem label="Invoice #" icon={<FileText size={16} className="text-slate-400 flex-shrink-0" />}>{request.invoiceNumber || 'N/A'}</InfoItem>
            <InfoItem label="Tax Invoice #" icon={<Hash size={16} className="text-slate-400 flex-shrink-0" />}>{request.taxInvoiceNumber || 'N/A'}</InfoItem>
          </>
        )}
      </div>

      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Transit Analysis (Days)</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <TransitDayBox label="CRD to ETD" value={isEditing ? editForm.crdToEtd : request.crdToEtd} isEditing={isEditing} onChange={val => setEditForm({...editForm, crdToEtd: val})} />
        <TransitDayBox label="Origin Transit" value={isEditing ? editForm.transitDayOrigin : request.transitDayOrigin} isEditing={isEditing} onChange={val => setEditForm({...editForm, transitDayOrigin: val})} />
        <TransitDayBox label="Vessel Transit" value={isEditing ? editForm.transitDayVessel : request.transitDayVessel} isEditing={isEditing} onChange={val => setEditForm({...editForm, transitDayVessel: val})} />
        <TransitDayBox label="Dest Transit" value={isEditing ? editForm.transitDayDest : request.transitDayDest} isEditing={isEditing} onChange={val => setEditForm({...editForm, transitDayDest: val})} />
        <TransitDayBox label="In Warehouse" value={isEditing ? editForm.arrivalInWarehouse : request.arrivalInWarehouse} isEditing={isEditing} onChange={val => setEditForm({...editForm, arrivalInWarehouse: val})} />
        
        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-0.5"><Timer size={10} className="text-indigo-400" /></div>
            <p className="text-[10px] md:text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2 h-8 flex items-center justify-center text-center leading-tight">Total Leadtime</p>
            <div className="flex-1 flex items-center justify-center w-full"><p className="text-xl font-bold text-indigo-900">{request.totalLeadTime || '-'}</p></div>
        </div>
      </div>
    </>
  );
};

export default ShipmentLogistics;
