
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FreightRequest } from '../../types';
import { Truck, DollarSign, Package, Box, Layers, Navigation, Container, FileText, Calculator, Edit2, X, Mail, Info, Scale, Ship, Plane, Train, User, RefreshCw, Clock, Globe } from 'lucide-react';
import { forwarderService, Forwarder } from '../../services/carrierService';
import SearchableSelect from '../SearchableSelect';

interface ShipmentSpecsProps {
  request: FreightRequest;
  editForm: FreightRequest;
  isEditing: boolean;
  setEditForm: (form: FreightRequest) => void;
}

const SpecItem: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }> = ({ icon, label, children, className = "" }) => (
  <div className={`flex items-start gap-3 ${className}`}>
    <div className="p-2.5 bg-slate-50 rounded-lg text-slate-500 mt-0.5 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      {children}
    </div>
  </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="text-xs font-bold text-indigo-900/50 uppercase tracking-widest mb-3 mt-1 border-b border-slate-100 pb-1 w-full">{title}</h4>
);

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'CNY', label: 'Chinese Yuan (¥)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'AUD', label: 'Australian Dollar ($)' },
  { code: 'CAD', label: 'Canadian Dollar ($)' },
  { code: 'SGD', label: 'Singapore Dollar ($)' },
  { code: 'HKD', label: 'Hong Kong Dollar ($)' },
  { code: 'KRW', label: 'South Korean Won (₩)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'TWD', label: 'Taiwan Dollar ($)' },
  { code: 'VND', label: 'Vietnamese Dong (₫)' },
  { code: 'THB', label: 'Thai Baht (฿)' }
];

type CurrencyGroup = 'ORIGIN' | 'DEST' | 'CH_ORIGIN';

