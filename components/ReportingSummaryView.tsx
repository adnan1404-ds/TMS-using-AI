
import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import DatePicker from './DatePicker';
import { formatDate, COE_LIST } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
    db: Database;
}

const ReportingSummaryView: React.FC<Props> = ({ db }) => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(firstOfMonth.toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
    const [isFromPickerOpen, setIsFromPickerOpen] = useState(false);
    const [isToPickerOpen, setIsToPickerOpen] = useState(false);

    const officialRecords = useMemo(() => {
        return (db.daily_reports || [])
            .filter(r => {
                if (r.type !== 'Official') return false;
                if (!r.date) return false;
                const dStr = String(r.date);
                return dStr >= fromDate && dStr <= toDate;
            })
            .map((r): GenericRecord => {
                const veh = db.vehicles.find(v => v.reg_no === r.vehicle_reg);
                const fuelType = (r.fuel_type as string) || (veh?.fuel_type as string) || 'Petrol';
                return { ...r, fuel_type: fuelType };
            });
    }, [db.daily_reports, fromDate, toDate, db.vehicles]);

    const summaryData = useMemo(() => {
        const rows = COE_LIST.map((coe, index) => {
            const records = officialRecords.filter(r => r.coe === coe);
            return {
                sr: index + 1,
                coe: coe,
                duties: records.length,
                kms: records.reduce((sum, r) => sum + (Number(r.kms) || 0), 0),
                diesel: records.filter(r => r.fuel_type === 'Diesel').reduce((sum, r) => sum + (Number(r.liters) || 0), 0),
                petrol: records.filter(r => r.fuel_type === 'Petrol').reduce((sum, r) => sum + (Number(r.liters) || 0), 0)
            };
        });

        const totals = rows.reduce((acc, r) => ({
            duties: acc.duties + r.duties,
            kms: acc.kms + r.kms,
            diesel: acc.diesel + r.diesel,
            petrol: acc.petrol + r.petrol
        }), { duties: 0, kms: 0, diesel: 0, petrol: 0 });

        return { rows, totals };
    }, [officialRecords]);

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(summaryData.rows.map(r => ({
            "S #": r.sr, 
            "CoE / Setup": r.coe, 
            "Total Duties": r.duties,
            "Total KMs": r.kms, 
            "Diesel (L)": r.diesel.toFixed(2), 
            "Petrol (L)": r.petrol.toFixed(2)
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Official Summary");
        XLSX.writeFile(wb, `Official_Transport_Summary_${fromDate}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text("Official Transport Utilization Summary", 14, 15);
        doc.setFontSize(10);
        doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 22);

        const head = [['S #', 'NCP Setups & CoEs', 'Duties', 'Total KMs', 'Diesel (L)', 'Petrol (L)']];
        const body = summaryData.rows.map(r => [
            r.sr, r.coe, r.duties, r.kms, r.diesel.toFixed(1), r.petrol.toFixed(1)
        ]);
        body.push(['', 'GRAND TOTAL', summaryData.totals.duties, summaryData.totals.kms, summaryData.totals.diesel.toFixed(1), summaryData.totals.petrol.toFixed(1)]);

        autoTable(doc, { head, body, startY: 30, theme: 'grid' });
        doc.save(`Official_Summary_${fromDate}.pdf`);
    };

    return (
        <div className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[80vh]">
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-lg border border-slate-200 gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsFromPickerOpen(true)} className="bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold shadow-sm">
                            From: {formatDate(fromDate)}
                        </button>
                        <button onClick={() => setIsToPickerOpen(true)} className="bg-white border border-gray-300 rounded px-3 py-2 text-xs font-bold shadow-sm">
                            To: {formatDate(toDate)}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-emerald-700 transition">EXCEL</button>
                        <button onClick={handleExportPDF} className="bg-rose-600 text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-rose-700 transition">PDF</button>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-ncp-primary uppercase tracking-tight">Official Utilization Summary</h2>
                    <p className="text-slate-500 font-medium">Aggregated data from Official Daily Movement Reports</p>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/30">
                    <table className="w-full text-center border-collapse text-xs">
                        <thead className="bg-slate-800 text-white uppercase font-bold tracking-wider">
                            <tr>
                                <th className="border border-slate-700 p-3 w-12">S #</th>
                                <th className="border border-slate-700 p-3 text-left">NCP Setups & CoEs</th>
                                <th className="border border-slate-700 p-3 w-24">Duties</th>
                                <th className="border border-slate-700 p-3 w-24">KMs</th>
                                <th className="border border-slate-700 p-3 w-28 bg-blue-900/30">Diesel (L)</th>
                                <th className="border border-slate-700 p-3 w-28 bg-green-900/30">Petrol (L)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white font-medium text-[11px]">
                            {summaryData.rows.map((row) => (
                                <tr key={row.sr} className="hover:bg-slate-50 border-b border-gray-200">
                                    <td className="p-3 border border-gray-200 text-slate-400">{row.sr}</td>
                                    <td className="p-3 border border-gray-200 text-left font-bold text-slate-700">{row.coe}</td>
                                    <td className="p-3 border border-gray-200">{row.duties || '-'}</td>
                                    <td className="p-3 border border-gray-200">{row.kms || '-'}</td>
                                    <td className="p-3 border border-gray-200 text-blue-700 bg-blue-50/20">{row.diesel > 0 ? row.diesel.toFixed(1) : '-'}</td>
                                    <td className="p-3 border border-gray-200 text-green-700 bg-green-50/20">{row.petrol > 0 ? row.petrol.toFixed(1) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-300">
                            <tr>
                                <td colSpan={2} className="p-3 text-right uppercase tracking-widest">Grand Totals</td>
                                <td className="p-3 border border-gray-300">{summaryData.totals.duties}</td>
                                <td className="p-3 border border-gray-300">{summaryData.totals.kms}</td>
                                <td className="p-3 border border-gray-300 bg-blue-50">{summaryData.totals.diesel.toFixed(1)}</td>
                                <td className="p-3 border border-gray-300 bg-green-50">{summaryData.totals.petrol.toFixed(1)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <DatePicker isOpen={isFromPickerOpen} onClose={() => setIsFromPickerOpen(false)} selectedDate={new Date(fromDate)} onDateSelect={(d) => setFromDate(d.toISOString().split('T')[0])} />
            <DatePicker isOpen={isToPickerOpen} onClose={() => setIsToPickerOpen(false)} selectedDate={new Date(toDate)} onDateSelect={(d) => setToDate(d.toISOString().split('T')[0])} />
        </div>
    );
};

export default ReportingSummaryView;
