
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, List, PlusCircle, Settings, Truck, Database, Users, User as UserIcon, ChevronDown, LogOut, Lock, KeyRound, Map as MapIcon, TrendingUp, Ship, Globe, Bell, CheckCircle, Info, AlertTriangle, Search, Plus, Command, Menu, BarChart3, Calculator, Calendar } from 'lucide-react';
import { User, AppNotification } from '../types';
import { useUser } from '../contexts/UserContext';
import { useLocation } from 'react-router-dom';
import { useNavigationBlocker } from '../contexts/NavigationBlockerContext';
import VersionChecker from './VersionChecker';
import { notificationService } from '../services/notificationService';
import { supabase } from '../services/supabaseClient';
import { getDaysRemaining } from '../services/freightHelpers';
import { isFuture, parseISO } from 'date-fns';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, users, login: switchUser, logout } = useUser();
  const { navigateWithCheck } = useNavigationBlocker(); // Use custom navigation
  const location = useLocation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [upcomingArrivals, setUpcomingArrivals] = useState<any[]>([]);
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarRefDesktop = useRef<HTMLDivElement>(null);
  
  // Global Search Ref
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [inputPasscode, setInputPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { path: '/trends', label: 'Trends', icon: BarChart3, adminOnly: false },
    { path: '/calendar', label: 'Calendar', icon: Calendar, adminOnly: false },
    { path: '/financials', label: 'Cost vs Revenue', icon: TrendingUp, adminOnly: false },
    { path: '/calculator', label: 'Air Freight Calculator', icon: Calculator, adminOnly: true },
    { path: '/new', label: 'New Request', icon: PlusCircle, adminOnly: false },
    { path: '/approvals', label: 'Approvals', icon: List, adminOnly: false },
    { path: '/shipments', label: 'Shipment Data', icon: Database, adminOnly: false },
    { path: '/users', label: 'User Mgmt', icon: Users, adminOnly: false },
    { path: '/carriers', label: 'Forwarders', icon: Ship, adminOnly: false },
    { path: '/locations', label: 'Locations', icon: Globe, adminOnly: false },
  ];

  // Mobile Navigation Items (Bottom Bar)
  const mobileNavItems = [
    { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { path: '/approvals', label: 'Approvals', icon: List },
    { path: '/new', label: 'New', icon: PlusCircle, highlight: true },
    { path: '/shipments', label: 'Data', icon: Database },
    { path: '/calculator', label: 'Calc', icon: Calculator },
  ];

  // Poll for notifications - Increased poll time for stability
  useEffect(() => {
      if (!currentUser?.email) return;
      
      const fetchNotifs = async () => {
          const data = await notificationService.getMyNotifications(currentUser.email);
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.is_read).length);
      };

      fetchNotifs();
      const interval = setInterval(fetchNotifs, 10000); // 10s poll
      return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setShowNotifications(false);
          }
          if (calendarRef.current && !calendarRef.current.contains(event.target as Node) && 
              calendarRefDesktop.current && !calendarRefDesktop.current.contains(event.target as Node)) {
              setShowCalendar(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUpcomingArrivals = async () => {
      try {
        const today = new Date().toISOString();
        const { data, error } = await supabase
          .from('freight_raw_full')
          .select('id, vessel_name, eta, ata, destination, destination_code')
          .gte('eta', today)
          .neq('status', 'COMPLETED')
          .neq('status', 'DELIVERED')
          .neq('status', 'CANCELLED')
          .order('eta', { ascending: true })
          .limit(10);

        if (error) throw error;
        setUpcomingArrivals(data || []);
      } catch (err) {
        console.error("Error fetching upcoming arrivals:", err);
      }
    };

    fetchUpcomingArrivals();
    const interval = setInterval(fetchUpcomingArrivals, 60000); // 1 min poll
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcut for Search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNotificationClick = async (n: AppNotification) => {
      if (!n.is_read) {
          await notificationService.markAsRead([n.id]);
          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
          setUnreadCount(prev => Math.max(0, prev - 1));
      }
      if (n.link) {
          setShowNotifications(false);
          navigateWithCheck(n.link);
      }
  };

  const markAllRead = async () => {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length > 0) {
          await notificationService.markAsRead(unreadIds);
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
          setUnreadCount(0);
      }
  };

  const handleUserSwitchRequest = (user: User) => {
    if (user.status === 'INACTIVE') {
        alert(`Access Denied: The user account '${user.name}' is currently INACTIVE.`);
        return;
    }
    if (!user.passcode) {
         alert(`Security Alert: The user '${user.name}' has no passcode set.`);
         return;
    }
    setPendingUser(user);
    setShowPasscodeModal(true);
    setInputPasscode('');
    setPasscodeError(false);
    setShowUserMenu(false);
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!pendingUser) return;
      if (inputPasscode === pendingUser.passcode) {
          switchUser(pendingUser);
          setShowPasscodeModal(false);
          setPendingUser(null);
          navigateWithCheck('/dashboard'); // Use blocked nav check
      } else {
          setPasscodeError(true);
      }
  };

  const handleLogout = () => {
      logout();
      setShowUserMenu(false);
      navigateWithCheck('/'); 
  };

  const handleGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = e.currentTarget.value.trim();
      if (term) {
        navigateWithCheck(`/shipments?q=${encodeURIComponent(term)}`);
        // Optional: clear input or keep it
      }
    }
  };

  const isActive = (path: string) => {
      if (path === '/dashboard' && location.pathname === '/') return true;
      return location.pathname.startsWith(path);
  };

  const getNotifIcon = (type: string) => {
      if (type === 'SUCCESS') return <CheckCircle size={16} className="text-green-500" />;
      if (type === 'ERROR') return <AlertTriangle size={16} className="text-red-500" />;
      if (type === 'ACTION') return <Bell size={16} className="text-amber-500" />;
      return <Info size={16} className="text-blue-500" />;
  };

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/dashboard': return 'Overview';
      case '/trends': return 'Trends Analysis';
      case '/financials': return 'Financial Analysis';
      case '/calculator': return 'Air Freight Calculator';
      case '/new': return 'New Request';
      case '/approvals': return 'Pending Approvals';
      case '/shipments': return 'Shipment Data';
      case '/users': return 'User Management';
      case '/carriers': return 'Forwarder Directory';
      case '/locations': return 'Location Management';
      case '/settings': return 'System Settings';
      default: return pathname.startsWith('/shipments/') ? 'Shipment Details' : 'Dashboard';
    }
  };

  const getDateString = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <VersionChecker />
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col bg-slate-900 text-slate-400 transition-all duration-300 ease-out w-[72px] hover:w-64 group shadow-2xl overflow-visible">
        <div className="h-16 flex items-center px-5 border-b border-slate-800 shrink-0">
          <div 
            onClick={() => navigateWithCheck('/dashboard')}
            className="flex items-center gap-4 cursor-pointer"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-600/30">
              <Truck size={18} strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-white tracking-tight opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap">
              FreightGuard
            </span>
          </div>
        </div>

        <div className="p-3 border-b border-slate-800 relative shrink-0">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition-colors text-left relative overflow-hidden"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-700 font-bold shrink-0 transition-transform duration-300 ring-2 ring-slate-800 group-hover:ring-slate-700 ${
                currentUser?.role === 'ADMIN' ? 'bg-purple-200' : 
                currentUser?.role === 'APPROVER' ? 'bg-indigo-200' :
                currentUser?.role === 'LOGISTICS' ? 'bg-cyan-200' : 'bg-slate-200'
            }`}>
               {currentUser ? currentUser.name.charAt(0) : <UserIcon size={16} />}
            </div>
            <div className="flex-1 overflow-hidden opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0">
                <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Guest'}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize font-medium tracking-wide">{currentUser?.role?.toLowerCase() || 'No Role'}</p>
            </div>
            <ChevronDown size={12} className="text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>

          {showUserMenu && (
             <div className="absolute top-full left-4 right-4 mt-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50 w-56 animate-fade-in-up origin-top-left">
                <div className="p-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-800/50">Switch Account</div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {users.map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleUserSwitchRequest(u)}
                          className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-3 rounded-lg transition-colors ${currentUser?.id === u.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                           <div className={`w-2 h-2 rounded-full shrink-0 ${
                               u.role === 'ADMIN' ? 'bg-purple-400' : 
                               u.role === 'APPROVER' ? 'bg-indigo-400' :
                               u.role === 'LOGISTICS' ? 'bg-cyan-400' : 'bg-slate-400'
                           } ${u.status === 'INACTIVE' ? 'bg-red-500' : ''}`} />
                           <span className={`truncate flex-1 ${u.status === 'INACTIVE' ? 'text-slate-500 line-through' : ''}`}>{u.name}</span>
                           {u.passcode ? <Lock size={10} className="text-slate-500" /> : <span className="text-[9px] text-red-400 font-bold uppercase">No Pin</span>}
                        </button>
                    ))}
                </div>
                <div className="p-1 border-t border-slate-700 bg-slate-900/50">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-slate-700 hover:text-red-300 rounded-lg transition-colors"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
             </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
            <button
              key={item.path}
              onClick={() => navigateWithCheck(item.path)}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all duration-200 group/item relative overflow-hidden ${
                isActive(item.path) ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'
              }`}
              title={item.label}
            >
              <item.icon size={20} className={`shrink-0 transition-colors ${isActive(item.path) ? 'text-white' : 'text-slate-500 group-hover/item:text-white'}`} />
              <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap delay-75">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 shrink-0">
          <button
              onClick={() => navigateWithCheck('/settings')}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all duration-200 group/item relative overflow-hidden ${
                isActive('/settings') ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white text-slate-500'
              }`}
              title="Settings"
          >
              <Settings size={20} className={`shrink-0 transition-colors ${isActive('/settings') ? 'text-white' : 'text-slate-500 group-hover/item:text-white'}`} />
              <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap delay-75">
                Settings
              </span>
          </button>

          <div className="mt-2 px-4 text-[10px] font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 whitespace-nowrap overflow-hidden">
            v1.3.4 • FreightGuard
          </div>
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 z-50 px-4 py-3 flex items-center justify-between shadow-lg safe-area-pt">
         <div 
           onClick={() => navigateWithCheck('/dashboard')}
           className="flex items-center gap-2 text-white font-bold cursor-pointer"
         >
           <Truck size={20} className="text-indigo-400" /> FreightGuard
         </div>
         <div className="flex gap-4 items-center">
           {/* Calendar Mobile */}
           <div className="relative" ref={calendarRef}>
               <button onClick={() => setShowCalendar(!showCalendar)} className="text-slate-400 hover:text-white relative p-1">
                   <Calendar size={22} />
                   {upcomingArrivals.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-slate-900"></span>}
               </button>
               {showCalendar && (
                   <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-fade-in-up origin-top-right">
                       <div className="p-3 border-b border-slate-100 bg-slate-50">
                           <h4 className="font-bold text-slate-800 text-sm">Upcoming Arrivals</h4>
                       </div>
                       <div className="max-h-64 overflow-y-auto custom-scrollbar">
                           {upcomingArrivals.length > 0 ? upcomingArrivals.map(arr => (
                               <div key={arr.id} onClick={() => { navigateWithCheck(`/shipments/${arr.id}`); setShowCalendar(false); }} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                                   <div className="flex gap-2">
                                       <div className="mt-0.5"><Ship size={16} className="text-indigo-500" /></div>
                                       <div className="min-w-0">
                                           <p className="text-xs font-semibold truncate text-slate-900">{arr.vessel_name || 'Unknown Vessel'}</p>
                                           <p className="text-[10px] text-slate-500 mt-0.5">Dest: {arr.destination_code || arr.destination || 'N/A'}</p>
                                           <p className="text-[10px] font-bold mt-1">
                                               {arr.ata && !isFuture(parseISO(arr.ata)) ? (
                                                   <span className="text-emerald-600">Arrived: {new Date(arr.ata).toLocaleDateString()} <span className="text-slate-400 font-normal ml-1">{getDaysRemaining(arr.ata)}</span></span>
                                               ) : (
                                                   <span className="text-indigo-600">ETA: {new Date(arr.ata || arr.eta).toLocaleDateString()} <span className="text-slate-400 font-normal ml-1">{getDaysRemaining(arr.ata || arr.eta)}</span></span>
                                               )}
                                           </p>
                                       </div>
                                   </div>
                               </div>
                           )) : <div className="p-6 text-center text-xs text-slate-400">No upcoming arrivals</div>}
                       </div>
                       <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                           <button onClick={() => { navigateWithCheck('/calendar'); setShowCalendar(false); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 w-full py-1">
                               View Full Calendar
                           </button>
                       </div>
                   </div>
               )}
           </div>

           {/* Notification Bell Mobile */}
           <div className="relative" ref={notifRef}>
               <button onClick={() => setShowNotifications(!showNotifications)} className="text-slate-400 hover:text-white relative p-1">
                   <Bell size={22} />
                   {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></span>}
               </button>
               {showNotifications && (
                   <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-fade-in-up origin-top-right">
                       <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                           <h4 className="font-bold text-slate-800 text-sm">Notifications</h4>
                           <button onClick={markAllRead} className="text-[10px] font-bold text-indigo-600 hover:underline">Mark all read</button>
                       </div>
                       <div className="max-h-64 overflow-y-auto custom-scrollbar">
                           {notifications.length > 0 ? notifications.map(n => (
                               <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${!n.is_read ? 'bg-indigo-50/30' : ''}`}>
                                   <div className="flex gap-2">
                                       <div className="mt-0.5">{getNotifIcon(n.type)}</div>
                                       <div className="min-w-0">
                                           <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                                           <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                                           <p className="text-[9px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                       </div>
                                   </div>
                               </div>
                           )) : <div className="p-6 text-center text-xs text-slate-400">No notifications</div>}
                       </div>
                   </div>
               )}
           </div>
           
           <button onClick={() => setShowUserMenu(!showUserMenu)} className="text-slate-400">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-900 font-bold ${
                  currentUser?.role === 'ADMIN' ? 'bg-purple-200' : 'bg-indigo-200'
              }`}>
                 {currentUser ? currentUser.name.charAt(0) : <UserIcon size={14} />}
              </div>
           </button>
           {/* Mobile User Menu Dropdown */}
           {showUserMenu && (
             <div className="absolute top-14 right-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-fade-in-up">
                <div className="p-3 border-b border-slate-100">
                   <p className="font-bold text-sm text-slate-800 truncate">{currentUser?.name}</p>
                   <p className="text-xs text-slate-500 truncate capitalize">{currentUser?.role?.toLowerCase()}</p>
                </div>
                <div className="p-1">
                   <button onClick={() => { navigateWithCheck('/settings'); setShowUserMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded-lg flex items-center gap-2"><Settings size={14}/> Settings</button>
                   <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><LogOut size={14}/> Sign Out</button>
                </div>
             </div>
           )}
         </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[900] flex justify-around items-center h-[60px] pb-safe-area shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
         {mobileNavItems.map((item) => {
             const active = isActive(item.path);
             return (
               <button
                 key={item.path}
                 onClick={() => navigateWithCheck(item.path)}
                 className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}
               >
                 {item.highlight ? (
                    <div className={`p-2 rounded-full -mt-6 shadow-lg border-4 border-slate-50 ${active ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'}`}>
                        <item.icon size={24} strokeWidth={2.5} />
                    </div>
                 ) : (
                    <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                 )}
                 <span className={`text-[10px] font-medium ${item.highlight ? '-mt-1' : ''}`}>{item.label}</span>
               </button>
             )
         })}
      </div>

      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 md:pl-[72px] pt-[60px] md:pt-0 pb-[70px] md:pb-0">
        {/* DESKTOP HEADER */}
        <header className="hidden md:flex justify-between items-center px-6 py-3 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/50">
            {/* Left: Dynamic Title */}
            <div>
               <h1 className="text-xl font-bold text-slate-800 tracking-tight">{getPageTitle(location.pathname)}</h1>
               <p className="text-xs text-slate-500 font-medium">{getDateString()}</p>
            </div>

            {/* Center: Global Search */}
            <div className="flex-1 max-w-xl mx-8">
               <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                     ref={searchInputRef}
                     type="text" 
                     placeholder="Quick search shipment ID, origin, destination..." 
                     className="w-full pl-10 pr-16 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-500 rounded-full text-sm outline-none transition-all shadow-sm focus:shadow-md"
                     onKeyDown={handleGlobalSearch}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
                      <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white font-medium">⌘K</span>
                  </div>
               </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => navigateWithCheck('/new')} 
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-all shadow-md shadow-indigo-200 active:scale-95 active:shadow-sm"
               >
                  <Plus size={18} strokeWidth={2.5} /> <span className="hidden lg:inline">New Request</span>
               </button>

               <div className="h-6 w-px bg-slate-200 mx-1"></div>

               {/* Calendar Desktop */}
               <div className="relative" ref={calendarRefDesktop}>
                   <button onClick={() => setShowCalendar(!showCalendar)} className="text-slate-400 hover:text-indigo-600 relative p-2 bg-white rounded-full shadow-sm border border-slate-200 transition-all hover:shadow-md active:scale-95">
                       <Calendar size={20} />
                       {upcomingArrivals.length > 0 && (
                           <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center">
                               {upcomingArrivals.length}
                           </span>
                       )}
                   </button>
                   {showCalendar && (
                       <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-fade-in-up origin-top-right">
                           <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                               <h4 className="font-bold text-slate-800 text-sm">Upcoming Arrivals</h4>
                               <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Next 7 Days</span>
                           </div>
                           <div className="max-h-80 overflow-y-auto custom-scrollbar">
                               {upcomingArrivals.length > 0 ? upcomingArrivals.map(arr => (
                                   <div key={arr.id} onClick={() => { navigateWithCheck(`/shipments/${arr.id}`); setShowCalendar(false); }} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group">
                                       <div className="flex gap-3">
                                           <div className="mt-0.5 shrink-0 bg-indigo-50 p-1.5 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                               <Ship size={16} className="text-indigo-600" />
                                           </div>
                                           <div className="flex-1 min-w-0">
                                               <p className="text-xs font-bold truncate text-slate-800 group-hover:text-indigo-700 transition-colors">{arr.vessel_name || 'Unknown Vessel'}</p>
                                               <div className="flex items-center gap-2 mt-1">
                                                   <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Dest: {arr.destination_code || arr.destination || 'N/A'}</span>
                                               </div>
                                               <p className="text-[11px] font-medium text-slate-500 mt-1.5 flex items-center gap-1">
                                                   <Calendar size={10} /> 
                                                   {arr.ata && !isFuture(parseISO(arr.ata)) ? (
                                                       <span>Arrived: <span className="text-emerald-600 font-bold">{new Date(arr.ata).toLocaleDateString()}</span> <span className="text-[10px] text-slate-400 font-normal ml-1">{getDaysRemaining(arr.ata)}</span></span>
                                                   ) : (
                                                       <span>ETA: <span className="text-indigo-600 font-bold">{new Date(arr.ata || arr.eta).toLocaleDateString()}</span> <span className="text-[10px] text-slate-400 font-normal ml-1">{getDaysRemaining(arr.ata || arr.eta)}</span></span>
                                                   )}
                                               </p>
                                           </div>
                                       </div>
                                   </div>
                               )) : <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2"><Calendar size={24} className="opacity-20"/>No upcoming arrivals</div>}
                           </div>
                           <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                               <button onClick={() => { navigateWithCheck('/calendar'); setShowCalendar(false); }} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 w-full py-1 hover:bg-indigo-50 rounded transition-colors">
                                   View Full Calendar
                               </button>
                           </div>
                       </div>
                   )}
               </div>

               <div className="relative" ref={notifRef}>
                   <button onClick={() => setShowNotifications(!showNotifications)} className="text-slate-400 hover:text-indigo-600 relative p-2 bg-white rounded-full shadow-sm border border-slate-200 transition-all hover:shadow-md active:scale-95">
                       <Bell size={20} />
                       {unreadCount > 0 && (
                           <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                               {unreadCount > 9 ? '9+' : unreadCount}
                           </span>
                       )}
                   </button>
                   {showNotifications && (
                       <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-fade-in-up origin-top-right">
                           <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                               <h4 className="font-bold text-slate-800 text-sm">Notifications</h4>
                               <button onClick={markAllRead} className="text-[10px] font-bold text-indigo-600 hover:underline">Mark all read</button>
                           </div>
                           <div className="max-h-80 overflow-y-auto custom-scrollbar">
                               {notifications.length > 0 ? notifications.map(n => (
                                   <div key={n.id} onClick={() => handleNotificationClick(n)} className={`p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${!n.is_read ? 'bg-indigo-50/40 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}>
                                       <div className="flex gap-3">
                                           <div className="mt-0.5 shrink-0">{getNotifIcon(n.type)}</div>
                                           <div className="flex-1 min-w-0">
                                               <p className={`text-xs font-bold truncate ${!n.is_read ? 'text-indigo-900' : 'text-slate-700'}`}>{n.title}</p>
                                               <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">{n.message}</p>
                                               <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                           </div>
                                           {!n.is_read && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 shrink-0"></div>}
                                       </div>
                                   </div>
                               )) : <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2"><Bell size={24} className="opacity-20"/>No notifications</div>}
                           </div>
                       </div>
                   )}
               </div>
            </div>
        </header>

        <main className="flex-1 p-2 md:p-6 md:pt-4 overflow-y-auto h-full scroll-smooth">
            <div className="w-full h-full max-w-[1920px] mx-auto">{children}</div>
        </main>
      </div>

      {showPasscodeModal && pendingUser && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Lock size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-900">Security Check</h3>
                    <p className="text-sm text-slate-500 mt-1">Enter passcode for <span className="font-semibold text-slate-800">{pendingUser.name}</span></p>
                </div>
                <form onSubmit={handlePasscodeSubmit} className="px-6 pb-6">
                    <div className="relative mb-4">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input autoFocus type="password" maxLength={4} className={`w-full pl-10 pr-4 py-3 border rounded-lg outline-none text-center font-bold tracking-widest text-lg ${passcodeError ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'}`} placeholder="****" value={inputPasscode} onChange={(e) => { setInputPasscode(e.target.value); setPasscodeError(false); }} />
                    </div>
                    {passcodeError && <p className="text-xs text-red-600 text-center mb-4 font-medium animate-pulse">Incorrect passcode. Please try again.</p>}
                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => { setShowPasscodeModal(false); setPendingUser(null); }} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm">Verify</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
