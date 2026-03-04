
import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, CheckCircle, Loader2 } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
  subLabel?: string;
  [key: string]: any; // Allow extra properties for callbacks
}

interface SearchableSelectProps {
  label: string;
  value: string; // The display value (e.g., 'SHA - Shanghai' or just 'Maersk')
  selectedValue?: string; // The internal value key (e.g., 'SHA') for checkmark comparison
  options: SelectOption[];
  onChange: (value: string, option: SelectOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  selectedValue,
  options,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  loading = false,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (option: SelectOption) => {
    onChange(option.value, option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const displayValue = value || placeholder;
  const isValueSelected = !!value;

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 border rounded-lg flex items-center justify-between cursor-pointer transition-all bg-white
          ${disabled || loading ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-slate-400'}
          ${isOpen ? 'ring-2 ring-indigo-500 border-transparent' : 'border-slate-300'}
        `}
      >
        <span className={`text-sm truncate ${!isValueSelected ? 'text-slate-400' : 'text-slate-900 font-semibold'}`}>
          {loading ? 'Loading...' : displayValue}
        </span>
        {loading ? (
          <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={14} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-fade-in-up origin-top">
          <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 sticky top-0">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              autoFocus
              type="text"
              className="w-full bg-transparent outline-none text-sm placeholder:text-slate-400 font-medium"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedValue ? selectedValue === opt.value : value === opt.label;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between font-medium
                      ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}
                    `}
                  >
                    <div className="truncate pr-2">
                      {opt.subLabel && (
                        <span className="font-mono bg-slate-100 px-1 rounded mr-2 text-xs text-slate-600">{opt.subLabel}</span>
                      )}
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <CheckCircle size={14} className="text-indigo-500 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-slate-400 text-xs italic">
                No results found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
