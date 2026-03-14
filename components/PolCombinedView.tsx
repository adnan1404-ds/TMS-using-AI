
import React, { useState } from 'react';
import PolUtilizedView from './PolUtilizedView';
import PolRsView from './PolRsView';
import { Database, GenericRecord } from '../types';

interface PolCombinedViewProps {
    db: Database;
    onAdd: (section: string) => void;
    onUpdate: (updatedDb: Database) => void;
    onDelete: (section: string, index: number) => void;
    onRowUpdate: (section: string, index: number, row: GenericRecord) => void;
    onDirectAdd: (section: string, defaultValues: GenericRecord) => void;
}

const PolCombinedView: React.FC<PolCombinedViewProps> = ({ db, onAdd, onUpdate, onDelete, onRowUpdate, onDirectAdd }) => {
    const [activeTab, setActiveTab] = useState<'utilized' | 'exp'>('utilized');

    return (
        <div id="view-pol-combined" className="content-section">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[80vh] flex flex-col">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-200 px-6 pt-6 gap-6 no-print">
                    <button
                        className={`pb-3 px-2 font-bold text-sm uppercase tracking-wide border-b-4 transition-all duration-200 ${
                            activeTab === 'utilized' 
                            ? 'border-ncp-primary text-ncp-primary' 
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                        }`}
                        onClick={() => setActiveTab('utilized')}
                    >
                        <i className="fas fa-gas-pump mr-2"></i> POL Utilized (Ltrs)
                    </button>
                    <button
                        className={`pb-3 px-2 font-bold text-sm uppercase tracking-wide border-b-4 transition-all duration-200 ${
                            activeTab === 'exp' 
                            ? 'border-ncp-primary text-ncp-primary' 
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
                        }`}
                        onClick={() => setActiveTab('exp')}
                    >
                        <i className="fas fa-receipt mr-2"></i> POL Expenditure (Rs)
                    </button>
                </div>
                
                {/* Content Area - Removing the internal padding/shadow of children to fit seamlessly */}
                <div className="p-2 bg-slate-50/50 flex-1">
                    {activeTab === 'utilized' ? (
                        <div className="[&_.content-section]:p-0 [&_.bg-white]:shadow-none [&_.bg-white]:border-none">
                            <PolUtilizedView 
                                db={db} 
                                onAdd={() => onAdd('pol_utilized')} 
                                onUpdate={onUpdate} 
                                onDelete={(idx) => onDelete('pol_utilized', idx)}
                                onDirectAdd={(d) => onDirectAdd('pol_utilized', d)}
                            />
                        </div>
                    ) : (
                        <div className="[&_.content-section]:p-0 [&_.bg-white]:shadow-none [&_.bg-white]:border-none">
                            <PolRsView 
                                db={db} 
                                onAdd={() => onAdd('pol_rs')} 
                                onUpdate={onUpdate} 
                                onDelete={(idx) => onDelete('pol_rs', idx)}
                                onDirectAdd={(d) => onDirectAdd('pol_rs', d)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PolCombinedView;
