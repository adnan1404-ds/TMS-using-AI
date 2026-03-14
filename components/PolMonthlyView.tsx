import React, { useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PolMonthlyViewProps {
    db: Database;
    onAdd: () => void;
    onUpdate: (updatedDb: Database, section?: string) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

const PolMonthlyView: React.FC<PolMonthlyViewProps> = ({ db, onAdd, onUpdate, onDirectAdd }) => {
    const months = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];
    const monthLabels = ['Jul-24', 'Aug-24', 'Sep-24', 'Oct-24', 'Nov-24', 'Dec-24', 'Jan-25', 'Feb-25', 'Mar-25', 'Apr-25', 'May-25', 'Jun-25'];
    
    const START_YEAR = 2024;

    const getConsumed = (reg: string, colIndex: number) => {
        const currentYear = colIndex < 6 ? START_YEAR : START_YEAR + 1;
        const monthNum = ((colIndex + 6) % 12) + 1;
        const monthStr = String(monthNum).padStart(2, '0');
        const monthYear = `${currentYear}-${monthStr}`;

        const purchases = (db.pol_soi_entries || [])
            .filter(e => e.vehicle_reg === reg && (e.date as string)?.startsWith(monthYear))
            .reduce((sum, e) => sum + (Number(e.qty) || 0), 0);

        const monthlyRec = (db.pol_soi_monthly || []).find(m => m.vehicle_reg === reg && m.month_year === monthYear);
        
        let opening = 0;
        if (monthlyRec && monthlyRec.opening_balance) {
            opening = Number(monthlyRec.opening_balance);
        } else {
            let prevY = currentYear;
            let prevM = monthNum - 1;
            if (prevM === 0) { prevM = 12; prevY -= 1; }
            const prevMonthStr = String(prevM).padStart(2, '0');
            const prevMonthYear = `${prevY}-${prevMonthStr}`;
            const prevRec = (db.pol_soi_monthly || []).find(m => m.vehicle_reg === reg && m.month_year === prevMonthYear);
            if (prevRec) {
                opening = Number(prevRec.fuel_in_tank || 0);
            }
        }
        const closing = Number(monthlyRec?.fuel_in_tank || 0);
        const totalAvail = opening + purchases;
        const consumed = totalAvail - closing;
        return Math.round((consumed + Number.EPSILON) * 100) / 100;
    };

    const processedData = useMemo(() => {
        const targetVehicles = (db.vehicles || []).filter(v => ['General', 'Shift'].includes(v.duty_type as string));
        return targetVehicles.map((v, i) => {
            const limitRec = (db.pol_monthly || []).find(r => r.reg_no === v.reg_no);
            const limit = Number(limitRec?.limit || 0);
            return {
                sr: i + 1,
                reg_no: v.reg_no as string,
                type_of_veh: v.make_type,
                fuel_type: v.fuel_type,
                category: v.duty_type, 
                limit: limit,
                derivedMonths: months.map((_, idx) => getConsumed(v.reg_no as string, idx))
            };
        });
    }, [db.vehicles, db.pol_monthly, db.pol_soi_entries, db.pol_soi_monthly]);

    const getRecords = (category: string, fuelType?: string) => {
        return processedData.filter(r => {
            const catMatch = r.category === category;
            const fuelMatch = fuelType ? r.fuel_type === fuelType : true;
            return catMatch && fuelMatch;
        });
    };

    const generalPetrol = getRecords('General', 'Petrol');
    const generalDiesel = getRecords('General', 'Diesel');
    const shiftPetrol = getRecords('Shift', 'Petrol');
    const shiftDiesel = getRecords('Shift', 'Diesel');

    const calculateSectionTotal = (records: any[]) => {
        const monthlyTotals: Record<string, number> = {};
        months.forEach((_, idx) => monthlyTotals[idx] = 0);
        let grandTotal = 0;
        let grandLimit = 0;
        let grandBalance = 0;
        records.forEach(r => {
            let rowTotal = 0;
            r.derivedMonths.forEach((val: number, idx: number) => {
                monthlyTotals[idx] += val;
                rowTotal += val;
            });
            grandTotal += rowTotal;
            grandLimit += r.limit;
            grandBalance += ((r.limit * 12) - rowTotal);
        });
        return { monthlyTotals, grandTotal, grandLimit, grandBalance };
    };

    const genPetrolTotals = calculateSectionTotal(generalPetrol);
    const genDieselTotals = calculateSectionTotal(generalDiesel);
    const shiftPetrolTotals = calculateSectionTotal(shiftPetrol);
    const shiftDieselTotals = calculateSectionTotal(shiftDiesel);

    const grandTotalAll = genPetrolTotals.grandTotal + genDieselTotals.grandTotal + shiftPetrolTotals.grandTotal + shiftDieselTotals.grandTotal;

    const handleLimitEdit = (regNo: string, value: string, vehicleInfo: any) => {
        const newLimit = parseFloat(value) || 0;
        const newPolMonthly = [...(db.pol_monthly || [])];
        const index = newPolMonthly.findIndex(r => r.reg_no === regNo);
        if (index >= 0) {
            newPolMonthly[index] = { ...newPolMonthly[index], limit: newLimit };
        } else {
            newPolMonthly.push({ sr: newPolMonthly.length + 1, reg_no: regNo, limit: newLimit, type_of_veh: vehicleInfo.type_of_veh, fuel_type: vehicleInfo.fuel_type, category: vehicleInfo.category, held_vehs: regNo });
        }
        onUpdate({ ...db, pol_monthly: newPolMonthly }, 'pol_monthly');
    };

    const getPsoCharges = () => {
        const charges: number[] = [];
        let total = 0;
        const monthMap = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
        monthMap.forEach(mName => {
            const yStr = (['July', 'August', 'September', 'October', 'November', 'December'].includes(mName)) ? START_YEAR.toString() : (START_YEAR + 1).toString();
            const report = db.pol_report.find(r => r.month === mName && r.year === yStr);
            const val = report ? ( (Number(report.ent_petrol_pso) || 0) + (Number(report.shift_diesel_pso) || 0) + (Number(report.gen_petrol_pso) || 0) + (Number(report.gen_diesel_pso) || 0) ) : 0;
            charges.push(val);
            total += val;
        });
        return { monthly: charges, total };
    };
    const psoData = getPsoCharges();

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text("POL Limit & Authorization (Qty) - General & Shift", 14, 15);
        const head = [["Sr", "Reg #", "Fuel", ...monthLabels, "Total", "Limit", "Bal"]];
        const body = processedData.map(r => [
            r.sr, r.reg_no, r.fuel_type,
            ...r.derivedMonths,
            r.derivedMonths.reduce((a, b) => a + b, 0).toFixed(1),
            r.limit,
            ((r.limit * 12) - r.derivedMonths.reduce((a, b) => a + b, 0)).toFixed(1)
        ]);
        autoTable(doc, { head, body, startY: 20, styles: { fontSize: 6 }, headStyles: { fillColor: [31, 41, 55] } });
        doc.save("POL_Monthly_Qty.pdf");
    };

    const renderSection = (title: string, records: any[], totals: any, fuelLabel: string, showTotalRow = true) => (
        <>
            {title && (
                <tr className="bg-white">
                    <td colSpan={19} className="border-b border-gray-300 p-3 text-left font-bold text-ncp-primary uppercase tracking-wider">{title}</td>
                </tr>
            )}
            {records.map((row, i) => {
                const total = row.derivedMonths.reduce((a: number, b: number) => a + b, 0);
                const limit = row.limit;
                const balance = (limit * 12) - total;
                return (
                    <tr key={row.reg_no} className="hover:bg-yellow-50 transition-colors group">
                        <td className="border border-gray-300 p-2 text-center text-gray-500">{i + 1}</td>
                        <td className="border border-gray-300 p-2 text-slate-700">{row.type_of_veh}</td>
                        <td className="border border-gray-300 p-2 text-center font-bold text-slate-800">{row.reg_no}</td>
                        <td className={`border border-gray-300 p-2 text-xs uppercase font-bold text-center ${row.fuel_type === 'Petrol' ? 'text-green-600' : 'text-amber-600'}`}>{fuelLabel}</td>
                        {row.derivedMonths.map((val: number, idx: number) => (
                            <td key={idx} className="border border-gray-300 p-2 text-center text-slate-600 text-xs">
                                {val > 0 ? val : '-'}
                            </td>
                        ))}
                        <td className="border border-gray-300 p-2 font-bold bg-slate-50/30 text-slate-800 text-center">{total.toFixed(1)}</td>
                        <td className="border border-gray-300 p-0 bg-yellow-50/10">
                             <input className="w-full p-2 text-center bg-transparent focus:bg-white outline-none font-bold" value={limit} onChange={e => handleLimitEdit(row.reg_no, e.target.value, row)} />
                        </td>
                        <td className={`border border-gray-300 p-2 font-bold text-center ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{balance.toFixed(1)}</td>
                    </tr>
                );
            })}
            {showTotalRow && (
                <tr className="bg-slate-100/50 font-bold text-slate-700 border-t border-gray-300">
                    <td colSpan={4} className="border border-gray-300 p-2 text-right uppercase text-xs tracking-wider">Total ({fuelLabel})</td>
                    {months.map((_, idx) => (
                        <td key={idx} className="border border-gray-300 p-2 text-center text-xs">{totals.monthlyTotals[idx]?.toFixed(1) || '-'}</td>
                    ))}
                    <td className="border border-gray-300 p-2 text-center">{totals.grandTotal.toFixed(1)}</td>
                    <td className="border border-gray-300 p-2 text-center">{totals.grandLimit}</td>
                    <td className="border border-gray-300 p-2 text-center">{totals.grandBalance.toFixed(1)}</td>
                </tr>
            )}
        </>
    );

    return (
        <div id="view-pol-monthly" className="content-section">
             <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-4 no-print shrink-0">
                    <h5 className="text-xl font-bold text-ncp-primary">POL Limit & Authorization (Qty)</h5>
                    <div className="flex gap-2 items-center">
                        <button className="bg-rose-600 text-white py-2 px-4 rounded hover:bg-rose-700 transition shadow-sm text-xs font-bold" onClick={handleExportPDF}>
                            <i className="fas fa-file-pdf me-2"></i> PDF
                        </button>
                        <button className="bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 transition shadow-sm text-xs font-bold" onClick={() => {
                            const ws = XLSX.utils.table_to_sheet(document.getElementById('pol-monthly-table'));
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, "POL_Monthly");
                            XLSX.writeFile(wb, "POL_Monthly_Qty.xlsx");
                        }}>
                            <i className="fas fa-file-excel me-2"></i> Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/30">
                    <table id="pol-monthly-table" className="w-full text-xs text-center border-collapse border-collapse relative min-w-[1200px]">
                        <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px]">
                            <tr className="bg-white border-b border-gray-200">
                                <th colSpan={19} className="p-4 text-center">
                                    <div className="text-xl font-bold text-ncp-primary uppercase tracking-wide text-slate-800">POL Limit & Authorization</div>
                                    <div className="text-sm font-bold text-slate-600 mt-1">General & Shift Vehs - Consumption (FY {START_YEAR}-{START_YEAR+1})</div>
                                </th>
                            </tr>
                            <tr>
                                <th className="border border-slate-700 p-3 w-12 bg-slate-800">Sr</th>
                                <th className="border border-slate-700 p-3 min-w-[120px] bg-slate-800">Type</th>
                                <th className="border border-slate-700 p-3 min-w-[100px] bg-slate-800">Registration</th>
                                <th className="border border-slate-700 p-3 bg-slate-800">Fuel</th>
                                {monthLabels.map(m => (
                                    <th key={m} className="border border-slate-700 p-3 bg-slate-800">{m}</th>
                                ))}
                                <th className="border border-slate-700 p-3 bg-slate-900">Total</th>
                                <th className="border border-slate-700 p-3 bg-slate-900">Limit</th>
                                <th className="border border-slate-700 p-3 bg-slate-900">Bal</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {renderSection('General Vehicles', generalPetrol, genPetrolTotals, 'Petrol', false)}
                            {renderSection('', generalDiesel, genDieselTotals, 'Diesel', false)}
                            <tr className="bg-slate-100/30 font-bold text-slate-800 border-t border-gray-300">
                                <td colSpan={4} className="border border-gray-300 p-2 text-right text-xs uppercase tracking-wide">Subtotal (General)</td>
                                {months.map((_, idx) => {
                                    const val = (genPetrolTotals.monthlyTotals[idx] || 0) + (genDieselTotals.monthlyTotals[idx] || 0);
                                    return <td key={idx} className="border border-gray-300 p-2">{val > 0 ? val.toFixed(1) : '-'}</td>
                                })}
                                <td className="border border-gray-300 p-2">{(genPetrolTotals.grandTotal + genDieselTotals.grandTotal).toFixed(1)}</td>
                                <td className="border border-gray-300 p-2">{genPetrolTotals.grandLimit + genDieselTotals.grandLimit}</td>
                                <td className="border border-gray-300 p-2">{(genPetrolTotals.grandBalance + genDieselTotals.grandBalance).toFixed(1)}</td>
                            </tr>
                            {renderSection('Shift Vehicles', shiftPetrol, shiftPetrolTotals, 'Petrol', false)}
                            {renderSection('', shiftDiesel, shiftDieselTotals, 'Diesel', false)}
                            <tr className="bg-slate-100/30 font-bold text-slate-800 border-t border-gray-300">
                                <td colSpan={4} className="border border-gray-300 p-2 text-right text-xs uppercase tracking-wide">Subtotal (Shift)</td>
                                {months.map((_, idx) => {
                                    const val = (shiftPetrolTotals.monthlyTotals[idx] || 0) + (shiftDieselTotals.monthlyTotals[idx] || 0);
                                    return <td key={idx} className="border border-gray-300 p-2">{val > 0 ? val.toFixed(1) : '-'}</td>
                                })}
                                <td className="border border-gray-300 p-2">{(shiftPetrolTotals.grandTotal + shiftDieselTotals.grandTotal).toFixed(1)}</td>
                                <td className="border border-gray-300 p-2">{shiftPetrolTotals.grandLimit + shiftDieselTotals.grandLimit}</td>
                                <td className="border border-gray-300 p-2">{(shiftPetrolTotals.grandBalance + shiftDieselTotals.grandBalance).toFixed(1)}</td>
                            </tr>
                            <tr className="bg-slate-50 text-slate-800 font-bold">
                                <td colSpan={16} className="border border-gray-300 p-3 text-right uppercase tracking-wider">Grand Total Consumption</td>
                                <td className="border border-gray-300 p-3 text-lg">{grandTotalAll.toFixed(1)}</td>
                                <td colSpan={2} className="border border-gray-300 p-3"></td>
                            </tr>
                             <tr className="bg-yellow-50/20 text-slate-700 font-bold border-t-2 border-slate-300">
                                <td colSpan={4} className="border border-gray-300 p-3 text-center uppercase tracking-wide">PSO Charges (Rs)</td>
                                {months.map((_, idx) => <td key={idx} className="border border-gray-300 p-3 text-right">{psoData.monthly[idx] > 0 ? psoData.monthly[idx].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-3 text-right bg-yellow-50/50">{psoData.total.toLocaleString()}</td>
                                <td colSpan={2} className="border border-gray-300"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PolMonthlyView;