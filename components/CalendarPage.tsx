import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday, isValid, isFuture } from 'date-fns';
import { ChevronLeft, ChevronRight, Ship, Calendar as CalendarIcon, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDaysRemaining } from '../services/freightHelpers';

interface CalendarShipment {
  id: string;
  vessel_name: string;
  eta: string;
  ata?: string;
  destination: string;
  destination_code?: string;
  status: string;
  shipping_method?: string;
}

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shipments, setShipments] = useState<CalendarShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // selectedShipments is now derived from selectedDate

  useEffect(() => {
    fetchShipments();
  }, [currentDate]);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      // Fetch shipments for the current month window (plus padding)
      const start = startOfWeek(startOfMonth(currentDate)).toISOString();
      const end = endOfWeek(endOfMonth(currentDate)).toISOString();

      const { data, error } = await supabase
        .from('freight_raw_full')
        .select('id, vessel_name, eta, ata, destination, destination_code, status, shipping_method')
        .or(`eta.gte.${start},ata.gte.${start}`) 
        
      if (error) throw error;
      
      setShipments(data || []);
    } catch (err) {
      console.error("Error fetching shipments for calendar:", err);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => {
    const today = new Date();
    if (!isSameMonth(today, currentDate)) {
        setCurrentDate(today);
    }
    setSelectedDate(today);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getShipmentsForDay = (date: Date) => {
    return shipments.filter(s => {
      // Use ATA if available, otherwise ETA
      const dateStr = s.ata || s.eta;
      if (!dateStr) return false;
      const shipmentDate = parseISO(dateStr);
      return isValid(shipmentDate) && isSameDay(shipmentDate, date);
    });
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const selectedShipments = selectedDate ? getShipmentsForDay(selectedDate) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="text-indigo-600" /> Shipment Calendar
          </h1>
          <p className="text-slate-500 text-sm mt-1">View upcoming arrivals and actual arrival times</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-bold text-slate-800 min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        <button 
          onClick={goToToday}
          className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 transition-colors text-sm"
        >
          Today
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
            {calendarDays.map((day, dayIdx) => {
              const dayShipments = getShipmentsForDay(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDate = isToday(day);

              return (
                <div 
                  key={day.toString()} 
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[100px] bg-white p-2 cursor-pointer transition-all hover:bg-indigo-50/30 relative group
                    ${!isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'text-slate-700'}
                    ${isSelected ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className={`
                      text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                      ${isTodayDate ? 'bg-indigo-600 text-white shadow-md' : ''}
                    `}>
                      {format(day, 'd')}
                    </span>
                    {dayShipments.length > 0 && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                        {dayShipments.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {dayShipments.slice(0, 3).map(shipment => (
                      <div key={shipment.id} className={`
                        text-[10px] px-1.5 py-1 rounded border truncate flex items-center gap-1
                        ${shipment.ata && !isFuture(parseISO(shipment.ata)) ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}
                      `}>
                        <div className={`w-1.5 h-1.5 rounded-full ${shipment.ata && !isFuture(parseISO(shipment.ata)) ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                        <span className="truncate">{shipment.vessel_name || 'Unknown'}</span>
                      </div>
                    ))}
                    {dayShipments.length > 3 && (
                      <div className="text-[10px] text-slate-400 pl-1">
                        + {dayShipments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar / Details Panel */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 h-full max-h-[600px] flex flex-col sticky top-24">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM do') : 'Select a date'}
            </h3>

            {selectedDate ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {selectedShipments.length > 0 ? (
                  selectedShipments.map(shipment => (
                    <div 
                      key={shipment.id} 
                      onClick={() => navigate(`/shipments/${shipment.id}`)}
                      className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 truncate max-w-[160px]">
                          {shipment.vessel_name || 'Unknown Vessel'}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          shipment.ata && !isFuture(parseISO(shipment.ata))
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {shipment.ata && !isFuture(parseISO(shipment.ata)) ? 'ARRIVED' : 'ETA'}
                        </span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <MapPin size={12} />
                          <span className="truncate">{shipment.destination_code || shipment.destination}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock size={12} />
                          <span>
                            {shipment.ata 
                              ? (isFuture(parseISO(shipment.ata)) ? 'Estimated (ATA Future)' : 'Arrived')
                              : 'Estimated'
                            }
                            <span className="ml-1 text-slate-400 font-normal">
                              {getDaysRemaining(shipment.ata || shipment.eta)}
                            </span>
                          </span>
                        </div>
                        {shipment.ata && !isFuture(parseISO(shipment.ata)) && (
                           <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium mt-1 bg-emerald-50 px-2 py-1 rounded">
                             <CheckCircle2 size={10} />
                             Actual Time of Arrival Used
                           </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    <Ship size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No shipments for this date</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400">
                <CalendarIcon size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Click on a date to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
