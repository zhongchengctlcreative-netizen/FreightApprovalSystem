
import { FreightRequest } from '../types';

export const STATUS_STORAGE_KEY = 'freightguard_status_overrides';

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

export const getQuarter = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  let fiscalYear = year;
  let quarter = 0;

  if (month >= 6) { 
    // July onwards is next fiscal year
    fiscalYear = year + 1;
    if (month <= 8) quarter = 1; // Jul-Sep
    else quarter = 2; // Oct-Dec
  } else {
    // Jan-Jun is current calendar year but part of FY ending this year
    fiscalYear = year; 
    if (month <= 2) quarter = 3; // Jan-Mar
    else quarter = 4; // Apr-Jun
  }
  
  return `FY${fiscalYear} Q${quarter}`;
};

export const getPreviousQuarter = (quarterStr: string): string => {
    const match = quarterStr.match(/FY(\d{4}) Q(\d)/);
    if (!match) return '';
    let year = parseInt(match[1], 10);
    let q = parseInt(match[2], 10);

    if (q === 1) {
        return `FY${year - 1} Q4`;
    } else {
        return `FY${year} Q${q - 1}`;
    }
};

export const getLastYearQuarter = (quarterStr: string): string => {
    const match = quarterStr.match(/FY(\d{4}) Q(\d)/);
    if (!match) return '';
    let year = parseInt(match[1], 10);
    let q = parseInt(match[2], 10);
    return `FY${year - 1} Q${q}`;
};

export const getDestinationCategory = (destCode: string, regionMappings: Map<string, string>): string => {
  const code = (destCode || '').toUpperCase().trim();
  if (regionMappings.has(code)) {
    return regionMappings.get(code) || 'OTHER';
  }
  // Removed automatic FBA categorization to allow mapping or fallback to OTHER
  return 'OTHER';
};

