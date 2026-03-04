
import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { DollarSign } from 'lucide-react';
import { RequestFormValues } from '../../services/validationSchemas';

interface FinancialSectionProps {
  register: UseFormRegister<RequestFormValues>;
  errors: FieldErrors<RequestFormValues>;
}

const FinancialSection: React.FC<FinancialSectionProps> = ({ register, errors }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
            <DollarSign size={16} className="text-indigo-500" /> Financials & Details
        </h3>
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Estimated Cost (USD) <span className="text-red-500">*</span></label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input type="number" {...register('price', { valueAsNumber: true })} className={`w-full pl-8 pr-4 py-2 border rounded-lg outline-none font-bold text-slate-800 ${errors.price ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'}`} placeholder="0.00" />
            </div>
            {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
        </div>
        
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Inventory Value (USD)</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input type="number" {...register('inventoryValue', { valueAsNumber: true })} className={`w-full pl-8 pr-4 py-2 border rounded-lg outline-none font-bold text-slate-800 ${errors.inventoryValue ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'}`} placeholder="0.00" />
            </div>
            {errors.inventoryValue && <p className="text-xs text-red-500 mt-1">{errors.inventoryValue.message}</p>}
        </div>
    </div>
  );
};

export default FinancialSection;