const ShipmentSpecs: React.FC<ShipmentSpecsProps> = ({ request, editForm, isEditing, setEditForm }) => {
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [forwarders, setForwarders] = useState<Forwarder[]>([]);
  const [isFetchingRate, setIsFetchingRate] = useState<string | null>(null);

  useEffect(() => {
    const loadForwarders = async () => {
      try {
        const list = await forwarderService.getAllForwarders();
        setForwarders(list);
      } catch (e) {
        console.error("Failed to load forwarders", e);
      }
    };
    loadForwarders();
  }, []);

  const fetchLiveRate = async (targetCurrency: string, type: CurrencyGroup) => {
    if (targetCurrency === 'USD') {
        if (type === 'ORIGIN') setEditForm({ ...editForm, inputCurrency: 'USD', inputExchangeRate: 1 });
        else if (type === 'DEST') setEditForm({ ...editForm, destCurrency: 'USD', destExchangeRate: 1 });
        else if (type === 'CH_ORIGIN') setEditForm({ ...editForm, chOriginCurrency: 'USD', chOriginExchangeRate: 1 });
        return;
    }
    
    setIsFetchingRate(type);
    try {
        // Fetch base USD rates using the stable Open Access v6 endpoint
        const res = await fetch(`https://open.er-api.com/v6/latest/USD`);
        const data = await res.json();
        const ratePerUsd = data.rates[targetCurrency];
        
        if (ratePerUsd) {
            // We need the inverse: How many USD is 1 Foreign Unit?
            const inverseRate = 1 / ratePerUsd;
            if (type === 'ORIGIN') {
                setEditForm({ 
                    ...editForm, 
                    inputCurrency: targetCurrency, 
                    inputExchangeRate: inverseRate,
                    exchangeRateDate: new Date().toISOString()
                });
            } else if (type === 'DEST') {
                setEditForm({ 
                    ...editForm, 
                    destCurrency: targetCurrency, 
                    destExchangeRate: inverseRate
                });
            } else if (type === 'CH_ORIGIN') {
                setEditForm({
                    ...editForm,
                    chOriginCurrency: targetCurrency,
                    chOriginExchangeRate: inverseRate
                });
            }
        }
    } catch (e) {
        console.error("Failed to fetch rate", e);
        alert("Could not fetch live rate. Please enter manually.");
    } finally {
        setIsFetchingRate(null);
    }
  };

  const handleCurrencyChange = (newCurrency: string, type: CurrencyGroup) => {
      if (newCurrency === 'USD') {
          if (type === 'ORIGIN') setEditForm({ ...editForm, inputCurrency: 'USD', inputExchangeRate: 1 });
          else if (type === 'DEST') setEditForm({ ...editForm, destCurrency: 'USD', destExchangeRate: 1 });
          else if (type === 'CH_ORIGIN') setEditForm({ ...editForm, chOriginCurrency: 'USD', chOriginExchangeRate: 1 });
      } else {
          // Temporarily set currency, fetch rate will update rate
          if (type === 'ORIGIN') setEditForm({ ...editForm, inputCurrency: newCurrency });
          else if (type === 'DEST') setEditForm({ ...editForm, destCurrency: newCurrency });
          else if (type === 'CH_ORIGIN') setEditForm({ ...editForm, chOriginCurrency: newCurrency });
          fetchLiveRate(newCurrency, type);
      }
  };

  const forwarderOptions = useMemo(() => 
    forwarders.map(c => ({
      label: c.name,
      value: c.name,
      subLabel: c.status === 'ACTIVE' ? undefined : 'Inactive'
    })), [forwarders]
  );

  const handleCostUpdate = () => {
    const origin = Number(editForm.originCost) || 0;
    const chOrigin = Number(editForm.chOrigin) || 0;
    const freight = Number(editForm.freightCharge) || 0;
    const dest = Number(editForm.destinationCost) || 0;
    
    // Note: Duty is intentionally excluded from these totals as per UI label
    const fob = origin + dest + freight;
    const total = chOrigin + fob;
    
    setEditForm({ ...editForm, fobCost: fob, totalFreightCost: total });
    setIsCostModalOpen(false);
  };

  const safeNumChange = (val: string, field: keyof FreightRequest) => {
    const num = val === '' ? null : Number(val);
    setEditForm({ ...editForm, [field]: num } as any);
  };

  const handleForeignInput = (val: string, field: keyof FreightRequest, group: CurrencyGroup = 'ORIGIN') => {
      if (val === '') {
          // Clear both USD field and input value
          const updatedInputValues = { ...editForm.inputValues };
          delete updatedInputValues[field as string];
          
          setEditForm({ 
              ...editForm, 
              [field]: null,
              inputValues: updatedInputValues
          } as any);
          return;
      }
      
      const foreignAmount = parseFloat(val);
      let rate = 1;
      if (group === 'ORIGIN') rate = editForm.inputExchangeRate || 1;
      else if (group === 'DEST') rate = editForm.destExchangeRate || 1;
      else if (group === 'CH_ORIGIN') rate = editForm.chOriginExchangeRate || 1;
      
      if (!isNaN(foreignAmount)) {
          // 1. Store Original Input
          const updatedInputValues = { 
              ...editForm.inputValues,
              [field as string]: foreignAmount 
          };

          // 2. Convert to USD
          const usdAmount = foreignAmount * rate;
          
          setEditForm({ 
              ...editForm, 
              [field]: usdAmount,
              inputValues: updatedInputValues
          } as any);
      }
  };

  // Display helper for the input field value
  const getForeignValue = (usdValue: number | undefined | null, field: string, group: CurrencyGroup = 'ORIGIN') => {
      if (usdValue === null || usdValue === undefined) return '';
      let curr = 'USD';
      let rate = 1;

      if (group === 'ORIGIN') {
          curr = editForm.inputCurrency || 'USD';
          rate = editForm.inputExchangeRate || 1;
      } else if (group === 'DEST') {
          curr = editForm.destCurrency || 'USD';
          rate = editForm.destExchangeRate || 1;
      } else if (group === 'CH_ORIGIN') {
          curr = editForm.chOriginCurrency || 'USD';
          rate = editForm.chOriginExchangeRate || 1;
      }
      
      // If we have a stored input value for this field and currency is not USD, prefer that
      if (curr !== 'USD' && field && editForm.inputValues && editForm.inputValues[field] !== undefined) {
          return editForm.inputValues[field];
      }

      if (curr === 'USD') return usdValue;
      
      // Fallback: Back-calculate if no stored input
      const converted = usdValue / rate;
      // Return fixed 2 decimals for cleaner input display without floating point errors
      return Number(converted.toFixed(2));
  };

  // Formatter for Display Text (Badges, Labels) - Enforces 2 decimals
  const formatMoney = (val: number | undefined | null) => {
      return (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleMethodChange = (val: string) => {
    const isAir = val === 'Air';
    setEditForm({ 
        ...editForm, 
        shippingMethod: val,
        containerSize: isAir ? '' : editForm.containerSize,
        meansOfConveyance: isAir ? '' : editForm.meansOfConveyance
    });
  };

  const isAir = isEditing ? editForm.shippingMethod === 'Air' : request.shippingMethod === 'Air';

  const currentFob = (editForm.originCost || 0) + (editForm.destinationCost || 0) + (editForm.freightCharge || 0);
  const currentTotal = (editForm.chOrigin || 0) + currentFob;

  // Render Helper for Currency Block
  const CurrencyBlock = ({ type, title, currency, rate, onCurrencyChange, onRateChange }: any) => (
      <div className="flex gap-2 items-center mb-2 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
        <div className="flex-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{title} Currency</label>
            <select 
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500"
                value={currency || 'USD'}
                onChange={(e) => onCurrencyChange(e.target.value, type)}
            >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
        </div>
        
        {currency && currency !== 'USD' && (
            <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>Rate (to USD)</span>
                    <button onClick={() => fetchLiveRate(currency, type)} className="text-indigo-600 hover:text-indigo-800" title="Fetch live rate">
                        <RefreshCw size={10} className={isFetchingRate === type ? 'animate-spin' : ''}/>
                    </button>
                </label>
                <input 
                    type="number" 
                    step="0.0001"
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-indigo-500"
                    value={rate || 1}
                    onChange={(e) => onRateChange(parseFloat(e.target.value), type)}
                />
            </div>
        )}
     </div>
  );

  return (
    <>
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 border-b border-slate-100 pb-2">Shipment Specifications</h3>
      
      {/* 1. Transport Section */}
      <div className="mb-8">
        <SectionHeader title="Transport Mode" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SpecItem icon={<Navigation size={20} />} label="Shipping Method">
                {isEditing ? (
                    <div className="grid grid-cols-4 gap-2">
                        {['Sea', 'Air', 'Rail', 'Road'].map(m => {
                            const Icon = m === 'Sea' ? Ship : m === 'Air' ? Plane : m === 'Rail' ? Train : Truck;
                            const isSelected = editForm.shippingMethod === m;
                            return (
                                <button
                                    key={m}
                                    onClick={() => handleMethodChange(m)}
                                    className={`flex flex-col items-center justify-center p-1.5 rounded border transition-all ${isSelected ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <Icon size={16} className={`mb-0.5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className="text-[10px] font-bold">{m}</span>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-base font-semibold text-slate-900">{request.shippingMethod || 'N/A'}</p>
                )}
            </SpecItem>

            <SpecItem icon={<Truck size={20} />} label="Forwarder">
                {isEditing ? (
                    <div className="-mt-1">
                        <SearchableSelect 
                            label="" 
                            value={editForm.forwarder} 
                            selectedValue={editForm.forwarder}
                            options={forwarderOptions}
                            onChange={(val) => setEditForm({...editForm, forwarder: val})}
                            placeholder="Select Forwarder"
                            searchPlaceholder="Search forwarders..."
                        />
                    </div>
                ) : (
                    <p className="text-base font-semibold text-slate-900">{request.forwarder}</p>
                )}
            </SpecItem>
        </div>
      </div>

      {/* 2. Container Section (Conditional) */}
      {!isAir && (
        <div className="mb-8">
            <SectionHeader title="Container Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SpecItem icon={<Container size={20} />} label="Container Size">
                    {isEditing ? (
                        <div className="flex gap-2">
                            {['20', '40', '40HC'].map(sz => (
                                <button
                                    key={sz}
                                    onClick={() => setEditForm({...editForm, containerSize: sz})}
                                    className={`px-3 py-1.5 rounded border text-xs font-bold transition-all ${editForm.containerSize === sz ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {sz}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-base font-semibold text-slate-900">{request.containerSize || 'N/A'}</p>
                    )}
                </SpecItem>
                <SpecItem icon={<Layers size={20} />} label="Means of Conveyance">
                    {isEditing ? (
                        <div className="flex gap-2">
                            {['FCL', 'LCL'].map(mc => (
                                <button
                                    key={mc}
                                    onClick={() => setEditForm({...editForm, meansOfConveyance: mc})}
                                    className={`px-3 py-1.5 rounded border text-xs font-bold transition-all ${editForm.meansOfConveyance === mc ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {mc}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-base font-semibold text-slate-900">{request.meansOfConveyance || 'N/A'}</p>
                    )}
                </SpecItem>
            </div>
        </div>
      )}

      {/* 3. Cargo Measurements (Renamed) */}
      <div className="mb-8">
        <SectionHeader title="Cargo Measurements" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SpecItem icon={<Scale size={20} />} label="Weight (KG)">{isEditing ? <input type="number" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" value={editForm.weight ?? ''} onChange={e => safeNumChange(e.target.value, 'weight')} /> : <p className="text-base font-semibold text-slate-900">{request.weight ? `${request.weight.toLocaleString()} KG` : 'N/A'}</p>}</SpecItem>
            <SpecItem icon={<Box size={20} />} label="Volume (M3)">{isEditing ? <input type="number" step="0.01" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" value={editForm.m3 ?? ''} onChange={e => safeNumChange(e.target.value, 'm3')} /> : <p className="text-base font-semibold text-slate-900">{request.m3 ? `${request.m3} m³` : 'N/A'}</p>}</SpecItem>
            <SpecItem icon={<Package size={20} />} label="Carton Count">{isEditing ? <input type="number" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" value={editForm.cartonCount ?? ''} onChange={e => safeNumChange(e.target.value, 'cartonCount')} /> : <p className="text-base font-semibold text-slate-900">{request.cartonCount || 0}</p>}</SpecItem>
        </div>
      </div>

      {/* 4. Financials */}
      <div className="mb-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Commercial Value */}
            <div>
               <SectionHeader title="Commercial Value" />
               <div className="space-y-4">
                  <SpecItem icon={<DollarSign size={20} />} label="Inventory Value (USD)">{isEditing ? <input type="number" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" value={editForm.inventoryValue ?? ''} onChange={e => safeNumChange(e.target.value, 'inventoryValue')} /> : <p className="text-base font-semibold text-slate-900">{request.inventoryValue ? `$${formatMoney(request.inventoryValue)}` : 'N/A'}</p>}</SpecItem>
                  <SpecItem icon={<FileText size={20} />} label="Invoice Value (USD)">{isEditing ? <input type="number" step="0.01" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" value={editForm.invoiceValue ?? ''} onChange={e => safeNumChange(e.target.value, 'invoiceValue')} /> : <p className="text-base font-semibold text-slate-900">{request.invoiceValue ? `$${formatMoney(request.invoiceValue)}` : 'N/A'}</p>}</SpecItem>
               </div>
            </div>
            
            {/* Freight Costs */}
            <div>
               <SectionHeader title="Freight Costs" />
               <div className="space-y-4">
                  <SpecItem icon={<DollarSign size={20} />} label="Est. Total Cost (USD)">{isEditing ? <input type="number" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" value={editForm.price ?? ''} onChange={e => safeNumChange(e.target.value, 'price')} /> : <p className="text-base font-semibold text-slate-900">${formatMoney(request.price)}</p>}</SpecItem>
                  <SpecItem icon={<Calculator size={20} />} label="Total Freight Cost (Actual)">
                    <div className="flex justify-between items-center mb-1"><p className="text-sm font-medium text-slate-500 sr-only">Value</p>{isEditing && (<button onClick={() => setIsCostModalOpen(true)} className="text-xs text-indigo-600 hover:underline font-bold ml-auto">Edit Breakdown</button>)}</div>
                    {isEditing ? (
                        <div onClick={() => setIsCostModalOpen(true)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md flex justify-between items-center cursor-pointer hover:border-indigo-400">
                            <span className="text-slate-900 font-semibold">{editForm.totalFreightCost ? `$${formatMoney(editForm.totalFreightCost)}` : '$0.00'}</span>
                            <Edit2 size={12} className="text-slate-400" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-semibold text-slate-900">{request.totalFreightCost ? `$${formatMoney(request.totalFreightCost)}` : 'N/A'}</p>
                            {(request.originCost || request.freightCharge) && (
                                <div className="group relative">
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded cursor-help font-bold tracking-tight border border-slate-200 uppercase">Breakdown</span>
                                    <div className="absolute left-0 bottom-full mb-2 w-56 bg-slate-800 text-white text-xs rounded p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl space-y-1">
                                        <div className="flex justify-between"><span>Origin:</span><span>${formatMoney(request.originCost)}</span></div>
                                        <div className="flex justify-between"><span>Freight:</span><span>${formatMoney(request.freightCharge)}</span></div>
                                        <div className="flex justify-between"><span>CH Origin:</span><span>${formatMoney(request.chOrigin)}</span></div>
                                        <div className="flex justify-between"><span>Dest:</span><span>${formatMoney(request.destinationCost)}</span></div>
                                        <div className="flex justify-between font-semibold border-t border-slate-600 pt-1"><span>FOB:</span><span>${formatMoney(request.fobCost)}</span></div>
                                        <div className="flex justify-between text-slate-400"><span>Duty (Excl):</span><span>${formatMoney(request.dutyCost)}</span></div>
                                    </div>
                                </div>
                            )}
                            {request.dutyCost && request.dutyCost > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                    (Duty: {request.dutyCurrency || 'USD'} {formatMoney(request.dutyCost)})
                                </span>
                            )}
                        </div>
                    )}
                  </SpecItem>
               </div>
            </div>
         </div>
      </div>

      {/* 5. Request Details (Revised) */}
      <div className="mb-2">
        <SectionHeader title="Request Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SpecItem icon={<User size={20} />} label="Requestor">
                {isEditing ? (
                    <input 
                        type="text" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md uppercase" 
                        value={editForm.requester} 
                        onChange={e => setEditForm({...editForm, requester: e.target.value.toUpperCase()})} 
                    />
                ) : (
                    <p className="text-base font-semibold text-slate-900">{request.requester}</p>
                )}
            </SpecItem>
            <SpecItem icon={<Mail size={20} />} label="CC Emails">
                {isEditing ? (
                    <input 
                        type="text" 
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md" 
                        value={editForm.ccEmails || ''} 
                        onChange={e => setEditForm({...editForm, ccEmails: e.target.value})} 
                        placeholder="email1@example.com, email2@example.com" 
                    />
                ) : (
                    <p className="text-base font-semibold text-slate-900 break-words">{request.ccEmails || 'None'}</p>
                )}
            </SpecItem>
        </div>
      </div>
      
      {isCostModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh] animate-fade-in-up">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Calculator size={18} className="text-indigo-600" /> Cost Breakdown</h3>
                  <button onClick={() => setIsCostModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                 
                 {/* Group 1: Origin & Freight */}
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Globe size={10} /> Origin & Freight</p>
                     
                     <CurrencyBlock 
                        type="ORIGIN"
                        title="Origin / Freight"
                        currency={editForm.inputCurrency}
                        rate={editForm.inputExchangeRate}
                        onCurrencyChange={handleCurrencyChange}
                        onRateChange={(val: number) => setEditForm({...editForm, inputExchangeRate: val})}
                     />

                     <div className="flex justify-between items-center relative group mt-2">
                        <label className="text-sm font-medium text-slate-600">Origin Cost</label>
                        <div className="flex items-center gap-2">
                            {(editForm.inputCurrency && editForm.inputCurrency !== 'USD') && (
                                <div className="text-[10px] font-mono text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-200/50">
                                    ≈ ${formatMoney(editForm.originCost)}
                                </div>
                            )}
                            <input 
                                type="number" 
                                className="w-32 px-2 py-1 border rounded text-right font-semibold focus:w-40 transition-all focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                                value={getForeignValue(editForm.originCost, 'originCost', 'ORIGIN')} 
                                onChange={e => handleForeignInput(e.target.value, 'originCost', 'ORIGIN')} 
                            />
                        </div>
                     </div>
                     
                     <div className="flex justify-between items-center relative group mt-2">
                        <label className="text-sm font-medium text-slate-600">Freight Charge</label>
                        <div className="flex items-center gap-2">
                            {(editForm.inputCurrency && editForm.inputCurrency !== 'USD') && (
                                <div className="text-[10px] font-mono text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-200/50">
                                    ≈ ${formatMoney(editForm.freightCharge)}
                                </div>
                            )}
                            <input 
                                type="number" 
                                className="w-32 px-2 py-1 border rounded text-right font-semibold focus:w-40 transition-all focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                                value={getForeignValue(editForm.freightCharge, 'freightCharge', 'ORIGIN')} 
                                onChange={e => handleForeignInput(e.target.value, 'freightCharge', 'ORIGIN')} 
                            />
                        </div>
                     </div>
                 </div>

                 {/* Group 2: CH Origin (New Independent Block) */}
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Globe size={10} /> Origin Handling (CH)</p>
                     
                     <CurrencyBlock 
                        type="CH_ORIGIN"
                        title="CH Origin"
                        currency={editForm.chOriginCurrency}
                        rate={editForm.chOriginExchangeRate}
                        onCurrencyChange={handleCurrencyChange}
                        onRateChange={(val: number) => setEditForm({...editForm, chOriginExchangeRate: val})}
                     />

                     <div className="flex justify-between items-center relative group mt-2">
                        <label className="text-sm font-medium text-slate-600">CH Origin Cost</label>
                        <div className="flex items-center gap-2">
                            {(editForm.chOriginCurrency && editForm.chOriginCurrency !== 'USD') && (
                                <div className="text-[10px] font-mono text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-200/50">
                                    ≈ ${formatMoney(editForm.chOrigin)}
                                </div>
                            )}
                            <input 
                                type="number" 
                                className="w-32 px-2 py-1 border rounded text-right font-semibold focus:w-40 transition-all focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                                value={getForeignValue(editForm.chOrigin, 'chOrigin', 'CH_ORIGIN')} 
                                onChange={e => handleForeignInput(e.target.value, 'chOrigin', 'CH_ORIGIN')} 
                            />
                        </div>
                     </div>
                 </div>

                 {/* Group 3: Destination */}
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Globe size={10} /> Destination</p>
                     
                     <CurrencyBlock 
                        type="DEST"
                        title="Destination"
                        currency={editForm.destCurrency}
                        rate={editForm.destExchangeRate}
                        onCurrencyChange={handleCurrencyChange}
                        onRateChange={(val: number) => setEditForm({...editForm, destExchangeRate: val})}
                     />

                     <div className="flex justify-between items-center relative group mt-2">
                        <label className="text-sm font-medium text-slate-600">Dest Cost</label>
                        <div className="flex items-center gap-2">
                            {(editForm.destCurrency && editForm.destCurrency !== 'USD') && (
                                <div className="text-[10px] font-mono text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-200/50">
                                    ≈ ${formatMoney(editForm.destinationCost)}
                                </div>
                            )}
                            <input 
                                type="number" 
                                className="w-32 px-2 py-1 border rounded text-right font-semibold focus:w-40 transition-all focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                                value={getForeignValue(editForm.destinationCost, 'destinationCost', 'DEST')} 
                                onChange={e => handleForeignInput(e.target.value, 'destinationCost', 'DEST')} 
                            />
                        </div>
                     </div>
                 </div>
                 
                 {/* Duty (Excluded from total) */}
                 <div className="flex justify-between items-center relative group p-2 border border-dashed border-slate-200 rounded-lg">
                    <label className="text-sm font-medium text-slate-400 flex items-center gap-1">Duty (Excluded) <Info size={12}/></label>
                    <div className="flex items-center gap-2">
                        <select
                            className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-1 py-0.5 rounded border border-slate-200/50 outline-none cursor-pointer"
                            value={editForm.dutyCurrency || 'USD'}
                            onChange={(e) => setEditForm({...editForm, dutyCurrency: e.target.value})}
                        >
                            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                        <input 
                            type="number" 
                            className="w-32 px-2 py-1 border rounded text-right text-slate-500 focus:w-40 transition-all focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" 
                            value={editForm.dutyCost ?? ''} 
                            onChange={e => safeNumChange(e.target.value, 'dutyCost')} 
                        />
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div><p className="text-xs text-slate-500 uppercase font-bold">Total Freight Cost</p><p className="text-[10px] text-slate-400">(CH Origin + FOB in USD)</p></div>
                    <p className="text-xl font-bold text-indigo-600">${formatMoney(currentTotal)}</p>
                 </div>

                 <button onClick={handleCostUpdate} className="w-full py-2.5 mt-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">Update Total</button>
              </div>
           </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ShipmentSpecs;
