import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDate } from '../constants';

interface PolStateViewProps {
    db: Database;
    onAdd: () => void;
    onUpdate: (updatedDb: Database) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
}

const PolStateView: React.FC<PolStateViewProps> = ({ db, onUpdate }) => {
    // Standard Fiscal Year Months
    const FISCAL_MONTHS = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"];
    
    // META record for configuration and global deductions
    const metaRecord = db.pol_state.find(r => r.month === 'META') || { month: 'META' };
    
    // Comparison Years - Defaults if not in DB
    const year1Label = (metaRecord.year1_label as string) || "FY-2024-25";
    const year2Label = (metaRecord.year2_label as string) || "FY-2025-26";

    // Deductions from Meta
    const confDutyY1 = Number(metaRecord[`conf_p_${year1Label}`] || 0);
    const confDutyY2 = Number(metaRecord[`conf_p_${year2Label}`] || 0);

    const schoolDieselY1 = Number(metaRecord[`sch_d_${year1Label}`] || 0);
    const schoolPetrolY1 = Number(metaRecord[`sch_p_${year1Label}`] || 0);
    const schoolDieselY2 = Number(metaRecord[`sch_d_${year2Label}`] || 0);
    const schoolPetrolY2 = Number(metaRecord[`sch_p_${year2Label}`] || 0);

    const pvtDieselY1 = Number(metaRecord[`pvt_d_${year1Label}`] || 0);
    const pvtPetrolY1 = Number(metaRecord[`pvt_p_${year1Label}`] || 0);
    const pvtDieselY2 = Number(metaRecord[`pvt_d_${year2Label}`] || 0);
    const pvtPetrolY2 = Number(metaRecord[`pvt_p_${year2Label}`] || 0);

    const handleLabelChange = (field: 'year1_label' | 'year2_label', value: string) => {
        const newData = [...db.pol_state];
        const metaIndex = newData.findIndex(r => r.month === 'META');
        const updatedMeta = metaIndex >= 0 ? { ...newData[metaIndex], [field]: value } : { month: 'META', [field]: value };
        
        if (metaIndex >= 0) newData[metaIndex] = updatedMeta;
        else newData.push(updatedMeta);
        
        onUpdate({ ...db, pol_state: newData });
    };

    const handleInputChange = (month: string, fieldType: 'd' | 'p' | 'conf' | 'sch_d' | 'sch_p' | 'pvt_d' | 'pvt_p', yearLabel: string, value: string) => {
        const newData = [...db.pol_state];
        const existingIndex = newData.findIndex(r => r.month === month);
        
        const key = `${fieldType}_${yearLabel}`;
        const val = value === '' ? '' : (parseFloat(value) || 0);
        
        let record: GenericRecord;
        if (existingIndex >= 0) {
            record = { ...newData[existingIndex], [key]: val };
        } else {
            record = { month: month, [key]: val };
        }

        // Recalculate Total for the month if fuel qty changed
        if (month !== 'META' && (fieldType === 'd' || fieldType === 'p')) {
            const d = Number(record[`d_${yearLabel}`] || 0);
            const p = Number(record[`p_${yearLabel}`] || 0);
            record[`t_${yearLabel}`] = d + p;
        }

        if (existingIndex >= 0) newData[existingIndex] = record;
        else newData.push(record);
        
        onUpdate({ ...db, pol_state: newData });
    };

    const getRecord = (month: string) => {
        return db.pol_state.find(r => r.month === month) || { month: month };
    };

    // Calculate dynamic totals for the current comparison labels
    const totals = useMemo(() => {
        let t = {
            d1: 0, p1: 0, tot1: 0,
            d2: 0, p2: 0, tot2: 0
        };
        FISCAL_MONTHS.forEach(m => {
            const row = getRecord(m);
            t.d1 += Number(row[`d_${year1Label}`] || 0);
            t.p1 += Number(row[`p_${year1Label}`] || 0);
            t.tot1 += Number(row[`t_${year1Label}`] || 0);
            t.d2 += Number(row[`d_${year2Label}`] || 0);
            t.p2 += Number(row[`p_${year2Label}`] || 0);
            t.tot2 += Number(row[`t_${year2Label}`] || 0);
        });
        return t;
    }, [db.pol_state, year1Label, year2Label]);

    const schoolTotalY1 = schoolPetrolY1 + schoolDieselY1;
    const schoolTotalY2 = schoolPetrolY2 + schoolDieselY2;
    const pvtTotalY1 = pvtPetrolY1 + pvtDieselY1;
    const pvtTotalY2 = pvtPetrolY2 + pvtDieselY2;

    const netConsumptionY1 = totals.tot1 - schoolTotalY1 - pvtTotalY1 - confDutyY1;
    const netConsumptionY2 = totals.tot2 - schoolTotalY2 - pvtTotalY2 - confDutyY2;

    const handleExportExcel = () => {
        const header = [
            ["POL STATE COMPARISON", "", "", "", "", "", "", ""],
            ["Year 1:", year1Label, "Year 2:", year2Label, "", "", "", ""],
            ["", "", "", "", "", "", "", ""],
            ["Sr", "Month", `${year1Label} Diesel`, `${year1Label} Petrol`, `${year1Label} Total`, `${year2Label} Diesel`, `${year2Label} Petrol`, `${year2Label} Total`]
        ];

        const body = FISCAL_MONTHS.map((m, i) => {
            const r = getRecord(m);
            return [
                i + 1,
                m,
                r[`d_${year1Label}`] || 0,
                r[`p_${year1Label}`] || 0,
                r[`t_${year1Label}`] || 0,
                r[`d_${year2Label}`] || 0,
                r[`p_${year2Label}`] || 0,
                r[`t_${year2Label}`] || 0
            ];
        });

        const footer = [
            ["", "GRAND TOTAL", totals.d1, totals.p1, totals.tot1, totals.d2, totals.p2, totals.tot2],
            ["", "Less: School Duty", schoolDieselY1, schoolPetrolY1, -schoolTotalY1, schoolDieselY2, schoolPetrolY2, -schoolTotalY2],
            ["", "Less: Private Duty", pvtDieselY1, pvtPetrolY1, -pvtTotalY1, pvtDieselY2, pvtPetrolY2, -pvtTotalY2],
            ["", "Less: Conf Duty", "-", "-", -confDutyY1, "-", "-", -confDutyY2],
            ["", "NET CONSUMPTION", (totals.d1 - schoolDieselY1 - pvtDieselY1), (totals.p1 - schoolPetrolY1 - pvtPetrolY1 - confDutyY1), netConsumptionY1, (totals.d2 - schoolDieselY2 - pvtDieselY2), (totals.p2 - schoolPetrolY2 - pvtPetrolY2 - confDutyY2), netConsumptionY2]
        ];

        const fullData = [...header, ...body, ...footer];
        const ws = XLSX.utils.aoa_to_sheet(fullData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "POL_State");
        XLSX.writeFile(wb, `POL_State_${year1Label}_vs_${year2Label}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        const title = `POL STATE COMPARISON: ${year1Label} vs ${year2Label}`;
        doc.setFontSize(16);
        doc.text(title, 14, 15);
        doc.setFontSize(10);
        doc.text(`Report Generated: ${new Date().toLocaleString()}`, 14, 22);

        // Fix: Explicitly cast fillColor arrays to [number, number, number] to satisfy autoTable types
        const head = [
            [
                { content: 'Sr', rowSpan: 2 },
                { content: 'Month', rowSpan: 2 },
                { content: year1Label, colSpan: 3, styles: { halign: 'center', fillColor: [31, 41, 55] as [number, number, number], textColor: 255 } },
                { content: year2Label, colSpan: 3, styles: { halign: 'center', fillColor: [43, 53, 67] as [number, number, number], textColor: 255 } }
            ],
            ['Diesel', 'Petrol', 'Total', 'Diesel', 'Petrol', 'Total']
        ];

        const body: any[] = FISCAL_MONTHS.map((m, i) => {
            const r = getRecord(m);
            return [
                i + 1,
                m,
                r[`d_${year1Label}`] || 0,
                r[`p_${year1Label}`] || 0,
                r[`t_${year1Label}`] || 0,
                r[`d_${year2Label}`] || 0,
                r[`p_${year2Label}`] || 0,
                r[`t_${year2Label}`] || 0
            ];
        });

        // Add Totals & Deductions
        body.push([{ content: 'GRAND TOTAL (LTRS)', colSpan: 2, styles: { fontStyle: 'bold' } }, totals.d1, totals.p1, totals.tot1, totals.d2, totals.p2, totals.tot2]);
        body.push([{ content: 'Less: School Duty', colSpan: 2 }, schoolDieselY1, schoolPetrolY1, `-${schoolTotalY1}`, schoolDieselY2, schoolPetrolY2, `-${schoolTotalY2}`]);
        body.push([{ content: 'Less: Private Duty', colSpan: 2 }, pvtDieselY1, pvtPetrolY1, `-${pvtTotalY1}`, pvtDieselY2, pvtPetrolY2, `-${pvtTotalY2}`]);
        body.push([{ content: 'Less: Conf Duty', colSpan: 2 }, '-', '-', `-${confDutyY1}`, '-', '-', `-${confDutyY2}`]);
        body.push([{ content: 'NET CONSUMPTION', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } }, (totals.d1 - schoolDieselY1 - pvtDieselY1), (totals.p1 - schoolPetrolY1 - pvtPetrolY1 - confDutyY1), { content: netConsumptionY1, styles: { fontStyle: 'bold' } }, (totals.d2 - schoolDieselY2 - pvtDieselY2), (totals.p2 - schoolPetrolY2 - pvtPetrolY2 - confDutyY2), { content: netConsumptionY2, styles: { fontStyle: 'bold' } }]);

        autoTable(doc, {
            head: head as any,
            body,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            // Fix: Explicitly cast fillColor array to [number, number, number]
            headStyles: { fillColor: [31, 41, 55] as [number, number, number], textColor: 255 },
        });

        doc.save(`POL_State_${year1Label}_vs_${year2Label}.pdf`);
    };

    return (
        <div id="view-pol-state" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-4 no-print shrink-0">
                    <div className="flex flex-col">
                        <h5 className="text-xl font-bold text-ncp-primary">POL State Comparison</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Comparison Year Shifting & Analysis</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <div className="flex flex-col">
                                <label className="text-[9px] font-bold text-gray-500 uppercase">Year 1</label>
                                <input 
                                    type="text" 
                                    value={year1Label} 
                                    onChange={(e) => handleLabelChange('year1_label', e.target.value)}
                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-bold w-28 focus:border-ncp-primary outline-none shadow-sm"
                                    placeholder="e.g. FY-2024-25"
                                />
                            </div>
                            <i className="fas fa-exchange-alt text-slate-300 mx-1"></i>
                            <div className="flex flex-col">
                                <label className="text-[9px] font-bold text-gray-500 uppercase">Year 2</label>
                                <input 
                                    type="text" 
                                    value={year2Label} 
                                    onChange={(e) => handleLabelChange('year2_label', e.target.value)}
                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-bold w-28 focus:border-ncp-primary outline-none shadow-sm"
                                    placeholder="e.g. FY-2025-26"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700 transition flex items-center gap-2">
                                <i className="fas fa-file-excel"></i> EXCEL
                            </button>
                            <button onClick={handleExportPDF} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-rose-700 transition flex items-center gap-2">
                                <i className="fas fa-file-pdf"></i> PDF
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full text-xs text-center border-collapse relative">
                        <thead className="bg-slate-800 text-white font-arial">
                            <tr className="uppercase font-bold tracking-widest text-[9px]">
                                <th className="border border-slate-700 p-3 align-middle bg-slate-800 w-12" rowSpan={3}>Sr</th>
                                <th className="border border-slate-700 p-3 align-middle bg-slate-800 w-32" rowSpan={3}>Month</th>
                                <th className="border border-slate-700 p-2 bg-slate-700 border-r-4 border-slate-900" colSpan={3}>{year1Label}</th>
                                <th className="border border-slate-700 p-2 bg-slate-700" colSpan={3}>{year2Label}</th>
                                <th className="border border-slate-700 p-2 action-col bg-slate-800 w-16" rowSpan={3}>Action</th>
                            </tr>
                            <tr className="bg-slate-700 text-white/90 font-bold tracking-wider">
                                <th className="border border-slate-600 p-2">Diesel</th>
                                <th className="border border-slate-600 p-2">Petrol</th>
                                <th className="border border-slate-600 p-2 text-white bg-slate-900 border-r-4 border-slate-900">Total</th>
                                <th className="border border-slate-600 p-2">Diesel</th>
                                <th className="border border-slate-600 p-2">Petrol</th>
                                <th className="border border-slate-600 p-2 text-white bg-slate-900">Total</th>
                            </tr>
                            <tr className="bg-slate-600 text-[8px] text-white/70 font-normal">
                                <th className="border border-slate-500 p-1">Qty</th>
                                <th className="border border-slate-500 p-1">Qty</th>
                                <th className="border border-slate-500 p-1 border-r-4 border-slate-900">Qty</th>
                                <th className="border border-slate-500 p-1">Qty</th>
                                <th className="border border-slate-500 p-1">Qty</th>
                                <th className="border border-slate-500 p-1">Qty</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {FISCAL_MONTHS.map((month, index) => {
                                const row = getRecord(month);
                                return (
                                    <tr key={month} className="hover:bg-yellow-50 transition-colors border-b border-gray-100">
                                        <td className="border border-gray-300 p-2 text-slate-500 text-center">{index + 1}</td>
                                        <td className="border border-gray-300 p-2 font-bold text-slate-700 text-left pl-4">{month}</td>
                                        
                                        {/* Year 1 */}
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full h-full p-2 text-center bg-transparent focus:bg-white focus:outline-none text-slate-600" 
                                                value={row[`d_${year1Label}`] ?? ''} onChange={e => handleInputChange(month, 'd', year1Label, e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full h-full p-2 text-center bg-transparent focus:bg-white focus:outline-none text-slate-600" 
                                                value={row[`p_${year1Label}`] ?? ''} onChange={e => handleInputChange(month, 'p', year1Label, e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-2 font-bold text-slate-800 text-center border-r-4 border-slate-400 bg-blue-50/30">{row[`t_${year1Label}`] || 0}</td>
                                        
                                        {/* Year 2 */}
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full h-full p-2 text-center bg-transparent focus:bg-white focus:outline-none text-slate-600" 
                                                value={row[`d_${year2Label}`] ?? ''} onChange={e => handleInputChange(month, 'd', year2Label, e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input className="w-full h-full p-2 text-center bg-transparent focus:bg-white focus:outline-none text-slate-600" 
                                                value={row[`p_${year2Label}`] ?? ''} onChange={e => handleInputChange(month, 'p', year2Label, e.target.value)} />
                                        </td>
                                        <td className="border border-gray-300 p-2 font-bold text-indigo-700 text-center bg-indigo-50/30">{row[`t_${year2Label}`] || 0}</td>
                                        
                                        <td className="border border-gray-300 p-2 border-l border-slate-100 text-center action-col">
                                            <button className="text-gray-300 hover:text-red-500 transition-colors" title="Clear Row Data">
                                                <i className="fas fa-eraser"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-100 text-slate-800 border-t-2 border-slate-300 font-bold">
                            <tr className="border-b-4 border-slate-400">
                                <td colSpan={2} className="border border-gray-300 p-3 text-right uppercase text-xs tracking-wider">Total (Ltrs)</td>
                                <td className="border border-gray-300 p-3 text-center">{totals.d1.toLocaleString()}</td>
                                <td className="border border-gray-300 p-3 text-center">{totals.p1.toLocaleString()}</td>
                                <td className="border border-gray-300 p-3 text-center border-r-4 border-slate-400 bg-blue-100">{totals.tot1.toLocaleString()}</td>
                                <td className="border border-gray-300 p-3 text-center">{totals.d2.toLocaleString()}</td>
                                <td className="border border-gray-300 p-3 text-center">{totals.p2.toLocaleString()}</td>
                                <td className="border border-gray-300 p-3 text-center text-indigo-700 bg-indigo-100">{totals.tot2.toLocaleString()}</td>
                                <td className="border border-gray-300 p-3 action-col"></td>
                            </tr>
                            
                            {/* Row 1: School Duty */}
                            <tr className="bg-white font-medium">
                                <td colSpan={2} className="border border-gray-300 p-2 text-right font-bold">(Less) School Duty</td>
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={schoolDieselY1 || ''} onChange={e => handleInputChange('META', 'sch_d', year1Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={schoolPetrolY1 || ''} onChange={e => handleInputChange('META', 'sch_p', year1Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-red-500 border-r-4 border-slate-400">-{schoolTotalY1.toLocaleString()}</td>
                                
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={schoolDieselY2 || ''} onChange={e => handleInputChange('META', 'sch_d', year2Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={schoolPetrolY2 || ''} onChange={e => handleInputChange('META', 'sch_p', year2Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-red-500">-{schoolTotalY2.toLocaleString()}</td>
                                <td className="border border-gray-300 action-col"></td>
                            </tr>

                            {/* Row 2: Private Duty */}
                            <tr className="bg-white font-medium">
                                <td colSpan={2} className="border border-gray-300 p-2 text-right font-bold">(Less) Private Duty</td>
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={pvtDieselY1 || ''} onChange={e => handleInputChange('META', 'pvt_d', year1Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={pvtPetrolY1 || ''} onChange={e => handleInputChange('META', 'pvt_p', year1Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-red-500 border-r-4 border-slate-400">-{pvtTotalY1.toLocaleString()}</td>
                                
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={pvtDieselY2 || ''} onChange={e => handleInputChange('META', 'pvt_d', year2Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={pvtPetrolY2 || ''} onChange={e => handleInputChange('META', 'pvt_p', year2Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-red-500">-{pvtTotalY2.toLocaleString()}</td>
                                <td className="border border-gray-300 action-col"></td>
                            </tr>

                            {/* Row 3: Conf Duty */}
                            <tr className="bg-white font-medium">
                                <td colSpan={2} className="border border-gray-300 p-2 text-right font-bold">(Less) Conf Duty</td>
                                <td colSpan={2} className="border border-gray-300 p-0 text-center">
                                    <input className="w-full h-full p-2 text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={confDutyY1 || ''} onChange={e => handleInputChange('META', 'conf', year1Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-red-500 border-r-4 border-slate-400">-{confDutyY1.toLocaleString()}</td>
                                
                                <td colSpan={2} className="border border-gray-300 p-0 text-center">
                                     <input className="w-full h-full p-2 text-center bg-transparent focus:bg-white outline-none" 
                                        placeholder="0" value={confDutyY2 || ''} onChange={e => handleInputChange('META', 'conf', year2Label, e.target.value)} />
                                </td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-red-500">-{confDutyY2.toLocaleString()}</td>
                                <td className="border border-gray-300 action-col"></td>
                            </tr>

                            {/* Row 4: Net Consumption */}
                            <tr className="bg-slate-200">
                                <td colSpan={2} className="border border-gray-300 p-2 text-right font-bold uppercase text-slate-700">Net Consumption</td>
                                <td className="border border-gray-300 p-2 text-center font-bold">{(totals.d1 - schoolDieselY1 - pvtDieselY1).toLocaleString()}</td>
                                <td className="border border-gray-300 p-2 text-center font-bold">{(totals.p1 - schoolPetrolY1 - pvtPetrolY1 - confDutyY1).toLocaleString()}</td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-lg text-ncp-primary border-r-4 border-slate-400">{ netConsumptionY1.toLocaleString() }</td>
                                
                                <td className="border border-gray-300 p-2 text-center font-bold">{(totals.d2 - schoolDieselY2 - pvtDieselY2).toLocaleString()}</td>
                                <td className="border border-gray-300 p-2 text-center font-bold">{(totals.p2 - schoolPetrolY2 - pvtPetrolY2 - confDutyY2).toLocaleString()}</td>
                                <td className="border border-gray-300 p-2 text-center font-bold text-lg text-indigo-700">{netConsumptionY2.toLocaleString()}</td>
                                <td className="border border-gray-300 action-col"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="mt-4 text-[9px] text-gray-400 italic px-2">
                    <i className="fas fa-info-circle mr-1"></i> Tip: Changing the Year Labels will automatically fetch corresponding data from the database. Data is stored keyed by the exact label text.
                </div>
            </div>
        </div>
    );
};

export default PolStateView;