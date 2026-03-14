
import React, { useState, useEffect } from 'react';

interface DatePickerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ isOpen, onClose, selectedDate, onDateSelect }) => {
    const [viewDate, setViewDate] = useState(selectedDate);
    const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);

    useEffect(() => {
        if (isOpen) {
            const validDate = isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
            setTempSelectedDate(validDate);
            setViewDate(validDate);
        }
    }, [isOpen, selectedDate]);

    if (!isOpen) return null;

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 = Sun

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

    const handleConfirm = () => {
        onDateSelect(tempSelectedDate);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center font-roboto backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] p-6 w-[360px] shadow-2xl animate-fade-in relative">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Select Date</h2>
                    <div className="bg-amber-400 p-3 rounded-xl shadow-lg shadow-amber-200">
                        <i className="fas fa-calendar-alt text-white text-xl"></i>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-3 mb-6">
                    <div className="relative flex-1">
                        <select 
                            className="w-full appearance-none bg-slate-100 border-none rounded-lg px-4 py-3 font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                            value={viewDate.getMonth()}
                            onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1))}
                        >
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                         <i className="fas fa-caret-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                    </div>
                    <div className="relative w-28">
                        <select 
                            className="w-full appearance-none bg-slate-100 border-none rounded-lg px-4 py-3 font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                            value={viewDate.getFullYear()}
                            onChange={(e) => setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1))}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <i className="fas fa-caret-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="mb-6">
                    <div className="grid grid-cols-7 mb-2 text-center">
                        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
                            <div key={day} className={`text-[10px] font-bold tracking-wider py-1 ${i === 0 || i === 6 ? 'text-amber-500' : 'text-slate-400'}`}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-1 text-sm font-medium text-slate-600">
                        {days.map((day, i) => {
                            if (!day) return <div key={i}></div>;
                            const isSelected = tempSelectedDate.getDate() === day && 
                                             tempSelectedDate.getMonth() === viewDate.getMonth() && 
                                             tempSelectedDate.getFullYear() === viewDate.getFullYear();
                            
                            // Weekend coloring for unselected
                            const currentD = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                            const isWeekend = currentD.getDay() === 0 || currentD.getDay() === 6;

                            return (
                                <div key={i} className="flex justify-center items-center h-10 w-10 mx-auto">
                                    <button 
                                        onClick={() => setTempSelectedDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day))}
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                            isSelected 
                                            ? 'bg-amber-400 text-white shadow-md shadow-amber-200 scale-110' 
                                            : `hover:bg-slate-100 ${isWeekend ? 'text-amber-600' : 'text-slate-600'}`
                                        }`}
                                    >
                                        {day}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="space-y-3">
                    <button 
                        onClick={handleConfirm}
                        className="w-full bg-amber-400 text-white font-bold text-lg py-3 rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-500 transition-colors active:scale-95"
                    >
                        Confirm
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full text-slate-400 font-bold text-sm py-2 hover:text-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatePicker;
