import React, { useState } from 'react';
import PolMonthlyView from './PolMonthlyView';
import PolReportView from './PolReportView';
import PolExpRsView from './PolExpRsView';
import PolUtilizedView from './PolUtilizedView';
import PolRsView from './PolRsView';
import { Database, GenericRecord } from '../types';

interface PolAnalysisViewProps {
    db: Database;
    onAdd: (section: string) => void;
    onUpdate: (updatedDb: Database, section?: string) => void;
    onDelete: (section: string, index: number) => void;
    onDirectAdd: (section: string, defaultValues: GenericRecord) => void;
}

type TabType = 'summary' | 'soi_qty' | 'soi_rs' | 'gen_qty' | 'gen_rs';

const PolAnalysisView: React.FC<PolAnalysisViewProps> = ({ db, onAdd, onUpdate, onDelete, onDirectAdd }) => {
    const [activeTab, setActiveTab] = useState<TabType>('summary');

    const tabClass = (tab: TabType) => `
        pb-3 px-4 font-bold text-[11px] uppercase tracking-wider border-b-4 transition-all duration-200 whitespace-nowrap
        ${activeTab === tab 
            ? 'border-ncp-primary text-ncp-primary bg-blue-50/20' 
            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'}
    `;

    return (
        <div id="view-pol-analysis" className="content-section">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[85vh] flex flex-col overflow-hidden">
                {/* Headers are now light-themed */}
                <div className="bg-white border-b border-gray-100 px-2 pt-6 flex gap-2 no-print overflow-x-auto scrollbar-hide shadow-sm">
                    <button className={tabClass('summary')} onClick={() => setActiveTab('summary')}>
                        <i className="fas fa-file-contract mr-2 opacity-70"></i> 1. Consolidated Report
                    </button>
                    <button className={tabClass('soi_qty')} onClick={() => setActiveTab('soi_qty')}>
                        <i className="fas fa-gas-pump mr-2 opacity-70"></i> 2. SOI/Ent (Qty)
                    </button>
                    <button className={tabClass('soi_rs')} onClick={() => setActiveTab('soi_rs')}>
                        <i className="fas fa-receipt mr-2 opacity-70"></i> 3. SOI/Ent (Rs)
                    </button>
                    <button className={tabClass('gen_qty')} onClick={() => setActiveTab('gen_qty')}>
                        <i className="fas fa-calendar-check mr-2 opacity-70"></i> 4. Gen/Shift (Qty)
                    </button>
                    <button className={tabClass('gen_rs')} onClick={() => setActiveTab('gen_rs')}>
                        <i className="fas fa-wallet mr-2 opacity-70"></i> 5. Gen/Shift (Rs)
                    </button>
                </div>
                
                <div className="flex-1 bg-slate-50/10">
                    <div className="[&_.content-section]:p-4 [&_.bg-white]:shadow-none [&_.bg-white]:border-none">
                        {activeTab === 'summary' && (
                            <PolReportView db={db} onUpdate={onUpdate} />
                        )}
                        {activeTab === 'soi_qty' && (
                            <PolUtilizedView 
                                db={db} 
                                onAdd={() => onAdd('pol_utilized')} 
                                onUpdate={onUpdate as any} 
                                onDelete={(idx) => onDelete('pol_utilized', idx)}
                                onDirectAdd={(d) => onDirectAdd('pol_utilized', d)}
                            />
                        )}
                        {activeTab === 'soi_rs' && (
                            <PolRsView 
                                db={db} 
                                onAdd={() => onAdd('pol_rs')} 
                                onUpdate={onUpdate as any} 
                                onDelete={(idx) => onDelete('pol_rs', idx)}
                                onDirectAdd={(d) => onDirectAdd('pol_rs', d)}
                            />
                        )}
                        {activeTab === 'gen_qty' && (
                            <PolMonthlyView 
                                db={db} 
                                onAdd={() => onAdd('pol_monthly')} 
                                onUpdate={onUpdate} 
                                onDirectAdd={(d) => onDirectAdd('pol_monthly', d)}
                            />
                        )}
                        {activeTab === 'gen_rs' && (
                            <PolExpRsView 
                                db={db} 
                                onAdd={() => onAdd('pol_exp_rs')} 
                                onUpdate={onUpdate as any} 
                                onDelete={(idx) => onDelete('pol_exp_rs', idx)}
                                onDirectAdd={(d) => onDirectAdd('pol_exp_rs', d)}
                            />
                        )}
                    </div>
                </div>
                
                <div className="bg-slate-50/50 border-t border-gray-100 p-2 text-center no-print">
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">
                        POL Reporting Hub • Sub-Section {activeTab.replace('_', ' ').toUpperCase()} active
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PolAnalysisView;