
import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import { formatDate } from '../constants';
import DatePicker from './DatePicker';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface JobOrdersViewProps {
    db: Database;
    onAdd: () => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onRowUpdate: (index: number, updatedRow: GenericRecord) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

const JobOrdersView: React.FC<JobOrdersViewProps> = ({ db, onAdd, onEdit, onDelete, onRowUpdate, onDirectAdd }) => {
    const [filter, setFilter] = useState("");
    const [activeDateRow, setActiveDateRow] = useState<number | null>(null);

    // Helper to calculate Fiscal Year string (July 1st start)
    // E.g., 23-Dec-25 -> 25-26
    const getFiscalYearStr = (dateInput: string | Date) => {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "24-25";
        const year = d.getFullYear();
        const month = d.getMonth(); // 0-11
        if (month >= 6) { // July (6) to December (11)
            return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
        } else { // January (0) to June (5)
            return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
        }
    };

    const currentYearStr = getFiscalYearStr(new Date());
    const [selectedFY, setSelectedFY] = useState(currentYearStr);

    // Generate dynamic FY list based on data + current range
    const fiscalYears = useMemo(() => {
        const years = new Set<string>();
        // Add current and surrounding years
        const today = new Date();
        const thisYear = today.getFullYear();
        for (let i = -2; i <= 2; i++) {
            const d = new Date(thisYear + i, 6, 1); // July of various years
            years.add(getFiscalYearStr(d));
        }
        // Add years found in DB
        (db.job_orders || []).forEach(jo => {
            if (jo.fiscal_year) years.add(jo.fiscal_year as string);
            if (jo.date) years.add(getFiscalYearStr(jo.date as string));
        });
        return Array.from(years).sort();
    }, [db.job_orders]);

    const data = (db.job_orders || []).map((r, i) => ({ ...r, originalIndex: i } as GenericRecord & { originalIndex: number }));
    
    const filteredData = data.filter(row => {
        const matchesSearch = Object.values(row).some(val => String(val).toLowerCase().includes(filter.toLowerCase()));
        const rowFY = row.fiscal_year || getFiscalYearStr(row.date as string);
        return matchesSearch && rowFY === selectedFY;
    });

    const vehicleOptions = useMemo(() => (db.vehicles || []).map(v => ({
        reg: v.reg_no as string,
        make: v.make_type as string,
        usage: v.duty_type as string
    })), [db.vehicles]);

    const driverOptions = useMemo(() => (db.drivers || []).map(d => ({
        display: `${d.name} (${d.emp_nmbr})`,
        name: d.name as string
    })), [db.drivers]);

    const handleInputChange = (index: number, field: string, value: string | number) => {
        const row = db.job_orders[index];
        const updated = { ...row, [field]: value };
        
        if (field === 'date') {
            const dateVal = value as string;
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
                updated.day = d.toLocaleDateString('en-US', { weekday: 'long' });
                // CRITICAL: Update the fiscal year property of the record to match the new date
                updated.fiscal_year = getFiscalYearStr(dateVal);
            }
        }

        if (field === 'reg_no') {
            const veh = vehicleOptions.find(v => v.reg === value);
            if (veh) {
                updated.make_type = veh.make;
                updated.usage_type = veh.usage;
            }
        }
        onRowUpdate(index, updated);
    };

    const handleNewJO = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayFY = getFiscalYearStr(todayStr);
        
        let targetDateStr = todayStr;
        let targetDay = today.toLocaleDateString('en-US', { weekday: 'long' });

        // If current view is different from today's FY, default to the start of that FY
        if (todayFY !== selectedFY) {
            const startYearPart = selectedFY.split('-')[0];
            const fullYear = 2000 + parseInt(startYearPart);
            targetDateStr = `${fullYear}-07-01`;
            const d = new Date(targetDateStr);
            targetDay = d.toLocaleDateString('en-US', { weekday: 'long' });
        }
        
        onDirectAdd({ 
            jo_number: '', 
            fiscal_year: selectedFY,
            date: targetDateStr, 
            day: targetDay, 
            make_type: '', 
            reg_no: '', 
            usage_type: '', 
            driver_info: '', 
            workshop: '', 
            fault_desc: '', 
            bill_no: '', 
            bill_amount: 0, 
            kms_prev: 0, 
            kms_pres: 0 
        });
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(r => ({
            "FY": r.fiscal_year,
            "JO #": r.jo_number,
            "Date": formatDate(r.date as string),
            "Day": r.day,
            "Make & Type": r.make_type,
            "Reg #": r.reg_no,
            "Usage": r.usage_type,
            "Driver & NCP #": r.driver_info,
            "Workshop": r.workshop,
            "Fault Description": r.fault_desc,
            "Bill No": r.bill_no,
            "Amount (Rs)": r.bill_amount,
            "KMS Previous": r.kms_prev,
            "KMS Present": r.kms_pres
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Job_Orders_FY_${selectedFY}`);
        XLSX.writeFile(wb, `Maintenance_Job_Orders_FY_${selectedFY}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(12);
        doc.text(`Job Orders (Maintenance Records) - FY ${selectedFY}`, 14, 15);
        const body = filteredData.map(r => [
            r.jo_number, 
            formatDate(r.date as string),
            r.reg_no, 
            r.usage_type, 
            r.workshop, 
            r.bill_amount, 
            r.kms_prev, 
            r.kms_pres
        ]);
        autoTable(doc, {
            head: [['JO #', 'Date', 'Reg #', 'Usage', 'Workshop', 'Amount', 'KMS Pre', 'KMS Pres']],
            body, startY: 20, styles: { fontSize: 7 },
            headStyles: { fillColor: [31, 41, 55] }
        });
        doc.save(`Job_Orders_FY_${selectedFY}.pdf`);
    };

    return (
        <div className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6 no-print gap-4">
                    <div className="flex flex-col">
                        <h5 className="text-xl font-bold text-ncp-primary uppercase tracking-tight">Maintenance Hub</h5>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Auto-Calculating Fiscal Years</p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-2">Fiscal Year:</label>
                        <select 
                            className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-bold text-ncp-primary outline-none focus:ring-2 focus:ring-blue-100"
                            value={selectedFY}
                            onChange={(e) => setSelectedFY(e.target.value)}
                        >
                            {fiscalYears.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex w-48">
                            <span className="px-3 py-2 bg-slate-50 border border-r-0 border-gray-300 rounded-l text-slate-400 flex items-center justify-center">
                                <i className="fas fa-search text-xs"></i>
                            </span>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-r px-3 py-2 text-xs outline-none bg-white" 
                                placeholder="Search records..." 
                                value={filter} 
                                onChange={(e) => setFilter(e.target.value)} 
                            />
                        </div>
                        <button onClick={exportToExcel} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700 transition" title="Export Excel">
                            <i className="fas fa-file-excel"></i>
                        </button>
                        <button onClick={exportToPDF} className="bg-rose-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-rose-700 transition" title="Export PDF">
                            <i className="fas fa-file-pdf"></i>
                        </button>
                        <button className="bg-ncp-primary text-white py-2 px-5 rounded-lg hover:bg-ncp-dark transition shadow-sm font-bold text-xs" onClick={handleNewJO}>
                            <i className="fas fa-plus me-1"></i> NEW JO
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full text-[10px] text-left border-collapse relative min-w-[1450px]">
                        <thead className="bg-slate-800 text-white sticky top-0 z-20 shadow-sm uppercase font-bold tracking-widest text-[9px]">
                            <tr>
                                <th className="border border-slate-700 p-3 w-16 text-center">JO #</th>
                                <th className="border border-slate-700 p-3 w-32 text-center">Date</th>
                                <th className="border border-slate-700 p-3 w-24 text-center">Day</th>
                                <th className="border border-slate-700 p-3 w-32 text-center">Reg #</th>
                                <th className="border border-slate-700 p-3 w-40 text-center">Make & Type</th>
                                <th className="border border-slate-700 p-3 w-24 text-center">Usage</th>
                                <th className="border border-slate-700 p-3 w-48 text-center">Driver & NCP #</th>
                                <th className="border border-slate-700 p-3 w-40 text-center">Workshop</th>
                                <th className="border border-slate-700 p-3 min-w-[250px]">Fault Description</th>
                                <th className="border border-slate-700 p-3 w-24 text-center">Bill No</th>
                                <th className="border border-slate-700 p-3 w-28 text-right pr-4">Amount (Rs)</th>
                                <th className="border border-slate-700 p-3 w-24 text-center">KMS Prev</th>
                                <th className="border border-slate-700 p-3 w-24 text-center">KMS Pres</th>
                                <th className="border border-slate-700 p-3 w-16 text-center action-col no-print">Act</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white font-arial text-[11px]">
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={14} className="p-16 text-center text-slate-400 italic">No job orders found for FY {selectedFY}. Changing a record's date will automatically move it to the corresponding Fiscal Year view.</td></tr>
                            ) : (
                                filteredData.map((row, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-gray-100">
                                        <td className="border border-gray-300 p-0 text-center font-bold text-ncp-primary">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-center" value={row.jo_number || ''} onChange={e => handleInputChange(row.originalIndex, 'jo_number', e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0 text-center font-medium">
                                            <input readOnly className="w-full p-2 bg-transparent focus:bg-white outline-none text-center cursor-pointer" value={formatDate(row.date as string)} onClick={() => setActiveDateRow(row.originalIndex)} />
                                        </td>
                                        <td className="border border-gray-300 p-2 text-center text-slate-500 font-bold bg-slate-50/50 uppercase">{row.day || '-'}</td>
                                        <td className="border border-gray-300 p-0 text-center">
                                            <select className="w-full p-2 bg-transparent focus:bg-white outline-none text-center font-bold" value={row.reg_no || ''} onChange={e => handleInputChange(row.originalIndex, 'reg_no', e.target.value)}>
                                                <option value="">Select Reg #</option>
                                                {vehicleOptions.map(v => <option key={v.reg} value={v.reg}>{v.reg}</option>)}
                                            </select>
                                        </td>
                                        <td className="border border-gray-300 p-2 text-center text-slate-600 bg-slate-50/30 uppercase">{row.make_type || '-'}</td>
                                        <td className="border border-gray-300 p-0 text-center">
                                            <select className="w-full p-2 bg-transparent focus:bg-white outline-none text-center font-bold" value={row.usage_type || ''} onChange={e => handleInputChange(row.originalIndex, 'usage_type', e.target.value)}>
                                                <option value="">Select...</option>
                                                <option value="Shift">Shift</option><option value="Adm">Adm</option><option value="General">General</option><option value="Entitled">Entitled</option><option value="SOI">SOI</option>
                                            </select>
                                        </td>
                                        <td className="border border-gray-300 p-0 text-center">
                                            <select className="w-full p-2 bg-transparent focus:bg-white outline-none text-center font-medium" value={row.driver_info || ''} onChange={e => handleInputChange(row.originalIndex, 'driver_info', e.target.value)}>
                                                <option value="">Select Driver</option>
                                                {driverOptions.map(d => <option key={d.display} value={d.display}>{d.display}</option>)}
                                            </select>
                                        </td>
                                        <td className="border border-gray-300 p-0 text-center">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-center uppercase" value={row.workshop || ''} onChange={e => handleInputChange(row.originalIndex, 'workshop', e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <textarea className="w-full p-2 bg-transparent focus:bg-white outline-none resize-none text-[10px] leading-tight" rows={2} value={row.fault_desc || ''} onChange={e => handleInputChange(row.originalIndex, 'fault_desc', e.target.value)} placeholder="Fault detail..." />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-center font-bold" value={row.bill_no || ''} onChange={e => handleInputChange(row.originalIndex, 'bill_no', e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0 bg-gray-50/20">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-right pr-4 font-bold text-ncp-primary" type="number" value={row.bill_amount || 0} onChange={e => handleInputChange(row.originalIndex, 'bill_amount', e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-center font-mono" type="number" value={row.kms_prev || 0} onChange={e => handleInputChange(row.originalIndex, 'kms_prev', e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-center font-mono" type="number" value={row.kms_pres || 0} onChange={e => handleInputChange(row.originalIndex, 'kms_pres', e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-2 text-center action-col no-print">
                                            <button className="text-rose-400 hover:text-rose-600 transition-colors p-2 rounded-full hover:bg-rose-50" onClick={() => onDelete(row.originalIndex)}>
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            <tr className="bg-gray-50/50 hover:bg-blue-50 transition cursor-pointer no-print">
                                <td colSpan={14} className="p-0 text-center border-t border-dashed border-gray-300">
                                    <button className="w-full py-4 text-blue-600 font-bold text-[11px] flex items-center justify-center gap-3 uppercase tracking-widest" onClick={handleNewJO}>
                                        <i className="fas fa-plus-circle text-base"></i> CREATE NEW JOB ORDER IN FY {selectedFY}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-4 flex justify-between items-center text-[10px] text-gray-400 italic px-2">
                    <p><i className="fas fa-database mr-1"></i> Fiscal Years (Jul-Jun) are auto-detected. Example: 23-Dec-25 automatically maps to FY 25-26.</p>
                    <p className="font-bold uppercase tracking-widest text-ncp-primary">Selected Filter: FY {selectedFY}</p>
                </div>
            </div>

            {activeDateRow !== null && (
                <DatePicker 
                    isOpen={activeDateRow !== null} 
                    onClose={() => setActiveDateRow(null)} 
                    selectedDate={db.job_orders[activeDateRow]?.date ? new Date(db.job_orders[activeDateRow].date as string) : new Date()} 
                    onDateSelect={(d) => { 
                        handleInputChange(activeDateRow, 'date', d.toISOString().split('T')[0]); 
                        setActiveDateRow(null); 
                    }} 
                />
            )}
        </div>
    );
};

export default JobOrdersView;