export const getLocalOverrides = (): Record<string, any> => {
  try {
    const stored = localStorage.getItem(STATUS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
};

export const diffDays = (startStr?: string, endStr?: string): number | undefined => {
  if (!startStr || !endStr) return undefined;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const getDaysRemaining = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Reset input date time to midnight for accurate day diff
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return '(Today)';
  if (diffDays === 1) return '(Tomorrow)';
  if (diffDays === -1) return '(Yesterday)';
  
  if (diffDays > 0) return `(in ${diffDays} days)`;
  return `(${Math.abs(diffDays)} days ago)`;
};

export const mapRowToRequest = (row: any, overrides: any = {}): FreightRequest => {
    const etd = row.etd ? row.etd.split('T')[0] : '';
    const atd = row.atd ? row.atd.split('T')[0] : undefined;
    const eta = row.eta ? row.eta.split('T')[0] : '';
    const ata = row.ata ? row.ata.split('T')[0] : undefined;
    const deliveryDate = row.delivery_date ? row.delivery_date.split('T')[0] : undefined;

    const crdToEtd = row.crd_to_etd !== null && row.crd_to_etd !== undefined ? row.crd_to_etd : 7;
    const transitDayOrigin = row.transit_origin !== null && row.transit_origin !== undefined ? row.transit_origin : diffDays(etd, atd);
    const transitDayVessel = row.transit_vessel !== null && row.transit_vessel !== undefined ? row.transit_vessel : diffDays(atd, ata);
    const transitDayDest = row.transit_dest !== null && row.transit_dest !== undefined ? row.transit_dest : diffDays(eta, ata);
    const arrivalInWarehouse = row.warehouse_arrival !== null && row.warehouse_arrival !== undefined ? row.warehouse_arrival : diffDays(ata, deliveryDate);

    let totalLeadTime = row.total_lead_time;
    if (totalLeadTime === null || totalLeadTime === undefined) {
        const sum = (crdToEtd || 0) + (transitDayVessel || 0) + (arrivalInWarehouse || 0);
        if (sum > 0) totalLeadTime = sum;
    }

    const inputValues = row.input_values || {};

    // Logic to handle legacy data migration overlap:
    // If 'forwarder' is null (old data), fall back to 'carrier'.
    const forwarderVal = row.forwarder || row.carrier;
    
    // If 'carrier' column equals 'forwarder' value, it's likely unmigrated data where 'carrier' held the forwarder name.
    // In this specific case, try to use the JSON value for Carrier Line, otherwise keep it as is (might be legitimate same name).
    let carrierVal = row.carrier;
    if (carrierVal === forwarderVal && inputValues.carrierLine) {
        carrierVal = inputValues.carrierLine;
    }

    let parsedPallets: string[] = [];
    if (row.pallet_dimension) {
        try {
            const parsed = JSON.parse(row.pallet_dimension);
            if (Array.isArray(parsed)) {
                parsedPallets = parsed;
            } else {
                parsedPallets = [row.pallet_dimension];
            }
        } catch (e) {
            parsedPallets = [row.pallet_dimension];
        }
    }

    return {
        id: row.id,
        status: overrides.status || row.status,
        quarter: row.quarter,
        
        origin: row.origin,
        originCode: row.origin_code,
        destination: row.destination,
        destCode: row.destination_code,
        seaPort: row.sea_port,
        
        forwarder: forwarderVal,
        carrier: carrierVal, 
        
        vesselName: row.vessel_name,
        shippingMethod: row.shipping_method,
        meansOfConveyance: row.means_of_conveyance,
        containerSize: row.container_size,
        containerNumber: row.container_number,
        
        weight: Number(row.weight_kg) || 0,
        m3: Number(row.volume_m3) || 0,
        cartonCount: Number(row.carton_count) || 0,
        commodity: row.commodity,
        
        price: Number(row.estimated_cost) || 0,
        inventoryValue: row.inventory_value ? Number(row.inventory_value) : undefined,
        totalFreightCost: row.total_actual_cost ? Number(row.total_actual_cost) : undefined,
        originCost: row.origin_cost ? Number(row.origin_cost) : undefined,
        chOrigin: row.ch_origin_cost ? Number(row.ch_origin_cost) : undefined,
        fobCost: row.fob_cost ? Number(row.fob_cost) : undefined,
        freightCharge: row.freight_charge ? Number(row.freight_charge) : undefined,
        destinationCost: row.destination_cost ? Number(row.destination_cost) : undefined,
        dutyCost: row.duty_cost ? Number(row.duty_cost) : undefined,
        invoiceValue: row.invoice_value ? Number(row.invoice_value) : undefined,
        
        inputCurrency: row.input_currency || 'USD',
        inputExchangeRate: row.input_exchange_rate ? Number(row.input_exchange_rate) : 1,
        
        destCurrency: inputValues.destCurrency || 'USD',
        destExchangeRate: inputValues.destExchangeRate ? Number(inputValues.destExchangeRate) : 1,

        chOriginCurrency: inputValues.chOriginCurrency || 'USD',
        chOriginExchangeRate: inputValues.chOriginExchangeRate ? Number(inputValues.chOriginExchangeRate) : 1,

        exchangeRateDate: row.exchange_rate_date,
        inputValues: inputValues,
        dutyCurrency: row.duty_currency || 'USD',

        etd,
        eta,
        atd,
        ata,
        submissionDate: row.submission_date,
        
        crdToEtd,
        transitDayOrigin,
        transitDayVessel,
        transitDayDest,
        arrivalInWarehouse,
        deliveryDate,
        totalLeadTime,
        
        blAwb: row.bl_awb,
        invoiceNumber: row.invoice_number,
        taxInvoiceNumber: row.tax_invoice_number,
        palletDimensions: parsedPallets,
        
        requester: row.requester_name?.toUpperCase(),
        requesterEmail: row.requester_email,
        ccEmails: row.cc_emails,
        notifiedApprovers: row.notified_approvers || [],
        firstApprover: row.first_approver,
        secondApprover: row.second_approver,
        
        l1ApprovalDate: overrides.l1ApprovalDate || row.l1_approval_date,
        l1ApprovedBy: (overrides.l1ApprovedBy || row.l1_approved_by)?.toUpperCase(),
        l1ApprovalRemark: overrides.l1ApprovalRemark || row.l1_approval_remark,

        approvedBy: (overrides.approvedBy || row.approved_by)?.toUpperCase(),
        approvalDate: overrides.approvalDate || row.approval_date,
        approvalRemark: overrides.approvalRemark || row.approval_remark,
        
        rejectedBy: (overrides.rejectedBy || row.rejected_by)?.toUpperCase(),
        rejectionDate: overrides.rejectionDate || row.rejection_date,
        rejectionReason: overrides.rejectionReason || row.rejection_reason,
        
        cancelledBy: (overrides.cancelledBy || row.cancelled_by)?.toUpperCase(),
        cancellationDate: overrides.cancellationDate || row.cancellation_date,
        cancellationReason: overrides.cancellationReason || row.cancellation_reason,
        
        resubmissionDate: overrides.resubmissionDate || row.resubmission_date,
        resubmissionNote: overrides.resubmissionNote || row.resubmission_note,
        
        lastReminderDate: row.last_reminder_date,
        
        aiAnalysis: overrides.aiAnalysis || row.ai_analysis
    };
};
