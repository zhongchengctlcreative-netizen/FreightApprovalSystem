
import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DashboardFinancials } from '../../types';

interface CostRevenueGaugeProps {
  activeData: DashboardFinancials;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const formatPercent = (value: number) => {
  if (isNaN(value) || !isFinite(value)) return '0.00%';
  return value.toFixed(2) + '%';
};

const CostRevenueGauge: React.FC<CostRevenueGaugeProps> = ({ activeData }) => {
    const { cost, targetRevenue, revenue } = activeData;
    const costVsTargetRatio = targetRevenue > 0 ? (cost / targetRevenue) * 100 : 0;
    const costVsRevenueRatio = revenue > 0 ? (cost / revenue) * 100 : 0;

    // Gauge visualization logic
    const gaugeValue = Math.min(costVsRevenueRatio, 100);
    const remainder = 100 - gaugeValue;
    const gaugeColor = costVsRevenueRatio > 80 ? '#ef4444' : costVsRevenueRatio > 60 ? '#f59e0b' : '#10b981';
    
    const gaugeData = [
        { name: 'Cost Margin', value: gaugeValue },
        { name: 'Remainder', value: remainder }
    ];

    return (
        <div className="flex flex-col justify-between">
            <div className="relative h-32 mt-2 flex-shrink-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={gaugeData}
                            cx="50%"
                            cy="100%" 
                            startAngle={180}
                            endAngle={0}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                            isAnimationActive={true}
                        >
                            <Cell key="cost" fill={gaugeColor} />
                            <Cell key="remainder" fill="#f1f5f9" />
                        </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pb-1">
                    <p className="text-3xl font-bold text-slate-800 leading-none">{formatPercent(costVsRevenueRatio)}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">Cost Margin</p>
                 </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-end gap-1 px-4 pb-2">
                 <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                    <div className="text-xs text-slate-500 font-medium uppercase">Net Revenue</div>
                    <div className="font-bold text-slate-800">{formatCurrency(revenue)}</div>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                    <div className="text-xs text-slate-500 font-medium uppercase">Total Cost</div>
                    <div className="font-bold text-red-600">-{formatCurrency(cost)}</div>
                 </div>
                 
                 <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mt-1">
                    <div className="flex flex-col">
                         <span className="text-xs text-slate-600 font-bold uppercase">Cost Margin</span>
                         <span className="text-[10px] text-slate-400 font-medium uppercase">Percentage</span>
                    </div>
                    <div className="text-right">
                        <div className={`font-bold ${costVsRevenueRatio > 80 ? 'text-red-600' : costVsRevenueRatio > 60 ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatPercent(costVsRevenueRatio)}
                        </div>
                    </div>
                 </div>

                 <div className="mt-1 text-center pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 font-medium">
                        Target Rev: <span className="text-slate-600 font-bold">{formatCurrency(targetRevenue)}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        Cost vs Target: <span className={`font-bold ${costVsTargetRatio > 100 ? 'text-red-500' : 'text-slate-600'}`}>{formatPercent(costVsTargetRatio)}</span>
                    </p>
                 </div>
            </div>
        </div>
    );
};

export default CostRevenueGauge;
