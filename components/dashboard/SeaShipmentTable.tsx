
import React, { useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, Ship } from 'lucide-react';
import { DestinationRowData } from '../../types';

interface SeaShipmentTableProps {
  showSeaBreakdown: boolean;
  setShowSeaBreakdown: (show: boolean) => void;
  today: string;
  currentQLabel: string;
  prevQLabel: string;
  lastYearQLabel: string;
  cleuSea: DestinationRowData[];
  cleuRail: DestinationRowData[];
  clpl: DestinationRowData[];
  cli: DestinationRowData[];
  clci: DestinationRowData[];
  cliLegacy: DestinationRowData[];
  fba: DestinationRowData[];
  other: DestinationRowData[];
  destinationBreakdown: DestinationRowData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const getAvg = (cost: number, count: number) => (count > 0 ? cost / count : 0);

const DataCell: React.FC<{ count: number; cost: number; compCount?: number; compCost?: number; isBold?: boolean }> = ({ count, cost, compCount, compCost, isBold }) => {
  const avg = getAvg(cost, count);
  const cellClass = `border border-slate-300 p-2 text-right ${isBold ? 'font-bold' : ''}`;

  return (
    <>
      <td className={`border border-slate-300 p-2 text-center ${isBold ? 'font-bold' : ''}`}>{count}</td>
      <td className={`border border-slate-300 p-2 text-right ${isBold ? 'font-bold' : ''}`}>{formatCurrency(cost)}</td>
      <td className={cellClass}>
        <div className="flex items-center justify-end gap-1">
            {formatCurrency(avg)}
        </div>
      </td>
    </>
  );
};

const SubTotalRow: React.FC<{ label: string; rows: DestinationRowData[]; bgColor?: string; textColor?: string }> = ({ label, rows, bgColor = 'bg-[#d9e1f2]', textColor = 'text-slate-900' }) => {
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    current: { count: acc.current.count + r.current.count, cost: acc.current.cost + r.current.cost },
    previous: { count: acc.previous.count + r.previous.count, cost: acc.previous.cost + r.previous.cost },
    lastYear: { count: acc.lastYear.count + r.lastYear.count, cost: acc.lastYear.cost + r.lastYear.cost }
  }), { current: { count: 0, cost: 0 }, previous: { count: 0, cost: 0 }, lastYear: { count: 0, cost: 0 } }), [rows]);

  return (
    <tr className={`${bgColor} ${textColor} font-bold`}>
      <td className="border border-slate-300 p-2 text-right">{label}</td>
      <DataCell count={totals.current.count} cost={totals.current.cost} compCount={totals.previous.count} compCost={totals.previous.cost} isBold />
      <DataCell count={totals.previous.count} cost={totals.previous.cost} isBold />
      <DataCell count={totals.lastYear.count} cost={totals.lastYear.cost} isBold />
    </tr>
  );
};

