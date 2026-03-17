
import React, { useState } from 'react';
import { FreightRequest } from '../../types';
import { Anchor, FileText, Container, Hash, Timer, Ship, Box, Plus, Trash2, X, ExternalLink } from 'lucide-react';

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
  const [isPalletModalOpen, setIsPalletModalOpen] = useState(false);

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
            
            <div className="flex flex-col gap-1 md:col-span-3 mt-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <Box size={16} className="text-slate-400" /> Palletization Dimensions
              </label>
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPalletModalOpen(true)}
                  className="text-sm bg-white border border-slate-300 text-slate-700 font-medium flex items-center gap-2 hover:bg-slate-50 py-1.5 px-3 rounded-md"
                >
                  <Box size={16} className="text-indigo-500" />
                  Manage Pallets ({(editForm.palletDimensions || []).length})
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <InfoItem label="Sea/Air Port" icon={<Anchor size={16} className="text-slate-400 flex-shrink-0" />}>{request.seaPort || 'N/A'}</InfoItem>
            <InfoItem label="Carrier Line" icon={<Ship size={16} className="text-slate-400 flex-shrink-0" />}>{request.carrier || 'N/A'}</InfoItem>
            <InfoItem label="Vessel Name" icon={<Ship size={16} className="text-slate-400 flex-shrink-0 opacity-50" />}>{request.vesselName || 'N/A'}</InfoItem>
            <InfoItem label="BL / AWB" icon={<FileText size={16} className="text-slate-400 flex-shrink-0" />}>
              <div className="flex items-center justify-between w-full">
                <span>{request.blAwb || 'N/A'}</span>
                {request.blAwb && (
                  <a 
                    href={`https://www.searates.com/container/tracking?number=${request.blAwb}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                    title="Track on SeaRates"
                  >
                    <ExternalLink size={10} /> Track
                  </a>
                )}
              </div>
            </InfoItem>
            <InfoItem label="Container #" icon={<Container size={16} className="text-slate-400 flex-shrink-0" />}>
              <div className="flex items-center justify-between w-full">
                <span>{request.containerNumber || 'N/A'}</span>
                {request.containerNumber && (
                  <a 
                    href={`https://www.searates.com/container/tracking?number=${request.containerNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                    title="Track on SeaRates"
                  >
                    <ExternalLink size={10} /> Track
                  </a>
                )}
              </div>
            </InfoItem>
            <InfoItem label="Invoice #" icon={<FileText size={16} className="text-slate-400 flex-shrink-0" />}>{request.invoiceNumber || 'N/A'}</InfoItem>
            <InfoItem label="Tax Invoice #" icon={<Hash size={16} className="text-slate-400 flex-shrink-0" />}>{request.taxInvoiceNumber || 'N/A'}</InfoItem>
            
            <div className="flex flex-col gap-1 md:col-span-3 mt-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                <Box size={16} className="text-slate-400" /> Palletization Dimensions
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(request.palletDimensions && request.palletDimensions.length > 0) ? (
                  request.palletDimensions.map((dim, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm font-semibold text-slate-700 bg-slate-50/50 px-3 py-2 rounded-md border border-slate-100">
                      <span className="text-slate-400 text-xs w-5">{idx + 1}.</span>
                      <span>{dim || 'N/A'}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-700 bg-slate-50/50 px-3 py-2 rounded-md border border-slate-100">
                    <span>N/A</span>
                  </div>
                )}
              </div>
            </div>
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

      {isPalletModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Box size={18} className="text-indigo-500" />
                Manage Pallet Dimensions
              </h3>
              <button 
                onClick={() => setIsPalletModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3 bg-slate-50/50">
              {(editForm.palletDimensions || []).map((dim, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 text-center text-xs font-bold text-slate-400">{idx + 1}.</div>
                  <input 
                    type="text" 
                    placeholder="L x H x W" 
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                    value={dim} 
                    onChange={e => {
                      const newDims = [...(editForm.palletDimensions || [])];
                      newDims[idx] = e.target.value;
                      setEditForm({...editForm, palletDimensions: newDims});
                    }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      const newDims = (editForm.palletDimensions || []).filter((_, i) => i !== idx);
                      setEditForm({...editForm, palletDimensions: newDims});
                    }}
                    className="text-red-500 hover:text-red-700 p-2 bg-white hover:bg-red-50 rounded-md border border-slate-200 hover:border-red-200 transition-colors shadow-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              
              {(editForm.palletDimensions || []).length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500 border-2 border-dashed border-slate-200 rounded-lg bg-white">
                  No pallets added yet. Click below to add one.
                </div>
              )}
              
              <button 
                type="button" 
                onClick={() => {
                  setEditForm({...editForm, palletDimensions: [...(editForm.palletDimensions || []), '']});
                }}
                className="w-full mt-2 text-sm text-indigo-600 font-medium flex items-center justify-center gap-2 hover:text-indigo-800 py-2.5 border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-100 rounded-md transition-colors"
              >
                <Plus size={16} /> Add Pallet
              </button>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
              <button 
                onClick={() => setIsPalletModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShipmentLogistics;
