import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { reportService } from '../../services/reportService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useToast } from '../../hooks/useToast';
import { WasteReport, CitizenStats, WasteCategory } from '../../types/report';
import { AppNotification } from '../../types/notification';
import { notificationService } from '../../services/notificationService';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Input, Select, Textarea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/Loading';
import { AlertBanner } from '../../components/common/Error';
import { formatDate, formatReportNumber } from '../../utils/formatters';
import { WASTE_CATEGORIES, REPORT_STATUSES, WARDS_LIST } from '../../utils/constants';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Navigation,
  MapPin,
  Bell,
  User as UserIcon,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  UploadCloud,
  ChevronRight,
  RefreshCw,
  ArrowRight,
  LogOut,
  ShieldCheck,
  Check,
  Truck,
  FileCheck,
  UserCheck,
} from 'lucide-react';

type CitizenView =
  | 'overview'
  | 'report-waste'
  | 'my-reports'
  | 'track-complaint'
  | 'nearby-issues'
  | 'notifications'
  | 'profile';

export const CitizenDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError } = useToast();
  const { coordinates, loading: geoLoading, error: geoError, getLocation } = useGeolocation();

  const handleConfirmLogout = () => {
    if (window.confirm('Are you sure you want to sign out of your Citizen session?')) {
      logout();
      navigate('/', { replace: true });
    }
  };

  // Active Sidebar View
  const [activeView, setActiveView] = useState<CitizenView>('overview');

  // Synchronize query parameters (?view=...) from header dropdown
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    if (
      viewParam &&
      [
        'overview',
        'report-waste',
        'my-reports',
        'track-complaint',
        'nearby-issues',
        'notifications',
        'profile',
      ].includes(viewParam)
    ) {
      setActiveView(viewParam as CitizenView);
    }
  }, [location.search]);

  // Reports State
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [stats, setStats] = useState<CitizenStats>({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Report for Tracking
  const [trackingReport, setTrackingReport] = useState<WasteReport | null>(null);

  // Persistent Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  // Form State for "Report Waste"
  const [formCategory, setFormCategory] = useState<WasteCategory>('Garbage Overflow');
  const [formDescription, setFormDescription] = useState('');
  const [formWard, setFormWard] = useState(user?.ward || 'Ward 1 - Central Market');
  const [formAddress, setFormAddress] = useState('');
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitError, setReportSubmitError] = useState<string | null>(null);

  // Filters for "My Reports"
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getCitizenReports({
        page: 1,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        waste_category: categoryFilter || undefined,
      });
      setReports(res.reports || []);
      setStats(res.stats || { total: 0, pending: 0, in_progress: 0, resolved: 0 });

      // If tracking a report, refresh its state without triggering dependency loop
      if (res.reports && res.reports.length > 0) {
        setTrackingReport((prev) => {
          if (!prev?.id) return res.reports[0];
          const updated = res.reports.find((r) => String(r.id) === String(prev.id));
          return updated || prev;
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch your waste reports.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Fetch persistent notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await notificationService.getNotifications(20);
      setNotifications(res.notifications || []);
      setUnreadNotifCount(res.unread_count || 0);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const notifInterval = setInterval(() => {
      fetchNotifications();
    }, 10000);
    return () => clearInterval(notifInterval);
  }, [fetchNotifications]);

  // Real-time Polling: When Track Complaint is open, refresh every 5 seconds without full page reload
  useEffect(() => {
    if (activeView !== 'track-complaint' || !trackingReport?.id) return;

    const intervalId = setInterval(async () => {
      try {
        const fresh = await reportService.getReportById(String(trackingReport.id));
        if (fresh && fresh.report) {
          setTrackingReport(fresh.report);
          setReports((prev) =>
            prev.map((r) => (String(r.id) === String(fresh.report.id) ? fresh.report : r))
          );
        }
      } catch (err) {
        console.debug('Track complaint polling error:', err);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeView, trackingReport?.id]);

  // Nearby Community Issues State
  const [nearbyReports, setNearbyReports] = useState<WasteReport[]>([]);
  const [nearbyWard, setNearbyWard] = useState<string>(user?.ward || 'Ward 1 - Central Market');
  const [nearbyCategory, setNearbyCategory] = useState<string>('');
  const [nearbyStatus, setNearbyStatus] = useState<string>('');
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false);

  const fetchNearby = useCallback(async () => {
    setLoadingNearby(true);
    try {
      const res = await reportService.getNearbyReports({
        ward: nearbyWard || undefined,
        category: nearbyCategory || undefined,
        status: nearbyStatus || undefined,
        limit: 30,
      });
      setNearbyReports(res.reports || []);
    } catch {
      setNearbyReports([]);
    } finally {
      setLoadingNearby(false);
    }
  }, [nearbyWard, nearbyCategory, nearbyStatus]);

  useEffect(() => {
    if (activeView === 'nearby-issues') {
      fetchNearby();
    }
  }, [activeView, fetchNearby]);

  // Handle Photo File Selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Submit Waste Report
  const handleSubmitWasteReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitError(null);

    if (!formDescription.trim()) {
      setReportSubmitError('Please enter a brief description of the waste problem.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      let photoUrl: string | undefined = undefined;

      // 1. Upload photo if selected
      if (formPhoto) {
        const uploadRes = await reportService.uploadPhoto(formPhoto);
        photoUrl = uploadRes.file_path;
      }

      // 2. Submit report to FastAPI backend
      const newReportRes = await reportService.createReport({
        waste_category: formCategory,
        description: formDescription.trim(),
        ward: formWard,
        address: formAddress.trim() || formWard,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        photo_url: photoUrl,
      });

      success('Waste report submitted! Gemini AI autonomous triage initiated.');

      // Reset form
      setFormDescription('');
      setFormAddress('');
      setFormPhoto(null);
      setPhotoPreview(null);

      // Refresh list and navigate to track view
      await fetchReports();
      if (newReportRes.report) {
        setTrackingReport(newReportRes.report);
      }
      setActiveView('track-complaint');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report. Please check your network.';
      setReportSubmitError(msg);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Navigation Items (Exact 7 items required)
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'report-waste', label: 'Report Waste', icon: <PlusCircle className="w-4 h-4 text-[#FF6848]" /> },
    { id: 'my-reports', label: 'My Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'track-complaint', label: 'Track Complaint', icon: <Navigation className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DCE8E2]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#103D35] tracking-tight">
              Citizen Workspace
            </h1>
            <Badge role="citizen" size="sm" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong className="text-slate-800">{user?.full_name || user?.email}</strong> • Assigned Ward:{' '}
            <span className="text-[#16836A] font-semibold">{user?.ward || 'Ward 1 - Central Market'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="coral"
            size="sm"
            onClick={() => setActiveView('report-waste')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Report Waste Incident
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchReports}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Grid: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside className="lg:col-span-3 space-y-2">
          <div className="bg-white rounded-2xl border border-[#DCE8E2] shadow-card p-3 space-y-1">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Citizen Services
            </p>
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id as CitizenView)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-[#103D35] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#103D35] hover:bg-[#F5F8F5]'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.id === 'my-reports' && stats.total > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#E8F5F1] text-[#16836A]'
                      }`}
                    >
                      {stats.total}
                    </span>
                  )}
                  {item.id === 'notifications' && unreadNotifCount > 0 && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#FF6848] text-white animate-pulse"
                    >
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* AI Helper Micro Card */}
          <div className="p-4 rounded-2xl bg-[#E8F5F1]/80 border border-[#16836A]/20 text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#103D35] font-bold">
              <Bot className="w-4 h-4 text-[#16836A]" />
              <span>Gemini AI Triage</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Every photo you submit is automatically analyzed by Google Gemini to identify waste material and dispatch municipal trucks.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="lg:col-span-9 space-y-6">
          {error && <AlertBanner variant="error" message={error} onRetry={fetchReports} />}

          {/* ========================================================
              VIEW 1: OVERVIEW
             ======================================================== */}
          {activeView === 'overview' && (
            <div className="space-y-6">
              {/* Actual Counts Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card variant="flat" className="p-5 border-l-4 border-l-[#103D35] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Total Reports</span>
                    <FileText className="w-4 h-4 text-[#103D35]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#103D35] mt-2">{stats.total}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Complaints logged</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#E76F51] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Pending Intake</span>
                    <Clock className="w-4 h-4 text-[#E76F51]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#E76F51] mt-2">{stats.pending}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Under AI review</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#F59E0B] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>In Progress</span>
                    <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#F59E0B] mt-2">{stats.in_progress}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Cleansing crew active</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#16836A] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Resolved</span>
                    <CheckCircle2 className="w-4 h-4 text-[#16836A]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#16836A] mt-2">{stats.resolved}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Cleaned & verified</p>
                </Card>
              </div>

              {/* Recent Activity Card */}
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">
                    Recent Incident Activity
                  </h3>
                  <button
                    onClick={() => setActiveView('my-reports')}
                    className="text-xs font-semibold text-[#16836A] hover:underline flex items-center gap-1"
                  >
                    View All ({reports.length})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {reports.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-8 h-8 text-[#16836A]" />}
                    title="No Waste Reports Yet"
                    description="You have not filed any waste complaints. Click 'Report Waste' to submit your first incident."
                    actionText="Report Waste Incident"
                    onAction={() => setActiveView('report-waste')}
                  />
                ) : (
                  <div className="divide-y divide-[#DCE8E2]">
                    {reports.slice(0, 5).map((r) => (
                      <div key={r.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#103D35]">
                              {formatReportNumber(r.report_number || r.id)}
                            </span>
                            <Badge status={r.status} size="sm" />
                            <Badge priority={r.ai_priority || r.priority} size="sm" />
                          </div>
                          <p className="text-slate-600 font-medium line-clamp-1">{r.description || r.waste_category}</p>
                          <p className="text-[11px] text-slate-400">
                            Location: {r.ward || r.address || 'Central District'} • Filed on {formatDate(r.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setTrackingReport(r);
                            setActiveView('track-complaint');
                          }}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Track
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 2: REPORT WASTE (ACTUAL FORM WITH GPS & PHOTO)
             ======================================================== */}
          {activeView === 'report-waste' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#103D35]">Report Waste Incident</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload an image and provide the incident location for automated Gemini AI classification and municipal dispatch.
                </p>
              </div>

              {reportSubmitError && (
                <AlertBanner variant="error" message={reportSubmitError} onDismiss={() => setReportSubmitError(null)} />
              )}

              <form onSubmit={handleSubmitWasteReport} className="space-y-5">
                {/* Waste Category Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Waste Category <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as WasteCategory)}
                    required
                  >
                    {WASTE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Incident Description <span className="text-rose-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Describe the waste issue (e.g., Overflowing dumpster blocking sidewalk for 2 days...)"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                {/* Photo Upload Box */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Waste Incident Photograph (for Gemini Vision AI)
                  </label>
                  <div className="border-2 border-dashed border-[#DCE8E2] hover:border-[#16836A] rounded-2xl p-6 text-center bg-[#F5F8F5]/60 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {photoPreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={photoPreview}
                          alt="Incident Preview"
                          className="w-36 h-36 object-cover rounded-xl border border-[#DCE8E2] shadow-sm"
                        />
                        <span className="text-xs text-[#16836A] font-semibold">
                          Click to select a different photo
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-10 h-10 rounded-full bg-white text-[#16836A] flex items-center justify-center mx-auto shadow-sm">
                          <UploadCloud className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700">
                          Click or drag and drop photo of waste incident
                        </p>
                        <p className="text-[11px] text-slate-400">
                          PNG, JPG, or WEBP up to 10MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ward and Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Municipal Ward / Service Area <span className="text-rose-500">*</span>
                    </label>
                    <Select value={formWard} onChange={(e) => setFormWard(e.target.value)} required>
                      {WARDS_LIST.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Street Address or Landmark
                    </label>
                    <Input
                      placeholder="e.g. Near Market Gate #2"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                    />
                  </div>
                </div>

                {/* Geolocation Button */}
                <div className="p-4 rounded-xl bg-[#F5F8F5] border border-[#DCE8E2] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-[#103D35] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6848]" />
                      Browser GPS Tagging
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {coordinates
                        ? `GPS Locked: ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
                        : geoError
                        ? geoError
                        : 'Allow browser location permission to automatically pin coordinates.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={getLocation}
                    isLoading={geoLoading}
                    leftIcon={<Navigation className="w-3.5 h-3.5" />}
                  >
                    {coordinates ? 'Update GPS' : 'Auto-Detect Location'}
                  </Button>
                </div>

                {/* Submit CTA */}
                <Button
                  type="submit"
                  variant="coral"
                  size="lg"
                  className="w-full justify-center"
                  isLoading={isSubmittingReport}
                >
                  Submit Waste Complaint to Municipality
                </Button>
              </form>
            </Card>
          )}

          {/* ========================================================
              VIEW 3: MY REPORTS (COLUMNS SPECIFIED IN PROMPT)
             ======================================================== */}
          {activeView === 'my-reports' && (
            <div className="space-y-4">
              {/* Search & Filter Header */}
              <Card variant="flat" className="p-4 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    placeholder="Search your reports..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    {REPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="">All Categories</option>
                    {WASTE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              </Card>

              {/* Table with prompt-required columns: Report ID, Issue, Location, Date, Priority, Status, Action */}
              <Card variant="flat" className="bg-white overflow-hidden shadow-card">
                {reports.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="w-8 h-8 text-[#16836A]" />}
                    title="No Matching Reports"
                    description="No waste complaints match your filter criteria."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-[#F5F8F5] border-b border-[#DCE8E2] text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-4 py-3.5">Report ID</th>
                          <th className="px-4 py-3.5">Issue</th>
                          <th className="px-4 py-3.5">Location</th>
                          <th className="px-4 py-3.5">Date</th>
                          <th className="px-4 py-3.5">Priority</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE8E2]">
                        {reports.map((report) => (
                          <tr key={report.id} className="hover:bg-[#F5F8F5]/50 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-[#103D35]">
                              {formatReportNumber(report.report_number || report.id)}
                            </td>
                            <td className="px-4 py-3 max-w-[200px]">
                              <p className="font-semibold text-slate-800">{report.waste_category}</p>
                              <p className="text-[11px] text-slate-500 truncate">{report.description || 'N/A'}</p>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-600">
                              {report.ward || report.address || 'Central District'}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                              {formatDate(report.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge priority={report.ai_priority || report.priority} size="sm" />
                            </td>
                            <td className="px-4 py-3">
                              <Badge status={report.status} size="sm" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setTrackingReport(report);
                                  setActiveView('track-complaint');
                                }}
                              >
                                Track
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 4: TRACK COMPLAINT (ACTUAL REAL STATUS TIMELINE)
             ======================================================== */}
          {activeView === 'track-complaint' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#DCE8E2]">
                <div>
                  <h2 className="text-xl font-bold text-[#103D35]">Complaint Status & Real Timeline</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live operational stages reflected directly from the municipal database.
                  </p>
                </div>

                {/* Report Selector Dropdown if user has multiple reports */}
                {reports.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-600">Viewing Report:</span>
                    <select
                      value={trackingReport?.id || ''}
                      onChange={(e) => {
                        const sel = reports.find((r) => String(r.id) === e.target.value);
                        if (sel) setTrackingReport(sel);
                      }}
                      className="py-1 px-2.5 bg-[#F5F8F5] border border-[#DCE8E2] rounded-lg text-xs font-mono font-bold text-[#103D35]"
                    >
                      {reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          {formatReportNumber(r.report_number || r.id)} - {r.waste_category}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!trackingReport ? (
                <EmptyState
                  icon={<Navigation className="w-8 h-8 text-[#16836A]" />}
                  title="No Report Selected for Tracking"
                  description="Select a report from 'My Reports' or submit a new complaint to inspect its timeline."
                />
              ) : (
                <div className="space-y-6">
                  {/* Prominent Official Status Banner (Strictly from backend state) */}
                  {(() => {
                    const stage = trackingReport.lifecycle_stage;
                    const status = trackingReport.status;
                    let bannerIcon = <Clock className="w-5 h-5" />;
                    let bannerBg = 'bg-[#F5F8F5] border-[#DCE8E2] text-slate-700';
                    let bannerTitle = 'Report Received';
                    let bannerText = 'Your report has been received. The municipal team has not been assigned yet.';

                    if (status === 'Resolved' || stage === 'RESOLVED') {
                      bannerIcon = <CheckCircle2 className="w-5 h-5 text-white" />;
                      bannerBg = 'bg-[#E9F5EF] border-[#16836A]/30 text-[#103D35]';
                      bannerTitle = 'Complaint Resolved';
                      bannerText = 'Your waste complaint has been resolved.';
                    } else if (stage === 'RESOLUTION_SUBMITTED' || (status === 'Under Review' && trackingReport.resolution_notes)) {
                      bannerIcon = <FileCheck className="w-5 h-5 text-white" />;
                      bannerBg = 'bg-amber-50 border-amber-300 text-amber-950';
                      bannerTitle = 'Completion Submitted — Verification Pending';
                      bannerText = 'The municipal team has submitted completion details. Final verification is pending.';
                    } else if (status === 'In Progress' || stage === 'IN_PROGRESS') {
                      bannerIcon = <Truck className="w-5 h-5 text-white" />;
                      bannerBg = 'bg-blue-50 border-blue-200 text-blue-950';
                      bannerTitle = 'Collection Work In Progress';
                      bannerText = 'The municipal team has started working on your report.';
                    } else if (status === 'Assigned' || stage === 'ASSIGNED' || stage === 'ACCEPTED' || trackingReport.assigned_staff) {
                      bannerIcon = <UserCheck className="w-5 h-5 text-white" />;
                      bannerBg = 'bg-[#E9F5EF] border-[#16836A]/30 text-[#103D35]';
                      bannerTitle = 'Report Assigned to Municipal Team';
                      bannerText = 'Your report has been assigned to the responsible team.';
                    }

                    return (
                      <div className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 shadow-sm transition-all ${bannerBg}`}>
                        <div className="p-2.5 rounded-xl bg-[#16836A] text-white shrink-0 shadow-sm">
                          {bannerIcon}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                              {bannerTitle}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/70 font-semibold border border-black/5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16836A] animate-ping" />
                              LIVE
                            </span>
                          </div>
                          <p className="text-sm sm:text-base font-bold">
                            {trackingReport.status_message || bannerText}
                          </p>
                          {trackingReport.last_updated_at && (
                            <p className="text-[11px] opacity-70">
                              Last updated: {formatDate(trackingReport.last_updated_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Comprehensive Report Information Grid (All 12 Required Fields) */}
                  <div className="p-6 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#DCE8E2]">
                      <span className="text-xs font-bold text-[#103D35] uppercase tracking-wider">
                        Official Complaint Dossier
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Task Reference: <strong className="font-mono text-[#103D35]">{trackingReport.task_id || trackingReport.task_number || (trackingReport.assigned_task?.task_number) || 'Awaiting Task Assignment'}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      {/* Field 1: Report ID */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">1. Report ID</span>
                        <p className="font-mono font-bold text-sm text-[#103D35] mt-0.5">
                          {formatReportNumber(trackingReport.report_number || trackingReport.id)}
                        </p>
                      </div>

                      {/* Field 2: Waste Category */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">2. Waste Category</span>
                        <p className="font-semibold text-slate-800 mt-0.5">{trackingReport.waste_category}</p>
                      </div>

                      {/* Field 3: Current Status */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">3. Current Status</span>
                        <div className="mt-1">
                          <Badge status={trackingReport.status} size="sm" />
                        </div>
                      </div>

                      {/* Field 4: Actual Priority */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">4. Actual Priority</span>
                        <div className="mt-1">
                          <Badge priority={trackingReport.ai_priority || trackingReport.priority || 'MEDIUM'} size="sm" />
                        </div>
                      </div>

                      {/* Field 5: Submitted Location */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">5. Submitted Location</span>
                        <p className="font-medium text-slate-800 mt-0.5 truncate">
                          {trackingReport.address || 'Address not specified'}
                        </p>
                        {trackingReport.latitude && trackingReport.longitude && (
                          <p className="text-[10px] font-mono text-[#16836A] mt-0.5">
                            GPS: {trackingReport.latitude}, {trackingReport.longitude}
                          </p>
                        )}
                      </div>

                      {/* Field 6: Ward / Service Area */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">6. Ward / Service Area</span>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {trackingReport.ward || 'Central District'}
                        </p>
                      </div>

                      {/* Field 7: Assigned Department */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">7. Assigned Department</span>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {trackingReport.assigned_department || 'Not assigned yet'}
                        </p>
                      </div>

                      {/* Field 8: Assigned Officer / Team */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">8. Assigned Officer / Team</span>
                        <p className="font-semibold text-[#16836A] mt-0.5 truncate">
                          {trackingReport.assigned_officer || trackingReport.assigned_staff_name || trackingReport.assigned_staff || 'Not assigned yet'}
                        </p>
                      </div>

                      {/* Field 9: Collection Task ID */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">9. Collection Task ID</span>
                        <p className="font-mono font-bold text-slate-800 mt-0.5">
                          {trackingReport.task_id || trackingReport.task_number || (trackingReport.assigned_task?.task_number) || 'Pending Dispatch'}
                        </p>
                      </div>

                      {/* Field 10: Submission Date & Time */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">10. Submission Date</span>
                        <p className="font-medium text-slate-800 mt-0.5">{formatDate(trackingReport.created_at)}</p>
                      </div>

                      {/* Field 11: Last Updated Time */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">11. Last Updated</span>
                        <p className="font-medium text-slate-800 mt-0.5">
                          {formatDate(trackingReport.last_updated_at || trackingReport.updated_at || trackingReport.created_at)}
                        </p>
                      </div>

                      {/* Field 12: Resolution Status */}
                      <div className="p-3 bg-white rounded-xl border border-[#DCE8E2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">12. Resolution Status</span>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {trackingReport.status === 'Resolved' ? 'Verified & Closed' : 'In Resolution Pipeline'}
                        </p>
                      </div>
                    </div>

                    {/* Description full-width */}
                    <div className="p-3.5 bg-white rounded-xl border border-[#DCE8E2] text-xs">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Description</span>
                      <p className="text-slate-700 mt-1 leading-relaxed">
                        {trackingReport.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Citizen Evidence Photo (When available) */}
                  {(trackingReport.photo_signed_url || trackingReport.photo_url) && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-[#103D35] uppercase tracking-wider block">
                        Citizen Evidence Photo
                      </span>
                      <div className="rounded-xl overflow-hidden border border-[#DCE8E2] max-h-56 bg-slate-900 flex items-center justify-center">
                        <img
                          src={trackingReport.photo_signed_url || trackingReport.photo_url || ''}
                          alt="Citizen Evidence"
                          className="w-full h-56 object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {/* Gemini AI Multimodal Triage Assessment (When available) */}
                  {trackingReport.ai_summary && (
                    <div className="p-4 rounded-xl bg-[#E8F5F1] border border-[#16836A]/30 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#103D35]">
                        <Bot className="w-4 h-4 text-[#16836A]" />
                        <span>Gemini AI Multimodal Triage Assessment</span>
                      </div>
                      <p className="text-slate-700 italic">"{trackingReport.ai_summary}"</p>
                    </div>
                  )}

                  {/* Field Resolution Evidence (When available) */}
                  {(trackingReport.resolution_notes || trackingReport.resolution_photo_signed_url) && (
                    <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-2">
                      <span className="text-xs font-bold text-[#103D35] uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#16836A]" />
                        Field Resolution Notes & Verification Evidence
                      </span>
                      {trackingReport.resolution_notes && (
                        <p className="text-xs text-slate-700 bg-[#F5F8F5] p-3 rounded-lg border border-[#DCE8E2]">
                          {trackingReport.resolution_notes}
                        </p>
                      )}
                      {trackingReport.resolution_photo_signed_url && (
                        <div className="rounded-lg overflow-hidden border border-[#DCE8E2] max-h-48 mt-2">
                          <img
                            src={trackingReport.resolution_photo_signed_url}
                            alt="Resolution Evidence"
                            className="w-full h-48 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real Lifecycle Timeline (Populated strictly from backend timestamps) */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Operational Lifecycle Timeline (Database Verified)
                      </h3>
                      <span className="text-[11px] text-[#16836A] font-semibold">
                        Auto-refreshing live
                      </span>
                    </div>

                    <div className="space-y-6 relative pl-6 border-l-2 border-[#DCE8E2] ml-4">
                      {(trackingReport.timeline || []).map((item, idx) => {
                        const itemState = item.state || (item.completed ? 'COMPLETED' : item.active ? 'CURRENT' : 'PENDING');
                        return (
                          <div key={item.stage || idx} className="relative">
                            <span
                              className={`absolute -left-[31px] top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                itemState === 'COMPLETED'
                                  ? 'bg-[#16836A] text-white shadow-sm'
                                  : itemState === 'CURRENT'
                                  ? 'bg-[#FF6848] text-white ring-2 ring-[#FF6848]/30 animate-pulse'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {itemState === 'COMPLETED' ? '✓' : idx + 1}
                            </span>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-xs font-bold ${itemState === 'COMPLETED' ? 'text-[#103D35]' : itemState === 'CURRENT' ? 'text-[#FF6848]' : 'text-slate-600'}`}>
                                  {item.title}
                                </p>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    itemState === 'COMPLETED'
                                      ? 'bg-[#E8F5F1] text-[#16836A]'
                                      : itemState === 'CURRENT'
                                      ? 'bg-orange-100 text-[#FF6848]'
                                      : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {itemState}
                                </span>
                                {(item.department || trackingReport.assigned_department) && (itemState === 'COMPLETED' || itemState === 'CURRENT') && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                    Dept: {item.department || trackingReport.assigned_department}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600">{item.description}</p>
                              {item.timestamp ? (
                                <p className="text-[10px] text-slate-400 font-mono">
                                  Verified timestamp: <strong className="text-slate-600">{formatDate(item.timestamp)}</strong>
                                </p>
                              ) : (
                                <p className="text-[10px] text-slate-400 italic">
                                  Pending stage completion
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ========================================================
              VIEW 5: NEARBY ISSUES (COMMUNITY CIVIC GRIEVANCES)
             ======================================================== */}
          {activeView === 'nearby-issues' && (
            <div className="space-y-6">
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE8E2]">
                  <div>
                    <h2 className="text-xl font-bold text-[#103D35]">Nearby Community Issues</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Civic waste complaints reported by residents in your ward and surrounding vicinity.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={fetchNearby}
                      leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingNearby ? 'animate-spin' : ''}`} />}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Filter by Municipal Ward
                    </label>
                    <Select value={nearbyWard} onChange={(e) => setNearbyWard(e.target.value)}>
                      <option value="">All Wards</option>
                      {WARDS_LIST.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Waste Category
                    </label>
                    <Select value={nearbyCategory} onChange={(e) => setNearbyCategory(e.target.value)}>
                      <option value="">All Categories</option>
                      {WASTE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Incident Status
                    </label>
                    <Select value={nearbyStatus} onChange={(e) => setNearbyStatus(e.target.value)}>
                      <option value="">All Statuses</option>
                      {REPORT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </Card>

              {loadingNearby ? (
                <Card variant="flat" className="p-12 bg-white flex justify-center">
                  <LoadingSpinner text="Loading community waste reports in your area..." />
                </Card>
              ) : nearbyReports.length === 0 ? (
                <Card variant="flat" className="p-8 bg-white">
                  <EmptyState
                    icon={<MapPin className="w-8 h-8 text-[#16836A]" />}
                    title="No Nearby Incidents Reported"
                    description={`There are currently zero active waste reports recorded in ${nearbyWard || 'the selected filter'}.`}
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nearbyReports.map((item) => (
                    <Card
                      key={item.id}
                      variant="flat"
                      className="p-5 bg-white border border-[#DCE8E2] space-y-3 flex flex-col justify-between hover:border-[#16836A]/40 transition-colors shadow-subtle"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-[#103D35]">
                            {formatReportNumber(item.report_number || item.id)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge priority={item.ai_priority || item.priority} size="sm" />
                            <Badge status={item.status} size="sm" />
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-slate-800">{item.waste_category}</h4>
                        <p className="text-xs text-slate-600 line-clamp-2 bg-[#F5F8F5] p-2.5 rounded-xl border border-[#DCE8E2]">
                          {item.description}
                        </p>

                        <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-[#DCE8E2]">
                          <div className="flex justify-between">
                            <span>
                              Ward: <strong className="text-slate-800">{item.ward || 'Central'}</strong>
                            </span>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                          <div>
                            Address: <strong className="text-slate-800">{item.address || 'Address recorded'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#DCE8E2] flex items-center justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setTrackingReport(item);
                            setActiveView('track-complaint');
                          }}
                          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                        >
                          View Status Timeline
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 5: NOTIFICATIONS (PERSISTENT OPERATIONAL ALERTS)
             ======================================================== */}
          {activeView === 'notifications' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8E2]">
                <div>
                  <h2 className="text-xl font-bold text-[#103D35]">Municipal Notifications</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official dispatch alerts, workflow assignments, and status updates for your submitted complaints.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
                    unreadNotifCount > 0 ? 'bg-[#FF6848] text-white' : 'bg-[#E8F5F1] text-[#16836A]'
                  }`}>
                    {unreadNotifCount} Unread
                  </span>
                  {unreadNotifCount > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await notificationService.markAllAsRead();
                        fetchNotifications();
                      }}
                    >
                      Mark All as Read
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchNotifications}
                    leftIcon={<RefreshCw className={`w-3 h-3 ${loadingNotifications ? 'animate-spin' : ''}`} />}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {loadingNotifications ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner text="Checking for new municipal updates..." />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={<Bell className="w-8 h-8 text-[#16836A]" />}
                  title="No Active Notifications"
                  description="You have no notifications at this time. As soon as a municipal officer accepts your assignment or updates clearance status, you will be alerted here."
                />
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => {
                    const isUnread = !n.is_read || n.is_read === 0;
                    return (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (isUnread) {
                            try {
                              await notificationService.markAsRead(n.id);
                              fetchNotifications();
                            } catch (e) {
                              console.error(e);
                            }
                          }
                          // If notification references a report, open Track Complaint
                          if (n.report_id) {
                            try {
                              const rep = await reportService.getReportById(String(n.report_id));
                              if (rep?.report) {
                                setTrackingReport(rep.report);
                                setActiveView('track-complaint');
                              }
                            } catch (err) {
                              console.error('Failed to open report from notification:', err);
                            }
                          }
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isUnread
                            ? 'bg-[#E9F5EF]/60 border-[#16836A]/40 shadow-sm hover:border-[#16836A]'
                            : 'bg-white border-[#DCE8E2] hover:bg-[#F5F8F5]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            n.type === 'REPORT_RESOLVED'
                              ? 'bg-emerald-100 text-[#16836A]'
                              : n.type === 'WORK_ASSIGNED' || n.type === 'WORK_ACCEPTED'
                              ? 'bg-blue-100 text-blue-700'
                              : n.type === 'WORK_STARTED' || n.type === 'WORK_COMPLETED'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {n.type === 'REPORT_RESOLVED' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : n.type === 'WORK_ASSIGNED' ? (
                              <UserCheck className="w-4 h-4" />
                            ) : n.type === 'WORK_STARTED' ? (
                              <Truck className="w-4 h-4" />
                            ) : (
                              <Bell className="w-4 h-4" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-bold ${isUnread ? 'text-[#103D35]' : 'text-slate-800'}`}>
                                {n.title}
                              </h4>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-[#FF6848] shrink-0" />
                              )}
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-semibold">
                                {n.type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] text-slate-400 font-mono pt-0.5">
                              {formatDate(n.created_at)}
                              {n.report_number && ` • WM-${String(n.report_number).padStart(4, '0')}`}
                            </p>
                          </div>
                        </div>

                        {n.report_id && (
                          <div className="shrink-0 flex items-center text-[11px] font-semibold text-[#16836A] hover:underline gap-1">
                            <span>Track</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ========================================================
              VIEW 6: CITIZEN PROFILE
             ======================================================== */}
          {activeView === 'profile' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#103D35]">Citizen Civic Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified resident details and registered municipal jurisdiction.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#DCE8E2] text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Full Name</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{user?.full_name || 'N/A'}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Email Address</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{user?.email}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Assigned Ward</span>
                  <p className="text-sm font-semibold text-[#16836A] mt-1">{user?.ward || 'Ward 1 - Central Market'}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Municipality</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {user?.municipality || 'Central Municipal Corporation'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Security Clearance</span>
                  <div className="mt-1">
                    <Badge role="citizen" size="sm" />
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Registration Status</span>
                  <div className="mt-1">
                    <Badge status="Approved" size="sm" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#DCE8E2] flex items-center justify-between">
                <span className="text-xs text-slate-500">Sign out of your citizen account safely:</span>
                <Button
                  variant="coral"
                  size="md"
                  onClick={handleConfirmLogout}
                  leftIcon={<LogOut className="w-4 h-4" />}
                >
                  Sign Out of Session
                </Button>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};
