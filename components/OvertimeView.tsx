import React, { useState, useMemo } from 'react';
import { Database, GenericRecord } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OvertimeViewProps {
    db: Database;
}

const OvertimeView: React.FC<OvertimeViewProps> = ({ db }) => {
    const [search, setSearch] = useState("");
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [generatedDriver, setGeneratedDriver] = useState<GenericRecord | null>(null);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const handleGenerate = () => {
        if (!search) {
            alert("Please select a driver first.");
            return;
        }
        const driver = db.drivers.find(d => 
            (d.name as string) === search
        );
        if (!driver) {
            alert("Driver not found!");
            setGeneratedDriver(null);
            return;
        }
        setGeneratedDriver(driver || null);
    };

    const handlePrint = () => {
        window.print();
    };

    // Calculate data for both rendering and exporting
    const overtimeData = useMemo(() => {
        if (!generatedDriver) return null;
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const entries: any[] = [];
        let totalHrs = 0;
        let totalAmt = 0;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const otRec = db.overtime.find(r => r.date === dateStr && r.driver === generatedDriver.name);
            const attRec = db.attendance.find(r => r.date === dateStr && r.driver === generatedDriver.name);
            const dateObj = new Date(year, month, i);
            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            let hrs = 0, rate = 0, amt = 0, duty = '', veh = '', tFrom = '', tTo = '';

            if (otRec) {
                hrs = Number(otRec.hours) || 0;
                rate = Number(otRec.rate) || 0;
                duty = (otRec.duty as string) || '';
                veh = (otRec.vehicle as string) || '';
                tFrom = (otRec.time_from as string) || '';
                tTo = (otRec.time_to as string) || '';
            } else if (attRec && Number(attRec.ot_hours) > 0) {
                hrs = Number(attRec.ot_hours);
                const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
                rate = isWeekend ? 100 : 80;
                
                veh = (attRec.vehicle_reg as string) || '';
                tFrom = (attRec.ot_start as string) || '';
                tTo = (attRec.ot_end as string) || '';
                duty = (attRec.remarks as string) || ''; 
            }

            if (hrs > 0) {
                amt = hrs * rate;
                totalHrs += hrs;
                totalAmt += amt;
            }

            const dayStr = String(i).padStart(2, '0');
            let historicalDutyType = '';
            if (veh) {
                const logs = (db.vehicle_duty_logs || []).filter(l => l.vehicle_reg === veh);
                const activeLog = logs.find(l => {
                    const from = l.from_date as string;
                    const to = l.to_date as string;
                    if (!from) return false;
                    return dateStr >= from && (!to || dateStr <= to);
                });

                if (activeLog) {
                    historicalDutyType = activeLog.duty_type as string;
                } else {
                    const vehicleInfo = db.vehicles.find(v => v.reg_no === veh);
                    historicalDutyType = vehicleInfo?.duty_type as string || '';
                }
            }

            const combinedDuty = duty && historicalDutyType ? `${duty} (${historicalDutyType})` : (duty || historicalDutyType);

            entries.push({
                date: `${dayStr}-${monthNames[month]}-${year}`,
                day: daysOfWeek[dateObj.getDay()],
                vehicle: veh,
                duty: combinedDuty,
                from: tFrom,
                to: tTo,
                hours: hrs,
                rate: rate,
                amount: amt
            });
        }

        return { entries, totalHrs, totalAmt, fullMonthName: fullMonthNames[month] };
    }, [generatedDriver, db.overtime, db.attendance, db.vehicle_duty_logs, db.vehicles, month, year]);

    const handleExportExcel = () => {
        if (!generatedDriver || !overtimeData) return;

        const headerInfo = [
            ["NATIONAL CENTER FOR PHYSICS"],
            ["Monthly Overtime Claim"],
            [""],
            ["Employee No:", generatedDriver.emp_nmbr, "Account #:", generatedDriver.account_nmbr],
            ["Name:", generatedDriver.name, "Month:", `${overtimeData.fullMonthName} ${year}`],
            ["Designation:", generatedDriver.designation, "Nature:", "Vehicle Duty Claim"],
            [""]
        ];

        const tableHead = ["Date", "Day", "V.Reg #", "Duty", "From", "To", "Total Hrs", "Rate", "Amount"];
        const tableRows = overtimeData.entries.map(e => [
            e.date, e.day, e.vehicle, e.duty, e.from, e.to, e.hours || "", e.rate || "", e.amount || ""
        ]);

        const footerRow = ["", "", "", "Total", "", "", overtimeData.totalHrs, "", overtimeData.totalAmt];

        const fullAoa = [...headerInfo, tableHead, ...tableRows, footerRow];

        const ws = XLSX.utils.aoa_to_sheet(fullAoa);
        
        const wscols = [
            { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "OT_Claim");
        XLSX.writeFile(wb, `OT_Claim_${generatedDriver.name}_${overtimeData.fullMonthName}_${year}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!generatedDriver || !overtimeData) return;

        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("NATIONAL CENTER FOR PHYSICS", pageWidth / 2, 40, { align: 'center' });
        doc.setFontSize(12);
        doc.text("Monthly Overtime Claim", pageWidth / 2, 60, { align: 'center' });

        // Metadata
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const metaY = 85;
        doc.text(`Employee No: ${generatedDriver.emp_nmbr}`, 40, metaY);
        doc.text(`Account #: ${generatedDriver.account_nmbr}`, 300, metaY);
        doc.text(`Name: ${generatedDriver.name}`, 40, metaY + 15);
        doc.text(`Month: ${overtimeData.fullMonthName} ${year}`, 300, metaY + 15);
        doc.text(`Designation: ${generatedDriver.designation}`, 40, metaY + 30);
        doc.text(`Nature: Vehicle Duty Claim`, 300, metaY + 30);

        // Table
        const head = [
            [
                { content: 'Date', rowSpan: 2 },
                { content: 'Day', rowSpan: 2 },
                { content: 'V.Reg #', rowSpan: 2 },
                { content: 'Duty', rowSpan: 2 },
                { content: 'Duty Time', colSpan: 2 },
                { content: 'Total Hrs', rowSpan: 2 },
                { content: 'Rate', rowSpan: 2 },
                { content: 'Amount', rowSpan: 2 }
            ],
            ['From', 'To']
        ];

        const body = overtimeData.entries.map(e => [
            e.date, e.day, e.vehicle, e.duty, e.from, e.to, e.hours || '-', e.rate || '-', e.amount > 0 ? e.amount.toFixed(2) : '-'
        ]);

        // Add Total Row
        body.push([
            { content: 'Total', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: overtimeData.totalHrs.toString(), styles: { fontStyle: 'bold', halign: 'center' } },
            '',
            { content: overtimeData.totalAmt.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }
        ]);

        autoTable(doc, {
            head,
            body,
            startY: 130,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 3, halign: 'center' },
            headStyles: { fillColor: [240, 240, 240], textColor: 0, lineWidth: 0.5 },
            columnStyles: {
                3: { halign: 'left' },
                8: { halign: 'right' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 30;

        // Footer Notes
        doc.setFontSize(8);
        doc.text("I have not claimed / shall not claim TA/DA for above mentioned time period.", 40, finalY);
        doc.text("Overtime is earned by employee for working beyond working hours.", 40, finalY + 12);
        doc.text("The period for which overtime is claimed has been with the initial record and found correct.", 40, finalY + 24);

        // Signatures
        const sigY = finalY + 70;
        doc.line(40, sigY, 140, sigY);
        doc.text("Driver Signature", 40, sigY + 12);

        doc.line(170, sigY, 270, sigY);
        doc.text("Prepared By", 170, sigY + 12);

        doc.line(300, sigY, 420, sigY);
        doc.text("Checked By (Mgr)", 300, sigY + 12);

        doc.line(450, sigY, 550, sigY);
        doc.text("Counter Signature", 450, sigY + 12);

        doc.save(`OT_Claim_${generatedDriver.name}_${overtimeData.fullMonthName}.pdf`);
    };

    return (
        <div id="view-overtime" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                {/* Module Header Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 items-end no-print">
                    <div className="md:col-span-4">
                        <label className="block font-bold mb-1 text-xs uppercase text-slate-500 tracking-wider">Select Driver</label>
                        <div className="flex shadow-sm">
                            <span className="px-3 py-2 bg-slate-50 border border-r-0 border-gray-300 rounded-l text-gray-500 flex items-center justify-center w-10">
                                <i className="fas fa-id-card"></i>
                            </span>
                            <select
                                className="w-full border border-gray-300 rounded-r px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ncp-primary bg-white text-sm font-bold text-slate-700 cursor-pointer"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            >
                                <option value="">-- Choose Driver --</option>
                                {db.drivers.map((d, i) => (
                                    <option key={i} value={d.name as string}>
                                        {d.name} ({d.emp_nmbr})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block font-bold mb-1 text-xs uppercase text-slate-500 tracking-wider">Select Month</label>
                        <select className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ncp-primary bg-white text-sm font-bold text-slate-700 cursor-pointer" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                            {fullMonthNames.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block font-bold mb-1 text-xs uppercase text-slate-500 tracking-wider">Year</label>
                        <input type="number" className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ncp-primary bg-white text-sm font-bold text-slate-700" value={year} onChange={e => setYear(parseInt(e.target.value))} />
                    </div>
                    <div className="md:col-span-3">
                        <button className="w-full bg-ncp-primary text-white font-bold py-2.5 px-4 rounded hover:bg-ncp-dark transition shadow-md uppercase text-xs tracking-widest" onClick={handleGenerate}><i className="fas fa-file-invoice mr-2"></i> Generate Claim</button>
                    </div>
                </div>

                {generatedDriver && overtimeData && (
                    <div id="otSheetContainer">
                        <div className="font-mono border border-black p-6 bg-white mt-5">
                            <div className="text-center mb-5 border-b-2 border-black pb-2">
                                <h4 className="text-xl font-bold">NATIONAL CENTER FOR PHYSICS</h4>
                                <h5 className="text-lg">Monthly Overtime Claim</h5>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-5 text-sm">
                                <div><strong>Employee No:</strong> <span>{generatedDriver.emp_nmbr}</span></div>
                                <div><strong>Account #:</strong> <span>{generatedDriver.account_nmbr}</span></div>
                                <div><strong>Name:</strong> <span>{generatedDriver.name}</span></div>
                                <div><strong>Month:</strong> <span>{overtimeData.fullMonthName} {year}</span></div>
                                <div><strong>Designation:</strong> <span>{generatedDriver.designation}</span></div>
                                <div><strong>Nature:</strong> Vehicle Duty Claim</div>
                            </div>

                            <table className="w-full border-collapse text-xs border border-black">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1" rowSpan={2}>Date</th>
                                        <th className="border border-black p-1" rowSpan={2}>Day</th>
                                        <th className="border border-black p-1" rowSpan={2}>V.Reg #</th>
                                        <th className="border border-black p-1" rowSpan={2}>Duty</th>
                                        <th className="border border-black p-1" colSpan={2}>Duty Time</th>
                                        <th className="border border-black p-1" rowSpan={2}>Total Hrs</th>
                                        <th className="border border-black p-1" rowSpan={2}>Rate</th>
                                        <th className="border border-black p-1" rowSpan={2}>Amount</th>
                                    </tr>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1">From</th>
                                        <th className="border border-black p-1">To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {overtimeData.entries.map((e, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-black p-1 text-center">{e.date}</td>
                                            <td className="border border-black p-1 text-center">{e.day}</td>
                                            <td className="border border-black p-1 text-center font-bold">{e.vehicle}</td>
                                            <td className="border border-black p-1 text-center">{e.duty}</td>
                                            <td className="border border-black p-1 text-center">{e.from}</td>
                                            <td className="border border-black p-1 text-center">{e.to}</td>
                                            <td className="border border-black p-1 text-center">{e.hours || "-"}</td>
                                            <td className="border border-black p-1 text-center">{e.rate || "-"}</td>
                                            <td className="border border-black p-1 text-right">{e.amount > 0 ? e.amount.toFixed(2) : "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold">
                                        <td colSpan={6} className="border border-black p-1 text-right">Total</td>
                                        <td className="border border-black p-1 text-center">{overtimeData.totalHrs}</td>
                                        <td className="border border-black p-1"></td>
                                        <td className="border border-black p-1 text-right">{overtimeData.totalAmt.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <div className="mt-8 text-xs leading-5">
                                <p>I have not claimed / shall not claim TA/DA for above mentioned time period.<br />
                                    Overtime is earned by employee for working beyond working hours.<br />
                                    The period for which overtime is claimed has been with the initial record and found correct.</p>
                            </div>

                            <div className="mt-10 flex justify-between pt-10">
                                <div className="border-t border-black w-48 text-center pt-1 text-xs">Driver Signature</div>
                                <div className="border-t border-black w-48 text-center pt-1 text-xs">Prepared By</div>
                                <div className="border-t border-black w-48 text-center pt-1 text-xs">Checked By (Transport Mgr)</div>
                                <div className="border-t border-black w-48 text-center pt-1 text-xs">Counter Signature</div>
                            </div>
                        </div>
                        
                        {/* Footer Action Buttons */}
                        <div className="flex flex-wrap justify-center gap-4 mt-6 no-print">
                            <button 
                                className="bg-ncp-gold text-ncp-primary font-bold py-2.5 px-6 rounded hover:bg-yellow-400 shadow-lg transition transform active:scale-95 flex items-center gap-2" 
                                onClick={handlePrint}
                                title="Print this claim sheet"
                            >
                                <i className="fas fa-print"></i> Print View
                            </button>
                            <button 
                                className="bg-rose-600 text-white font-bold py-2.5 px-6 rounded hover:bg-rose-700 shadow-lg transition transform active:scale-95 flex items-center gap-2" 
                                onClick={handleExportPDF}
                                title="Export to PDF Document"
                            >
                                <i className="fas fa-file-pdf"></i> Export PDF
                            </button>
                            <button 
                                className="bg-emerald-600 text-white font-bold py-2.5 px-6 rounded hover:bg-emerald-700 shadow-lg transition transform active:scale-95 flex items-center gap-2" 
                                onClick={handleExportExcel}
                                title="Export claim data to Excel"
                            >
                                <i className="fas fa-file-excel"></i> Export Excel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OvertimeView;