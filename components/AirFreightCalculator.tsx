import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Calculator, Package, Info, AlertCircle, Search, Plus, Trash2, Loader2, CheckCircle, Database, Settings, X, Save, Edit2, Globe, Map, Box, Table } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { destinationService, Destination } from '../services/destinationService';
import { calculateCourierCost, Region, COURIER_REGIONS, parseDBRates, COURIER_FIXED_RATES, COURIER_PER_KG_RATES } from '../services/courierRates';
import SearchableSelect, { SelectOption } from './SearchableSelect';
import PalletVisualizer from './PalletVisualizer';
import RegionRateManager from './RegionRateManager';

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
  const [skuCount, setSkuCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSkus, setFilteredSkus] = useState<SkuData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([]);
  const [inputMode, setInputMode] = useState<'search' | 'paste'>('search');
  const [pasteText, setPasteText] = useState('');
  const [pasteQtyText, setPasteQtyText] = useState('');
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rate Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [freightRates, setFreightRates] = useState<FreightRate[]>([]);
  const [editingDestinationRate, setEditingDestinationRate] = useState<{
    destination: string;
    courierRate: number | '';
    forwarderRate: number | '';
    courierId?: string;
    forwarderId?: string;
    isNew: boolean;
  } | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<Region | ''>('');
  const [availableDestinations, setAvailableDestinations] = useState<Destination[]>([]);
  const [rateToDelete, setRateToDelete] = useState<string | null>(null);
  
  // Region Rates State
  const [isRegionManagerOpen, setIsRegionManagerOpen] = useState(false);
  const [regionFixedRates, setRegionFixedRates] = useState(COURIER_FIXED_RATES);
  const [regionRangeRates, setRegionRangeRates] = useState(COURIER_PER_KG_RATES);

  // Visualization State
  const [visualizingItem, setVisualizingItem] = useState<{
    sku: SkuData;
    calc: any;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch SKUs from Supabase on mount
  useEffect(() => {
    fetchSkus();
    fetchRates();
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const dests = await destinationService.getAll();
      setAvailableDestinations(dests);
    } catch (err) {
      console.error("Error fetching destinations:", err);
    }
  };

  const fetchRates = async () => {
    try {
      const { data, error } = await supabase.from('freight_rates').select('*').order('destination', { ascending: true });
      if (error) throw error;
      
      // Parse Region Rates
      const { fixedRates, rangeRates } = parseDBRates(data || []);
      setRegionFixedRates(fixedRates);
      setRegionRangeRates(rangeRates);

      // Filter out Region rates from the main list to avoid cluttering the dropdown
      const standardRates = (data || []).filter(r => !r.destination.startsWith('Region:'));
      setFreightRates(standardRates);

      const destData = await destinationService.getAll();
      setAvailableDestinations(destData || []);
    } catch (err: any) {
      console.error("Error fetching rates:", err);
    }
  };

  const handleSaveRate = async () => {
    if (!editingDestinationRate?.destination) {
      setError("Please select a destination.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      const now = new Date().toISOString();
      const promises = [];
      
      // Courier
      if (editingDestinationRate.courierRate !== '') {
        const payload = {
          destination: editingDestinationRate.destination,
          shipping_mode: 'Courier',
          rate_per_kg: Number(editingDestinationRate.courierRate),
          updated_at: now
        };
        if (editingDestinationRate.courierId) {
          promises.push(supabase.from('freight_rates').update(payload).eq('id', editingDestinationRate.courierId));
        } else {
          promises.push(supabase.from('freight_rates').insert([payload]));
        }
      } else if (editingDestinationRate.courierId) {
        promises.push(supabase.from('freight_rates').delete().eq('id', editingDestinationRate.courierId));
      }

      // Forwarder
      if (editingDestinationRate.forwarderRate !== '') {
        const payload = {
          destination: editingDestinationRate.destination,
          shipping_mode: 'Forwarder',
          rate_per_kg: Number(editingDestinationRate.forwarderRate),
          updated_at: now
        };
        if (editingDestinationRate.forwarderId) {
          promises.push(supabase.from('freight_rates').update(payload).eq('id', editingDestinationRate.forwarderId));
        } else {
          promises.push(supabase.from('freight_rates').insert([payload]));
        }
      } else if (editingDestinationRate.forwarderId) {
        promises.push(supabase.from('freight_rates').delete().eq('id', editingDestinationRate.forwarderId));
      }

      await Promise.all(promises);

      setEditingDestinationRate(null);
      await fetchRates();
      setSuccessMsg("Freight rates saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save rates.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteRate = async () => {
    if (!rateToDelete) return;
    try {
      const { error } = await supabase.from('freight_rates').delete().eq('destination', rateToDelete);
      if (error) throw error;
      await fetchRates();
      setRateToDelete(null);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
      setRateToDelete(null);
    }
  };

  const handleSaveRegionRates = async (rows: any[]) => {
    try {
      // 1. Delete all existing Region rates
      const { error: deleteError } = await supabase
        .from('freight_rates')
        .delete()
        .like('destination', 'Region:%');
      
      if (deleteError) throw deleteError;

      // 2. Insert new rates
      // Process in chunks of 100 to avoid payload limits
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
            .from('freight_rates')
            .insert(chunk);
        if (insertError) throw insertError;
      }

      await fetchRates();
      setIsRegionManagerOpen(false);
      setSuccessMsg("Region rates saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      console.error('Error saving region rates:', error);
      alert('Failed to save region rates. Please try again.');
    }
  };

  const fetchSkus = async () => {
    setIsLoading(true);
    try {
      const { count, error } = await supabase
        .from('sku_dimensions')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      setSkuCount(count || 0);
    } catch (err: any) {
      console.error("Error fetching SKU count:", err);
      setError("Failed to load SKU database count.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const searchSkus = async () => {
      if (!searchQuery.trim()) {
        setFilteredSkus([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('sku_dimensions')
          .select('*')
          .or(`part_no.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;

        if (data) {
          const formatted = data.map(d => ({
            partNo: d.part_no,
            description: d.description,
            l: Number(d.length_cm) || 0,
            w: Number(d.width_cm) || 0,
            h: Number(d.height_cm) || 0,
            qtyPerCtn: Number(d.qty_per_ctn) || 1,
            gwPerCtn: Number(d.gw_per_ctn) || 0
          }));
          setFilteredSkus(formatted);
        }
      } catch (err) {
        console.error("Error searching SKUs:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchSkus, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

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

  const handleProcessPaste = async () => {
    if (!pasteText.trim()) return;
    setIsProcessingPaste(true);
    
    // Parse lines
    const rawSkuLines = pasteText.split('\n');
    const rawQtyLines = pasteQtyText.split('\n');
    const parsedItems: { partNo: string, qty: number }[] = [];
    
    for (let i = 0; i < rawSkuLines.length; i++) {
      const line = rawSkuLines[i].trim();
      if (!line) continue;

      // Split by tab, comma, or multiple spaces
      const parts = line.split(/\t|,|\s{2,}/);
      const partNo = parts[0].trim();
      let qty = 1;

      if (parts.length > 1) {
        const parsedQty = parseInt(parts[1].trim(), 10);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          qty = parsedQty;
        }
      } else if (rawQtyLines[i]) {
        const parsedQty = parseInt(rawQtyLines[i].trim(), 10);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          qty = parsedQty;
        }
      }

      if (partNo) {
        parsedItems.push({ partNo, qty });
      }
    }

    if (parsedItems.length === 0) {
      setIsProcessingPaste(false);
      return;
    }

    // Query Supabase for these SKUs
    const partNos = parsedItems.map(item => item.partNo);
    
    try {
      const chunkSize = 100;
      let allFoundSkus: any[] = [];
      
      for (let i = 0; i < partNos.length; i += chunkSize) {
        const chunk = partNos.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('sku_dimensions')
          .select('*')
          .in('part_no', chunk);
          
        if (error) throw error;
        if (data) {
          allFoundSkus = [...allFoundSkus, ...data];
        }
      }

      const formattedSkus = allFoundSkus.map(d => ({
        partNo: d.part_no,
        description: d.description,
        l: Number(d.length_cm) || 0,
        w: Number(d.width_cm) || 0,
        h: Number(d.height_cm) || 0,
        qtyPerCtn: Number(d.qty_per_ctn) || 1,
        gwPerCtn: Number(d.gw_per_ctn) || 0
      }));

      // Add to shipment items
      const newShipmentItems = [...shipmentItems];
      let addedCount = 0;
      let notFoundCount = 0;

      parsedItems.forEach(item => {
        const foundSku = formattedSkus.find(s => s.partNo.toLowerCase() === item.partNo.toLowerCase());
        if (foundSku) {
          const existingIdx = newShipmentItems.findIndex(i => i.sku.partNo === foundSku.partNo);
          if (existingIdx >= 0) {
            newShipmentItems[existingIdx].qty += item.qty;
          } else {
            newShipmentItems.push({
              id: Math.random().toString(36).substring(2, 9),
              sku: foundSku,
              qty: item.qty
            });
          }
          addedCount++;
        } else {
          notFoundCount++;
        }
      });

      setShipmentItems(newShipmentItems);
      setPasteText('');
      setPasteQtyText('');
      
      if (notFoundCount > 0) {
        setError(`Added ${addedCount} SKUs. ${notFoundCount} SKUs were not found in the database.`);
        setTimeout(() => setError(null), 5000);
      } else {
        setSuccessMsg(`Successfully added ${addedCount} SKUs.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
      
    } catch (err: any) {
      console.error("Error processing pasted SKUs:", err);
      setError("Failed to process pasted SKUs.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessingPaste(false);
    }
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
    
    // Calculate weight: Full cartons get full GW, partial carton gets proportional GW
    const fullCartons = Math.floor(qty / sku.qtyPerCtn);
    const remainingUnits = qty % sku.qtyPerCtn;
    
    let totalGrossWeight = fullCartons * sku.gwPerCtn;
    if (remainingUnits > 0) {
        // Assume proportional weight for the partial carton (Unit Weight * Remaining Units)
        // This avoids a single unit weighing as much as a full carton
        const unitWeight = sku.gwPerCtn / sku.qtyPerCtn;
        totalGrossWeight += unitWeight * remainingUnits;
    }

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
    const bestOrientation = layer1 >= layer2 ? 'normal' : 'rotated';
    
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
      maxCartonsPerPallet,
      maxLayers,
      maxCartonsPerLayer,
      bestOrientation
    };
  };

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
  
  const destinationOptions: SelectOption[] = useMemo(() => {
    const map = new Map<string, any>();
    availableDestinations.forEach(d => {
      const upperCode = d.code.toUpperCase().trim();
      if (!map.has(upperCode)) {
        map.set(upperCode, { label: d.description || upperCode, value: upperCode, subLabel: upperCode, original: d });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [availableDestinations]);

  // Calculate Costs for Comparison
  const ratesForDestination = freightRates.filter(r => r.destination === selectedDestination);
  
  const calculateAllCosts = (chargeableWeight: number) => {
    const costs: { id: string, mode: string, cost: number, label: string, isRegion?: boolean }[] = [];

    // DB Rates
    ratesForDestination.forEach(r => {
        // If region is selected, skip DB Courier rate to avoid confusion/duplication
        if (selectedRegion && r.shipping_mode === 'Courier') return;
        
        costs.push({
            id: r.id,
            mode: r.shipping_mode,
            cost: chargeableWeight * r.rate_per_kg,
            label: `$${r.rate_per_kg.toFixed(2)}/kg`
        });
    });

    // Region Rate
    if (selectedRegion) {
        const regionCost = calculateCourierCost(chargeableWeight, selectedRegion as Region, {
            fixedRates: regionFixedRates,
            rangeRates: regionRangeRates
        });
        costs.push({
            id: 'region-courier',
            mode: `Courier (Region ${selectedRegion})`,
            cost: regionCost,
            label: 'Region Rate',
            isRegion: true
        });
    }

    // Find Cheapest
    const minCost = costs.length > 0 ? Math.min(...costs.map(c => c.cost)) : 0;
    
    return costs.map(c => ({
        ...c,
        isCheapest: c.cost === minCost && c.cost > 0
    })).sort((a, b) => a.cost - b.cost);
  };

  const looseCosts = calculateAllCosts(looseChargeable);
  const palletCosts = calculateAllCosts(palletChargeable);

  const groupedRates = React.useMemo(() => {
    const grouped: Record<string, {
      destination: string;
      courierRate?: number;
      forwarderRate?: number;
      courierId?: string;
      forwarderId?: string;
      updated_at: string;
    }> = {};

    freightRates.forEach(rate => {
      if (!grouped[rate.destination]) {
        grouped[rate.destination] = {
          destination: rate.destination,
          updated_at: rate.updated_at
        };
      }
      if (rate.shipping_mode === 'Courier') {
        grouped[rate.destination].courierRate = rate.rate_per_kg;
        grouped[rate.destination].courierId = rate.id;
      } else if (rate.shipping_mode === 'Forwarder') {
        grouped[rate.destination].forwarderRate = rate.rate_per_kg;
        grouped[rate.destination].forwarderId = rate.id;
      }
      if (new Date(rate.updated_at) > new Date(grouped[rate.destination].updated_at)) {
        grouped[rate.destination].updated_at = rate.updated_at;
      }
    });

    return Object.values(grouped).sort((a, b) => a.destination.localeCompare(b.destination));
  }, [freightRates]);

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
                <>{skuCount} SKUs available for calculation</>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsRegionManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Table size={14} className="text-indigo-600"/>
            Manage Region Rates
          </button>
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
      <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-opacity ${skuCount === 0 && !isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-800">Build Shipment</h2>
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Destination</label>
                <div className="w-64">
                <SearchableSelect 
                    label=""
                    value={selectedDestination ? destinationOptions.find(o => o.value === selectedDestination)?.label || selectedDestination : ''}
                    selectedValue={selectedDestination}
                    options={destinationOptions}
                    onChange={(val) => setSelectedDestination(val)}
                    placeholder="Select Destination..."
                    searchPlaceholder="Search destinations..."
                />
                </div>
            </div>
            
            <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Region (Courier)</label>
                <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value as Region | '')}
                    className="h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-w-[100px]"
                >
                    <option value="">None</option>
                    {COURIER_REGIONS.map(r => (
                        <option key={r} value={r}>Region {r}</option>
                    ))}
                </select>
            </div>
          </div>
        </div>
        
        {/* Search Bar / Bulk Paste */}
        <div className="mb-6 z-20">
          <div className="flex gap-2 mb-2">
            <button 
              onClick={() => setInputMode('search')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${inputMode === 'search' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Search SKUs
            </button>
            <button 
              onClick={() => setInputMode('paste')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${inputMode === 'paste' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Bulk Paste
            </button>
          </div>

          {inputMode === 'search' ? (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                placeholder="Search SKU by Part No or Description to add to shipment..."
              />
              
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-slate-200 rounded-xl mt-2 max-h-80 overflow-y-auto animate-fade-in-up">
                  {isSearching ? (
                    <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Searching...
                    </div>
                  ) : filteredSkus.length > 0 ? (
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
          ) : (
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">SKUs</label>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste SKUs here (e.g. from Excel)"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm min-h-[120px] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Quantities (Optional)</label>
                  <textarea
                    value={pasteQtyText}
                    onChange={(e) => setPasteQtyText(e.target.value)}
                    placeholder="Paste Quantities here to match SKUs line-by-line"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm min-h-[120px] font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleProcessPaste}
                  disabled={isProcessingPaste || !pasteText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isProcessingPaste ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {isProcessingPaste ? 'Processing...' : 'Add Pasted SKUs'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Shipment Table */}
        {shipmentItems.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            {selectedItems.length > 0 && (
              <div className="bg-indigo-50 p-3 border-b border-slate-200 flex justify-between items-center">
                <span className="text-sm font-bold text-indigo-700">{selectedItems.length} items selected</span>
                <button 
                  onClick={() => {
                    setShipmentItems(shipmentItems.filter(i => !selectedItems.includes(i.id)));
                    setSelectedItems([]);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-bold transition-colors"
                >
                  <Trash2 size={14} /> Delete Selected
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <th className="px-4 py-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.length === shipmentItems.length && shipmentItems.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(shipmentItems.map(i => i.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Part No</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Dimensions (cm)</th>
                    <th className="px-4 py-3">Qty (Units)</th>
                    <th className="px-4 py-3 text-right">Cartons</th>
                    <th className="px-4 py-3 text-right">Gross Wt</th>
                    <th className="px-4 py-3 text-right">Vol Wt</th>
                    <th className="px-4 py-3 text-right">Ti-Hi</th>
                    <th className="px-4 py-3 text-right">Pallets</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shipmentItems.map((item, index) => {
                    const calc = calculateItem(item.sku, item.qty);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedItems.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, item.id]);
                              } else {
                                setSelectedItems(selectedItems.filter(id => id !== item.id));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{index + 1}</td>
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
                        <td className="px-4 py-3 text-right text-xs text-slate-500">
                          {calc.maxCartonsPerPallet > 0 ? (
                            <div className="flex flex-col items-end">
                              <span>{calc.maxCartonsPerLayer} x {calc.maxLayers}</span>
                              <span className="text-[10px] text-slate-400">({calc.maxCartonsPerPallet}/plt)</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {calc.maxCartonsPerPallet > 0 ? calc.totalPallets : <span className="text-red-400 text-xs" title="Exceeds pallet size">N/A</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                                onClick={() => setVisualizingItem({ sku: item.sku, calc })}
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50"
                                title="Visualize Pallet"
                            >
                                <Box size={16}/>
                            </button>
                            <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50">
                                <Trash2 size={16}/>
                            </button>
                          </div>
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
                {looseCosts.map(costObj => (
                    <div key={costObj.id} className={`flex justify-between items-center p-3 rounded-lg mt-2 ${costObj.isCheapest ? 'bg-indigo-100/50' : 'bg-slate-100'}`}>
                      <div>
                        <span className={`font-bold block ${costObj.isCheapest ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {costObj.mode} Cost
                          {costObj.isCheapest && looseCosts.length > 1 && <span className="ml-2 text-[10px] uppercase bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">Cheapest</span>}
                        </span>
                        <span className={`text-xs font-medium ${costObj.isCheapest ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {costObj.label}
                        </span>
                      </div>
                      <span className={`text-xl font-black ${costObj.isCheapest ? 'text-indigo-700' : 'text-slate-700'}`}>
                        ${costObj.cost.toFixed(2)}
                      </span>
                    </div>
                ))}
              </div>
            </div>

            {/* Palletized Totals */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                <div className="w-5 h-5 border-2 border-emerald-500 rounded flex items-center justify-center">
                  <div className="w-3 h-1 bg-emerald-500 rounded-sm"></div>
                </div>
                <h3>Palletized Totals (Max 137cm = 15cm Base + 122cm Goods)</h3>
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
                {palletCosts.map(costObj => (
                    <div key={costObj.id} className={`flex justify-between items-center p-3 rounded-lg mt-2 ${costObj.isCheapest ? 'bg-emerald-100/50' : 'bg-slate-100'}`}>
                      <div>
                        <span className={`font-bold block ${costObj.isCheapest ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {costObj.mode} Cost
                          {costObj.isCheapest && palletCosts.length > 1 && <span className="ml-2 text-[10px] uppercase bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">Cheapest</span>}
                        </span>
                        <span className={`text-xs font-medium ${costObj.isCheapest ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {costObj.label}
                        </span>
                      </div>
                      <span className={`text-xl font-black ${costObj.isCheapest ? 'text-emerald-700' : 'text-slate-700'}`}>
                        ${costObj.cost.toFixed(2)}
                      </span>
                    </div>
                ))}
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
              <button onClick={() => { setIsRateModalOpen(false); setEditingDestinationRate(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {editingDestinationRate ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-fade-in-up">
                  <h4 className="font-bold text-slate-800 mb-4">{editingDestinationRate.isNew ? 'Add New Rate' : 'Edit Rate'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Destination</label>
                      <SearchableSelect 
                        label=""
                        value={editingDestinationRate.destination ? destinationOptions.find(o => o.value === editingDestinationRate.destination)?.label || editingDestinationRate.destination : ''}
                        selectedValue={editingDestinationRate.destination}
                        options={destinationOptions}
                        onChange={(val) => setEditingDestinationRate({...editingDestinationRate, destination: val})}
                        placeholder="Select Destination..."
                        searchPlaceholder="Search destinations..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Courier Rate / KG ($)</label>
                      <input 
                        type="number" 
                        value={editingDestinationRate.courierRate}
                        onChange={(e) => setEditingDestinationRate({...editingDestinationRate, courierRate: e.target.value === '' ? '' : Number(e.target.value)})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Forwarder Rate / KG ($)</label>
                      <input 
                        type="number" 
                        value={editingDestinationRate.forwarderRate}
                        onChange={(e) => setEditingDestinationRate({...editingDestinationRate, forwarderRate: e.target.value === '' ? '' : Number(e.target.value)})}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setEditingDestinationRate(null)}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveRate}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all flex items-center gap-2"
                    >
                      <Save size={14} /> Save Rates
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end mb-4">
                  <button 
                    onClick={() => setEditingDestinationRate({ destination: '', courierRate: '', forwarderRate: '', isNew: true })}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all"
                  >
                    <Plus size={16} /> Add New Rates
                  </button>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3 text-right">Courier Rate / KG</th>
                      <th className="px-4 py-3 text-right">Forwarder Rate / KG</th>
                      <th className="px-4 py-3">Last Updated</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedRates.length > 0 ? (
                      groupedRates.map(group => (
                        <tr key={group.destination} className="hover:bg-slate-50/50 transition-colors text-sm">
                          <td className="px-4 py-3 font-bold text-slate-800">{group.destination}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">
                            {group.courierRate !== undefined ? `$${group.courierRate.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">
                            {group.forwarderRate !== undefined ? `$${group.forwarderRate.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{new Date(group.updated_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => setEditingDestinationRate({
                                  destination: group.destination,
                                  courierRate: group.courierRate ?? '',
                                  forwarderRate: group.forwarderRate ?? '',
                                  courierId: group.courierId,
                                  forwarderId: group.forwarderId,
                                  isNew: false
                                })} 
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50"
                              >
                                <Edit2 size={14}/>
                              </button>
                              <button 
                                onClick={() => setRateToDelete(group.destination)} 
                                className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                              >
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                          No freight rates configured. Click "Add New Rates" to get started.
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

      {/* Delete Confirmation Modal */}
      {rateToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Delete Freight Rates</h3>
              <p className="text-slate-500 text-center text-sm mb-6">
                Are you sure you want to delete all freight rates for <strong>{rateToDelete}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => setRateToDelete(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteRate}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pallet Visualizer Modal */}
      {visualizingItem && (
        <PalletVisualizer 
            isOpen={!!visualizingItem}
            onClose={() => setVisualizingItem(null)}
            sku={visualizingItem.sku}
            calc={visualizingItem.calc}
        />
      )}

      {/* Region Rate Manager Modal */}
      <RegionRateManager 
        isOpen={isRegionManagerOpen}
        onClose={() => setIsRegionManagerOpen(false)}
        initialFixedRates={regionFixedRates}
        initialRangeRates={regionRangeRates}
        onSave={handleSaveRegionRates}
      />
    </div>
  );
};

export default AirFreightCalculator;

