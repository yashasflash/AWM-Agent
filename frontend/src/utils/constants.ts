import { WasteCategory, ReportStatus } from '../types/report';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8000';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const STORAGE_KEYS = {
  TOKEN: 'awm_auth_token',
  USER: 'awm_auth_user',
  PORTAL: 'awm_last_portal',
};

export const PALETTE = {
  background: '#F5F8F5',
  deepForestGreen: '#103D35',
  emerald: '#16836A',
  white: '#FFFFFF',
  borders: '#DCE8E2',
  coralAccent: '#FF6848',
  highPriority: '#E76F51',
  mediumPriority: '#F59E0B',
};

export const WASTE_CATEGORIES: WasteCategory[] = [
  'Garbage Overflow',
  'Waste Not Collected',
  'Illegal Dumping',
  'Street Waste',
  'Plastic Waste',
  'Bad Odour',
  'Other',
];

export const REPORT_STATUSES: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'In Progress',
  'Resolved',
  'Rejected',
];

export const MUNICIPAL_DEPARTMENTS = [
  'Solid Waste Management',
  'Sanitation & Cleansing',
  'Hazardous & Medical Waste',
  'Recycling & Resource Recovery',
  'Drainage & Waterways',
];

export const WARDS_LIST = [
  'Ward 1 - Central Market',
  'Ward 2 - Riverside Boulevard',
  'Ward 3 - Heritage District',
  'Ward 4A - North Civic Center',
  'Ward 4B - East Residential',
  'Ward 5 - Industrial Park',
  'Ward 6 - South Suburbs',
  'Ward 7 - Tech Park Zone',
  'Ward 8 - University Quarter',
];
