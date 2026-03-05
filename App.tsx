
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';
import ShipmentGrid from './components/ShipmentGrid';
import NewRequestForm from './components/NewRequestForm';
import UserManagement from './components/UserManagement';
import LocationManagement from './components/LocationManagement';
import ForwarderManagement from './components/CarrierManagement';
import CostRevenuePage from './components/CostRevenuePage';
import AirFreightCalculator from './components/AirFreightCalculator';
import WelcomePage from './components/WelcomePage';
import SettingsPage from './components/SettingsPage';
import QuarterlyTrendsPage from './components/QuarterlyTrendsPage';
import CalendarPage from './components/CalendarPage';
import { Trash2 } from 'lucide-react';
import { useUser } from './contexts/UserContext';
import { useFreightData } from './hooks/useFreightData';
import { useToast } from './contexts/ToastContext';
import { FreightRequest, FreightFilters, User, DashboardData } from './types';

const PAGE_SIZE = 50;

// Extracted Component to prevent re-mount loops
interface RequestDetailContainerProps {
  requests: FreightRequest[];
  fetchRequestById: (id: string) => Promise<FreightRequest | null>;
  currentUser: User | null;
  users: User[];
  updateStatus: (id: string, status: any, analysis?: string, remark?: string, user?: User | null, skipRefresh?: boolean) => Promise<void>;
  updateRequestDetails: (id: string, updates: Partial<FreightRequest>) => Promise<void>;
  onSuccess: (msg: string) => void;
  onClearFilters: () => void;
  dashboardData: DashboardData | null;
  fetchDashboardData: () => Promise<any>;
}

const RequestDetailContainer: React.FC<RequestDetailContainerProps> = ({ 
  requests, fetchRequestById, currentUser, users, updateStatus, updateRequestDetails, onSuccess, onClearFilters, dashboardData, fetchDashboardData
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeRequest, setActiveRequest] = useState<FreightRequest | null>(null);
    const [fetching, setFetching] = useState(true);

    // Ensure dashboard data is available for analysis card
    useEffect(() => {
        if (!dashboardData) {
            fetchDashboardData();
        }
    }, [dashboardData, fetchDashboardData]);

    // Sync with global requests list (Reactive updates)
    useEffect(() => {
        if (id && requests.length > 0) {
            const found = requests.find(r => r.id === id);
            if (found) {
                setActiveRequest(found);
                // If we found it in the list, we stop fetching state
                setFetching(false);
            }
        }
    }, [requests, id]);

    // Initial Fetch (On ID change only)
    useEffect(() => {
        if (id) {
            // Optimistic check from props first
            const existing = requests.find(r => r.id === id);
            if (existing) {
                setActiveRequest(existing);
                setFetching(false);
            } else {
                setFetching(true);
                fetchRequestById(id).then(req => {
                    setActiveRequest(req);
                    setFetching(false);
                });
            }
        }
    }, [id, fetchRequestById, requests]); 

    if (fetching) return <div className="p-8 text-center text-slate-500">Loading shipment details...</div>;
    if (!activeRequest) return <div className="p-8 text-center text-red-500">Shipment not found.</div>;

    return (
        <RequestDetail 
            request={activeRequest} 
            currentUser={currentUser} 
            users={users} 
            dashboardData={dashboardData}
            onBack={() => {}} 
            onUpdateStatus={async (id, status, analysis, remark) => {
                await updateStatus(id, status, analysis, remark, currentUser, true);
                onSuccess(`Status updated to ${status}`);
                onClearFilters();
                navigate('/shipments?status=ALL');
            }} 
            onUpdateRequestDetails={(id, updates) => {
                updateRequestDetails(id, updates);
                onSuccess("Details saved.");
            }} 
        />
    );
};

