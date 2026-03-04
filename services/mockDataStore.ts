
import { FreightRequest, RequestStatus } from '../types';

const MOCK_STORAGE_KEY = 'freightguard_mock_data_v1';

// Default Mock Data
const DEFAULT_MOCK_REQUESTS: FreightRequest[] = [
  {
    id: '24-00101-SHA-LAX-SWWK20',
    origin: 'Shanghai',
    destination: 'Los Angeles',
    originCode: 'SHA',
    destCode: 'LAX',
    forwarder: 'Kuehne + Nagel',
    carrier: 'Maersk Line',
    vesselName: 'MAERSK ALABAMA',
    weight: 15400,
    price: 4500,
    inventoryValue: 120000,
    totalFreightCost: 4850,
    originCost: 200,
    chOrigin: 150,
    fobCost: 350,
    freightCharge: 4000,
    destinationCost: 350,
    dutyCost: 150,
    etd: '2024-05-15',
    atd: '2024-05-16',
    eta: '2024-06-02',
    ata: '2024-06-03',
    quarter: 'FY2024 Q4',
    commodity: 'Electronics',
    containerSize: '40HC',
    meansOfConveyance: 'FCL',
    shippingMethod: 'Sea',
    cartonCount: 500,
    status: RequestStatus.PENDING,
    requester: 'JOHN DOE',
    requesterEmail: 'john.doe@freightguard.com',
    notifiedApprovers: ['jane.smith@freightguard.com', 'admin@freightguard.com'],
    firstApprover: 'jane.smith@freightguard.com',
    ccEmails: 'manager@freightguard.com',
    m3: 65.5,
    blAwb: 'MAEU123456789',
    seaPort: 'Shanghai Port',
    transitDayOrigin: 2,
    crdToEtd: 7,
    transitDayVessel: 19,
    transitDayDest: 2,
    arrivalInWarehouse: 3,
    deliveryDate: '2024-06-05',
    totalLeadTime: 29,
    submissionDate: '2024-05-10T09:00:00Z',
    lastReminderDate: '2024-05-12T10:00:00Z',
    aiAnalysis: JSON.stringify({
      recommendation: "INVESTIGATE",
      marketRateComparison: "Rate is 12% above market average ($4,000).",
      riskAnalysis: "Route is stable, but carrier has recent delay reports.",
      reasoning: "Price is slightly high for this weight class."
    })
  }
];

export const mockDataStore = {
  load: (): FreightRequest[] => {
    if (typeof window === 'undefined') return DEFAULT_MOCK_REQUESTS;
    try {
      const stored = localStorage.getItem(MOCK_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load mock data from storage", e);
    }
    return DEFAULT_MOCK_REQUESTS;
  },

  save: (data: FreightRequest[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save mock data", e);
    }
  },

  // In-memory reference for direct access if needed, though loading from storage is preferred
  _data: null as FreightRequest[] | null,
  
  getData() {
    if (!this._data) {
        this._data = this.load();
    }
    return this._data;
  },
  
  setData(newData: FreightRequest[]) {
      this._data = newData;
      this.save(newData);
  }
};
