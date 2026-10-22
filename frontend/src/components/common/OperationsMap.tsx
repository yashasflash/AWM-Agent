import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { WasteReport } from '../../types/report';
import { Badge } from './Badge';
import { Button } from './Button';
import { formatReportNumber, formatDate } from '../../utils/formatters';
import {
  MapPin,
  Search,
  Filter,
  Maximize2,
  AlertTriangle,
  Info,
  Truck,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface OperationsMapProps {
  reports: WasteReport[];
  selectedReport?: WasteReport | null;
  onSelectReport?: (report: WasteReport) => void;
  onAssignReport?: (report: WasteReport) => void;
  onVerifyReport?: (report: WasteReport) => void;
  onOpenWorkOrder?: (report: WasteReport) => void;
  role?: 'manager' | 'municipal_staff';
  title?: string;
  subtitle?: string;
  heightClass?: string;
  onRefresh?: () => void;
}

export const OperationsMap: React.FC<OperationsMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  onAssignReport,
  onVerifyReport,
  onOpenWorkOrder,
  role = 'manager',
  title = 'Municipal Operations Map',
  subtitle,
  heightClass = 'h-[620px]',
  onRefresh,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Active state
  const [activeReport, setActiveReport] = useState<WasteReport | null>(selectedReport || null);
  const [tileError, setTileError] = useState(false);
  const [showUnlocatedModal, setShowUnlocatedModal] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Sync selectedReport prop
  useEffect(() => {
    if (selectedReport) {
      setActiveReport(selectedReport);
      // If map is ready and report has coords, pan to it
      if (
        mapInstanceRef.current &&
        typeof selectedReport.latitude === 'number' &&
        typeof selectedReport.longitude === 'number' &&
        !isNaN(selectedReport.latitude) &&
        !isNaN(selectedReport.longitude) &&
        (selectedReport.latitude !== 0 || selectedReport.longitude !== 0)
      ) {
        mapInstanceRef.current.setView([selectedReport.latitude, selectedReport.longitude], 16, {
          animate: true,
        });
      }
    }
  }, [selectedReport]);

  // Separate geolocated reports from those with missing coordinates
  const { validReports, unlocatedReports } = useMemo(() => {
    const valid: WasteReport[] = [];
    const unlocated: WasteReport[] = [];

    reports.forEach((r) => {
      const hasCoords =
        typeof r.latitude === 'number' &&
        typeof r.longitude === 'number' &&
        !isNaN(r.latitude) &&
        !isNaN(r.longitude) &&
        (r.latitude !== 0 || r.longitude !== 0) &&
        r.latitude >= -90 &&
        r.latitude <= 90 &&
        r.longitude >= -180 &&
        r.longitude <= 180;

      if (hasCoords) {
        valid.push(r);
      } else {
        unlocated.push(r);
      }
    });

    return { validReports: valid, unlocatedReports: unlocated };
  }, [reports]);

  // Available unique wards and categories for dropdowns
  const availableWards = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.ward) set.add(r.ward);
    });
    return Array.from(set).sort();
  }, [reports]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.waste_category) set.add(r.waste_category);
    });
    return Array.from(set).sort();
  }, [reports]);

  // Filtered reports
  const filteredValidReports = useMemo(() => {
    return validReports.filter((r) => {
      if (priorityFilter !== 'ALL') {
        const p = (r.ai_priority || r.priority || '').toUpperCase();
        if (p !== priorityFilter) return false;
      }
      if (statusFilter !== 'ALL') {
        if (r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (wardFilter !== 'ALL') {
        if (r.ward !== wardFilter) return false;
      }
      if (categoryFilter !== 'ALL') {
        if (r.waste_category !== categoryFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = String(r.report_number || '').includes(q) || String(r.id || '').includes(q);
        const matchesDesc = (r.description || '').toLowerCase().includes(q);
        const matchesAddr = (r.address || '').toLowerCase().includes(q);
        const matchesWard = (r.ward || '').toLowerCase().includes(q);
        const matchesCat = (r.waste_category || '').toLowerCase().includes(q);
        const matchesDept = (r.assigned_department || '').toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesAddr && !matchesWard && !matchesCat && !matchesDept) {
          return false;
        }
      }
      return true;
    });
  }, [validReports, priorityFilter, statusFilter, wardFilter, categoryFilter, searchQuery]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: India / Central Municipal Region
      const initialCenter: [number, number] = [16.705, 74.2433];
      const initialZoom = 13;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false, // We'll add custom positioned zoom buttons
      });

      // OpenStreetMap standard tile layer
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });

      tiles.on('tileerror', () => {
        setTileError(true);
      });

      tiles.addTo(map);

      // Custom zoom control in top-right
      L.control
        .zoom({
          position: 'topright',
        })
        .addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Priority color styling helper
  const getPriorityStyle = (priority?: string | null) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return {
          bg: '#E76F51',
          text: '#FFFFFF',
          halo: 'rgba(231, 111, 81, 0.4)',
          border: '#C0392B',
        };
      case 'MEDIUM':
        return {
          bg: '#F59E0B',
          text: '#FFFFFF',
          halo: 'rgba(245, 158, 11, 0.35)',
          border: '#D97706',
        };
      default:
        return {
          bg: '#16836A',
          text: '#FFFFFF',
          halo: 'rgba(22, 131, 106, 0.3)',
          border: '#103D35',
        };
    }
  };

  // Status icon/symbol helper
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Resolved':
        return 'Resolved';
      case 'In Progress':
        return 'In Progress';
      case 'Under Review':
        return 'Review';
      case 'Assigned':
        return 'Assigned';
      default:
        return 'Submitted';
    }
  };

  // Update Markers on Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (filteredValidReports.length === 0) return;

    const bounds = L.latLngBounds([]);

    filteredValidReports.forEach((report) => {
      const lat = report.latitude as number;
      const lng = report.longitude as number;
      bounds.extend([lat, lng]);

      const isSelected = activeReport?.id === report.id;
      const priorityStyle = getPriorityStyle(report.ai_priority || report.priority);
      const isResolved = report.status === 'Resolved';
      const isInProgress = report.status === 'In Progress';
      const isAssigned = report.status === 'Assigned' || !!report.assigned_staff;

      // Custom HTML Marker Icon
      const markerHtml = `
        <div class="relative group cursor-pointer" style="transform: translate(-50%, -100%);">
          ${
            !isResolved && (report.ai_priority || report.priority) === 'HIGH'
              ? `<div class="absolute -inset-1.5 rounded-full animate-ping opacity-60" style="background-color: ${priorityStyle.halo};"></div>`
              : ''
          }
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-125 ${
            isSelected ? 'scale-125 ring-4 ring-[#103D35]' : ''
          }" style="background-color: ${priorityStyle.bg};">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
          </div>
          <div class="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#103D35] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none">
            ${formatReportNumber(report.report_number || report.id)}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'awm-leaflet-marker',
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -40],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Build popup content
      const popupContent = document.createElement('div');
      popupContent.className = 'p-1 font-sans text-xs space-y-2';
      popupContent.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b pb-1.5">
          <strong class="text-sm font-bold text-[#103D35]">${formatReportNumber(report.report_number || report.id)}</strong>
          <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
            report.status === 'Resolved'
              ? 'bg-emerald-100 text-emerald-800'
              : report.status === 'In Progress'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }">
            ${report.status}
          </span>
        </div>
        <div>
          <p class="font-semibold text-slate-800">${report.waste_category}</p>
          <p class="text-slate-600 line-clamp-2 text-[11px] mt-0.5">${report.description || 'No description'}</p>
        </div>
        <div class="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t">
          <div>Ward: <strong class="text-slate-700">${report.ward || 'Central District'}</strong></div>
          ${report.assigned_department ? `<div>Dept: <strong class="text-slate-700">${report.assigned_department}</strong></div>` : ''}
          ${report.assigned_staff_name ? `<div>Assigned: <strong class="text-[#16836A]">${report.assigned_staff_name}</strong></div>` : ''}
          <div>GPS: <span class="font-mono text-[#16836A]">${lat.toFixed(4)}, ${lng.toFixed(4)}</span></div>
        </div>
      `;

      const inspectBtn = document.createElement('button');
      inspectBtn.className =
        'w-full mt-2 bg-[#103D35] hover:bg-[#16836A] text-white text-[11px] font-bold py-1 px-2 rounded text-center transition-colors';
      inspectBtn.innerText = role === 'manager' ? 'Select & Inspect Report' : 'Open Work Order';
      inspectBtn.onclick = () => {
        setActiveReport(report);
        if (onSelectReport) onSelectReport(report);
        if (role === 'municipal_staff' && onOpenWorkOrder) {
          onOpenWorkOrder(report);
        }
      };
      popupContent.appendChild(inspectBtn);

      marker.bindPopup(popupContent, { maxWidth: 280 });

      marker.on('click', () => {
        setActiveReport(report);
        if (onSelectReport) onSelectReport(report);
      });

      markersGroup.addLayer(marker);
    });

    // Auto fit bounds to visible markers if bounds are valid
    if (bounds.isValid()) {
      if (filteredValidReports.length === 1) {
        const single = filteredValidReports[0];
        map.setView([single.latitude as number, single.longitude as number], 15);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [filteredValidReports, activeReport, role, onSelectReport, onOpenWorkOrder]);

  const handleResetBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredValidReports.length === 0) return;

    const bounds = L.latLngBounds([]);
    filteredValidReports.forEach((r) => {
      bounds.extend([r.latitude as number, r.longitude as number]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-[#DCE8E2] bg-white overflow-hidden shadow-card">
      {/* Top Map Header & Operations Bar */}
      <div className="p-4 bg-[#F5F8F5] border-b border-[#DCE8E2] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#103D35] text-white flex items-center justify-center shadow-sm">
            <MapPin className="w-5 h-5 text-[#FF6848]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">{title}</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5F1] text-[#16836A]">
                {filteredValidReports.length} Plotted
              </span>
              {unlocatedReports.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnlocatedModal(true)}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1 border border-amber-200"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  {unlocatedReports.length} Location Unavailable
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {subtitle ||
                `Interactive city operations grid • Real GPS coordinates plotted directly from database records`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Data
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetBounds}
            leftIcon={<Maximize2 className="w-3.5 h-3.5" />}
            title="Reset map to fit all active markers"
          >
            Fit Bounds
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white border-b border-[#DCE8E2] flex flex-wrap items-center gap-2.5 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report ID, ward, address..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#DCE8E2] focus:outline-none focus:ring-2 focus:ring-[#16836A] focus:border-transparent bg-[#F5F8F5]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl border border-[#DCE8E2] text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#16836A]"
        >
          <option value="ALL">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Low Priority</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl border border-[#DCE8E2] text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#16836A]"
        >
          <option value="ALL">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Under Review">Under Review</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>

        {/* Ward Filter */}
        {availableWards.length > 0 && (
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#DCE8E2] text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#16836A] max-w-[160px] truncate"
          >
            <option value="ALL">All Wards</option>
            {availableWards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#DCE8E2] text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#16836A] max-w-[160px] truncate"
          >
            <option value="ALL">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {/* Reset Filter Button */}
        {(priorityFilter !== 'ALL' ||
          statusFilter !== 'ALL' ||
          wardFilter !== 'ALL' ||
          categoryFilter !== 'ALL' ||
          searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setPriorityFilter('ALL');
              setStatusFilter('ALL');
              setWardFilter('ALL');
              setCategoryFilter('ALL');
              setSearchQuery('');
            }}
            className="text-[11px] font-bold text-[#E76F51] hover:underline px-1 py-1"
          >
            Reset Filters
          </button>
        )}

        {/* Priority Legend */}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E76F51]" />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16836A]" />
            Normal
          </span>
        </div>
      </div>

      {/* Tile Loading Warning Banner (if offline or tile server issues) */}
      {tileError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>
              Map tile provider is currently taking longer to respond. Real report markers and coordinates remain
              fully interactive.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setTileError(false)}
            className="text-amber-700 hover:text-amber-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Map Body + Side Drawer Layout */}
      <div className={`relative ${heightClass} w-full flex overflow-hidden`}>
        {/* Leaflet Map DOM Node */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0 bg-[#E8ECE9]" />

        {/* Empty State Overlay if 0 Geolocated Reports Plotted */}
        {filteredValidReports.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#DCE8E2] shadow-card max-w-sm p-6 text-center space-y-2 pointer-events-auto">
              <Info className="w-8 h-8 text-[#16836A] mx-auto" />
              <h3 className="text-sm font-bold text-[#103D35]">No Reports Match Current Map Filters</h3>
              <p className="text-xs text-slate-500">
                {validReports.length > 0
                  ? 'Try clearing active filters or searching for another ward.'
                  : 'No complaints in the system currently contain valid geographic coordinates.'}
              </p>
              {unlocatedReports.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setShowUnlocatedModal(true)}
                >
                  View {unlocatedReports.length} Unlocated Reports
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Active Report Slide-in Inspector Panel */}
        {activeReport && (
          <div className="absolute top-4 right-4 bottom-4 w-80 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl border border-[#DCE8E2] shadow-2xl p-4 flex flex-col justify-between z-20 animate-in slide-in-from-right-4 duration-200">
            <div className="space-y-3.5 overflow-y-auto pr-1">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[#DCE8E2] pb-3">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[#103D35]">
                      {formatReportNumber(activeReport.report_number || activeReport.id)}
                    </span>
                    <Badge status={activeReport.status} size="sm" />
                    <Badge priority={activeReport.ai_priority || activeReport.priority} size="sm" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-800 mt-1">
                    {activeReport.waste_category || 'General Waste'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveReport(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Citizen Report</p>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-[#F5F8F5] p-2.5 rounded-xl border border-[#DCE8E2]">
                  {activeReport.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* Geographic Details */}
              <div className="space-y-1.5 text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-[#DCE8E2]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ward:</span>
                  <strong className="text-slate-800">{activeReport.ward || 'Central District'}</strong>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-400">Address:</span>
                  <strong className="text-slate-800 text-right line-clamp-2">{activeReport.address || 'Not specified'}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Coordinates:</span>
                  {typeof activeReport.latitude === 'number' && typeof activeReport.longitude === 'number' ? (
                    <strong className="text-[#16836A] font-mono text-[11px]">
                      {activeReport.latitude.toFixed(4)}, {activeReport.longitude.toFixed(4)}
                    </strong>
                  ) : (
                    <span className="text-amber-600 italic">Location unavailable</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Submitted:</span>
                  <span className="text-slate-600 text-[11px]">{formatDate(activeReport.created_at)}</span>
                </div>
              </div>

              {/* Operations & Assignment Info */}
              <div className="space-y-1.5 text-xs bg-[#FBFDFB] p-2.5 rounded-xl border border-[#DCE8E2]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignment & Dispatch</p>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Department:</span>
                  <strong className="text-slate-800">{activeReport.assigned_department || 'Solid Waste Management'}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Assigned Officer:</span>
                  {activeReport.assigned_staff_name || activeReport.assigned_staff ? (
                    <strong className="text-[#16836A]">{activeReport.assigned_staff_name || activeReport.assigned_staff}</strong>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </div>
                {activeReport.resolution_notes && (
                  <div className="pt-1.5 border-t border-[#DCE8E2]">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Resolution Notes</span>
                    <p className="text-[11px] text-slate-700 italic mt-0.5">{activeReport.resolution_notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions based on Role */}
            <div className="pt-3 border-t border-[#DCE8E2] space-y-2">
              {role === 'manager' && (
                <>
                  {activeReport.status !== 'Resolved' && (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => onAssignReport && onAssignReport(activeReport)}
                      leftIcon={<Truck className="w-3.5 h-3.5" />}
                    >
                      {activeReport.assigned_staff ? 'Reassign Staff' : 'Assign Municipal Staff'}
                    </Button>
                  )}
                  {activeReport.status === 'Under Review' && onVerifyReport && (
                    <Button
                      variant="coral"
                      size="sm"
                      className="w-full"
                      onClick={() => onVerifyReport(activeReport)}
                      leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                    >
                      Verify Field Resolution
                    </Button>
                  )}
                </>
              )}

              {role === 'municipal_staff' && onOpenWorkOrder && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => onOpenWorkOrder(activeReport)}
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Open Work Order Modal
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary Bar */}
      <div className="p-3 bg-[#FBFDFB] border-t border-[#DCE8E2] text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-700">
            Ward Distribution ({availableWards.length} Wards):
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {availableWards.slice(0, 5).map((w) => {
              const count = validReports.filter((r) => r.ward === w).length;
              return (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#DCE8E2] text-[11px]"
                >
                  <span className="text-slate-600">{w}:</span>
                  <strong className="text-[#103D35]">{count}</strong>
                </span>
              );
            })}
            {availableWards.length > 5 && (
              <span className="text-[11px] text-slate-400">+{availableWards.length - 5} more wards</span>
            )}
          </div>
        </div>

        {unlocatedReports.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUnlocatedModal(true)}
            className="text-[11px] text-[#16836A] hover:underline font-bold flex items-center gap-1"
          >
            <span>{unlocatedReports.length} complaints have no GPS coordinates</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Unlocated Reports Modal / Panel */}
      {showUnlocatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#DCE8E2] shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DCE8E2] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#103D35]">
                    Reports with Location Unavailable
                  </h3>
                  <p className="text-xs text-slate-500">
                    These complaints were submitted with textual addresses but without numeric GPS coordinates.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnlocatedModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {unlocatedReports.map((report) => (
                <div
                  key={report.id}
                  className="p-3 rounded-xl border border-[#DCE8E2] hover:border-[#16836A] hover:bg-[#F5F8F5] transition-all flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#103D35]">
                        {formatReportNumber(report.report_number || report.id)}
                      </span>
                      <Badge status={report.status} size="sm" />
                      <Badge priority={report.ai_priority || report.priority} size="sm" />
                      <span className="text-xs font-semibold text-slate-800">{report.waste_category}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{report.description || 'No description'}</p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>
                        Ward: <strong>{report.ward || 'Central District'}</strong>
                      </span>
                      <span>
                        Address: <strong>{report.address || 'Address unrecorded'}</strong>
                      </span>
                      <span>Date: {formatDate(report.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {role === 'manager' && onAssignReport && report.status !== 'Resolved' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowUnlocatedModal(false);
                          onAssignReport(report);
                        }}
                      >
                        Assign
                      </Button>
                    )}
                    {role === 'municipal_staff' && onOpenWorkOrder && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowUnlocatedModal(false);
                          onOpenWorkOrder(report);
                        }}
                      >
                        Work Order
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#DCE8E2] flex justify-end">
              <Button variant="secondary" onClick={() => setShowUnlocatedModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
