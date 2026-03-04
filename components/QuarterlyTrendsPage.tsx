
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DashboardData } from '../types';
import { Search, X, BarChart3, Filter, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuarterlyTrendsPageProps {
  dashboardData: DashboardData | null;
}

const QuarterlyTrendsPage: React.FC<QuarterlyTrendsPageProps> = ({ dashboardData }) => {
  const navigate = useNavigate();
  const [chartMetric, setChartMetric] = useState<'cost' | 'count'>('cost');
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [quarterSearchTerm, setQuarterSearchTerm] = useState('');
  const [isQuarterSearchOpen, setIsQuarterSearchOpen] = useState(false);
  const [defaultsSet, setDefaultsSet] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setIsQuarterSearchOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableQuarters = useMemo(() => {
    if (!dashboardData?.charts?.trendData) return [];
    return Array.from(new Set(
        dashboardData.charts.trendData
            .map(d => d.name)
            .filter(n => n && n !== 'N/A' && n.startsWith('FY'))
    )).sort().reverse();
  }, [dashboardData]);

  // Set default selection (Last 3 Quarters)
  useEffect(() => {
      if (availableQuarters.length > 0 && !defaultsSet) {
          setSelectedQuarters(availableQuarters.slice(0, 3));
          setDefaultsSet(true);
      }
  }, [availableQuarters, defaultsSet]);

  const filteredData = useMemo(() => {
      if (!dashboardData?.charts?.trendData) return [];
      // Only show data starting with FY
      const validData = dashboardData.charts.trendData.filter(d => d.name && d.name !== 'N/A' && d.name.startsWith('FY'));
      
      if (selectedQuarters.length > 0) {
          return validData.filter(d => selectedQuarters.includes(d.name)).sort((a,b) => a.name.localeCompare(b.name));
      }
      // Show all if no filter, sorted
      return validData.sort((a,b) => a.name.localeCompare(b.name));
  }, [dashboardData, selectedQuarters]);

  const quarterOptions = useMemo(() => {
      return availableQuarters
      .filter(q => !selectedQuarters.includes(q))
      .filter(q => q.toLowerCase().includes(quarterSearchTerm.toLowerCase()));
  }, [availableQuarters, selectedQuarters, quarterSearchTerm]);

  if (!dashboardData) {
      return <div className="p-8 text-center text-slate-500">Loading analysis data...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-fade-in p-2 md:p-6 space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div className="flex items-center gap-4">
             <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                 <ArrowLeft size={20} />
             </button>
             <div>
                 <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     <BarChart3 className="text-indigo-600" /> Quarterly Trends Analysis
                 </h1>
                 <p className="text-sm text-slate-500">Deep dive into historical shipment volume and spending.</p>
             </div>
         </div>

         <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
             {/* Metric Toggle */}
             <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold shadow-inner">
                <button 
                  onClick={() => setChartMetric('count')}
                  className={`px-4 py-2 rounded-md transition-all ${chartMetric === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Shipment Count
                </button>
                <button 
                  onClick={() => setChartMetric('cost')}
                  className={`px-4 py-2 rounded-md transition-all ${chartMetric === 'cost' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Total Cost ($)
                </button>
             </div>

             {/* Quarter Filter */}
             <div className="relative" ref={searchRef}>
                  <div className="flex items-center border border-slate-200 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 shadow-sm transition-all w-64">
                      <Filter size={16} className="text-slate-400 mr-2 shrink-0" />
                      <input 
                          type="text" 
                          placeholder="Filter quarters..." 
                          className="text-sm outline-none w-full bg-transparent"
                          value={quarterSearchTerm}
                          onChange={e => { setQuarterSearchTerm(e.target.value); setIsQuarterSearchOpen(true); }}
                          onFocus={() => setIsQuarterSearchOpen(true)}
                      />
                  </div>
                  
                  {isQuarterSearchOpen && (
                      <div className="absolute top-full right-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in-up">
                          {quarterOptions.length > 0 ? quarterOptions.map(q => (
                              <button 
                                  key={q}
                                  onClick={() => {
                                      setSelectedQuarters(prev => [...prev, q]);
                                      setQuarterSearchTerm('');
                                      setIsQuarterSearchOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 border-b border-slate-50 last:border-0"
                              >
                                  {q}
                              </button>
                          )) : (
                              <div className="px-4 py-4 text-xs text-slate-400 text-center italic">No quarters found.</div>
                          )}
                      </div>
                  )}
             </div>
         </div>
      </div>

      {/* Active Filters */}
      {selectedQuarters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Comparing:</span>
            {selectedQuarters.map(q => (
                <span key={q} className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-full px-3 py-1 text-sm font-semibold shadow-sm animate-fade-in">
                    {q}
                    <button onClick={() => setSelectedQuarters(selectedQuarters.filter(x => x !== q))} className="hover:text-indigo-950 bg-white/50 rounded-full p-0.5"><X size={12} /></button>
                </span>
            ))}
            <button onClick={() => setSelectedQuarters([])} className="text-xs text-slate-400 hover:text-red-500 ml-2 underline underline-offset-2">Clear All</button>
        </div>
      )}

      {/* Chart Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
        {filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 13, fontWeight: 600}} 
                  dy={10} 
                />
                <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{fill: '#64748b', fontSize: 12}} 
                   tickFormatter={(val) => chartMetric === 'cost' ? `$${val/1000}k` : val} 
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                     const isCost = chartMetric === 'cost';
                     const formattedVal = isCost 
                        ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                        : value;
                     let label = name;
                     if (name.includes('20')) label = "20' Container";
                     else if (name.includes('40HC')) label = "40' High Cube";
                     else if (name.includes('40')) label = "40' Container";
                     else if (name.includes('Air')) label = "Air Freight";
                     
                     return [formattedVal, label];
                  }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  cursor={{fill: '#f8fafc'}}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                
                <Bar dataKey={chartMetric === 'cost' ? '20_cost' : '20_count'} name="20'" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey={chartMetric === 'cost' ? '40_cost' : '40_count'} name="40'" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey={chartMetric === 'cost' ? '40HC_cost' : '40HC_count'} name="40HC" fill="#ec4899" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey={chartMetric === 'cost' ? 'Air_cost' : 'Air_count'} name="Air" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <BarChart3 size={48} className="mb-4 opacity-20" />
                <p>No data available for the selected quarters.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default QuarterlyTrendsPage;
