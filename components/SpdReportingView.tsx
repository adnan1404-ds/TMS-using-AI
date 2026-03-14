
import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import DatePicker from './DatePicker';
import { formatDate } from '../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SpdReportingViewProps {
    db: Database;
    // These are kept for prop-type compatibility but will not be used for adding/deleting
    onAdd: (data?: GenericRecord) => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onRowUpdate: (index: number, updatedRow: GenericRecord) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

/**
 * SPD Reporting View - Read-only reporting component synchronized with Job Orders
 */
const SpdReportingView: React.FC<SpdReportingViewProps> = ({ db }) => {
    // Default range: Current month start to Current date
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(firstDay.toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
    
    const [isFromPickerOpen, setIsFromPickerOpen] = useState(false);
    const [isToPickerOpen, setIsToPickerOpen] = useState(false);

    // Filtered data sourced directly from job_orders
    const filteredData = useMemo(() => {
        return (db.job_orders || [])
            .filter(r => {
                if (!r.date) return false;
                const dateStr = String(r.date);
                return dateStr >= fromDate && dateStr <= toDate;
            })
            // Sort by date descending
            .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
    }, [db.job_orders, fromDate, toDate]);

    const handleExportExcel = () => {
        const data = filteredData.map((r, i) => ({
            "Ser": i + 1,
            "Date": r.date,
            "WO # / JO #": r.jo_number,
            "Make & Type": r.make_type,
            "Regn Number": r.reg_no,
            "Usage": r.usage_type,
            "Driver & NCP #": r.driver_info,
            "Fault Description": r.fault_desc,
            "Workshop": r.workshop,
            "Bill No": r.bill_no,
            "Amount (Rs)": r.bill_amount
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SPD_Report");
        XLSX.writeFile(wb, `SPD_Reporting_${fromDate}_to_${toDate}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(14);
        doc.text("Repair & Maintenance of Vehicles - NCP (SPD Reporting)", 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 22);

        const head = [['Ser', 'Date', 'WO #', 'Make & Type', 'Regn No', 'Usage', 'Driver Info', 'Fault Description', 'Bill No', 'Amount']];
        const body = filteredData.map((r, i) => [
            i + 1,
            formatDate(r.date as string),
            r.jo_number,
            r.make_type,
            r.reg_no,
            r.usage_type,
            r.driver_info,
            r.fault_desc,
            r.bill_no,
            r.bill_amount
        ]);
        autoTable(doc, { head, body, startY: 30, styles: { fontSize: 7 } });
        doc.save(`SPD_Reporting_${fromDate}.pdf`);
    };

    // Helper to get date object from ISO string
    const getDateObject = (isoStr: string) => {
        if (!isoStr) return new Date();
        const [y, m, d] = isoStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    return (
        <div id="view-spd-reporting" className="content-section relative">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 flex flex-col min-h-[80vh]">
                
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                            <label className="font-bold text-slate-700 text-xs uppercase tracking-wide">From:</label>
                            <button 
                                onClick={() => setIsFromPickerOpen(true)}
                                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-left flex items-center justify-between w-36 hover:border-ncp-primary transition shadow-sm"
                            >
                                <span className="font-bold">{formatDate(fromDate)}</span>
                                <i className="fas fa-calendar-alt text-slate-400"></i>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="font-bold text-slate-700 text-xs uppercase tracking-wide">To:</label>
                            <button 
                                onClick={() => setIsToPickerOpen(true)}
                                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-left flex items-center justify-between w-36 hover:border-ncp-primary transition shadow-sm"
                            >
                                <span className="font-bold">{formatDate(toDate)}</span>
                                <i className="fas fa-calendar-alt text-slate-400"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-xs font-bold">
                            <i className="fas fa-file-excel mr-1"></i> EXCEL
                        </button>
                        <button onClick={handleExportPDF} className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition shadow-sm text-xs font-bold">
                            <i className="fas fa-file-pdf mr-1"></i> PDF
                        </button>
                        <button className="bg-white border border-slate-200 text-slate-600 font-bold py-2 px-5 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs" onClick={() => window.print()}>
                            <i className="fas fa-print me-2 text-slate-400"></i> PRINT
                        </button>
                    </div>
                </div>

                <div className="text-center mb-6 border-b border-gray-100 pb-4">
                    <h2 className="text-2xl font-extrabold text-ncp-primary uppercase tracking-tight">Repair & Maintenance of Vehicles - NCP</h2>
                    <h3 className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">
                        SPD Reporting Status ({formatDate(fromDate)} - {formatDate(toDate)})
                    </h3>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-slate-50/50">
                    <table className="w-full text-[11px] text-center border-collapse relative min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-100 text-slate-700 uppercase tracking-wider font-bold border-b border-gray-300">
                                <th className="border border-gray-300 p-3 w-12 text-center bg-gray-100">Ser</th>
                                <th className="border border-gray-300 p-3 w-24 text-center bg-gray-100">Date</th>
                                <th className="border border-gray-300 p-3 w-24 text-center bg-gray-100">WO / JO #</th>
                                <th className="border border-gray-300 p-3 w-36 text-center bg-gray-100">Make & Type</th>
                                <th className="border border-gray-300 p-3 w-32 text-center bg-gray-100">Regn Number</th>
                                <th className="border border-gray-300 p-3 w-24 text-center bg-gray-100">Usage</th>
                                <th className="border border-gray-300 p-3 text-center bg-gray-100">Driver & NCP #</th>
                                <th className="border border-gray-300 p-3 w-1/4 text-left bg-gray-100">Fault Description</th>
                                <th className="border border-gray-300 p-3 w-24 text-center bg-gray-100">Bill No</th>
                                <th className="border border-gray-300 p-3 w-28 text-right bg-gray-100 pr-4">Amount (Rs)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-12 text-center text-slate-400 italic border border-gray-300">
                                        No Job Orders found in this date range. Data is automatically synced from the "Job Orders" module.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row, index) => (
                                    <tr key={index} className="hover:bg-yellow-50 transition-colors border-b border-gray-100">
                                        <td className="border border-gray-300 p-3 text-center text-slate-500 font-bold">{index + 1}</td>
                                        <td className="border border-gray-300 p-3 font-medium text-slate-700">{formatDate(row.date as string)}</td>
                                        <td className="border border-gray-300 p-3 font-bold text-ncp-primary">{row.jo_number}</td>
                                        <td className="border border-gray-300 p-3 text-slate-600">{row.make_type}</td>
                                        <td className="border border-gray-300 p-3 font-bold text-slate-800">{row.reg_no}</td>
                                        <td className="border border-gray-300 p-3 text-xs">
                                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-600">{row.usage_type}</span>
                                        </td>
                                        <td className="border border-gray-300 p-3 text-slate-700">{row.driver_info}</td>
                                        <td className="border border-gray-300 p-3 text-left italic text-slate-500 max-w-xs truncate" title={row.fault_desc as string}>
                                            {row.fault_desc}
                                        </td>
                                        <td className="border border-gray-300 p-3 text-slate-600">{row.bill_no}</td>
                                        <td className="border border-gray-300 p-3 text-right font-bold text-slate-800 pr-4">
                                            {row.bill_amount ? Number(row.bill_amount).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-between items-center text-[10px] text-gray-400 italic px-2">
                    <p><i className="fas fa-sync-alt mr-1"></i> Data in this report is automatically synchronized from Job Orders.</p>
                    <p className="font-bold uppercase tracking-widest text-slate-400">Total Duties: {filteredData.length}</p>
                </div>
            </div>

            <DatePicker 
                isOpen={isFromPickerOpen} 
                onClose={() => setIsFromPickerOpen(false)} 
                selectedDate={getDateObject(fromDate)} 
                onDateSelect={(d) => setFromDate(d.toISOString().split('T')[0])} 
            />
            <DatePicker 
                isOpen={isToPickerOpen} 
                onClose={() => setIsToPickerOpen(false)} 
                selectedDate={getDateObject(toDate)} 
                onDateSelect={(d) => setToDate(d.toISOString().split('T')[0])} 
            />
        </div>
    );
};

export default SpdReportingView;
