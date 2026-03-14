import React, { useState, useMemo, useEffect } from 'react';
import { Database, GenericRecord, DbSchema } from '../types';
import { formatDate } from '../constants';
import DatePicker from './DatePicker';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyReportsViewProps {
    db: Database;
    onAdd: () => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onRowUpdate: (index: number, updatedRow: GenericRecord) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
    schema: DbSchema;
}

const COE_LIST = [
    "NCP Central Setup (Estate)", "NCP Central Setup (Admin)", "NCP Central Setup (Tpt)", 
    "NCP Central Setup (Fin)", "NCP Central Setup (Proc)", "NCP Central Setup (HR)", 
    "NCP Central Setup (Sec)", "NCP Central Setup (IT)", "NCP Central Setup (CAAD)",
    "DG Sectt", "CoE AITeC", "CoE NINVAST", "CoE Physics", "CoE PIAM3D"
];

const DailyReportsView: React.FC<DailyReportsViewProps> = ({ db, onAdd, onEdit, onDelete, onRowUpdate, onDirectAdd, schema }) => {
    const today = new Date();
    const [selDay, setSelDay] = useState(today.getDate());
    const [selMonth, setSelMonth] = useState(today.getMonth());
    const [selYear, setSelYear] = useState(today.getFullYear());
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
    useEffect(() => {
        if (selDay > daysInMonth) setSelDay(daysInMonth);
    }, [selMonth, selYear, daysInMonth, selDay]);

    const selectedDate = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
    const dateObj = new Date(selYear, selMonth, selDay);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const dailyData = useMemo(() => {
        return (db.daily_reports || []).map((r, i) => ({ ...r, originalIndex: i } as GenericRecord & { originalIndex: number }))
            .filter(r => r.date === selectedDate);
    }, [db.daily_reports, selectedDate]);

    // Data lists for linked select inputs
    const vehicleRegList = useMemo(() => db.vehicles.map(v => v.reg_no as string).filter(Boolean), [db.vehicles]);
    const driverNameList = useMemo(() => db.drivers.map(d => d.name as string).filter(Boolean), [db.drivers]);

    const handleInputChange = (index: number, field: string, value: string) => {
        // Validation for time fields (Must not exceed 2400)
        if (field === 'time_out' || field === 'time_in') {
            const cleanVal = value.replace(/[^0-9]/g, '');
            if (cleanVal !== '') {
                const numericValue = parseInt(cleanVal, 10);
                if (numericValue > 2400) {
                    return; // Reject update if value > 2400
                }
            }
        }

        const updatedList = [...db.daily_reports];
        const record = { ...updatedList[index], [field]: value };

        if (field === 'vehicle_reg') {
            const selectedVeh = db.vehicles.find(v => v.reg_no === value);
            if (selectedVeh && selectedVeh.fuel_type) record.fuel_type = selectedVeh.fuel_type;
        }

        // Calculation logic for KMs and Liters
        if (field === 'meter_in' || field === 'meter_out' || field === 'average') {
            const mIn = field === 'meter_in' ? parseFloat(value) : parseFloat(record.meter_in as string || '0');
            const mOut = field === 'meter_out' ? parseFloat(value) : parseFloat(record.meter_out as string || '0');
            const avg = field === 'average' ? parseFloat(value) : parseFloat(record.average as string || '0');
            
            if (mIn >= mOut) {
                record.kms = mIn - mOut;
                if (avg > 0) record.liters = parseFloat((record.kms / avg).toFixed(2));
            }
        }

        onRowUpdate(index, record);
    };

    const getVehicleMake = (regNo: string | number | undefined) => {
        if (!regNo) return '-';
        const veh = db.vehicles.find(v => v.reg_no === regNo);
        return veh ? veh.make_type : '-';
    };

    const exportToExcel = () => {
        const official = dailyData.filter(r => r.type === 'Official');
        const privateDuty = dailyData.filter(r => r.type !== 'Official');
        
        const wb = XLSX.utils.book_new();

        const formatForExcel = (data: any[]) => {
            const rows = data.map((r, i) => ({
                "Sr.No": i + 1, 
                "Vehic Reg No": r.vehicle_reg, 
                "Make & Type": getVehicleMake(r.vehicle_reg), 
                "Officer/Staff": r.officer, 
                "CoEs": r.coe,
                "Destination": r.destination, 
                "Duty Detail": r.duty_detail, 
                "Driver Name": r.driver,
                "Time Out": r.time_out, 
                "Meter Out": r.meter_out, 
                "Time IN": r.time_in, 
                "Meter IN": r.meter_in,
                "KMs": r.kms, 
                "Ave": r.average, 
                "Ltrs": r.liters, 
                "Remarks": r.remarks
            }));

            // Add total row for Excel
            if (rows.length > 0) {
                const totalKms = data.reduce((s, r) => s + (Number(r.kms) || 0), 0);
                const totalLtrs = data.reduce((s, r) => s + (Number(r.liters) || 0), 0);
                rows.push({
                    "Sr.No": "TOTAL" as any,
                    "Vehic Reg No": "", "Make & Type": "", "Officer/Staff": "", "CoEs": "",
                    "Destination": "", "Duty Detail": "", "Driver Name": "",
                    "Time Out": "", "Meter Out": "", "Time IN": "", "Meter IN": "",
                    "KMs": totalKms, "Ave": "" as any, "Ltrs": totalLtrs as any, "Remarks": ""
                });
            }
            return rows;
        };

        const wsOff = XLSX.utils.json_to_sheet(formatForExcel(official));
        XLSX.utils.book_append_sheet(wb, wsOff, "Official Movements");

        const wsPvt = XLSX.utils.json_to_sheet(formatForExcel(privateDuty));
        XLSX.utils.book_append_sheet(wb, wsPvt, "Private Movements");

        // Summary - ONLY OFFICIAL
        const summaryRows = COE_LIST.map(coe => {
            const records = official.filter(r => r.coe === coe); // Strictly Official
            return {
                "CoEs & Central Setups": coe,
                "No of Duties": records.length || '-',
                "Total KMs": records.reduce((s, r) => s + (Number(r.kms) || 0), 0) || '-',
                "Diesel (Ltrs)": records.filter(r => r.fuel_type === 'Diesel').reduce((s, r) => s + (Number(r.liters) || 0), 0).toFixed(2) || '-',
                "Petrol (Ltrs)": records.filter(r => r.fuel_type === 'Petrol').reduce((s, r) => s + (Number(r.liters) || 0), 0).toFixed(2) || '-'
            };
        });
        const wsSum = XLSX.utils.json_to_sheet(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSum, "CoE Summary");

        XLSX.writeFile(wb, `Movement_Report_${selectedDate}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('landscape');
        const pageWidth = doc.internal.pageSize.getWidth();

        const drawSection = (title: string, data: any[], startY: number) => {
            doc.setFontSize(10);
            doc.text(title, pageWidth / 2, startY, { align: 'center' });
            
            const totalKms = data.reduce((s, r) => s + (Number(r.kms) || 0), 0);
            const totalLtrs = data.reduce((s, r) => s + (Number(r.liters) || 0), 0);

            const tableRows = data.map((r, i) => {
                const make = getVehicleMake(r.vehicle_reg);
                const vehicleDisplay = make !== '-' ? `${r.vehicle_reg} (${make})` : r.vehicle_reg;
                return [
                    i + 1, 
                    vehicleDisplay, 
                    r.officer, 
                    r.coe, 
                    r.destination, 
                    r.driver, 
                    r.time_out, 
                    r.meter_out, 
                    r.time_in, 
                    r.meter_in, 
                    r.kms, 
                    r.average, 
                    r.liters, 
                    r.remarks
                ];
            });

            // Add Footer Row
            if (tableRows.length > 0) {
                tableRows.push([
                    { content: 'TOTAL', colSpan: 10, styles: { halign: 'right', fontStyle: 'bold' } } as any,
                    { content: totalKms.toString(), styles: { fontStyle: 'bold' } } as any,
                    '',
                    { content: totalLtrs.toFixed(2), styles: { fontStyle: 'bold' } } as any,
                    ''
                ]);
            }

            autoTable(doc, {
                head: [['Sr', 'Veh Reg', 'Officer', 'CoEs', 'Destination', 'Driver', 'T-Out', 'M-Out', 'T-In', 'M-In', 'KMs', 'Ave', 'Ltrs', 'Remarks']],
                body: tableRows,
                startY: startY + 4,
                styles: { fontSize: 6.5, cellPadding: 1 },
                headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], lineWidth: 0.1 },
                theme: 'grid'
            });
            return (doc as any).lastAutoTable.finalY + 12;
        };

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Movement of Vehicles", pageWidth / 2, 12, { align: 'center' });
        doc.setFontSize(11);
        doc.text(`${dayOfWeek}, ${formatDate(dateObj)}`, pageWidth / 2, 18, { align: 'center' });

        let nextY = 25;
        const official = dailyData.filter(r => r.type === 'Official');
        const privateDuty = dailyData.filter(r => r.type !== 'Official');

        // Section 1: Official
        nextY = drawSection("Official Movements", official, nextY);
        
        // Section 2: Private
        nextY = drawSection("Private & School Duty", privateDuty, nextY);

        // Section 3: Summary (ONLY OFFICIAL)
        doc.setFontSize(10);
        doc.text("CoEs & Central Setups Summary (Official Only)", pageWidth / 2, nextY, { align: 'center' });
        
        let grandDuties = 0;
        let grandKms = 0;
        let grandDiesel = 0;
        let grandPetrol = 0;

        const summaryRows = COE_LIST.map(coe => {
            const records = official.filter(r => r.coe === coe); // Strictly Official
            const diesel = records.filter(r => r.fuel_type === 'Diesel').reduce((s, r) => s + (Number(r.liters) || 0), 0);
            const petrol = records.filter(r => r.fuel_type === 'Petrol').reduce((s, r) => s + (Number(r.liters) || 0), 0);
            const kms = records.reduce((s, r) => s + (Number(r.kms) || 0), 0);
            
            grandDuties += records.length;
            grandKms += kms;
            grandDiesel += diesel;
            grandPetrol += petrol;

            return [
                coe,
                records.length || '-',
                kms || '-',
                diesel ? diesel.toFixed(2) : '-',
                petrol ? petrol.toFixed(2) : '-'
            ];
        });

        // Add Grand Total to Summary Table
        summaryRows.push([
            { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'right' } } as any,
            { content: grandDuties.toString(), styles: { fontStyle: 'bold' } } as any,
            { content: grandKms.toString(), styles: { fontStyle: 'bold' } } as any,
            { content: grandDiesel.toFixed(2), styles: { fontStyle: 'bold' } } as any,
            { content: grandPetrol.toFixed(2), styles: { fontStyle: 'bold' } } as any,
        ]);

        autoTable(doc, {
            head: [
                [{ content: 'CoEs & Central Setups', rowSpan: 2 }, { content: 'Duties', rowSpan: 2 }, { content: 'Total KMs', rowSpan: 2 }, { content: 'Fuel consumption (Ltrs)', colSpan: 2 }],
                ['Diesel', 'Petrol']
            ],
            body: summaryRows,
            startY: nextY + 4,
            styles: { fontSize: 8, halign: 'center' },
            columnStyles: { 0: { halign: 'left' } },
            headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], lineWidth: 0.1 },
            theme: 'grid'
        });

        doc.save(`Movement_Report_${selectedDate}.pdf`);
    };

    const getTypeStyle = (type: string | undefined) => {
        switch(type) {
            case 'Private': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'School Duty': return 'bg-amber-100 text-amber-800 border-amber-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <div className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-wrap justify-between items-center mb-6 no-print bg-slate-50 p-4 rounded-lg border border-gray-200 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsDatePickerOpen(true)} className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2 text-xs hover:border-ncp-primary transition shadow-sm font-bold">
                            <i className="fas fa-calendar-alt text-amber-500"></i>
                            {formatDate(dateObj)}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exportToExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-xs font-bold">
                            <i className="fas fa-file-excel mr-1"></i> EXCEL
                        </button>
                        <button onClick={exportToPDF} className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition shadow-sm text-xs font-bold">
                            <i className="fas fa-file-pdf mr-1"></i> PDF
                        </button>
                        <button className="bg-ncp-primary text-white py-2 px-6 rounded-lg hover:bg-ncp-dark transition shadow-sm font-bold text-xs" onClick={onAdd}>
                            <i className="fas fa-plus me-1"></i> ADD MOVEMENT
                        </button>
                    </div>
                </div>

                <div className="text-center mb-6 pb-2 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-ncp-primary uppercase tracking-tight">Movement of Vehicles</h2>
                    <h3 className="text-sm text-slate-500 font-bold uppercase">{formatDate(dateObj)} ({dayOfWeek})</h3>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50 mb-8">
                    <table className="w-full text-[10px] text-center border-collapse">
                        <thead className="bg-slate-800 text-white uppercase tracking-widest font-bold text-[9px]">
                            <tr>
                                <th className="border border-slate-700 p-3 w-8" rowSpan={2}>Sr</th>
                                <th className="border border-slate-700 p-3 min-w-[70px]" rowSpan={2}>Type</th>
                                <th className="border border-slate-700 p-3 min-w-[90px]" rowSpan={2}>Veh Reg</th>
                                <th className="border border-slate-700 p-3 min-w-[90px]" rowSpan={2}>Make</th>
                                <th className="border border-slate-700 p-3 min-w-[100px]" rowSpan={2}>Officer/Staff</th>
                                <th className="border border-slate-700 p-3 min-w-[110px]" rowSpan={2}>CoEs</th>
                                <th className="border border-slate-700 p-3 min-w-[110px]" rowSpan={2}>Destination</th>
                                <th className="border border-slate-700 p-3 min-w-[90px]" rowSpan={2}>Driver</th>
                                <th className="border border-slate-700 p-1 border-b-2" colSpan={2}>Out</th>
                                <th className="border border-slate-700 p-1 border-b-2" colSpan={2}>In</th>
                                <th className="border border-slate-700 p-3 w-10" rowSpan={2}>KMs</th>
                                <th className="border border-slate-700 p-3 w-10" rowSpan={2}>Avg</th>
                                <th className="border border-slate-700 p-3 w-10" rowSpan={2}>Ltrs</th>
                                <th className="border border-slate-700 p-3 min-w-[100px]" rowSpan={2}>Remarks</th>
                                <th className="border border-slate-700 p-3 w-8 action-col" rowSpan={2}>Act</th>
                            </tr>
                            <tr className="bg-slate-700 text-[8px]">
                                <th className="border border-slate-600 p-2">Time</th>
                                <th className="border border-slate-600 p-2">Meter</th>
                                <th className="border border-slate-600 p-2">Time</th>
                                <th className="border border-slate-600 p-2">Meter</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {dailyData.length === 0 ? (
                                <tr><td colSpan={17} className="p-6 text-slate-400 italic">No records found</td></tr>
                            ) : (
                                dailyData.map((r, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-gray-100">
                                        <td className="p-1 border-r border-gray-300 font-bold text-slate-400">{i + 1}</td>
                                        <td className="p-1 border-r border-gray-300">
                                            <select className={`w-full p-1 outline-none font-bold text-[9px] uppercase rounded border border-transparent ${getTypeStyle(r.type as string)}`} value={r.type || 'Official'} onChange={(e) => handleInputChange(r.originalIndex, 'type', e.target.value)}>
                                                <option value="Official">Official</option>
                                                <option value="Private">Private</option>
                                                <option value="School Duty">School Duty</option>
                                            </select>
                                        </td>
                                        <td className="p-0 border-r border-gray-300">
                                            <select className="w-full p-2 bg-transparent focus:bg-white outline-none font-bold text-center" value={r.vehicle_reg} onChange={(e) => handleInputChange(r.originalIndex, 'vehicle_reg', e.target.value)}>
                                                <option value="">-</option>
                                                {vehicleRegList.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2 border-r border-gray-300 text-slate-500 bg-gray-50/30 truncate max-w-[80px]">
                                            {getVehicleMake(r.vehicle_reg)}
                                        </td>
                                        <td className="p-0 border-r border-gray-300">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none" value={r.officer} onChange={(e) => handleInputChange(r.originalIndex, 'officer', e.target.value)} />
                                        </td>
                                        <td className="p-0 border-r border-gray-300 text-left">
                                            <select className="w-full p-2 bg-transparent focus:bg-white outline-none text-[9px]" value={r.coe} onChange={(e) => handleInputChange(r.originalIndex, 'coe', e.target.value)}>
                                                <option value="">-</option>
                                                {schema.daily_reports?.fields.find(f => f.name === 'coe')?.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-0 border-r border-gray-300">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none" value={r.destination} onChange={(e) => handleInputChange(r.originalIndex, 'destination', e.target.value)} />
                                        </td>
                                        <td className="p-0 border-r border-gray-300">
                                            <select className="w-full p-2 bg-transparent focus:bg-white outline-none text-center" value={r.driver} onChange={(e) => handleInputChange(r.originalIndex, 'driver', e.target.value)}>
                                                <option value="">-</option>
                                                {driverNameList.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </td>
                                        
                                        <td className="p-0 border-r border-gray-300 bg-slate-50/20">
                                            <input className="w-full p-1 bg-transparent focus:bg-white outline-none text-center" placeholder="e.g. 0900" value={r.time_out} onChange={(e) => handleInputChange(r.originalIndex, 'time_out', e.target.value)} />
                                        </td>
                                        <td className="p-0 border-r border-gray-300 bg-slate-50/20">
                                            <input className="w-full p-1 bg-transparent focus:bg-white outline-none text-center font-mono" type="number" value={r.meter_out} onChange={(e) => handleInputChange(r.originalIndex, 'meter_out', e.target.value)} />
                                        </td>
                                        <td className="p-0 border-r border-gray-300 bg-blue-50/10">
                                            <input className="w-full p-1 bg-transparent focus:bg-white outline-none text-center" placeholder="e.g. 1700" value={r.time_in} onChange={(e) => handleInputChange(r.originalIndex, 'time_in', e.target.value)} />
                                        </td>
                                        <td className="p-0 border-r border-gray-300 bg-blue-50/10">
                                            <input className="w-full p-1 bg-transparent focus:bg-white outline-none text-center font-mono" type="number" value={r.meter_in} onChange={(e) => handleInputChange(r.originalIndex, 'meter_in', e.target.value)} />
                                        </td>
                                        
                                        <td className="p-1 border-r border-gray-300 font-bold text-blue-600 bg-gray-50/50">{r.kms || '-'}</td>
                                        <td className="p-0 border-r border-gray-300 bg-amber-50/10">
                                            <input className="w-full p-1 bg-transparent focus:bg-white outline-none text-center font-bold text-amber-700" type="number" value={r.average} onChange={(e) => handleInputChange(r.originalIndex, 'average', e.target.value)} />
                                        </td>
                                        <td className="p-1 border-r border-gray-300 font-bold text-emerald-600 bg-gray-50/50">{r.liters || '-'}</td>
                                        <td className="p-0 border-r border-gray-300">
                                            <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-left italic" value={r.remarks} onChange={(e) => handleInputChange(r.originalIndex, 'remarks', e.target.value)} placeholder="..." />
                                        </td>
                                        <td className="p-1 text-center action-col">
                                            <button className="text-rose-400 hover:text-rose-600" onClick={() => onDelete(r.originalIndex)}><i className="fas fa-trash-alt"></i></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            <tr className="bg-gray-50/50 hover:bg-blue-50 transition cursor-pointer group no-print">
                                <td colSpan={17} className="p-0 text-center border-t border-dashed border-gray-300">
                                    <button className="w-full py-2 text-blue-600 font-bold text-[10px] flex items-center justify-center gap-1" onClick={() => onDirectAdd({ type: 'Official', date: selectedDate })}>
                                        <i className="fas fa-plus-circle"></i> ADD NEW ENTRY
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <DatePicker isOpen={isDatePickerOpen} onClose={() => setIsDatePickerOpen(false)} selectedDate={dateObj} onDateSelect={(d) => { setSelDay(d.getDate()); setSelMonth(d.getMonth()); setSelYear(d.getFullYear()); }} />
        </div>
    );
};

export default DailyReportsView;