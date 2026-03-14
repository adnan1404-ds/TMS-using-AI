
import React, { useState, useEffect, useCallback } from 'react';
import { SCHEMA, DEMO_DATA } from './constants';
import { Database, GenericRecord, DB_KEYS, DbSchema } from './types';
import AttendanceView from './components/AttendanceView';
import OvertimeView from './components/OvertimeView';
import LogBookView from './components/LogBookView';
import PolStateView from './components/PolStateView';
import RoutesView from './components/RoutesView';
import DailyReportsView from './components/DailyReportsView';
import SchoolDutyView from './components/SchoolDutyView';
import PolPricesView from './components/PolPricesView';
import GenericTable from './components/GenericTable';
import JobOrdersView from './components/JobOrdersView';
import SpdReportingView from './components/SpdReportingView';
import PolSoiEntView from './components/PolSoiEntView';
import ReportingSummaryView from './components/ReportingSummaryView';
import PrivateUseView from './components/PrivateUseView';
import VehicleDutyLogsView from './components/VehicleDutyLogsView';
import DriverDutyLogsView from './components/DriverDutyLogsView';
import PolAnalysisView from './components/PolAnalysisView';
import SettingsView from './components/SettingsView';
import DashboardView from './components/DashboardView';
import Modal from './components/Modal';

const API_URL = '/api';
const LOCAL_STORAGE_KEY = 'ncp_transport_db';
const SECTION_STORAGE_KEY = 'ncp_active_section';

