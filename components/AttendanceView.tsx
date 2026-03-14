
import React, { useState, useMemo, useEffect } from 'react';
import { Database, GenericRecord } from '../types';
import DatePicker from './DatePicker';
import { formatDate } from '../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceViewProps {
    db: Database;
    onUpdate: (updatedDb: Database) => void;
}

const DRIVER_CATEGORIES = [
    { id: 'Official Staff', title: 'Official Staff' },
    { id: 'General', title: 'General Drivers' },
    { id: 'Shift', title: 'Shift Drivers' },
    { id: 'Entitled', title: 'Entitled Drivers' }
];

const AttendanceView: React.FC<AttendanceViewProps> = ({ db, onUpdate }) => {
    // Local date ISO string helper to avoid timezone shifts
    const getLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const todayStr = getLocalISOString(new Date());
    
    const [viewMode, setViewMode] = useState<'daily' | 'report'>('daily');
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [isDailyPickerOpen, setIsDailyPickerOpen] = useState(false);
    
    const [reportDriver, setReportDriver] = useState("");
    const [fromDate, setFromDate] = useState(todayStr);
    const [toDate, setToDate] = useState(todayStr);
    
    const [isFromPickerOpen, setIsFromPickerOpen] = useState(false);
    const [isToPickerOpen, setIsToPickerOpen] = useState(false);

    const vehicleOptions = useMemo(() => (db.vehicles || []).map(v => v.reg_no as string).filter(Boolean), [db.vehicles]);

    const getRate = (dateStr: string, holidayReason?: string) => {
        const d = new Date(dateStr);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isHoliday = !!(holidayReason && holidayReason.trim() !== '');
        return (isWeekend || isHoliday) ? 100 : 80;
    };

    const currentHolidayReason = useMemo(() => {
        const records = db.attendance.filter(r => r.date === selectedDate);
        const reason = records.find(r => r.holiday_reason)?.holiday_reason as string;
        return reason || '';
    }, [db.attendance, selectedDate]);

    // Calculate monthly total OT for a driver
    const getMonthlyTotalOT = (driverName: string) => {
        const [year, month] = selectedDate.split('-');
        const monthPrefix = `${year}-${month}`;
        return db.attendance
            .filter(r => r.driver === driverName && String(r.date).startsWith(monthPrefix))
            .reduce((sum, r) => sum + (Number(r.ot_hours) || 0), 0);
    };

    // Calculate monthly total Amount (Rs) for a driver
    const getMonthlyTotalAmount = (driverName: string) => {
        const [year, month] = selectedDate.split('-');
        const monthPrefix = `${year}-${month}`;
        return db.attendance
            .filter(r => r.driver === driverName && String(r.date).startsWith(monthPrefix))
            .reduce((sum, r) => {
                const ot = Number(r.ot_hours) || 0;
                const rate = getRate(r.date as string, r.holiday_reason as string);
                return sum + (ot * rate);
            }, 0);
    };

    const calculateOTHours = (startStr: string, endStr: string) => {
        const parseTime = (t: string) => {
            const clean = t.replace(/[^0-9]/g, '');
            if (!clean || clean.length < 1) return null;
            let hours = 0;
            let mins = 0;
            if (clean.length <= 2) {
                hours = parseInt(clean);
            } else {
                hours = parseInt(clean.slice(0, -2));
                mins = parseInt(clean.slice(-2));
            }
            if (isNaN(hours) || isNaN(mins)) return null;
            return hours * 60 + mins;
        };
        const startMins = parseTime(startStr);
        const endMins = parseTime(endStr);
        if (startMins === null || endMins === null) return null;
        let diff = endMins - startMins;
        if (diff < 0) diff += 1440;
        return parseFloat((diff / 60).toFixed(2));
    };

    const handleDailyUpdate = (driverName: string, field: string, value: string) => {
        const list = [...(db.attendance || [])];
        const index = list.findIndex(r => r.date === selectedDate && r.driver === driverName);
        let record: GenericRecord = index >= 0 
            ? { ...list[index] } 
            : { date: selectedDate, driver: driverName, status: '', ot_hours: 0, remarks: '', holiday_reason: currentHolidayReason };
        
        if (field === 'ot_hours') {
            record[field] = parseFloat(value) || 0;
        } else {
            record[field] = value;
        }

        // Restrict Overtime logic: only if status is 'P' (Present)
        if (field === 'status' && value !== 'P') {
            record.ot_start = '';
            record.ot_end = '';
            record.ot_hours = 0;
        }

        if (field === 'ot_start' || field === 'ot_end') {
            const start = field === 'ot_start' ? value : (record.ot_start as string || '');
            const end = field === 'ot_end' ? value : (record.ot_end as string || '');
            const calculated = calculateOTHours(start, end);
            if (calculated !== null) record.ot_hours = calculated;
        }
        if (index >= 0) list[index] = record; else list.push(record);
        onUpdate({ ...db, attendance: list });
    };

    const handleHolidayReasonUpdate = (reason: string) => {
        const list = [...(db.attendance || [])];
        db.drivers.forEach(driver => {
            const driverName = driver.name as string;
            const index = list.findIndex(r => r.date === selectedDate && r.driver === driverName);
            if (index >= 0) {
                list[index] = { ...list[index], holiday_reason: reason };
            } else {
                list.push({ date: selectedDate, driver: driverName, status: '', ot_hours: 0, remarks: '', holiday_reason: reason });
            }
        });
        onUpdate({ ...db, attendance: list });
    };

    const reportData = useMemo(() => {
        if (!reportDriver || !fromDate || !toDate) return [];
        let targetDrivers: GenericRecord[] = [];
        if (reportDriver === 'ALL') targetDrivers = db.drivers;
        else if (reportDriver.startsWith('GROUP_')) {
            const groupType = reportDriver.replace('GROUP_', '');
            targetDrivers = db.drivers.filter(d => d.duty_type === groupType);
        } else targetDrivers = db.drivers.filter(d => d.name === reportDriver);
        
        const f = new Date(fromDate);
        const t = new Date(toDate);
        const dates: string[] = [];
        for (let dt = new Date(f); dt <= t; dt.setDate(dt.getDate() + 1)) {
            dates.push(getLocalISOString(new Date(dt)));
        }

        return targetDrivers.map(drv => {
            const stats = { P: 0, R: 0, A: 0, L: 0, M: 0, C: 0, ot_hours: 0, amount: 0 };
            dates.forEach(dateStr => {
                const entry = db.attendance.find(r => r.date === dateStr && r.driver === drv.name);
                if (entry) {
                    const status = entry.status as string;
                    if (status && stats.hasOwnProperty(status)) {
                        stats[status as keyof typeof stats]++;
                    }
                    const ot = Number(entry.ot_hours) || 0;
                    stats.ot_hours += ot;
                    stats.amount += (ot * getRate(dateStr, entry.holiday_reason as string));
                }
            });
            return { driverName: drv.name, driverEmp: drv.emp_nmbr, designation: drv.designation, ...stats };
        }).sort((a, b) => (a.driverName as string).localeCompare(b.driverName as string));
    }, [db.attendance, db.drivers, reportDriver, fromDate, toDate]);

    const exportToExcel = () => {
        const title = viewMode === 'daily' ? `Attendance_${selectedDate}` : `Attendance_Report_${fromDate}_to_${toDate}`;
        const data = viewMode === 'daily' 
            ? db.attendance.filter(r => r.date === selectedDate).map((r, i) => ({ Sr: i + 1, Driver: r.driver, Status: r.status, OT: r.ot_hours, Month_Total_Hrs: getMonthlyTotalOT(r.driver as string), Month_Total_Amt: getMonthlyTotalAmount(r.driver as string), Remarks: r.remarks }))
            : reportData.map((r, i) => ({ Sr: i + 1, Driver: r.driverName, Emp: r.driverEmp, P: r.P, R: r.R, A: r.A, L: r.L, M: r.M, C: r.C, OT_Hrs: r.ot_hours, Amount: r.amount }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `${title}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('landscape');
        const isSingleDate = fromDate === toDate;
        const dateDisplay = isSingleDate ? formatDate(fromDate) : `${formatDate(fromDate)} to ${formatDate(toDate)}`;
        const title = viewMode === 'daily' 
            ? `Daily Attendance - ${formatDate(selectedDate)}` 
            : isSingleDate 
                ? `Attendance Summary - ${dateDisplay}` 
                : `Attendance Summary (${dateDisplay})`;
        doc.text(title, 14, 15);
        const head = viewMode === 'daily' 
            ? [['Sr', 'Driver', 'Status', 'Vehicle', 'OT Start', 'OT End', 'OT Hrs', 'OT Total (Hrs)', 'OT Amount (Rs)', 'Remarks']] 
            : [['Sr', 'Driver', 'Emp #', 'P', 'R', 'A', 'L', 'M', 'C', 'OT Hours', 'Amount']];
        const body = viewMode === 'daily' 
            ? db.drivers.map((d, i) => {
                const e = db.attendance.find(r => r.date === selectedDate && r.driver === d.name);
                return [
                    i + 1, 
                    d.name, 
                    e?.status || '-', 
                    e?.vehicle_reg || '-', 
                    e?.ot_start || '-', 
                    e?.ot_end || '-', 
                    e?.ot_hours || '-', 
                    getMonthlyTotalOT(d.name as string).toFixed(1),
                    Math.round(getMonthlyTotalAmount(d.name as string)).toLocaleString(),
                    e?.remarks || ''
                ];
              })
            : reportData.map((r, i) => [i + 1, r.driverName, r.driverEmp, r.P, r.R, r.A, r.L, r.M, r.C, r.ot_hours.toFixed(1), Math.round(r.amount).toLocaleString()]);
        autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
        doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    };

    // Helper to parse date strings for DatePicker
    const getDateObject = (isoStr: string) => {
        const [y, m, d] = isoStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    return (
        <div className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[80vh]">
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <div className="flex gap-2">
                        <button className={`px-4 py-2 rounded-md text-xs font-bold transition ${viewMode === 'daily' ? 'bg-white text-ncp-primary shadow-sm' : 'text-slate-500'}`} onClick={() => setViewMode('daily')}>Daily Entry</button>
                        <button className={`px-4 py-2 rounded-md text-xs font-bold transition ${viewMode === 'report' ? 'bg-white text-ncp-primary shadow-sm' : 'text-slate-500'}`} onClick={() => setViewMode('report')}>Driver Report</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exportToExcel} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-sm hover:bg-emerald-700 transition">
                            <i className="fas fa-file-excel mr-1"></i> EXCEL
                        </button>
                        <button onClick={exportToPDF} className="bg-rose-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-sm hover:bg-rose-700 transition">
                            <i className="fas fa-file-pdf mr-1"></i> PDF
                        </button>
                    </div>
                </div>

                {viewMode === 'daily' && (
                    <div>
                        <div className="flex flex-wrap justify-between items-end mb-6 pb-4 border-b border-gray-100 gap-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-700">Attendance for <span className="text-ncp-primary">{formatDate(selectedDate)}</span></h3>
                                <div className={`text-[10px] font-bold uppercase transition-colors ${getRate(selectedDate, currentHolidayReason) === 100 ? 'text-rose-500' : 'text-slate-400'}`}>
                                    Base Rate: {getRate(selectedDate, currentHolidayReason)} Rs/hr
                                </div>
                            </div>
                            <div className="flex items-center gap-3 no-print">
                                <div className="flex flex-col">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Mark as Holiday (Reason)</label>
                                    <input 
                                        type="text" 
                                        className="border border-gray-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-ncp-primary outline-none min-w-[200px]"
                                        placeholder="e.g. Winter Vacation, Public Holiday"
                                        value={currentHolidayReason}
                                        onChange={(e) => handleHolidayReasonUpdate(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Select Date</label>
                                    <button onClick={() => setIsDailyPickerOpen(true)} className="border border-gray-300 rounded px-4 py-2 bg-white text-xs font-bold hover:border-ncp-primary flex items-center gap-2">
                                        <i className="fas fa-calendar-alt text-amber-500"></i> {formatDate(selectedDate)}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {DRIVER_CATEGORIES.map(category => (
                                <div key={category.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-gray-200">
                                        <h4 className="font-bold text-ncp-primary uppercase text-[10px] tracking-widest">{category.title}</h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px] text-left border-collapse">
                                            <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px]">
                                                <tr>
                                                    <th className="p-3 w-10 text-center border border-slate-700">Sr</th>
                                                    <th className="p-3 w-40 border border-slate-700">Driver Name</th>
                                                    <th className="p-3 w-28 border border-slate-700">Status</th>
                                                    <th className="p-3 w-28 border border-slate-700">Vehicle</th>
                                                    <th className="p-3 w-20 text-center border border-slate-700">OT Start</th>
                                                    <th className="p-3 w-20 text-center border border-slate-700">OT End</th>
                                                    <th className="p-3 w-16 text-center border border-slate-700">OT Hrs</th>
                                                    <th className="p-3 w-20 text-center border border-slate-700 bg-slate-900">OT Total</th>
                                                    <th className="p-3 w-24 text-center border border-slate-700 bg-slate-900">Amount (Rs)</th>
                                                    <th className="p-3 border border-slate-700">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {db.drivers.filter(d => d.duty_type === category.id).map((driver, i) => {
                                                    const entry = db.attendance.find(r => r.date === selectedDate && r.driver === driver.name) || {};
                                                    const isPresent = entry.status === 'P';
                                                    const monthlyTotal = getMonthlyTotalOT(driver.name as string);
                                                    const monthlyAmount = getMonthlyTotalAmount(driver.name as string);
                                                    return (
                                                        <tr key={i} className="hover:bg-blue-50/30 border-b border-gray-50 last:border-none">
                                                            <td className="p-3 text-center text-slate-400 border border-gray-50">{i + 1}</td>
                                                            <td className="p-3 font-bold text-slate-700 border border-gray-50">{driver.name}</td>
                                                            <td className="p-0 border border-gray-50">
                                                                <select className={`w-full p-3 bg-transparent outline-none font-bold status-${entry.status || 'default'}`} value={entry.status || ''} onChange={(e) => handleDailyUpdate(driver.name as string, 'status', e.target.value)}>
                                                                    <option value="">Select</option>
                                                                    <option value="P">Present</option><option value="A">Absent</option><option value="L">Leave</option><option value="R">Rest</option><option value="M">Medical</option><option value="C">Casual</option>
                                                                </select>
                                                            </td>
                                                            <td className="p-0 border border-gray-50">
                                                                <select className="w-full p-3 bg-transparent outline-none text-[10px]" value={entry.vehicle_reg || ''} onChange={(e) => handleDailyUpdate(driver.name as string, 'vehicle_reg', e.target.value)}>
                                                                    <option value="">-</option>
                                                                    {vehicleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="p-0 border border-gray-50">
                                                                <input 
                                                                    type="text" 
                                                                    className={`w-full p-3 bg-transparent outline-none text-center font-mono ${!isPresent ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                                                    value={entry.ot_start || ''} 
                                                                    placeholder="00:00" 
                                                                    onChange={(e) => handleDailyUpdate(driver.name as string, 'ot_start', e.target.value)}
                                                                    disabled={!isPresent}
                                                                />
                                                            </td>
                                                            <td className="p-0 border border-gray-50">
                                                                <input 
                                                                    type="text" 
                                                                    className={`w-full p-3 bg-transparent outline-none text-center font-mono ${!isPresent ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                                                    value={entry.ot_end || ''} 
                                                                    placeholder="00:00" 
                                                                    onChange={(e) => handleDailyUpdate(driver.name as string, 'ot_end', e.target.value)}
                                                                    disabled={!isPresent}
                                                                />
                                                            </td>
                                                            <td className="p-0 border border-gray-50">
                                                                <input 
                                                                    type="number" 
                                                                    className={`w-full p-3 bg-transparent outline-none text-center font-bold text-ncp-primary ${!isPresent ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                                                    value={entry.ot_hours || ''} 
                                                                    placeholder="0" 
                                                                    onChange={(e) => handleDailyUpdate(driver.name as string, 'ot_hours', e.target.value)}
                                                                    disabled={!isPresent}
                                                                />
                                                            </td>
                                                            <td className="p-3 border border-gray-50 text-center font-bold text-ncp-primary bg-slate-50/50">
                                                                {monthlyTotal > 0 ? monthlyTotal.toFixed(1) : '-'}
                                                            </td>
                                                            <td className="p-3 border border-gray-50 text-right font-bold text-emerald-600 bg-emerald-50/30">
                                                                {monthlyAmount > 0 ? Math.round(monthlyAmount).toLocaleString() : '-'}
                                                            </td>
                                                            <td className="p-0 border border-gray-50"><input type="text" className="w-full p-3 bg-transparent outline-none" value={entry.remarks || ''} placeholder="Remarks" onChange={(e) => handleDailyUpdate(driver.name as string, 'remarks', e.target.value)} /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {viewMode === 'report' && (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Filter</label>
                                <select className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white outline-none" value={reportDriver} onChange={(e) => setReportDriver(e.target.value)}>
                                    <option value="">Select...</option>
                                    <option value="ALL">All Drivers</option>
                                    {DRIVER_CATEGORIES.map(c => <option key={c.id} value={`GROUP_${c.id}`}>{c.title}</option>)}
                                    {db.drivers.map((d, i) => <option key={i} value={d.name as string}>{d.name}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Date</label>
                                <button onClick={() => setIsFromPickerOpen(true)} className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white text-left font-bold focus:ring-1 focus:ring-ncp-primary outline-none">
                                    <i className="fas fa-calendar-alt mr-2 text-blue-500"></i> {fromDate ? formatDate(fromDate) : 'Start Date'}
                                </button>
                            </div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Date</label>
                                <button onClick={() => setIsToPickerOpen(true)} className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white text-left font-bold focus:ring-1 focus:ring-ncp-primary outline-none">
                                    <i className="fas fa-calendar-alt mr-2 text-blue-500"></i> {toDate ? formatDate(toDate) : 'End Date'}
                                </button>
                            </div>
                            <div className="flex items-end">
                                <button className="w-full bg-ncp-primary text-white py-2 rounded text-xs font-bold shadow-sm disabled:opacity-50" disabled={!reportDriver || !fromDate || !toDate}>RECALCULATE</button>
                            </div>
                        </div>
                        {reportData.length > 0 && (
                            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                                <table className="w-full text-[11px] text-center border-collapse">
                                    <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px]">
                                        <tr>
                                            <th className="p-3 border border-slate-700 w-10">Sr</th>
                                            <th className="p-3 border border-slate-700 text-left min-w-[150px]">Driver Name</th>
                                            <th className="p-3 border border-slate-700 w-16">Emp</th>
                                            <th className="p-3 border border-slate-700 w-8 text-green-400">P</th>
                                            <th className="p-3 border border-slate-700 w-8 text-blue-400">R</th>
                                            <th className="p-3 border border-slate-700 w-8 text-rose-400">A</th>
                                            <th className="p-3 border border-slate-700 w-8 text-purple-400">L</th>
                                            <th className="p-3 border border-slate-700 w-8 text-indigo-400">M</th>
                                            <th className="p-3 border border-slate-700 w-8 text-amber-400">C</th>
                                            <th className="p-3 border border-slate-700 w-20">OT Hrs</th>
                                            <th className="p-3 border border-slate-700 w-28">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {reportData.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 border-b border-gray-100">
                                                <td className="p-2 border border-gray-300 text-slate-400">{i + 1}</td>
                                                <td className="p-2 border border-gray-300 text-left font-bold text-slate-700">{row.driverName}</td>
                                                <td className="p-2 border border-gray-300 text-slate-500 font-mono">{row.driverEmp}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-green-600">{row.P || '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-blue-600">{row.R || '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-rose-600">{row.A || '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-purple-600">{row.L || '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-indigo-600">{row.M || '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-amber-600">{row.C || '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-amber-700 bg-amber-50/10">{row.ot_hours > 0 ? row.ot_hours.toFixed(1) : '-'}</td>
                                                <td className="p-2 border border-gray-300 font-bold text-ncp-primary bg-blue-50/10">{row.amount > 0 ? Math.round(row.amount).toLocaleString() : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <DatePicker isOpen={isDailyPickerOpen} onClose={() => setIsDailyPickerOpen(false)} selectedDate={getDateObject(selectedDate)} onDateSelect={(d) => setSelectedDate(getLocalISOString(d))} />
            <DatePicker isOpen={isFromPickerOpen} onClose={() => setIsFromPickerOpen(false)} selectedDate={getDateObject(fromDate)} onDateSelect={(d) => setFromDate(getLocalISOString(d))} />
            <DatePicker isOpen={isToPickerOpen} onClose={() => setIsToPickerOpen(false)} selectedDate={getDateObject(toDate)} onDateSelect={(d) => setToDate(getLocalISOString(d))} />
        </div>
    );
};

export default AttendanceView;
