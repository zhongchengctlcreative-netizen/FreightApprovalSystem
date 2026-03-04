
import React, { useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, Plane } from 'lucide-react';
import { DestinationRowData } from '../../types';

interface AirShipmentTableProps {
  showAirBreakdown: boolean;
  setShowAirBreakdown: (show: boolean) => void;
  today: string;
  currentQLabel: string;
  prevQLabel: string;
  lastYearQLabel: string;
  cleuAir: DestinationRowData[];
  clplAir: DestinationRowData[];
  cliAir: DestinationRowData[];
  clciAir: DestinationRowData[];
  cliLegacyAir: DestinationRowData[];
  fbaAir: DestinationRowData[];
  otherAir: DestinationRowData[];
  airBreakdown: DestinationRowData[];
  activeAirRows: DestinationRowData[];
  airMin: number;
  airMax: number;
  globalCurrent: { count: number; cost: number; weight: number };
  globalPrevious: { count: number; cost: number; weight: number };
  globalLastYear: { count: number; cost: number; weight: number };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const getAvgPerKg = (cost: number, weight: number) => (weight > 0 ? cost / weight : 0);

const AirDataCell: React.FC<{ count: number; cost: number; weight: number; compCost?: number; compWeight?: number; isBold?: boolean }> = ({ count, cost, weight, compCost, compWeight, isBold }) => {
  const avg = getAvgPerKg(cost, weight);
  const cellClass = `border border-slate-300 p-2 text-right ${isBold ? 'font-bold' : ''}`;

  return (
    <>
      <td className={`border border-slate-300 p-2 text-center ${isBold ? 'font-bold' : ''}`}>{count}</td>
      <td className={`border border-slate-300 p-2 text-right ${isBold ? 'font-bold' : ''}`}>{formatCurrency(cost)}</td>
      <td className={`border border-slate-300 p-2 text-right ${isBold ? 'font-bold' : ''}`}>{weight.toLocaleString()}</td>
      <td className={cellClass}>
        <div className="flex items-center justify-end gap-1">
            {formatCurrency(avg)}
        </div>
      </td>
    </>
  );
};

const AirSubTotalRow: React.FC<{ label: string; rows: DestinationRowData[]; bgColor?: string; textColor?: string }> = ({ label, rows, bgColor = 'bg-[#d9e1f2]', textColor = 'text-slate-900' }) => {
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    current: { count: acc.current.count + r.current.count, cost: acc.current.cost + r.current.cost, weight: acc.current.weight + r.current.weight },
    previous: { count: acc.previous.count + r.previous.count, cost: acc.previous.cost + r.previous.cost, weight: acc.previous.weight + r.previous.weight },
    lastYear: { count: acc.lastYear.count + r.lastYear.count, cost: acc.lastYear.cost + r.lastYear.cost, weight: acc.lastYear.weight + r.lastYear.weight }
  }), { 
    current: { count: 0, cost: 0, weight: 0 }, 
    previous: { count: 0, cost: 0, weight: 0 }, 
    lastYear: { count: 0, cost: 0, weight: 0 } 
  }), [rows]);

  return (
    <tr className={`${bgColor} ${textColor} font-bold`}>
      <td className="border border-slate-300 p-2 text-right">{label}</td>
      <AirDataCell count={totals.current.count} cost={totals.current.cost} weight={totals.current.weight} compCost={totals.previous.cost} compWeight={totals.previous.weight} isBold />
      <AirDataCell count={totals.previous.count} cost={totals.previous.cost} weight={totals.previous.weight} isBold />
      <AirDataCell count={totals.lastYear.count} cost={totals.lastYear.cost} weight={totals.lastYear.weight} isBold />
    </tr>
  );
};

