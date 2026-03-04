
import React, { useState, useEffect } from 'react';
import { forwarderService, Forwarder } from '../services/carrierService';
import { User } from '../types';
import { Plus, Trash2, Search, X, Loader2, Save, Truck, CheckCircle, Edit2, AlertTriangle } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

interface ForwarderManagementProps {
  currentUser: User | null;
}

const ForwarderManagement: React.FC<ForwarderManagementProps> = ({ currentUser }) => {
  const [forwarders, setForwarders] = useState<Forwarder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [editingForwarder, setEditingForwarder] = useState<Forwarder | null>(null);
  const [forwarderToDelete, setForwarderToDelete] = useState<Forwarder | null>(null);
  const [forwarderName, setForwarderName] = useState('');
  const [updateHistorical, setUpdateHistorical] = useState(false);

  const canEdit = !!currentUser;

  useEffect(() => {
    fetchForwarders();
  }, []);

  const fetchForwarders = async () => {
    setLoading(true);
    const data = await forwarderService.getAllForwarders();
    setForwarders(data);
    setLoading(false);
  };

  const handleOpenAddModal = () => {
    setEditingForwarder(null);
    setForwarderName('');
    setUpdateHistorical(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (forwarder: Forwarder) => {
    setEditingForwarder(forwarder);
    setForwarderName(forwarder.name);
    setUpdateHistorical(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forwarderName.trim()) return;
    
    try {
      await forwarderService.upsertForwarder(
        { id: editingForwarder?.id, name: forwarderName.trim(), status: 'ACTIVE' }, 
        editingForwarder?.name,
        updateHistorical
      );
      setForwarderName('');
      setIsModalOpen(false);
      fetchForwarders();
    } catch (e) {
      alert("Failed to save forwarder. Ensure the name is unique.");
    }
  };

  const initiateDelete = (forwarder: Forwarder) => {
    setForwarderToDelete(forwarder);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!forwarderToDelete?.id) return;
    try {
      await forwarderService.deleteForwarder(forwarderToDelete.id);
      setIsDeleteModalOpen(false);
      setForwarderToDelete(null);
      fetchForwarders();
    } catch (e) {
      alert("Failed to delete forwarder.");
    }
  };

  const filtered = forwarders.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="text-indigo-600" /> Forwarder Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage approved freight forwarders for request selection.</p>
        </div>
        {canEdit && (
          <button onClick={handleOpenAddModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm transition-all active:scale-95">
            <Plus size={18} /> Add Forwarder
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Search forwarders..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Forwarder Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                {canEdit && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                    {canEdit && <td className="px-6 py-4"><Skeleton className="h-8 w-16 ml-auto" /></td>}
                  </tr>
                ))
              ) : filtered.map(c => (
                <tr key={c.id || c.name} className="hover:bg-slate-50 group transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{c.name}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                      <CheckCircle size={12} /> Active
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenEditModal(c)} className="p-2 text-slate-400 hover:text-indigo-600 rounded transition-colors opacity-0 group-hover:opacity-100" title="Edit Forwarder"><Edit2 size={18} /></button>
                        <button onClick={() => initiateDelete(c)} className="p-2 text-slate-400 hover:text-red-600 rounded transition-colors opacity-0 group-hover:opacity-100" title="Delete Forwarder"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={3} className="py-12 text-center text-slate-400 italic">No forwarders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{editingForwarder ? 'Edit Forwarder' : 'Add New Forwarder'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Forwarder Name</label>
                <input required autoFocus type="text" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-lg" placeholder="e.g. Kuehne + Nagel" value={forwarderName} onChange={e => setForwarderName(e.target.value)} />
              </div>
              {editingForwarder && forwarderName.trim() !== editingForwarder.name && (
                  <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-100">
                      <input type="checkbox" id="updateHistorical" checked={updateHistorical} onChange={e => setUpdateHistorical(e.target.checked)} className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                      <label htmlFor="updateHistorical" className="text-xs text-slate-700 cursor-pointer"><span className="font-bold block mb-0.5">Update historical records?</span> This will rename <span className="font-semibold text-slate-900">"{editingForwarder.name}"</span> to <span className="font-semibold text-slate-900">"{forwarderName}"</span> in all past shipment logs.</label>
                  </div>
              )}
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"><Save size={18} /> {editingForwarder ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && forwarderToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"><div className="p-6 text-center"><div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><Trash2 size={24} /></div><h3 className="text-lg font-bold text-slate-900">Delete Forwarder?</h3><p className="text-sm text-slate-500 mt-2">Are you sure you want to remove <span className="font-bold text-slate-800">{forwarderToDelete.name}</span> from the directory?</p><div className="flex gap-3 mt-6 justify-center"><button onClick={() => { setIsDeleteModalOpen(false); setForwarderToDelete(null); }} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex-1">Cancel</button><button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-sm transition-all active:scale-95 flex-1">Delete</button></div></div></div></div>
      )}
    </div>
  );
};

export default ForwarderManagement;