function App() {
    const [db, setDb] = useState<Database>({ ...DEMO_DATA });
    const [appSchema, setAppSchema] = useState<DbSchema>(SCHEMA);
    const [currentSection, setCurrentSection] = useState<string>(localStorage.getItem(SECTION_STORAGE_KEY) || 'dashboard');
    const [targetSection, setTargetSection] = useState<string>('daily_reports');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState(-1);
    const [currentDate, setCurrentDate] = useState("");
    const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');
    const [tempInitialData, setTempInitialData] = useState<GenericRecord>({});
    const [vehiclesViewMode, setVehiclesViewMode] = useState<'list' | 'history'>('list');
    const [driversViewMode, setDriversViewMode] = useState<'list' | 'history'>('list');

    useEffect(() => {
        setTargetSection(currentSection);
        localStorage.setItem(SECTION_STORAGE_KEY, currentSection);
    }, [currentSection]);

    useEffect(() => {
        const loadData = async () => {
            let dataLoaded = false;
            try {
                const res = await fetch(`${API_URL}/db`);
                if (res.ok) {
                    const serverData = await res.json();
                    if (serverData.app_schema && serverData.app_schema.length > 0) {
                        try {
                            const serverSchema = JSON.parse(serverData.app_schema[0].config);
                            setAppSchema(serverSchema);
                        } catch (e) {}
                    }
                    if (Object.keys(serverData).some(key => Array.isArray(serverData[key]) && serverData[key].length > 0)) {
                        setDb(prev => ({ ...prev, ...serverData }));
                        setServerStatus('online');
                        dataLoaded = true;
                    }
                }
            } catch (error) {
                setServerStatus('offline');
            }
            if (!dataLoaded) {
                const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (localData) {
                    try { setDb(JSON.parse(localData)); } catch (e) {}
                }
            }
            setCurrentDate(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        };
        loadData();
    }, []);

    const persistData = useCallback(async (newDb: Database, sectionToSync?: string) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newDb));
        if (!sectionToSync) return;
        const isValidKey = DB_KEYS.includes(sectionToSync) || sectionToSync === 'app_schema';
        if (!isValidKey) return;
        try {
            const response = await fetch(`${API_URL}/save/${sectionToSync}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDb[sectionToSync] || [])
            });
            setServerStatus(response.ok ? 'online' : 'offline');
        } catch (error) {
            setServerStatus('offline');
        }
    }, []);

    const handleUpdateDb = (newDb: Database, sectionOverride?: string) => {
        setDb(newDb);
        const section = sectionOverride || targetSection;
        persistData(newDb, section);
    };

    const handleRowUpdate = (index: number, updatedRow: GenericRecord, sectionOverride?: string) => {
        const section = sectionOverride || targetSection;
        const oldRow = db[section][index];
        const list = [...(db[section] || [])];
        list[index] = updatedRow;
        
        let newDb = { ...db, [section]: list };

        // Auto-Log Duty Changes for Vehicles
        if (section === 'vehicles' && oldRow.duty_type !== updatedRow.duty_type) {
            const history = [...(db.vehicle_duty_logs || [])];
            const lastLogIdx = history.findIndex(l => l.vehicle_reg === updatedRow.reg_no && !l.to_date);
            const todayStr = new Date().toISOString().split('T')[0];
            if (lastLogIdx >= 0) {
                history[lastLogIdx] = { ...history[lastLogIdx], to_date: todayStr };
            }
            history.push({
                vehicle_reg: updatedRow.reg_no,
                duty_type: updatedRow.duty_type,
                from_date: todayStr,
                remarks: `Changed from ${oldRow.duty_type}`
            });
            newDb.vehicle_duty_logs = history;
            persistData(newDb, 'vehicle_duty_logs');
        }

        // Auto-Log Duty Changes for Drivers
        if (section === 'drivers' && oldRow.duty_type !== updatedRow.duty_type) {
            const history = [...(db.driver_duty_logs || [])];
            const lastLogIdx = history.findIndex(l => l.driver_name === updatedRow.name && !l.to_date);
            const todayStr = new Date().toISOString().split('T')[0];
            if (lastLogIdx >= 0) {
                history[lastLogIdx] = { ...history[lastLogIdx], to_date: todayStr };
            }
            history.push({
                driver_name: updatedRow.name,
                duty_type: updatedRow.duty_type,
                from_date: todayStr,
                remarks: `Changed from ${oldRow.duty_type}`
            });
            newDb.driver_duty_logs = history;
            persistData(newDb, 'driver_duty_logs');
        }

        setDb(newDb);
        persistData(newDb, section);
    };

    const handleDelete = (index: number, sectionOverride?: string) => {
        if (window.confirm('Delete this record permanently?')) {
            const section = sectionOverride || targetSection;
            const updatedList = [...(db[section] || [])];
            updatedList.splice(index, 1);
            const newDb = { ...db, [section]: updatedList };
            setDb(newDb);
            persistData(newDb, section);
        }
    };

    const handleSaveRecord = (formData: GenericRecord) => {
        const section = targetSection;
        const updatedList = [...(db[section] || [])];
        if (editIndex === -1) {
            if (appSchema[section]?.fields.some(f => f.name === 'sr')) {
                const maxSr = updatedList.reduce((max, item) => Math.max(max, Number(item.sr) || 0), 0);
                formData.sr = maxSr + 1;
            }
            updatedList.push(formData);
        } else {
            updatedList[editIndex] = formData;
        }
        const newDb = { ...db, [section]: updatedList };
        setDb(newDb);
        persistData(newDb, section);
        setModalOpen(false);
    };

    const openAddModal = (section: string, initialData: GenericRecord = {}) => {
        setTargetSection(section);
        setEditIndex(-1);
        setTempInitialData(initialData);
        setModalOpen(true);
    };

    const navigateTo = (section: string) => {
        setCurrentSection(section);
        setIsSidebarOpen(false);
    };

    const renderContent = () => {
        switch (currentSection) {
            case 'dashboard': return <DashboardView db={db} onNavigate={navigateTo} />;
            case 'daily_reports': return <DailyReportsView db={db} onAdd={() => openAddModal('daily_reports')} onEdit={setEditIndex} onDelete={handleDelete} onRowUpdate={handleRowUpdate} onDirectAdd={(d) => { const l = [...db.daily_reports, d]; handleUpdateDb({...db, daily_reports: l}, 'daily_reports'); }} schema={appSchema} />;
            case 'reporting_summary': return <ReportingSummaryView db={db} />;
            case 'private_use': return <PrivateUseView db={db} onUpdate={handleUpdateDb} />;
            case 'pol_prices': return <PolPricesView db={db} onAdd={() => openAddModal('pol_prices')} onEdit={setEditIndex} onDelete={handleDelete} onRowUpdate={handleRowUpdate} onDirectAdd={(d) => { const l = [...db.pol_prices, d]; handleUpdateDb({...db, pol_prices: l}, 'pol_prices'); }} />;
            case 'school_duty': return <SchoolDutyView db={db} onUpdate={handleUpdateDb} onRowUpdate={handleRowUpdate} onDirectAdd={(d) => { const l = [...db.daily_reports, {...d, type: 'School Duty'}]; handleUpdateDb({...db, daily_reports: l}, 'daily_reports'); }} schema={appSchema} />;
            case 'drivers': 
                return (
                    <div className="flex flex-col h-full space-y-4">
                        <div className="flex border-b border-gray-200 bg-white px-6 pt-4 rounded-xl shadow-sm gap-6 no-print">
                            <button className={`pb-3 px-2 font-bold text-sm uppercase border-b-4 transition-all ${driversViewMode === 'list' ? 'border-ncp-primary text-ncp-primary' : 'border-transparent text-slate-400'}`} onClick={() => setDriversViewMode('list')}><i className="fas fa-users mr-2"></i> Driver List</button>
                            <button className={`pb-3 px-2 font-bold text-sm uppercase border-b-4 transition-all ${driversViewMode === 'history' ? 'border-ncp-primary text-ncp-primary' : 'border-transparent text-slate-400'}`} onClick={() => setDriversViewMode('history')}><i className="fas fa-history mr-2"></i> Duty History</button>
                        </div>
                        {driversViewMode === 'list' ? <GenericTable data={db.drivers} fields={appSchema.drivers.fields} title="Driver Database" onAdd={() => openAddModal('drivers')} onEdit={setEditIndex} onRowUpdate={(idx, row) => handleRowUpdate(idx, row, 'drivers')} onDelete={(idx) => handleDelete(idx, 'drivers')} onDirectAdd={(d) => { const l = [...db.drivers, d]; handleUpdateDb({...db, drivers: l}, 'drivers'); }} /> : <DriverDutyLogsView db={db} onDelete={(idx) => handleDelete(idx, 'driver_duty_logs')} onRowUpdate={(idx, row) => handleRowUpdate(idx, row, 'driver_duty_logs')} />}
                    </div>
                );
            case 'vehicles':
                return (
                    <div className="flex flex-col h-full space-y-4">
                        <div className="flex border-b border-gray-200 bg-white px-6 pt-4 rounded-xl shadow-sm gap-6 no-print">
                            <button className={`pb-3 px-2 font-bold text-sm uppercase border-b-4 transition-all ${vehiclesViewMode === 'list' ? 'border-ncp-primary text-ncp-primary' : 'border-transparent text-slate-400'}`} onClick={() => setVehiclesViewMode('list')}><i className="fas fa-car mr-2"></i> Fleet List</button>
                            <button className={`pb-3 px-2 font-bold text-sm uppercase border-b-4 transition-all ${vehiclesViewMode === 'history' ? 'border-ncp-primary text-ncp-primary' : 'border-transparent text-slate-400'}`} onClick={() => setVehiclesViewMode('history')}><i className="fas fa-history mr-2"></i> Duty History</button>
                        </div>
                        {vehiclesViewMode === 'list' ? <GenericTable data={db.vehicles} fields={appSchema.vehicles.fields} title="Vehicle Fleet" onAdd={() => openAddModal('vehicles')} onEdit={setEditIndex} onRowUpdate={(idx, row) => handleRowUpdate(idx, row, 'vehicles')} onDelete={(idx) => handleDelete(idx, 'vehicles')} onDirectAdd={(d) => { const l = [...db.vehicles, d]; handleUpdateDb({...db, vehicles: l}, 'vehicles'); }} /> : <VehicleDutyLogsView db={db} onDelete={(idx) => handleDelete(idx, 'vehicle_duty_logs')} onRowUpdate={(idx, row) => handleRowUpdate(idx, row, 'vehicle_duty_logs')} />}
                    </div>
                );
            case 'attendance': return <AttendanceView db={db} onUpdate={(newDb) => handleUpdateDb(newDb, 'attendance')} />;
            case 'overtime': return <OvertimeView db={db} />;
            case 'job_orders': return <JobOrdersView db={db} onAdd={() => openAddModal('job_orders')} onEdit={setEditIndex} onDelete={(idx) => handleDelete(idx, 'job_orders')} onRowUpdate={(idx, row) => handleRowUpdate(idx, row, 'job_orders')} onDirectAdd={(d) => { const l = [...db.job_orders, d]; handleUpdateDb({...db, job_orders: l}, 'job_orders'); }} />;
            case 'spd_reporting': return <SpdReportingView db={db} onAdd={(data) => openAddModal('spd_reporting', data)} onEdit={setEditIndex} onDelete={handleDelete} onRowUpdate={handleRowUpdate} onDirectAdd={(d) => { const l = [...db.spd_reporting, d]; handleUpdateDb({...db, spd_reporting: l}, 'spd_reporting'); }} />;
            case 'log_book': return <LogBookView db={db} onAdd={() => openAddModal('log_book')} onDelete={(idx) => handleDelete(idx, 'log_book')} onRowUpdate={(idx, row) => handleRowUpdate(idx, row, 'log_book')} onDirectAdd={(d) => { const l = [...db.log_book, d]; handleUpdateDb({...db, log_book: l}, 'log_book'); }} />;
            case 'pol_analysis': return <PolAnalysisView db={db} onAdd={(s) => openAddModal(s)} onUpdate={handleUpdateDb} onDelete={(s, i) => handleDelete(i, s)} onDirectAdd={(s, d) => { const l = [...db[s], d]; handleUpdateDb({...db, [s]: l}, s); }} />;
            case 'pol_soi_ent': return <PolSoiEntView db={db} onUpdate={handleUpdateDb} />;
            case 'pol_state': return <PolStateView db={db} onAdd={() => openAddModal('pol_state')} onUpdate={(newDb) => handleUpdateDb(newDb, 'pol_state')} onDirectAdd={(d) => { const l = [...db.pol_state, d]; handleUpdateDb({...db, pol_state: l}, 'pol_state'); }} />;
            case 'routes': return <RoutesView db={db} onUpdate={handleUpdateDb} schema={appSchema} />;
            case 'settings': return <SettingsView schema={appSchema} onUpdateSchema={(s) => { setAppSchema(s); persistData({...db, app_schema: [{config: JSON.stringify(s)}]}, 'app_schema'); }} />;
            default: return <div className="p-10 text-center text-slate-400">Select a module from the sidebar.</div>;
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-100 font-arial">
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden no-print" onClick={() => setIsSidebarOpen(false)}></div>}
            <nav className={`sidebar fixed top-0 left-0 h-full w-[260px] bg-[#0f172a] text-slate-400 transition-all z-50 shadow-2xl border-r border-slate-900 sidebar-scroll overflow-y-auto transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 no-print`}>
                <div className="p-6 text-center mb-2 bg-[#0f172a] sticky top-0 z-10 border-b border-slate-800">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden p-1">
                        <img src="https://api.dicebear.com/7.x/shapes/svg?seed=NCPTransport" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h3 className="text-md font-bold tracking-tight text-white uppercase">NCP TRANSPORT</h3>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mt-1">Management System</p>
                </div>
                <ul className="pb-10 pr-4 space-y-0.5 mt-2">
                    <li><a onClick={() => navigateTo('dashboard')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'dashboard' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-th-large w-6 text-center mr-2"></i> Dashboard</a></li>
                    <li className="px-6 pt-4 pb-1 text-[10px] uppercase text-slate-600 font-bold tracking-widest">Operations</li>
                    <li><a onClick={() => navigateTo('daily_reports')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'daily_reports' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-clipboard-list w-6 text-center mr-2"></i> Daily Reporting</a></li>
                    <li><a onClick={() => navigateTo('reporting_summary')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'reporting_summary' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-chart-pie w-6 text-center mr-2"></i> Official Summary</a></li>
                    <li><a onClick={() => navigateTo('private_use')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'private_use' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-user-tag w-6 text-center mr-2"></i> Private Use</a></li>
                    <li><a onClick={() => navigateTo('pol_prices')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'pol_prices' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-tags w-6 text-center mr-2"></i> POL Prices</a></li>
                    <li><a onClick={() => navigateTo('school_duty')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'school_duty' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-bus w-6 text-center mr-2"></i> School Duty</a></li>
                    <li className="px-6 pt-4 pb-1 text-[10px] uppercase text-slate-600 font-bold tracking-widest">Fleet & Staff</li>
                    <li><a onClick={() => navigateTo('drivers')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'drivers' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-id-card w-6 text-center mr-2"></i> Driver Database</a></li>
                    <li><a onClick={() => navigateTo('vehicles')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'vehicles' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-car w-6 text-center mr-2"></i> Vehicle Fleet</a></li>
                    <li><a onClick={() => navigateTo('attendance')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'attendance' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-calendar-check w-6 text-center mr-2"></i> Attendance</a></li>
                    <li><a onClick={() => navigateTo('overtime')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'overtime' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-clock w-6 text-center mr-2"></i> Overtime Claims</a></li>
                    <li className="px-6 pt-4 pb-1 text-[10px] uppercase text-slate-600 font-bold tracking-widest">Maintenance</li>
                    <li><a onClick={() => navigateTo('job_orders')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'job_orders' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-wrench w-6 text-center mr-2"></i> Job Orders</a></li>
                    <li><a onClick={() => navigateTo('spd_reporting')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'spd_reporting' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-file-medical-alt w-6 text-center mr-2"></i> SPD Reporting</a></li>
                    <li><a onClick={() => navigateTo('log_book')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'log_book' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-book-open w-6 text-center mr-2"></i> Vehicle Log Book</a></li>
                    <li className="px-6 pt-4 pb-1 text-[10px] uppercase text-slate-600 font-bold tracking-widest">Fuel Management</li>
                    <li><a onClick={() => navigateTo('pol_analysis')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'pol_analysis' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-chart-line w-6 text-center mr-2"></i> POL Analysis Center</a></li>
                    <li><a onClick={() => navigateTo('pol_soi_ent')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'pol_soi_ent' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-tint w-6 text-center mr-2"></i> Daily POL (SOI)</a></li>
                    <li><a onClick={() => navigateTo('pol_state')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'pol_state' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-balance-scale w-6 text-center mr-2"></i> POL State</a></li>
                    <li className="px-6 pt-4 pb-1 text-[10px] uppercase text-slate-600 font-bold tracking-widest">Navigation</li>
                    <li><a onClick={() => navigateTo('routes')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'routes' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-route w-6 text-center mr-2"></i> Route Mgt</a></li>
                    <li className="px-6 pt-4 pb-1 text-[10px] uppercase text-slate-600 font-bold tracking-widest">System</li>
                    <li><a onClick={() => navigateTo('settings')} className={`flex items-center px-4 py-2.5 transition-all rounded-r-full mb-0.5 cursor-pointer text-[13px] font-medium border-l-4 ${currentSection === 'settings' ? 'bg-slate-800 text-white border-blue-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}><i className="fas fa-cog w-6 text-center mr-2"></i> Settings</a></li>
                </ul>
            </nav>
            <main className="main-content flex-1 md:ml-[260px] p-6 transition-all duration-300 overflow-y-auto min-h-screen bg-slate-100">
                <div className="top-bar bg-white px-6 py-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center mb-6 no-print">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 border border-slate-200 rounded text-slate-500" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><i className="fas fa-bars"></i></button>
                        <div><h2 className="text-xl font-bold text-slate-800 m-0 leading-tight uppercase tracking-tight">{currentSection.replace(/_/g, ' ')}</h2><small className="text-slate-400 font-medium text-xs uppercase tracking-wider">{currentDate}</small></div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full border shadow-sm uppercase flex items-center gap-2 ${serverStatus === 'online' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                            <span className={`w-2 h-2 rounded-full animate-pulse ${serverStatus === 'online' ? 'bg-blue-600' : 'bg-rose-600'}`}></span>
                            System {serverStatus === 'online' ? 'Active' : 'Offline'}
                        </span>
                        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm transition-all" onClick={() => window.print()}><i className="fas fa-print me-2 text-slate-400"></i> PRINT</button>
                    </div>
                </div>
                {renderContent()}
            </main>
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={appSchema[targetSection] ? (editIndex >= 0 ? `Edit ${appSchema[targetSection].title}` : `Add to ${appSchema[targetSection].title}`) : ''} fields={appSchema[targetSection]?.fields.filter(f => f.name !== 'sr') || []} initialData={editIndex >= 0 ? db[targetSection][editIndex] : tempInitialData} onSave={handleSaveRecord} />
        </div>
    );
}
export default App;
