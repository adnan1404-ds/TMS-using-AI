
import React, { useState, useMemo, useEffect } from 'react';
import { Database, GenericRecord } from '../types';
import { formatDate } from '../constants';
import DatePicker from './DatePicker';

interface VehicleDutyLogsViewProps {
    db: Database;
    onDelete: (index: number) => void;
    onRowUpdate: (index: number, updatedRow: GenericRecord) => void;
}

const VehicleDutyLogsView: React.FC<VehicleDutyLogsViewProps> = ({ db, onDelete, onRowUpdate }) => {
    const today = new Date();
    const [selDay, setSelDay] = useState(today.getDate());
    const [selMonth, setSelMonth] = useState(today.getMonth());
    const [selYear, setSelYear] = useState(today.getFullYear());
    const [filterType, setFilterType] = useState<'day' | 'month' | 'all'>('month'); 
    
    // State to track which specific row and field is being edited with the date picker
    const [activeDateEdit, setActiveDateEdit] = useState<{ index: number, field: 'from_date' | 'to_date' } | null>(null);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();

    useEffect(() => {
        if (selDay > daysInMonth) setSelDay(daysInMonth);
    }, [selMonth, selYear, daysInMonth, selDay]);

    const dateObj = new Date(selYear, selMonth, selDay);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const selectedDateStr = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;

    const filteredLogs = useMemo(() => {
        return (db.vehicle_duty_logs || [])
            .map((r, i) => ({ ...r, originalIndex: i } as GenericRecord & { originalIndex: number }))
            .filter(r => {
                if (!r.from_date) return false;
                if (filterType === 'all') return true;
                
                const d = new Date(r.from_date as string);
                if (filterType === 'day') {
                    return r.from_date === selectedDateStr;
                } else {
                    return d.getMonth() === selMonth && d.getFullYear() === selYear;
                }
            })
            // Sort by date descending
            .sort((a, b) => new Date(b.from_date as string).getTime() - new Date(a.from_date as string).getTime());
    }, [db.vehicle_duty_logs, filterType, selectedDateStr, selMonth, selYear]);

    const handleInputChange = (index: number, field: string, value: string) => {
        const row = db.vehicle_duty_logs[index];
        onRowUpdate(index, { ...row, [field]: value });
    };

    const handleDateSelect = (date: Date) => {
        if (!activeDateEdit) return;
        
        // Correct for timezone offset to ensure the string matches the user selection
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];
        
        handleInputChange(activeDateEdit.index, activeDateEdit.field, dateStr);
        setActiveDateEdit(null);
    };

    const getDateObject = (val: any) => {
        if (!val) return new Date();
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    return (
        <div id="view-vehicle-duty-logs" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[80vh]">
                
                {/* Header Controls */}
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h5 className="text-xl font-bold text-ncp-primary">Vehicle Duty History</h5>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Day</label>
                                <select 
                                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-ncp-primary"
                                    value={selDay}
                                    onChange={(e) => { setSelDay(parseInt(e.target.value)); setFilterType('day'); }}
                                >
                                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Month</label>
                                <select 
                                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-ncp-primary"
                                    value={selMonth}
                                    onChange={(e) => setSelMonth(parseInt(e.target.value))}
                                >
                                    {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Year</label>
                                <input 
                                    type="number" 
                                    className="border border-gray-300 rounded px-2 py-1 w-20 text-sm bg-white focus:outline-none focus:border-ncp-primary"
                                    value={selYear}
                                    onChange={(e) => setSelYear(parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                        
                        <div className="h-8 w-px bg-gray-300 mx-2"></div>

                        <div className="flex bg-white rounded border border-gray-300 p-1">
                            <button 
                                className={`px-3 py-1 text-xs rounded transition font-medium ${filterType === 'day' ? 'bg-ncp-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setFilterType('day')}
                            >
                                Day
                            </button>
                            <button 
                                className={`px-3 py-1 text-xs rounded transition font-medium ${filterType === 'month' ? 'bg-ncp-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setFilterType('month')}
                            >
                                Month
                            </button>
                            <button 
                                className={`px-3 py-1 text-xs rounded transition font-medium ${filterType === 'all' ? 'bg-ncp-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                onClick={() => setFilterType('all')}
                            >
                                All
                            </button>
                        </div>
                        <div className="flex flex-col justify-end h-full pt-4">
                             <button className="bg-white border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50 transition text-sm font-medium" onClick={() => window.print()}>
                                <i className="fas fa-print"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="text-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-700 uppercase tracking-tight">
                        {filterType === 'day' 
                            ? `${dayOfWeek}, ${formatDate(dateObj)}` 
                            : filterType === 'month' ? `${monthNames[selMonth]} ${selYear}` : 'All Records'}
                    </h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Vehicle Duty Change Log</p>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                            <tr>
                                <th className="p-3 border border-gray-300 w-12 text-center">Sr</th>
                                <th className="p-3 border border-gray-300">Vehicle Reg</th>
                                <th className="p-3 border border-gray-300 w-32">Duty Type</th>
                                <th className="p-3 border border-gray-300 w-32 text-center">From Date</th>
                                <th className="p-3 border border-gray-300 w-32 text-center">To Date</th>
                                <th className="p-3 border border-gray-300 w-1/3">Remarks</th>
                                <th className="p-3 border border-gray-300 w-16 text-center action-col">Act</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {filteredLogs.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No duty changes recorded for this period.</td></tr>
                            ) : (
                                filteredLogs.map((row, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-gray-100">
                                        <td className="p-2 border border-gray-300 text-center text-gray-500">{i + 1}</td>
                                        <td className="p-2 border border-gray-300 font-bold text-ncp-primary">{row.vehicle_reg}</td>
                                        <td className="p-2 border border-gray-300 font-bold bg-slate-50">{row.duty_type}</td>
                                        <td className="p-0 border border-gray-300">
                                            <input 
                                                readOnly
                                                className="w-full h-full p-2 bg-transparent focus:bg-white outline-none text-center font-medium text-slate-700 cursor-pointer hover:text-ncp-primary"
                                                value={formatDate(row.from_date as string)}
                                                onClick={() => setActiveDateEdit({ index: row.originalIndex, field: 'from_date' })}
                                            />
                                        </td>
                                        <td className="p-0 border border-gray-300">
                                            <div 
                                                className="w-full h-full p-2 text-center flex items-center justify-center font-medium text-slate-700 cursor-pointer hover:bg-gray-50 hover:text-ncp-primary min-h-[32px]"
                                                onClick={() => setActiveDateEdit({ index: row.originalIndex, field: 'to_date' })}
                                            >
                                                {row.to_date ? formatDate(row.to_date as string) : <span className="text-green-600 text-[10px] uppercase font-bold bg-green-50 px-2 py-1 rounded">Present</span>}
                                            </div>
                                        </td>
                                        <td className="p-0 border border-gray-300 relative-cell">
                                            <input 
                                                className="w-full h-full p-2 bg-transparent focus:bg-white focus:outline-none"
                                                value={row.remarks || ''}
                                                onChange={(e) => handleInputChange(row.originalIndex, 'remarks', e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2 border border-gray-300 text-center action-col">
                                            <button className="text-red-500 hover:text-red-700" onClick={() => onDelete(row.originalIndex)}>
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 text-[10px] text-gray-400 italic">
                    <i className="fas fa-info-circle mr-1"></i> Duty changes are automatically logged when you edit a vehicle's duty type in the "Vehicles" section. Click on dates to modify them.
                </div>
            </div>

            {/* Date Picker Modal */}
            {activeDateEdit && (
                <DatePicker 
                    isOpen={!!activeDateEdit} 
                    onClose={() => setActiveDateEdit(null)} 
                    selectedDate={getDateObject(db.vehicle_duty_logs[activeDateEdit.index][activeDateEdit.field])}
                    onDateSelect={handleDateSelect}
                />
            )}
        </div>
    );
};

export default VehicleDutyLogsView;
