import React, { useState, useMemo, useEffect } from 'react';
import { Database, GenericRecord, DbSchema } from '../types';
import Modal from './Modal';
import DatePicker from './DatePicker';
import { formatDate } from '../constants';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SchoolDutyViewProps {
    db: Database;
    onUpdate: (updatedDb: Database, section?: string) => void;
    onRowUpdate: (index: number, updatedRow: GenericRecord) => void;
    onDirectAdd: (defaultValues: GenericRecord) => void;
    schema: DbSchema;
}

const SchoolDutyView: React.FC<SchoolDutyViewProps> = ({ db, onUpdate, onRowUpdate, onDirectAdd, schema }) => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [fromDate, setFromDate] = useState(firstDay.toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
    
    const [isFromPickerOpen, setIsFromPickerOpen] = useState(false);
    const [isToPickerOpen, setIsToPickerOpen] = useState(false);
    const [activeDateRow, setActiveDateRow] = useState<number | null>(null);
    
    const [modalConfig, setModalConfig] = useState<{ open: boolean, editIndex: number, initialData: GenericRecord }>({
        open: false, editIndex: -1, initialData: {}
    });

    const getOfficialFullPrice = (dateStr: string, fuelType: string) => {
        if (!db.pol_prices || db.pol_prices.length === 0) return 0;
        if (!dateStr) return 0;

        const targetDate = dateStr.substring(0, 10);
        const sortedPrices = [...db.pol_prices]
            .filter(p => p.date)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        
        const priceRec = sortedPrices.find(p => String(p.date).substring(0, 10) <= targetDate);
        if (!priceRec) return 0;

        return fuelType === 'Diesel' ? Number(priceRec.diesel) : Number(priceRec.petrol);
    };

    // Auto-sync effect: update prices for records within the selected range
    useEffect(() => {
        const list = [...db.daily_reports];
        let hasChanges = false;

        list.forEach((r, i) => {
            if (r.type === 'School Duty' && r.date) {
                const dStr = r.date as string;
                if (dStr >= fromDate && dStr <= toDate) {
                    const veh = db.vehicles.find(v => v.reg_no === r.vehicle_reg);
                    const fuelType = String(veh?.fuel_type || 'Petrol');
                    const officialPrice = getOfficialFullPrice(String(r.date), fuelType);
                    
                    if (officialPrice > 0 && Number(r.fuel_price) !== officialPrice) {
                        const cons = Number(r.liters) || 0;
                        const ovt = Number(r.dvr_ovt) || 0;
                        list[i] = { 
                            ...r, 
                            fuel_price: officialPrice,
                            amount: Math.round((cons * officialPrice) + ovt)
                        };
                        hasChanges = true;
                    }
                }
            }
        });

        if (hasChanges) {
            onUpdate({ ...db, daily_reports: list }, 'daily_reports');
        }
    }, [fromDate, toDate, db.pol_prices]);
    
    const filteredLogs = useMemo(() => {
        return (db.daily_reports || [])
            .map((r, i) => ({ ...r, originalIndex: i } as GenericRecord & { originalIndex: number }))
            .filter(r => {
                if (!r.date || r.type !== 'School Duty') return false;
                const dStr = r.date as string;
                return dStr >= fromDate && dStr <= toDate;
            })
            .sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
    }, [db.daily_reports, fromDate, toDate]);

    const totalAmount = filteredLogs.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalChildren = (db.school_employees || []).reduce((acc, r) => acc + (Number(r.children_count) || 0), 0);
    const ratePerChild = totalChildren > 0 ? (totalAmount / totalChildren) : 0;

    const handleSave = (data: GenericRecord) => {
        const list = [...(db.daily_reports || [])];
        const veh = db.vehicles.find(v => v.reg_no === data.vehicle_reg);
        const fuelType = String(veh?.fuel_type || 'Petrol');
        const price = getOfficialFullPrice(String(data.date), fuelType);

        const mIn = Number(data.meter_in) || 0;
        const mOut = Number(data.meter_out) || 0;
        const avg = Number(data.average) || 1;
        const ovt = Number(data.dvr_ovt) || 0;

        const kms = Math.max(0, mIn - mOut);
        const cons = avg > 0 ? kms / avg : 0;
        const amt = (cons * price) + ovt;

        data.type = 'School Duty';
        data.fuel_price = price;
        data.kms = kms;
        data.liters = parseFloat(cons.toFixed(2));
        data.amount = Math.round(amt);

        if (modalConfig.editIndex >= 0) {
            list[modalConfig.editIndex] = data;
        } else {
            list.push(data);
        }
        onUpdate({ ...db, daily_reports: list }, 'daily_reports');
        setModalConfig({ ...modalConfig, open: false });
    };

    const handleInputChange = (originalIndex: number, field: string, value: string) => {
        const updatedRow = { ...db.daily_reports[originalIndex], [field]: value };
        const veh = db.vehicles.find(v => v.reg_no === updatedRow.vehicle_reg);
        const fuelType = String(veh?.fuel_type || 'Petrol');
        const officialPrice = getOfficialFullPrice(String(updatedRow.date), fuelType);
        updatedRow.fuel_price = officialPrice;

        const mIn = Number(updatedRow.meter_in || 0);
        const mOut = Number(updatedRow.meter_out || 0);
        const avg = Number(updatedRow.average || 1);
        const ovt = Number(updatedRow.dvr_ovt || 0);

        const kms = Math.max(0, mIn - mOut);
        const cons = avg > 0 ? kms / avg : 0;
        const amt = (cons * officialPrice) + ovt;

        updatedRow.kms = kms;
        updatedRow.liters = parseFloat(cons.toFixed(2));
        updatedRow.amount = Math.round(amt);

        const list = [...db.daily_reports];
        list[originalIndex] = updatedRow;
        onUpdate({ ...db, daily_reports: list }, 'daily_reports');
    };

    const handleDelete = (index: number) => {
        if (window.confirm("Are you sure you want to delete this trip?")) {
            const list = [...db.daily_reports];
            list.splice(index, 1);
            onUpdate({ ...db, daily_reports: list }, 'daily_reports');
        }
    };

    const exportToExcel = () => {
        const data = filteredLogs.map(r => ({
            "Date": r.date,
            "Vehicle": r.vehicle_reg,
            "Meter Out": r.meter_out,
            "Meter In": r.meter_in,
            "KMs": r.kms,
            "Avg": r.average,
            "Liters": r.liters,
            "Rate": r.fuel_price,
            "Ovt (Rs)": r.dvr_ovt,
            "Total (Rs)": r.amount,
            "Remarks": r.remarks
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SchoolDutyReport");
        const dateSuffix = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
        XLSX.writeFile(wb, `School_Duty_Report_${dateSuffix}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(14);
        doc.text("School Duty Report", 14, 15);
        doc.setFontSize(10);
        const dateHeader = fromDate === toDate ? `Date: ${formatDate(fromDate)}` : `From: ${formatDate(fromDate)} To: ${formatDate(toDate)}`;
        doc.text(dateHeader, 14, 22);

        const head = [['Sr', 'Date', 'Reg No', 'Mtr Out', 'Mtr In', 'KMs', 'Avg', 'Liters', 'Rate', 'Ovt', 'Amount', 'Remarks']];
        const body = filteredLogs.map((r, i) => [
            i + 1,
            formatDate(r.date as string),
            r.vehicle_reg,
            r.meter_out,
            r.meter_in,
            r.kms,
            r.average,
            r.liters,
            r.fuel_price,
            r.dvr_ovt || 0,
            Math.round(Number(r.amount)).toLocaleString(),
            r.remarks || ''
        ]);
        body.push(['', '', 'TOTAL', '', '', '', '', '', '', '', totalAmount.toLocaleString(), '']);

        autoTable(doc, { head, body, startY: 30, styles: { fontSize: 8 }, headStyles: { fillColor: [31, 41, 55] as [number, number, number] } });
        doc.save(`School_Duty_Report_${fromDate}.pdf`);
    };

    const getLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    return (
        <div id="view-school-duty" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[80vh]">
                <div className="flex flex-wrap justify-between items-center mb-4 no-print bg-slate-50 p-4 rounded-lg border border-slate-200 gap-4">
                    <div className="flex flex-col">
                        <h5 className="text-xl font-bold text-ncp-primary">School Duty Record</h5>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsFromPickerOpen(true)} className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold hover:border-ncp-primary transition shadow-sm flex items-center gap-2">
                                <i className="fas fa-calendar-alt text-amber-500"></i> {formatDate(fromDate)}
                            </button>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">to</span>
                            <button onClick={() => setIsToPickerOpen(true)} className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold hover:border-ncp-primary transition shadow-sm flex items-center gap-2">
                                <i className="fas fa-calendar-alt text-amber-500"></i> {formatDate(toDate)}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={exportToExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm text-xs font-bold">
                                <i className="fas fa-file-excel mr-1"></i> EXCEL
                            </button>
                            <button onClick={handleExportPDF} className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition shadow-sm text-xs font-bold">
                                <i className="fas fa-file-pdf mr-1"></i> PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-inner bg-slate-50/50">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead className="bg-slate-800 text-white font-bold uppercase tracking-widest text-[9px]">
                            <tr>
                                <th className="p-3 border border-slate-700 w-10">Sr</th>
                                <th className="p-3 border border-slate-700 w-24">Date</th>
                                <th className="p-3 border border-slate-700 min-w-[100px]">Reg No</th>
                                <th className="p-3 border border-slate-700 w-16">Mtr Out</th>
                                <th className="p-3 border border-slate-700 w-16">Mtr In</th>
                                <th className="p-3 border border-slate-700 w-16">KMs</th>
                                <th className="p-3 border border-slate-700 w-16">Avg</th>
                                <th className="p-3 border border-slate-700 w-16">Cons (L)</th>
                                <th className="p-3 border border-slate-700 w-24 bg-slate-900">Rate (POL)</th>
                                <th className="p-3 border border-slate-700 w-16">Ovt (Rs)</th>
                                <th className="p-3 border border-slate-700 w-24 bg-slate-900 text-blue-400">Amount (Rs)</th>
                                <th className="p-3 border border-slate-700">Remarks</th>
                                <th className="p-3 border border-slate-700 w-12 action-col">Act</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {filteredLogs.length === 0 ? (
                                <tr><td colSpan={13} className="p-12 text-slate-400 italic">No school duty records found for the selected range.</td></tr>
                            ) : (
                                filteredLogs.map((r, i) => (
                                    <tr key={i} className="hover:bg-yellow-50 transition-colors border-b border-gray-100 text-[11px]">
                                        <td className="p-1 border border-gray-300 text-slate-500 font-bold">{i + 1}</td>
                                        <td className="p-0 border border-gray-300">
                                            <input 
                                                readOnly
                                                className="w-full p-1 text-center bg-transparent focus:bg-white outline-none cursor-pointer font-medium"
                                                value={formatDate(r.date as string)}
                                                onClick={() => setActiveDateRow(r.originalIndex)}
                                            />
                                        </td>
                                        <td className="p-0 border border-gray-300">
                                            <input className="w-full p-1 text-center bg-transparent focus:bg-white outline-none font-bold text-blue-700 uppercase" value={r.vehicle_reg} onChange={e => handleInputChange(r.originalIndex, 'vehicle_reg', e.target.value)} />
                                        </td>
                                        <td className="p-0 border border-gray-300">
                                            <input className="w-full p-1 text-center bg-transparent focus:bg-white outline-none font-mono" type="number" value={r.meter_out} onChange={e => handleInputChange(r.originalIndex, 'meter_out', e.target.value)} />
                                        </td>
                                        <td className="p-0 border border-gray-300">
                                            <input className="w-full p-1 text-center bg-transparent focus:bg-white outline-none font-mono" type="number" value={r.meter_in} onChange={e => handleInputChange(r.originalIndex, 'meter_in', e.target.value)} />
                                        </td>
                                        <td className="p-1 border border-gray-300 font-bold text-blue-600 bg-blue-50/10">{r.kms}</td>
                                        <td className="p-0 border border-gray-300">
                                            <input className="w-full p-1 text-center bg-transparent focus:bg-white outline-none font-bold text-slate-600" type="number" value={r.average} onChange={e => handleInputChange(r.originalIndex, 'average', e.target.value)} />
                                        </td>
                                        <td className="p-1 border border-gray-300 font-bold text-amber-700 bg-amber-50/10">{r.liters}</td>
                                        <td className="p-1 border border-gray-300 font-bold text-blue-800 bg-blue-50/30">
                                            {r.fuel_price || '0.00'}
                                        </td>
                                        <td className="p-0 border border-gray-300">
                                            <input className="w-full p-1 text-center bg-transparent focus:bg-white outline-none" type="number" value={r.dvr_ovt} onChange={e => handleInputChange(r.originalIndex, 'dvr_ovt', e.target.value)} />
                                        </td>
                                        <td className="p-1 border border-gray-300 font-bold text-ncp-primary bg-blue-50/50">
                                            {Math.round(Number(r.amount)).toLocaleString()}
                                        </td>
                                        <td className="p-0 border border-gray-300">
                                            <input className="w-full p-1 text-left bg-transparent focus:bg-white outline-none italic text-[10px]" value={r.remarks} onChange={e => handleInputChange(r.originalIndex, 'remarks', e.target.value)} placeholder="..." />
                                        </td>
                                        <td className="p-1 border border-gray-300 action-col">
                                            <button className="text-red-400 hover:text-red-700 p-1" onClick={() => handleDelete(r.originalIndex)}><i className="fas fa-trash-alt"></i></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                      </table>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
                      <div className="text-center mb-6 border-b-2 border-gray-300 pb-2">
                          <h4 className="text-xl font-bold underline uppercase text-ncp-primary">Bill Distribution Summary</h4>
                          <h5 className="text-lg font-bold text-slate-600">
                              {fromDate === toDate ? `Date: ${formatDate(fromDate)}` : `Range: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
                          </h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Trip Expense</div>
                              <div className="text-2xl font-black text-slate-800">Rs. {Math.round(totalAmount).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <div className="text-xs font-bold text-slate-400 uppercase mb-1">Total Registered Children</div>
                              <div className="text-2xl font-black text-slate-800">{totalChildren}</div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                              <div className="text-xs font-bold text-blue-400 uppercase mb-1">Calculated Rate / Child</div>
                              <div className="text-2xl font-black text-ncp-primary">Rs. {ratePerChild.toFixed(2)}</div>
                          </div>
                      </div>

                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse border border-gray-200">
                              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px]">
                                  <tr>
                                      <th className="p-3 border border-gray-200">Organization</th>
                                      <th className="p-3 border border-gray-200 text-center">Child Count</th>
                                      <th className="p-3 border border-gray-200 text-right">Billed Amount (Rs)</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {["NCP", "KRL", "School Facility"].map(org => {
                                      const count = (db.school_employees || [])
                                          .filter(e => e.org === org)
                                          .reduce((acc, e) => acc + (Number(e.children_count) || 0), 0);
                                      const billed = count * ratePerChild;
                                      return (
                                          <tr key={org} className="hover:bg-gray-50">
                                              <td className="p-3 border border-gray-200 font-bold">{org}</td>
                                              <td className="p-3 border border-gray-200 text-center font-mono">{count}</td>
                                              <td className="p-3 border border-gray-200 text-right font-black text-slate-700">
                                                  {Math.round(billed).toLocaleString()}
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div className="mt-8 text-center no-print">
                      <button 
                          className="bg-ncp-gold text-ncp-primary font-bold py-3 px-10 rounded-lg hover:bg-yellow-400 shadow-lg transition-all transform hover:scale-105" 
                          onClick={() => window.print()}
                      >
                          <i className="fas fa-print me-2"></i> Print Bill Statement
                      </button>
                  </div>
              </div>

              {activeDateRow !== null && (
                <DatePicker 
                    isOpen={activeDateRow !== null} 
                    onClose={() => setActiveDateRow(null)} 
                    selectedDate={new Date(db.daily_reports[activeDateRow].date as string)}
                    onDateSelect={(d) => {
                        handleInputChange(activeDateRow, 'date', getLocalISOString(d));
                        setActiveDateRow(null);
                    }}
                />
            )}
          </div>
    );
};

export default SchoolDutyView;