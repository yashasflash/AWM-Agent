import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { reportService } from '../../services/reportService';
import { authService } from '../../services/authService';
import { WasteReport, ManagerStats } from '../../types/report';
import { AppNotification } from '../../types/notification';
import { notificationService } from '../../services/notificationService';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Input, Select } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/Loading';
import { AlertBanner } from '../../components/common/Error';
import { EmptyState } from '../../components/common/EmptyState';
import { AssignStaffModal } from './AssignStaffModal';
import { PendingApprovalsModal } from './PendingApprovalsModal';
import { VerifyResolutionModal } from './VerifyResolutionModal';
import { ReportDetailModal } from '../citizen/ReportDetailModal';
import { OperationsMap } from '../../components/common/OperationsMap';
import { formatReportNumber, formatDate } from '../../utils/formatters';
import { REPORT_STATUSES, WARDS_LIST, MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Building2,
  Truck,
  BarChart2,
  Bell,
  Settings,
  RefreshCw,
  Search,
  CheckCircle2,
  UserCheck,
  Send,
  ChevronRight,
  MapPin,
  LogOut,
  ShieldCheck,
  Filter,
  Check,
  Map,
} from 'lucide-react';

type ManagerView =
  | 'overview'
  | 'reports'
  | 'incidents'
  | 'operations-map'
  | 'departments'
  | 'collection-tasks'
  | 'analytics'
  | 'notifications'
  | 'settings';

