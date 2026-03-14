import React, { useEffect, useState } from 'react';
import { FieldSchema, GenericRecord } from '../types';
import DatePicker from './DatePicker';
import { formatDate } from '../constants';

interface ModalProps {
    title: string;
    fields: FieldSchema[];
    initialData?: GenericRecord;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: GenericRecord) => void;
    onDataChange?: (name: string, value: string | number, currentData: GenericRecord) => GenericRecord;
}

const Modal: React.FC<ModalProps> = ({ title, fields, initialData, isOpen, onClose, onSave, onDataChange }) => {
    const [formData, setFormData] = useState<GenericRecord>({});
    const [activeDateField, setActiveDateField] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || {});
        }
    }, [isOpen, initialData]);

    const handleChange = (name: string, value: string | number) => {
        let newData = { ...formData, [name]: value };
        if (onDataChange) {
            newData = onDataChange(name, value, newData);
        }
        setFormData(newData);
    };

    const handleDateSelect = (date: Date) => {
        if (activeDateField) {
            // Adjust for timezone offset to ensure ISO string matches local date selection
            const offset = date.getTimezoneOffset();
            const localDate = new Date(date.getTime() - (offset * 60 * 1000));
            const dateStr = localDate.toISOString().split('T')[0];
            
            handleChange(activeDateField, dateStr);
            setActiveDateField(null);
        }
    };

    const getDateObject = (val: string | number | undefined) => {
        if (!val) return new Date();
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = val.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        return new Date(val as string);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-3xl shadow-2xl transform transition-all">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white rounded-t-lg">
                    <h5 className="text-xl font-bold text-ncp-primary">{title}</h5>
                    <button type="button" className="text-gray-400 hover:text-gray-600 focus:outline-none" onClick={onClose}>
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map((field) => (
                            <div key={field.name} className={field.type === 'textarea' ? 'col-span-1 md:col-span-2' : 'col-span-1'}>
                                <label className="block text-sm font-medium text-gray-600 mb-1">{field.label}</label>
                                {field.type === 'select' ? (
                                    <select
                                        className="mt-1 block w-full py-2 px-3 border border-gray-200 bg-white rounded-md shadow-sm focus:outline-none focus:ring-ncp-primary focus:border-ncp-primary sm:text-sm"
                                        value={formData[field.name] ?? ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        rows={3}
                                        className="mt-1 block w-full py-2 px-3 border border-gray-200 bg-white rounded-md shadow-sm focus:outline-none focus:ring-ncp-primary focus:border-ncp-primary sm:text-sm"
                                        value={formData[field.name] ?? ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                    />
                                ) : field.type === 'date' ? (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="mt-1 block w-full py-2 pl-3 pr-10 border border-gray-200 bg-white rounded-md shadow-sm focus:outline-none focus:ring-ncp-primary focus:border-ncp-primary sm:text-sm cursor-pointer"
                                            value={formData[field.name] ? formatDate(String(formData[field.name])) : ''}
                                            onClick={() => setActiveDateField(field.name)}
                                            readOnly
                                            placeholder="Select Date"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none mt-1">
                                            <i className="fas fa-calendar-alt text-gray-400"></i>
                                        </div>
                                    </div>
                                ) : (
                                    <input
                                        type={field.type}
                                        className="mt-1 block w-full py-2 px-3 border border-gray-200 bg-white rounded-md shadow-sm focus:outline-none focus:ring-ncp-primary focus:border-ncp-primary sm:text-sm"
                                        value={formData[field.name] ?? ''}
                                        onChange={(e) => handleChange(field.name, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </form>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-white rounded-b-lg">
                    <button type="button" className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition" onClick={onClose}>Close</button>
                    <button type="button" className="px-4 py-2 bg-ncp-primary text-white rounded hover:bg-ncp-dark transition" onClick={() => onSave(formData)}>Save Record</button>
                </div>
            </div>

            {activeDateField && (
                <DatePicker 
                    isOpen={!!activeDateField} 
                    onClose={() => setActiveDateField(null)} 
                    selectedDate={getDateObject(formData[activeDateField])}
                    onDateSelect={handleDateSelect}
                />
            )}
        </div>
    );
};

export default Modal;