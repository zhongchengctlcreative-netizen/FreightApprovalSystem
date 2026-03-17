import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { Region, COURIER_REGIONS, COURIER_FIXED_RATES, COURIER_PER_KG_RATES } from '../services/courierRates';

interface RegionRateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  initialFixedRates: Record<string, Record<Region, number>>;
  initialRangeRates: typeof COURIER_PER_KG_RATES;
  onSave: (rates: any[]) => Promise<void>;
}

const RegionRateManager: React.FC<RegionRateManagerProps> = ({ 
  isOpen, 
  onClose, 
  initialFixedRates, 
  initialRangeRates, 
  onSave 
}) => {
  const [fixedRates, setFixedRates] = useState(initialFixedRates);
  const [rangeRates, setRangeRates] = useState(initialRangeRates);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFixedRates(JSON.parse(JSON.stringify(initialFixedRates)));
      setRangeRates(JSON.parse(JSON.stringify(initialRangeRates)));
      setHasChanges(false);
    }
  }, [isOpen, initialFixedRates, initialRangeRates]);

  if (!isOpen) return null;

  const handleFixedRateChange = (weight: string, region: Region, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setFixedRates(prev => ({
      ...prev,
      [weight]: {
        ...prev[weight],
        [region]: numValue
      }
    }));
    setHasChanges(true);
  };

  const handleRangeRateChange = (index: number, region: Region, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setRangeRates(prev => {
      const newRates = [...prev];
      newRates[index] = {
        ...newRates[index],
        rates: {
          ...newRates[index].rates,
          [region]: numValue
        }
      };
      return newRates;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rowsToSave: any[] = [];

      // Convert Fixed Rates
      Object.entries(fixedRates).forEach(([weight, rates]) => {
        COURIER_REGIONS.forEach(region => {
          rowsToSave.push({
            destination: `Region:${region}:${weight}`,
            shipping_mode: 'CourierFixed',
            rate_per_kg: rates[region]
          });
        });
      });

      // Convert Range Rates
      rangeRates.forEach(range => {
        COURIER_REGIONS.forEach(region => {
          rowsToSave.push({
            destination: `Region:${region}:${range.min}-${range.max}`,
            shipping_mode: 'CourierPerKg',
            rate_per_kg: range.rates[region]
          });
        });
      });

      await onSave(rowsToSave);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Failed to save rates:', error);
      alert('Failed to save rates. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate weight rows for fixed rates (0.5 to 30)
  const weightRows = [];
  for (let w = 0.5; w <= 30; w += 0.5) {
    weightRows.push(w.toString());
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              Region Rate Management
            </h3>
            <p className="text-sm text-slate-500">Manage courier rates for regions D, E, 9, and F</p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                <AlertCircle size={12} /> Unsaved Changes
              </span>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border-b border-r border-slate-200 font-bold text-slate-700 w-32 bg-slate-50">Weight (kg)</th>
                  {COURIER_REGIONS.map(region => (
                    <th key={region} className="px-4 py-3 border-b border-slate-200 font-bold text-slate-700 text-center min-w-[100px]">
                      Region {region}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Fixed Rates */}
                {weightRows.map(weight => (
                  <tr key={weight} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 border-r border-slate-100 font-mono font-medium text-slate-600 bg-slate-50/30">
                      {weight}
                    </td>
                    {COURIER_REGIONS.map(region => (
                      <td key={region} className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-2 py-1.5 text-center border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded transition-all outline-none bg-transparent focus:bg-white"
                          value={fixedRates[weight]?.[region] || ''}
                          onChange={(e) => handleFixedRateChange(weight, region, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Spacer */}
                <tr className="bg-slate-100">
                  <td colSpan={5} className="py-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-y border-slate-200">
                    Per KG Rates ({'>'} 30kg)
                  </td>
                </tr>

                {/* Range Rates */}
                {rangeRates.map((range, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 bg-indigo-50/10">
                    <td className="px-4 py-2 border-r border-slate-100 font-mono font-medium text-slate-600 bg-slate-50/30">
                      {range.min} - {range.max >= 99999 ? 'Max' : range.max}
                    </td>
                    {COURIER_REGIONS.map(region => (
                      <td key={region} className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-2 py-1.5 text-center border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded transition-all outline-none bg-transparent focus:bg-white font-medium text-indigo-700"
                          value={range.rates[region] || ''}
                          onChange={(e) => handleRangeRateChange(idx, region, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-sm transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all flex items-center gap-2 ${(!hasChanges || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegionRateManager;
