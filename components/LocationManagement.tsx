
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { freightService } from '../services/freightService';
import { destinationService, Destination } from '../services/destinationService';
import { User, FreightRequest } from '../types';
import { Loader2, AlertTriangle, Plus, Trash2, Search, X, MapPin, Database, Edit3, Check, Info, RefreshCw, Globe, Save, Filter, Mail } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

interface LocationManagementProps {
  currentUser: User | null;
}

const REGION_OPTIONS = ['CLEU', 'CLPL', 'CLI', 'CLCI', 'FBA', 'OTHER'];

interface DisplayEntry {
  id?: string;
  code: string;
  description: string;
  region: string;
  ccEmails?: string;
  isInShipments: boolean;
  isMaster: boolean;
  original: Destination | null;
}

const LocationManagement: React.FC<LocationManagementProps> = ({ currentUser }) => {
  const [shipmentDests, setShipmentDests] = useState<Map<string, string>>(new Map());
  const [masterDests, setMasterDests] = useState<Destination[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DisplayEntry | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<DisplayEntry | null>(null);
  const [updateHistorical, setUpdateHistorical] = useState(false);
  
  const [formData, setFormData] = useState({ id: undefined as string | undefined, code: '', description: '', region: 'CLEU', ccEmails: '' });

  const canEdit = !!currentUser;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsResult, destinations]: [{ requests: FreightRequest[]; totalCount: number }, Destination[]] = await Promise.all([
        freightService.getRequests({ pageSize: 10000 }),
        destinationService.getAll(),
      ]);

      const { requests } = requestsResult;

      const uniqueShipmentCodes = new Map<string, string>();
      requests.forEach(req => {
        if (req.destCode && req.status !== 'CANCELLED') {
          const code = req.destCode.trim();
          if (!uniqueShipmentCodes.has(code.toUpperCase())) {
            uniqueShipmentCodes.set(code.toUpperCase(), code);
          }
        }
        if (req.originCode && req.status !== 'CANCELLED') {
          const code = req.originCode.trim();
          if (!uniqueShipmentCodes.has(code.toUpperCase())) {
            uniqueShipmentCodes.set(code.toUpperCase(), code);
          }
        }
      });
      
      setShipmentDests(uniqueShipmentCodes);
      setMasterDests(destinations);
    } catch (error) {
      console.error("Failed to load location data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const combinedData = useMemo(() => {
    // Map normalized (uppercase) code to Destination object (preserving original case)
    const masterDestMap: Map<string, Destination> = new Map(masterDests.map((d: Destination) => [d.code.toUpperCase().trim(), d]));
    
    const allCodes = new Set<string>([
      ...Array.from(shipmentDests.keys()),
      ...Array.from(masterDestMap.keys())
    ]);

    const list: DisplayEntry[] = Array.from(allCodes).map(normalizedCode => {
      const master = masterDestMap.get(normalizedCode);
      const shipmentOriginal = shipmentDests.get(normalizedCode);
      
      // Prefer original case from master record if available, otherwise use original case from shipment, fallback to normalized
      const displayCode = master ? master.code : (shipmentOriginal || normalizedCode);
      
      return {
        id: master?.id,
        code: displayCode,
        description: master?.description || '---',
        region: master?.region || 'OTHER',
        ccEmails: master?.ccEmails,
        isInShipments: shipmentDests.has(normalizedCode),
        isMaster: !!master,
        original: master || null
      };
    });

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [shipmentDests, masterDests]);

  const filteredData = useMemo(() => {
    let data = combinedData;
    if (statusFilter !== 'ALL') {
        if (statusFilter === 'MASTER') data = data.filter(item => item.isMaster);
        else if (statusFilter === 'UNDEFINED') data = data.filter(item => !item.isMaster);
        else if (statusFilter === 'IN_USE') data = data.filter(item => item.isInShipments);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(item => 
            item.code.toLowerCase().includes(lower) || 
            item.description.toLowerCase().includes(lower) ||
            item.region.toLowerCase().includes(lower)
        );
    }
    return data;
  }, [combinedData, searchTerm, statusFilter]);

  const handleOpenModal = (loc?: DisplayEntry) => {
    if (!canEdit) return;
    setUpdateHistorical(false);
    if (loc) {
      setEditingLocation(loc);
      setFormData({ 
          id: loc.id, 
          code: loc.code, 
          description: loc.isMaster ? loc.description : '', 
          region: loc.region,
          ccEmails: loc.ccEmails || ''
      });
    } else {
      setEditingLocation(null);
      setFormData({ id: undefined, code: '', description: '', region: 'CLEU', ccEmails: '' });
    }
    setIsModalOpen(true);
  };
  
  const handleRegionChange = async (dest: Destination, newRegion: string) => {
    if (!dest.id) {
      alert("Please add this location to the master directory first to assign a region.");
      return;
    }
    setSaving(true);
    try {
      const updatedDest = { ...dest, region: newRegion };
      await destinationService.upsert(updatedDest);
      setMasterDests(prevDests => prevDests.map(d => d.id === dest.id ? updatedDest : d));
    } catch (e) {
      alert("Failed to update region.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) return;
    setSaving(true);
    try {
      const destPayload: Destination = {
        id: formData.id,
        code: formData.code.trim().toUpperCase(),
        description: formData.description,
        region: formData.region,
        ccEmails: formData.ccEmails
      };
      
      // Pass the old code and historical flag to the service
      await destinationService.upsert(destPayload, editingLocation?.code, updateHistorical);
      
      setIsModalOpen(false);
      await fetchData();
    } catch (e) {
      alert("Failed to save location. Code must be unique.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!locationToDelete || !locationToDelete.id) return;
    setSaving(true);
    try {
      await destinationService.delete(locationToDelete.id);
      setLocationToDelete(null);
      await fetchData();
    } catch (e) {
      alert("Failed to delete location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Globe className="text-indigo-600" /> Location Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage destination codes, regions, and default notification groups.</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => fetchData()} disabled={loading} className="p-2 text-slate-500 hover:bg-slate-50 border rounded-lg"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
            {canEdit && (
              <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm"><Plus size={18} /> Add Location</button>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by code, description, region..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                />
            </div>
            
            <div className="relative w-full md:w-auto">
                <select 
                    className="w-full md:w-auto pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white min-w-[160px] font-medium text-slate-700"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="ALL">All Status</option>
                    <option value="MASTER">Master Records</option>
                    <option value="UNDEFINED">Undefined (Missing)</option>
                    <option value="IN_USE">In Use</option>
                </select>
                <Filter className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70 border-b border-slate-200"><tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Region</th>
              <th className="px-6 py-4">Default CC Group</th>
              {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-32" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                    {canEdit && <td className="px-6 py-4"><Skeleton className="h-8 w-16 ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredData.map(loc => (
                <tr key={loc.code} className="hover:bg-slate-50 group transition-colors">
                  <td className="px-6 py-3"><div className="flex flex-col gap-1.5">{loc.isMaster ? <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit"><Database size={10}/> MASTER</div> : <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit"><AlertTriangle size={10}/> UNDEFINED</div>} {loc.isInShipments && <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit"><MapPin size={10}/> IN-USE</div>}</div></td>
                  <td className="px-6 py-3"><span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">{loc.code}</span></td>
                  <td className="px-6 py-3 font-medium text-slate-700">{loc.description}</td>
                  <td className="px-6 py-3">
                    <select 
                      value={loc.region} 
                      onChange={e => handleRegionChange(loc.original!, e.target.value)} 
                      disabled={!canEdit || saving || !loc.isMaster} 
                      className={`w-full max-w-[150px] px-3 py-1.5 border rounded-lg text-sm bg-white ${loc.region === 'OTHER' ? 'text-slate-400' : 'font-semibold text-slate-800'} disabled:bg-slate-50 disabled:cursor-not-allowed`}
                    >
                      {REGION_OPTIONS.map(opt => <option key={opt} value={opt} className="text-slate-800 font-medium">{opt}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-3">
                      {loc.ccEmails ? (
                          <div title={loc.ccEmails} className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded max-w-[200px] truncate">
                              <Mail size={12} className="shrink-0 text-slate-400" />
                              <span className="truncate">{loc.ccEmails}</span>
                          </div>
                      ) : (
                          <span className="text-slate-300 text-xs italic">None</span>
                      )}
                  </td>
                  {canEdit && <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(loc)} className="p-2 text-slate-400 hover:text-indigo-600 rounded"><Edit3 size={16} /></button>
                      {loc.isMaster && (
                        <button onClick={() => setLocationToDelete(loc)} disabled={loc.isInShipments} title={loc.isInShipments ? 'Cannot delete: location is in use by active shipments.' : 'Delete Location'} className={`p-2 rounded transition-colors ${loc.isInShipments ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600'}`}><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>}
                </tr>
              ))}
              
              {!loading && filteredData.length === 0 && (
                  <tr>
                      <td colSpan={canEdit ? 6 : 5} className="px-6 py-12 text-center text-slate-500 italic">
                          No locations found matching your filters.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50"><h2 className="text-lg font-bold text-slate-800">{editingLocation ? 'Edit Location' : 'Add New Location'}</h2><button onClick={() => setIsModalOpen(false)}><X/></button></div>
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div><label className="text-xs font-bold uppercase">Code</label><input required autoFocus type="text" maxLength={20} className="w-full p-2 border rounded font-mono uppercase" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} /></div>
            <div><label className="text-xs font-bold uppercase">Description</label><input type="text" className="w-full p-2 border rounded" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div><label className="text-xs font-bold uppercase">Region</label><select className="w-full p-2 border rounded bg-white" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})}>{REGION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
            
            <div>
                <label className="text-xs font-bold uppercase flex items-center gap-1"><Mail size={12}/> Default CC Emails</label>
                <textarea className="w-full p-2 border rounded text-sm mt-1" rows={2} placeholder="email1@example.com, email2@example.com" value={formData.ccEmails} onChange={e => setFormData({...formData, ccEmails: e.target.value})} />
                <p className="text-[10px] text-slate-400 mt-1">These emails will be automatically added to new requests for this destination.</p>
            </div>

            {/* Historical Update Checkbox - Only show if editing an existing record and values changed */}
            {editingLocation && (formData.code !== editingLocation.code || formData.description !== editingLocation.description) && (
                <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100 mb-4">
                    <input 
                        type="checkbox" 
                        id="updateHistorical" 
                        checked={updateHistorical} 
                        onChange={e => setUpdateHistorical(e.target.checked)} 
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" 
                    />
                    <label htmlFor="updateHistorical" className="text-xs text-slate-700 cursor-pointer">
                        <span className="font-bold block mb-0.5">Update historical shipments?</span> 
                        Apply this change to all existing shipments currently using <span className="font-semibold text-slate-900">"{editingLocation.code}"</span>.
                    </label>
                </div>
            )}

            <div className="pt-4 flex gap-3"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-2 border rounded">Cancel</button><button type="submit" disabled={saving} className="flex-1 p-2 bg-indigo-600 text-white rounded font-bold flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin"/> : <Save/>} {editingLocation ? 'Update' : 'Save'}</button></div>
          </form>
        </div></div>
      )}

      {locationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"><div className="bg-white rounded-xl p-6 max-w-sm w-full text-center animate-fade-in-up">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2/></div>
          <h3 className="text-lg font-bold">Delete Location?</h3>
          <p className="text-sm text-slate-500 mt-2">Delete <span className="font-bold">{locationToDelete.code}</span> from the master directory?</p>
          <div className="flex gap-3 mt-6"><button onClick={() => setLocationToDelete(null)} className="flex-1 p-2 border rounded">Cancel</button><button onClick={confirmDelete} disabled={saving} className="flex-1 p-2 bg-red-600 text-white rounded font-bold">{saving?<Loader2 className="animate-spin mx-auto"/>:'Delete'}</button></div>
        </div></div>
      )}
    </div>
  );
};

export default LocationManagement;
