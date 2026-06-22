import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface CustomDatePickerProps {
  onSelect: (formattedDate: string) => void;
  themeColor: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ onSelect, themeColor }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Time states
  const [hours, setHours] = useState(selectedDate.getHours() % 12 || 12);
  const [minutes, setMinutes] = useState(selectedDate.getMinutes());
  const [ampm, setAmpm] = useState(selectedDate.getHours() >= 12 ? 'PM' : 'AM');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  useEffect(() => {
    // Whenever selection or time changes, format and call onSelect
    const finalDate = new Date(selectedDate);
    let h = hours;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    
    finalDate.setHours(h);
    finalDate.setMinutes(minutes);

    const formatted = finalDate.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    
    onSelect(formatted);
  }, [selectedDate, hours, minutes, ampm]);

  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="flex flex-col gap-3 p-2 bg-[#1A1D2B] rounded-xl select-none">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-1">
        <button onClick={handlePrevMonth} className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold text-white">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={handleNextMonth} className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Days Grid */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {days.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = 
              selectedDate.getDate() === day && 
              selectedDate.getMonth() === currentDate.getMonth() && 
              selectedDate.getFullYear() === currentDate.getFullYear();

            const isToday = 
              new Date().getDate() === day && 
              new Date().getMonth() === currentDate.getMonth() && 
              new Date().getFullYear() === currentDate.getFullYear();

            return (
              <button
                key={day}
                onClick={() => handleSelectDate(day)}
                className={`
                  w-7 h-7 rounded-full text-xs flex items-center justify-center transition-colors mx-auto
                  ${isSelected ? 'text-white font-bold shadow-lg' : 
                    isToday ? 'border font-bold' : 
                    'text-gray-300 hover:bg-white/10'}
                `}
                style={
                  isSelected 
                    ? { backgroundColor: themeColor, boxShadow: `0 4px 14px 0 ${themeColor}66` } 
                    : isToday 
                    ? { borderColor: `${themeColor}80`, color: themeColor } 
                    : {}
                }
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full h-px bg-white/10 my-1" />

      {/* Time Picker */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Clock size={14} />
          <span className="text-xs font-medium">Time</span>
        </div>
        <div className="flex items-center gap-1">
          <select 
            value={hours} 
            onChange={(e) => setHours(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded-md px-1.5 py-1 text-xs text-white focus:outline-none cursor-pointer appearance-none text-center"
          >
            {Array.from({length: 12}).map((_, i) => (
              <option key={i+1} value={i+1} className="bg-[#1A1D2B]">{String(i+1).padStart(2, '0')}</option>
            ))}
          </select>
          <span className="text-white text-xs font-bold">:</span>
          <select 
            value={minutes} 
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="bg-black/20 border border-white/10 rounded-md px-1.5 py-1 text-xs text-white focus:outline-none cursor-pointer appearance-none text-center"
          >
            {['00', '15', '30', '45'].map(m => (
              <option key={m} value={Number(m)} className="bg-[#1A1D2B]">{m}</option>
            ))}
          </select>
          <select 
            value={ampm} 
            onChange={(e) => setAmpm(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-md px-1 py-1 text-xs font-bold focus:outline-none cursor-pointer appearance-none text-center ml-1"
            style={{ color: themeColor }}
          >
            <option value="AM" className="bg-[#1A1D2B]">AM</option>
            <option value="PM" className="bg-[#1A1D2B]">PM</option>
          </select>
        </div>
      </div>
    </div>
  );
};