export const ManagerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError } = useToast();

  const handleConfirmLogout = () => {
    if (window.confirm('Are you sure you want to sign out of your Operations Manager session?')) {
      logout();
      navigate('/', { replace: true });
    }
  };

  const [activeView, setActiveView] = useState<ManagerView>('overview');

  // Sync ?view= from top-right header menu
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    if (
      viewParam &&
      [
        'overview',
        'reports',
        'incidents',
        'operations-map',
        'departments',
        'collection-tasks',
        'analytics',
        'notifications',
        'settings',
      ].includes(viewParam)
    ) {
      setActiveView(viewParam as ManagerView);
    }
  }, [location.search]);

  const [reports, setReports] = useState<WasteReport[]>([]);
  const [stats, setStats] = useState<ManagerStats>({
    total: 0,
    pending: 0,
    under_review: 0,
    in_progress: 0,
    resolved: 0,
    high_priority: 0,
    assigned_to_staff: 0,
  });
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority'>('newest');

  // Coordination & Map display mode states
  const [coordinationFilter, setCoordinationFilter] = useState<
    'unassigned' | 'in_progress' | 'pending_verification' | 'all'
  >('unassigned');
  const [reportsDisplayMode, setReportsDisplayMode] = useState<'table' | 'map'>('table');

  // Modals state
  const [assigningReport, setAssigningReport] = useState<WasteReport | null>(null);
  const [verifyingReport, setVerifyingReport] = useState<WasteReport | null>(null);
  const [isApprovalsModalOpen, setIsApprovalsModalOpen] = useState(false);
  const [inspectingReportId, setInspectingReportId] = useState<string | number | null>(null);

  // Persistent Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await notificationService.getNotifications(20);
      setNotifications(res.notifications || []);
      setUnreadNotifCount(res.unread_count || 0);
    } catch (err) {
      console.warn('Failed to load manager notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const fetchManagerData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Parallel loading: fetch reports and pending staff approval count concurrently
      const [reportsResult, approvalsResult] = await Promise.allSettled([
        reportService.getManagerReports({
          page: 1,
          limit: 25,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          ai_priority: priorityFilter || undefined,
          ward: wardFilter || undefined,
          sort,
        }),
        authService.getPendingApprovals(),
      ]);

      if (reportsResult.status === 'fulfilled') {
        const reportsRes = reportsResult.value;
        setReports(reportsRes.reports || []);
        setStats(
          reportsRes.stats || {
            total: 0,
            pending: 0,
            under_review: 0,
            in_progress: 0,
            resolved: 0,
            high_priority: 0,
            assigned_to_staff: 0,
          }
        );
      } else {
        const msg =
          reportsResult.reason instanceof Error
            ? reportsResult.reason.message
            : 'Could not fetch operational management data.';
        setErrorMessage(msg);
      }

      if (approvalsResult.status === 'fulfilled') {
        setPendingApprovalsCount(approvalsResult.value.length);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, wardFilter, sort]);

  useEffect(() => {
    fetchManagerData();
  }, [fetchManagerData]);

  // Exact 9-Item Navigation matching prompt requirements
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4 text-[#E76F51]" /> },
    { id: 'operations-map', label: 'Operations Map', icon: <Map className="w-4 h-4 text-[#16836A]" /> },
    { id: 'departments', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
    { id: 'collection-tasks', label: 'Collection Tasks', icon: <Truck className="w-4 h-4 text-[#16836A]" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  // Specific Categorizations for Coordination
  const unassignedReports = useMemo(
    () => reports.filter((r) => !r.assigned_staff && !r.assigned_staff_id && r.status !== 'Resolved'),
    [reports]
  );
  const pendingVerificationReports = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.lifecycle_stage === 'RESOLUTION_SUBMITTED' ||
          (r.status === 'Under Review' && r.resolution_notes)
      ),
    [reports]
  );
  const activeDispatchedTasks = useMemo(
    () =>
      reports.filter(
        (r) =>
          (r.assigned_staff || r.assigned_staff_id) &&
          r.status !== 'Resolved' &&
          r.lifecycle_stage !== 'RESOLUTION_SUBMITTED'
      ),
    [reports]
  );

  // Unresolved & High Priority Incidents
  const unresolvedIncidents = useMemo(
    () => reports.filter((r) => r.status !== 'Resolved'),
    [reports]
  );
  const highPriorityIncidents = useMemo(
    () => reports.filter((r) => (r.ai_priority || r.priority) === 'HIGH' && r.status !== 'Resolved'),
    [reports]
  );

  // Department Workloads
  const deptWorkloads = useMemo(() => {
    const counts: Record<string, number> = {};
    MUNICIPAL_DEPARTMENTS.forEach((d) => (counts[d] = 0));
    reports.forEach((r) => {
      const dept = r.assigned_department || r.ai_department || 'Solid Waste Management';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [reports]);

  // Analytics: Priority Data
  const priorityChartData = useMemo(() => {
    let high = 0,
      med = 0,
      low = 0;
    reports.forEach((r) => {
      const p = (r.ai_priority || r.priority || 'LOW').toUpperCase();
      if (p === 'HIGH') high++;
      else if (p === 'MEDIUM') med++;
      else low++;
    });
    return [
      { name: 'High Priority', count: high, fill: '#E76F51' },
      { name: 'Medium Priority', count: med, fill: '#F59E0B' },
      { name: 'Low Priority', count: low, fill: '#16836A' },
    ];
  }, [reports]);

  // Analytics: Status Distribution Pie
  const statusPieData = useMemo(() => {
    return [
      { name: 'Pending Intake', value: stats.pending || 0, color: '#E76F51' },
      { name: 'In Progress', value: stats.in_progress || 0, color: '#F59E0B' },
      { name: 'Resolved', value: stats.resolved || 0, color: '#16836A' },
    ].filter((d) => d.value > 0);
  }, [stats]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Assign Modal */}
      {assigningReport && (
        <AssignStaffModal
          report={assigningReport}
          isOpen={!!assigningReport}
          onClose={() => setAssigningReport(null)}
          onAssigned={() => {
            fetchManagerData();
            success('Work order assigned successfully.');
          }}
        />
      )}

      {/* Staff Approvals Modal */}
      <PendingApprovalsModal
        isOpen={isApprovalsModalOpen}
        onClose={() => setIsApprovalsModalOpen(false)}
        onUpdated={fetchManagerData}
      />

      {/* Verify Resolution Modal */}
      {verifyingReport && (
        <VerifyResolutionModal
          report={verifyingReport}
          isOpen={!!verifyingReport}
          onClose={() => setVerifyingReport(null)}
          onVerified={() => {
            fetchManagerData();
          }}
        />
      )}

      {/* Inspect Single Report Modal */}
      {inspectingReportId && (
        <ReportDetailModal
          reportId={inspectingReportId}
          isOpen={!!inspectingReportId}
          onClose={() => setInspectingReportId(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DCE8E2]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#103D35] tracking-tight">
              Executive Command Center
            </h1>
            <Badge role="manager" size="sm" />
            {user?.manager_id && (
              <span className="text-xs font-mono font-bold bg-[#103D35] text-white px-2.5 py-0.5 rounded-full">
                {user.manager_id}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manager: <strong className="text-slate-800">{user?.full_name}</strong> • Organization:{' '}
            <span className="text-[#103D35] font-semibold">{user?.organization || 'Central Municipality'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingApprovalsCount > 0 && (
            <Button
              variant="coral"
              size="sm"
              onClick={() => setIsApprovalsModalOpen(true)}
              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            >
              Pending Approvals ({pendingApprovalsCount})
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchManagerData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Main Grid: 8-Item Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-2">
          <div className="bg-white rounded-2xl border border-[#DCE8E2] shadow-card p-3 space-y-1">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Executive Navigation
            </p>
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id as ManagerView)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-[#103D35] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#103D35] hover:bg-[#F5F8F5]'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.id === 'incidents' && highPriorityIncidents.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#E76F51] text-white">
                      {highPriorityIncidents.length}
                    </span>
                  )}
                  {item.id === 'notifications' && unreadNotifCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#FF6848] text-white animate-pulse">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* SLA Quick Status */}
          <div className="p-4 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] text-xs space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">SLA Dispatch Rate</span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#103D35]">Active Incidents</span>
              <span className="font-mono font-bold text-[#E76F51]">{unresolvedIncidents.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#103D35]">Resolution Rate</span>
              <span className="font-mono font-bold text-[#16836A]">
                {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="lg:col-span-9 space-y-6">
          {errorMessage && <AlertBanner variant="error" message={errorMessage} onRetry={fetchManagerData} />}

          {/* ========================================================
              VIEW 1: OVERVIEW
             ======================================================== */}
          {activeView === 'overview' && (
            <div className="space-y-6">
              {/* Actual KPI Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card variant="flat" className="p-5 border-l-4 border-l-[#103D35] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Total Reports</span>
                    <FileText className="w-4 h-4 text-[#103D35]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#103D35] mt-2">{stats.total}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">City-wide grievances</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#E76F51] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Unresolved Incidents</span>
                    <AlertTriangle className="w-4 h-4 text-[#E76F51]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#E76F51] mt-2">{unresolvedIncidents.length}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pending collection</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#F59E0B] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>In Progress</span>
                    <Truck className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#F59E0B] mt-2">{stats.in_progress}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Field teams dispatched</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#16836A] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Completed Tasks</span>
                    <CheckCircle2 className="w-4 h-4 text-[#16836A]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#16836A] mt-2">{stats.resolved}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Verified resolutions</p>
                </Card>
              </div>

              {/* High-Priority Attention Alert */}
              {highPriorityIncidents.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-[#E76F51]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-[#E76F51]">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <span className="font-bold">Urgent Action:</span> {highPriorityIncidents.length} high-priority
                      complaint(s) require immediate department triage.
                    </div>
                  </div>
                  <Button variant="coral" size="sm" onClick={() => setActiveView('incidents')}>
                    Triage Incidents
                  </Button>
                </div>
              )}

              {/* ========================================================
                  ASSIGNMENT & WORK COORDINATION SECTION
                 ======================================================== */}
              <Card variant="flat" className="p-6 bg-white space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE8E2]">
                  <div>
                    <h3 className="text-base font-bold text-[#103D35] flex items-center gap-2">
                      <Truck className="w-5 h-5 text-[#16836A]" />
                      Assignment & Work Coordination
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Identify unassigned citizen grievances, dispatch to authorized municipal officers, and verify resolutions.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={fetchManagerData}
                      leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Coordination Filter Tabs */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setCoordinationFilter('unassigned')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      coordinationFilter === 'unassigned'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>Unassigned Reports</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        unassignedReports.length > 0
                          ? 'bg-[#E76F51] text-white'
                          : coordinationFilter === 'unassigned'
                          ? 'bg-white/20 text-white'
                          : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {unassignedReports.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCoordinationFilter('pending_verification')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      coordinationFilter === 'pending_verification'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>Pending Verification</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        pendingVerificationReports.length > 0
                          ? 'bg-[#FF6848] text-white'
                          : coordinationFilter === 'pending_verification'
                          ? 'bg-white/20 text-white'
                          : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {pendingVerificationReports.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCoordinationFilter('in_progress')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      coordinationFilter === 'in_progress'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>Active Dispatches</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        coordinationFilter === 'in_progress' ? 'bg-white/20 text-white' : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {activeDispatchedTasks.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCoordinationFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      coordinationFilter === 'all'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>All Reports</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        coordinationFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {reports.length}
                    </span>
                  </button>
                </div>

                {/* Tab Content */}
                {loading ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner text="Loading coordination records..." />
                  </div>
                ) : coordinationFilter === 'unassigned' ? (
                  unassignedReports.length === 0 ? (
                    <EmptyState
                      icon={<CheckCircle2 className="w-8 h-8 text-[#16836A]" />}
                      title="All Reports Dispatched"
                      description="Every logged citizen grievance has an assigned municipal department or staff officer."
                    />
                  ) : (
                    <div className="divide-y divide-[#DCE8E2]">
                      {unassignedReports.map((r) => (
                        <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#103D35]">
                                {formatReportNumber(r.report_number || r.id)}
                              </span>
                              <Badge priority={r.ai_priority || r.priority} size="sm" />
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Unassigned
                              </span>
                            </div>
                            <p className="font-semibold text-slate-800">{r.waste_category}</p>
                            <p className="text-slate-600 line-clamp-1">{r.description}</p>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>Ward: <strong>{r.ward || 'Central'}</strong></span>
                              <span>• Logged {formatDate(r.created_at)}</span>
                              {r.ai_department && (
                                <span className="text-[#16836A] font-semibold">
                                  Rec. Dept: {r.ai_department}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setInspectingReportId(r.id)}
                            >
                              Inspect Details
                            </Button>
                            <Button
                              variant="emerald"
                              size="sm"
                              onClick={() => setAssigningReport(r)}
                              leftIcon={<Send className="w-3.5 h-3.5" />}
                            >
                              Assign / Dispatch
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : coordinationFilter === 'pending_verification' ? (
                  pendingVerificationReports.length === 0 ? (
                    <EmptyState
                      icon={<ShieldCheck className="w-8 h-8 text-[#16836A]" />}
                      title="No Resolutions Awaiting Verification"
                      description="All completed municipal work orders have been approved and verified."
                    />
                  ) : (
                    <div className="divide-y divide-[#DCE8E2]">
                      {pendingVerificationReports.map((r) => (
                        <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#103D35]">
                                {formatReportNumber(r.report_number || r.id)}
                              </span>
                              <Badge status="Under Review" size="sm" />
                              <span className="text-[10px] font-bold text-[#FF6848] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Verification Required
                              </span>
                            </div>
                            <p className="font-semibold text-slate-800">{r.waste_category}</p>
                            {r.resolution_notes && (
                              <p className="text-xs text-slate-700 bg-[#F5F8F5] p-2 rounded border border-[#DCE8E2]">
                                <strong>Officer Note:</strong> {r.resolution_notes}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500">
                              Officer: <strong>{r.assigned_staff_name || r.assigned_staff || 'Staff'}</strong> • Location:{' '}
                              <strong>{r.ward || r.address || 'Central'}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setInspectingReportId(r.id)}
                            >
                              View Details
                            </Button>
                            <Button
                              variant="coral"
                              size="sm"
                              onClick={() => setVerifyingReport(r)}
                              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            >
                              Verify Resolution
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : coordinationFilter === 'in_progress' ? (
                  activeDispatchedTasks.length === 0 ? (
                    <EmptyState
                      icon={<Truck className="w-8 h-8 text-[#16836A]" />}
                      title="No Active Field Tasks"
                      description="No collection tasks are currently marked in progress."
                    />
                  ) : (
                    <div className="divide-y divide-[#DCE8E2]">
                      {activeDispatchedTasks.map((r) => (
                        <div key={r.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#103D35]">
                                {formatReportNumber(r.report_number || r.id)}
                              </span>
                              <Badge priority={r.ai_priority || r.priority} size="sm" />
                              <Badge status={r.status} size="sm" />
                            </div>
                            <p className="font-semibold text-slate-800">{r.waste_category}</p>
                            <p className="text-[11px] text-slate-500">
                              Assigned Officer: <strong className="text-[#16836A]">{r.assigned_staff_name || r.assigned_staff}</strong> • Dept: {r.assigned_department || 'Cleansing'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setInspectingReportId(r.id)}>
                              Inspect
                            </Button>
                            <Button variant="emerald" size="sm" onClick={() => setAssigningReport(r)}>
                              Reassign
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="divide-y divide-[#DCE8E2]">
                    {reports.slice(0, 10).map((r) => (
                      <div key={r.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#103D35]">
                              {formatReportNumber(r.report_number || r.id)}
                            </span>
                            <Badge priority={r.ai_priority || r.priority} size="sm" />
                            <Badge status={r.status} size="sm" />
                          </div>
                          <p className="font-semibold text-slate-800">{r.waste_category}</p>
                          <p className="text-[11px] text-slate-500">
                            Location: {r.ward || r.address || 'Central'} • Logged {formatDate(r.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setInspectingReportId(r.id)}>
                            Inspect
                          </Button>
                          {r.status !== 'Resolved' && (
                            <Button variant="emerald" size="sm" onClick={() => setAssigningReport(r)} leftIcon={<Send className="w-3.5 h-3.5" />}>
                              {r.assigned_staff ? 'Reassign' : 'Assign'}
                            </Button>
                          )}
                          {(r.lifecycle_stage === 'RESOLUTION_SUBMITTED' || (r.status === 'Under Review' && r.resolution_notes)) && (
                            <Button variant="coral" size="sm" onClick={() => setVerifyingReport(r)}>
                              Verify
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 2: REPORTS (FULL FILTERABLE TABLE + MAP TOGGLE)
             ======================================================== */}
          {activeView === 'reports' && (
            <div className="space-y-4">
              <Card variant="flat" className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
                  <Input
                    placeholder="Search by ID or description..."
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
                  <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                    <option value="">All Priorities</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </Select>
                  <Select value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}>
                    <option value="">All Wards</option>
                    {WARDS_LIST.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center gap-1.5 border border-[#DCE8E2] rounded-xl p-1 bg-[#F5F8F5]">
                  <button
                    type="button"
                    onClick={() => setReportsDisplayMode('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportsDisplayMode === 'table'
                        ? 'bg-white text-[#103D35] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportsDisplayMode('map')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      reportsDisplayMode === 'map'
                        ? 'bg-white text-[#16836A] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#16836A]" />
                    Operations Map
                  </button>
                </div>
              </Card>

              {reportsDisplayMode === 'map' ? (
                <OperationsMap
                  reports={reports}
                  selectedReport={null}
                  onSelectReport={(r) => setInspectingReportId(r.id)}
                  onAssignReport={(r) => setAssigningReport(r)}
                  onVerifyReport={(r) => setVerifyingReport(r)}
                  role="manager"
                  title="Operations Command Geospatial Map"
                  subtitle="Visual tracking of all civic incidents plotted with actual GPS coordinates"
                  heightClass="h-[650px]"
                  onRefresh={fetchManagerData}
                />
              ) : (
                <Card variant="flat" className="bg-white overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-[#F5F8F5] border-b border-[#DCE8E2] text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Report ID</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Ward</th>
                          <th className="px-4 py-3">Priority</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Assigned Staff</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE8E2]">
                        {reports.map((r) => (
                          <tr key={r.id} className="hover:bg-[#F5F8F5]/50">
                            <td className="px-4 py-3 font-mono font-bold text-[#103D35]">
                              {formatReportNumber(r.report_number || r.id)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{r.waste_category}</td>
                            <td className="px-4 py-3 text-slate-600">{r.ward || 'Central'}</td>
                            <td className="px-4 py-3">
                              <Badge priority={r.ai_priority || r.priority} size="sm" />
                            </td>
                            <td className="px-4 py-3">
                              <Badge status={r.status} size="sm" />
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                              {r.assigned_staff_name || r.assigned_staff || r.assigned_staff_id || (
                                <span className="text-amber-600 font-sans italic">Unassigned</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button variant="secondary" size="sm" onClick={() => setInspectingReportId(r.id)}>
                                  View
                                </Button>
                                {(r.lifecycle_stage === 'RESOLUTION_SUBMITTED' || (r.status === 'Under Review' && r.resolution_notes)) && (
                                  <Button variant="coral" size="sm" onClick={() => setVerifyingReport(r)}>
                                    Verify
                                  </Button>
                                )}
                                {r.status !== 'Resolved' && (
                                  <Button variant="emerald" size="sm" onClick={() => setAssigningReport(r)}>
                                    {r.assigned_staff ? 'Reassign' : 'Dispatch'}
                                  </Button>
                                )}
                                {r.status === 'Resolved' && (
                                  <span className="text-[10px] font-bold text-[#16836A] bg-[#E8F5F1] px-2 py-0.5 rounded">
                                    ✓ Closed
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 3: INCIDENTS (HIGH PRIORITY & UNRESOLVED)
             ======================================================== */}
          {activeView === 'incidents' && (
            <div className="space-y-4">
              <Card variant="flat" className="p-5 bg-white space-y-1">
                <h2 className="text-base font-bold text-[#103D35]">Active Incidents Triage</h2>
                <p className="text-xs text-slate-500">
                  Complaints requiring managerial dispatch, departmental routing, or status intervention.
                </p>
              </Card>

              {unresolvedIncidents.map((inc) => (
                <Card key={inc.id} variant="flat" className="p-5 bg-white border border-[#DCE8E2] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#103D35]">
                        {formatReportNumber(inc.report_number || inc.id)}
                      </span>
                      <Badge priority={inc.ai_priority || inc.priority} size="sm" />
                      <Badge status={inc.status} size="sm" />
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(inc.created_at)}</span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">"{inc.description}"</p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DCE8E2] text-xs">
                    <div className="text-slate-500">
                      Ward: <strong>{inc.ward || 'Central'}</strong> • Department:{' '}
                      <strong className="text-[#103D35]">
                        {inc.assigned_department || inc.ai_department || 'Pending'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setInspectingReportId(inc.id)}>
                        Inspect
                      </Button>
                      <Button variant="coral" size="sm" onClick={() => setAssigningReport(inc)}>
                        Assign Department & Staff
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ========================================================
              VIEW 4: OPERATIONS MAP
             ======================================================== */}
          {activeView === 'operations-map' && (
            <div className="space-y-4">
              <OperationsMap
                reports={reports}
                onSelectReport={(r) => setInspectingReportId(r.id)}
                onAssignReport={(r) => setAssigningReport(r)}
                onVerifyReport={(r) => setVerifyingReport(r)}
                role="manager"
                title="Municipal Operations Command Map"
                subtitle="Live geolocated citizen waste reports, status filters, and real-time dispatches."
                onRefresh={fetchManagerData}
              />
            </div>
          )}

          {/* ========================================================
              VIEW 5: DEPARTMENTS (WORKLOADS & DIRECTORY)
             ======================================================== */}
          {activeView === 'departments' && (
            <div className="space-y-6">
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <h2 className="text-base font-bold text-[#103D35]">Department Workload Distribution</h2>
                <p className="text-xs text-slate-500">Real-time incident allocation across specialized divisions.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {deptWorkloads.map((d, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-[#DCE8E2] bg-[#F5F8F5] text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#103D35]">{d.name}</span>
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-white text-[#16836A] border border-[#DCE8E2]">
                          {d.count} Tasks
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">Specialized waste processing and clearance unit.</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 5: COLLECTION TASKS
             ======================================================== */}
          {activeView === 'collection-tasks' && (
            <Card variant="flat" className="p-6 bg-white space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE8E2]">
                <h2 className="text-base font-bold text-[#103D35]">Municipal Collection Tasks</h2>
                <span className="text-xs text-slate-500">
                  {reports.filter((r) => r.assigned_staff_id).length} active work orders dispatched
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#F5F8F5] border-b border-[#DCE8E2] text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Task ID</th>
                      <th className="px-4 py-3">Ward</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Field Staff</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Dispatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE8E2]">
                    {reports.map((t) => (
                      <tr key={t.id} className="hover:bg-[#F5F8F5]/50">
                        <td className="px-4 py-3 font-mono font-bold text-[#103D35]">
                          {formatReportNumber(t.report_number || t.id)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{t.ward || 'Central'}</td>
                        <td className="px-4 py-3 text-slate-600">{t.assigned_department || 'General Cleansing'}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-[#16836A]">
                          {t.assigned_staff_name || t.assigned_staff_id || 'Pending Assign'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={t.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="secondary" size="sm" onClick={() => setAssigningReport(t)}>
                            Reassign
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ========================================================
              VIEW 6: ANALYTICS (RECHARTS SUITE)
             ======================================================== */}
          {activeView === 'analytics' && (
            <div className="space-y-6">
              {/* Incidents by Priority */}
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <h3 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">
                  Incidents by Priority (Gemini AI Vision Triage)
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priorityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#DCE8E2" />
                      <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                      <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {priorityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Tasks by Status Pie */}
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <h3 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">
                  Operational Task Status Breakdown
                </h3>
                <div className="h-60 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 7: NOTIFICATIONS (PERSISTENT OPERATIONAL ALERTS)
             ======================================================== */}
          {activeView === 'notifications' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8E2]">
                <div>
                  <h2 className="text-base font-bold text-[#103D35]">Executive Operations Alerts</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time municipal grievance logs, field completion submissions, and automated triage escalations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
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
                  <LoadingSpinner text="Checking operational notifications..." />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={<Bell className="w-8 h-8 text-[#103D35]" />}
                  title="System Notifications Clear"
                  description="Zero outstanding executive security alerts or abnormal grievance escalations."
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
                          if (n.report_id) {
                            setInspectingReportId(n.report_id);
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
                            n.type === 'VERIFICATION_REQUIRED'
                              ? 'bg-amber-100 text-amber-700'
                              : n.type === 'REPORT_SUBMITTED'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-[#16836A]'
                          }`}>
                            {n.type === 'VERIFICATION_REQUIRED' ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : n.type === 'REPORT_SUBMITTED' ? (
                              <FileText className="w-4 h-4" />
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
                            <span>Inspect</span>
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
              VIEW 8: SETTINGS & STAFF APPROVALS
             ======================================================== */}
          {activeView === 'settings' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-6">
              <div>
                <h2 className="text-base font-bold text-[#103D35]">System Settings & Administration</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage municipal staff authorisations and profile display preferences.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#F5F8F5] border border-[#DCE8E2] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-[#103D35]">Staff Authorization Requests</p>
                  <p className="text-slate-500 text-[11px]">
                    Review and authorize pending municipal cleansing officer registrations.
                  </p>
                </div>
                <Button variant="coral" size="sm" onClick={() => setIsApprovalsModalOpen(true)}>
                  Manage Approvals ({pendingApprovalsCount})
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#DCE8E2] text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Manager Name</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{user?.full_name}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Registered Manager ID</span>
                  <p className="text-sm font-mono font-bold text-[#103D35] mt-1">{user?.manager_id || 'MGR-10001'}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Organization</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {user?.organization || 'Central Municipality'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Authority Tier</span>
                  <div className="mt-1">
                    <Badge role="manager" size="sm" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#DCE8E2] flex items-center justify-between">
                <span className="text-xs text-slate-500">End your operations command session safely:</span>
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