const SeaShipmentTable: React.FC<SeaShipmentTableProps> = ({ 
    showSeaBreakdown, setShowSeaBreakdown, today, currentQLabel, prevQLabel, lastYearQLabel,
    cleuSea, cleuRail, clpl, cli, clci, cliLegacy, fba, other, destinationBreakdown
}) => {
  // Filter helper: Only keep rows that have activity in at least one of the 3 displayed periods
  const hasData = (r: DestinationRowData) => r.current.count > 0 || r.previous.count > 0 || r.lastYear.count > 0;

  const fCleuSea = useMemo(() => cleuSea.filter(hasData), [cleuSea]);
  const fCleuRail = useMemo(() => cleuRail.filter(hasData), [cleuRail]);
  const fClpl = useMemo(() => clpl.filter(hasData), [clpl]);
  const fCli = useMemo(() => cli.filter(hasData), [cli]);
  const fClci = useMemo(() => clci.filter(hasData), [clci]);
  const fCliLegacy = useMemo(() => cliLegacy.filter(hasData), [cliLegacy]);
  const fFba = useMemo(() => fba.filter(hasData), [fba]);
  const fOther = useMemo(() => other.filter(hasData), [other]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div 
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setShowSeaBreakdown(!showSeaBreakdown)}
        >
          <div className="flex items-center gap-2">
            <Ship className="text-indigo-600" size={20} />
            <h3 className="text-lg font-bold text-slate-800">Sea / Rail Shipment Breakdown</h3>
            <span className="text-xs font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-0.5 rounded-full group-hover:bg-slate-200 transition-colors">
              {showSeaBreakdown ? 'Collapse' : 'Expand'}
            </span>
          </div>
          <button className="p-1 rounded-full hover:bg-slate-100 text-slate-400 group-hover:text-indigo-600 transition-colors">
            {showSeaBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
        
        {showSeaBreakdown && (
          <div className="mt-4 overflow-auto custom-scrollbar animate-fade-in max-h-[600px] relative">
            <table className="w-full border-collapse text-[12px] font-sans min-w-[1000px] mb-2">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="border border-slate-300 p-2 align-bottom text-left font-semibold bg-white" rowSpan={2}>
                    <div className="flex items-center gap-1"><Calendar size={14} /> {today}</div>
                  </th>
                  <th className="border border-slate-300 p-2 text-center text-lg font-bold bg-[#fff2cc] uppercase tracking-wider" colSpan={9}>
                    SEA / RAIL SHIPMENT ANALYSIS
                  </th>
                </tr>
                <tr>
                  <th className="border border-slate-300 p-2 text-center font-bold bg-[#e2efda]" colSpan={3}>
                    Current Quarter <br/> <span className="text-sm font-bold block mt-1">{currentQLabel}</span>
                  </th>
                  <th className="border border-slate-300 p-2 text-center font-bold bg-[#d9e1f2]" colSpan={3}>
                    Previous Quarter <br/> <span className="text-sm font-bold block mt-1">{prevQLabel}</span>
                  </th>
                  <th className="border border-slate-300 p-2 text-center font-bold bg-[#f8cbad]" colSpan={3}>
                    Last Year this Quarter <br/> <span className="text-sm font-bold block mt-1">{lastYearQLabel}</span>
                  </th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="border border-slate-300 p-2 font-bold bg-[#fbe5d6] text-left uppercase">Dest Code</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]"># Container</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]">Cost (USD)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#e2efda]">Avg / Container</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]"># Container</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]">Cost (USD)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#d9e1f2]">Avg / Container</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]"># Container</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]">Cost (USD)</th>
                  <th className="border border-slate-300 p-2 font-bold bg-[#f8cbad]">Avg / Container</th>
                </tr>
              </thead>
              <tbody>
                {fCleuSea.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>CLEU SEA</td></tr>
                        {fCleuSea.map((row, idx) => (
                        <tr key={`cleu-sea-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="CLEU SEA Total" rows={fCleuSea} />
                    </>
                )}

                {fCleuRail.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>CLEU RAIL</td></tr>
                        {fCleuRail.map((row, idx) => (
                        <tr key={`cleu-rail-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">{row.destination}</td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="CLEU RAIL Total" rows={fCleuRail} />
                    </>
                )}

                {[...fCleuSea, ...fCleuRail].length > 0 && <SubTotalRow label="CLEU Total" rows={[...fCleuSea, ...fCleuRail]} bgColor="bg-[#b4c7e7]" />}

                {fClpl.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>CLPL</td></tr>
                        {fClpl.map((row, idx) => (
                        <tr key={`clpl-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">
                                {row.destination} {row.isRail && <span className="text-[10px] text-indigo-600 font-bold ml-1">(Rail)</span>}
                            </td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="CLPL Total" rows={fClpl} />
                    </>
                )}

                {fCli.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>CLI</td></tr>
                        {fCli.map((row, idx) => (
                        <tr key={`cli-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">
                                {row.destination} {row.isRail && <span className="text-[10px] text-indigo-600 font-bold ml-1">(Rail)</span>}
                            </td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="CLI Total" rows={fCli} />
                    </>
                )}

                {fClci.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>CLCI</td></tr>
                        {fClci.map((row, idx) => (
                        <tr key={`clci-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">
                                {row.destination} {row.isRail && <span className="text-[10px] text-indigo-600 font-bold ml-1">(Rail)</span>}
                            </td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="CLCI Total" rows={fClci} />
                    </>
                )}

                {fCliLegacy.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>CLI / CLCI (Legacy)</td></tr>
                        {fCliLegacy.map((row, idx) => (
                        <tr key={`cli-legacy-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">
                                {row.destination} {row.isRail && <span className="text-[10px] text-indigo-600 font-bold ml-1">(Rail)</span>}
                            </td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="Legacy Total" rows={fCliLegacy} />
                    </>
                )}

                {fFba.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2" colSpan={10}>FBA</td></tr>
                        {fFba.map((row, idx) => (
                        <tr key={`fba-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">
                                {row.destination} {row.isRail && <span className="text-[10px] text-indigo-600 font-bold ml-1">(Rail)</span>}
                            </td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="FBA Total" rows={fFba} />
                    </>
                )}

                {fOther.length > 0 && (
                    <>
                        <tr className="bg-slate-100 font-bold"><td className="border border-slate-300 p-2 text-slate-500 italic" colSpan={10}>OTHER / UNMAPPED</td></tr>
                        {fOther.map((row, idx) => (
                        <tr key={`other-${idx}`} className="hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 pl-4 font-mono font-bold text-sm text-slate-800">
                                {row.destination} {row.isRail && <span className="text-[10px] text-indigo-600 font-bold ml-1">(Rail)</span>}
                            </td>
                            <DataCell count={row.current.count} cost={row.current.cost} compCount={row.previous.count} compCost={row.previous.cost} />
                            <DataCell count={row.previous.count} cost={row.previous.cost} />
                            <DataCell count={row.lastYear.count} cost={row.lastYear.cost} />
                        </tr>
                        ))}
                        <SubTotalRow label="Unmapped Total" rows={fOther} bgColor="bg-slate-200" />
                    </>
                )}

                <tr className="bg-[#2f5496] text-white font-bold text-sm">
                  <td className="border border-slate-300 p-3 text-right uppercase">GRAND TOTAL</td>
                  <DataCell count={destinationBreakdown.reduce((s, r) => s + r.current.count, 0)} cost={destinationBreakdown.reduce((s, r) => s + r.current.cost, 0)} isBold />
                  <DataCell count={destinationBreakdown.reduce((s, r) => s + r.previous.count, 0)} cost={destinationBreakdown.reduce((s, r) => s + r.previous.cost, 0)} isBold />
                  <DataCell count={destinationBreakdown.reduce((s, r) => s + r.lastYear.count, 0)} cost={destinationBreakdown.reduce((s, r) => s + r.lastYear.cost, 0)} isBold />
                </tr>
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default SeaShipmentTable;
