
import React, { useState } from 'react';
import { User, AppTheme } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { userService } from '../services/userService';
import { useToast } from '../contexts/ToastContext';
import ConnectionStatusModal from './ConnectionStatusModal';
import { 
  Settings, Database, Save, KeyRound, 
  CheckCircle, Shield, Loader2, Palette, RefreshCw
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { SQL_SCHEMA } from '../services/schemaDefinition';

interface SettingsPageProps {
  currentUser: User | null;
}

const THEMES: { id: AppTheme; label: string; color: string }[] = [
  { id: 'indigo', label: 'Indigo (Default)', color: 'bg-indigo-500' },
  { id: 'blue', label: 'Ocean Blue', color: 'bg-blue-500' },
  { id: 'emerald', label: 'Emerald Forest', color: 'bg-emerald-500' },
  { id: 'rose', label: 'Rose Passion', color: 'bg-rose-500' },
  { id: 'violet', label: 'Royal Violet', color: 'bg-violet-500' },
  { id: 'cyan', label: 'Cyan Tech', color: 'bg-cyan-500' },
  { id: 'amber', label: 'Amber Sunset', color: 'bg-amber-500' },
];

const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser }) => {
  const { currentTheme, setTheme } = useTheme();
  const { success, error, toast } = useToast();
  
  const [passcode, setPasscode] = useState('');
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [isUpdatingSchema, setIsUpdatingSchema] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';

  const handlePasscodeUpdate = async () => {
    if (!currentUser) return;
    if (passcode.length !== 4) {
      alert("Passcode must be exactly 4 digits.");
      return;
    }
    
    setIsSavingPasscode(true);
    try {
      await userService.updateUser(currentUser.id, { passcode });
      success("Passcode updated successfully.");
      setPasscode('');
    } catch (e: any) {
      error(e.message || "Failed to update passcode.");
    } finally {
      setIsSavingPasscode(false);
    }
  };

  const handleRunSchemaUpdate = async () => {
      if (!confirm("This will attempt to update database Views. This is usually safe but should only be done if you are experiencing data aggregation issues.\n\nContinue?")) return;
      
      setIsUpdatingSchema(true);
      try {
          const { error: rpcError } = await supabase.rpc('exec_sql', { sql: SQL_SCHEMA });
          
          if (rpcError) {
              console.error("RPC Error:", rpcError);
              // Fallback: If exec_sql RPC doesn't exist (common in standard setups), we can't run DDL from client.
              // We just show a message with the SQL to run manually.
              error("Automated update failed. Copy the SQL Schema from 'services/schemaDefinition.ts' and run it in Supabase SQL Editor.");
          } else {
              success("Schema and Views updated successfully.");
          }
      } catch (e) {
          console.error(e);
          error("Failed to run schema update. Please use Supabase SQL Editor.");
      } finally {
          setIsUpdatingSchema(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-700">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm">Manage your preferences and security.</p>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Palette size={20} className="text-indigo-500" /> Appearance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => setTheme(theme.id)}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                currentTheme === theme.id 
                  ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50' 
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-8 h-8 rounded-full ${theme.color} mb-3 shadow-sm`}>
                {currentTheme === theme.id && (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <CheckCircle size={16} />
                  </div>
                )}
              </div>
              <p className="font-semibold text-slate-700 text-sm">{theme.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Shield size={20} className="text-emerald-500" /> Security
        </h2>
        <div className="max-w-md">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Update Access PIN</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                maxLength={4}
                placeholder="New 4-digit PIN" 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono tracking-widest"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
            <button 
              onClick={handlePasscodeUpdate}
              disabled={isSavingPasscode || passcode.length !== 4}
              className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingPasscode ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Update
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">This PIN is required to log in to your account.</p>
        </div>
      </div>

      {/* System Admin (Only for Admins) */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Database size={20} className="text-amber-500" /> System Configuration
          </h2>
          <p className="text-sm text-slate-500 mb-4">Manage database connections and schema updates.</p>
          <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setShowSystemModal(true)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2"
              >
                <Settings size={16} /> Configure Connections
              </button>
              
              <button 
                onClick={handleRunSchemaUpdate}
                disabled={isUpdatingSchema}
                className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 font-medium rounded-lg hover:bg-amber-100 flex items-center gap-2 disabled:opacity-50"
              >
                {isUpdatingSchema ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
                Update Database Views
              </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 italic">Note: "Update Database Views" attempts to refresh the SQL logic for financial calculations. Use this if categorization seems incorrect.</p>
        </div>
      )}

      {showSystemModal && (
        <ConnectionStatusModal onClose={() => setShowSystemModal(false)} />
      )}
    </div>
  );
};

export default SettingsPage;
