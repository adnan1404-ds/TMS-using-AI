
import React from 'react';
import { Database } from '../types';

interface DashboardViewProps {
    db: Database;
    onNavigate: (section: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ db, onNavigate }) => {
    // Calculate stats
    const driverCount = (db.drivers || []).length;
    const vehicleCount = (db.vehicles || []).length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = (db.attendance || []).filter(a => a.date === today && a.status === 'P').length;
    const todayReports = (db.daily_reports || []).filter(r => r.date === today).length;
    const jobOrdersCount = (db.job_orders || []).length;

    const cards = [
        { 
            title: 'Daily Reporting', 
            icon: 'fa-clipboard-list', 
            count: todayReports, 
            label: "Today's Movements", 
            section: 'daily_reports', 
            color: 'bg-blue-600',
            textColor: 'text-blue-600'
        },
        { 
            title: 'Drivers', 
            icon: 'fa-id-card', 
            count: driverCount, 
            label: 'Total Drivers', 
            section: 'drivers', 
            color: 'bg-indigo-600',
            textColor: 'text-indigo-600'
        },
        { 
            title: 'Vehicles', 
            icon: 'fa-car', 
            count: vehicleCount, 
            label: 'Fleet Size', 
            section: 'vehicles', 
            color: 'bg-purple-600',
            textColor: 'text-purple-600'
        },
        { 
            title: 'Attendance', 
            icon: 'fa-calendar-check', 
            count: todayAttendance, 
            label: 'Present Today', 
            section: 'attendance', 
            color: 'bg-emerald-600',
            textColor: 'text-emerald-600'
        },
        { 
            title: 'Overtime', 
            icon: 'fa-clock', 
            count: null, 
            label: 'Manage OT', 
            section: 'overtime', 
            color: 'bg-amber-600',
            textColor: 'text-amber-600'
        },
        { 
            title: 'Job Orders', 
            icon: 'fa-wrench', 
            count: jobOrdersCount, 
            label: 'Total Records', 
            section: 'job_orders', 
            color: 'bg-orange-600',
            textColor: 'text-orange-600'
        },
        { 
            title: 'Log Book', 
            icon: 'fa-book-open', 
            count: null, 
            label: 'View Logs', 
            section: 'log_book', 
            color: 'bg-teal-600',
            textColor: 'text-teal-600'
        },
        { 
            title: 'POL (SOI)', 
            icon: 'fa-gas-pump', 
            count: null, 
            label: 'Manage Fuel', 
            section: 'pol_soi_ent', 
            color: 'bg-slate-600',
            textColor: 'text-slate-600'
        },
    ];

    return (
        <div id="view-dashboard" className="content-section">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, index) => (
                    <div 
                        key={index} 
                        onClick={() => onNavigate(card.section)}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1 group relative overflow-hidden"
                    >
                        <div className={`absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity`}>
                            <i className={`fas ${card.icon} fa-6x ${card.textColor}`}></i>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-4 relative z-10">
                            <div className={`${card.color} text-white w-12 h-12 rounded-lg flex items-center justify-center shadow-md`}>
                                <i className={`fas ${card.icon} text-lg`}></i>
                            </div>
                            <h3 className="font-bold text-gray-700 text-lg">{card.title}</h3>
                        </div>
                        
                        <div className="relative z-10">
                            {card.count !== null ? (
                                <div className="text-3xl font-bold text-gray-800 mb-1">{card.count}</div>
                            ) : (
                                <div className="text-xl font-bold text-gray-400 mb-1">View Details</div>
                            )}
                            <div className="text-sm text-gray-500 font-medium uppercase tracking-wide">{card.label}</div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-sm font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                            <span>Open Module</span>
                            <i className="fas fa-arrow-right"></i>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <i className="fas fa-bolt text-amber-500"></i> Quick Shortcuts
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => onNavigate('daily_reports')} className="p-4 bg-blue-50 text-blue-700 rounded-lg text-left hover:bg-blue-100 transition font-medium flex items-center gap-3">
                            <i className="fas fa-plus-circle text-xl"></i> 
                            <div>
                                <div className="text-xs uppercase opacity-70">Create</div>
                                <div>Daily Report</div>
                            </div>
                        </button>
                        <button onClick={() => onNavigate('job_orders')} className="p-4 bg-orange-50 text-orange-700 rounded-lg text-left hover:bg-orange-100 transition font-medium flex items-center gap-3">
                            <i className="fas fa-tools text-xl"></i>
                            <div>
                                <div className="text-xs uppercase opacity-70">Add</div>
                                <div>Job Order</div>
                            </div>
                        </button>
                        <button onClick={() => onNavigate('attendance')} className="p-4 bg-green-50 text-green-700 rounded-lg text-left hover:bg-green-100 transition font-medium flex items-center gap-3">
                            <i className="fas fa-user-check text-xl"></i>
                            <div>
                                <div className="text-xs uppercase opacity-70">Mark</div>
                                <div>Attendance</div>
                            </div>
                        </button>
                        <button onClick={() => onNavigate('pol_soi_ent')} className="p-4 bg-slate-50 text-slate-700 rounded-lg text-left hover:bg-slate-100 transition font-medium flex items-center gap-3">
                            <i className="fas fa-tachometer-alt text-xl"></i>
                            <div>
                                <div className="text-xs uppercase opacity-70">Update</div>
                                <div>Odometer</div>
                            </div>
                        </button>
                    </div>
                </div>
                
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg border border-slate-700 p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <i className="fas fa-chart-line fa-8x text-white"></i>
                    </div>
                    <h4 className="font-bold text-white mb-2 text-lg">System Status</h4>
                    <p className="text-slate-400 text-sm mb-6">Overview of current system statistics.</p>
                    
                    <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-300">Total Fleet</span>
                            <span className="font-bold text-xl">{vehicleCount}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-300">Active Drivers</span>
                            <span className="font-bold text-xl">{driverCount}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                            <span className="text-slate-300">Open Job Orders</span>
                            <span className="font-bold text-xl text-orange-400">{jobOrdersCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
