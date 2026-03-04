
import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { MessageSquare, ShieldCheck, Mail, X, User as UserIcon, AlertTriangle, ChevronDown } from 'lucide-react';
import { User } from '../../types';
import { RequestFormValues } from '../../services/validationSchemas';

interface ApproverSectionProps {
  register: UseFormRegister<RequestFormValues>;
  errors: FieldErrors<RequestFormValues>;
  approvers: User[];
  availableSecondApprovers: User[];
  ccList: string[];
  ccInput: string;
  setCcInput: React.Dispatch<React.SetStateAction<string>>;
  setShowCcDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  showCcDropdown: boolean;
  filteredCcUsers: User[];
  addCcEmail: (email: string) => void;
  removeCcEmail: (email: string) => void;
}

const ApproverSection: React.FC<ApproverSectionProps> = ({
  register, errors, approvers, availableSecondApprovers, ccList, ccInput, setCcInput, setShowCcDropdown, showCcDropdown, filteredCcUsers, addCcEmail, removeCcEmail
}) => {
  return (
    <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-500" /> Shipment Remarks
            </h3>
            <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea {...register('commodity')} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" rows={3} />
            </div>
        </div>

        {approvers.length > 0 ? (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                    <ShieldCheck size={18} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Approval Workflow</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">First Approver</label>
                        <select {...register('firstApprover')} className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm ${errors.firstApprover ? 'border-red-300' : 'border-slate-300'}`}>
                            <option value="">Select First Approver</option>
                            {approvers.map(u => (<option key={u.id} value={u.email}>{u.name} ({u.role})</option>))}
                        </select>
                        {errors.firstApprover && <p className="text-xs text-red-500 mt-1">{errors.firstApprover.message}</p>}
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Second Approver</label>
                        <select {...register('secondApprover')} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm" disabled={availableSecondApprovers.length === 0}>
                            <option value="">{availableSecondApprovers.length === 0 ? "None available" : "None (Optional)"}</option>
                            {availableSecondApprovers.map(u => (<option key={u.id} value={u.email}>{u.name} ({u.role})</option>))}
                        </select>
                    </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Mail size={12} /> CC Notifications</label>
                    <div className="w-full border border-slate-300 rounded-lg p-2 bg-white focus-within:ring-2 focus-within:ring-indigo-500 flex flex-wrap gap-2">
                        {ccList.map((email) => (
                            <span key={email} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold border border-indigo-100">{email}<button type="button" onClick={() => removeCcEmail(email)} className="hover:text-indigo-900"><X size={12}/></button></span>
                        ))}
                        <div className="relative flex-1 min-w-[200px]">
                            <div className="flex items-center border border-transparent rounded bg-transparent w-full">
                                <input 
                                    type="text" 
                                    className="w-full outline-none text-sm bg-transparent h-full py-1 pr-6" 
                                    placeholder="Add email..." 
                                    value={ccInput} 
                                    onChange={(e) => { setCcInput(e.target.value); setShowCcDropdown(true); }} 
                                    onFocus={() => setShowCcDropdown(true)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCcEmail(ccInput.trim()); } if (e.key === 'Backspace' && !ccInput && ccList.length > 0) { removeCcEmail(ccList[ccList.length - 1]); } }} 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowCcDropdown(!showCcDropdown)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1"
                                >
                                    <ChevronDown size={14} className={`transition-transform ${showCcDropdown ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            
                            {showCcDropdown && filteredCcUsers.length > 0 && (
                                <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                                    {filteredCcUsers.map(u => (
                                        <button key={u.id} type="button" onClick={() => addCcEmail(u.email)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 group">
                                            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"><UserIcon size={12}/></div><div><div className="font-semibold text-slate-700">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-800 text-sm"><AlertTriangle size={20} /><div><span className="font-bold">No specific approvers available.</span> Request will be routed to Admins.</div></div>
        )}
    </div>
  );
};

export default ApproverSection;
