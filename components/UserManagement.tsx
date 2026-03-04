
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { userService } from '../services/userService';
import { Search, Plus, Edit2, Trash2, Shield, User as UserIcon, CheckCircle, XCircle, Mail, Briefcase, Loader2, Save, X, AlertTriangle, Key, CloudOff, ShieldAlert, AlertCircle } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

interface UserManagementProps {
  onUserUpdate?: () => void;
  currentUser?: User | null;
}

const UserManagement: React.FC<UserManagementProps> = ({ onUserUpdate, currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMockData, setIsMockData] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [securityAlert, setSecurityAlert] = useState<{ title: string; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'REQUESTER',
    department: '',
    status: 'ACTIVE',
    passcode: ''
  });

  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
      setIsMockData(userService.isUsingMockData());
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (!isAdmin) return; 
    setFormError(null);

    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status,
        passcode: user.passcode || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'REQUESTER',
        department: '',
        status: 'ACTIVE',
        passcode: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!formData.name || !formData.email) return;
    
    setFormError(null);

    try {
      if (editingUser) {
        await userService.updateUser(editingUser.id, formData);
      } else {
        await userService.createUser(formData as Omit<User, 'id'>);
      }
      setIsModalOpen(false);
      await fetchUsers();
      if (onUserUpdate) onUserUpdate();
    } catch (error: any) {
      console.error("Failed to save user", error);
      setFormError(error.message || "An unexpected error occurred while saving.");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, user: User) => {
     e.preventDefault();
     e.stopPropagation();
     if (!isAdmin) return;
     if (currentUser && user.id === currentUser.id) {
         setSecurityAlert({ title: "Action Denied", message: "You cannot delete your own account." });
         return;
     }
     if (user.role === 'ADMIN') {
         const adminUsers = users.filter(u => u.role === 'ADMIN');
         if (adminUsers.length <= 1) {
             setSecurityAlert({ title: "Cannot Delete Admin", message: "You cannot delete the only Administrator in the system. Create another Admin first." });
             return;
         }
         const activeAdmins = adminUsers.filter(u => u.status === 'ACTIVE');
         if (user.status === 'ACTIVE' && activeAdmins.length <= 1) {
             setSecurityAlert({ title: "System Lockout Prevention", message: "You cannot delete the only ACTIVE Administrator. Please activate another Admin account before proceeding." });
             return;
         }
     }
     setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete || !isAdmin) return;
    try {
      await userService.deleteUser(userToDelete.id);
      await fetchUsers();
      if (onUserUpdate) onUserUpdate();
      setUserToDelete(null);
    } catch (error) {
      console.error("Failed to delete user", error);
      setSecurityAlert({ title: "Error", message: "Failed to delete user. Please try again." });
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'APPROVER': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'LOGISTICS': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'REQUESTER': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? 'Manage access and roles for the FreightGuard system.' : 'View system users and roles.'}
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Plus size={18} /> Add New User
          </button>
        )}
      </div>

      {isMockData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 text-sm text-amber-800">
           <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
           <div>
             <strong>Local Mode:</strong> The application is running with local storage because the database connection failed or the table 'app_users' is missing. 
             Changes will persist in this browser but may not appear in the central database.
           </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-slate-50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, email, or department..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-slate-500 ml-auto hidden md:block">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
             <div className="p-6 space-y-4">
               {Array.from({length: 6}).map((_, i) => (
                 <div key={i} className="flex gap-4 p-4 border border-slate-100 rounded-lg">
                   <Skeleton className="w-10 h-10 rounded-full" />
                   <div className="flex-1 space-y-2">
                     <Skeleton className="h-4 w-1/3" />
                     <Skeleton className="h-3 w-1/4" />
                   </div>
                   <Skeleton className="h-8 w-20" />
                 </div>
               ))}
             </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                           <UserIcon size={20} />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{user.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                             <Mail size={10} /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Briefcase size={14} className="text-slate-400" />
                        {user.department || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {user.status === 'ACTIVE' ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded border border-green-100">
                            <CheckCircle size={12} /> Active
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-600 text-xs font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                            <AlertTriangle size={12} /> Inactive
                          </div>
                        )}
                        {isMockData && (
                            <div title="Local Storage Only" className="text-slate-400 ml-1">
                                <CloudOff size={14} />
                            </div>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button 
                             type="button"
                             onClick={() => handleOpenModal(user)}
                             className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                             title="Edit User"
                           >
                             <Edit2 size={16} />
                           </button>
                           <button 
                             type="button"
                             onClick={(e) => handleDeleteClick(e, user)}
                             className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                             title="Delete User"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                      </td>
                    )}
                  </tr>
                ))}
                
                {filteredUsers.length === 0 && (
                   <tr>
                     <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-slate-500">
                        No users found matching your search.
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex flex-col gap-2 text-sm mb-4">
                      <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <div className="flex-1 font-medium">{formError}</div>
                      </div>
                      {formError.includes("Database Schema Mismatch") && (
                          <div className="ml-6 mt-1">
                              <p className="text-xs text-slate-600 mb-1">Run this command in your Supabase SQL Editor:</p>
                              <code className="block font-mono bg-white p-2 rounded border border-red-200 text-xs select-all">
                                  ALTER TABLE "public"."app_users" DROP CONSTRAINT IF EXISTS "app_users_role_check";
                              </code>
                          </div>
                      )}
                  </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase placeholder:normal-case"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  placeholder="e.g. JOHN DOE"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email Address</label>
                <input 
                  required
                  type="email" 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="e.g. john@company.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Role</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  >
                    <option value="REQUESTER">Requester</option>
                    <option value="APPROVER">Approver</option>
                    <option value="LOGISTICS">Logistics</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Department</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g. Operations"
                  />
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Key size={14} className="text-slate-500" /> Security Passcode (4 Digits)
                 </label>
                 <input 
                    type="text" 
                    maxLength={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono tracking-wider"
                    value={formData.passcode}
                    onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setFormData({...formData, passcode: val});
                    }}
                    placeholder="e.g. 1234"
                  />
                  <p className="text-[10px] text-slate-400">Required for all users to access the system.</p>
              </div>

              <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-700">Account Status</label>
                 <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="radio" 
                         name="status"
                         value="ACTIVE"
                         checked={formData.status === 'ACTIVE'}
                         onChange={() => setFormData({...formData, status: 'ACTIVE'})}
                         className="text-indigo-600 focus:ring-indigo-500"
                       />
                       <span className="text-sm text-slate-700">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="radio" 
                         name="status"
                         value="INACTIVE"
                         checked={formData.status === 'INACTIVE'}
                         onChange={() => setFormData({...formData, status: 'INACTIVE'})}
                         className="text-slate-500 focus:ring-slate-500"
                       />
                       <span className="text-sm text-slate-700">Inactive</span>
                    </label>
                 </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2"><Save size={18} /> {editingUser ? 'Update User' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle size={24} /></div>
                <h3 className="text-lg font-bold text-slate-900">Delete User?</h3>
                <p className="text-sm text-slate-500 mt-2">Are you sure you want to delete <span className="font-bold text-slate-800">{userToDelete.name}</span>? This action cannot be undone.</p>
                <div className="flex gap-3 mt-6 justify-center">
                   <button onClick={() => setUserToDelete(null)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                   <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm">Delete User</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {securityAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600"><ShieldAlert size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-900">{securityAlert.title}</h3>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">{securityAlert.message}</p>
                    <div className="mt-6"><button onClick={() => setSecurityAlert(null)} className="w-full px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 shadow-sm transition-colors">Understood</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;