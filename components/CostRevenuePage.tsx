
import React, { useState, useEffect, useMemo } from 'react';
import { financialService } from '../services/financialService';
import { freightService } from '../services/freightService';
import { destinationService, Destination } from '../services/destinationService';
import { FinancialMetric, FinancialCategory } from '../types';
import { Save, Plus, Trash2, Loader2, TrendingUp, Calculator, Keyboard, Info, RefreshCw, X, AlertCircle, Copy, ExternalLink, ListFilter, HelpCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from './ui/Skeleton';

const CATEGORIES: { id: FinancialCategory; label: string; isTotal?: boolean; isOther?: boolean }[] = [
  { id: 'CLEU', label: 'CLEU' },
  { id: 'CLPL', label: 'CLPL' },
  { id: 'CLI', label: 'CLI' },
  { id: 'CLCI', label: 'CLCI' },
  // 'OTHER' Category removed from UI as per request. Unmapped costs are handled in Total/Modal only.
  { id: 'INTER_PLANT', label: 'CLEU Est Inter-Plant cost', isTotal: true },
  { id: 'TARGET', label: 'Target Rev $ (USD)', isTotal: true }
];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

const formatPercent = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return '0.00%';
  return val.toFixed(2) + '%';
};

// Helper for strict 2 decimal place rounding to prevent floating point errors
const to2DP = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

const HEADER_HEIGHT = 'h-[50px]';
const CATEGORY_BLOCK_HEIGHT = 'h-[130px]';
const SUB_ROW_TITLE_HEIGHT = 'h-[30px]';
const SUB_ROW_INPUT_HEIGHT = 'h-[34px]';
const SUB_ROW_FOOTER_HEIGHT = 'h-[30px]';
const ROW_HEIGHT = 'h-[42px]'; 

