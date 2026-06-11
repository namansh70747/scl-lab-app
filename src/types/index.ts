export type Role = 'admin' | 'technician';
export type AgeUnit = 'YRS' | 'MTH' | 'DAYS';
export type Sex = 'MALE' | 'FEMALE' | 'OTHER';
export type ResultType = 'numeric' | 'text' | 'choice' | 'calculated';
export type Flag = '' | 'H' | 'L' | 'A';
export type PaymentMode = 'CASH' | 'UPI' | 'CARD';
export type DeliveryChannel = 'whatsapp_semi' | 'whatsapp_api' | 'email' | 'print' | 'pdf';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export type PatientStatus = 'registered' | 'results_pending' | 'approved' | 'delivered';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  active: number;
  force_password_change: number;
  password_hash: string;
}

export interface Panel {
  id: number;
  code: string;
  name: string;
  report_heading: string;
  sort_order: number;
  page_break_after: number;
}

export interface Test {
  id: number;
  code: string;
  name: string;
  panel_id: number;
  panel_code?: string;
  panel_heading?: string;
  result_type: ResultType;
  unit: string;
  decimals: number;
  price: number;
  enabled: number;
  sort_order: number;
  choices: string | null; // JSON array string
  default_value: string | null;
  formula: string | null;
  interpretation_note: string | null;
  is_panel: number;
  needs_review: number;
}

export interface TestRange {
  id: number;
  test_id: number;
  sex: 'M' | 'F' | 'ANY';
  age_min_days: number;
  age_max_days: number;
  low: number | null;
  high: number | null;
  range_text: string | null;
  band_text: string | null;
}

export interface Doctor {
  id: number;
  name: string;
  degree: string | null;
  active: number;
}

export interface Patient {
  id: number;
  test_no: number;
  title: string;
  name: string;
  age: number;
  age_unit: AgeUnit;
  sex: Sex;
  phone: string;
  email: string | null;
  address: string;
  doctor_id: number | null;
  doctor_name?: string;
  collected_at: string;
  registered_at: string;
  sample_time: string | null;
  report_time: string | null;
  status?: PatientStatus;
}

export interface Order {
  id: number;
  patient_id: number;
  test_id: number;
  price_charged: number;
  sample_id: string;
  not_done: number;
  test?: Test;
}

export interface Result {
  id: number;
  order_id: number;
  value: string;
  flag: Flag;
  entered_by: number | null;
  entered_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
}

export interface Bill {
  id: number;
  patient_id: number;
  total: number;
  concession: number;
  net: number;
  received: number;
  balance: number;
  mode: PaymentMode;
}

export interface DeliveryLog {
  id: number;
  patient_id: number;
  channel: DeliveryChannel;
  target: string;
  status: DeliveryStatus;
  error: string | null;
  at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  before_json: string | null;
  after_json: string | null;
  at: string;
}

export interface Setting {
  key: string;
  value: string;
}

// Composite types for UI
export interface PatientWithStatus extends Patient {
  bill: Bill;
  test_count: number;
  approved_count: number;
  delivery_status?: DeliveryStatus;
}

export interface OrderWithResult {
  order: Order;
  test: Test;
  ranges: TestRange[];
  result: Result | null;
}

export interface PatientReport {
  patient: Patient;
  doctor: Doctor | null;
  bill: Bill;
  comment: string;
  panels: {
    panel: Panel;
    rows: OrderWithResult[];
  }[];
}

export interface NewPatientInput {
  title: string;
  name: string;
  age: number;
  age_unit: AgeUnit;
  sex: Sex;
  phone: string;
  email: string;
  address: string;
  doctor_id: number | null;
  collected_at: string;
  sample_time: string;
  test_ids: number[];
  prices: Record<number, number>; // test_id -> price override
  concession: number;
  received: number;
  mode: PaymentMode;
}
