export interface FieldSchema {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
}

export interface SectionSchema {
  title: string;
  fields: FieldSchema[];
}

export type DbSchema = Record<string, SectionSchema>;

export interface GenericRecord {
  [key: string]: string | number | undefined;
}

export interface Database {
  vehicles: GenericRecord[];
  drivers: GenericRecord[];
  attendance: GenericRecord[];
  overtime: GenericRecord[];
  fuel: GenericRecord[];
  daily_reports: GenericRecord[];
  private_use: GenericRecord[];
  pol_prices: GenericRecord[];
  school_duty: GenericRecord[];
  school_employees: GenericRecord[];
  job_orders: GenericRecord[];
  spd_reporting: GenericRecord[];
  log_book: GenericRecord[];
  pol_utilized: GenericRecord[];
  pol_exp_rs: GenericRecord[];
  pol_monthly: GenericRecord[];
  pol_rs: GenericRecord[];
  pol_report: GenericRecord[];
  pol_state: GenericRecord[];
  pol_soi_entries: GenericRecord[];
  pol_soi_monthly: GenericRecord[];
  routes: GenericRecord[];
  route_passengers: GenericRecord[];
  vehicle_duty_logs: GenericRecord[];
  driver_duty_logs: GenericRecord[];
  [key: string]: GenericRecord[];
}

export const DB_KEYS = [
  'vehicles', 'drivers', 'attendance', 'overtime',
  'fuel', 'daily_reports', 'private_use', 'pol_prices', 'school_duty', 'school_employees',
  'job_orders', 'spd_reporting', 'log_book',
  'pol_utilized', 'pol_exp_rs', 'pol_monthly', 'pol_rs', 'pol_report', 'pol_state', 'pol_soi_entries', 'pol_soi_monthly',
  'routes', 'route_passengers', 'vehicle_duty_logs', 'driver_duty_logs'
];