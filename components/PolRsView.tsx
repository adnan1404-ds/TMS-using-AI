import React, { useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PolRsViewProps {
    db: Database;
    onAdd: () => void;
    onUpdate: (updatedDb: Database) => void;
    onDelete: (index: number) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

const PolRsView: React.FC<PolRsViewProps> = ({ db }) => {
    // Months keys
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    // Labels for Display
    const monthLabels = ['Jan-25', 'Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25', 'Jul-25', 'Aug-25', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25'];
    const YEAR = 2025;

    // Helper to calculate Expense (Purchase Amount)
    const getExpense = (reg: string, monthIndex: number) => {
        const monthStr = String(monthIndex + 1).padStart(2, '0');
        const monthYear = `${YEAR}-${monthStr}`;

        // Sum 'amount' from entries
        const amount = (db.pol_soi_entries || [])
            .filter(e => e.vehicle_reg === reg && (e.date as string)?.startsWith(monthYear))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        return Math.round(amount);
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
                officer: veh.detail || '',
                reg_no: veh.reg_no,
                model: veh.model,
                total: 0,
                originalIndex: i
            };

            months.forEach((m, idx) => {
                const val = getExpense(veh.reg_no as string, idx);
                row[m] = val;
                row.total += val;
            });

            return row;
        });
    }, [db.vehicles, db.pol_soi_entries]);

    // Column totals
    const colTotals: Record<string, number> = {};
    months.forEach(m => colTotals[m] = 0);
    let grandTotalSum = 0;

    derivedData.forEach(row => {
        months.forEach(m => {
            colTotals[m] += Number(row[m] || 0);
        });
        grandTotalSum += row.total;
    });

    const handleExportExcel = () => {
        const exportData = derivedData.map((row, i) => {
            const rowData: any = {
                "Sr No": i + 1,
                "Type of Veh": row.type_of_veh,
                "Held Vehs": row.officer,
                "Vehicle Registration/Code": row.reg_no,
                "Vehicle Year": row.model,
            };
            monthLabels.forEach((label, idx) => {
                rowData[label] = row[months[idx]] || 0;
            });
            rowData["Total"] = row.total;
            return rowData;
        });

        // Totals Row
        const totalRow: any = {
            "Sr No": "", 
            "Type of Veh": "", 
            "Held Vehs": "", 
            "Vehicle Registration/Code": "TOTAL", 
            "Vehicle Year": ""
        };
        monthLabels.forEach((label, index) => {
            const key = months[index];
            totalRow[label] = colTotals[key];
        });
        totalRow["Total"] = grandTotalSum;
        exportData.push(totalRow);

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Adjust widths
        const wscols = [
            { wch: 6 },
            { wch: 15 },
            { wch: 25 },
            { wch: 20 },
            { wch: 10 },
            ...monthLabels.map(() => ({ wch: 10 })),
            { wch: 12 }
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "POL_Expenditure_Rs");
        XLSX.writeFile(wb, "POL_Expenditure_Rs.xlsx");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text("POL Expenditure (Rs) - Entitle & SOI Vehicles", 14, 15);
        const head = [["Sr", "Type of Veh", "Held Vehs", "Reg #", "Year", ...monthLabels, "Total"]];
        const body = derivedData.map((row, i) => [
            i + 1,
            row.type_of_veh,
            row.officer,
            row.reg_no,
            row.model,
            ...months.map(m => row[m].toLocaleString()),
            row.total.toLocaleString()
        ]);
        // Add totals row
        body.push([
            "", "TOTAL", "", "", "",
            ...months.map(m => colTotals[m].toLocaleString()),
            grandTotalSum.toLocaleString()
        ]);
        autoTable(doc, { head, body, startY: 20, styles: { fontSize: 6 }, headStyles: { fillColor: [31, 41, 55] } });
        doc.save("POL_Expenditure_Rs.pdf");
    };

    return (
        <div id="view-pol-rs" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-4 no-print flex-shrink-0">
                     <h5 className="text-xl font-bold text-ncp-primary">POL Expenditure (Rs)</h5>
                     <div className="flex gap-2">
                        <button className="bg-rose-600 text-white py-2 px-4 rounded hover:bg-rose-700 transition shadow-sm text-xs font-bold" onClick={handleExportPDF}>
                            <i className="fas fa-file-pdf me-2"></i> Export PDF
                        </button>
                        <button className="bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 transition shadow-sm text-xs font-bold" onClick={handleExportExcel}>
                            <i className="fas fa-file-excel me-2"></i> Export Excel
                        </button>
                     </div>
                </div>
                
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full text-xs text-left border-collapse relative">
                        <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px]">
                            <tr className="bg-white border-b border-gray-200">
                                <th colSpan={18} className="p-4 text-center">
                                    <div className="text-xl font-bold text-ncp-primary uppercase tracking-wide">POL Expenditure (Rs)</div>
                                    <div className="text-sm font-bold text-slate-600 mt-1">Entitle & SOI Vehicles - NCP Fleet</div>
                                </th>
                            </tr>
                            <tr>
                                <th className="border border-slate-700 p-3 min-w-[50px] text-center">Sr No</th>
                                <th className="border border-slate-700 p-3 min-w-[150px]">Type of Veh</th>
                                <th className="border border-slate-700 p-3 min-w-[200px]">Held Vehs</th>
                                <th className="border border-slate-700 p-3 min-w-[120px] text-center">Vehicle Registration/Code</th>
                                <th className="border border-slate-700 p-3 min-w-[80px] text-center">Vehicle Year</th>
                                {monthLabels.map(m => (
                                    <th key={m} className="border border-slate-700 p-3 min-w-[80px] text-center">{m}</th>
                                ))}
                                <th className="border border-slate-700 p-3 min-w-[100px] text-center bg-slate-900 border-l">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {derivedData.length === 0 ? (
                                <tr><td colSpan={18} className="p-8 text-center text-gray-500">No SOI/Entitled vehicles found.</td></tr>
                            ) : (
                                derivedData.map((row, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors">
                                        <td className="border border-gray-300 p-2 text-center text-gray-500">{i + 1}</td>
                                        <td className="border border-gray-300 p-2 text-slate-700">{row.type_of_veh}</td>
                                        <td className="border border-gray-300 p-2 text-slate-700">{row.officer}</td>
                                        <td className="border border-gray-300 p-2 text-center font-bold text-slate-800">{row.reg_no}</td>
                                        <td className="border border-gray-300 p-2 text-center text-slate-600">{row.model}</td>
                                        {months.map(m => (
                                            <td key={m} className="border border-gray-300 p-2 text-center text-slate-700">
                                                {row[m] > 0 ? row[m].toLocaleString() : '-'}
                                            </td>
                                        ))}
                                        <td className="border border-gray-300 p-2 text-right font-bold bg-gray-50 border-l">{row.total.toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                            <tr>
                                <td colSpan={5} className="border border-gray-300 p-3 text-right uppercase tracking-wider text-slate-600">Total Expenditure (Rs)</td>
                                {months.map(m => (
                                    <td key={m} className="border border-gray-300 p-3 text-right">
                                        {colTotals[m] > 0 ? colTotals[m].toLocaleString() : '-'}
                                    </td>
                                ))}
                                <td className="border border-gray-300 p-3 text-right text-ncp-primary bg-slate-100 border-l">{grandTotalSum.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PolRsView;