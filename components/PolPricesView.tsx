import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import { formatDate } from '../constants';
import DatePicker from './DatePicker';

interface PolPricesViewProps {
    db: Database;
    onAdd: () => void;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
    onRowUpdate: (index: number, updatedRow: GenericRecord) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
    onUpdate?: (updatedDb: Database) => void;
}

const PolPricesView: React.FC<PolPricesViewProps> = ({ db, onAdd, onEdit, onDelete, onRowUpdate, onDirectAdd, onUpdate }) => {
    // Determine default fiscal year based on today (e.g. if today is March 2026, fiscal year is 2025-26, so start is 2025)
    const getDefaultFiscalYear = () => {
        const today = new Date();
        return today.getMonth() < 6 ? today.getFullYear() - 1 : today.getFullYear();
    };

    const [year, setYear] = useState(getDefaultFiscalYear());
    const [activeDateRow, setActiveDateRow] = useState<number | null>(null);

    // Filter data using robust string-based date range
    const filteredData = useMemo(() => {
        const startStr = `${year}-07-01`;
        const endStr = `${year + 1}-06-30`;
        
        return (db.pol_prices || [])
            .map((r, i) => ({...r, originalIndex: i} as GenericRecord & { originalIndex: number }))
            .filter(r => {
                if (!r.date) return false;
                const dStr = String(r.date);
                return dStr >= startStr && dStr <= endStr;
            })
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }, [db.pol_prices, year]);

    const handleInputChange = (originalIndex: number, field: string, value: string) => {
        const updatedRow = { ...db.pol_prices[originalIndex], [field]: value };
        onRowUpdate(originalIndex, updatedRow);
    };

    const handleDateSelect = (date: Date) => {
        if (activeDateRow === null) return;
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        handleInputChange(activeDateRow, 'date', localDate.toISOString().split('T')[0]);
        setActiveDateRow(null);
    };

    const rangeText = `1 Jul ${year} to 30 Jun ${year + 1}`;

    return (
        <div id="view-pol-prices" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[80vh]">
                <div className="flex flex-wrap justify-between items-center mb-6 no-print shrink-0 gap-4">
                    <h5 className="text-xl font-bold text-ncp-primary">POL Prices Management</h5>
                    
                    <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-2">Fiscal Year</label>
                        <button 
                            onClick={() => setYear(y => y - 1)}
                            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                        >
                            <i className="fas fa-chevron-left text-xs text-slate-400"></i>
                        </button>
                        <div className="bg-white border border-slate-300 px-3 py-1.5 rounded text-sm font-bold text-ncp-primary min-w-[100px] text-center">
                            {year} - {year + 1}
                        </div>
                        <button 
                            onClick={() => setYear(y => y + 1)}
                            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
                        >
                            <i className="fas fa-chevron-right text-xs text-slate-400"></i>
                        </button>
                    </div>

                    <button className="bg-ncp-primary text-white py-2 px-4 rounded hover:bg-ncp-dark transition shadow-sm font-bold text-xs" onClick={onAdd}>
                        <i className="fas fa-plus me-2"></i> CUSTOM DATE
                    </button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full border-collapse border-collapse text-sm text-center relative min-w-[800px]">
                        <thead className="bg-white">
                             <tr className="bg-white border-b border-gray-200">
                                <th colSpan={7} className="p-4 text-center">
                                    <div className="text-xl font-bold text-ncp-primary uppercase tracking-wide">POL Price List</div>
                                    <div className="text-sm font-bold text-slate-600 mt-1">Fiscal Year {year} - {year + 1}</div>
                                </th>
                            </tr>
                            <tr className="bg-gray-100 uppercase text-[10px] font-bold text-slate-600 tracking-wider">
                                <th className="border border-gray-300 p-2 bg-white w-32"></th>
                                <th className="border border-gray-300 p-2 bg-slate-50" colSpan={2}>Fuel Cost (Qty)</th>
                                <th className="border border-gray-300 p-2 bg-white w-4"></th>
                                <th className="border border-gray-300 p-2 bg-slate-50" colSpan={2}>Private Rate (50%)</th>
                                <th className="border border-gray-300 p-2 bg-white no-print action-col w-20"></th>
                            </tr>
                            <tr className="bg-slate-800 text-white uppercase text-[10px] font-bold tracking-widest">
                                <th className="border border-slate-600 p-3">Effective Date</th>
                                <th className="border border-slate-600 p-3 w-32">Petrol (L)</th>
                                <th className="border border-slate-600 p-3 w-32">Diesel (L)</th>
                                <th className="border border-slate-600 p-3 bg-white border-y-0"></th>
                                <th className="border border-slate-600 p-3 w-32">Petrol</th>
                                <th className="border border-slate-600 p-3 w-32">Diesel</th>
                                <th className="border border-slate-600 p-3 no-print action-col">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-16 text-slate-400 border border-gray-300 italic">
                                        <i className="fas fa-calendar-times fa-2x mb-3 block opacity-20"></i>
                                        No records found for the period {rangeText}.
                                    </td>
                                </tr>
                            ) : filteredData.map((row, i) => {
                                const petrol = Number(row.petrol || 0);
                                const diesel = Number(row.diesel || 0);
                                const pvtPetrol = petrol * 0.5;
                                const pvtDiesel = diesel * 0.5;
                                
                                return (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-gray-100 last:border-none">
                                        <td className="border border-gray-300 p-0">
                                            <input 
                                                type="text" 
                                                readOnly
                                                className="w-full h-full p-2.5 bg-transparent focus:bg-white focus:outline-none text-center font-bold text-slate-700 cursor-pointer text-xs"
                                                value={formatDate(row.date as string)}
                                                onClick={() => setActiveDateRow(row.originalIndex)}
                                            />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input 
                                                type="number" 
                                                className="w-full h-full p-2.5 bg-transparent focus:bg-white focus:outline-none text-center font-mono text-xs"
                                                value={row.petrol || ''}
                                                onChange={(e) => handleInputChange(row.originalIndex, 'petrol', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="border border-gray-300 p-0">
                                            <input 
                                                type="number" 
                                                className="w-full h-full p-2.5 bg-transparent focus:bg-white focus:outline-none text-center font-mono text-xs"
                                                value={row.diesel || ''}
                                                onChange={(e) => handleInputChange(row.originalIndex, 'diesel', e.target.value)}
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="border-x border-gray-300 p-2 bg-gray-50/50"></td>
                                        <td className="border border-gray-300 p-2 font-bold text-ncp-primary bg-blue-50/20 text-xs">{pvtPetrol.toFixed(2)}</td>
                                        <td className="border border-gray-300 p-2 font-bold text-ncp-primary bg-blue-50/20 text-xs">{pvtDiesel.toFixed(2)}</td>
                                        <td className="border border-gray-300 p-2 no-print action-col bg-white">
                                            <button className="text-rose-400 hover:text-rose-600 transition" onClick={() => onDelete(row.originalIndex)} title="Delete Row"><i className="fas fa-trash-alt text-xs"></i></button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Inline Add Row with Plus Sign */}
                            <tr className="bg-gray-50/50 hover:bg-blue-50 transition cursor-pointer no-print group">
                                <td colSpan={7} className="p-0 text-center border-t border-dashed border-gray-300">
                                    <button 
                                        className="w-full py-2.5 text-blue-600 font-bold hover:text-blue-800 text-[11px] flex items-center justify-center gap-1.5 focus:outline-none"
                                        onClick={() => onDirectAdd({ date: new Date().toISOString().split('T')[0] })}
                                    >
                                        <i className="fas fa-plus-circle text-sm"></i> ADD NEW PRICE DATE
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 text-center no-print">
                    <button className="bg-ncp-gold text-ncp-primary font-bold py-3 px-10 rounded-lg hover:bg-yellow-400 shadow-lg transition-all transform hover:scale-105" onClick={() => window.print()}>
                        <i className="fas fa-print me-2"></i> Print Price Schedule
                    </button>
                </div>
            </div>
            
            {activeDateRow !== null && (
                <DatePicker 
                    isOpen={activeDateRow !== null}
                    onClose={() => setActiveDateRow(null)}
                    selectedDate={db.pol_prices[activeDateRow]?.date ? new Date(db.pol_prices[activeDateRow].date as string) : new Date()}
                    onDateSelect={handleDateSelect}
                />
            )}
        </div>
    );
};

export default PolPricesView;