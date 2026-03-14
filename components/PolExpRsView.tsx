import React, { useState } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PolExpRsViewProps {
    db: Database;
    onAdd: () => void;
    onUpdate: (updatedDb: Database, section?: string) => void;
    onDelete: (index: number) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

const PolExpRsView: React.FC<PolExpRsViewProps> = ({ db }) => {
    const [startYear, setStartYear] = useState(2024); // FY 2024-25 by default
    
    const months = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];
    
    const monthLabels = months.map((m, i) => {
        const y = i < 6 ? startYear : startYear + 1;
        const mStr = m.charAt(0).toUpperCase() + m.slice(1);
        return `${mStr}-${y.toString().slice(2)}`;
    });

    const getExpense = (reg: string, monthIndex: number) => {
        const year = monthIndex < 6 ? startYear : startYear + 1;
        const dateMonth = (monthIndex + 6) % 12; 
        const mNum = dateMonth + 1;
        const monthStr = String(mNum).padStart(2, '0');
        const monthYear = `${year}-${monthStr}`;

        const amount = (db.pol_soi_entries || [])
            .filter(e => e.vehicle_reg === reg && (e.date as string)?.startsWith(monthYear))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        return Math.round(amount);
    };

    const getVehiclesByTypes = (types: string[]) => {
        return (db.vehicles || [])
            .filter(v => types.includes(v.duty_type as string))
            .map((v, i) => {
                const row: any = { 
                    sr: i + 1,
                    type_of_veh: v.make_type,
                    held_vehs: v.reg_no,
                    fuel_type: v.fuel_type,
                    officer: v.detail,
                    total: 0
                };

                months.forEach((m, idx) => {
                    const val = getExpense(v.reg_no as string, idx);
                    row[m] = val;
                    row.total += val;
                });

                return row;
            });
    };

    const generalVehicles = getVehiclesByTypes(['General']);
    const shiftVehicles = getVehiclesByTypes(['Shift']);

    const calcTotals = (rows: any[], fuelFilter?: string) => {
        const res: any = { total: 0 };
        months.forEach(m => res[m] = 0);
        
        rows.filter(r => !fuelFilter || r.fuel_type === fuelFilter).forEach(r => {
            months.forEach(m => res[m] += r[m]);
            res.total += r.total;
        });
        return res;
    };

    const shiftDieselTotal = calcTotals(shiftVehicles, 'Diesel'); 
    const shiftPetrolTotal = calcTotals(shiftVehicles, 'Petrol'); 
    const genPetrolTotal = calcTotals(generalVehicles, 'Petrol');
    const genDieselTotal = calcTotals(generalVehicles, 'Diesel');

    const getPsoCharges = () => {
        const charges: any = { total: 0 };
        const monthMap = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
        
        months.forEach((m, idx) => {
            const mName = monthMap[idx];
            const yStr = (idx < 6 ? startYear : startYear + 1).toString();
            const report = db.pol_report.find(r => r.month === mName && r.year === yStr);
            const val = report ? (
                (Number(report.ent_petrol_pso) || 0) +
                (Number(report.shift_diesel_pso) || 0) +
                (Number(report.gen_petrol_pso) || 0) +
                (Number(report.gen_diesel_pso) || 0)
            ) : 0;
            charges[m] = val;
            charges.total += val;
        });
        return charges;
    };
    const psoCharges = getPsoCharges();

    const grandTotal: any = { total: 0 };
    months.forEach(m => {
        grandTotal[m] = shiftDieselTotal[m] + shiftPetrolTotal[m] + genPetrolTotal[m] + genDieselTotal[m] + psoCharges[m];
    });
    grandTotal.total = shiftDieselTotal.total + shiftPetrolTotal.total + genPetrolTotal.total + genDieselTotal.total + psoCharges.total;

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(document.getElementById('pol-exp-rs-table'));
        XLSX.utils.book_append_sheet(wb, ws, "POL_Exp_Rs");
        XLSX.writeFile(wb, `POL_Expenditure_Rs_FY${startYear}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text(`POL Expenditure (Rs) FY ${startYear}-${startYear+1}`, 14, 15);
        
        const head = [["Sr", "Type", "Reg #", "Fuel", ...monthLabels, "Total"]];
        const body: any[] = [];
        
        generalVehicles.forEach((v, i) => body.push([v.sr, v.type_of_veh, v.held_vehs, v.fuel_type, ...months.map(m => v[m].toLocaleString()), v.total.toLocaleString()]));
        shiftVehicles.forEach((v, i) => body.push([v.sr, v.type_of_veh, v.held_vehs, v.fuel_type, ...months.map(m => v[m].toLocaleString()), v.total.toLocaleString()]));
        body.push(["", "PSO CHARGES", "", "", ...months.map(m => psoCharges[m].toLocaleString()), psoCharges.total.toLocaleString()]);
        body.push(["", "GRAND TOTAL", "", "", ...months.map(m => grandTotal[m].toLocaleString()), grandTotal.total.toLocaleString()]);

        autoTable(doc, { head, body, startY: 20, styles: { fontSize: 6 }, headStyles: { fillColor: [31, 41, 55] } });
        doc.save(`POL_Expenditure_Rs_FY${startYear}.pdf`);
    };

    const renderSection = (title: string, data: any[]) => (
        <>
            <tr className="bg-white border-b-2 border-slate-200">
                <td colSpan={17} className="p-2 text-center font-bold underline uppercase bg-slate-50/50">{title}</td>
            </tr>
            {data.map((row, i) => (
                <tr key={i} className="hover:bg-yellow-50 transition-colors">
                    <td className="border border-gray-300 p-1 text-center text-gray-400">{i + 1}</td>
                    <td className="border border-gray-300 p-1 text-left">{row.type_of_veh}</td>
                    <td className="border border-gray-300 p-1 text-center font-bold text-slate-700">{row.held_vehs}</td>
                    <td className="border border-gray-300 p-1 text-center text-[10px] uppercase font-bold">{row.fuel_type}</td>
                    {months.map(m => (
                        <td key={m} className="border border-gray-300 p-1 text-right">
                            {row[m] > 0 ? row[m].toLocaleString() : '-'}
                        </td>
                    ))}
                    <td className="border border-gray-300 p-1 text-right font-bold bg-slate-50/30">{row.total.toLocaleString()}</td>
                </tr>
            ))}
            {data.length === 0 && (
                <tr><td colSpan={17} className="p-4 text-center text-gray-400 italic">No vehicles found.</td></tr>
            )}
        </>
    );

    return (
        <div id="view-pol-exp-rs" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-4 no-print flex-shrink-0">
                    <h5 className="text-xl font-bold text-ncp-primary">POL Expenditure (Rs)</h5>
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-200">
                             <label className="text-xs font-bold text-slate-600 pl-2">FY Start:</label>
                             <input 
                                type="number" 
                                className="w-16 bg-white border border-slate-300 text-sm rounded px-1 outline-none text-center font-bold"
                                value={startYear}
                                onChange={(e) => setStartYear(parseInt(e.target.value))}
                             />
                        </div>
                        <button className="bg-rose-600 text-white py-2 px-4 rounded hover:bg-rose-700 transition shadow-sm text-xs font-bold" onClick={handleExportPDF}>
                            <i className="fas fa-file-pdf me-2"></i> Export PDF
                        </button>
                        <button className="bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 transition shadow-sm text-xs font-bold" onClick={handleExportExcel}>
                            <i className="fas fa-file-excel me-2"></i> Export Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table id="pol-exp-rs-table" className="w-full text-xs text-left border-collapse relative min-w-[1200px]">
                        <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px]">
                            <tr className="bg-white border-b border-gray-200">
                                <th colSpan={17} className="p-4 text-center">
                                    <div className="text-xl font-bold text-ncp-primary uppercase tracking-wide">POL Expenditure (Rs)</div>
                                    <div className="text-sm font-bold text-slate-600 mt-1">General & Shift Vehs - NCP Fleet (FY {startYear}-{startYear+1})</div>
                                </th>
                            </tr>
                            <tr>
                                <th className="border border-slate-700 p-3 w-10 text-center">Sr</th>
                                <th className="border border-slate-700 p-3 min-w-[120px]">Type of Veh</th>
                                <th className="border border-slate-700 p-3 min-w-[100px] text-center">Held Vehs</th>
                                <th className="border border-slate-700 p-3 w-16 text-center">Fuel</th>
                                {monthLabels.map(m => (
                                    <th key={m} className="border border-slate-700 p-3 w-16 text-center">{m}</th>
                                ))}
                                <th className="border border-slate-700 p-3 w-20 text-center bg-slate-900">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {renderSection('General Vehicles', generalVehicles)}
                            
                            {renderSection('Shift Vehicles', shiftVehicles)}

                            <tr className="bg-slate-50/20"><td colSpan={17} className="p-2"></td></tr>

                            <tr className="bg-white font-bold text-slate-600">
                                <td colSpan={3} className="border border-gray-300 p-2 text-right" rowSpan={2}>Shift Vehs</td>
                                <td className="border border-gray-300 p-2 text-center">Diesel</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-2 text-right">{shiftDieselTotal[m] > 0 ? shiftDieselTotal[m].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-2 text-right">{shiftDieselTotal.total.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-white font-bold text-slate-600">
                                <td className="border border-gray-300 p-2 text-center">Petrol</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-2 text-right">{shiftPetrolTotal[m] > 0 ? shiftPetrolTotal[m].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-2 text-right">{shiftPetrolTotal.total.toLocaleString()}</td>
                            </tr>

                            <tr className="bg-white font-bold text-slate-600">
                                <td colSpan={3} className="border border-gray-300 p-2 text-right" rowSpan={2}>Gen Vehs</td>
                                <td className="border border-gray-300 p-2 text-center">Petrol</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-2 text-right">{genPetrolTotal[m] > 0 ? genPetrolTotal[m].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-2 text-right">{genPetrolTotal.total.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-white font-bold text-slate-600">
                                <td colSpan={3} className="border border-gray-300 p-2 text-right" rowSpan={2}>Gen Vehs</td>
                                <td className="border border-gray-300 p-2 text-center">Diesel</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-2 text-right">{genDieselTotal[m] > 0 ? genDieselTotal[m].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-2 text-right">{genDieselTotal.total.toLocaleString()}</td>
                            </tr>
                            
                            <tr className="bg-slate-100 font-bold text-slate-800">
                                <td colSpan={4} className="border border-gray-300 p-2 text-center uppercase tracking-wide">Total</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-2 text-right">
                                    {(shiftDieselTotal[m] + shiftPetrolTotal[m] + genPetrolTotal[m] + genDieselTotal[m]).toLocaleString()}
                                </td>)}
                                <td className="border border-gray-300 p-2 text-right">
                                    {(shiftDieselTotal.total + shiftPetrolTotal.total + genPetrolTotal.total + genDieselTotal.total).toLocaleString()}
                                </td>
                            </tr>

                            <tr className="bg-white"><td colSpan={17} className="p-2"></td></tr>

                            <tr className="bg-yellow-50/10 font-bold text-slate-700">
                                <td colSpan={4} className="border border-gray-300 p-2 text-center uppercase border-l-4 border-amber-400">PSO Charges</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-2 text-right">{psoCharges[m] > 0 ? psoCharges[m].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-2 text-right">{psoCharges.total.toLocaleString()}</td>
                            </tr>

                            <tr className="bg-slate-100 font-bold text-sm">
                                <td colSpan={4} className="border border-gray-300 p-3 text-center uppercase tracking-widest text-slate-800">Grand Total</td>
                                {months.map(m => <td key={m} className="border border-gray-300 p-3 text-right">{grandTotal[m] > 0 ? grandTotal[m].toLocaleString() : '-'}</td>)}
                                <td className="border border-gray-300 p-3 text-right text-ncp-primary">{grandTotal.total.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PolExpRsView;