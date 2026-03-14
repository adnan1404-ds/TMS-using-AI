
import { Database, DbSchema } from './types';

export const formatDate = (dateInput: string | Date | undefined): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return String(dateInput);

    const day = String(date.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);

    return `${day}-${month}-${year}`;
};

export const COE_LIST = [
    "NCP Central Setup (Estate)", 
    "NCP Central Setup (Admin)", 
    "NCP Central Setup (Tpt)", 
    "NCP Central Setup (Fin)", 
    "NCP Central Setup (Proc)", 
    "NCP Central Setup (HR)", 
    "NCP Central Setup (Sec)", 
    "NCP Central Setup (IT)", 
    "NCP Central Setup (CAAD)",
    "DG Sectt", 
    "CoE AITeC", 
    "CoE NINVAST", 
    "CoE Physics", 
    "CoE PIAM3D"
];

export const SCHEMA: DbSchema = {
    vehicles: {
        title: "Vehicle Fleet",
        fields: [
            { name: "sr", label: "Sr", type: "number", required: true },
            { name: "model", label: "Model", type: "text", required: true },
            { name: "reg_no", label: "Reg #", type: "text", required: true },
            { name: "make_type", label: "Make & Type", type: "text", required: true },
            { name: "fuel_type", label: "Fuel Type", type: "select", options: ["Petrol", "Diesel"], required: true },
            { name: "duty_type", label: "Duty Type", type: "select", options: ["SOI", "Entitled", "Shift", "General"], required: true },
            { name: "ep_cc", label: "EP(CC)", type: "text" },
            { name: "chassis_no", label: "Chassis #", type: "text" },
            { name: "engine_no", label: "Engine #", type: "text" },
            { name: "color", label: "Color", type: "text" },
            { name: "remarks", label: "Remarks", type: "text" }
        ]
    },
    drivers: {
        title: "Driver Database",
        fields: [
            { name: "sr", label: "Sr", type: "number", required: true },
            { name: "emp_nmbr", label: "Emp #", type: "text", required: true },
            { name: "name", label: "Full Name", type: "text", required: true },
            { name: "cnic", label: "CNIC", type: "text", required: true },
            { name: "contact", label: "Contact Number(s)", type: "textarea" },
            { name: "duty_type", label: "Duty Type", type: "select", options: ["General", "Shift", "Entitled", "Official Staff"] }
        ]
    },
    daily_reports: {
        title: "Daily Movement Report",
        fields: [
            { name: "date", label: "Date", type: "date", required: true },
            { name: "type", label: "Type", type: "select", options: ["Official", "Private", "School Duty"], required: true },
            { name: "vehicle_reg", label: "Veh Reg No", type: "select", options: [], required: true },
            { name: "officer", label: "Officer/Staff", type: "text" },
            { name: "coe", label: "CoEs / Setup", type: "select", options: COE_LIST },
            { name: "destination", label: "Destination", type: "text" },
            { name: "driver", label: "Driver Name", type: "select", options: [], required: true },
            { name: "meter_out", label: "Meter Out", type: "number", required: true },
            { name: "meter_in", label: "Meter IN", type: "number", required: true },
            { name: "average", label: "Avg (Km/L)", type: "number", required: true },
            { name: "fuel_type", label: "Fuel Type", type: "select", options: ["Petrol", "Diesel"], required: true },
            { name: "remarks", label: "Remarks", type: "text" }
        ]
    },
    pol_prices: { 
        title: "POL Prices", 
        fields: [
            { name: "date", label: "Effective Date", type: "date" }, 
            { name: "petrol", label: "Petrol Price", type: "number" }, 
            { name: "diesel", label: "Diesel Price", type: "number" }
        ] 
    },
    job_orders: { 
        title: "Job Order System", 
        fields: [
            { name: "jo_number", label: "JO #", type: "text", required: true },
            { name: "fiscal_year", label: "Fiscal Year", type: "select", options: ["23-24", "24-25", "25-26", "26-27"], required: true },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "reg_no", label: "Registration Number", type: "text", required: true }, 
            { name: "bill_amount", label: "Bill Amount", type: "number" },
            { name: "fault_desc", label: "Fault Description", type: "textarea" },
        ] 
    },
    attendance: {
        title: "Daily Attendance",
        fields: [
            { name: "date", label: "Date", type: "date", required: true },
            { name: "driver", label: "Driver Name", type: "text", required: true },
            { name: "status", label: "Status", type: "select", options: ["P", "A", "L", "R", "M", "C"], required: true },
            { name: "ot_hours", label: "Overtime Hours", type: "number" }
        ]
    }
};

export const DEMO_DATA: Database = {
    vehicles: [
        { sr: 1, model: "2024", reg_no: "FAA-204", make_type: "Toyota ALTAS", fuel_type: "Petrol", duty_type: "Entitled" },
        { sr: 2, model: "2018", reg_no: "NCP-205", make_type: "Honda Civic", fuel_type: "Petrol", duty_type: "SOI" },
        { sr: 3, model: "2020", reg_no: "GS-324", make_type: "Toyota Coaster", fuel_type: "Diesel", duty_type: "Shift" }
    ],
    drivers: [
        { sr: 1, emp_nmbr: "NCP-101", name: "Muhammad Akram", duty_type: "Entitled", contact: "0300-1234567\n0321-7654321" },
        { sr: 2, emp_nmbr: "NCP-102", name: "Sajid Ali", duty_type: "General", contact: "0333-1122334" }
    ],
    attendance: [],
    overtime: [],
    fuel: [],
    daily_reports: [
        { date: "2025-11-12", type: "Official", vehicle_reg: "FAA-204", officer: "Dr. Qaisar Ahsan", coe: "DG Sectt", destination: "Secretariat", driver: "Muhammad Akram", meter_out: 45000, meter_in: 45030, average: 10, fuel_type: "Petrol", kms: 30, liters: 3 },
        { date: "2025-11-12", type: "Official", vehicle_reg: "NCP-205", officer: "Mr. Rizwan", coe: "NCP Central Setup (Admin)", destination: "F-6 Sector", driver: "Sajid Ali", meter_out: 88000, meter_in: 88045, average: 9, fuel_type: "Petrol", kms: 45, liters: 5 }
    ],
    private_use: [],
    pol_prices: [
        { date: "2025-11-01", petrol: 250, diesel: 260 }
    ],
    school_duty: [],
    school_employees: [],
    job_orders: [],
    spd_reporting: [],
    log_book: [],
    pol_utilized: [],
    pol_exp_rs: [],
    pol_monthly: [],
    pol_rs: [],
    pol_report: [],
    pol_state: [],
    pol_soi_entries: [],
    pol_soi_monthly: [],
    routes: [],
    route_passengers: [],
    vehicle_duty_logs: [],
    driver_duty_logs: []
};
