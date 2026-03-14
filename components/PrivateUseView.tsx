import React, { useState, useMemo, useEffect } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { formatDate } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DatePicker from './DatePicker';

interface PrivateUseViewProps {
    db: Database;
    onUpdate: (updatedDb: Database, section?: string) => void;
}

const PrivateUseView: React.FC<PrivateUseViewProps> = ({ db, onUpdate }) => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(firstDay.toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
    
    const [isFromPickerOpen, setIsFromPickerOpen] = useState(false);
    const [isToPickerOpen, setIsToPickerOpen] = useState(false);

    const getOfficialRateAt50Percent = (dateStr: string, fuelType: string) => {
        if (!db.pol_prices || db.pol_prices.length === 0) return 0;
        if (!dateStr) return 0;

        const targetDate = dateStr.substring(0, 10);
        const sortedPrices = [...db.pol_prices]
            .filter(p => p.date)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        
        const priceRec = sortedPrices.find(p => String(p.date).substring(0, 10) <= targetDate);
        if (!priceRec) return 0;

        const rawPrice = fuelType === 'Diesel' ? Number(priceRec.diesel) : Number(priceRec.petrol);
        return parseFloat((rawPrice * 0.5).toFixed(2));
    };

    // Auto-sync effect: silently updates records when period or prices change within range
    useEffect(() => {
        const list = [...db.daily_reports];
        let hasChanges = false;

        list.forEach((r, idx) => {
            if (r.type === 'Private' && r.date) {
                const dStr = r.date as string;
                if (dStr >= fromDate && dStr <= toDate) {
                    const official50 = getOfficialRateAt50Percent(dStr, r.fuel_type as string);
                    if (official50 > 0 && Number(r.fuel_price) !== official50) {
                        list[idx] = { ...r, fuel_price: official50 };
                        hasChanges = true;
                    }
                }
            }
        });

        if (hasChanges) {
            onUpdate({ ...db, daily_reports: list }, 'daily_reports');
        }
    }, [fromDate, toDate, db.pol_prices]);

    const derivedData = useMemo(() => {
        return (db.daily_reports || [])
            .map((r, index) => ({ ...r, originalIndex: index } as GenericRecord & { originalIndex: number }))
            .filter(r => {
                if (!r.date || r.type !== 'Private') return false;
                const dStr = r.date as string;
                return dStr >= fromDate && dStr <= toDate;
            })
            .map((r, i) => {
                const price = Number(r.fuel_price) || 0;
                const liters = Number(r.liters) || 0;
                const amount = liters * price; 

                return {
                    sr: i + 1,
                    originalIndex: r.originalIndex,
                    date: r.date,
                    officer: r.officer, 
                    coe: r.coe,
                    reg: r.vehicle_reg,
                    mtr_out: r.meter_out,
                    mtr_in: r.meter_in,
                    kms: r.kms,
                    avg: r.average,
                    fuel_type: r.fuel_type,
                    cons: liters,
                    rate: price,
                    amount: amount
                };
            });
    }, [db.daily_reports, fromDate, toDate]);

    const totalAmount = derivedData.reduce((acc, r) => acc + r.amount, 0);
    const totalCons = derivedData.reduce((acc, r) => acc + r.cons, 0);

    const handleRateChange = (originalIndex: number, newVal: string) => {
        const list = [...db.daily_reports];
        const updatedRecord = { ...list[originalIndex] };
        updatedRecord.fuel_price = parseFloat(newVal) || 0;
        list[originalIndex] = updatedRecord;
        onUpdate({ ...db, daily_reports: list }, 'daily_reports');
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(derivedData.map(r => ({
            "Date": r.date,
            "Officer": r.officer,
            "Reg #": r.reg,
            "Mtr Out": r.mtr_out,
            "Mtr In": r.mtr_in,
            "KMs": r.kms,
            "Avg": r.avg,
            "Cons (L)": r.cons,
            "Rate": r.rate,
            "Amount (Rs)": r.amount
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "PrivateUse");
        const dateSuffix = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
        XLSX.writeFile(wb, `Private_Use_Report_${dateSuffix}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(14);
        doc.text("Private Use Report", 14, 15);
        doc.setFontSize(10);
        const dateHeader = fromDate === toDate ? `Date: ${formatDate(fromDate)}` : `From: ${formatDate(fromDate)} To: ${formatDate(toDate)}`;
        doc.text(dateHeader, 14, 22);

        const head = [['Sr', 'Date', 'Officer / User', 'Reg #', 'Mtr Out', 'Mtr In', 'KMs', 'Avg', 'Cons (L)', 'Rate', 'Amount (Rs)']];
        const body = derivedData.map((r, i) => [
            r.sr,
            formatDate(r.date as string),
            r.officer,
            r.reg,
            r.mtr_out,
            r.mtr_in,
            r.kms,
            r.avg,
            r.cons.toFixed(2),
            r.rate,
            Math.round(r.amount).toLocaleString()
        ]);
        body.push(['', '', 'TOTAL', '', '', '', '', '', totalCons.toFixed(2), '', Math.round(totalAmount).toLocaleString()]);

        autoTable(doc, { head, body, startY: 30, styles: { fontSize: 8 }, headStyles: { fillColor: [31, 41, 55] } });
        doc.save(`Private_Use_Report_${fromDate}.pdf`);
    };

    const getLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    return (
        <div id="view-private-use" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[80vh]">
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-lg border border-slate-200 gap-4">
                    <h5 className="text-xl font-bold text-ncp-primary">Private Use Report</h5>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsFromPickerOpen(true)} className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold hover:border-ncp-primary transition shadow-sm flex items-center gap-2">
                                <i className="fas fa-calendar-alt text-amber-500"></i> {formatDate(fromDate)}
                            </button>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">to</span>
                            <button onClick={() => setIsToPickerOpen(true)} className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold hover:border-ncp-primary transition shadow-sm flex items-center gap-2">
                                <i className="fas fa-calendar-alt text-amber-500"></i> {formatDate(toDate)}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs hover:bg-emerald-700 transition flex items-center shadow-sm font-bold" onClick={exportExcel}>
                                <i className="fas fa-file-excel mr-1"></i> EXCEL
                            </button>
                            <button className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs hover:bg-rose-700 transition flex items-center shadow-sm font-bold" onClick={handleExportPDF}>
                                <i className="fas fa-file-pdf mr-1"></i> PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px]">
                             <tr>
                                <th className="p-3 border border-slate-700 w-12">Sr</th>
                                <th className="p-3 border border-slate-700">Date</th>
                                <th className="p-3 border border-slate-700 text-left">Officer / User</th>
                                <th className="p-3 border border-slate-700">Reg #</th>
                                <th className="p-3 border border-slate-700">Mtr Out</th>
                                <th className="p-3 border border-slate-700">Mtr In</th>
                                <th className="p-3 border border-slate-700">KMs</th>
                                <th className="p-3 border border-slate-700">Avg</th>
                                <th className="p-3 border border-slate-700">Cons (L)</th>
                                <th className="p-3 border border-slate-700 w-28 bg-slate-900">Rate (POL)</th>
                                <th className="p-3 border border-slate-700 bg-slate-900 text-blue-400">Amount (Rs)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {derivedData.length === 0 ? (
                                <tr><td colSpan={11} className="p-8 text-slate-400 italic">No private use records found for the selected range.</td></tr>
                            ) : (
                                derivedData.map((row, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-gray-100 text-[11px]">
                                        <td className="p-2 border border-gray-300 text-gray-400 font-bold">{row.sr}</td>
                                        <td className="p-2 border border-gray-300 whitespace-nowrap font-medium">{formatDate(row.date as string)}</td>
                                        <td className="p-2 border border-gray-300 text-left font-bold uppercase text-slate-700">
                                            {row.officer} 
                                            <span className="text-[9px] text-slate-400 block font-normal">{row.coe}</span>
                                        </td>
                                        <td className="p-2 border border-gray-300 font-bold text-blue-700">{row.reg}</td>
                                        <td className="p-2 border border-gray-300 text-slate-600">{row.mtr_out}</td>
                                        <td className="p-2 border border-gray-300 text-slate-600">{row.mtr_in}</td>
                                        <td className="p-2 border border-gray-300 font-bold text-blue-600 bg-blue-50/10">{row.kms}</td>
                                        <td className="p-2 border border-gray-300 italic">{row.avg}</td>
                                        <td className="p-2 border border-gray-300 font-bold text-amber-700 bg-amber-50/20">{row.cons.toFixed(2)}</td>
                                        <td className="p-0 border border-gray-300">
                                            <input 
                                                type="number" 
                                                className="w-full h-full p-2 text-center bg-transparent focus:bg-white outline-none font-bold text-blue-700"
                                                value={row.rate || ''}
                                                onChange={(e) => handleRateChange(row.originalIndex, e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2 border border-gray-300 font-bold text-ncp-primary bg-blue-50/50">
                                            {Math.round(row.amount).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-200 font-bold border-t-2 border-gray-300 text-slate-800">
                             <tr>
                                <td colSpan={8} className="p-3 text-right uppercase tracking-widest text-xs text-slate-500">Grand Total</td>
                                <td className="p-3 text-center text-amber-700 border-x border-gray-300">{totalCons.toFixed(2)}</td>
                                <td className="p-3 text-center">-</td>
                                <td className="p-4 text-center text-lg text-ncp-primary bg-blue-100/50">{Math.round(totalAmount).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <DatePicker 
                isOpen={isFromPickerOpen}
                onClose={() => setIsFromPickerOpen(false)}
                selectedDate={new Date(fromDate)}
                onDateSelect={(d) => {
                    const newDate = getLocalISOString(d);
                    setFromDate(newDate);
                    if (newDate > toDate) setToDate(newDate);
                }}
            />
            <DatePicker 
                isOpen={isToPickerOpen}
                onClose={() => setIsToPickerOpen(false)}
                selectedDate={new Date(toDate)}
                onDateSelect={(d) => {
                    const newDate = getLocalISOString(d);
                    setToDate(newDate);
                    if (newDate < fromDate) setFromDate(newDate);
                }}
            />
        </div>
    );
};

export default PrivateUseView;