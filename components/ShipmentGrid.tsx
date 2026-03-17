
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { FreightRequest, RequestStatus, User, FreightFilters } from '../types';
import { Database, Download, Search, Filter, X, Trash2, CheckSquare, Plane, Ship, Train, Truck, Copy, RefreshCw, Loader2 } from 'lucide-react';
import Pagination from './Pagination';
import { Skeleton } from './ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useLocation } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';

interface ShipmentGridProps {
  requests: FreightRequest[];
  onSelect: (req: FreightRequest) => void;
  onDelete: (ids: string[]) => void;
  onExport: () => void;
  onFixQuarters?: () => Promise<number>;
  loading: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onAdvancedFilterChange?: (filters: FreightFilters | undefined) => void;
  currentUser: User | null;
  initialFilters?: FreightFilters;
}

const getStatusClass = (status: RequestStatus) => {
    switch (status) {
        case RequestStatus.APPROVED: return 'bg-green-50 text-green-700 border-green-200';
        case RequestStatus.REJECTED: return 'bg-red-50 text-red-700 border-red-200';
        case RequestStatus.PENDING: case RequestStatus.PENDING_L2: case RequestStatus.FLAGGED: return 'bg-amber-50 text-amber-700 border-amber-200';
        case RequestStatus.CANCELLED: return 'bg-slate-100 text-slate-600 border-slate-200';
        default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
};

const ShipmentGrid: React.FC<ShipmentGridProps> = (props) => {
  const { 
    requests, onSelect, onDelete, onExport, onFixQuarters, loading, totalCount, currentPage, pageSize, onPageChange,
    statusFilter, onStatusFilterChange, searchTerm, onSearchTermChange, currentUser, onAdvancedFilterChange, initialFilters
  } = props;

  const { success, error } = useToast();
  const location = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showFilters, setShowFilters] = useState(!!initialFilters);
  const [filters, setFilters] = useState<FreightFilters>(initialFilters || {});
  
  // Highlighting State
  const [highlightId, setHighlightId] = useState<string | null>(null);
  
  // Fix Quarters State
  const [isFixingQuarters, setIsFixingQuarters] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isLogistics = currentUser?.role === 'LOGISTICS';

  // Dynamic Column Count Calculation
  let totalColumns = 10; // Increased base columns
  if (isSelectMode && isAdmin) totalColumns++;
  if (isLogistics) totalColumns++;

  // Virtualization Setup
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: loading ? 10 : requests.length, 
    getScrollElement: () => parentRef.current,
    estimateSize: () => 54, // Approximate row height
    overscan: 20, // Keep more rows rendered to help with scrolling accuracy
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [requests]);

  // SCROLL RESTORATION LOGIC
  useEffect(() => {
    // 1. Check if we have a target ID from navigation state
    const state = location.state as { lastId?: string } | null;
    const targetId = state?.lastId;

    // 2. Only proceed if data is loaded, we have data, and a target ID exists
    if (!loading && requests.length > 0 && targetId) {
        
        const index = requests.findIndex(r => r.id === targetId);
        
        if (index !== -1) {
            setHighlightId(targetId);
            
            // 3. Hybrid Scroll Approach:
            // First, use virtualizer to ensure the row is rendered in the DOM.
            // Then, use native scrollIntoView for precise positioning relative to sticky headers.
            const timer = setTimeout(() => {
                try {
                    // Step A: Tell virtualizer to scroll to the index. 
                    // 'center' is safest to avoid getting stuck under sticky headers.
                    rowVirtualizer.scrollToIndex(index, { align: 'center' });
                    
                    // Step B: Fine-tune with native scroll after a microtask to allow render
                    requestAnimationFrame(() => {
                        const el = document.getElementById(`row-${targetId}`);
                        if (el) {
                            el.scrollIntoView({ block: 'center', behavior: 'auto' });
                        }
                    });
                } catch (e) {
                    console.warn("Scroll restoration failed", e);
                }
            }, 200); // 200ms delay to ensure full render/layout calculation

            return () => clearTimeout(timer);
        }
    }
  }, [loading, requests, location.state, rowVirtualizer]);

  // Debounced Filter Change
  useEffect(() => {
    if (onAdvancedFilterChange) {
      const timer = setTimeout(() => {
        const activeFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '')
        );
        onAdvancedFilterChange(Object.keys(activeFilters).length > 0 ? activeFilters : undefined);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [filters, onAdvancedFilterChange]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedIds(new Set(requests.map(r => r.id)));
    } else {
        setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectMode = () => {
      const newMode = !isSelectMode;
      setIsSelectMode(newMode);
      if (!newMode) setSelectedIds(new Set());
  };

  const handleFilterChange = (key: keyof FreightFilters, value: string) => {
      setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
      setFilters({});
      onSearchTermChange('');
      onStatusFilterChange('ALL');
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      navigator.clipboard.writeText(id);
      success("Log ID copied");
  };

  const handleFixQuarters = async () => {
      if (!onFixQuarters) return;
      setIsFixingQuarters(true);
      try {
          const count = await onFixQuarters();
          success(`Successfully regenerated quarters for ${count} shipments.`);
      } catch (e) {
          error("Failed to fix quarters.");
      } finally {
          setIsFixingQuarters(false);
      }
  };

  const getTransportIcon = (method?: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('air')) return <Plane size={12} />;
    if (m.includes('rail')) return <Train size={12} />;
    if (m.includes('sea')) return <Ship size={12} />;
    return <Truck size={12} />;
  };

  const isAllSelected = requests.length > 0 && selectedIds.size === requests.length;
  const isAnythingSelected = selectedIds.size > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Shipment Data Master</h2>
                    <p className="text-sm text-slate-500">Comprehensive view of all historical shipment records.</p>
                </div>
                
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {isAdmin && (
                        <button onClick={toggleSelectMode} className={`p-2 rounded-lg border transition-colors ${isSelectMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`} title="Selection Mode"><CheckSquare size={20} /></button>
                    )}

                    {isAdmin && isSelectMode && isAnythingSelected && (
                        <button onClick={() => onDelete(Array.from(selectedIds))} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm text-sm font-medium whitespace-nowrap animate-fade-in"><Trash2 size={16} /> Delete ({selectedIds.size})</button>
                    )}

                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-lg transition-colors shadow-sm text-sm font-medium whitespace-nowrap ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Filter size={16} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>

                    {statusFilter === 'MISSING_QUARTER' && isAdmin && onFixQuarters && (
                        <button 
                            onClick={handleFixQuarters} 
                            disabled={isFixingQuarters}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors shadow-sm text-sm font-bold whitespace-nowrap disabled:opacity-50"
                        >
                            {isFixingQuarters ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Fix Quarters
                        </button>
                    )}

                    <button onClick={onExport} disabled={totalCount === 0 || loading} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"><Download size={16} /> <span className="hidden sm:inline">Export</span></button>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative z-10">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Global Search (Log No, Tracking Ref, Origin...)" className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" value={searchTerm} onChange={(e) => onSearchTermChange(e.target.value)} />
                        {searchTerm && (<button onClick={() => onSearchTermChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>)}
                    </div>

                    <div className="relative w-full md:w-auto">
                        <select className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-slate-50 min-w-[140px]" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
                            <option value="ALL">All Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="FLAGGED">Flagged</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="MISSING_COST">Missing Cost</option>
                            <option value="MISSING_QUARTER">Missing Quarter</option>
                        </select>
                        <Filter className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                    
                    {(Object.values(filters).some(Boolean) || searchTerm || statusFilter !== 'ALL') && (
                        <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-700 whitespace-nowrap px-2">Clear All</button>
                    )}
                </div>
            </div>
        </div>
        
        {/* Virtualized Table Container */}
        <div ref={parentRef} className="flex-1 overflow-auto custom-scrollbar relative bg-white">
            <table className="w-full text-left border-collapse text-sm min-w-[1200px]" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                <thead className="bg-white sticky top-0 z-20 shadow-sm">
                    <tr>
                        {isSelectMode && isAdmin && (
                            <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 bg-slate-50 w-10 text-center animate-fade-in"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} /></th>
                        )}
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50 sticky left-0 z-20 md:static">Log No.</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Status</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Method</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Quarter</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Origin</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Destination</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Forwarder</th>
                        {isLogistics && (
                            <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Tracking Ref</th>
                        )}
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">Requestor</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap bg-slate-50">ETA / ATA</th>
                        <th className="px-4 py-3 font-semibold text-slate-600 border-b border-slate-200 whitespace-nowrap text-right bg-slate-50">Total Cost (USD)</th>
                    </tr>
                    
                    {showFilters && (
                        <tr className="bg-slate-50 animate-fade-in">
                            {isSelectMode && isAdmin && <th className="border-b border-slate-200 bg-slate-50"></th>}
                            <th className="p-1 border-b border-slate-200 sticky left-0 z-20 md:static bg-slate-50"><input type="text" placeholder="Filter Log ID..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.id || ''} onChange={(e) => handleFilterChange('id', e.target.value)} /></th>
                            <th className="p-1 border-b border-slate-200 text-xs font-normal text-slate-400 italic text-center">Use Top Filter</th>
                            <th className="p-1 border-b border-slate-200"><input type="text" placeholder="Sea/Air..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.mode || ''} onChange={(e) => handleFilterChange('mode', e.target.value)} /></th>
                            <th className="p-1 border-b border-slate-200"><input type="text" placeholder="FY24 Q1..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.quarter || ''} onChange={(e) => handleFilterChange('quarter', e.target.value)} /></th>
                            <th className="p-1 border-b border-slate-200"><input type="text" placeholder="Name or Code..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.origin || ''} onChange={(e) => handleFilterChange('origin', e.target.value)} /></th>
                            <th className="p-1 border-b border-slate-200"><input type="text" placeholder="Name or Code..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.destination || ''} onChange={(e) => handleFilterChange('destination', e.target.value)} /></th>
                            <th className="p-1 border-b border-slate-200"><input type="text" placeholder="Filter Forwarder..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.forwarder || ''} onChange={(e) => handleFilterChange('forwarder', e.target.value)} /></th>
                            {isLogistics && <th className="p-1 border-b border-slate-200"></th>}
                            <th className="p-1 border-b border-slate-200"><input type="text" placeholder="Filter..." className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-normal" value={filters.requester || ''} onChange={(e) => handleFilterChange('requester', e.target.value)} /></th>
                            <th className="p-1 border-b border-slate-200"></th>
                            <th className="p-1 border-b border-slate-200 text-right"></th>
                        </tr>
                    )}
                </thead>
                <tbody className="divide-y divide-slate-100 relative">
                    {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                            <tr key={i}><td colSpan={totalColumns} className="px-4 py-3"><Skeleton className="h-6 w-full rounded" /></td></tr>
                        ))
                    ) : requests.length > 0 ? (
                        <>
                            {rowVirtualizer.getVirtualItems().length > 0 && (
                                <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}>
                                    <td colSpan={totalColumns} />
                                </tr>
                            )}
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const req = requests[virtualRow.index];
                                const isHighlighted = highlightId === req.id;
                                const rowBaseClass = virtualRow.index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                                
                                // Styles for Highlight Effect (Using Box Shadow on Cells to avoid Border Collapse issues)
                                const cellCommon = {
                                    position: 'relative' as const, // Important for z-index
                                    zIndex: isHighlighted ? 10 : 1,
                                    backgroundColor: isHighlighted ? '#eef2ff' : undefined,
                                };

                                const firstCellStyle = isHighlighted ? { 
                                    ...cellCommon,
                                    boxShadow: 'inset 3px 0 0 #4f46e5, inset 0 2px 0 #4f46e5, inset 0 -2px 0 #4f46e5' // Left, Top, Bottom
                                } : {};

                                const middleCellStyle = isHighlighted ? { 
                                    ...cellCommon,
                                    boxShadow: 'inset 0 2px 0 #4f46e5, inset 0 -2px 0 #4f46e5' // Top, Bottom
                                } : {};

                                const lastCellStyle = isHighlighted ? { 
                                    ...cellCommon,
                                    boxShadow: 'inset -3px 0 0 #4f46e5, inset 0 2px 0 #4f46e5, inset 0 -2px 0 #4f46e5' // Right, Top, Bottom
                                } : {};
                                
                                return (
                                    <tr 
                                        key={req.id}
                                        data-index={virtualRow.index}
                                        ref={rowVirtualizer.measureElement}
                                        id={`row-${req.id}`}
                                        className={`
                                            hover:bg-indigo-50/50 transition-colors cursor-pointer 
                                            ${rowBaseClass} 
                                            ${selectedIds.has(req.id) && !isHighlighted ? 'bg-indigo-50' : ''}
                                            ${isHighlighted ? 'font-medium' : ''}
                                        `}
                                        onClick={(e) => { 
                                            if (isSelectMode && isAdmin) {
                                                handleSelectOne(req.id);
                                            } else {
                                                onSelect(req); 
                                            }
                                        }}
                                    >
                                        {isSelectMode && isAdmin && (
                                            <td className={`px-4 py-3 whitespace-nowrap text-center animate-fade-in ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={firstCellStyle} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedIds.has(req.id)} onChange={() => handleSelectOne(req.id)} /></td>
                                        )}
                                        <td className={`px-4 py-3 whitespace-nowrap font-medium text-slate-700 sticky left-0 z-10 md:static ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={!isSelectMode || !isAdmin ? firstCellStyle : middleCellStyle}>
                                            <div className="flex items-center gap-2 group/id">
                                                <span>{req.id}</span>
                                                <button 
                                                    onClick={(e) => handleCopyId(e, req.id)} 
                                                    className="opacity-0 group-hover/id:opacity-100 text-slate-400 hover:text-indigo-600 transition-all p-1 rounded-full hover:bg-slate-100"
                                                    title="Copy Log ID"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}><span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${getStatusClass(req.status)}`}>{req.status}</span></td>
                                        <td className={`px-4 py-3 whitespace-nowrap ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}><div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-fit">{getTransportIcon(req.shippingMethod)}{req.shippingMethod}</div></td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-slate-600 font-semibold text-xs ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}>{req.quarter || '-'}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-slate-700 ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle} title={req.origin}>{req.originCode || req.origin}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-slate-700 ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle} title={req.destination}>{req.destCode || req.destination}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-slate-700 ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}>{req.forwarder}</td>
                                        {isLogistics && (
                                            <td className={`px-4 py-3 whitespace-nowrap text-slate-700 font-mono text-xs ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}>
                                                {(() => {
                                                    const method = (req.shippingMethod || '').toLowerCase();
                                                    if (method.includes('air')) return req.blAwb || <span className="text-slate-400">-</span>;
                                                    return req.containerNumber || <span className="text-slate-400">-</span>;
                                                })()}
                                            </td>
                                        )}
                                        <td className={`px-4 py-3 whitespace-nowrap text-slate-700 ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}>{req.requester}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-slate-700 ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={middleCellStyle}>
                                            {req.ata ? (
                                                <span className="text-emerald-600 font-bold" title="Actual Arrival">{new Date(req.ata).toLocaleDateString()}</span>
                                            ) : (
                                                req.eta ? new Date(req.eta).toLocaleDateString() : '-'
                                            )}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-right ${isHighlighted ? '' : 'border-b border-slate-200'}`} style={lastCellStyle}><div className="flex flex-col items-end"><span className="font-semibold text-slate-700">{req.totalFreightCost ? `$${req.totalFreightCost.toLocaleString()}` : (req.price ? `$${req.price.toLocaleString()}` : '-')}</span>{req.totalFreightCost ? (<span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 rounded border border-green-100 uppercase tracking-wide">Actual</span>) : req.price ? (<span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded border border-amber-100 uppercase tracking-wide">Est.</span>) : null}</div></td>
                                    </tr>
                                );
                            })}
                            {rowVirtualizer.getVirtualItems().length > 0 && (
                                <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }}>
                                    <td colSpan={totalColumns} />
                                </tr>
                            )}
                        </>
                    ) : (
                        <tr><td colSpan={totalColumns} className="px-6 py-12 text-center text-slate-500"><div className="flex flex-col items-center gap-3"><Database className="text-slate-300" size={32} /><p className="font-medium text-slate-600">No matching records found.</p><p className="text-xs text-slate-400">Try adjusting your search terms or filters.</p></div></td></tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <Pagination currentPage={currentPage} totalCount={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
    </div>
  )
}

export default ShipmentGrid;
