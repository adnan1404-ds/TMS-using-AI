
import React, { useState, useMemo } from 'react';
import { Database, GenericRecord, DbSchema } from '../types';
import Modal from './Modal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '../constants';

interface RoutesViewProps {
    db: Database;
    onUpdate: (updatedDb: Database, sectionOverride?: string) => void;
    schema: DbSchema;
}

const RoutesView: React.FC<RoutesViewProps> = ({ db, onUpdate, schema }) => {
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
    const [selectedRoute, setSelectedRoute] = useState<GenericRecord | null>(null);
    const [modalConfig, setModalConfig] = useState<{ open: boolean, type: 'route' | 'passenger', editIndex: number, initialData: GenericRecord }>({
        open: false, type: 'route', editIndex: -1, initialData: {}
    });

    // Extract Drivers and Vehicles for Dropdowns
    const driverOptions = useMemo(() => (db.drivers || []).map(d => d.name as string).filter(Boolean), [db.drivers]);
    const vehicleOptions = useMemo(() => (db.vehicles || []).map(v => v.reg_no as string).filter(Boolean), [db.vehicles]);

    // Customize Fields for Route Modal
    const routeFields = useMemo(() => {
        return schema.routes.fields.map(f => {
            if (f.name === 'driver_name') {
                return { ...f, type: 'select' as const, options: driverOptions };
            }
            if (f.name === 'vehicle_commander') {
                return { ...f, label: 'Vehicle Commander', type: 'select' as const, options: driverOptions };
            }
            if (f.name === 'vehicle_type') {
                return { ...f, label: 'Select Vehicle', type: 'select' as const, options: vehicleOptions };
            }
            return f;
        });
    }, [schema.routes.fields, driverOptions, vehicleOptions]);

    const handleModalDataChange = (name: string, value: string | number, currentData: GenericRecord): GenericRecord => {
        if (name === 'driver_name') {
            const drv = db.drivers.find(d => d.name === value);
            if (drv) {
                currentData.driver_id = drv.emp_nmbr;
                currentData.driver_contact = drv.contact;
            }
        }
        if (name === 'vehicle_commander') {
            const drv = db.drivers.find(d => d.name === value);
            if (drv) {
                currentData.commander_contact = drv.contact;
            }
        }
        return currentData;
    };

    const handleSaveRoute = (data: GenericRecord) => {
        const routes = [...(db.routes || [])];
        if (data.vehicle_type) {
            const veh = db.vehicles.find(v => v.reg_no === data.vehicle_reg);
            if (veh && !String(data.vehicle_type).includes('(')) {
                data.vehicle_type = `${veh.make_type} (${veh.reg_no})`;
            }
        }
        if (modalConfig.editIndex >= 0) {
            routes[modalConfig.editIndex] = data;
        } else {
            routes.push(data);
        }
        onUpdate({ ...db, routes }, 'routes');
        setModalConfig({ ...modalConfig, open: false });
        if (viewMode === 'detail' && selectedRoute && modalConfig.editIndex >= 0) {
            setSelectedRoute(data);
        }
    };

    const handlePassengerCellChange = (globalIndex: number, field: string, value: string) => {
        const passengers = [...(db.route_passengers || [])];
        passengers[globalIndex] = { ...passengers[globalIndex], [field]: value };
        onUpdate({ ...db, route_passengers: passengers }, 'route_passengers');
    };

    const addNewPassenger = () => {
        if (!selectedRoute) return;
        const passengers = [...(db.route_passengers || [])];
        const routeId = selectedRoute.id as string;
        const currentRoutePassengers = passengers.filter(p => p.route_id === routeId);
        const nextSr = currentRoutePassengers.length + 1;
        
        // Ensure all passenger columns are initialized for DB persistence
        passengers.push({
            route_id: routeId,
            sr: nextSr,
            emp_name: '',
            designation: '',
            address: '',
            pick_drop: '',
            remarks: ''
        });
        onUpdate({ ...db, route_passengers: passengers }, 'route_passengers');
    };

    const deleteRoute = (index: number) => {
        if (window.confirm("Delete this route and all its associated passengers from the database?")) {
            const routes = [...db.routes];
            const routeId = routes[index].id;
            routes.splice(index, 1);
            const passengers = (db.route_passengers || []).filter(p => p.route_id !== routeId);
            onUpdate({ ...db, routes, route_passengers: passengers }, 'routes');
            onUpdate({ ...db, routes, route_passengers: passengers }, 'route_passengers');
        }
    };

    const deletePassenger = (globalIndex: number) => {
        if (window.confirm("Remove this passenger from the database?")) {
            const passengers = [...(db.route_passengers || [])];
            passengers.splice(globalIndex, 1);
            onUpdate({ ...db, route_passengers: passengers }, 'route_passengers');
        }
    };

    const openRouteModal = (index: number = -1) => {
        setModalConfig({
            open: true,
            type: 'route',
            editIndex: index,
            initialData: index >= 0 ? db.routes[index] : {}
        });
    };

    const getGlobalPassengerIndex = (routeId: string, localIndex: number) => {
        let count = 0;
        const all = (db.route_passengers || []);
        for (let i = 0; i < all.length; i++) {
            if (all[i].route_id === routeId) {
                if (count === localIndex) return i;
                count++;
            }
        }
        return -1;
    };

    const filteredPassengers = selectedRoute ? (db.route_passengers || []).filter(p => p.route_id === selectedRoute.id) : [];

    const handleExportExcel = () => {
        if (!selectedRoute) return;
        const wb = XLSX.utils.book_new();
        const aoaData = [
            ["NATIONAL CENTER FOR PHYSICS"],
            [`Route Name: ${selectedRoute.name}`, "", `Route ID: ${selectedRoute.id}`, "", `Total Commuters: ${selectedRoute.total_commuters}`],
            ["", "", "", "", ""],
            ["Driver Details", "", "", "Commander Details", ""],
            [`Driver: ${selectedRoute.driver_name}`, `ID: ${selectedRoute.driver_id}`, "", `Commander: ${selectedRoute.vehicle_commander}`, ""],
            [`Contact: ${selectedRoute.driver_contact}`, `Vehicle: ${selectedRoute.vehicle_type}`, "", `Contact: ${selectedRoute.commander_contact}`, ""],
            [`Path: ${selectedRoute.route_path}`, "", "", "", ""],
            ["", "", "", "", ""],
            ["Sr", "Employee Name", "Designation", "Address", "Pick/Drop Point", "Remarks"]
        ];
        filteredPassengers.forEach((p, i) => {
            aoaData.push([String(p.sr || i + 1), String(p.emp_name || ""), String(p.designation || ""), String(p.address || ""), String(p.pick_drop || ""), String(p.remarks || "")]);
        });
        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        XLSX.utils.book_append_sheet(wb, ws, "Route Details");
        XLSX.writeFile(wb, `Route_${selectedRoute.id}_Details.xlsx`);
    };

    const handleExportPDF = () => {
        if (!selectedRoute) return;
        const doc = new jsPDF('landscape');
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text(`NCP TRANSPORT - ${selectedRoute.name} (${selectedRoute.id})`, 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Description: ${selectedRoute.desc || 'N/A'}`, 14, 22);
        doc.text(`Total Commuters: ${selectedRoute.total_commuters || '0'}`, 250, 22, { align: 'right' });
        autoTable(doc, {
            startY: 28,
            head: [['Driver Info', 'ID / Vehicle', 'Commander Info', 'Contact Info']],
            body: [[`Name: ${selectedRoute.driver_name || 'N/A'}`, `ID: ${selectedRoute.driver_id || 'N/A'}\nVeh: ${selectedRoute.vehicle_type || 'N/A'}`, `Name: ${selectedRoute.vehicle_commander || 'N/A'}`, `Dvr Tel: ${selectedRoute.driver_contact || 'N/A'}\nCmd Tel: ${selectedRoute.commander_contact || 'N/A'}`]],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50] }
        });
        doc.text(`Route Path: ${selectedRoute.route_path || 'N/A'}`, 14, (doc as any).lastAutoTable.finalY + 8);
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 15,
            head: [['Sr', 'Employee Name', 'Designation', 'Address', 'Pick/Drop Point', 'Remarks']],
            body: filteredPassengers.map((p, i) => [p.sr || i + 1, p.emp_name || '', p.designation || '', p.address || '', p.pick_drop || '', p.remarks || '']),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [37, 99, 235] }
        });
        doc.save(`Route_${selectedRoute.id}_Report.pdf`);
    };

    if (viewMode === 'detail' && selectedRoute) {
        return (
            <div id="view-route-detail" className="content-section">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
                    <div className="flex justify-between items-center mb-6 no-print">
                        <button className="text-gray-600 hover:text-ncp-primary font-bold flex items-center gap-2 transition-colors" onClick={() => setViewMode('list')}>
                            <i className="fas fa-arrow-left"></i> Back to Routes
                        </button>
                        <div className="flex gap-2">
                             <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700 transition text-xs font-bold flex items-center gap-2" onClick={handleExportExcel}>
                                 <i className="fas fa-file-excel"></i> EXCEL
                             </button>
                             <button className="bg-rose-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-rose-700 transition text-xs font-bold flex items-center gap-2" onClick={handleExportPDF}>
                                 <i className="fas fa-file-pdf"></i> PDF
                             </button>
                             <button className="bg-white text-slate-600 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm text-xs font-bold flex items-center gap-2" onClick={() => window.print()}>
                                 <i className="fas fa-print"></i> PRINT
                             </button>
                             <button className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 transition text-xs font-bold flex items-center gap-2" onClick={() => {
                                 const idx = db.routes.findIndex(r => r.id === selectedRoute.id);
                                 openRouteModal(idx);
                             }}><i className="fas fa-edit"></i> EDIT HEADER</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-black rounded shadow-inner scrollbar-thin">
                        <table className="w-full border-collapse text-[13px] min-w-[900px]">
                            <tbody>
                                <tr className="border-b border-black">
                                    <td className="p-3 border-r border-black font-bold w-12 bg-gray-50 print:bg-gray-100"></td>
                                    <td className="p-3 border-r border-black font-bold text-center bg-gray-50 print:bg-gray-100 text-lg uppercase tracking-tight" colSpan={6}>
                                        {selectedRoute.name} - {selectedRoute.desc} 
                                        <span className="ml-4 px-3 py-1 bg-white border border-black rounded-full font-bold text-sm tracking-widest text-ncp-primary">COMMUTERS: {selectedRoute.total_commuters}</span>
                                    </td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-3 border-r border-black font-bold bg-gray-50 print:bg-gray-100"></td>
                                    <td className="p-3 border-r border-black font-bold w-32">Driver</td>
                                    <td className="p-3 border-r border-black text-center font-bold text-slate-700">{selectedRoute.driver_name}</td>
                                    <td className="p-3 border-r border-black text-center font-bold bg-gray-50 print:bg-gray-100 text-blue-600">{selectedRoute.driver_id}</td>
                                    <td className="p-3 border-r border-black font-bold w-44">Vehicle Commander</td>
                                    <td className="p-3 border-r border-black text-center font-bold text-slate-700">{selectedRoute.vehicle_commander}</td>
                                    <td className="p-3 border-r border-black text-center font-black text-emerald-600">{filteredPassengers.length}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-3 border-r border-black font-bold bg-gray-50 print:bg-gray-100"></td>
                                    <td className="p-3 border-r border-black font-bold">Contact</td>
                                    <td className="p-3 border-r border-black text-center">{selectedRoute.driver_contact}</td>
                                    <td className="p-3 border-r border-black text-center font-bold bg-gray-50 print:bg-gray-100 text-slate-600 uppercase">{selectedRoute.vehicle_type}</td>
                                    <td className="p-3 border-r border-black font-bold">Contact No</td>
                                    <td className="p-3 border-r border-black text-center">{selectedRoute.commander_contact}</td>
                                    <td className="p-3 border-r border-black"></td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-3 border-r border-black font-bold bg-gray-50 print:bg-gray-100"></td>
                                    <td className="p-3 border-r border-black font-bold text-center">Path</td>
                                    <td className="p-4 border-r border-black text-left whitespace-pre-wrap leading-relaxed text-slate-600" colSpan={5}>
                                        <i className="fas fa-route mr-2 opacity-30"></i>{selectedRoute.route_path}
                                    </td>
                                </tr>
                                <tr className="border-b border-black bg-slate-800 text-white font-bold text-center uppercase text-[11px] tracking-widest">
                                    <td className="p-3 border-r border-slate-600 w-12 no-print"></td>
                                    <td className="p-3 border-r border-slate-600 w-16 text-center">Sr</td>
                                    <td className="p-3 border-r border-slate-600 min-w-[200px]">Employee Name</td>
                                    <td className="p-3 border-r border-slate-600 min-w-[150px]">Designation & SPS</td>
                                    <td className="p-3 border-r border-slate-600 min-w-[200px]">Address</td>
                                    <td className="p-3 border-r border-slate-600 min-w-[150px]">Pick/ Drop Point</td>
                                    <td className="p-3 border-r border-slate-600 min-w-[150px]">Remarks</td>
                                </tr>
                                {filteredPassengers.map((p, i) => {
                                    const globalIdx = getGlobalPassengerIndex(selectedRoute.id as string, i);
                                    return (
                                        <tr key={i} className="border-b border-black group transition-colors hover:bg-slate-50/50">
                                            <td className="p-1 border-r border-black text-center no-print bg-slate-50/30">
                                                <button className="text-slate-300 hover:text-rose-600 transition-all p-2 rounded-full hover:bg-rose-50" onClick={() => deletePassenger(globalIdx)} title="Delete row">
                                                    <i className="fas fa-trash-alt text-xs"></i>
                                                </button>
                                            </td>
                                            <td className="p-0 border-r border-black text-center bg-gray-50/10">
                                                <input className="w-full bg-transparent p-3 text-center outline-none font-bold text-slate-400" value={p.sr || ''} onChange={e => handlePassengerCellChange(globalIdx, 'sr', e.target.value)} />
                                            </td>
                                            <td className="p-0 border-r border-black">
                                                <input className="w-full bg-transparent p-3 outline-none font-bold text-slate-800 focus:bg-white focus:shadow-inner transition-all" value={p.emp_name || ''} placeholder="Type Name..." onChange={e => handlePassengerCellChange(globalIdx, 'emp_name', e.target.value)} />
                                            </td>
                                            <td className="p-0 border-r border-black">
                                                <input className="w-full bg-transparent p-3 outline-none focus:bg-white text-center font-medium text-slate-600" value={p.designation || ''} placeholder="Desig..." onChange={e => handlePassengerCellChange(globalIdx, 'designation', e.target.value)} />
                                            </td>
                                            <td className="p-0 border-r border-black">
                                                <input className="w-full bg-transparent p-3 outline-none focus:bg-white text-slate-600" value={p.address || ''} placeholder="House / St..." onChange={e => handlePassengerCellChange(globalIdx, 'address', e.target.value)} />
                                            </td>
                                            <td className="p-0 border-r border-black">
                                                <input className="w-full bg-transparent p-3 outline-none focus:bg-white text-center text-slate-800 font-bold" value={p.pick_drop || ''} placeholder="Stop..." onChange={e => handlePassengerCellChange(globalIdx, 'pick_drop', e.target.value)} />
                                            </td>
                                            <td className="p-0 border-r border-black">
                                                <input className="w-full bg-transparent p-3 outline-none focus:bg-white italic text-slate-500" value={p.remarks || ''} placeholder="..." onChange={e => handlePassengerCellChange(globalIdx, 'remarks', e.target.value)} />
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-b border-black h-12 no-print group">
                                    <td className="p-1 border-r border-black text-center bg-slate-50/20"></td>
                                    <td colSpan={6} className="p-0">
                                        <button 
                                            onClick={addNewPassenger}
                                            className="w-full h-full flex items-center justify-center gap-3 text-blue-600 font-bold hover:bg-blue-600 hover:text-white transition-all duration-300 text-xs tracking-[0.2em] uppercase"
                                        >
                                            <i className="fas fa-plus-circle text-base"></i> ADD NEW PASSENGER ROW
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <Modal 
                    isOpen={modalConfig.open && modalConfig.type === 'route'}
                    onClose={() => setModalConfig({ ...modalConfig, open: false })}
                    title={modalConfig.editIndex >= 0 ? "Edit Route Info" : "Create New Route"}
                    fields={routeFields}
                    initialData={modalConfig.initialData}
                    onSave={handleSaveRoute}
                    onDataChange={handleModalDataChange}
                />
            </div>
        );
    }

    return (
        <div id="view-routes-list" className="content-section">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h5 className="text-2xl font-black text-ncp-primary uppercase tracking-tight">Fleet Routes</h5>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Management of Staff Transport Network</p>
                    </div>
                    <button className="bg-ncp-primary text-white py-3 px-6 rounded-lg shadow-lg hover:bg-ncp-dark hover:-translate-y-0.5 transition-all duration-200 font-bold text-xs uppercase tracking-widest flex items-center gap-2" onClick={() => openRouteModal(-1)}>
                        <i className="fas fa-plus"></i> NEW ROUTE
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(db.routes || []).map((route, i) => (
                        <div key={i} className="bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-ncp-primary hover:shadow-xl transition-all duration-300 cursor-pointer relative group flex flex-col" onClick={() => { setSelectedRoute(route); setViewMode('detail'); }}>
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <button className="text-rose-500 hover:text-rose-700 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg border border-rose-100" onClick={(e) => { e.stopPropagation(); deleteRoute(i); }}>
                                    <i className="fas fa-trash-alt text-xs"></i>
                                </button>
                            </div>
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-ncp-primary font-black text-lg">
                                    {route.id}
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                    <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider border border-emerald-100">Active</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight line-clamp-1">{route.name}</h3>
                            <p className="text-sm text-slate-500 mb-6 font-medium line-clamp-2 min-h-[40px] italic">{route.desc}</p>
                            <div className="space-y-3 mb-6 flex-grow">
                                <div className="flex items-center gap-3 text-slate-600 p-2 bg-slate-50 rounded-lg">
                                    <i className="fas fa-user-circle w-5 text-blue-500"></i> 
                                    <span className="text-xs font-bold">{route.driver_name || 'Unassigned'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600 p-2 bg-slate-50 rounded-lg">
                                    <i className="fas fa-bus-alt w-5 text-amber-500"></i> 
                                    <span className="text-xs font-bold">{route.vehicle_type || 'Unassigned'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600 p-2 bg-slate-50 rounded-lg">
                                    <i className="fas fa-users w-5 text-emerald-500"></i> 
                                    <span className="text-xs font-bold">{(db.route_passengers || []).filter(p => p.route_id === route.id).length} Active Commuters</span>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-center text-ncp-primary font-black text-[11px] uppercase tracking-[0.2em] group-hover:gap-4 transition-all">
                                Open Details <i className="fas fa-chevron-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             <Modal 
                isOpen={modalConfig.open && modalConfig.type === 'route'}
                onClose={() => setModalConfig({ ...modalConfig, open: false })}
                title={modalConfig.editIndex >= 0 ? "Edit Route Header" : "Create New Route"}
                fields={routeFields}
                initialData={modalConfig.initialData}
                onSave={handleSaveRoute}
                onDataChange={handleModalDataChange}
            />
        </div>
    );
};

export default RoutesView;
