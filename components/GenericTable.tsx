
import React, { useState } from 'react';
import { GenericRecord, FieldSchema } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GenericTableProps {
    data: GenericRecord[];
    fields: FieldSchema[];
    title: string;
    onAdd: () => void;
    onEdit: (index: number) => void;
    onRowUpdate?: (index: number, updatedRow: GenericRecord) => void;
    onDelete: (index: number) => void;
    onDirectAdd?: (defaultValues: GenericRecord) => void;
}

const GenericTable: React.FC<GenericTableProps> = ({ data, fields, title, onAdd, onEdit, onRowUpdate, onDelete, onDirectAdd }) => {
    const [filter, setFilter] = useState("");

    // Filter logic
    const filteredData = data.map((r, i) => ({ ...r, originalIndex: i })).filter(row => {
        return Object.values(row).some(val => 
            String(val).toLowerCase().includes(filter.toLowerCase())
        );
    });

    const handleInputChange = (originalIndex: number, field: string, value: string) => {
        if (onRowUpdate) {
            const updatedRow = { ...data[originalIndex], [field]: value };
            onRowUpdate(originalIndex, updatedRow);
        }
    };

    const exportToExcel = () => {
        const exportData = filteredData.map((row, idx) => {
            const obj: any = { "Sr": idx + 1 };
            fields.filter(f => f.name !== 'sr').forEach(f => {
                obj[f.label] = row[f.name] || '';
            });
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text(title, 14, 15);
        const tableColumn = ["Sr", ...fields.filter(f => f.name !== 'sr').map(f => f.label)];
        const tableRows = filteredData.map((row, idx) => [
            idx + 1,
            ...fields.filter(f => f.name !== 'sr').map(f => row[f.name] || '')
        ]);
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8, font: 'helvetica' },
            headStyles: { fillColor: [31, 41, 55] }
        });
        doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-4 shrink-0 no-print">
                    <div className="flex flex-col">
                        <h5 className="text-xl font-bold text-ncp-primary">{title}</h5>
                        <p className="text-xs text-slate-400">Manage records. Multi-line fields (like contacts) expand automatically.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex w-48">
                            <span className="px-3 py-2 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg text-slate-400"><i className="fas fa-search text-xs"></i></span>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 rounded-r-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-300 bg-white text-xs" 
                                placeholder="Search..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-1">
                            <button onClick={exportToExcel} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-xs font-bold" title="Export to Excel">
                                <i className="fas fa-file-excel"></i>
                            </button>
                            <button onClick={exportToPDF} className="bg-rose-600 text-white p-2 rounded-lg hover:bg-rose-700 transition shadow-sm text-xs font-bold" title="Export to PDF">
                                <i className="fas fa-file-pdf"></i>
                            </button>
                        </div>
                        <button className="bg-ncp-primary text-white py-2 px-4 rounded-lg hover:bg-ncp-dark transition shadow-sm shadow-blue-100 text-xs font-bold whitespace-nowrap" onClick={onAdd}>
                            <i className="fas fa-plus me-1"></i> Add Record
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full text-left text-[11px] border-collapse" id="generic-data-table">
                        <thead className="bg-slate-800 text-white">
                            <tr className="uppercase text-[10px] font-bold tracking-widest">
                                <th className="px-3 py-3 border border-slate-700 w-10 text-center">Sr</th>
                                {fields.filter(f => f.name !== 'sr').map(f => (
                                    <th key={f.name} className="px-3 py-3 border border-slate-700 whitespace-nowrap">
                                        {f.label}
                                    </th>
                                ))}
                                <th className="px-3 py-3 border border-slate-700 text-center w-16 action-col">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-arial">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={fields.length + 1} className="text-center py-10 border border-gray-300 text-slate-400 italic">No records found</td>
                                </tr>
                            ) : (
                                filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-yellow-50 transition-colors group align-top">
                                        <td className="px-2 py-3 border border-gray-300 text-center font-bold text-slate-400 select-none bg-slate-50/30">
                                            {idx + 1}
                                        </td>
                                        {fields.filter(f => f.name !== 'sr').map(f => (
                                            <td key={f.name} className="p-0 border border-gray-300 relative-cell min-w-[120px]">
                                                {f.type === 'select' ? (
                                                    <select
                                                        className="w-full p-2 bg-transparent focus:bg-white outline-none cursor-pointer h-full"
                                                        value={row[f.name] ?? ''}
                                                        onChange={(e) => handleInputChange(row.originalIndex, f.name, e.target.value)}
                                                    >
                                                        <option value="">Select...</option>
                                                        {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                ) : f.type === 'textarea' ? (
                                                    <textarea
                                                        className="w-full p-2 bg-transparent focus:bg-white outline-none resize-none font-mono text-[10px]"
                                                        rows={2}
                                                        value={row[f.name] ?? ''}
                                                        onChange={(e) => handleInputChange(row.originalIndex, f.name, e.target.value)}
                                                        placeholder="Enter multiple..."
                                                    />
                                                ) : (
                                                    <input
                                                        type={f.type === 'number' ? 'number' : 'text'}
                                                        className="w-full p-2 bg-transparent focus:bg-white outline-none"
                                                        value={row[f.name] ?? ''}
                                                        onChange={(e) => handleInputChange(row.originalIndex, f.name, e.target.value)}
                                                    />
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-2 py-3 border border-gray-300 bg-white group-hover:bg-yellow-50 transition-colors text-center action-col">
                                            <button className="text-rose-400 hover:text-rose-600 p-1 rounded transition" onClick={() => onDelete(row.originalIndex)}>
                                                <i className="fas fa-trash-alt text-xs"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {onDirectAdd && (
                                <tr className="bg-gray-50/50 hover:bg-blue-50 transition cursor-pointer group no-print">
                                    <td colSpan={fields.length + 1} className="p-0 text-center border-t border-dashed border-gray-300">
                                        <button 
                                            className="w-full py-3 text-blue-600 font-bold hover:text-blue-800 text-[11px] flex items-center justify-center gap-1"
                                            onClick={() => onDirectAdd && onDirectAdd({})}
                                        >
                                            <i className="fas fa-plus-circle"></i> ADD NEW ROW
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GenericTable;
