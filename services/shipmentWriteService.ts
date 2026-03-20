
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { FreightRequest, RequestStatus } from '../types';
import { mockDataStore } from './mockDataStore';
import { notificationService } from './notificationService';
import { fileService } from './fileService';
import { shipmentReadService } from './shipmentReadService';
import { getQuarter, getWeekNumber } from './freightHelpers';

// Helper to generate Log ID
const generateLogIdInfo = async (
  originCode: string, 
  destCode: string, 
  shippingMethod: string, 
  forwarder: string,
  referenceDateStr?: string
): Promise<{ id: string, sn: number, week: string, yy: string }> => {
    const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
    const validDate = isNaN(refDate.getTime()) ? new Date() : refDate;

    const yearFull = validDate.getFullYear();
    const yy = yearFull.toString().slice(-2);
    const weekNum = getWeekNumber(validDate);
    const weekStr = weekNum.toString().padStart(2, '0');
    
    const sn = await shipmentReadService.getNextSN(Number(yy));
    
    const method = (shippingMethod || '').toLowerCase();
    const fwd = (forwarder || '').toLowerCase();
    let suffix = `SWWK${weekStr}`; 

    if (method.includes('rail')) {
        suffix = `RW${weekStr}`;
    } else if (method.includes('air')) {
        if (fwd.includes('dhl') || fwd.includes('fedex')) {
            suffix = `AirW${weekStr}`;
        } else {
            suffix = `AW${weekStr}`;
        }
    } else if (method.includes('road')) {
        suffix = `AW${weekStr}`;
    }
    
    const snStr = sn.toString().padStart(5, '0');
    const from = (originCode || 'XXX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const to = (destCode || 'XXX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const id = `${yy}-${snStr}-${from}-${to}-${suffix}`;
    
    return { id, sn, week: suffix, yy };
};

export const shipmentWriteService = {
  async createRequest(requestData: Omit<FreightRequest, 'id' | 'status'> & { originCode?: string, destCode?: string }): Promise<FreightRequest | null> {
    const { originCode, destCode, notifiedApprovers, ...initialRequest } = requestData;

    const request = {
      ...initialRequest,
      notifiedApprovers,
      originCode,
      destCode,
      quarter: getQuarter(initialRequest.etd || '')
    } as any;
    
    const { id: logNo, sn, week, yy } = await generateLogIdInfo(
        originCode || request.origin.slice(0,3), 
        destCode || request.destination.slice(0,3),
        request.shippingMethod,
        request.forwarder,
        request.etd
    );
    const now = new Date().toISOString();

    const newRequestObject = { ...request, id: logNo, status: RequestStatus.PENDING, submissionDate: now };

    notificationService.notifyFirstApprover(newRequestObject as FreightRequest).catch(console.error);

    if (!isSupabaseConfigured) {
      const current = mockDataStore.getData();
      current.unshift(newRequestObject as FreightRequest);
      mockDataStore.setData(current);
      return newRequestObject;
    }

    const payload = {
      id: logNo,
      sn: sn,
      week: week,
      year: Number(yy),
      status: RequestStatus.PENDING,
      quarter: request.quarter,
      origin: request.origin,
      origin_code: request.originCode,
      destination: request.destination,
      destination_code: request.destCode,
      sea_port: request.seaPort,
      forwarder: request.forwarder, // UI 'Forwarder' -> DB 'forwarder'
      carrier: request.carrier, // UI 'Carrier' -> DB 'carrier'
      vessel_name: request.vesselName,
      shipping_method: request.shippingMethod,
      means_of_conveyance: request.meansOfConveyance,
      container_size: request.containerSize,
      container_number: request.containerNumber,
      weight_kg: request.weight,
      volume_m3: request.m3,
      carton_count: request.cartonCount,
      commodity: request.commodity,
      estimated_cost: request.price,
      inventory_value: request.inventoryValue,
      total_actual_cost: request.totalFreightCost,
      origin_cost: request.originCost,
      ch_origin_cost: request.chOrigin,
      fob_cost: request.fobCost,
      freight_charge: request.freightCharge,
      destination_cost: request.destinationCost,
      duty_cost: request.dutyCost,
      invoice_value: request.invoiceValue,
      input_currency: request.inputCurrency,
      input_exchange_rate: request.inputExchangeRate,
      exchange_rate_date: request.exchangeRateDate,
      input_values: { 
          ...request.inputValues,
          destCurrency: request.destCurrency,
          destExchangeRate: request.destExchangeRate,
          chOriginCurrency: request.chOriginCurrency,
          chOriginExchangeRate: request.chOriginExchangeRate
      },
      duty_currency: request.dutyCurrency,
      etd: request.etd || null,
      eta: request.eta || null,
      atd: request.atd || null,
      ata: request.ata || null,
      submission_date: now,
      crd_to_etd: request.crdToEtd,
      transit_origin: request.transitDayOrigin,
      transit_vessel: request.transitDayVessel,
      transit_dest: request.transitDayDest,
      warehouse_arrival: request.arrivalInWarehouse,
      delivery_date: request.deliveryDate || null,
      total_lead_time: request.totalLeadTime,
      bl_awb: request.blAwb,
      invoice_number: request.invoiceNumber,
      tax_invoice_number: request.taxInvoiceNumber,
      pallet_dimension: request.palletDimensions ? JSON.stringify(request.palletDimensions) : null,
      requester_name: request.requester?.toUpperCase(),
      requester_email: request.requesterEmail,
      notified_approvers: request.notifiedApprovers,
      first_approver: request.firstApprover,
      second_approver: request.secondApprover,
      cc_emails: request.ccEmails
    };

    const { data, error } = await supabase.from('freight_raw_full').insert([payload]).select().single();

    if (error) {
       console.error("Create request failed:", JSON.stringify(error));
       if (error.code === '23503' && error.message.includes('fk_freight_carrier_name')) {
           throw new Error("Database Schema Error: The 'carrier' column has a bad constraint. Please go to Settings > System Configuration and click 'Update Database Views' to fix this.");
       }
       return null;
    }

    return { ...newRequestObject, id: data.id };
  },

  async updateStatus(id: string, newStatus: RequestStatus, analysisResult?: any, remark?: string, actorName?: string): Promise<void> {
    const now = new Date().toISOString();
    
    // Fetch existing request to check workflow
    let currentRequest: FreightRequest | null;
    
    // We use the read service to get the current state
    currentRequest = await shipmentReadService.getRequestById(id);

    if (!currentRequest) {
        console.error("Could not find request for updateStatus");
        return;
    }

    // Workflow Logic
    let actualStatus = newStatus;
    if (newStatus === RequestStatus.APPROVED) {
        if (currentRequest.status === RequestStatus.PENDING && currentRequest.secondApprover) {
            actualStatus = RequestStatus.PENDING_L2;
        }
    }

    const payload: any = { status: actualStatus };
    if (analysisResult) payload.ai_analysis = analysisResult;

    if (actualStatus === RequestStatus.PENDING_L2) {
        payload.l1_approval_date = now;
        payload.l1_approved_by = actorName?.toUpperCase();
        if (remark) payload.l1_approval_remark = remark;
        
        const intermediateRequest = { 
            ...currentRequest, 
            status: RequestStatus.PENDING_L2,
            l1ApprovedBy: actorName?.toUpperCase(), 
            l1ApprovalRemark: remark,
            l1ApprovalDate: now
        };

        notificationService.notifySecondApprover(intermediateRequest).catch(console.error);
        notificationService.notifyRequesterOfL1Approval(intermediateRequest).catch(console.error);
    } 
    else if (actualStatus === RequestStatus.APPROVED) {
        payload.approval_date = now;
        payload.approved_by = actorName?.toUpperCase();
        if (remark) payload.approval_remark = remark;
        const completedRequest = { ...currentRequest, approvedBy: actorName?.toUpperCase(), approvalRemark: remark, status: RequestStatus.APPROVED };
        
        notificationService.notifyRequesterOfApproval(completedRequest).catch(console.error);
        notificationService.notifyFirstApproverOfCompletion(completedRequest).catch(console.error);
    } 
    else if (actualStatus === RequestStatus.REJECTED) {
        payload.rejection_date = now;
        payload.rejected_by = actorName?.toUpperCase();
        if (remark) payload.rejection_reason = remark;
        const rejectedRequest = { ...currentRequest, rejectedBy: actorName?.toUpperCase(), rejectionReason: remark };
        notificationService.notifyRequesterOfRejection(rejectedRequest).catch(console.error);
    } 
    else if (actualStatus === RequestStatus.CANCELLED) {
        payload.cancellation_date = now;
        payload.cancelled_by = actorName?.toUpperCase();
        if (remark) payload.cancellation_reason = remark;
        const cancelledRequest = { ...currentRequest, cancelledBy: actorName?.toUpperCase(), cancellationReason: remark };
        notificationService.notifyRequesterOfCancellation(cancelledRequest).catch(console.error);
    }
    // Handle Resubmission logic
    else if (actualStatus === RequestStatus.PENDING) {
        // Log resubmission
        payload.resubmission_date = now;
        payload.resubmission_note = remark;
        
        // Reset Level 1 Approval to force re-evaluation
        payload.l1_approval_date = null;
        payload.l1_approved_by = null;
        payload.l1_approval_remark = null;

        // Reset Level 2 Approval if exists
        payload.approved_by = null;
        payload.approval_date = null;
        payload.approval_remark = null;

        // We do NOT clear the rejection history here to preserve the audit trail in UI
        notificationService.notifyFirstApprover(currentRequest).catch(console.error);
    }

    if (isSupabaseConfigured) {
        const { error } = await supabase.from('freight_raw_full').update(payload).eq('id', id);
        if (error) console.error("Failed to update status in DB", JSON.stringify(error));
    } else {
        const current = mockDataStore.getData();
        const updated = current.map(r => r.id === id ? { ...r, ...payload } : r);
        mockDataStore.setData(updated);
    }
  },

  async updateRequestDetails(id: string, updates: Partial<FreightRequest>): Promise<void> {
    if (!isSupabaseConfigured) {
        const current = mockDataStore.getData();
        const updated = current.map(r => r.id === id ? { ...r, ...updates } : r);
        mockDataStore.setData(updated);
        return;
    }
    
    // FIX: Fetch current record to merge JSONB fields correctly and avoid updating unchanged foreign keys
    const { data: currentRecord, error: fetchError } = await supabase
        .from('freight_raw_full')
        .select('*')
        .eq('id', id)
        .single();
    
    if (fetchError) {
        console.error("Failed to fetch current record for update:", fetchError);
        throw new Error("Could not prepare update, failed to read existing data.");
    }

    const dbUpdates: any = {};
    const map = (key: keyof FreightRequest, dbKey: string) => {
        if (updates[key] !== undefined && updates[key] !== currentRecord[dbKey]) {
            dbUpdates[dbKey] = updates[key];
        }
    };
    
    // Correctly map UI fields to DB columns
    if (updates.forwarder !== undefined && updates.forwarder !== currentRecord.forwarder) {
        dbUpdates.forwarder = updates.forwarder;
    }
    if (updates.carrier !== undefined && updates.carrier !== currentRecord.carrier) {
        dbUpdates.carrier = updates.carrier;
    }

    map('origin', 'origin');
    map('destination', 'destination');
    map('originCode', 'origin_code');
    map('destCode', 'destination_code');
    map('vesselName', 'vessel_name');
    map('weight', 'weight_kg');
    map('price', 'estimated_cost');
    map('inventoryValue', 'inventory_value');
    map('totalFreightCost', 'total_actual_cost');
    
    if (updates.etd !== undefined && updates.etd !== currentRecord.etd) {
        dbUpdates.quarter = getQuarter(updates.etd || '');
    }

    map('originCost', 'origin_cost');
    map('chOrigin', 'ch_origin_cost');
    map('fobCost', 'fob_cost');
    map('freightCharge', 'freight_charge');
    map('destinationCost', 'destination_cost');
    map('dutyCost', 'duty_cost');
    map('invoiceValue', 'invoice_value');
    
    map('inputCurrency', 'input_currency');
    map('inputExchangeRate', 'input_exchange_rate');
    map('exchangeRateDate', 'exchange_rate_date');
    
    map('dutyCurrency', 'duty_currency');

    // FIX: Robust merge for JSONB fields
    const existingInputValues = currentRecord?.input_values || {};
    let hasJsonbUpdate = false;
    const newInputValues = { ...existingInputValues };
    
    if (updates.inputValues) {
        Object.assign(newInputValues, updates.inputValues);
        hasJsonbUpdate = true;
    }
    
    // Clean up carrierLine from JSONB as it is now in 'carrier' column, unless we want to keep it in sync.
    // If 'carrier' column is being updated, we can remove the JSON fallback.
    if (updates.carrier !== undefined) {
        delete newInputValues.carrierLine;
        hasJsonbUpdate = true;
    }
    
    if (updates.destCurrency !== undefined) {
        newInputValues.destCurrency = updates.destCurrency;
        hasJsonbUpdate = true;
    }
    if (updates.destExchangeRate !== undefined) {
        newInputValues.destExchangeRate = updates.destExchangeRate;
        hasJsonbUpdate = true;
    }
    
    if (updates.chOriginCurrency !== undefined) {
        newInputValues.chOriginCurrency = updates.chOriginCurrency;
        hasJsonbUpdate = true;
    }
    if (updates.chOriginExchangeRate !== undefined) {
        newInputValues.chOriginExchangeRate = updates.chOriginExchangeRate;
        hasJsonbUpdate = true;
    }
    
    if(hasJsonbUpdate) {
        dbUpdates.input_values = newInputValues;
    }

    map('commodity', 'commodity');
    map('containerSize', 'container_size');
    map('meansOfConveyance', 'means_of_conveyance');
    map('shippingMethod', 'shipping_method');
    map('cartonCount', 'carton_count');
    map('m3', 'volume_m3');
    
    map('blAwb', 'bl_awb');
    map('containerNumber', 'container_number');
    map('invoiceNumber', 'invoice_number');
    map('taxInvoiceNumber', 'tax_invoice_number');
    
    if (updates.palletDimensions !== undefined) {
        dbUpdates.pallet_dimension = updates.palletDimensions ? JSON.stringify(updates.palletDimensions) : null;
    }
    
    map('seaPort', 'sea_port');
    map('crdToEtd', 'crd_to_etd');
    map('transitDayOrigin', 'transit_origin');
    map('transitDayVessel', 'transit_vessel');
    map('transitDayDest', 'transit_dest');
    map('arrivalInWarehouse', 'warehouse_arrival');
    map('totalLeadTime', 'total_lead_time');
    
    map('firstApprover', 'first_approver');
    map('secondApprover', 'second_approver');
    map('ccEmails', 'cc_emails');

    if (updates.requester) {
        const newRequester = updates.requester.toUpperCase();
        if (newRequester !== currentRecord.requester_name) {
            dbUpdates.requester_name = newRequester;
        }
    }

    const dateFields: (keyof FreightRequest)[] = ['etd', 'eta', 'atd', 'ata', 'deliveryDate'];
    const dbDateFields = ['etd', 'eta', 'atd', 'ata', 'delivery_date'];

    dateFields.forEach((field, idx) => {
        if (updates[field] !== undefined) {
            const val = updates[field];
            const dbVal = (!val || val === '') ? null : val;
            if (dbVal !== currentRecord[dbDateFields[idx]]) {
                dbUpdates[dbDateFields[idx]] = dbVal;
            }
        }
    });

    if (Object.keys(dbUpdates).length === 0) {
        return;
    }

    const { error } = await supabase.from('freight_raw_full').update(dbUpdates).eq('id', id);

    if (error) {
        console.error("Dynamic update failed:", JSON.stringify(error));
        if (error.code === '23503') {
            if (error.message.includes('fk_freight_carrier_name')) {
                throw new Error("Database Schema Error: The 'carrier' column has a bad constraint. Please go to Settings > System Configuration and click 'Update Database Views' to fix this.");
            }
            if (error.message.includes('fk_freight_destination_code')) {
                throw new Error("Database Schema Error: The destination code you selected is not present in the destinations table. Please ensure the code exists in Location Management.");
            }
            if (error.message.includes('fk_freight_origin_code')) {
                throw new Error("Database Schema Error: The origin code you selected is not present in the destinations table. Please ensure the code exists in Location Management.");
            }
        }
        throw error;
    }
  },

  async deleteRequests(ids: string[]): Promise<void> {
    if (!isSupabaseConfigured) {
      const current = mockDataStore.getData();
      const updated = current.filter(r => !ids.includes(r.id));
      mockDataStore.setData(updated);
      return;
    }

    try {
        await Promise.all(ids.map(id => fileService.deleteShipmentFolder(id)));
    } catch (e) {
        console.warn("File cleanup had errors, proceeding to DB delete.", e);
    }

    const { error } = await supabase.from('freight_raw_full').delete().in('id', ids);
    if (error) throw error;
  },

  async fixMissingQuarters(): Promise<number> {
    if (!isSupabaseConfigured) return 0;

    const { data, error } = await supabase
        .from('freight_raw_full')
        .select('id, etd')
        .or('quarter.is.null,quarter.eq.""')
        .not('etd', 'is', null);

    if (error || !data || data.length === 0) return 0;

    let count = 0;
    // Sequential loop to avoid race conditions and ensure reliability
    for (const req of data) {
        const q = getQuarter(req.etd);
        if (q) {
            const { error: upErr } = await supabase
                .from('freight_raw_full')
                .update({ quarter: q })
                .eq('id', req.id);
            if (!upErr) count++;
        }
    }
    return count;
  }
};
