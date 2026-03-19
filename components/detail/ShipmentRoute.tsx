
import React, { useState, useEffect, useMemo } from 'react';
import { FreightRequest } from '../../types';
import { MapPin, Info, Copy } from 'lucide-react';
import { destinationService, Destination } from '../../services/destinationService';
import SearchableSelect from '../SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { getDaysRemaining } from '../../services/freightHelpers';

interface ShipmentRouteProps {
  request: FreightRequest;
  editForm: FreightRequest;
  isEditing: boolean;
  setEditForm: (form: FreightRequest) => void;
}

const ShipmentRoute: React.FC<ShipmentRouteProps> = ({ request, editForm, isEditing, setEditForm }) => {
  const { success } = useToast();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing && destinations.length === 0) {
      setLoading(true);
      destinationService.getAll().then(data => {
        setDestinations(data);
        setLoading(false);
      });
    }
  }, [isEditing]);

  const destOptions = useMemo(() => {
    const map = new Map<string, any>();
    destinations.forEach(d => {
      const upperCode = d.code.toUpperCase().trim();
      if (!map.has(upperCode)) {
        map.set(upperCode, { label: d.description || upperCode, value: upperCode, subLabel: upperCode, original: d });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [destinations]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(request.id);
    success("Log ID copied to clipboard");
  };

  return (
    <>
      <div className="flex items-center gap-3">
         <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <span className="text-indigo-600 mr-2">{request.shippingMethod || 'Freight'}</span> 
            Shipment {request.id}
         </h1>
         
         <button 
            onClick={handleCopyId}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors pdf-hidden"
            title="Copy Log ID"
         >
            <Copy size={18} />
         </button>

         <div className="group relative inline-block pdf-hidden">
            <Info size={18} className="text-slate-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
              The Log Number is a permanent identifier generated at creation and does not change, even if route details are edited.
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
         </div>
      </div>
      
      <div className="mt-6 flex flex-col gap-6 mb-10 bg-slate-50 p-6 rounded-lg border border-slate-100 relative">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Origin</p>
              {isEditing ? (
                  <div className="-mt-1">
                    <SearchableSelect
                      label=""
                      value={editForm.originCode ? `${editForm.originCode} - ${editForm.origin}` : editForm.origin}
                      selectedValue={editForm.originCode}
                      options={destOptions}
                      onChange={(val, opt) => setEditForm({ ...editForm, origin: opt.label, originCode: val })}
                      placeholder="Select Origin..."
                      searchPlaceholder="Search ports..."
                      loading={loading}
                    />
                  </div>
              ) : (
                  <div className="flex items-center gap-2 text-lg font-medium text-slate-800"><MapPin size={20} className="text-indigo-500 flex-shrink-0" />{(request.originCode || request.origin || '').toUpperCase()}</div>
              )}
            </div>
            
            <div className="mt-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">ETD (Departure)</p>
              <div className={`text-sm ${isEditing ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>
                <span>
                  {isEditing ? (editForm.etd || 'N/A') : (request.etd ? new Date(request.etd).toLocaleDateString() : 'N/A')}
                  {!isEditing && request.etd && <span className="ml-1 text-xs text-slate-400 font-normal">{getDaysRemaining(request.etd)}</span>}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-1 flex-col items-center justify-center opacity-40">
            <div className="w-full h-0.5 bg-slate-400 relative"><div className="absolute -right-1 -top-1 w-2 h-2 border-r-2 border-t-2 border-slate-400 rotate-45"></div></div>
          </div>

          <div className="flex-1">
            <div className="md:text-right">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Destination</p>
              {isEditing ? (
                  <div className="-mt-1">
                    <SearchableSelect
                      label=""
                      value={editForm.destCode ? `${editForm.destCode} - ${editForm.destination}` : editForm.destination}
                      selectedValue={editForm.destCode}
                      options={destOptions}
                      onChange={(val, opt) => setEditForm({ ...editForm, destination: opt.label, destCode: val })}
                      placeholder="Select Destination..."
                      searchPlaceholder="Search ports..."
                      loading={loading}
                    />
                  </div>
              ) : (
                  <div className="flex items-center gap-2 text-lg font-medium text-slate-800 md:justify-end"><MapPin size={20} className="text-pink-500 flex-shrink-0" />{(request.destCode || request.destination || '').toUpperCase()}</div>
              )}
            </div>

            <div className="mt-4 md:text-right">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">ETA (Arrival)</p>
              <div className={`text-sm flex flex-col md:items-end ${isEditing ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>
                <span>
                  {isEditing ? (editForm.eta || 'N/A') : (request.eta ? new Date(request.eta).toLocaleDateString() : 'N/A')}
                  {!isEditing && request.eta && <span className="ml-1 text-xs text-slate-400 font-normal">{getDaysRemaining(request.eta)}</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShipmentRoute;
