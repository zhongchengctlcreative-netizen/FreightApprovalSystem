
import { supabase } from './supabaseClient';
import { financialService } from './financialService';
import { destinationService } from './destinationService';
import { 
  DashboardData, DestinationRowData, 
  TrendDataPoint, TransitAnalysisPoint, DashboardFinancials,
  PeriodStats
} from '../types';
import { getDestinationCategory, getQuarter, getPreviousQuarter, getLastYearQuarter, mapRowToRequest, getLocalOverrides } from './freightHelpers';

// Helper to init stats object
const initStats = (): PeriodStats => ({ count: 0, cost: 0, weight: 0 });

// Helper for strict 2 decimal place rounding to match CostRevenuePage
const to2DP = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export const analyticsService = {
  async getQuarterlyShipmentCosts(): Promise<Map<string, Map<string, number>>> {
    const { data, error } = await supabase
      .from('freight_raw_full')
      .select('quarter, total_actual_cost, estimated_cost, destination_code, destination')
      .eq('status', 'APPROVED');

    if (error || !data) return new Map();

    const destinations = await destinationService.getAll();
    // Normalize keys to uppercase to ensure case-insensitive matching regardless of how they are stored
    const regionMap = new Map(destinations.map(d => [d.code.toUpperCase().trim(), d.region]));

    const result = new Map<string, Map<string, number>>();

    data.forEach((row: any) => {
      const q = row.quarter;
      if (!q) return;

      const cost = Number(row.total_actual_cost) || Number(row.estimated_cost) || 0;
      const destCode = (row.destination_code || row.destination || '').toUpperCase().trim();
      
      // Determine category (region)
      let category = regionMap.get(destCode);
      if (!category) {
          if (destCode.startsWith('FBA')) category = 'FBA';
          else category = 'OTHER';
      }

      if (!result.has(q)) result.set(q, new Map());
      const qMap = result.get(q)!;
      
      qMap.set(category, (qMap.get(category) || 0) + cost);
    });

    return result;
  },

  async getDashboardData(): Promise<DashboardData | null> {
    // 1. Fetch Request Data
    const { data: rawRequests, error } = await supabase
        .from('freight_raw_full')
        .select('*');

    if (error || !rawRequests) return null;

    const localOverrides = getLocalOverrides();
    const requests = rawRequests.map((r: any) => mapRowToRequest(r, localOverrides[r.id] || {}));

    // 2. Fetch Supporting Data
    const [destinations, allFinancials] = await Promise.all([
        destinationService.getAll(),
        financialService.getAllMetrics()
    ]);

    // Normalize keys to uppercase for robust matching against normalized shipment codes
    const regionMap = new Map(destinations.map(d => [d.code.toUpperCase().trim(), d.region]));

    // 3. Current Period Context
    const today = new Date();
    const currentQuarter = getQuarter(today.toISOString());
    const prevQuarter = getPreviousQuarter(currentQuarter);
    const lastYearQuarter = getLastYearQuarter(currentQuarter);

    // 4. Aggregation Containers
    const stats = {
        totalSpend: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
        missingCostCount: 0,
        missingQuarterCount: 0,
        currentQuarterStats: {
            quarter: parseInt(currentQuarter.split('Q')[1]) || 0,
            fiscalYear: parseInt(currentQuarter.split('FY')[1]) || 0,
            count: 0,
            cost: 0,
            avg: 0
        }
    };

    const trendMap = new Map<string, TrendDataPoint>();
    const destMap = new Map<string, DestinationRowData>();
    const airMap = new Map<string, DestinationRowData>();
    const transitMap = new Map<string, { o: number, v: number, d: number, count: number }>();
    const quarterlyLiveCost = new Map<string, number>();

    // Helper to get/init destination row with explicit destination name passing
    const getRow = (map: Map<string, DestinationRowData>, key: string, category: string, isRail: boolean, destName: string): DestinationRowData => {
        if (!map.has(key)) {
            map.set(key, {
                destination: destName, // Use clean display name
                category,
                isRail,
                current: initStats(),
                previous: initStats(),
                lastYear: initStats()
            });
        }
        return map.get(key)!;
    };

    requests.forEach(req => {
        // Global Stats
        if (req.status === 'PENDING' || req.status === 'PENDING_L2') stats.pendingCount++;
        else if (req.status === 'APPROVED') stats.approvedCount++;
        else if (req.status === 'REJECTED') stats.rejectedCount++;
        else if (req.status === 'CANCELLED') stats.cancelledCount++;

        // Cost Calculation
        const cost = req.totalFreightCost || req.price || 0;
        const weight = req.weight || 0;
        
        if (cost === 0 && (req.status === 'APPROVED' || req.status === 'PENDING')) stats.missingCostCount++;
        if (!req.quarter && (req.status === 'APPROVED')) stats.missingQuarterCount++;

        if (req.status !== 'APPROVED') return;

        stats.totalSpend += cost;

        // Current Quarter Stats
        if (req.quarter === currentQuarter) {
            stats.currentQuarterStats.count++;
            stats.currentQuarterStats.cost += cost;
        }

        // Live Cost Calculation for Financials (Grouping by Quarter)
        if (req.quarter) {
            const currentQCost = quarterlyLiveCost.get(req.quarter) || 0;
            quarterlyLiveCost.set(req.quarter, currentQCost + cost);
        }

        // Trend Data
        if (req.quarter) {
            if (!trendMap.has(req.quarter)) {
                trendMap.set(req.quarter, {
                    name: req.quarter, spend: 0, count: 0,
                    '20_count': 0, '40_count': 0, '40HC_count': 0, 'Air_count': 0,
                    '20_cost': 0, '40_cost': 0, '40HC_cost': 0, 'Air_cost': 0
                });
            }
            const t = trendMap.get(req.quarter)!;
            t.spend += cost;
            t.count++;
            
            const mode = (req.shippingMethod || '').toLowerCase();
            const size = req.containerSize;
            
            if (mode.includes('air')) {
                t.Air_count++;
                t.Air_cost += cost;
            } else if (size === '20') {
                t['20_count']++;
                t['20_cost'] += cost;
            } else if (size === '40') {
                t['40_count']++;
                t['40_cost'] += cost;
            } else if (size === '40HC') {
                t['40HC_count']++;
                t['40HC_cost'] += cost;
            }
        }

        // Destination / Air Breakdown
        const destCode = (req.destCode || req.destination || 'UNKNOWN').toUpperCase().trim();
        const mode = (req.shippingMethod || '').toLowerCase();
        const isAir = mode.includes('air');
        const isRail = mode.includes('rail');
        
        let category = getDestinationCategory(destCode, regionMap);
        if (category === 'OTHER' && destCode.startsWith('FBA')) category = 'FBA';

        // Unique key per destination AND mode (Rail vs Sea) to prevent merging stats
        const rowKey = isRail ? `${destCode}_RAIL` : destCode;
        const targetMap = isAir ? airMap : destMap;
        
        const row = getRow(targetMap, rowKey, category, isRail, destCode);

        if (req.quarter === currentQuarter) {
            row.current.count++;
            row.current.cost += cost;
            row.current.weight += weight;
        } else if (req.quarter === prevQuarter) {
            row.previous.count++;
            row.previous.cost += cost;
            row.previous.weight += weight;
        } else if (req.quarter === lastYearQuarter) {
            row.lastYear.count++;
            row.lastYear.cost += cost;
            row.lastYear.weight += weight;
        }

        // Transit Analysis
        if (req.transitDayVessel !== undefined) {
            // Determine unified mode for grouping
            let transitMode = 'Sea';
            if (mode.includes('air')) transitMode = 'Air';
            else if (mode.includes('rail')) transitMode = 'Rail';
            else if (mode.includes('road')) transitMode = 'Road';

            // Key by Destination AND Mode to separate Sea vs Air stats
            const transitKey = `${destCode}|${transitMode}`;

            if (!transitMap.has(transitKey)) {
                transitMap.set(transitKey, { o: 0, v: 0, d: 0, count: 0 });
            }
            const tm = transitMap.get(transitKey)!;
            tm.o += (req.transitDayOrigin || 0);
            tm.v += (req.transitDayVessel || 0);
            tm.d += (req.transitDayDest || 0);
            tm.count++;
        }
    });

    if (stats.currentQuarterStats.count > 0) {
        stats.currentQuarterStats.avg = stats.currentQuarterStats.cost / stats.currentQuarterStats.count;
    }

    const trendData = Array.from(trendMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const forwarderData: any[] = []; 

    const transitAnalysis: TransitAnalysisPoint[] = Array.from(transitMap.entries()).map(([key, val]) => {
        const [dest, mode] = key.split('|');
        return {
            destination: dest,
            mode: mode,
            avgOrigin: Math.round(val.o / val.count),
            avgVessel: Math.round(val.v / val.count),
            avgDest: Math.round(val.d / val.count),
            avgTotal: Math.round((val.o + val.v + val.d) / val.count),
            count: val.count
        };
    })
    .filter(t => t.count > 1) 
    .sort((a, b) => b.avgTotal - a.avgTotal);

    const destinationBreakdown = Array.from(destMap.values());
    const airBreakdown = Array.from(airMap.values());

    const uniqueQuarters = Array.from(new Set(allFinancials.map(f => f.quarter))).sort().reverse();
    
    // Financials Aggregation aligned with CostRevenuePage logic:
    // Total Cost = (Live Shipment Cost) + (Manual DB Costs like Inter-Plant)
    const aggregatedFinancials: DashboardFinancials[] = uniqueQuarters.map(q => {
        const qData = allFinancials.filter(f => f.quarter === q);
        
        // Sum Revenue (Entered Manually in DB)
        const r = to2DP(qData.reduce((acc, f) => acc + (f.revenue || 0), 0));
        
        // Target (Entered Manually in DB)
        const t = qData.find(f => f.category === 'TARGET')?.target_revenue || 0;
        
        // Cost Part 1: Manual Adjustments from DB (e.g., 'INTER_PLANT')
        // We exclude shipment categories (CLEU, CLPL, etc.) because we use live data for those.
        // For simplicity and matching logic, we specifically include 'INTER_PLANT' or exclude standard ones.
        const manualCosts = qData
            .filter(f => f.category === 'INTER_PLANT') 
            .reduce((acc, f) => acc + (f.cost || 0), 0);

        // Cost Part 2: Live Shipment Costs from Requests
        const liveCost = quarterlyLiveCost.get(q) || 0;

        const c = to2DP(manualCosts + liveCost);

        return {
            quarter: q,
            revenue: r,
            cost: c,
            ratio: r > 0 ? (c / r) * 100 : 0,
            targetRevenue: t
        };
    });

    // Find financials for current quarter or fallback
    const financials = aggregatedFinancials.find(f => f.quarter === currentQuarter) || 
                       aggregatedFinancials[0] || null;

    return {
        stats,
        charts: {
            trendData,
            forwarderData,
            transitAnalysis
        },
        destinationBreakdown,
        airBreakdown,
        financials,
        allFinancials: aggregatedFinancials
    };
  }
};
