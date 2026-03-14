
import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import { formatDate } from '../constants';
import DatePicker from './DatePicker';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LogBookViewProps {
    db: Database;
    onAdd: () => void;
    onDelete?: (index: number) => void;
    onRowUpdate?: (index: number, row: GenericRecord) => void;
    onDirectAdd?: (data: GenericRecord) => void;
}

const LogBookView: React.FC<LogBookViewProps> = ({ db, onAdd, onDelete, onRowUpdate, onDirectAdd }) => {
    const [selectedReg, setSelectedReg] = useState("");
    const [activeDateRow, setActiveDateRow] = useState<number | null>(null);

    const vehicleOptions = useMemo(() => {
        return (db.vehicles || []).map(v => ({
            reg: v.reg_no,
            label: `${v.reg_no} - ${v.make_type} ${v.model ? `(${v.model})` : ''}`
        }));
    }, [db.vehicles]);

    const selectedVehicle = useMemo(() => {
        return (db.vehicles || []).find(v => v.reg_no === selectedReg);
    }, [db.vehicles, selectedReg]);

    const calculateTotalFromCostString = (costStr: string): number => {
        const lines = costStr.split('\n');
        return lines.reduce((sum, line) => {
            const val = parseFloat(line.trim());
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
    };

    const handleInputChange = (originalIndex: number, field: string, value: string) => {
        if (onRowUpdate) {
            const updatedRow = { ...db.log_book[originalIndex], [field]: value };
            onRowUpdate(originalIndex, updatedRow);
        }
    };

    const handleLineUpdate = (logIndex: number, lineIndex: number, field: 'repairs' | 'cost', value: string) => {
        const log = db.log_book[logIndex];
        const lines = (log[field] as string || '').split('\n');
        while(lines.length <= lineIndex) lines.push('');
        lines[lineIndex] = value.replace(/\n/g, ' '); 
        
        const finalStringValue = lines.join('\n');
        let updatedRow = { ...log, [field]: finalStringValue };
        
        if (field === 'cost') {
            updatedRow.total_cost = calculateTotalFromCostString(finalStringValue);
        } else if (field === 'repairs') {
            const currentCostLines = (log.cost as string || '').split('\n');
            while(currentCostLines.length < lines.length) currentCostLines.push('');
            updatedRow.cost = currentCostLines.join('\n');
        }

        if (onRowUpdate) {
            onRowUpdate(logIndex, updatedRow);
        }
    };

    const addRepairItem = (logIndex: number) => {
        const log = db.log_book[logIndex];
        const repairs = (log.repairs as string || '') + (log.repairs ? '\n' : '');
        const cost = (log.cost as string || '') + (log.cost ? '\n' : '');
        if (onRowUpdate) {
            onRowUpdate(logIndex, { ...log, repairs, cost });
        }
    };

    const removeRepairItem = (logIndex: number, lineIndex: number) => {
        const log = db.log_book[logIndex];
        const repairLines = (log.repairs as string || '').split('\n');
        const costLines = (log.cost as string || '').split('\n');
        repairLines.splice(lineIndex, 1);
        costLines.splice(lineIndex, 1);
        
        const newCostStr = costLines.join('\n');
        if (onRowUpdate) {
            onRowUpdate(logIndex, { 
                ...log, 
                repairs: repairLines.join('\n'), 
                cost: newCostStr,
                total_cost: calculateTotalFromCostString(newCostStr)
            });
        }
    };

    const handleDateSelect = (date: Date) => {
        if (activeDateRow !== null) {
            const dateStr = date.toISOString().split('T')[0];
            handleInputChange(activeDateRow, 'date', dateStr);
            setActiveDateRow(null);
        }
    };

    const handleExportExcel = () => {
        if (!selectedVehicle) return;
        const filteredLog = (db.log_book || []).filter(l => l.vehicle === selectedReg);
        
        const exportData = filteredLog.map((log, i) => ({
            "Sr": i + 1,
            "SRV Number": log.srv_no || '',
            "Date": formatDate(log.date as string),
            "Repair Details": log.repairs || '',
            "Individual Costs": log.cost || '',
            "Total Cost": log.total_cost || 0,
            "Bill No": log.bill_no || '',
            "Workshop": log.workshop || '',
            "Voucher No": log.voucher_no || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "LogBook");
        XLSX.writeFile(wb, `LogBook_${selectedReg}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedVehicle) return;
        const doc = new jsPDF('landscape');
        const pageWidth = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text("NATIONAL CENTER FOR PHYSICS", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Vehicle Log Book Summary: ${selectedReg} (${selectedVehicle.make_type})`, pageWidth / 2, 22, { align: 'center' });

        const filteredLog = (db.log_book || []).filter(l => l.vehicle === selectedReg);
        const head = [['SRV #', 'Date', 'Particulars of Repairs Executed', 'Amount', 'Total Cost', 'Bill No', 'Workshop', 'Voucher']];
        
        const body = filteredLog.map(log => [
            log.srv_no || '-',
            formatDate(log.date as string),
            log.repairs || '-',
            log.cost || '-',
            Number(log.total_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2}),
            log.bill_no || '-',
            log.workshop || '-',
            log.voucher_no || '-'
        ]);

        autoTable(doc, {
            head,
            body,
            startY: 30,
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [37, 99, 235], textColor: 255 },
            theme: 'grid'
        });

        doc.save(`LogBook_${selectedReg}.pdf`);
    };

    return (
        <div id="view-log-book" className="content-section h-full flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
                
                <div className="p-6 border-b border-gray-100 shrink-0">
                    <div className="flex flex-wrap items-end gap-4 no-print bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex-1 min-w-[250px]">
                            <label className="block font-bold mb-1 text-slate-700 text-xs uppercase tracking-wider">Select Vehicle</label>
                            <div className="flex shadow-sm">
                                <span className="px-3 py-2 bg-white border border-r-0 border-gray-300 rounded-l text-gray-500">
                                    <i className="fas fa-car"></i>
                                </span>
                                <select 
                                    className="w-full border border-gray-300 rounded-r px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ncp-primary bg-white cursor-pointer text-sm font-medium"
                                    value={selectedReg}
                                    onChange={(e) => setSelectedReg(e.target.value)}
                                >
                                    <option value="">-- Choose Vehicle from Fleet --</option>
                                    {vehicleOptions.map((v, i) => (
                                        <option key={i} value={v.reg as string}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button 
                                className="flex-1 md:flex-none px-5 py-2.5 bg-ncp-primary text-white rounded hover:bg-ncp-dark transition font-medium shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50" 
                                onClick={onAdd}
                                disabled={!selectedReg}
                            >
                                <i className="fas fa-calendar-plus"></i> New Entry
                            </button>
                            <button 
                                className="px-4 py-2.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition font-medium shadow-md text-sm disabled:opacity-50" 
                                onClick={handleExportExcel}
                                disabled={!selectedReg}
                                title="Export to Excel"
                            >
                                <i className="fas fa-file-excel"></i>
                            </button>
                            <button 
                                className="px-4 py-2.5 bg-rose-600 text-white rounded hover:bg-rose-700 transition font-medium shadow-md text-sm disabled:opacity-50" 
                                onClick={handleExportPDF}
                                disabled={!selectedReg}
                                title="Export to PDF"
                            >
                                <i className="fas fa-file-pdf"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {selectedVehicle ? (
                        <div id="logBookSheetContainer" className="mx-auto max-w-7xl">
                            <div className="bg-white shadow-lg border border-gray-200 rounded-xl overflow-hidden">
                                <div className="text-center bg-white pt-8">
                                    <h4 className="text-lg font-bold uppercase tracking-widest text-slate-500 mb-4">Summary of Repairs / Modification</h4>
                                    <div className="bg-ncp-primary text-white py-4 px-6 w-full text-center">
                                        <h1 className="text-2xl font-bold uppercase tracking-wide">
                                            {selectedVehicle.reg_no} <span className="mx-2 opacity-50">|</span> {selectedVehicle.make_type}
                                        </h1>
                                        <div className="text-blue-100 text-sm mt-1 font-medium tracking-wider">Model: {selectedVehicle.model}</div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-center">
                                                <th className="border border-gray-300 p-3 w-32" rowSpan={2}>SRV Number</th>
                                                <th className="border border-gray-300 p-3 w-32" rowSpan={2}>Service Date</th>
                                                <th className="border border-gray-300 p-3" colSpan={2}>Repair Detail & Cost</th>
                                                <th className="border border-gray-300 p-3 w-32" rowSpan={2}>Total Cost</th>
                                                <th className="border border-gray-300 p-3 w-28" rowSpan={2}>Bill No</th>
                                                <th className="border border-gray-300 p-3 w-28" rowSpan={2}>Workshop #</th>
                                                <th className="border border-gray-300 p-3 w-28" rowSpan={2}>Voucher No</th>
                                                <th className="border border-gray-300 p-3 w-12 no-print action-col" rowSpan={2}>Act</th>
                                            </tr>
                                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-center">
                                                <th className="border border-gray-300 p-2">Particulars of Repairs Executed</th>
                                                <th className="border border-gray-300 p-2 w-32">Amount (Rs)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="bg-green-100 text-green-900">
                                                <td colSpan={9} className="border border-gray-300 p-2 font-bold text-center uppercase tracking-widest">FY 2025-26</td>
                                            </tr>
                                            {(db.log_book || [])
                                                .map((r, i) => ({ ...r, originalIndex: i } as GenericRecord & { originalIndex: number }))
                                                .filter(l => l.vehicle === selectedReg).map((log, i) => {
                                                    const repairLines = (log.repairs as string || '').split('\n');
                                                    const costLines = (log.cost as string || '').split('\n');
                                                    const maxLines = Math.max(repairLines.length, costLines.length, 1);

                                                    return (
                                                        <tr key={i} className="align-top hover:bg-slate-50 transition-colors group">
                                                            <td className="border border-gray-300 p-0 text-center font-bold text-slate-600 align-middle bg-slate-50/30">
                                                                <input 
                                                                    className="w-full p-2 text-center bg-transparent focus:bg-white outline-none text-xs text-blue-600 font-mono font-bold" 
                                                                    value={log.srv_no || ''} 
                                                                    placeholder="SRV #" 
                                                                    onChange={(e) => handleInputChange(log.originalIndex, 'srv_no', e.target.value)} 
                                                                />
                                                            </td>
                                                            <td className="border border-gray-300 p-3 text-center align-middle text-slate-600 bg-slate-50/30">
                                                                <div className="cursor-pointer hover:text-ncp-primary transition font-bold" onClick={() => setActiveDateRow(log.originalIndex)}>
                                                                    {formatDate(log.date as string)}
                                                                </div>
                                                            </td>
                                                            <td className="border border-gray-300 p-0" colSpan={2}>
                                                                <div className="flex flex-col">
                                                                    {Array.from({ length: maxLines }).map((_, lineIdx) => (
                                                                        <div key={lineIdx} className="flex border-b border-gray-100 last:border-none group/line relative">
                                                                            <div className="flex-1 border-r border-gray-100">
                                                                                <input className="w-full p-2 bg-transparent focus:bg-white outline-none text-slate-800 text-sm" placeholder="Repair detail..." value={repairLines[lineIdx] || ''} onChange={(e) => handleLineUpdate(log.originalIndex, lineIdx, 'repairs', e.target.value)} />
                                                                            </div>
                                                                            <div className="w-32 bg-slate-50/20">
                                                                                <input className="w-full p-2 text-right font-mono bg-transparent focus:bg-white outline-none text-blue-600 font-bold" placeholder="0.00" value={costLines[lineIdx] || ''} onChange={(e) => handleLineUpdate(log.originalIndex, lineIdx, 'cost', e.target.value)} />
                                                                            </div>
                                                                            <button className="absolute -right-6 top-1/2 -translate-y-1/2 text-rose-300 hover:text-rose-500 opacity-0 group-hover/line:opacity-100 transition no-print" onClick={() => removeRepairItem(log.originalIndex, lineIdx)}><i className="fas fa-minus-circle"></i></button>
                                                                        </div>
                                                                    ))}
                                                                    <div className="bg-white border-t border-gray-100 p-1 text-center no-print">
                                                                        <button className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all" onClick={() => addRepairItem(log.originalIndex)}><i className="fas fa-plus"></i></button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="border border-gray-300 p-2 font-bold text-right align-middle bg-blue-50/30 text-ncp-primary text-sm">
                                                                {Number(log.total_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                            </td>
                                                            <td className="border border-gray-300 p-0 align-middle"><input className="w-full p-2 text-center bg-transparent focus:bg-white outline-none font-bold text-slate-700" value={log.bill_no || ''} onChange={(e) => handleInputChange(log.originalIndex, 'bill_no', e.target.value)} /></td>
                                                            <td className="border border-gray-300 p-0 align-middle"><input className="w-full p-2 text-center bg-transparent focus:bg-white outline-none" value={log.workshop || ''} onChange={(e) => handleInputChange(log.originalIndex, 'workshop', e.target.value)} /></td>
                                                            <td className="border border-gray-300 p-0 align-middle"><input className="w-full p-2 text-center bg-transparent focus:bg-white outline-none font-mono text-slate-500" value={log.voucher_no || ''} onChange={(e) => handleInputChange(log.originalIndex, 'voucher_no', e.target.value)} /></td>
                                                            <td className="border border-gray-300 p-2 text-center align-middle no-print action-col">
                                                                <button className="text-rose-400 hover:text-rose-600 transition p-2 hover:bg-rose-50 rounded" onClick={() => onDelete && onDelete(log.originalIndex)}><i className="fas fa-trash-alt"></i></button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            <tr className="bg-gray-50/50 hover:bg-blue-50 transition cursor-pointer group no-print">
                                                <td colSpan={9} className="p-0 text-center border-t border-dashed border-gray-300">
                                                    <button 
                                                        className="w-full py-3 text-blue-600 font-bold hover:text-blue-800 text-[11px] flex items-center justify-center gap-2"
                                                        onClick={() => onDirectAdd && onDirectAdd({ vehicle: selectedReg, date: new Date().toISOString().split('T')[0], repairs: '', cost: '', total_cost: 0 })}
                                                    >
                                                        <i className="fas fa-plus-circle text-sm"></i> ADD NEW SERVICE DATE
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="text-center mt-8 pb-8 no-print flex justify-center gap-4">
                                <button className="bg-ncp-gold text-ncp-primary font-bold py-3 px-10 rounded-lg hover:bg-yellow-400 shadow-lg transition transform hover:scale-105" onClick={() => window.print()}>
                                    <i className="fas fa-print me-2"></i> Print View
                                </button>
                                <button className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-emerald-700 shadow-lg transition transform hover:scale-105" onClick={handleExportExcel}>
                                    <i className="fas fa-file-excel me-2"></i> Export Excel
                                </button>
                                <button className="bg-rose-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-rose-700 shadow-lg transition transform hover:scale-105" onClick={handleExportPDF}>
                                    <i className="fas fa-file-pdf me-2"></i> Export PDF
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 border-2 border-dashed border-gray-200 rounded-xl bg-slate-50/50 m-4">
                            <div className="bg-white p-8 rounded-full shadow-sm mb-6"><i className="fas fa-book-open fa-4x text-slate-100"></i></div>
                            <p className="text-xl font-bold text-slate-400 uppercase tracking-widest">Select a vehicle to access Log Records</p>
                        </div>
                    )}
                </div>
            </div>
            {activeDateRow !== null && (
                <DatePicker 
                    isOpen={activeDateRow !== null} 
                    onClose={() => setActiveDateRow(null)} 
                    selectedDate={db.log_book[activeDateRow]?.date ? new Date(db.log_book[activeDateRow].date as string) : new Date()}
                    onDateSelect={handleDateSelect}
                />
            )}
        </div>
    );
};

export default LogBookView;
