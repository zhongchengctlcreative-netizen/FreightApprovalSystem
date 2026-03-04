import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Calculator, Package, Info, AlertCircle, Search, Plus, Trash2, Loader2, CheckCircle, Database, Settings, X, Save, Edit2, Globe } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface SkuData {
  partNo: string;
  description: string;
  l: number;
  w: number;
  h: number;
  qtyPerCtn: number;
  gwPerCtn: number;
}

interface ShipmentItem {
  id: string;
  sku: SkuData;
  qty: number;
}

interface FreightRate {
  id: string;
  destination: string;
  shipping_mode: string;
  rate_per_kg: number;
  updated_at: string;
}

const AirFreightCalculator: React.FC = () => {
  const [skuDatabase, setSkuDatabase] = useState<SkuData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rate Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [freightRates, setFreightRates] = useState<FreightRate[]>([]);
  const [editingRate, setEditingRate] = useState<Partial<FreightRate> | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch SKUs from Supabase on mount
  useEffect(() => {
    fetchSkus();
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const { data, error } = await supabase.from('freight_rates').select('*').order('destination', { ascending: true });
      if (error) throw error;
      if (data) setFreightRates(data);
    } catch (err: any) {
      console.error("Error fetching rates:", err);
    }
  };

  const handleSaveRate = async () => {
    if (!editingRate?.destination || !editingRate?.shipping_mode || editingRate.rate_per_kg === undefined) {
      setError("Please fill in all rate fields.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      const payload = {
        destination: editingRate.destination,
        shipping_mode: editingRate.shipping_mode,
        rate_per_kg: editingRate.rate_per_kg,
        updated_at: new Date().toISOString()
      };
      
      if (editingRate.id) {
        const { error: updateErr } = await supabase.from('freight_rates').update(payload).eq('id', editingRate.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('freight_rates').insert([payload]);
        if (insertErr) throw insertErr;
      }
      setEditingRate(null);
      await fetchRates();
      setSuccessMsg("Freight rate saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save rate.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rate?")) return;
    try {
      const { error } = await supabase.from('freight_rates').delete().eq('id', id);
      if (error) throw error;
      await fetchRates();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const fetchSkus = async () => {
    setIsLoading(true);
    try {
      let allData: any[] = [];
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from('sku_dimensions')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          page++;
          if (data.length < pageSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      
      if (allData.length > 0) {
        const formatted = allData.map(d => ({
          partNo: d.part_no,
          description: d.description,
          l: Number(d.length_cm) || 0,
          w: Number(d.width_cm) || 0,
          h: Number(d.height_cm) || 0,
          qtyPerCtn: Number(d.qty_per_ctn) || 1,
          gwPerCtn: Number(d.gw_per_ctn) || 0
        }));
        setSkuDatabase(formatted);
      }
    } catch (err: any) {
      console.error("Error fetching SKUs:", err);
      setError("Failed to load SKU database from Supabase.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (data.length < 2) {
          throw new Error("Excel file is empty or invalid format.");
        }

        let headerRowIdx = 0;
        let headers: string[] = [];
        let partNoIdx = -1, descIdx = -1, lIdx = -1, wIdx = -1, hIdx = -1, qtyPerCtnIdx = -1, gwPerCtnIdx = -1;

        // Scan the first 10 rows to find the header row
        for (let i = 0; i < Math.min(10, data.length); i++) {
          const row = data[i];
          if (!row) continue;
          
          const currentHeaders = row.map((h: any) => h ? String(h).trim().toLowerCase() : '');
          const findCol = (names: string[]) => currentHeaders.findIndex(h => h && typeof h === 'string' && names.some(n => h.includes(n.toLowerCase())));

          const pIdx = findCol(['part no']);
          const dIdx = findCol(['part description', 'description']);
          const lenIdx = findCol(['master carton l', 'length']);
          const widIdx = findCol(['master carton w', 'width']);
          const hgtIdx = findCol(['master carton h', 'height']);
          const qtyIdx = findCol(['qty per ctn', 'qty / ctn']);
          const gwIdx = findCol(['gw / ctn', 'gross weight']);

          // If we found the essential columns, we assume this is the header row
          if (pIdx !== -1 && lenIdx !== -1 && widIdx !== -1 && hgtIdx !== -1 && qtyIdx !== -1 && gwIdx !== -1) {
            headerRowIdx = i;
            headers = currentHeaders;
            partNoIdx = pIdx;
            descIdx = dIdx;
            lIdx = lenIdx;
            wIdx = widIdx;
            hIdx = hgtIdx;
            qtyPerCtnIdx = qtyIdx;
            gwPerCtnIdx = gwIdx;
            break;
          }
        }

        if (partNoIdx === -1 || lIdx === -1 || wIdx === -1 || hIdx === -1 || qtyPerCtnIdx === -1 || gwPerCtnIdx === -1) {
          throw new Error("Missing required columns in Excel file. Please ensure 'Part No', 'Master Carton L', 'Master Carton W', 'Master Carton H', 'Qty Per Ctn', and 'GW / Ctn' exist.");
        }

        const parsedData: any[] = [];
        const seenPartNos = new Set(); // Prevent duplicates in the same file

        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || !row[partNoIdx]) continue;
          
          const partNo = String(row[partNoIdx]).trim();
          if (seenPartNos.has(partNo)) continue;
          seenPartNos.add(partNo);

          parsedData.push({
            part_no: partNo,
            description: row[descIdx] ? String(row[descIdx]) : '',
            length_cm: Number(row[lIdx]) || 0,
            width_cm: Number(row[wIdx]) || 0,
            height_cm: Number(row[hIdx]) || 0,
            qty_per_ctn: Number(row[qtyPerCtnIdx]) || 1,
            gw_per_ctn: Number(row[gwPerCtnIdx]) || 0,
          });
        }

        if (parsedData.length > 0) {
          // Delete all existing records
          const { error: deleteError } = await supabase.from('sku_dimensions').delete().neq('part_no', '0');
          if (deleteError) throw deleteError;

          // Insert new records in chunks of 500
          for (let i = 0; i < parsedData.length; i += 500) {
            const chunk = parsedData.slice(i, i + 500);
            const { error: insertError } = await supabase.from('sku_dimensions').insert(chunk);
            if (insertError) throw insertError;
          }

          setFileName(file.name);
          setSuccessMsg(`Successfully uploaded and replaced ${parsedData.length} SKUs.`);
          await fetchSkus(); // Refresh local state
        } else {
          throw new Error("No valid data found in the file.");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error parsing Excel file.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const addSkuToShipment = (sku: SkuData) => {
    const existing = shipmentItems.find(item => item.sku.partNo === sku.partNo);
    if (existing) {
      setShipmentItems(prev => prev.map(item => 
        item.sku.partNo === sku.partNo ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setShipmentItems(prev => [...prev, { id: Math.random().toString(36).substring(7), sku, qty: 1 }]);
    }
    setSearchQuery('');
  };

  const updateItemQty = (id: string, qty: number) => {
    if (qty < 0) return;
    setShipmentItems(prev => prev.map(item => item.id === id ? { ...item, qty } : item));
  };

  const removeItem = (id: string) => {
    setShipmentItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateItem = (sku: SkuData, qty: number) => {
    if (qty <= 0) return { totalCartons: 0, totalGrossWeight: 0, totalCartonVolWeight: 0, totalPallets: 0, palletGrossWeight: 0, palletVolWeight: 0 };

    const totalCartons = Math.ceil(qty / sku.qtyPerCtn);
    const totalGrossWeight = totalCartons * sku.gwPerCtn;
    const cartonVolWeight = (sku.l * sku.w * sku.h) / 6000;
    const totalCartonVolWeight = totalCartons * cartonVolWeight;

    // Pallet Calculation
    const PALLET_L = 121;
    const PALLET_W = 101;
    const PALLET_MAX_H = 137;
    const PALLET_BASE_H = 15;
    const PALLET_BASE_WT = 15;

    const usableH = PALLET_MAX_H - PALLET_BASE_H;

    const layer1 = Math.floor(PALLET_L / sku.l) * Math.floor(PALLET_W / sku.w);
    const layer2 = Math.floor(PALLET_L / sku.w) * Math.floor(PALLET_W / sku.l);
    const maxCartonsPerLayer = Math.max(layer1, layer2);
    const maxLayers = Math.floor(usableH / sku.h);
    const maxCartonsPerPallet = maxCartonsPerLayer * maxLayers;

    let totalPallets = 0;
    let palletGrossWeight = 0;
    let palletVolWeight = 0;

    if (maxCartonsPerPallet > 0) {
      totalPallets = Math.ceil(totalCartons / maxCartonsPerPallet);
      const fullPallets = Math.floor(totalCartons / maxCartonsPerPallet);
      const remainingCartons = totalCartons % maxCartonsPerPallet;

      const fullPalletHeight = (maxLayers * sku.h) + PALLET_BASE_H;
      const fullPalletVolWeight = (PALLET_L * PALLET_W * fullPalletHeight) / 6000;
      
      let partialPalletVolWeight = 0;
      if (remainingCartons > 0) {
        const partialLayers = Math.ceil(remainingCartons / maxCartonsPerLayer);
        const partialPalletHeight = (partialLayers * sku.h) + PALLET_BASE_H;
        partialPalletVolWeight = (PALLET_L * PALLET_W * partialPalletHeight) / 6000;
      }

      palletVolWeight = (fullPallets * fullPalletVolWeight) + partialPalletVolWeight;
      palletGrossWeight = totalGrossWeight + (totalPallets * PALLET_BASE_WT);
    }

    return {
      totalCartons,
      totalGrossWeight,
      totalCartonVolWeight,
      totalPallets,
      palletGrossWeight,
      palletVolWeight,
      maxCartonsPerPallet
    };
  };

  // Filter SKUs for search
  const filteredSkus = searchQuery.trim() === '' 
    ? [] 
    : skuDatabase.filter(s => 
        s.partNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10); // Limit to 10 results

  // Calculate Totals
  const totals = shipmentItems.reduce((acc, item) => {
    const c = calculateItem(item.sku, item.qty);
    acc.cartons += c.totalCartons;
    acc.gross += c.totalGrossWeight;
    acc.vol += c.totalCartonVolWeight;
    acc.pallets += c.totalPallets;
    acc.palletGross += c.palletGrossWeight;
    acc.palletVol += c.palletVolWeight;
    return acc;
  }, { cartons: 0, gross: 0, vol: 0, pallets: 0, palletGross: 0, palletVol: 0 });

  const looseChargeable = Math.max(totals.gross, totals.vol);
  const palletChargeable = Math.max(totals.palletGross, totals.palletVol);
  
  const uniqueDestinations = Array.from(new Set(freightRates.map(r => r.destination))).sort();
  const ratesForDestination = freightRates.filter(r => r.destination === selectedDestination);
  const cheapestRate = ratesForDestination.length > 0 
    ? ratesForDestination.reduce((min, r) => r.rate_per_kg < min.rate_per_kg ? r : min, ratesForDestination[0])
    : null;

  const rate = cheapestRate ? cheapestRate.rate_per_kg : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <Calculator size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Air Freight Rate Calculator</h1>
          <p className="text-sm text-slate-500">Upload SKU dimensions and calculate air freight costs for multiple items.</p>
        </div>
      </div>

      {/* Database Status & Upload Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">SKU Master Database</h2>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              {isLoading ? (
                <><Loader2 size={12} className="animate-spin"/> Loading database...</>
              ) : (
                <>{skuDatabase.length} SKUs available for calculation</>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsRateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 shadow-sm transition-colors"
          >
            <Settings size={14} />
            Update Freight Rates
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {isUploading ? 'Updating...' : 'Update Database'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-sm">
          <CheckCircle size={16} className="shrink-0 mt-0.5" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Calculator Section */}
      <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-opacity ${skuDatabase.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">Build Shipment</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Destination</label>
            <select 
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="w-56 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700"
            >
              <option value="">Select Destination...</option>
              {uniqueDestinations.map(dest => (
                <option key={dest} value={dest}>{dest}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-6 z-20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
              placeholder="Search SKU by Part No or Description to add to shipment..."
            />
          </div>
          
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-slate-200 rounded-xl mt-2 max-h-80 overflow-y-auto animate-fade-in-up">
              {filteredSkus.length > 0 ? (
                filteredSkus.map(sku => (
                  <div 
                    key={sku.partNo} 
                    onClick={() => addSkuToShipment(sku)} 
                    className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between items-center group transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{sku.partNo}</div>
                      <div className="text-xs text-slate-500 truncate max-w-md">{sku.description}</div>
                    </div>
                    <div className="text-xs text-slate-400 group-hover:text-indigo-600 flex items-center gap-1 font-medium">
                      <Plus size={14} /> Add
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-slate-500">No SKUs found matching "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>

        {/* Shipment Table */}
        {shipmentItems.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-4 py-3">Part No</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Dimensions (cm)</th>
                    <th className="px-4 py-3">Qty (Units)</th>
                    <th className="px-4 py-3 text-right">Cartons</th>
                    <th className="px-4 py-3 text-right">Gross Wt</th>
                    <th className="px-4 py-3 text-right">Vol Wt</th>
                    <th className="px-4 py-3 text-right">Pallets</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipmentItems.map(item => {
                    const calc = calculateItem(item.sku, item.qty);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                        <td className="px-4 py-3 font-bold text-slate-800">{item.sku.partNo}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={item.sku.description}>{item.sku.description}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{item.sku.l} x {item.sku.w} x {item.sku.h}</td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            value={item.qty || ''} 
                            onChange={(e) => updateItemQty(item.id, Number(e.target.value))} 
                            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            min="1"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{calc.totalCartons}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{calc.totalGrossWeight.toFixed(2)} kg</td>
                        <td className="px-4 py-3 text-right text-slate-600">{calc.totalCartonVolWeight.toFixed(2)} kg</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {calc.maxCartonsPerPallet > 0 ? calc.totalPallets : <span className="text-red-400 text-xs" title="Exceeds pallet size">N/A</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50">
                            <Trash2 size={16}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 bg-slate-50 mb-6">
            <Package size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="font-medium text-slate-700">Shipment is empty</p>
            <p className="text-sm mt-1">Search and add SKUs to build your shipment calculation.</p>
          </div>
        )}

        {/* Totals Section */}
        {shipmentItems.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
            {/* Loose Cartons Totals */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                <Package size={18} className="text-indigo-500" />
                <h3>Loose Cartons Totals</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Cartons</span>
                  <span className="font-bold text-slate-800">{totals.cartons} ctns</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Gross Weight</span>
                  <span className="font-bold text-slate-800">{totals.gross.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Volumetric Weight</span>
                  <span className="font-bold text-slate-800">{totals.vol.toFixed(2)} kg</span>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Chargeable Weight</span>
                  <span className="text-lg font-black text-indigo-600">{looseChargeable.toFixed(2)} kg</span>
                </div>
                {ratesForDestination.map(rateObj => {
                  const isCheapest = cheapestRate?.id === rateObj.id;
                  return (
                    <div key={rateObj.id} className={`flex justify-between items-center p-3 rounded-lg mt-2 ${isCheapest ? 'bg-indigo-100/50' : 'bg-slate-100'}`}>
                      <div>
                        <span className={`font-bold block ${isCheapest ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {rateObj.shipping_mode} Cost
                          {isCheapest && ratesForDestination.length > 1 && <span className="ml-2 text-[10px] uppercase bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">Cheapest</span>}
                        </span>
                        <span className={`text-xs font-medium ${isCheapest ? 'text-indigo-600' : 'text-slate-500'}`}>
                          ${rateObj.rate_per_kg.toFixed(2)}/kg
                        </span>
                      </div>
                      <span className={`text-xl font-black ${isCheapest ? 'text-indigo-700' : 'text-slate-700'}`}>
                        ${(looseChargeable * rateObj.rate_per_kg).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Palletized Totals */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                <div className="w-5 h-5 border-2 border-emerald-500 rounded flex items-center justify-center">
                  <div className="w-3 h-1 bg-emerald-500 rounded-sm"></div>
                </div>
                <h3>Palletized Totals (121x101x137 cm max)</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Pallets</span>
                  <span className="font-bold text-slate-800">{totals.pallets} plts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Weight (inc. pallets)</span>
                  <span className="font-bold text-slate-800">{totals.palletGross.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Volumetric Weight</span>
                  <span className="font-bold text-slate-800">{totals.palletVol.toFixed(2)} kg</span>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Chargeable Weight</span>
                  <span className="text-lg font-black text-emerald-600">{palletChargeable.toFixed(2)} kg</span>
                </div>
                {ratesForDestination.map(rateObj => {
                  const isCheapest = cheapestRate?.id === rateObj.id;
                  return (
                    <div key={rateObj.id} className={`flex justify-between items-center p-3 rounded-lg mt-2 ${isCheapest ? 'bg-emerald-100/50' : 'bg-slate-100'}`}>
                      <div>
                        <span className={`font-bold block ${isCheapest ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {rateObj.shipping_mode} Cost
                          {isCheapest && ratesForDestination.length > 1 && <span className="ml-2 text-[10px] uppercase bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">Cheapest</span>}
                        </span>
                        <span className={`text-xs font-medium ${isCheapest ? 'text-emerald-600' : 'text-slate-500'}`}>
                          ${rateObj.rate_per_kg.toFixed(2)}/kg
                        </span>
                      </div>
                      <span className={`text-xl font-black ${isCheapest ? 'text-emerald-700' : 'text-slate-700'}`}>
                        ${(palletChargeable * rateObj.rate_per_kg).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enterprise Rate Update Modal */}
      {isRateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Globe size={18} className="text-indigo-600" /> Freight Rates Management
              </h3>
              <button onClick={() => { setIsRateModalOpen(false); setEditingRate(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {editingRate ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-fade-in-up">
                  <h4 className="font-bold text-slate-800 mb-4">{editingRate.id ? 'Edit Rate' : 'Add New Rate'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Destination</label>
                      <input 
                        type="text" 
                        value={editingRate.destination || ''}
                        onChange={(e) => setEditingRate({...editingRate, destination: e.target.value})}
                        placeholder="e.g. United States"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mode</label>
                      <select 
                        value={editingRate.shipping_mode || 'Courier'}
                        onChange={(e) => setEditingRate({...editingRate, shipping_mode: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      >
                        <option value="Courier">Courier</option>
                        <option value="Forwarder">Forwarder</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Rate per KG ($)</label>
                      <input 
                        type="number" 
                        value={editingRate.rate_per_kg === undefined ? '' : editingRate.rate_per_kg}
                        onChange={(e) => setEditingRate({...editingRate, rate_per_kg: e.target.value === '' ? undefined : Number(e.target.value)})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setEditingRate(null)}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveRate}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all flex items-center gap-2"
                    >
                      <Save size={14} /> Save Rate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end mb-4">
                  <button 
                    onClick={() => setEditingRate({ shipping_mode: 'Courier' })}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all"
                  >
                    <Plus size={16} /> Add New Rate
                  </button>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3 text-right">Rate / KG</th>
                      <th className="px-4 py-3">Last Updated</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {freightRates.length > 0 ? (
                      freightRates.map(rate => (
                        <tr key={rate.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                          <td className="px-4 py-3 font-bold text-slate-800">{rate.destination}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${rate.shipping_mode === 'Courier' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {rate.shipping_mode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">${rate.rate_per_kg.toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{new Date(rate.updated_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setEditingRate(rate)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50">
                                <Edit2 size={14}/>
                              </button>
                              <button onClick={() => handleDeleteRate(rate.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50">
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                          No freight rates configured. Click "Add New Rate" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AirFreightCalculator;

