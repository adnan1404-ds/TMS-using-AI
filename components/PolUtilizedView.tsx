import React, { useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PolUtilizedViewProps {
    db: Database;
    onAdd: () => void;
    onUpdate: (updatedDb: Database) => void;
    onDelete: (index: number) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

const PolUtilizedView: React.FC<PolUtilizedViewProps> = ({ db }) => {
    // Months keys
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    // Display labels (Hardcoded to 2025 as per existing dashboard layout)
    const monthLabels = ['Jan-25', 'Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25', 'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25'];
    const YEAR = 2025;

    // Helper to calculate consumption
    const getConsumed = (reg: string, monthIndex: number) => {
        const monthStr = String(monthIndex + 1).padStart(2, '0');
        const monthYear = `${YEAR}-${monthStr}`;

        // 1. Purchases (Qty)
        const purchases = (db.pol_soi_entries || [])
            .filter(e => e.vehicle_reg === reg && (e.date as string)?.startsWith(monthYear))
            .reduce((sum, e) => sum + (Number(e.qty) || 0), 0);

        // 2. Monthly Log for Tank State
        const monthlyRec = (db.pol_soi_monthly || []).find(m => m.vehicle_reg === reg && m.month_year === monthYear);
        
        let opening = 0;
        if (monthlyRec && monthlyRec.opening_balance) {
            opening = Number(monthlyRec.opening_balance);
        } else {
            // Check previous month closing
            let prevYear = YEAR;
            let prevMonth = monthIndex - 1;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevYear = YEAR - 1;
            }
            const prevMonthStr = String(prevMonth + 1).padStart(2, '0');
            const prevMonthYear = `${prevYear}-${prevMonthStr}`;
            const prevRec = (db.pol_soi_monthly || []).find(m => m.vehicle_reg === reg && m.month_year === prevMonthYear);
            if (prevRec) {
                opening = Number(prevRec.fuel_in_tank || 0);
            }
        }

        const closing = Number(monthlyRec?.fuel_in_tank || 0);
        const totalAvail = opening + purchases;
        // Consumed = (Opening + Purchase) - Closing
        const consumed = totalAvail - closing;
        
        // Round to 2 decimal
        return Math.round((consumed + Number.EPSILON) * 100) / 100;
    };

    // Derived Data
    const derivedData = useMemo(() => {
        // Filter for SOI and Entitled vehicles only
        const targetVehicles = (db.vehicles || []).filter(v => 
            ['SOI', 'Entitled'].includes(v.duty_type as string)
        );

        return targetVehicles.map((veh, i) => {
            const row: any = {
                type_of_veh: veh.make_type,
                officer: veh.detail || '', // Assuming 'detail' holds officer/assignment info
                reg_no: veh.reg_no,
                model: veh.model,
                fuel_type: veh.fuel_type,
                limit: 0,
                total: 0,
                balance: 0,
                originalIndex: i
            };

            // Get Limit from pol_monthly (Limits table)
            const limitRec = (db.pol_monthly || []).find(r => r.reg_no === veh.reg_no);
            row.limit = Number(limitRec?.limit || 0);

            // Calculate Monthly Consumption
            months.forEach((m, idx) => {
                const val = getConsumed(veh.reg_no as string, idx);
                row[m] = val;
                row.total += val;
            });

            // Calculate Balance
            // Annual Limit = limit * 12
            // Balance = Annual Limit - Total Consumed
            row.balance = (row.limit * 12) - row.total;

            return row;
        });
    }, [db.vehicles, db.pol_soi_entries, db.pol_soi_monthly, db.pol_monthly]);

    // Column totals
    const colTotals: Record<string, number> = {};
    months.forEach(m => colTotals[m] = 0);
    let grandTotalSum = 0;
    let grandLimitSum = 0;
    let grandBalanceSum = 0;

    derivedData.forEach(row => {
        months.forEach(m => {
            colTotals[m] += Number(row[m] || 0);
        });
        grandTotalSum += row.total;
        grandLimitSum += Number(row.limit || 0);
        grandBalanceSum += row.balance;
    });

    const handleExportExcel = () => {
        const exportData = derivedData.map((row, i) => {
            const rowData: any = {
                "Sr No": i + 1,
                "Type of Veh": row.type_of_veh,
                "Held Vehicle": row.officer,
                "Veh Reg #": row.reg_no,
                "Model": row.model,
                "Petrol": row.fuel_type
            };
            monthLabels.forEach((label, idx) => {
                rowData[label] = row[months[idx]] || 0;
            });
            rowData["Total Qty"] = row.total;
            rowData["Limit"] = row.limit;
            rowData["Balance"] = row.balance;
            return rowData;
        });

        // Totals Row
        const totalRow: any = {
            "Sr No": "",
            "Type of Veh": "",
            "Held Vehicle": "",
            "Veh Reg #": "TOTAL",
            "Model": "",
            "Petrol": ""
        };
        monthLabels.forEach((label, idx) => {
            totalRow[label] = colTotals[months[idx]];
        });
        totalRow["Total Qty"] = grandTotalSum;
        totalRow["Limit"] = grandLimitSum;
        totalRow["Balance"] = grandBalanceSum;
        
        exportData.push(totalRow);

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "POL_Utilized");
        XLSX.writeFile(wb, "POL_Utilized.xlsx");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text("POL Utilized (Qty) - SOI & Entitled Vehicles", 14, 15);
        const head = [["Sr", "Type", "Officer", "Reg #", "Fuel", ...monthLabels, "Total", "Limit", "Bal"]];
        const body = derivedData.map((row, i) => [
            i + 1, row.type_of_veh, row.officer, row.reg_no, row.fuel_type,
            ...months.map(m => row[m]),
            row.total.toFixed(1), row.limit, row.balance.toFixed(1)
        ]);
        body.push([
            "", "TOTAL", "", "", "",
            ...months.map(m => colTotals[m].toFixed(1)),
            grandTotalSum.toFixed(1), grandLimitSum, grandBalanceSum.toFixed(1)
        ]);
        autoTable(doc, { head, body, startY: 20, styles: { fontSize: 6 }, headStyles: { fillColor: [31, 41, 55] } });
        doc.save("POL_Utilized_Report.pdf");
    };

    return (
        <div id="view-pol-utilized" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-4 no-print flex-shrink-0">
                    <h5 className="text-xl font-bold text-ncp-primary">POL Utilized (Consumed)</h5>
                    <div className="flex gap-2">
                        <button className="bg-rose-600 text-white py-2 px-4 rounded hover:bg-rose-700 transition shadow-sm text-xs font-bold" onClick={handleExportPDF}>
                            <i className="fas fa-file-pdf me-2"></i> Export PDF
                        </button>
                        <button className="bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 transition shadow-sm text-xs font-bold" onClick={handleExportExcel}>
                            <i className="fas fa-file-excel me-2"></i> Export Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs text-left border-collapse relative">
                        <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px]">
                            <tr className="bg-white border-b border-gray-200">
                                <th colSpan={21} className="p-4 text-center">
                                    <div className="text-xl font-bold text-ncp-primary uppercase tracking-wide">POL Utilized (Qty)</div>
                                    <div className="text-sm font-bold text-slate-600 mt-1">Entitle & SOI Vehicles - Consumption Report</div>
                                </th>
                            </tr>
                            <tr>
                                <th className="border border-slate-700 p-3 min-w-[50px] text-center">Sr No</th>
                                <th className="border border-slate-700 p-3 min-w-[120px]">Type of Veh</th>
                                <th className="border border-slate-700 p-3 min-w-[150px]">Held Vehicle</th>
                                <th className="border border-slate-700 p-3 min-w-[100px]">Veh Reg #</th>
                                <th className="border border-slate-700 p-3 min-w-[80px] text-center">Model</th>
                                <th className="border border-slate-700 p-3 min-w-[80px] text-center">Fuel</th>
                                {monthLabels.map(m => (
                                    <th key={m} className="border border-slate-700 p-3 min-w-[60px] text-center">{m}</th>
                                ))}
                                <th className="border border-slate-700 p-3 min-w-[80px] text-center bg-slate-900">Total Qty</th>
                                <th className="border border-slate-700 p-3 min-w-[80px] text-center bg-slate-900">Limit</th>
                                <th className="border border-slate-700 p-3 min-w-[80px] text-center bg-slate-900">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {derivedData.length === 0 ? (
                                <tr><td colSpan={21} className="p-8 text-center text-gray-500 italic">No SOI/Entitled vehicles found.</td></tr>
                            ) : (
                                derivedData.map((row, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors">
                                        <td className="border border-gray-300 p-2 text-center text-gray-500">{i + 1}</td>
                                        <td className="border border-gray-300 p-2 text-slate-700">{row.type_of_veh}</td>
                                        <td className="border border-gray-300 p-2 text-slate-700">{row.officer}</td>
                                        <td className="border border-gray-300 p-2 text-center font-bold">{row.reg_no}</td>
                                        <td className="border border-gray-300 p-2 text-center">{row.model}</td>
                                        <td className={`border border-gray-300 p-2 text-center font-bold text-xs ${row.fuel_type === 'Diesel' ? 'text-amber-600' : 'text-green-600'}`}>{row.fuel_type}</td>
                                        
                                        {months.map(m => (
                                            <td key={m} className="border border-gray-300 p-2 text-center">
                                                {row[m]}
                                            </td>
                                        ))}
                                        
                                        <td className="border border-gray-300 p-2 text-center font-bold bg-gray-50">{row.total.toFixed(2)}</td>
                                        <td className="border border-gray-300 p-2 text-center font-bold bg-gray-50">{row.limit}</td>
                                        <td className={`border border-gray-300 p-2 text-center font-bold ${row.balance < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{row.balance.toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                            <tr>
                                <td colSpan={6} className="border border-gray-300 p-3 text-right uppercase tracking-wider text-slate-600">Total</td>
                                {months.map(m => (
                                    <td key={m} className="border border-gray-300 p-3 text-center text-slate-700">{colTotals[m]?.toFixed(1)}</td>
                                ))}
                                <td className="border border-gray-300 p-3 text-center text-blue-700">{grandTotalSum.toFixed(2)}</td>
                                <td className="border border-gray-300 p-3 text-center text-slate-700">{grandLimitSum}</td>
                                <td className="border border-gray-300 p-3 text-center text-green-700">{grandBalanceSum.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PolUtilizedView;