
import React, { useState, useMemo, useEffect } from 'react';
import { Database } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '../constants';

interface PolSoiEntViewProps {
    db: Database;
    onUpdate: (updatedDb: Database, section?: string) => void;
}

const PolSoiEntView: React.FC<PolSoiEntViewProps> = ({ db, onUpdate }) => {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    
    const availableVehicles = useMemo(() => {
        return (db.vehicles || []);
    }, [db.vehicles]);

    const [selectedVehicle, setSelectedVehicle] = useState(availableVehicles.length > 0 ? availableVehicles[0].reg_no as string : "");

    useEffect(() => {
        if (availableVehicles.length > 0) {
            const exists = availableVehicles.find(v => v.reg_no === selectedVehicle);
            if (!exists) {
                setSelectedVehicle(availableVehicles[0].reg_no as string);
            }
        } else {
            setSelectedVehicle("");
        }
    }, [availableVehicles, selectedVehicle]);

    const currentVehicleObj = db.vehicles.find(v => v.reg_no === selectedVehicle);
    const showHeldVehicleInput = currentVehicleObj && ['SOI', 'Entitled'].includes(currentVehicleObj.duty_type as string);

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const getDailyEntry = (monthIndex: number, day: number) => {
        const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return db.pol_soi_entries.find(e => e.vehicle_reg === selectedVehicle && e.date === dateStr);
    };

    const getMonthlyRecord = (monthIndex: number) => {
        const monthYear = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        return db.pol_soi_monthly.find(m => m.vehicle_reg === selectedVehicle && m.month_year === monthYear);
    };

    const calculateMonthSummary = (monthIndex: number) => {
        let totalPurchaseQty = 0;
        let totalPurchaseAmt = 0;

        const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const entry = getDailyEntry(monthIndex, d);
            if (entry) {
                totalPurchaseQty += Number(entry.qty || 0);
                totalPurchaseAmt += Number(entry.amount || 0);
            }
        }

        const monthlyRec = getMonthlyRecord(monthIndex);
        let openingBalance = 0;
        if (monthIndex === 0) {
            openingBalance = Number(monthlyRec?.opening_balance || 0);
        } else {
            const prevMonthRec = getMonthlyRecord(monthIndex - 1);
            openingBalance = Number(prevMonthRec?.fuel_in_tank || 0);
        }

        const totalFuel = openingBalance + totalPurchaseQty;
        const meterStart = Number(monthlyRec?.meter_start || 0);
        const meterEnd = Number(monthlyRec?.meter_end || 0);
        const fuelInTank = Number(monthlyRec?.fuel_in_tank || 0);
        const consumed = totalFuel - fuelInTank;
        const mileage = meterEnd - meterStart;
        const average = consumed > 0 ? (mileage / consumed) : 0;

        return { totalPurchaseQty, totalPurchaseAmt, openingBalance, totalFuel, meterStart, meterEnd, mileage, consumed, fuelInTank, average };
    };

    const handleDailyChange = (monthIndex: number, day: number, field: string, value: string) => {
        const dateStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let entries = [...(db.pol_soi_entries || [])];
        const idx = entries.findIndex(e => e.vehicle_reg === selectedVehicle && e.date === dateStr);
        let entry = idx >= 0 ? { ...entries[idx] } : { vehicle_reg: selectedVehicle, date: dateStr };
        if (['odometer', 'qty', 'amount'].includes(field)) entry[field] = parseFloat(value) || 0;
        else entry[field] = value;
        if (idx >= 0) entries[idx] = entry; else entries.push(entry);
        onUpdate({ ...db, pol_soi_entries: entries }, 'pol_soi_entries');
    };

    const handleMonthlyChange = (monthIndex: number, field: string, value: string) => {
        const monthYear = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        let records = [...(db.pol_soi_monthly || [])];
        const idx = records.findIndex(m => m.vehicle_reg === selectedVehicle && m.month_year === monthYear);
        let record = idx >= 0 ? { ...records[idx] } : { vehicle_reg: selectedVehicle, month_year: monthYear };
        record[field] = parseFloat(value) || 0;
        if (idx >= 0) records[idx] = record; else records.push(record);
        onUpdate({ ...db, pol_soi_monthly: records }, 'pol_soi_monthly');
    };

    const handleOfficerNameChange = (val: string) => {
        const updatedVehicles = db.vehicles.map(v => 
            v.reg_no === selectedVehicle ? { ...v, detail: val } : v
        );
        onUpdate({ ...db, vehicles: updatedVehicles }, 'vehicles');
    };

    const summary = calculateMonthSummary(selectedMonth);
    const monthName = months[selectedMonth];
    const monthShort = monthShortNames[selectedMonth];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const handleExportExcel = () => {
        if (!selectedVehicle) return;
        const rows: any[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const entry = getDailyEntry(selectedMonth, d);
            rows.push({
                Date: `${d}-${monthShort}-${selectedYear}`,
                Odometer: entry?.odometer || '',
                "Voucher #": entry?.voucher_no || '',
                "Qty (Ltr)": entry?.qty || 0,
                "Amount (Rs)": entry?.amount || 0
            });
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Daily Log");
        
        const summaryRows = [
            ["", ""],
            ["Monthly Summary", ""],
            ["Held by", currentVehicleObj?.detail || 'N/A'],
            ["Opening Balance", summary.openingBalance],
            ["Purchased Qty", summary.totalPurchaseQty],
            ["Total Available", summary.totalFuel],
            ["Meter Start", summary.meterStart],
            ["Meter End", summary.meterEnd],
            ["Mileage", summary.mileage],
            ["Fuel in Tank (Closing)", summary.fuelInTank],
            ["Net Consumed", summary.consumed],
            ["Fuel Average (KM/L)", summary.average.toFixed(2)]
        ];
        XLSX.utils.sheet_add_aoa(ws, summaryRows, { origin: -1 });

        XLSX.writeFile(wb, `POL_SOI_${selectedVehicle}_${monthName}_${selectedYear}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedVehicle) return;
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text("Daily POL Ledger (SOI/Entitled)", pageWidth / 2, 40, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Vehicle: ${selectedVehicle} (${currentVehicleObj?.make_type})`, 40, 65);
        doc.text(`Held By: ${currentVehicleObj?.detail || 'N/A'}`, 40, 80);
        doc.text(`Month/Year: ${monthName} ${selectedYear}`, pageWidth - 40, 65, { align: 'right' });
        doc.text(`Report Date: ${formatDate(new Date())}`, pageWidth - 40, 80, { align: 'right' });

        const head = [['Date', 'Odometer', 'Voucher #', 'Qty (Ltr)', 'Amount (Rs)']];
        const body = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const entry = getDailyEntry(selectedMonth, d);
            body.push([
                `${d}-${monthShort}-${selectedYear}`,
                entry?.odometer || '-',
                entry?.voucher_no || '-',
                entry?.qty || '-',
                entry?.amount || '-'
            ]);
        }

        autoTable(doc, {
            head,
            body,
            startY: 100,
            styles: { fontSize: 8, cellPadding: 4, halign: 'center' },
            headStyles: { fillColor: [31, 41, 55], textColor: 255 },
            columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
            theme: 'grid'
        });

        const finalY = (doc as any).lastAutoTable.finalY + 20;
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text("Monthly Summary & Balances", 40, finalY);

        const summaryData = [
            ["Opening Balance", `${summary.openingBalance} Ltr`, "Meter Start", summary.meterStart],
            ["Total Purchased", `${summary.totalPurchaseQty.toFixed(2)} Ltr`, "Meter End", summary.meterEnd],
            ["Total Available", `${summary.totalFuel.toFixed(2)} Ltr`, "Total Mileage", `${summary.mileage} KM`],
            ["Closing Tank", `${summary.fuelInTank} Ltr`, "Net Consumed", `${summary.consumed.toFixed(2)} Ltr`],
            ["", "", "Fuel Average", `${summary.average.toFixed(2)} KM/L`]
        ];

        autoTable(doc, {
            body: summaryData,
            startY: finalY + 10,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', textColor: [100, 100, 100], cellWidth: 100 },
                1: { fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 80 },
                2: { fontStyle: 'bold', textColor: [100, 100, 100], cellWidth: 100 },
                3: { fontStyle: 'bold', textColor: [0, 0, 0], cellWidth: 80 }
            }
        });

        doc.save(`POL_SOI_Ledger_${selectedVehicle}_${monthName}.pdf`);
    };

    return (
        <div id="view-pol-soi-ent" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[80vh]">
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-lg border border-slate-200 shadow-inner gap-4">
                    <div className="flex items-center gap-2">
                        <i className="fas fa-gas-pump text-ncp-primary"></i>
                        <h5 className="text-lg font-bold text-slate-700 uppercase tracking-tight">Daily POL Ledger (SOI)</h5>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Select Vehicle</label>
                            <select className="border border-slate-300 rounded px-3 py-2 text-sm bg-white font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-ncp-primary outline-none min-w-[200px]" value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}>
                                {availableVehicles.map(v => (
                                    <option key={v.reg_no as string} value={v.reg_no as string}>
                                        {v.reg_no} - {v.make_type}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {showHeldVehicleInput && (
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Held Vehicle / Officer</label>
                                <input 
                                    type="text"
                                    className="border border-slate-300 rounded px-3 py-2 text-sm bg-white font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-ncp-primary outline-none w-48"
                                    value={currentVehicleObj?.detail || ''}
                                    onChange={(e) => handleOfficerNameChange(e.target.value)}
                                    placeholder="Officer Name"
                                    disabled={!selectedVehicle}
                                />
                            </div>
                        )}

                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Month</label>
                            <select className="border border-slate-300 rounded px-3 py-2 text-sm bg-white font-bold text-slate-700 focus:border-ncp-primary outline-none" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Year</label>
                            <input type="number" className="border border-slate-300 rounded px-3 py-2 w-24 text-sm bg-white font-bold text-slate-700 focus:border-ncp-primary outline-none" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button onClick={handleExportExcel} className="bg-emerald-600 text-white p-2 rounded hover:bg-emerald-700 transition shadow-sm text-xs font-bold"><i className="fas fa-file-excel"></i></button>
                            <button onClick={handleExportPDF} className="bg-rose-600 text-white p-2 rounded hover:bg-rose-700 transition shadow-sm text-xs font-bold"><i className="fas fa-file-pdf"></i></button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 border border-slate-300 rounded-lg shadow-sm bg-white overflow-hidden">
                        <div className="bg-slate-800 p-3 font-bold text-white text-center uppercase tracking-widest text-[10px]">
                            Daily Log - {monthName} {selectedYear}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead className="bg-slate-700 text-white font-bold uppercase tracking-widest text-[9px]">
                                    <tr>
                                        <th className="p-3 border border-slate-600 w-24">Date</th>
                                        <th className="p-3 border border-slate-600">Odometer</th>
                                        <th className="p-3 border border-slate-600">Voucher #</th>
                                        <th className="p-3 border border-slate-600 w-24 bg-slate-900">Qty (Ltr)</th>
                                        <th className="p-3 border border-slate-600 w-32 bg-slate-900">Amount (Rs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedVehicle ? Array.from({ length: daysInMonth }).map((_, i) => {
                                        const day = i + 1;
                                        const entry = getDailyEntry(selectedMonth, day);
                                        const dateDisplay = `${day}-${monthShort}-${selectedYear}`;
                                        return (
                                            <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-slate-200 text-[11px]">
                                                <td className="border-r border-slate-300 p-2 font-bold text-slate-500 bg-slate-50/30">{dateDisplay}</td>
                                                <td className="p-0 border-r border-slate-300">
                                                    <input className="w-full p-2 text-center bg-transparent focus:bg-white outline-none font-mono" value={entry?.odometer || ''} onChange={(e) => handleDailyChange(selectedMonth, day, 'odometer', e.target.value)} />
                                                </td>
                                                <td className="p-0 border-r border-slate-300">
                                                    <input className="w-full p-2 text-center bg-transparent focus:bg-white outline-none uppercase font-bold" value={entry?.voucher_no || ''} onChange={(e) => handleDailyChange(selectedMonth, day, 'voucher_no', e.target.value)} />
                                                </td>
                                                <td className="p-0 border-r border-slate-300 bg-blue-50/10">
                                                    <input type="number" className="w-full p-2 text-center bg-transparent focus:bg-white outline-none font-bold text-blue-700" value={entry?.qty || ''} onChange={(e) => handleDailyChange(selectedMonth, day, 'qty', e.target.value)} />
                                                </td>
                                                <td className="p-0 bg-green-50/10">
                                                    <input type="number" className="w-full p-2 text-center bg-transparent focus:bg-white outline-none font-bold text-green-700" value={entry?.amount || ''} onChange={(e) => handleDailyChange(selectedMonth, day, 'amount', e.target.value)} />
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={5} className="p-12 text-slate-400 italic text-center">Select a vehicle above</td></tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50 text-slate-700 font-bold border-t-2 border-slate-300">
                                    <tr>
                                        <td colSpan={3} className="p-3 text-right uppercase text-[10px] tracking-widest opacity-70">Monthly Totals</td>
                                        <td className="p-3 border-l border-slate-200 text-lg">{summary.totalPurchaseQty.toFixed(2)}</td>
                                        <td className="p-3 border-l border-slate-200 text-lg">{summary.totalPurchaseAmt.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="w-full lg:w-80 bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden h-fit shrink-0">
                        <div className="bg-slate-50 p-3 border-b border-slate-300 font-bold text-slate-700 text-center uppercase tracking-wide text-xs">Summary & Balances</div>
                        <div className="divide-y divide-slate-200 text-sm">
                            <div className="flex items-center p-3">
                                <span className="flex-1 text-slate-500 font-bold uppercase text-[10px]">Opening Bal</span>
                                <input className="w-24 text-right border border-slate-200 rounded px-2 py-1.5 focus:border-ncp-primary outline-none font-bold text-blue-600 bg-slate-50" value={summary.openingBalance} disabled={selectedMonth > 0} onChange={e => handleMonthlyChange(selectedMonth, 'opening_balance', e.target.value)} />
                            </div>
                            <div className="flex items-center p-3 bg-slate-50/50">
                                <span className="flex-1 text-slate-500 font-bold uppercase text-[10px]">Purchased Qty</span>
                                <span className="font-extrabold text-slate-700">{summary.totalPurchaseQty.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center p-3 bg-blue-50/30">
                                <span className="flex-1 text-blue-800 font-bold uppercase text-[10px]">Total Available</span>
                                <span className="font-black text-blue-900">{summary.totalFuel.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center p-3 pt-6 border-t-4 border-slate-100">
                                <span className="flex-1 text-slate-400 font-bold uppercase text-[9px]">Odometer 1st</span>
                                <input className="w-24 text-right border border-slate-200 rounded px-2 py-1.5 focus:border-ncp-primary outline-none font-mono font-bold" value={summary.meterStart} onChange={e => handleMonthlyChange(selectedMonth, 'meter_start', e.target.value)} />
                            </div>
                            <div className="flex items-center p-3">
                                <span className="flex-1 text-slate-400 font-bold uppercase text-[9px]">Odometer End</span>
                                <input className="w-24 text-right border border-slate-200 rounded px-2 py-1.5 focus:border-ncp-primary outline-none font-mono font-bold" value={summary.meterEnd} onChange={e => handleMonthlyChange(selectedMonth, 'meter_end', e.target.value)} />
                            </div>
                            <div className="flex items-center p-3 bg-slate-100 text-slate-800">
                                <span className="flex-1 font-bold uppercase text-[10px]">Total Mileage</span>
                                <span className="font-black text-lg">{summary.mileage} <small className="text-[10px]">KM</small></span>
                            </div>
                            <div className="flex items-center p-3 pt-6 border-t-4 border-slate-100">
                                <span className="flex-1 text-slate-500 font-bold uppercase text-[10px]">Closing Tank</span>
                                <input className="w-24 text-right border border-slate-200 rounded px-2 py-1.5 focus:border-ncp-primary outline-none font-bold text-amber-600 bg-slate-50" value={summary.fuelInTank} onChange={e => handleMonthlyChange(selectedMonth, 'fuel_in_tank', e.target.value)} />
                            </div>
                            <div className="flex items-center p-3 bg-amber-50/30">
                                <span className="flex-1 text-amber-800 font-bold uppercase text-[10px]">Net Consumed</span>
                                <span className="font-black text-amber-900">{summary.consumed.toFixed(2)} <small className="text-[10px]">LTR</small></span>
                            </div>
                            <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 text-center border-t-4 border-emerald-500">
                                <span className="block text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mb-2">Fuel Average</span>
                                <div className="flex items-center justify-center gap-1">
                                    <span className="text-4xl font-black text-emerald-700 tracking-tighter">{summary.average.toFixed(2)}</span>
                                    <span className="text-xs font-bold text-emerald-500 mt-3">KM/L</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolSoiEntView;
