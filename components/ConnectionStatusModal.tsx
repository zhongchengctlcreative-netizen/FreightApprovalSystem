
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Database, Mail, Save, ExternalLink, Settings, Link, Loader2, Play } from 'lucide-react';
import { freightService } from '../services/freightService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { notificationService, EmailConfig } from '../services/notificationService';

interface ConnectionStatusModalProps {
  onClose: () => void;
}

const ConnectionStatusModal: React.FC<ConnectionStatusModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'database' | 'email'>('database');
  
  const isMock = freightService.isUsingMockData();
  const isDbConfigured = isSupabaseConfigured;
  
  const [runtimeUrl, setRuntimeUrl] = useState('');
  const [runtimeKey, setRuntimeKey] = useState('');

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({ serviceId: '', templateId: '', publicKey: '', ccEmail: '' });
  const [testEmail, setTestEmail] = useState('');
  const [isEmailConfigLoading, setIsEmailConfigLoading] = useState(true);
  const [isEmailSaving, setIsEmailSaving] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);
  const [isEmailConfigSaved, setIsEmailConfigSaved] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const storedUrl = localStorage.getItem('fg_supabase_url');
    const storedKey = localStorage.getItem('fg_supabase_key');
    if (storedUrl) setRuntimeUrl(storedUrl);
    if (storedKey) setRuntimeKey(storedKey);
  }, []);

  useEffect(() => {
    if (activeTab === 'email') {
      const loadConfig = async () => {
        setIsEmailConfigLoading(true);
        const config = await notificationService.getConfig();
        setEmailConfig(config);
        setIsEmailConfigSaved(!!(config.serviceId && config.templateId && config.publicKey));
        setIsEmailConfigLoading(false);
      };
      loadConfig();
    }
  }, [activeTab]);

  const handleSaveRuntimeConfig = () => {
    if (runtimeUrl) localStorage.setItem('fg_supabase_url', runtimeUrl.trim());
    else localStorage.removeItem('fg_supabase_url');
    if (runtimeKey) localStorage.setItem('fg_supabase_key', runtimeKey.trim());
    else localStorage.removeItem('fg_supabase_key');
    window.location.reload();
  };

  const handleClearRuntimeConfig = () => {
    localStorage.removeItem('fg_supabase_url');
    localStorage.removeItem('fg_supabase_key');
    window.location.reload();
  };

  const handleSaveEmailConfig = async () => {
    setIsEmailSaving(true);
    setNotification(null);
    try {
      await notificationService.saveConfig(emailConfig);
      setIsEmailConfigSaved(!!(emailConfig.serviceId && emailConfig.templateId && emailConfig.publicKey));
      setNotification({ type: 'success', message: 'Email configuration saved successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (e) { 
        setNotification({ type: 'error', message: "Failed to save email config. Ensure 'cc_email' column exists in database." });
    }
    finally { setIsEmailSaving(false); }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) return alert("Enter email.");
    setIsTestSending(true);
    try {
      // Fetch latest request for context
      const { requests } = await freightService.getRequests({ pageSize: 1 });
      const sample = requests.length > 0 ? requests[0] : undefined;
      
      await notificationService.sendTestEmail(testEmail, sample);
      setNotification({ 
          type: 'success', 
          message: sample ? `Sent test email using data from Log #${sample.id}` : "Sent generic test email (no shipments found)." 
      });
    } catch (e) { 
        setNotification({ type: 'error', message: "Failed to send test email. Check console." });
        console.error(e);
    } finally { 
        setIsTestSending(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Settings size={20} className="text-indigo-600" /> System Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <div className="flex border-b border-slate-200">
          <button onClick={() => setActiveTab('database')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'database' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}><Database size={16} /> Database Connection</button>
          <button onClick={() => setActiveTab('email')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'email' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}><Mail size={16} /> Email Notifications</button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                 <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Link size={16} className="text-indigo-600" /> Manual Connection</h3>
                 <div className="space-y-3">
                    <div><label className="text-xs font-semibold text-slate-600 uppercase">Project URL</label><input type="text" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" placeholder="https://xyz.supabase.co" value={runtimeUrl} onChange={e => setRuntimeUrl(e.target.value)} /></div>
                    <div><label className="text-xs font-semibold text-slate-600 uppercase">Anon Key</label><input type="password" className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono" placeholder="eyJh..." value={runtimeKey} onChange={e => setRuntimeKey(e.target.value)} /></div>
                    <div className="flex gap-2 justify-end pt-2">
                        {localStorage.getItem('fg_supabase_url') && (<button onClick={handleClearRuntimeConfig} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded">Clear</button>)}
                        <button onClick={handleSaveRuntimeConfig} className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 flex items-center gap-2"><Save size={14} /> Save & Connect</button>
                    </div>
                 </div>
              </div>
            </div>
          )}
          {activeTab === 'email' && (
             <div className="space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><ExternalLink size={16} /> EmailJS Variables</h3>
                  <p className="text-xs text-indigo-700 mb-2">Configure your template to use these dynamic variables:</p>
                  <code className="block text-xs bg-white p-2 rounded border border-indigo-200 text-slate-600">
                    &#123;&#123;to_name&#125;&#125;, &#123;&#123;to_email&#125;&#125;, &#123;&#123;cc_email&#125;&#125;, &#123;&#123;subject&#125;&#125;, &#123;&#123;message&#125;&#125;, &#123;&#123;action_url&#125;&#125;
                  </code>
                </div>
                
                {/* Notification Area */}
                {notification && (
                    <div className={`p-3 rounded-lg border flex items-center gap-2 text-sm animate-fade-in ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                        <span>{notification.message}</span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-xs font-semibold text-slate-500">Service ID</label><input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={emailConfig.serviceId} onChange={e => setEmailConfig({...emailConfig, serviceId: e.target.value})} /></div>
                  <div className="space-y-1"><label className="text-xs font-semibold text-slate-500">Template ID</label><input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={emailConfig.templateId} onChange={e => setEmailConfig({...emailConfig, templateId: e.target.value})} /></div>
                  <div className="col-span-2 space-y-1"><label className="text-xs font-semibold text-slate-500">Public Key</label><input type="password" className="w-full px-3 py-2 border rounded-lg text-sm" value={emailConfig.publicKey} onChange={e => setEmailConfig({...emailConfig, publicKey: e.target.value})} /></div>
                  <div className="col-span-2 space-y-1"><label className="text-xs font-semibold text-slate-500">CC Email (Optional)</label><input type="email" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="manager@company.com" value={emailConfig.ccEmail || ''} onChange={e => setEmailConfig({...emailConfig, ccEmail: e.target.value})} /></div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            placeholder="Email for test..." 
                            className="px-3 py-2 border rounded-lg text-sm w-48"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                        />
                        <button 
                            onClick={handleSendTestEmail} 
                            disabled={isTestSending || !emailConfig.serviceId} 
                            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 text-sm"
                            title="Sends a test using real shipment data (latest record)"
                        >
                            {isTestSending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
                            Simulate
                        </button>
                    </div>
                    
                    <button onClick={handleSaveEmailConfig} disabled={isEmailSaving} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                        {isEmailSaving && <Loader2 size={14} className="animate-spin" />} Save Configuration
                    </button>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatusModal;