const AirShipmentTable: React.FC<AirShipmentTableProps> = ({
    showAirBreakdown, setShowAirBreakdown, today, currentQLabel, prevQLabel, lastYearQLabel,
    cleuAir, clplAir, cliAir, clciAir, cliLegacyAir, fbaAir, otherAir, airBreakdown,
    activeAirRows, airMin, airMax, globalCurrent, globalPrevious, globalLastYear
}) => {
  
  // Filter helper: Only keep rows that have activity in at least one of the 3 displayed periods
  const hasData = (r: DestinationRowData) => r.current.count > 0 || r.previous.count > 0 || r.lastYear.count > 0;

  const fCleuAir = useMemo(() => cleuAir.filter(hasData), [cleuAir]);
  const fClplAir = useMemo(() => clplAir.filter(hasData), [clplAir]);
  const fCliAir = useMemo(() => cliAir.filter(hasData), [cliAir]);
  const fClciAir = useMemo(() => clciAir.filter(hasData), [clciAir]);
  const fCliLegacyAir = useMemo(() => cliLegacyAir.filter(hasData), [cliLegacyAir]);
  const fFbaAir = useMemo(() => fbaAir.filter(hasData), [fbaAir]);
  const fOtherAir = useMemo(() => otherAir.filter(hasData), [otherAir]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setShowAirBreakdown(!showAirBreakdown)}
        >
          <div className="flex items-center gap-2">
            <Plane className="text-orange-500" size={20} />
            <h3 className="text-lg font-bold text-slate-800">Air Shipment Breakdown</h3>
            <span className="text-xs font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-0.5 rounded-full group-hover:bg-slate-200 transition-colors">
              {showAirBreakdown ? 'Collapse' : 'Expand'}
            </span>
          </div>
          <button className="p-1 rounded-full hover:bg-slate-100 text-slate-400 group-hover:text-indigo-600 transition-colors">
            {showAirBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
        
        {showAirBreakdown && (
          <div className="mt-4 overflow-auto custom-scrollbar animate-fade-in max-h-[600px] relative">
            <table className="w-full border-collapse text-[12px] font-sans min-w-[1000px]">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="border border-slate-300 p-2 align-bottom text-left font-semibold bg-white" rowSpan={2}>
                    <div className="flex items-center gap-1"><Plane size={14} className="text-slate-600" /> {today}</div>
                  </th>
                  <th className="border border-slate-300 p-2 text-center text-lg font-bold bg-[#e0e7ff] uppercase tracking-wider" colSpan={12}>
                    AIR SHIPMENT ANALYSIS
                  </th>
                </tr>
                <tr>
                  <th className="border border-slate-300 p-2 text-center font-bold bg-[#e2efda]" colSpan={4}>
                    Current Quarter <br/> <span className="text-sm font-bold block mt-1">{currentQLabel}</span>
                  </th>
                  <th className="border border-slate-300 p-2 text-center font-bold bg-[#d9e1f2]" colSpan={4}>
                    Previous Quarter <br/> <span className="text-sm font-bold block mt-1">{prevQLabel}</span>
                  </th>
                  <th className="border border-slate-300 p-2 text-center font-bold bg-[#f8cbad]" colSpan={4}>
                    Last Year this Quarter <br/> <span className="text-sm font-bold block mt-1">{lastYearQLabel}</span>
                  </th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="border border-slate-300 p-2 font-bold bg-[#fbe5d6] text-left uppercase">Dest Code</th>
                  
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]"># Air Shipment</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]">Cost (USD)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]">Total Weight (KG)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]">Average cost per KG</th>
                  
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]"># Air Shipment</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]">Cost (USD)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]">Total Weight (KG)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]">Average cost per KG</th>
                  
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]"># Air Shipment</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]">Cost (USD)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]">Total Weight (KG)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]">Average cost per KG</th>
                </tr>
              </thead>
              <tbody>
                {fCleuAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>CLEU</td></tr>
                        {fCleuAir.map((row, idx) => (
                        <tr key={`cleu-air-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                            <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                            <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                            <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                        </tr>
                        ))}
                        <AirSubTotalRow label="CLEU Total" rows={fCleuAir} />
                    </>
                )}

                {fClplAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>CLPL</td></tr>
                        {fClplAir.map((row, idx) => (
                        <tr key={`clpl-air-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                            <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                            <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                            <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                        </tr>
                        ))}
                        <AirSubTotalRow label="CLPL Total" rows={fClplAir} />
                    </>
                )}

                {fCliAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>CLI</td></tr>
                        {fCliAir.map((row, idx) => (
                        <tr key={`cli-air-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                            <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                            <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                            <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                        </tr>
                        ))}
                        <AirSubTotalRow label="CLI Total" rows={fCliAir} />
                    </>
                )}

                {fClciAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>CLCI</td></tr>
                        {fClciAir.map((row, idx) => (
                        <tr key={`clci-air-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                            <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                            <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                            <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                        </tr>
                        ))}
                        <AirSubTotalRow label="CLCI Total" rows={fClciAir} />
                    </>
                )}

                {fCliLegacyAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>CLI / CLCI (Legacy)</td></tr>
                        {fCliLegacyAir.map((row, idx) => (
                            <tr key={`cli-legacy-air-${idx}`} className="hover:bg-slate-50">
                                <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                                <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                                <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                                <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                            </tr>
                        ))}
                        <AirSubTotalRow label="Legacy Total" rows={fCliLegacyAir} />
                    </>
                )}

                {fFbaAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>FBA</td></tr>
                        {fFbaAir.map((row, idx) => (
                            <tr key={`fba-air-${idx}`} className="hover:bg-slate-50">
                                <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                                <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                                <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                                <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                            </tr>
                        ))}
                        <AirSubTotalRow label="FBA Total" rows={fFbaAir} />
                    </>
                )}

                {fOtherAir.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={13}>OTHER</td></tr>
                        {fOtherAir.map((row, idx) => (
                            <tr key={`other-air-${idx}`} className="hover:bg-slate-50">
                                <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                                <AirDataCell count={row.current.count} cost={row.current.cost} weight={row.current.weight} compCost={row.previous.cost} compWeight={row.previous.weight} />
                                <AirDataCell count={row.previous.count} cost={row.previous.cost} weight={row.previous.weight} />
                                <AirDataCell count={row.lastYear.count} cost={row.lastYear.cost} weight={row.lastYear.weight} />
                            </tr>
                        ))}
                        <AirSubTotalRow label="Other Total" rows={fOtherAir} />
                    </>
                )}

                <tr className="bg-[#2f5496] text-white font-bold text-sm">
                    <td className="border border-slate-300 p-3 text-right uppercase">AIR Total</td>
                    <AirDataCell count={airBreakdown.reduce((s, r) => s + r.current.count, 0)} cost={airBreakdown.reduce((s, r) => s + r.current.cost, 0)} weight={airBreakdown.reduce((s, r) => s + r.current.weight, 0)} isBold />
                    <AirDataCell count={airBreakdown.reduce((s, r) => s + r.previous.count, 0)} cost={airBreakdown.reduce((s, r) => s + r.previous.cost, 0)} weight={airBreakdown.reduce((s, r) => s + r.previous.weight, 0)} isBold />
                    <AirDataCell count={airBreakdown.reduce((s, r) => s + r.lastYear.count, 0)} cost={airBreakdown.reduce((s, r) => s + r.lastYear.cost, 0)} weight={airBreakdown.reduce((s, r) => s + r.lastYear.weight, 0)} isBold />
                </tr>

                <tr className="bg-slate-800 text-white font-bold text-sm border-t-4 border-double border-slate-600">
                    <td className="border border-slate-500 p-3 text-right uppercase">
                        GLOBAL GRAND TOTAL <br/>
                        <span className="text-[10px] font-normal text-slate-400 normal-case">(Sea + Rail + Air)</span>
                    </td>
                    <td className="border border-slate-500 p-2 text-center">{globalCurrent.count}</td>
                    <td className="border border-slate-500 p-2 text-right">{formatCurrency(globalCurrent.cost)}</td>
                    <td className="border border-slate-500 p-2 text-right text-slate-300">{globalCurrent.weight.toLocaleString()}</td>
                    <td className="border border-slate-500 p-2 text-right">{formatCurrency(getAvgPerKg(globalCurrent.cost, globalCurrent.weight))}</td>
                    
                    <td className="border border-slate-500 p-2 text-center">{globalPrevious.count}</td>
                    <td className="border border-slate-500 p-2 text-right">{formatCurrency(globalPrevious.cost)}</td>
                    <td className="border border-slate-500 p-2 text-right text-slate-300">{globalPrevious.weight.toLocaleString()}</td>
                    <td className="border border-slate-500 p-2 text-right">{formatCurrency(getAvgPerKg(globalPrevious.cost, globalPrevious.weight))}</td>

                    <td className="border border-slate-500 p-2 text-center">{globalLastYear.count}</td>
                    <td className="border border-slate-500 p-2 text-right">{formatCurrency(globalLastYear.cost)}</td>
                    <td className="border border-slate-500 p-2 text-right text-slate-300">{globalLastYear.weight.toLocaleString()}</td>
                    <td className="border border-slate-500 p-2 text-right">{formatCurrency(getAvgPerKg(globalLastYear.cost, globalLastYear.weight))}</td>
                </tr>

                {activeAirRows.length > 0 && (
                    <tr className="bg-red-50 text-red-600 font-medium text-xs">
                        <td className="border border-slate-300 p-2 text-center italic" colSpan={13}>
                            The average air freight cost per kg is between {formatCurrency(airMin)} - {formatCurrency(airMax)}
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default AirShipmentTable;
