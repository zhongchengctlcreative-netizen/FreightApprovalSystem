
import React from 'react';
import { Controller, Control, UseFormRegister, FieldErrors, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { MapPin, Calendar } from 'lucide-react';
import SearchableSelect, { SelectOption } from '../SearchableSelect';
import { RequestFormValues } from '../../services/validationSchemas';
import { getDaysRemaining } from '../../services/freightHelpers';

interface RouteSectionProps {
  control: Control<RequestFormValues>;
  register: UseFormRegister<RequestFormValues>;
  errors: FieldErrors<RequestFormValues>;
  watch: UseFormWatch<RequestFormValues>;
  setValue: UseFormSetValue<RequestFormValues>;
  originOptions: SelectOption[];
  forwarderOptions: SelectOption[];
  loadingData: boolean;
  setCcList: React.Dispatch<React.SetStateAction<string[]>>;
  ccList: string[];
}

const RouteSection: React.FC<RouteSectionProps> = ({ 
  control, register, errors, watch, setValue, originOptions, forwarderOptions, loadingData, setCcList, ccList 
}) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
        <MapPin size={16} className="text-indigo-500" /> Route & Schedule
      </h3>
      <div className="space-y-4">
        <Controller
          control={control}
          name="originCode"
          render={({ field }) => (
            <SearchableSelect
              label="Origin"
              required
              value={field.value ? `${field.value} - ${watch('originName')}` : ''}
              selectedValue={field.value}
              options={originOptions}
              onChange={(val, opt) => {
                field.onChange(val);
                setValue('originName', opt.label);
              }}
              placeholder="Select Origin..."
              searchPlaceholder="Search Origin..."
              loading={loadingData}
            />
          )}
        />

        <Controller
          control={control}
          name="destCode"
          render={({ field }) => (
            <SearchableSelect
              label="Destination"
              required
              value={field.value ? `${field.value} - ${watch('destName')}` : ''}
              selectedValue={field.value}
              options={originOptions}
              onChange={(val, opt) => {
                field.onChange(val);
                setValue('destName', opt.label);
                if (opt.original && opt.original.ccEmails) {
                    const newEmails = opt.original.ccEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
                    const merged = Array.from(new Set([...ccList, ...newEmails]));
                    setCcList(merged);
                }
              }}
              placeholder="Select Destination..."
              searchPlaceholder="Search Destination..."
              loading={loadingData}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              ETD (Departure) <span className="text-red-500">*</span>
              {watch('etd') && <span className="text-xs font-normal text-slate-400 ml-2">{getDaysRemaining(watch('etd'))}</span>}
            </label>
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="date" {...register('etd')} className={`w-full pl-10 pr-4 py-2 border rounded-lg outline-none font-medium ${errors.etd ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'}`} />
            </div>
            {errors.etd && <p className="text-xs text-red-500 mt-1">{errors.etd.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              ETA (Arrival)
              {watch('eta') && <span className="text-xs font-normal text-slate-400 ml-2">{getDaysRemaining(watch('eta'))}</span>}
            </label>
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="date" {...register('eta')} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
            </div>
          </div>
        </div>
        
        <div className="pt-2">
            <Controller
                control={control}
                name="forwarder"
                render={({ field }) => (
                <SearchableSelect
                    label="Forwarder"
                    required
                    value={field.value}
                    selectedValue={field.value}
                    options={forwarderOptions}
                    onChange={(val) => field.onChange(val)}
                    placeholder="Select Forwarder"
                    searchPlaceholder="Search forwarders..."
                    loading={loadingData}
                />
                )}
            />
        </div>
      </div>
    </div>
  );
};

export default RouteSection;
