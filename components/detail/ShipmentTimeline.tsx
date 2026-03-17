
import React, { useMemo } from 'react';
import { FreightRequest } from '../../types';
import { Plane, Ship, Train, Truck, Clock, X } from 'lucide-react';
import { getDaysRemaining } from '../../services/freightHelpers';

interface ShipmentTimelineProps {
  request: FreightRequest;
  editForm: FreightRequest;
  isEditing: boolean;
  setEditForm: (form: FreightRequest) => void;
}

const ShipmentTimeline: React.FC<ShipmentTimelineProps> = ({ request, editForm, isEditing, setEditForm }) => {
  const progressPercentage = useMemo(() => {
    // Priority: Actual > Estimated
    const startDateStr = request.atd || request.etd;
    const endDateStr = request.ata || request.eta;

    if (!startDateStr || !endDateStr) return 0;

    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();

    if (isNaN(start) || isNaN(end) || start >= end) return 0;
    
    // Calculate percentage
    const pct = ((now - start) / (end - start)) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }, [request.etd, request.eta, request.atd, request.ata]);

  const TransportIcon = useMemo(() => {
    const method = (request.shippingMethod || '').toLowerCase();
    if (method.includes('air')) return Plane;
    if (method.includes('rail') || method.includes('train')) return Train;
    if (method.includes('road') || method.includes('truck')) return Truck;
    return Ship;
  }, [request.shippingMethod]);

  const DateInput: React.FC<{ label: string; value: string | undefined; onChange: (val: string) => void }> = ({ label, value, onChange }) => (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 group">
      <div className="flex justify-between items-start mb-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">{label} <Clock size={10} /></div>
          {isEditing && value && (
              <button 
                onClick={() => onChange('')} 
                className="text-slate-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 transition-colors" 
                title="Clear Date"
              >
                  <X size={12} />
              </button>
          )}
      </div>
      {isEditing ? (
        <input type="date" className="w-full text-sm bg-white border border-slate-200 rounded px-1 py-1 font-bold" value={value || ''} onChange={e => onChange(e.target.value)} />
      ) : (
        <div className="text-sm font-semibold text-slate-700">
          {value ? new Date(value).toLocaleDateString() : '-'}
          {value && <span className="ml-1 text-xs text-slate-400 font-normal">{getDaysRemaining(value)}</span>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 border-b border-slate-100 pb-2">Movement Timeline</h3>
      <div className="mb-8 px-4 mt-8 pdf-hidden">
        <div className="relative h-2 bg-slate-100 rounded-full w-full">
          <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${progressPercentage >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progressPercentage}%` }}></div>
          <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 z-10 flex flex-col items-center group" style={{ left: `${progressPercentage}%`, transform: 'translate(-50%, -50%)' }}>
            <div className={`p-2 rounded-full shadow-md border-2 border-white ${progressPercentage >= 100 ? 'bg-green-600' : 'bg-indigo-600'} text-white`}><TransportIcon size={16} /></div>
            <div className="absolute top-full mt-1.5 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">{Math.round(progressPercentage)}%</div>
          </div>
        </div>
        <div className="flex justify-between mt-12 text-xs font-medium text-slate-500">
          <div className="text-left">
            <div className="uppercase tracking-wider font-bold mb-0.5 text-indigo-700">Origin / {request.atd ? 'ATD' : 'ETD'}</div>
            <div className="font-mono">
              {(request.atd || request.etd) ? new Date(request.atd || request.etd!).toLocaleDateString() : 'N/A'}
              {(request.atd || request.etd) && <span className="ml-1 text-xs text-slate-400 font-sans font-normal">{getDaysRemaining(request.atd || request.etd)}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-wider font-bold mb-0.5 text-pink-700">Dest / {request.ata ? 'ATA' : 'ETA'}</div>
            <div className="font-mono">
              {(request.ata || request.eta) ? new Date(request.ata || request.eta!).toLocaleDateString() : 'N/A'}
              {(request.ata || request.eta) && <span className="ml-1 text-xs text-slate-400 font-sans font-normal">{getDaysRemaining(request.ata || request.eta)}</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <DateInput label="ETD" value={isEditing ? editForm.etd : request.etd} onChange={val => setEditForm({...editForm, etd: val})} />
        <DateInput label="ATD" value={isEditing ? editForm.atd : request.atd} onChange={val => setEditForm({...editForm, atd: val})} />
        <DateInput label="ETA" value={isEditing ? editForm.eta : request.eta} onChange={val => setEditForm({...editForm, eta: val})} />
        <DateInput label="ATA" value={isEditing ? editForm.ata : request.ata} onChange={val => setEditForm({...editForm, ata: val})} />
        <DateInput label="Delivery Date" value={isEditing ? editForm.deliveryDate : request.deliveryDate} onChange={val => setEditForm({...editForm, deliveryDate: val})} />
      </div>
    </>
  );
};

export default ShipmentTimeline;
