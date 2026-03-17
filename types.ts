
export enum RequestStatus {
  PENDING = 'PENDING',
  PENDING_L2 = 'PENDING_L2', // Intermediate status for 2nd approver
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
  CANCELLED = 'CANCELLED'
}

export type AppTheme = 'indigo' | 'blue' | 'emerald' | 'rose' | 'violet' | 'cyan' | 'amber';

// --- Logical Groupings for FreightRequest ---

export interface FreightFilters {
  id?: string;
  status?: RequestStatus[];
  origin?: string;
  destination?: string;
  mode?: string; // Shipping Method
  forwarder?: string;
  minWeight?: number;
  maxWeight?: number;
  minCost?: number;
  maxCost?: number;
  quarter?: string;
  requester?: string;
  // Advanced Filters
  region?: string;
  forwarderStatus?: 'ACTIVE' | 'INACTIVE';
}

export interface ShipmentCoreDetails {
  id: string;
  origin: string;
  destination: string;
  originCode?: string;
  destCode?: string;
  forwarder: string; // Renamed from carrier
  commodity: string;
  status: RequestStatus;
  requester: string;
  requesterEmail?: string;
  ccEmails?: string; // New: Comma separated emails
}

export interface ShipmentLogistics {
  // Replaced pickupDate/deliveryDate with standardized ETD/ETA
  etd: string; // Estimated Time Departure (Required)
  eta?: string; // Estimated Time Arrival
  
  quarter?: string; // e.g. "Q1", "Q2"
  
  // Physical Specs
  weight: number; // in lbs or kg
  cartonCount?: number; // No of Ctns
  m3?: number;
  
  // Shipping Method
  containerSize?: string; // 20, 40, 40HC
  meansOfConveyance?: string; // FCL, LCL
  shippingMethod?: string; // Air, Sea, Rail
  
  // Tracking & Vessel
  blAwb?: string;
  vesselName?: string;
  carrier?: string; // NEW field for actual carrier line (e.g. MAERSK, Evergreen)
  containerNumber?: string;
  seaPort?: string;
  palletDimensions?: string[]; // Array of LXHXW dimensions
  
  // Actual Dates
  atd?: string; // Actual Time Departure
  ata?: string; // Actual Time Arrival

  // Transit Analysis
  transitDayOrigin?: number;     // "TRANSIT DAY (origin)"
  transitDayDest?: number;       // "TRANSIT DAY (destination)"
  crdToEtd?: number;             // "CRD at CH, stuffing to ETD"
  transitDayVessel?: number;     // "TOTAL TRANSIT DAY ON VESSEL"
  arrivalInWarehouse?: number;   // "Arrival in warehouse"
  deliveryDate?: string;         // "Delivery Date"
  totalLeadTime?: number;        // "TOTAL LEADTIME"
}

export interface ShipmentFinancials {
  price: number; // Estimated Total Freight Cost
  inventoryValue?: number; // Inventory Value of goods
  
  // Actual Cost Breakdown
  totalFreightCost?: number; // "Total Freight Cost (USD)"
  chOrigin?: number; // "CH origin"
  fobCost?: number;  // "Total Cost (USD) FOB"
  originCost?: number; // "Origin (USD)"
  freightCharge?: number; // "Freight (USD)"
  destinationCost?: number; // "Destination (USD)"
  dutyCost?: number; // "Duty (USD)"
  
  // Currency Persistence
  inputCurrency?: string; // e.g. 'EUR', 'CNY' - Applies to Origin/Freight
  inputExchangeRate?: number; // e.g. 0.92
  
  destCurrency?: string; // Currency for Destination charges
  destExchangeRate?: number; // Rate for Destination charges

  chOriginCurrency?: string; // NEW: Currency for CH Origin
  chOriginExchangeRate?: number; // NEW: Rate for CH Origin

  exchangeRateDate?: string; // Timestamp when rate was captured
  inputValues?: Record<string, any>; // Stores original foreign values { originCost: 100, ... } and other metadata
  dutyCurrency?: string; // e.g. 'GBP'

  // Invoice Info
  invoiceNumber?: string;
  taxInvoiceNumber?: string; // New field
  invoiceValue?: number;
}

export interface ShipmentAudit {
  // AI
  aiAnalysis?: string;
  riskScore?: number; // 0-100

