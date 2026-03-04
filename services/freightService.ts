
import { shipmentReadService } from './shipmentReadService';
import { shipmentWriteService } from './shipmentWriteService';
import { analyticsService } from './analyticsService';

// Facade to maintain backward compatibility for existing imports
export const freightService = {
  // Read Operations
  isUsingMockData: shipmentReadService.isUsingMockData,
  getRequestById: shipmentReadService.getRequestById,
  getRequestsByQuarter: shipmentReadService.getRequestsByQuarter,
  getRequests: shipmentReadService.getRequests,
  getNextSN: shipmentReadService.getNextSN,

  // Write Operations
  createRequest: shipmentWriteService.createRequest,
  updateStatus: shipmentWriteService.updateStatus,
  updateRequestDetails: shipmentWriteService.updateRequestDetails,
  deleteRequests: shipmentWriteService.deleteRequests,
  fixMissingQuarters: shipmentWriteService.fixMissingQuarters,

  // Analytics
  getQuarterlyShipmentCosts: analyticsService.getQuarterlyShipmentCosts,
  getDashboardData: analyticsService.getDashboardData
};