const App: React.FC = () => {
  const { currentUser, users, refreshUsers } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { 
    requests, 
    dashboardData, 
    loading, 
    totalCount, 
    fetchRequests, 
    fetchDashboardData,
    fetchRequestById,
    createRequest, 
    updateStatus, 
    updateRequestDetails, 
    deleteRequests,
    fixMissingQuarters
  } = useFreightData();
  
  const { success: toastSuccess, error: toastError } = useToast();
  
  const searchParams = new URLSearchParams(location.search);
  
  // State derived from URL
  const currentPage = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || 'ALL';
  const searchTerm = searchParams.get('q') || '';
  
  // Advanced Filter State (InMemory)
  const [advancedFilters, setAdvancedFilters] = useState<FreightFilters | undefined>(undefined);

  const updateParams = (updates: any) => {
      const newParams = new URLSearchParams(location.search);
      if (updates.page) newParams.set('page', updates.page.toString());
      if (updates.status) newParams.set('status', updates.status);
      if (updates.searchTerm !== undefined) {
          if (updates.searchTerm) newParams.set('q', updates.searchTerm);
          else newParams.delete('q');
      }
      if (updates.status || updates.searchTerm !== undefined) {
          newParams.set('page', '1');
      }
      navigate({ search: newParams.toString() });
  };

  // UI State for Modals
  const [deleteConfirmation, setDeleteConfirmation] = useState<{show: boolean, ids: string[]}>({ show: false, ids: [] });
  const [dataVersion, setDataVersion] = useState(0);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);

  // Timeout to prompt user to refresh the page (e.g., after 60 minutes)
  useEffect(() => {
    if (!currentUser) return;
    
    let timeoutId: NodeJS.Timeout;

    const startTimeout = () => {
      timeoutId = setTimeout(() => {
        setShowRefreshPrompt(true);
      }, 3600000); // 60 minutes
    };

    // Reset timeout on user activity
    const resetTimeout = () => {
      clearTimeout(timeoutId);
      if (!showRefreshPrompt) {
        startTimeout();
      }
    };

    startTimeout();

    // Add event listeners for user activity
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);
    window.addEventListener('click', resetTimeout);
    window.addEventListener('scroll', resetTimeout);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      window.removeEventListener('click', resetTimeout);
      window.removeEventListener('scroll', resetTimeout);
    };
  }, [currentUser, showRefreshPrompt]);

  useEffect(() => {
    if (!currentUser) return;

    if (location.pathname === '/dashboard') {
        fetchDashboardData();
    } else if (location.pathname === '/approvals' || location.pathname === '/shipments') {
        let filterToUse = statusFilter;
        if (location.pathname === '/approvals') {
            filterToUse = 'ALL_PENDING';
        }
        
        fetchRequests({
            page: currentPage,
            pageSize: PAGE_SIZE,
            statusFilter: filterToUse,
            searchTerm,
            filters: advancedFilters // Pass advanced filters
        });
    }
  }, [location.pathname, currentPage, statusFilter, searchTerm, advancedFilters, currentUser, fetchRequests, fetchDashboardData]);

  const handleCreate = async (newReqData: any) => {
    try {
      const result = await createRequest(newReqData, currentUser);
      if (result) {
          toastSuccess(`Request ${result.id} created successfully.`);
          navigate('/approvals');
          setDataVersion(v => v + 1);
      }
    } catch (e) {
      toastError("Failed to create request.");
    }
  };

  const handleBulkUpdate = async (ids: string[], status: any, remark?: string) => {
      try {
        await Promise.all(ids.map(id => updateStatus(id, status, undefined, remark, currentUser)));
        toastSuccess(`Updated ${ids.length} requests successfully.`);
      } catch(e) {
        toastError("Some updates failed.");
      }
  };

  const handleDelete = async () => {
      try {
        await deleteRequests(deleteConfirmation.ids);
        toastSuccess("Records deleted successfully.");
        setDeleteConfirmation({ show: false, ids: [] });
        setDataVersion(v => v + 1);
      } catch (e) {
        toastError("Failed to delete records.");
      }
  };

  const handleExport = async () => {
      if (requests.length === 0) return;
      
      const headers = [
        "Log ID", "Status", "Quarter", 
        "Origin Name", "Origin Code", "Destination Name", "Destination Code", "Sea/Air Port",
        "Mode", "Forwarder", "Carrier Line", "Vessel/Flight", 
        "Container Size", "Container No", "Conveyance", "BL/AWB",
        "Commodity", "Weight (KG)", "Volume (CBM)", "Carton Count",
        "ETD", "ETA", "ATD", "ATA",
        "Est. Cost (USD)", "Actual Total Cost (USD)", 
        "Origin Cost", "Freight Charge", "Dest Cost", "FOB Cost", "CH Origin Cost", "Duty Cost",
        "Inventory Value", "Invoice Value", "Invoice No", "Tax Invoice No",
        "Transit: CRD to ETD", "Transit: Origin", "Transit: Vessel", "Transit: Dest", "Warehouse Arrival", "Total Lead Time",
        "Requester"
      ];

      const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        headers.join(','),
        ...requests.map(r => [
          r.id, r.status, r.quarter,
          r.origin, r.originCode, r.destination, r.destCode, r.seaPort,
          r.shippingMethod, r.forwarder, r.carrier, r.vesselName,
          r.containerSize, r.containerNumber, r.meansOfConveyance, r.blAwb,
          r.commodity, r.weight, r.m3, r.cartonCount,
          r.etd, r.eta, r.atd, r.ata,
          r.price, r.totalFreightCost,
          r.originCost, r.freightCharge, r.destinationCost, r.fobCost, r.chOrigin, r.dutyCost,
          r.inventoryValue, r.invoiceValue, r.invoiceNumber, r.taxInvoiceNumber,
          r.crdToEtd, r.transitDayOrigin, r.transitDayVessel, r.transitDayDest, r.arrivalInWarehouse, r.totalLeadTime,
          r.requester
        ].map(escape).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `freight_master_export_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
  };

  if (!currentUser) return <WelcomePage />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={
            <Dashboard 
              dashboardData={dashboardData} 
              onFilterClick={v => { 
                if (v === 'PENDING') {
                  navigate('/approvals');
                } else {
                  // Approved, Rejected, Cancelled go to the master data grid
                  navigate(`/shipments?status=${v}`);
                }
              }} 
            />
        } />
        
        <Route path="/trends" element={<QuarterlyTrendsPage dashboardData={dashboardData} />} />
        <Route path="/calendar" element={<CalendarPage />} />

        <Route path="/approvals" element={
            <RequestList 
                requests={requests} 
                onSelect={(req) => navigate(`/shipments/${req.id}`, { state: { from: 'list', search: location.search } })} 
                onBulkUpdate={handleBulkUpdate} 
                currentUser={currentUser} 
                users={users} 
                loading={loading} 
                totalCount={totalCount} 
                currentPage={currentPage} 
                pageSize={PAGE_SIZE} 
                onPageChange={(p) => updateParams({ page: p })} 
                searchTerm={searchTerm} 
                onSearchTermChange={(q) => updateParams({ searchTerm: q })} 
            />
        } />
        
        <Route path="/shipments" element={
            <ShipmentGrid 
                requests={requests} 
                onSelect={(req) => navigate(`/shipments/${req.id}`, { state: { from: 'grid', search: location.search } })} 
                onDelete={(ids) => setDeleteConfirmation({ show: true, ids })} 
                onExport={handleExport} 
                onFixQuarters={fixMissingQuarters}
                loading={loading} 
                totalCount={totalCount} 
                currentPage={currentPage} 
                pageSize={PAGE_SIZE} 
                onPageChange={(p) => updateParams({ page: p })} 
                statusFilter={statusFilter} 
                onStatusFilterChange={(s) => updateParams({ status: s })} 
                searchTerm={searchTerm} 
                onSearchTermChange={(q) => updateParams({ searchTerm: q })} 
                onAdvancedFilterChange={setAdvancedFilters}
                initialFilters={advancedFilters} // Pass filters down
                currentUser={currentUser} 
            />
        } />
        
        <Route path="/shipments/:id" element={
            <RequestDetailContainer 
                requests={requests}
                fetchRequestById={fetchRequestById}
                currentUser={currentUser}
                users={users}
                updateStatus={updateStatus}
                updateRequestDetails={updateRequestDetails}
                onSuccess={toastSuccess}
                onClearFilters={() => setAdvancedFilters(undefined)}
                dashboardData={dashboardData}
                fetchDashboardData={fetchDashboardData}
            />
        } />
        
        <Route path="/new" element={
            <NewRequestForm onSubmit={handleCreate} onCancel={() => navigate('/dashboard')} currentUser={currentUser} users={users} />
        } />
        
        <Route path="/financials" element={<CostRevenuePage />} />
        <Route path="/calculator" element={<AirFreightCalculator />} />
        <Route path="/users" element={<UserManagement onUserUpdate={refreshUsers} currentUser={currentUser} />} />
        <Route path="/locations" element={<LocationManagement key={dataVersion} currentUser={currentUser} />} />
        <Route path="/carriers" element={<ForwarderManagement currentUser={currentUser} />} />
        
        <Route path="/settings" element={<SettingsPage currentUser={currentUser} />} />
        
        <Route path="*" element={<div className="p-8 text-center">404 - Page Not Found</div>} />
      </Routes>

      {deleteConfirmation.show && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"><div className="p-6 text-center"><div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2 size={24} /></div><h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3><p className="text-sm text-slate-500 mt-2">Delete <span className="font-bold">{deleteConfirmation.ids.length}</span> records?</p><div className="flex gap-3 mt-6"><button onClick={() => setDeleteConfirmation({ show: false, ids: [] })} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex-1">Cancel</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 flex-1">Delete</button></div></div></div></div>}

      {showRefreshPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Session Inactive</h3>
              <p className="text-sm text-slate-500 mt-2">
                You've been inactive for a while. Please refresh the page to ensure you have the latest data.
              </p>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowRefreshPrompt(false)} 
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex-1"
                >
                  Dismiss
                </button>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex-1"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