  // Submission
  submissionDate?: string; // ISO Timestamp
  
  // Workflow Actors
  firstApprover?: string; // Email of L1 Approver
  secondApprover?: string; // Email of L2 Approver (Optional)
  notifiedApprovers?: string[];

  // Level 1 Approval Audit
  l1ApprovalDate?: string;
  l1ApprovedBy?: string;
  l1ApprovalRemark?: string;

  // Final / Level 2 Approval Audit
  approvalDate?: string; // ISO Timestamp
  approvedBy?: string;
  approvalRemark?: string; // Remark for approval

  // Rejection Audit
  rejectionDate?: string; // ISO Timestamp
  rejectionReason?: string; // Reason for rejection
  rejectedBy?: string;

  // Cancellation Audit
  cancellationDate?: string;
  cancellationReason?: string;
  cancelledBy?: string;

  // Resubmission Audit
  resubmissionDate?: string;
  resubmissionNote?: string;

  // Reminder Audit
  lastReminderDate?: string;
}

// Composed Type
export interface FreightRequest extends ShipmentCoreDetails, ShipmentLogistics, ShipmentFinancials, ShipmentAudit {}

export interface AIAnalysisResult {
  riskAnalysis: string;
  marketRateComparison: string;
  recommendation: 'APPROVE' | 'REJECT' | 'INVESTIGATE';
  reasoning: string;
  riskScore?: number; // 0 to 100
}

export type UserRole = 'ADMIN' | 'APPROVER' | 'REQUESTER' | 'LOGISTICS';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin?: string;
  passcode?: string; // Optional security pin for Approvers/Admins
}

export interface AppNotification {
  id: string;
  user_email: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  type: 'INFO' | 'ACTION' | 'SUCCESS' | 'ERROR';
}

// --- New Types for Pagination & Dashboard ---

export interface PaginatedRequests {
  requests: FreightRequest[];
  totalCount: number;
}

export interface PeriodStats {
  count: number;
  cost: number;
  weight: number;
}

export interface DestinationRowData {
  destination: string;
  category: string;
  isRail: boolean;
  current: PeriodStats;
  previous: PeriodStats;
  lastYear: PeriodStats;
}

export interface DashboardStats {
  totalSpend: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  // Data Quality metrics
  missingCostCount?: number;
  missingQuarterCount?: number;
  currentQuarterStats: {
    quarter: number;
    fiscalYear: number;
    count: number;
    cost: number;
    avg: number;
  };
}

export interface TrendDataPoint {
  name: string;
  spend: number;
  count: number;
  '20_count': number;
  '40_count': number;
  '40HC_count': number;
  'Air_count': number;
  '20_cost': number;
  '40_cost': number;
  '40HC_cost': number;
  'Air_cost': number;
}

export interface TransitAnalysisPoint {
  destination: string;
  mode: string; // Sea, Air, Rail, Road
  avgOrigin: number;
  avgVessel: number;
  avgDest: number;
  avgTotal: number;
  count: number;
}

export interface ChartData {
  trendData: TrendDataPoint[];
  forwarderData: { name: string; value: number }[];
  transitAnalysis: TransitAnalysisPoint[];
}

export interface DashboardFinancials {
  quarter: string;
  revenue: number;
  cost: number;
  ratio: number; // Cost as % of Revenue
  targetRevenue: number;
}

export interface DashboardData {
  stats: DashboardStats;
  charts: ChartData;
  destinationBreakdown: DestinationRowData[];
  airBreakdown: DestinationRowData[];
  financials: DashboardFinancials | null;
  allFinancials: DashboardFinancials[];
}

// Simplified Supabase FileObject for type safety
export interface FileObject {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    [key: string]: any;
    size: number;
    mimetype: string;
  };
}

// --- COST VS REVENUE TYPES ---

export type FinancialCategory = 'CLEU' | 'CLPL' | 'CLI' | 'CLCI' | 'FBA' | 'OTHER' | 'INTER_PLANT' | 'TARGET';

export interface FinancialMetric {
  id?: string; // database ID
  quarter: string; // "FY26Q2"
  category: FinancialCategory;
  cost: number;
  revenue: number;
  target_revenue?: number; // Specific to the total target row
}
