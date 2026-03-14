import React, { useState } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PolReportViewProps {
    db: Database;
    onUpdate: (updatedDb: Database, section?: string) => void;
}

const PolReportView: React.FC<PolReportViewProps> = ({ db, onUpdate }) => {
    const [startYear, setStartYear] = useState(2025);
    const months = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"];

    const getYearForMonth = (monthIndex: number) => {
        return monthIndex < 6 ? startYear : startYear + 1;
    };
    
    const getDerivedData = (monthIndex: number) => {
        const currentYear = getYearForMonth(monthIndex);
        const calendarMonth = ((monthIndex + 6) % 12) + 1;
        const monthStr = String(calendarMonth).padStart(2, '0');
        const monthYear = `${currentYear}-${monthStr}`;

        const entries = (db.pol_soi_entries || []).filter(e => (e.date as string)?.startsWith(monthYear));

        const data = {
            ent: { pQty: 0, pExp: 0, dQty: 0, dExp: 0 },
            shift: { pQty: 0, pExp: 0, dQty: 0, dExp: 0 },
            gen: { pQty: 0, pExp: 0, dQty: 0, dExp: 0 }
        };

        entries.forEach(e => {
            const veh = db.vehicles.find(v => v.reg_no === e.vehicle_reg);
            if (!veh) return;

            const qty = Number(e.qty || 0);
            const amt = Number(e.amount || 0);
            const duty = veh.duty_type;
            const fuel = veh.fuel_type;

            if (duty === 'Entitled' || duty === 'SOI') {
                if (fuel === 'Petrol') { data.ent.pQty += qty; data.ent.pExp += amt; }
                else { data.ent.dQty += qty; data.ent.dExp += amt; }
            } else if (duty === 'Shift') {
                if (fuel === 'Petrol') { data.shift.pQty += qty; data.shift.pExp += amt; }
                else { data.shift.dQty += qty; data.shift.dExp += amt; }
            } else if (duty === 'General') {
                if (fuel === 'Petrol') { data.gen.pQty += qty; data.gen.pExp += amt; }
                else { data.gen.dQty += qty; data.gen.dExp += amt; }
            }
        });
        
        return data;
    };

    const getPsoData = (monthIndex: number) => {
        const monthName = months[monthIndex];
        const yearStr = getYearForMonth(monthIndex).toString();
        const record = db.pol_report.find(r => r.month === monthName && r.year === yearStr);
        return record || { 
            ent_petrol_pso: 0, ent_diesel_pso: 0,
            shift_petrol_pso: 0, shift_diesel_pso: 0, 
            gen_petrol_pso: 0, gen_diesel_pso: 0 
        };
    };

    const handlePsoChange = (monthIndex: number, field: string, value: string) => {
        const monthName = months[monthIndex];
        const yearStr = getYearForMonth(monthIndex).toString();
        
        let newList = [...db.pol_report];
        const idx = newList.findIndex(r => r.month === monthName && r.year === yearStr);
        
        let record: GenericRecord = idx >= 0 ? { ...newList[idx] } : { month: monthName, year: yearStr };
        record[field] = parseFloat(value) || 0;
        
        if (idx >= 0) newList[idx] = record;
        else newList.push(record);

        onUpdate({ ...db, pol_report: newList }, 'pol_report');
    };

    const handleExportExcel = () => {
        const rows: any[] = [];
        months.forEach((m, i) => {
            const d = getDerivedData(i);
            const p = getPsoData(i);
            
            const cats = [
                { name: "Ent & SOI Vehs", pQ: d.ent.pQty, pE: d.ent.pExp, pP: p.ent_petrol_pso, dQ: d.ent.dQty, dE: d.ent.dExp, dP: p.ent_diesel_pso },
                { name: "Shift Vehs", pQ: d.shift.pQty, pE: d.shift.pExp, pP: p.shift_petrol_pso, dQ: d.shift.dQty, dE: d.shift.dExp, dP: p.shift_diesel_pso },
                { name: "Gen Vehs", pQ: d.gen.pQty, pE: d.gen.pExp, pP: p.gen_petrol_pso, dQ: d.gen.dQty, dE: d.gen.dExp, dP: p.gen_diesel_pso }
            ];

            cats.forEach((cat, catIdx) => {
                const pt = Number(cat.pE) + Number(cat.pP);
                const dt = Number(cat.dE) + Number(cat.dP);
                rows.push({
                    Sr: (i * 3) + catIdx + 1,
                    Month: catIdx === 0 ? m : "",
                    "Nature of Vehs": cat.name,
                    Fuel: "Petrol",
                    "Cons of Fuel": cat.pQ,
                    "Expens of Fuel (Rs)": cat.pE,
                    "Total (Rs)": cat.pE,
                    "PSO Charges (Rs)": cat.pP,
                    "Total (Rs) ": pt,
                    "Total Amount": pt + dt
                });
                rows.push({
                    Fuel: "Diesel",
                    "Cons of Fuel": cat.dQ,
                    "Expens of Fuel (Rs)": cat.dE,
                    "Total (Rs)": cat.dE,
                    "PSO Charges (Rs)": cat.dP,
                    "Total (Rs) ": dt
                });
            });
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "POL Report");
        XLSX.writeFile(wb, "POL_Report.xlsx");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape', 'pt', 'a4');
        doc.setFontSize(14);
        doc.text(`POL Purchase & Expenditure Report (FY ${startYear}-${startYear+1})`, 40, 30);
        
        const head = [["Sr", "Month", "Nature of Vehs", "Fuel", "Cons of Fuel", "Expens of Fuel", "Total", "PSO Charges", "Total", "Total Amount"]];
        const body: any[] = [];
        
        months.forEach((m, i) => {
            const d = getDerivedData(i);
            const p = getPsoData(i);
            const cats = [
                { n: "Ent & SOI", f1: "Petrol", q1: d.ent.pQty, e1: d.ent.pExp, p1: p.ent_petrol_pso, f2: "Diesel", q2: d.ent.dQty, e2: d.ent.dExp, p2: p.ent_diesel_pso },
                { n: "Shift", f1: "Petrol", q1: d.shift.pQty, e1: d.shift.pExp, p1: p.shift_petrol_pso, f2: "Diesel", q2: d.shift.dQty, e2: d.shift.dExp, p2: p.ent_diesel_pso },
                { n: "General", f1: "Petrol", q1: d.gen.pQty, e1: d.gen.pExp, p1: p.gen_petrol_pso, f2: "Diesel", q2: d.gen.dQty, e2: d.gen.dExp, p2: p.gen_diesel_pso }
            ];
            cats.forEach((c, idx) => {
                const pt = Number(c.e1) + Number(c.p1);
                const dt = Number(c.e2) + Number(c.p2);
                body.push([{content: (i * 3) + idx + 1, rowSpan: 2}, {content: idx === 0 ? m : "", rowSpan: 2}, {content: c.n, rowSpan: 2}, c.f1, c.q1, c.e1, c.e1, c.p1, pt, {content: (pt + dt).toLocaleString(), rowSpan: 2}]);
                body.push([c.f2, c.q2, c.e2, c.e2, c.p2, dt]);
            });
        });

        autoTable(doc, { 
            head, 
            body, 
            startY: 45, 
            theme: 'grid',
            styles: { fontSize: 6.5, cellPadding: 2, halign: 'center' },
            headStyles: { fillColor: [31, 41, 55], textColor: 255 },
            columnStyles: {
                2: { halign: 'left' },
                9: { fontStyle: 'bold' }
            }
        });
        doc.save(`POL_Report_Full_Page.pdf`);
    };

    return (
        <div id="view-pol-report" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-4 no-print flex-shrink-0">
                    <div className="flex flex-col">
                        <h5 className="text-xl font-bold text-ncp-primary uppercase tracking-tight">POL Report Summary</h5>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">NCP Transport Division - FY {startYear}-{startYear+1}</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-200 shadow-sm">
                             <label className="text-[10px] font-bold text-slate-500 uppercase px-2">FY Start:</label>
                             <input type="number" className="w-16 bg-white border border-slate-300 text-sm rounded px-1 outline-none text-center font-bold" value={startYear} onChange={(e) => setStartYear(parseInt(e.target.value))} />
                        </div>
                        <button className="bg-rose-600 text-white py-2 px-4 rounded hover:bg-rose-700 transition shadow-sm text-xs font-bold" onClick={handleExportPDF}>
                            <i className="fas fa-file-pdf me-2"></i> PDF
                        </button>
                        <button className="bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 transition shadow-sm text-xs font-bold" onClick={handleExportExcel}>
                            <i className="fas fa-file-excel me-2"></i> EXCEL
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full text-[11px] text-center border-collapse relative min-w-[1100px] print:text-[10px]">
                        <thead>
                            <tr className="bg-slate-800 text-white uppercase tracking-widest font-bold text-[10px]">
                                <th className="border border-slate-700 p-3 w-10">Sr</th>
                                <th className="border border-slate-700 p-3 w-20">Month</th>
                                <th className="border border-slate-700 p-3 w-40 text-left">Nature of Vehs</th>
                                <th className="border border-slate-700 p-3 w-20">Fuel</th>
                                <th className="border border-slate-700 p-3 w-24">Cons of Fuel</th>
                                <th className="border border-slate-700 p-3 w-32">Expens of Fuel (Rs)</th>
                                <th className="border border-slate-700 p-3 w-32">Total</th>
                                <th className="border border-slate-700 p-3 w-32">PSO Charges (Rs)</th>
                                <th className="border border-slate-700 p-3 w-32">Total</th>
                                <th className="border border-slate-700 p-3 w-32 bg-slate-900">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {months.map((m, i) => {
                                const d = getDerivedData(i);
                                const p = getPsoData(i);
                                
                                const sections = [
                                    { 
                                        name: "Ent & SOI Vehs", 
                                        rows: [
                                            { type: "Petrol", qty: d.ent.pQty, exp: d.ent.pExp, psoF: 'ent_petrol_pso', psoV: p.ent_petrol_pso, rowCls: "bg-green-50/20", labelCls: "text-[#166534] font-bold" },
                                            { type: "Diesel", qty: d.ent.dQty, exp: d.ent.dExp, psoF: 'ent_diesel_pso', psoV: p.ent_diesel_pso, rowCls: "bg-orange-50/20", labelCls: "text-[#9a3412] font-bold" }
                                        ]
                                    },
                                    { 
                                        name: "Shift Vehs", 
                                        rows: [
                                            { type: "Petrol", qty: d.shift.pQty, exp: d.shift.pExp, psoF: 'shift_petrol_pso', psoV: p.shift_petrol_pso, rowCls: "bg-green-50/20", labelCls: "text-[#166534] font-bold" },
                                            { type: "Diesel", qty: d.shift.dQty, exp: d.shift.dExp, psoF: 'shift_diesel_pso', psoV: p.shift_diesel_pso, rowCls: "bg-orange-50/20", labelCls: "text-[#9a3412] font-bold" }
                                        ]
                                    },
                                    { 
                                        name: "Gen Vehs", 
                                        rows: [
                                            { type: "Petrol", qty: d.gen.pQty, exp: d.gen.pExp, psoF: 'gen_petrol_pso', psoV: p.gen_petrol_pso, rowCls: "bg-green-50/20", labelCls: "text-[#166534] font-bold" },
                                            { type: "Diesel", qty: d.gen.dQty, exp: d.gen.dExp, psoF: 'gen_diesel_pso', psoV: p.gen_diesel_pso, rowCls: "bg-orange-50/20", labelCls: "text-[#9a3412] font-bold" }
                                        ]
                                    }
                                ];

                                return (
                                    <React.Fragment key={m}>
                                        {sections.map((sec, secIdx) => {
                                            const st = sec.rows.reduce((sum, r) => sum + (Number(r.exp) + Number(r.psoV || 0)), 0);
                                            return (
                                                <React.Fragment key={secIdx}>
                                                    {sec.rows.map((row, rowIdx) => (
                                                        <tr key={rowIdx} className={`border-b border-gray-200 ${row.rowCls} hover:opacity-80 transition-opacity`}>
                                                            {secIdx === 0 && rowIdx === 0 && (
                                                                <td className="border border-gray-300 p-2 font-bold bg-white text-slate-400" rowSpan={6}>{(i + 1)}</td>
                                                            )}
                                                            {secIdx === 0 && rowIdx === 0 && (
                                                                <td className="border border-gray-300 p-2 font-bold text-sm align-middle bg-white" rowSpan={6}>{m}</td>
                                                            )}
                                                            {rowIdx === 0 && (
                                                                <td className="border border-gray-300 p-2 text-left font-bold align-middle bg-slate-50 text-slate-800" rowSpan={2}>
                                                                    {sec.name}
                                                                </td>
                                                            )}
                                                            <td className={`border border-gray-300 p-2 font-bold text-[10px] uppercase ${row.labelCls}`}>{row.type}</td>
                                                            <td className="border border-gray-300 p-1 font-bold text-slate-600">{row.qty || '-'}</td>
                                                            <td className="border border-gray-300 p-1 font-bold text-slate-700">{row.exp ? row.exp.toLocaleString() : '-'}</td>
                                                            <td className="border border-gray-300 p-1 text-slate-400 italic">{row.exp ? row.exp.toLocaleString() : '-'}</td>
                                                            <td className="border border-gray-300 p-0 bg-white/40">
                                                                <input 
                                                                    className="w-full text-center p-1 bg-transparent focus:bg-white outline-none font-bold text-blue-800" 
                                                                    value={row.psoV || ''} 
                                                                    onChange={e => handlePsoChange(i, row.psoF, e.target.value)} 
                                                                    placeholder="-" 
                                                                />
                                                            </td>
                                                            <td className="border border-gray-300 p-1 font-bold text-slate-800 bg-black/5">
                                                                {(Number(row.exp) + Number(row.psoV || 0)).toLocaleString()}
                                                            </td>
                                                            {rowIdx === 0 && (
                                                                <td className="border border-gray-300 p-2 font-bold text-slate-900 bg-slate-50 align-middle text-sm" rowSpan={2}>
                                                                    {st.toLocaleString()}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PolReportView;