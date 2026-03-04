
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label, LabelList } from 'recharts';
import { DashboardData, DestinationRowData } from '../types';
import { TrendingUp, AlertTriangle, CheckCircle, Clock, Calendar, DollarSign, Package, XCircle, Percent, ArrowUp, ArrowDown, ClipboardList, Timer, Search, X, Ship, Plane, Train, Maximize2, Minimize2, MoveLeft } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import { useNavigate } from 'react-router-dom';

// New Components
import CostRevenueGauge from './dashboard/CostRevenueGauge';
import SeaShipmentTable from './dashboard/SeaShipmentTable';
import AirShipmentTable from './dashboard/AirShipmentTable';

interface DashboardProps {
  dashboardData: DashboardData | null;
  onFilterClick?: (status: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const Dashboard: React.FC<DashboardProps> = ({ dashboardData, onFilterClick }) => {
  const navigate = useNavigate();
  const [selectedFinQuarter, setSelectedFinQuarter] = useState<string>('');
  const [chartMetric, setChartMetric] = useState<'cost' | 'count'>('cost');
  const [showSeaBreakdown, setShowSeaBreakdown] = useState(false);
  const [showAirBreakdown, setShowAirBreakdown] = useState(false);

  // Transit Chart Filtering State
  const [selectedTransitDests, setSelectedTransitDests] = useState<string[]>([]);
  const [transitSearchTerm, setTransitSearchTerm] = useState('');
  const [isTransitSearchOpen, setIsTransitSearchOpen] = useState(false);
  const [activeTransitMode, setActiveTransitMode] = useState<'ALL' | 'Sea' | 'Air' | 'Rail'>('Sea'); // Default to Sea as it is most common
  const transitSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (transitSearchRef.current && !transitSearchRef.current.contains(event.target as Node)) {
            setIsTransitSearchOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (dashboardData?.financials?.quarter) {
        setSelectedFinQuarter(dashboardData.financials.quarter);
    }
  }, [dashboardData]);

  // Use Memo for expensive data processing to prevent lag during renders
  const processedData = useMemo(() => {
    if (!dashboardData) return null;
    
    const { stats, charts, destinationBreakdown, airBreakdown, financials, allFinancials } = dashboardData;
    const { currentQuarterStats } = stats;

    const currentQLabel = `FY${currentQuarterStats.fiscalYear} Q${currentQuarterStats.quarter}`;
    const getPrevQLabel = (fy: number, q: number) => {
      if (q === 1) return `FY${fy - 1} Q4`;
      return `FY${fy} Q${q - 1}`;
    };
    const prevQLabel = getPrevQLabel(currentQuarterStats.fiscalYear, currentQuarterStats.quarter);
    const lastYearQLabel = `FY${currentQuarterStats.fiscalYear - 1} Q${currentQuarterStats.quarter}`;

    // --- BREAKDOWN CATEGORIZATION LOGIC ---
    // Rule: FBA is determined by Destination Code prefix regardless of financial mapping.
    const isFbaRow = (row: DestinationRowData) => row.destination.toUpperCase().startsWith('FBA');

    // Filter Arrays
    const fba = destinationBreakdown.filter(b => isFbaRow(b));
    const nonFbaSea = destinationBreakdown.filter(b => !isFbaRow(b));

    const fbaAir = airBreakdown.filter(b => isFbaRow(b));
    const nonFbaAir = airBreakdown.filter(b => !isFbaRow(b));

    // Sea breakdowns (using nonFbaSea source)
    const cleuSea = nonFbaSea.filter(b => b.category === 'CLEU' && !b.isRail);
    const cleuRail = nonFbaSea.filter(b => b.category === 'CLEU' && b.isRail);
    const clpl = nonFbaSea.filter(b => b.category === 'CLPL');
    const cli = nonFbaSea.filter(b => b.category === 'CLI');
    const clci = nonFbaSea.filter(b => b.category === 'CLCI');
    const cliLegacy = nonFbaSea.filter(b => b.category === 'CLI / CLCI');
    const other = nonFbaSea.filter(b => !['CLEU', 'CLPL', 'CLI', 'CLCI', 'CLI / CLCI', 'FBA'].includes(b.category));

    // Air breakdowns (using nonFbaAir source)
    const cleuAir = nonFbaAir.filter(b => b.category === 'CLEU');
    const clplAir = nonFbaAir.filter(b => b.category === 'CLPL');
    const cliAir = nonFbaAir.filter(b => b.category === 'CLI');
    const clciAir = nonFbaAir.filter(b => b.category === 'CLCI');
    const cliLegacyAir = nonFbaAir.filter(b => b.category === 'CLI / CLCI');
    const otherAir = nonFbaAir.filter(b => !['CLEU', 'CLPL', 'CLI', 'CLCI', 'CLI / CLCI', 'FBA'].includes(b.category));

    const activeAirRows = airBreakdown.filter(r => r.current.weight > 0 && r.current.cost > 0);
    let airMin = 0, airMax = 0;
    if (activeAirRows.length > 0) {
        const rates = activeAirRows.map(r => r.current.cost / r.current.weight);
        airMin = Math.min(...rates);
        airMax = Math.max(...rates);
    }

    const calculateGlobalTotal = (period: 'current' | 'previous' | 'lastYear') => {
      let count = 0;
      let cost = 0;
      let weight = 0;

      destinationBreakdown.forEach(r => {
          count += r[period].count;
          cost += r[period].cost;
          weight += r[period].weight;
      });

      airBreakdown.forEach(r => {
          count += r[period].count;
          cost += r[period].cost;
          weight += r[period].weight;
      });

      return { count, cost, weight };
    };

    const globalCurrent = calculateGlobalTotal('current');
    const globalPrevious = calculateGlobalTotal('previous');
    const globalLastYear = calculateGlobalTotal('lastYear');

    // Growth Rate Calculations (Comparison with Previous Quarter)
    const volumeGrowth = globalPrevious.count > 0 
        ? ((globalCurrent.count - globalPrevious.count) / globalPrevious.count) * 100 
        : 0;
    
    const costGrowth = globalPrevious.cost > 0
        ? ((globalCurrent.cost - globalPrevious.cost) / globalPrevious.cost) * 100
        : 0;

    // Calculate Average Cost Growth
    const currentAvg = globalCurrent.count > 0 ? globalCurrent.cost / globalCurrent.count : 0;
    const previousAvg = globalPrevious.count > 0 ? globalPrevious.cost / globalPrevious.count : 0;
    
    const avgGrowth = previousAvg > 0 
        ? ((currentAvg - previousAvg) / previousAvg) * 100 
        : 0;

    return {
       stats, charts, destinationBreakdown, airBreakdown, financials, allFinancials,
       currentQLabel, prevQLabel, lastYearQLabel,
       cleuSea, cleuRail, clpl, cli, clci, cliLegacy, fba, other,
       cleuAir, clplAir, cliAir, clciAir, cliLegacyAir, fbaAir, otherAir,
       activeAirRows, airMin, airMax,
       globalCurrent, globalPrevious, globalLastYear,
       volumeGrowth, costGrowth, avgGrowth
    };
  }, [dashboardData]);

  // Quarterly Chart Data Logic
  const filteredTrendData = useMemo(() => {
      if (!dashboardData?.charts?.trendData) return [];
      // Filter for FY data only
      const validData = dashboardData.charts.trendData.filter(d => d.name && d.name !== 'N/A' && d.name.startsWith('FY'));
      // Default to Last 3 Quarters for widget
      return validData.slice(-3);
  }, [dashboardData]);

  if (!dashboardData || !processedData) {
    return (
        <div className="space-y-6 p-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <Skeleton className="h-32 w-full rounded-xl" />
             <Skeleton className="h-32 w-full rounded-xl" />
             <Skeleton className="h-32 w-full rounded-xl" />
             <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <Skeleton className="h-80 w-full rounded-xl" />
             <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
    );
  }

  // Destructure processed data
  const { 
    stats, charts, destinationBreakdown, airBreakdown, financials, allFinancials,
    currentQLabel, prevQLabel, lastYearQLabel,
    cleuSea, cleuRail, clpl, cli, clci, cliLegacy, fba, other,
    cleuAir, clplAir, cliAir, clciAir, cliLegacyAir, fbaAir, otherAir,
    activeAirRows, airMin, airMax,
    globalCurrent, globalPrevious, globalLastYear,
    volumeGrowth, costGrowth, avgGrowth
  } = processedData;

  const { pendingCount, approvedCount, rejectedCount, cancelledCount, currentQuarterStats, missingCostCount, missingQuarterCount } = stats;
  const { transitAnalysis } = charts;

  const today = new Date().toLocaleDateString('en-GB');

  const activeQuarter = selectedFinQuarter || financials?.quarter;
  const activeGaugeData = allFinancials?.find(f => f.quarter === activeQuarter) || financials;

  // Filter Transit Analysis based on Mode
  const modeFilteredTransitAnalysis = transitAnalysis.filter(item => {
      if (activeTransitMode === 'ALL') return true;
      return item.mode === activeTransitMode;
  });

  // Derived Transit Data for Display
  const displayedTransitAnalysis = selectedTransitDests.length > 0 
      ? modeFilteredTransitAnalysis.filter(d => selectedTransitDests.includes(d.destination))
      : modeFilteredTransitAnalysis.slice(0, 15); // Default to Top 15 if no filter

  const transitOptions = modeFilteredTransitAnalysis
      .filter(d => !selectedTransitDests.includes(d.destination))
      .filter(d => d.destination.toLowerCase().includes(transitSearchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      
      {/* 1. Header Stats */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 shadow-md text-white animate-card-fly-in">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-3">
          <Calendar className="text-indigo-400" size={20} />
          <h2 className="text-lg font-bold">
            Performance: Fiscal Quarter {currentQuarterStats.quarter} (FY{currentQuarterStats.fiscalYear.toString().slice(-2)})
            <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">Approved Only</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                <Package size={24} className="text-blue-300" />
             </div>
             <div>
                <p className="text-slate-400 text-sm font-medium">Approved Shipments</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold">{currentQuarterStats.count}</h3>
                    <div className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full ${volumeGrowth >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {volumeGrowth >= 0 ? <ArrowUp size={10} className="mr-0.5" /> : <ArrowDown size={10} className="mr-0.5" />}
                        {Math.abs(volumeGrowth).toFixed(1)}%
                    </div>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                <DollarSign size={24} className="text-emerald-300" />
             </div>
             <div>
                <p className="text-slate-400 text-sm font-medium">Total Cost (Approved)</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold">{formatCurrency(currentQuarterStats.cost)}</h3>
                    <div className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full ${costGrowth >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {costGrowth >= 0 ? <ArrowUp size={10} className="mr-0.5" /> : <ArrowDown size={10} className="mr-0.5" />}
                        {Math.abs(costGrowth).toFixed(1)}%
                    </div>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                <TrendingUp size={24} className="text-amber-300" />
             </div>
             <div>
                <p className="text-slate-400 text-sm font-medium">Avg. Cost / Shipment</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold">{formatCurrency(currentQuarterStats.avg)}</h3>
                    <div className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full ${avgGrowth > 0 ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {avgGrowth >= 0 ? <ArrowUp size={10} className="mr-0.5" /> : <ArrowDown size={10} className="mr-0.5" />}
                        {Math.abs(avgGrowth).toFixed(1)}%
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 animate-card-fly-in delay-100">
        <div 
          onClick={() => onFilterClick && onFilterClick('PENDING')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 group-hover:text-amber-600 transition-colors">Pending Approval</p>
              <h3 className="text-2xl font-bold text-slate-900">{pendingCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Requires immediate attention</p>
        </div>

        <div 
          onClick={() => onFilterClick && onFilterClick('APPROVED')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 group-hover:text-green-600 transition-colors">Approved (Total)</p>
              <h3 className="text-2xl font-bold text-slate-900">{approvedCount}</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Smooth operations</p>
        </div>

        <div 
          onClick={() => onFilterClick && onFilterClick('REJECTED')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 group-hover:text-red-600 transition-colors">Rejected</p>
              <h3 className="text-2xl font-bold text-slate-900">{rejectedCount}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Mainly due to high cost</p>
        </div>
        
        <div 
          onClick={() => onFilterClick && onFilterClick('CANCELLED')}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 group-hover:text-slate-600 transition-colors">Cancelled</p>
              <h3 className="text-2xl font-bold text-slate-900">{cancelledCount}</h3>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
              <XCircle size={24} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Voided by users</p>
        </div>

        {/* Data Quality Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 group relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-500 group-hover:text-orange-600 transition-colors">Data Anomalies</p>
              <h3 className="text-2xl font-bold text-slate-900">{(missingCostCount || 0) + (missingQuarterCount || 0)}</h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
              <ClipboardList size={24} />
            </div>
          </div>
          <div className="space-y-1">
             <button 
                onClick={() => onFilterClick && onFilterClick('MISSING_COST')}
                className="w-full flex justify-between items-center text-xs text-slate-500 hover:text-orange-600 hover:bg-orange-50 p-1 rounded transition-colors"
             >
                <span>Missing Cost</span>
                <span className="font-bold">{missingCostCount || 0}</span>
             </button>
             <button 
                onClick={() => onFilterClick && onFilterClick('MISSING_QUARTER')}
                className="w-full flex justify-between items-center text-xs text-slate-500 hover:text-orange-600 hover:bg-orange-50 p-1 rounded transition-colors"
             >
                <span>Missing Quarter</span>
                <span className="font-bold">{missingQuarterCount || 0}</span>
             </button>
          </div>
          <div className="absolute top-0 right-0 w-1.5 h-full bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>

      {/* 3. Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-card-fly-in delay-200">
        
        {/* Trend Chart (Widget) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
          <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 gap-3 flex-shrink-0">
             <div className="flex flex-col">
                 <h4 className="font-semibold text-slate-800 text-lg">Quarterly Breakdown</h4>
                 <p className="text-xs text-slate-500">{chartMetric === 'cost' ? 'Total Spending' : 'Shipment Count'}</p>
             </div>
             
             <div className="flex flex-col gap-2 items-end">
                 <div className="flex items-center gap-2 flex-wrap justify-end">
                     {/* Metric Toggle */}
                     <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold shadow-inner">
                        <button 
                          onClick={() => setChartMetric('count')}
                          className={`px-3 py-1.5 rounded-md transition-all ${chartMetric === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Count
                        </button>
                        <button 
                          onClick={() => setChartMetric('cost')}
                          className={`px-3 py-1.5 rounded-md transition-all ${chartMetric === 'cost' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Cost ($)
                        </button>
                     </div>

                     {/* Expand Button -> Navigates to dedicated page */}
                     <button 
                        onClick={() => navigate('/trends')}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="View Full Screen Analysis"
                     >
                        <Maximize2 size={18} />
                     </button>
                 </div>
             </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} 
                  dy={10} 
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{fill: '#64748b', fontSize: 11}} 
                   tickFormatter={(val) => chartMetric === 'cost' ? `$${val/1000}k` : val} 
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                     const isCost = chartMetric === 'cost';
                     const formattedVal = isCost 
                        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                        : value;
                     let label = name;
                     
                     if (name.includes('20')) label = "20'";
                     else if (name.includes('40HC')) label = "40HC";
                     else if (name.includes('40')) label = "40'";
                     else if (name.includes('Air')) label = "Air";
                     
                     return [formattedVal, label];
                  }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                
                <Bar dataKey={chartMetric === 'cost' ? '20_cost' : '20_count'} name="20'" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey={chartMetric === 'cost' ? '40_cost' : '40_count'} name="40'" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey={chartMetric === 'cost' ? '40HC_cost' : '40HC_count'} name="40HC" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey={chartMetric === 'cost' ? 'Air_cost' : 'Air_count'} name="Air" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold text-slate-800">Cost vs Revenue</h4>
            <div className="flex items-center gap-2">
                 {dashboardData?.allFinancials && dashboardData.allFinancials.length > 0 && (
                     <select 
                        value={selectedFinQuarter}
                        onChange={(e) => setSelectedFinQuarter(e.target.value)}
                        className="text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:border-indigo-500 font-medium text-slate-600"
                     >
                        {dashboardData.allFinancials.map(f => (
                            <option key={f.quarter} value={f.quarter}>{f.quarter}</option>
                        ))}
                     </select>
                 )}
                <div className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    <Percent size={12} /> Margin Analysis
                </div>
            </div>
          </div>
          
          <div className="h-auto">
             {activeGaugeData ? (
                 <CostRevenueGauge activeData={activeGaugeData} />
             ) : (
                 <div className="flex items-center justify-center h-full text-slate-400 italic">No financial data available.</div>
             )}
          </div>
        </div>
      </div>

      {/* 4. Transit Analysis Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-card-fly-in delay-200 overflow-visible">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Timer size={20} className="text-purple-500" />
                  Average Transit Time by Destination
              </h4>
              
              <div className="flex flex-col gap-2 items-end">
                  <div className="flex items-center gap-2">
                      <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold shadow-inner">
                          {(['Sea', 'Air', 'Rail', 'All'] as const).map(mode => (
                              <button
                                  key={mode}
                                  onClick={() => setActiveTransitMode(mode === 'All' ? 'ALL' : mode)}
                                  className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                                      (mode === 'All' && activeTransitMode === 'ALL') || activeTransitMode === mode
                                      ? 'bg-white text-indigo-600 shadow-sm' 
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                              >
                                  {mode === 'Sea' && <Ship size={12} />}
                                  {mode === 'Air' && <Plane size={12} />}
                                  {mode === 'Rail' && <Train size={12} />}
                                  {mode}
                              </button>
                          ))}
                      </div>

                      {/* Destination Filter Dropdown */}
                      <div className="relative" ref={transitSearchRef}>
                          <div className="flex items-center border border-slate-200 rounded-lg bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 shadow-sm transition-all w-full md:w-56">
                              <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                              <input 
                                  type="text" 
                                  placeholder="Compare destination..." 
                                  className="text-xs outline-none w-full bg-transparent font-medium"
                                  value={transitSearchTerm}
                                  onChange={e => { setTransitSearchTerm(e.target.value); setIsTransitSearchOpen(true); }}
                                  onFocus={() => setIsTransitSearchOpen(true)}
                              />
                          </div>
                          
                          {isTransitSearchOpen && (
                              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto custom-scrollbar animate-fade-in-up">
                                  {transitOptions.length > 0 ? transitOptions.map(opt => (
                                      <button 
                                          key={`${opt.destination}-${opt.mode}`}
                                          onClick={() => {
                                              setSelectedTransitDests(prev => [...prev, opt.destination]);
                                              setTransitSearchTerm('');
                                              setIsTransitSearchOpen(false);
                                          }}
                                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 text-slate-700 flex justify-between items-center border-b border-slate-50 last:border-0"
                                      >
                                          <span className="font-semibold">{opt.destination}</span>
                                          <span className="text-slate-400 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{opt.avgTotal} days</span>
                                      </button>
                                  )) : (
                                      <div className="px-3 py-4 text-xs text-slate-400 text-center italic">No matching destinations found for {activeTransitMode}.</div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Selected Chips */}
                  {selectedTransitDests.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 justify-end max-w-lg">
                          {selectedTransitDests.map(d => (
                              <span key={d} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md px-2 py-1 text-[10px] font-bold shadow-sm animate-fade-in">
                                  {d}
                                  <button onClick={() => setSelectedTransitDests(selectedTransitDests.filter(x => x !== d))} className="hover:text-indigo-900 bg-white/50 rounded-full p-0.5"><X size={10} /></button>
                              </span>
                          ))}
                          <button onClick={() => setSelectedTransitDests([])} className="text-[10px] text-slate-400 hover:text-red-500 ml-1 underline underline-offset-2">Clear All</button>
                      </div>
                  ) : (
                      <div className="text-xs text-slate-400 font-medium italic bg-slate-50 px-2 py-1 rounded border border-slate-100">Showing Top 15 {activeTransitMode !== 'ALL' ? activeTransitMode : ''} Routes</div>
                  )}
              </div>
          </div>

          <div className="h-80 w-full">
              {displayedTransitAnalysis && displayedTransitAnalysis.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                          data={displayedTransitAnalysis} 
                          layout="vertical"
                          margin={{ top: 5, right: 60, left: 20, bottom: 40 }}
                          barCategoryGap={10}
                      >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" hide={false} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}}>
                             <Label value="Avg Transit Days" position="insideBottom" offset={-10} fill="#64748b" fontSize={11} fontWeight={600} />
                          </XAxis>
                          <YAxis 
                              dataKey="destination" 
                              type="category" 
                              axisLine={false} 
                              tickLine={false}
                              width={70}
                              tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} 
                          >
                             <Label value="Destination" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="#64748b" fontSize={11} fontWeight={600} offset={10} />
                          </YAxis>
                          <Tooltip 
                              cursor={{fill: '#f8fafc'}}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number, name: string, props: any) => [`${value} Days`, name]}
                              labelFormatter={(label, payload) => {
                                  if (payload && payload.length > 0) {
                                      const data = payload[0].payload;
                                      return `${label} (${data.mode})`;
                                  }
                                  return label;
                              }}
                          />
                          <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '20px'}} />
                          
                          <Bar dataKey="avgOrigin" name="Origin (Pre)" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} barSize={20} />
                          <Bar dataKey="avgVessel" name="Main Carriage" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} barSize={20} />
                          <Bar dataKey="avgDest" name="Dest (Post)" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                              <LabelList dataKey="avgTotal" position="right" offset={10} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#475569' }} formatter={(val: any) => `${val} d`} />
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 italic">
                      No transit data available for {activeTransitMode !== 'ALL' ? activeTransitMode : 'any mode'}.
                  </div>
              )}
          </div>
      </div>

      {/* 5. Cost Breakdown Tables - WRAPPED for Mobile Scrolling */}
      <div className="grid grid-cols-1 gap-6 animate-card-fly-in delay-300 overflow-hidden">
        
        {/* Sea / Rail Shipment Table */}
        <div className="w-full overflow-hidden">
            <SeaShipmentTable 
                showSeaBreakdown={showSeaBreakdown}
                setShowSeaBreakdown={setShowSeaBreakdown}
                today={today}
                currentQLabel={currentQLabel}
                prevQLabel={prevQLabel}
                lastYearQLabel={lastYearQLabel}
                cleuSea={cleuSea}
                cleuRail={cleuRail}
                clpl={clpl}
                cli={cli}
                clci={clci}
                cliLegacy={cliLegacy}
                fba={fba}
                other={other}
                destinationBreakdown={destinationBreakdown}
            />
        </div>

        {/* Air Shipment Table */}
        <div className="w-full overflow-hidden">
            <AirShipmentTable 
                showAirBreakdown={showAirBreakdown}
                setShowAirBreakdown={setShowAirBreakdown}
                today={today}
                currentQLabel={currentQLabel}
                prevQLabel={prevQLabel}
                lastYearQLabel={lastYearQLabel}
                cleuAir={cleuAir}
                clplAir={clplAir}
                cliAir={cliAir}
                clciAir={clciAir}
                cliLegacyAir={cliLegacyAir}
                fbaAir={fbaAir}
                otherAir={otherAir}
                airBreakdown={airBreakdown}
                activeAirRows={activeAirRows}
                airMin={airMin}
                airMax={airMax}
                globalCurrent={globalCurrent}
                globalPrevious={globalPrevious}
                globalLastYear={globalLastYear}
            />
        </div>
        
      </div>
    </div>
  );
};

export default Dashboard;