const CostRevenuePage: React.FC = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState<FinancialMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newQuarterName, setNewQuarterName] = useState('');
  const [showAddQuarter, setShowAddQuarter] = useState(false);
  
  const [availableQuarters, setAvailableQuarters] = useState<string[]>([]);
  const [isManualInputMode, setIsManualInputMode] = useState(false);
  
  const { success, error } = useToast();
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; quarter: string }>({ show: false, quarter: '' });

  const [autoCalculatedCosts, setAutoCalculatedCosts] = useState<Map<string, Map<string, number>>>(new Map());
  const [destinations, setDestinations] = useState<Destination[]>([]);

  const [exclusionModal, setExclusionModal] = useState<{ isOpen: boolean; quarter: string; shipments: any[]; totalExcluded: number; loading: boolean }>({
      isOpen: false, quarter: '', shipments: [], totalExcluded: 0, loading: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const [metrics, calculatedCosts, dests] = await Promise.all([
            financialService.getAllMetrics(),
            freightService.getQuarterlyShipmentCosts(),
            destinationService.getAll()
        ]);

        setAutoCalculatedCosts(calculatedCosts);
        setDestinations(dests);

        const normalize = (s: string | undefined | null) => (s || '').trim();
        const dbQuarters = new Set(metrics.map(m => normalize(m.quarter)));
        const metricMap = new Map<string, FinancialMetric>();
        
        metrics.forEach(m => {
            const q = normalize(m.quarter);
            let cat = normalize(m.category) as FinancialCategory;
            // Standardize categories if needed
            const key = `${q}|${cat}`;
            const existing = metricMap.get(key);
            
            if (existing) {
                metricMap.set(key, { 
                    ...existing, 
                    cost: to2DP((existing.cost || 0) + (m.cost || 0)),
                    revenue: to2DP((existing.revenue || 0) + (m.revenue || 0))
                });
            } else {
                metricMap.set(key, { ...m, quarter: q, category: cat });
            }
        });

        const mergedData: FinancialMetric[] = [];

        dbQuarters.forEach(q => {
            CATEGORIES.forEach(cat => {
                const key = `${q}|${cat.id}`;
                let metric = metricMap.get(key);
                
                const qMap = calculatedCosts.get(q);
                let calcCost = qMap ? qMap.get(cat.id) : undefined;
                
                if (!metric) {
                    metric = { quarter: q, category: cat.id, cost: 0, revenue: 0, target_revenue: 0 };
                }
                if (calcCost !== undefined) {
                    metric = { ...metric, cost: to2DP(calcCost) };
                }
                mergedData.push(metric);
            });
        });

        setRawData(mergedData);

        const shipmentQuarters: string[] = Array.from(calculatedCosts.keys());
        const gridQuarters = Array.from(dbQuarters);
        
        const validQuarterRegex = /^FY\d{4} Q[1-4]$/;
        // Safe string filtering
        const validShipmentQuarters = shipmentQuarters.filter(q => typeof q === 'string' && validQuarterRegex.test(q));

        const missing = validShipmentQuarters.filter(q => !gridQuarters.includes(q)).sort().reverse();
        
        setAvailableQuarters(missing);
        setIsManualInputMode(missing.length === 0);

    } catch (err) {
        console.error("Failed to load financial data", err);
        error("Failed to load data");
    } finally {
        setLoading(false);
    }
  };

  const quarters = useMemo(() => {
    const unique = Array.from(new Set(rawData.map(r => r.quarter)));
    return unique.sort().reverse(); 
  }, [rawData]);

  const getData = (q: string, cat: FinancialCategory) => rawData.find(r => r.quarter === q && r.category === cat) || { quarter: q, category: cat, cost: 0, revenue: 0 };

  const handleUpdate = (q: string, cat: FinancialCategory, field: 'cost' | 'revenue' | 'target_revenue', val: string) => {
    const num = parseFloat(val) || 0;
    // We maintain raw user input precision during editing, but ensuring it is treated as a number
    const existing = getData(q, cat);
    const updated = { ...existing, [field]: num };
    setRawData(prev => [...prev.filter(r => !(r.quarter === q && r.category === cat)), updated]);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // 1. Save Visible Metrics
      const metricsToSave = rawData.filter(m => m.id || m.revenue !== 0 || m.target_revenue !== 0 || (m.category === 'INTER_PLANT' && m.cost > 0) || (m.cost > 0 && m.category !== 'TARGET'));
      
      // 2. Force Sync Hidden 'OTHER' Metrics (Unmapped)
      // This ensures the database is updated with the latest calculated unmapped costs even though the row is hidden.
      quarters.forEach(q => {
          const qMap = autoCalculatedCosts.get(q);
          const unmappedCost = qMap ? ((qMap.get('OTHER') || 0) + (qMap.get('FBA') || 0)) : 0;
          
          metricsToSave.push({
              quarter: q,
              category: 'OTHER',
              cost: to2DP(unmappedCost),
              revenue: 0,
              target_revenue: 0
          });
      });

      await Promise.all(metricsToSave.map(m => financialService.upsertMetric(m)));
      success('Changes saved successfully!');
      await loadData(); 
    } catch (e) {
      console.error(e);
      error('Failed to save data.');
    } finally {
      setSaving(false);
    }
  };

  const addQuarter = () => {
    if (!newQuarterName.trim()) return;
    const q = newQuarterName.trim().toUpperCase();
    if (quarters.includes(q)) { alert('Quarter already exists.'); return; }
    const calculatedQ = autoCalculatedCosts.get(q);
    const newMetrics: FinancialMetric[] = CATEGORIES.map(c => {
       let cost = (calculatedQ ? calculatedQ.get(c.id) : 0) || (c.id === 'INTER_PLANT' ? 30000 : 0);
       return {
           quarter: q,
           category: c.id,
           cost: to2DP(cost),
           revenue: 0,
           target_revenue: 0
       };
    });
    setRawData(prev => [...prev, ...newMetrics]);
    setNewQuarterName('');
    setShowAddQuarter(false);
    setAvailableQuarters(prev => prev.filter(item => item !== q));
    setIsManualInputMode(false);
  };
  
  const handleAddQuarterClose = () => { setNewQuarterName(''); setShowAddQuarter(false); setIsManualInputMode(false); };

  const confirmDelete = async () => {
    const q = deleteModal.quarter;
    if (!q) return;
    try {
      await financialService.deleteQuarter(q);
      setRawData(prev => prev.filter(r => r.quarter !== q));
      if (autoCalculatedCosts.has(q)) {
          setAvailableQuarters(prev => prev.includes(q) ? prev : [q, ...prev].sort().reverse());
      }
      success(`Deleted ${q} successfully.`);
    } catch (e) { error('Failed to delete.'); }
    finally { setDeleteModal({ show: false, quarter: '' }); }
  };

  const handleAnalyzeExclusions = async (quarter: string) => {
      setExclusionModal({ isOpen: true, quarter, shipments: [], totalExcluded: 0, loading: true });
      
      try {
          // Fetch FRESH data to ensure we aren't using stale React state
          const [approvedRequests, freshDestinations] = await Promise.all([
              freightService.getRequestsByQuarter(quarter),
              destinationService.getAll()
          ]);

          const regionMap = new Map<string, string>();
          freshDestinations.forEach(d => {
              // Ensure consistent key format matching database view logic
              if(d.region) regionMap.set(d.code.toUpperCase().trim(), d.region);
          });

          const excluded: any[] = [];
          let totalExclCost = 0;

          approvedRequests.forEach(req => {
              const cost = req.totalFreightCost || req.price || 0;
              if (cost <= 0) return;

              const destCode = (req.destCode || req.destination || '').toUpperCase().trim();
              let region = regionMap.get(destCode);
              let reason = '';

              if (!destCode) {
                  reason = 'Missing Destination Code';
                  region = 'UNKNOWN';
              } else if (!region) {
                  reason = 'Code not in Master List';
                  region = 'OTHER';
              } else if (region === 'OTHER') {
                  reason = "Explicit 'OTHER' Region";
              } else {
                  // Region exists (e.g. CLEU, FBA, etc.)
                  // We must check if it maps to a valid main bucket
                  const validBuckets = ['CLEU', 'CLPL', 'CLI', 'CLCI']; 
                  if (!validBuckets.includes(region)) {
                      reason = `Mapped to ${region} (Merged)`;
                  }
              }

              // If we have a reason (meaning it's excluded from main buckets), add it
              if (reason) {
                  excluded.push({
                      id: req.id,
                      origin: req.origin,
                      destination: req.destination,
                      destCode: req.destCode,
                      region,
                      reason,
                      cost
                  });
                  totalExclCost += cost;
              }
          });

          setExclusionModal({ isOpen: true, quarter, shipments: excluded.sort((a,b) => b.cost - a.cost), totalExcluded: totalExclCost, loading: false });
      } catch (e) {
          console.error(e);
          error("Failed to analyze exclusions.");
          setExclusionModal(prev => ({ ...prev, isOpen: false }));
      }
  };

  const renderQuarterColumn = (q: string) => {
    const catData = CATEGORIES.map(c => getData(q, c.id));
    
    // Calculate hidden unmapped cost to maintain Total accuracy
    const qMap = autoCalculatedCosts.get(q);
    const unmappedCost = qMap ? ((qMap.get('OTHER') || 0) + (qMap.get('FBA') || 0)) : 0;

    let totalCost = unmappedCost; // Start with unmapped
    let totalRevenue = 0;

    catData.forEach(d => {
       // Sum cost for ALL categories except TARGET
       if (d.category !== 'TARGET') totalCost += (d.cost || 0);
       
       // Sum revenue for all categories
       if (d.category !== 'TARGET' && d.category !== 'INTER_PLANT') totalRevenue += (d.revenue || 0);
    });

    // Fix floating point issues for display
    totalCost = to2DP(totalCost);
    totalRevenue = to2DP(totalRevenue);
    const roundedUnmapped = to2DP(unmappedCost);

    const targetRow = getData(q, 'TARGET');
    const targetRev = targetRow.target_revenue || 0;
    const targetPct = targetRev > 0 ? (totalCost / targetRev) * 100 : 0;
    const totalPct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    return (
      <div key={q} className="min-w-[180px] w-[180px] border-r border-slate-200 flex-shrink-0 bg-white">
        <div className={`${HEADER_HEIGHT} bg-[#fce4d6] flex items-center justify-between px-2 font-bold text-slate-800 border-b border-slate-300 group relative`}>
          <span className="flex-1 text-center truncate">{q}</span>
          <button onClick={() => setDeleteModal({ show: true, quarter: q })} className="p-1.5 rounded transition-colors absolute right-1 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete Quarter Data"><Trash2 size={14} /></button>
        </div>

        {CATEGORIES.map(cat => {
            const data = getData(q, cat.id);
            // Updated: Also calculate for OTHER (merging FBA)
            let isCalculated = ['CLEU', 'CLPL', 'CLI', 'CLCI', 'OTHER'].includes(cat.id);
            if (isCalculated) {
                const hasQuarterData = !!qMap;
                if (!hasQuarterData) isCalculated = false;
            }

            if (cat.id === 'INTER_PLANT') {
                 return (
                    <div key={`${q}-${cat.id}`} className={`${ROW_HEIGHT} bg-[#fff2cc] border-b border-slate-200 px-2 flex items-center`}>
                         <div className="flex items-center bg-white border border-slate-300 rounded px-2 w-full h-[28px] focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                            <span className="text-slate-400 text-[10px] mr-1">$</span>
                            <input type="number" step="0.01" className="w-full text-right text-xs outline-none font-semibold bg-transparent" value={data.cost !== undefined ? data.cost : ''} onChange={e => handleUpdate(q, cat.id, 'cost', e.target.value)} />
                         </div>
                    </div>
                 );
            }
            if (cat.id === 'TARGET') return null;
            const pct = data.revenue > 0 ? (data.cost / data.revenue) * 100 : 0;

            const bgClass = cat.isOther ? 'bg-slate-50/50' : '';

            return (
                <div key={`${q}-${cat.id}`} className={`${CATEGORY_BLOCK_HEIGHT} border-b border-slate-200 px-2 flex flex-col justify-center ${bgClass}`}>
                    <div className={`${SUB_ROW_TITLE_HEIGHT} w-full`}></div>
                    <div className={`${SUB_ROW_INPUT_HEIGHT} flex items-center`}>
                        <div className={`flex items-center bg-white border ${isCalculated ? 'border-indigo-300 ring-1 ring-indigo-50' : 'border-slate-200'} rounded px-1 h-[28px] w-full relative group focus-within:border-indigo-500`}>
                            {isCalculated && <div className="absolute -left-1.5 -top-1.5 text-indigo-500 bg-white rounded-full shadow-sm border border-indigo-100"><Calculator size={10} /></div>}
                            <span className="text-slate-400 text-[10px] mr-1">$</span>
                            <input type="number" step="0.01" className="w-full text-right text-xs outline-none bg-transparent" value={data.cost !== undefined ? data.cost : ''} onChange={e => handleUpdate(q, cat.id, 'cost', e.target.value)} />
                        </div>
                    </div>
                    <div className={`${SUB_ROW_INPUT_HEIGHT} flex items-center`}>
                         <div className="flex items-center bg-white border border-slate-200 rounded px-1 h-[28px] w-full focus-within:border-indigo-500">
                            <span className="text-slate-400 text-[10px] mr-1">$</span>
                            <input type="number" step="0.01" className="w-full text-right text-xs outline-none bg-transparent" value={data.revenue !== undefined ? data.revenue : ''} onChange={e => handleUpdate(q, cat.id, 'revenue', e.target.value)} />
                        </div>
                    </div>
                    <div className={`${SUB_ROW_FOOTER_HEIGHT} flex justify-end items-center border-t border-slate-100`}>
                        <span className={`text-xs font-bold ${pct > 100 ? 'text-red-500' : 'text-indigo-600'}`}>{formatPercent(pct)}</span>
                    </div>
                </div>
            );
        })}

        <div className={`${ROW_HEIGHT} bg-yellow-300 border-b border-white px-2 flex items-center justify-between font-bold text-slate-900 text-sm`}>
            <button onClick={() => handleAnalyzeExclusions(q)} className="p-1 rounded-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 transition-colors opacity-50 hover:opacity-100 flex items-center gap-1" title="Check Unmapped Detail">
                <ListFilter size={12} />
                {roundedUnmapped > 0 && <span className="text-[9px] bg-red-500 text-white px-1 rounded-full">{formatCurrency(roundedUnmapped)}</span>}
            </button>
            <span>{formatCurrency(totalCost)}</span>
        </div>
        <div className={`${ROW_HEIGHT} bg-white border-b border-slate-200 px-2 flex items-center justify-end font-bold text-slate-900 text-sm`}>{formatCurrency(totalRevenue)}</div>
        <div className={`${ROW_HEIGHT} bg-[#e2efda] border-b border-slate-200 px-2 flex items-center justify-end font-bold text-green-800 text-sm`}>{formatPercent(totalPct)}</div>
        <div className={`${ROW_HEIGHT} bg-white border-b border-slate-200 px-2 flex items-center`}>
             <div className="flex items-center bg-white border border-slate-300 rounded px-2 w-full h-[28px] focus-within:border-indigo-500">
                <span className="text-slate-400 text-[10px] mr-1">$</span>
                <input type="number" step="0.01" className="w-full text-right text-xs outline-none font-semibold bg-transparent" value={targetRow.target_revenue !== undefined ? targetRow.target_revenue : ''} onChange={e => handleUpdate(q, 'TARGET', 'target_revenue', e.target.value)} />
             </div>
        </div>
        <div className={`${ROW_HEIGHT} bg-white px-2 flex items-center justify-end font-bold text-slate-900 text-sm`}>{formatPercent(targetPct)}</div>
      </div>
    );
  };

  if (loading) {
      return (
          <div className="flex flex-col h-full bg-white rounded-xl shadow border border-slate-200 overflow-hidden p-6 space-y-6">
              <div className="flex justify-between">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-8 w-32" />
              </div>
              <div className="flex gap-4">
                  <Skeleton className="h-96 w-48" />
                  <Skeleton className="h-96 w-48" />
                  <Skeleton className="h-96 w-48" />
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in bg-white rounded-xl shadow border border-slate-200 overflow-hidden relative">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={20} className="text-indigo-600"/> Cost vs Revenue Analysis</h2>
                <p className="text-xs text-slate-500">Manage financial targets. <span className="text-indigo-600 font-semibold"><Calculator size={10} className="inline mb-0.5"/> Costs</span> are auto-calculated from approved shipments.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => loadData()} disabled={loading} className="p-2 text-slate-500 hover:bg-slate-200 rounded transition-colors"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
                {!showAddQuarter ? (
                    <button onClick={() => setShowAddQuarter(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        <Plus size={16}/> Add Quarter
                    </button>
                ) : (
                    <div className="flex items-center gap-2 bg-white border border-indigo-200 p-1 rounded-lg animate-fade-in">
                        {!isManualInputMode && availableQuarters.length > 0 ? (
                           <div className="relative">
                               <select 
                                  autoFocus
                                  className="px-2 py-1 text-sm outline-none w-36 font-bold bg-transparent cursor-pointer appearance-none pr-6" 
                                  value={newQuarterName} 
                                  onChange={e => {
                                      if (e.target.value === 'MANUAL') {
                                          setIsManualInputMode(true);
                                          setNewQuarterName('');
                                      } else {
                                          setNewQuarterName(e.target.value);
                                      }
                                  }} 
                               >
                                   <option value="" disabled>Select Detected</option>
                                   {availableQuarters.map(q => <option key={q} value={q}>{q}</option>)}
                                   <option value="MANUAL" className="text-indigo-600 font-bold">+ Enter Manually...</option>
                               </select>
                               <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><X size={10} className="rotate-45" /></div>
                           </div>
                        ) : (
                           <input autoFocus type="text" placeholder="FY2026 Q3" className="px-2 py-1 text-sm outline-none w-36 uppercase font-bold" value={newQuarterName} onChange={e => setNewQuarterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuarter()} />
                        )}
                        {availableQuarters.length > 0 && <button onClick={() => { setIsManualInputMode(!isManualInputMode); setNewQuarterName(''); }} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title={isManualInputMode ? "Select from list" : "Type manually"}><Keyboard size={14} /></button>}
                        <button onClick={addQuarter} disabled={!newQuarterName} className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"><Plus size={14}/></button>
                        <button onClick={handleAddQuarterClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={14}/></button>
                    </div>
                )}
                <button onClick={saveChanges} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Changes
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar flex items-start">
            <div className="min-w-[200px] w-[200px] border-r-2 border-slate-300 flex-shrink-0 bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                 <div className={`${HEADER_HEIGHT} bg-slate-100 border-b border-slate-300 flex items-center px-4 font-bold text-slate-700 text-sm`}>Quarter / Total Cost</div>
                 {CATEGORIES.filter(c => !c.isTotal).map(c => (
                     <div key={c.id} className={`${CATEGORY_BLOCK_HEIGHT} border-b border-slate-200 flex flex-col justify-center px-4 ${c.isOther ? 'bg-slate-50/50 text-slate-600 italic' : ''}`}>
                         <div className={`${SUB_ROW_TITLE_HEIGHT} flex items-center font-bold text-sm ${c.isOther ? 'text-slate-500' : 'text-slate-800'}`}>{c.label}</div>
                         <div className={`${SUB_ROW_INPUT_HEIGHT} flex items-center text-xs text-slate-500`}>Total Cost</div>
                         <div className={`${SUB_ROW_INPUT_HEIGHT} flex items-center text-xs text-slate-500`}>Net Rev $ (USD)</div>
                         <div className={`${SUB_ROW_FOOTER_HEIGHT} flex items-center text-xs font-bold text-slate-700 border-t border-slate-200`}>Cost VS Rev (%)</div>
                     </div>
                 ))}
                 <div className={`${ROW_HEIGHT} bg-[#fff2cc] border-b border-slate-200 px-4 flex items-center text-xs font-bold text-slate-700`}>CLEU Est Inter-Plant cost</div>
                 <div className={`${ROW_HEIGHT} bg-yellow-300 border-b border-white px-4 flex items-center text-xs font-bold text-slate-900`}>Total Cost all charges</div>
                 <div className={`${ROW_HEIGHT} bg-white border-b border-slate-200 px-4 flex items-center text-xs font-medium text-slate-700`}>Net Rev $ (USD)</div>
                 <div className={`${ROW_HEIGHT} bg-[#e2efda] border-b border-slate-200 px-4 flex items-center text-xs font-bold text-green-800`}>Cost VS Rev (%)</div>
                 <div className={`${ROW_HEIGHT} bg-white border-b border-slate-200 px-4 flex items-center text-xs font-medium text-slate-700`}>Target Rev $ (USD)</div>
                 <div className={`${ROW_HEIGHT} bg-white px-4 flex items-center text-xs font-bold text-slate-900`}>Cost VS Rev (%)</div>
            </div>

            {quarters.map(q => renderQuarterColumn(q))}

            {quarters.length === 0 && (
                <div className="p-10 text-slate-400 italic flex items-center gap-2"><Info size={16}/> No financial records found. Click "Add Quarter" to start planning.</div>
            )}
        </div>

        {deleteModal.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2 size={24} /></div>
                        <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
                        <p className="text-sm text-slate-500 mt-2">Are you sure you want to delete <span className="font-bold text-slate-800">{deleteModal.quarter}</span>?</p>
                        <div className="flex gap-3 mt-6 justify-center">
                            <button onClick={() => setDeleteModal({ show: false, quarter: '' })} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {exclusionModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <AlertCircle size={20} className="text-amber-500" /> 
                                Unmapped Shipments ({exclusionModal.quarter})
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                These shipments are in the 'Unmapped / Other' category. Review the reason column to fix them.
                            </p>
                        </div>
                        <button onClick={() => setExclusionModal({ ...exclusionModal, isOpen: false })} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
                    </div>
                    
                    <div className="flex-1 overflow-auto custom-scrollbar p-0">
                        {exclusionModal.loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Loader2 size={32} className="animate-spin mb-2 text-indigo-500" />
                                <p>Analyzing shipment data...</p>
                            </div>
                        ) : exclusionModal.shipments.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3">Log ID</th>
                                        <th className="px-6 py-3">Destination</th>
                                        <th className="px-6 py-3">Reason for Unmapped Status</th>
                                        <th className="px-6 py-3 text-right">Cost (USD)</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {exclusionModal.shipments.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 font-mono font-medium text-indigo-600 flex items-center gap-2 group">
                                                {req.id}
                                                <button onClick={() => {navigator.clipboard.writeText(req.id); success("Copied ID");}} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 p-1"><Copy size={12} /></button>
                                            </td>
                                            <td className="px-6 py-3 text-slate-700">{req.destCode || req.destination || <span className="text-red-400 italic">Missing</span>}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                    req.reason.includes('Missing') ? 'bg-red-50 text-red-700 border-red-100' : 
                                                    req.reason.includes('Master List') ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {req.reason}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium text-slate-800">{formatCurrency(req.cost)}</td>
                                            <td className="px-6 py-3 text-right">
                                                <button onClick={() => { setExclusionModal({ ...exclusionModal, isOpen: false }); navigate(`/shipments/${req.id}`, { state: { from: 'financials' } }); }} className="text-indigo-600 hover:underline text-xs font-bold flex items-center justify-end gap-1">View <ExternalLink size={10} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4"><ListFilter size={32} /></div>
                                <p className="font-medium text-slate-600">No Unmapped Shipments Found</p>
                                <p className="text-sm">All approved shipments for {exclusionModal.quarter} are correctly categorized.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <HelpCircle size={16} className="text-slate-400" />
                            <span className="text-xs text-slate-500">Go to <strong>Locations</strong> to fix "Code not in Master List" errors.</span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-slate-500 uppercase font-bold mr-2">Total Unmapped Cost:</span>
                            <span className="text-lg font-bold text-amber-600">{formatCurrency(exclusionModal.totalExcluded)}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CostRevenuePage;
