
import React, { useState } from 'react';
import { DbSchema, FieldSchema } from '../types';
import { DB_KEYS } from '../types';

interface SettingsViewProps {
    schema: DbSchema;
    onUpdateSchema: (newSchema: DbSchema) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ schema, onUpdateSchema }) => {
    const [selectedSection, setSelectedSection] = useState<string>(Object.keys(schema)[0] || '');
    
    // Field Editing State
    const [editingField, setEditingField] = useState<Partial<FieldSchema>>({ type: 'text' });
    const [isEditMode, setIsEditMode] = useState(false); // true if editing existing field, false if adding new
    
    // Table Creation State
    const [newTableName, setNewTableName] = useState('');
    const [newTableTitle, setNewTableTitle] = useState('');
    const [isCreatingTable, setIsCreatingTable] = useState(false);

    const [showJson, setShowJson] = useState(false);

    const currentFields = schema[selectedSection]?.fields || [];
    const isSystemTable = DB_KEYS.includes(selectedSection);

    const handleSaveField = () => {
        if (!editingField.name || !editingField.label || !selectedSection) {
            alert("Please provide Name and Label");
            return;
        }

        const safeName = editingField.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        if (!isEditMode && currentFields.find(f => f.name === safeName)) {
            alert("Field with this name already exists");
            return;
        }

        const fieldObject: FieldSchema = {
            name: safeName,
            label: editingField.label,
            type: editingField.type as any || 'text',
            required: !!editingField.required,
            options: editingField.type === 'select' && typeof editingField.options === 'string' 
                ? (editingField.options as string).split(',').map((s: string) => s.trim()) 
                : editingField.options
        };

        let updatedFields = [...currentFields];
        
        if (isEditMode) {
            // Update existing
            updatedFields = updatedFields.map(f => f.name === editingField.name ? fieldObject : f);
        } else {
            // Add new
            updatedFields.push(fieldObject);
        }

        const updatedSchema = {
            ...schema,
            [selectedSection]: {
                ...schema[selectedSection],
                fields: updatedFields
            }
        };

        onUpdateSchema(updatedSchema);
        resetFieldForm();
    };

    const handleEditClick = (field: FieldSchema) => {
        setEditingField({
            ...field,
            // Convert array options to string for input
            options: field.options ? field.options.join(', ') : undefined
        } as any);
        setIsEditMode(true);
    };

    const handleDeleteField = (fieldName: string) => {
        if (!window.confirm(`Are you sure you want to delete field "${fieldName}"? Data might be hidden.`)) return;
        
        const updatedSchema = {
            ...schema,
            [selectedSection]: {
                ...schema[selectedSection],
                fields: currentFields.filter(f => f.name !== fieldName)
            }
        };
        onUpdateSchema(updatedSchema);
    };

    const handleMoveField = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === currentFields.length - 1) return;

        const newFields = [...currentFields];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];

        const updatedSchema = {
            ...schema,
            [selectedSection]: {
                ...schema[selectedSection],
                fields: newFields
            }
        };
        onUpdateSchema(updatedSchema);
    };

    const handleCreateTable = () => {
        if (!newTableName || !newTableTitle) {
            alert("Please provide Table Name and Title");
            return;
        }
        const safeKey = newTableName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        if (schema[safeKey]) {
            alert("Table already exists!");
            return;
        }

        const updatedSchema = {
            ...schema,
            [safeKey]: {
                title: newTableTitle,
                fields: [
                    { name: 'sr', label: 'Sr', type: 'number', required: true }
                ] as FieldSchema[]
            }
        };
        onUpdateSchema(updatedSchema);
        setSelectedSection(safeKey);
        setIsCreatingTable(false);
        setNewTableName('');
        setNewTableTitle('');
    };

    const handleDeleteTable = () => {
        if (isSystemTable) {
            alert("Cannot delete system tables.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete table "${schema[selectedSection].title}"? This cannot be undone.`)) return;

        const updatedSchema = { ...schema };
        delete updatedSchema[selectedSection];
        
        onUpdateSchema(updatedSchema);
        setSelectedSection(Object.keys(updatedSchema)[0] || '');
    };

    const resetFieldForm = () => {
        setEditingField({ type: 'text', name: '', label: '', options: undefined, required: false });
        setIsEditMode(false);
    };

    return (
        <div id="view-settings" className="content-section">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[80vh]">
                <div className="mb-8 border-b border-gray-100 pb-4 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-ncp-primary">System Settings</h2>
                        <p className="text-slate-500 text-sm">Customize tables, columns, and system configuration.</p>
                    </div>
                    <button 
                        onClick={() => setIsCreatingTable(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-green-700 transition"
                    >
                        <i className="fas fa-plus-circle mr-2"></i> New Table
                    </button>
                </div>

                {isCreatingTable && (
                    <div className="mb-8 bg-green-50 p-6 rounded-xl border border-green-100 animate-fade-in">
                        <h4 className="font-bold text-green-800 mb-4">Create New Data Table</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Table Title (Display Name)</label>
                                <input className="w-full border border-gray-300 rounded px-3 py-2" value={newTableTitle} onChange={e => setNewTableTitle(e.target.value)} placeholder="e.g. Visitor Logs" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Database Key (Internal ID)</label>
                                <input className="w-full border border-gray-300 rounded px-3 py-2 font-mono" value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="e.g. visitor_logs" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsCreatingTable(false)} className="text-slate-500 hover:text-slate-700 px-4 py-2 font-medium">Cancel</button>
                            <button onClick={handleCreateTable} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">Create Table</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sidebar / Section Selector */}
                    <div className="lg:col-span-1 border-r border-gray-100 pr-6">
                        <h4 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-wider">Select Table</h4>
                        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
                            {Object.keys(schema).map(key => (
                                <button
                                    key={key}
                                    onClick={() => { setSelectedSection(key); resetFieldForm(); }}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex justify-between items-center ${
                                        selectedSection === key 
                                        ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div>
                                        {schema[key].title}
                                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5 font-mono">{key}</span>
                                    </div>
                                    {!DB_KEYS.includes(key) && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Custom</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content / Field Editor */}
                    <div className="lg:col-span-2">
                        {selectedSection && schema[selectedSection] && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {schema[selectedSection].title}
                                        </h3>
                                        {!isSystemTable && (
                                            <button onClick={handleDeleteTable} className="text-red-400 hover:text-red-600 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                                                <i className="fas fa-trash mr-1"></i> Delete Table
                                            </button>
                                        )}
                                    </div>
                                    <button onClick={() => setShowJson(!showJson)} className="text-xs text-blue-500 hover:underline">
                                        {showJson ? 'Hide JSON' : 'Show Schema JSON'}
                                    </button>
                                </div>

                                {showJson && (
                                    <div className="mb-6 p-4 bg-slate-900 text-slate-300 rounded-lg text-xs font-mono overflow-auto max-h-60">
                                        <pre>{JSON.stringify(schema[selectedSection], null, 2)}</pre>
                                    </div>
                                )}

                                {/* Existing Fields List */}
                                <div className="bg-slate-50 rounded-lg border border-gray-200 overflow-hidden mb-8">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white border-b border-gray-200 text-slate-500 font-bold uppercase text-xs">
                                            <tr>
                                                <th className="p-3 pl-4 w-10">#</th>
                                                <th className="p-3">Label</th>
                                                <th className="p-3">Key</th>
                                                <th className="p-3">Type</th>
                                                <th className="p-3 text-center">Req</th>
                                                <th className="p-3 text-right pr-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {currentFields.map((field, idx) => (
                                                <tr key={idx} className="hover:bg-white transition-colors group">
                                                    <td className="p-3 pl-4 text-slate-400 text-xs">{idx + 1}</td>
                                                    <td className="p-3 font-medium text-slate-700">{field.label}</td>
                                                    <td className="p-3 font-mono text-xs text-slate-500">{field.name}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                                                            {field.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {field.required && <i className="fas fa-check text-green-500"></i>}
                                                    </td>
                                                    <td className="p-3 text-right pr-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => handleMoveField(idx, 'up')} className="text-slate-400 hover:text-blue-500 disabled:opacity-30" disabled={idx === 0}><i className="fas fa-arrow-up"></i></button>
                                                            <button onClick={() => handleMoveField(idx, 'down')} className="text-slate-400 hover:text-blue-500 disabled:opacity-30" disabled={idx === currentFields.length - 1}><i className="fas fa-arrow-down"></i></button>
                                                            <button onClick={() => handleEditClick(field)} className="text-blue-400 hover:text-blue-600"><i className="fas fa-pencil"></i></button>
                                                            <button onClick={() => handleDeleteField(field.name)} className="text-red-400 hover:text-red-600"><i className="fas fa-trash"></i></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Edit/Add Field Form */}
                                <div className={`rounded-xl p-6 border ${isEditMode ? 'bg-blue-50/50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <h4 className={`font-bold mb-4 flex items-center gap-2 ${isEditMode ? 'text-blue-800' : 'text-slate-700'}`}>
                                        {isEditMode ? <><i className="fas fa-edit"></i> Edit Column</> : <><i className="fas fa-plus-circle"></i> Add New Column</>}
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Column Label</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-ncp-primary outline-none"
                                                placeholder="e.g. Driver Phone"
                                                value={editingField.label || ''}
                                                onChange={e => setEditingField({ ...editingField, label: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Database Name (Unique)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-ncp-primary outline-none font-mono"
                                                placeholder="e.g. driver_phone"
                                                value={editingField.name || ''}
                                                onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                                                disabled={isEditMode} // Prevent ID change on edit
                                                title={isEditMode ? "Cannot change ID of existing field" : ""}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Type</label>
                                            <select 
                                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-ncp-primary outline-none bg-white"
                                                value={editingField.type}
                                                onChange={e => setEditingField({ ...editingField, type: e.target.value as any })}
                                            >
                                                <option value="text">Text</option>
                                                <option value="number">Number</option>
                                                <option value="date">Date</option>
                                                <option value="time">Time</option>
                                                <option value="select">Select Dropdown</option>
                                                <option value="textarea">Text Area</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center pt-6">
                                            <label className="flex items-center cursor-pointer gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 text-ncp-primary rounded"
                                                    checked={!!editingField.required}
                                                    onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
                                                />
                                                <span className="text-sm font-medium text-slate-700">Required Field</span>
                                            </label>
                                        </div>
                                        {editingField.type === 'select' && (
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Options (Comma separated)</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-ncp-primary outline-none"
                                                    placeholder="Option 1, Option 2, Option 3"
                                                    value={editingField.options as any || ''}
                                                    onChange={e => setEditingField({ ...editingField, options: e.target.value as any })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        {isEditMode && (
                                            <button onClick={resetFieldForm} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded">Cancel</button>
                                        )}
                                        <button 
                                            onClick={handleSaveField}
                                            className={`py-2 px-6 rounded-lg font-bold text-white shadow-sm transition ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                                        >
                                            {isEditMode ? 'Update Column' : 'Add Column'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
