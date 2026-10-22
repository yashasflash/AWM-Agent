import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { reportService } from '../../services/reportService';
import { notificationService } from '../../services/notificationService';
import { useToast } from '../../hooks/useToast';
import { WasteReport, StaffStats } from '../../types/report';
import { AppNotification } from '../../types/notification';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Input, Select, Textarea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/Loading';
import { AlertBanner } from '../../components/common/Error';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import { OperationsMap } from '../../components/common/OperationsMap';
import { formatReportNumber, formatDate } from '../../utils/formatters';
import { WARDS_LIST, MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  LayoutDashboard,
  AlertTriangle,
  FileText,
  MapPin,
  Truck,
  Building2,
  BarChart2,
  Bell,
  Building,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Bot,
  Filter,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Car,
  LogOut,
  Briefcase,
  Play,
  Check,
  Map,
} from 'lucide-react';

type MunicipalView =
  | 'overview'
  | 'incidents'
  | 'reports'
  | 'operations-map'
  | 'areas-wards'
  | 'my-assigned-work'
  | 'collection-tasks'
  | 'vehicles'
  | 'departments'
  | 'analytics'
  | 'notifications'
  | 'org-profile';

export const StaffDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError } = useToast();

  const handleConfirmLogout = () => {
    if (window.confirm('Are you sure you want to sign out of your Municipal Staff session?')) {
      logout();
      navigate('/', { replace: true });
    }
  };

  const [activeView, setActiveView] = useState<MunicipalView>('overview');

  // Synchronize ?view= from header profile dropdown or internal links
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    if (viewParam) {
      if (
        [
          'overview',
          'incidents',
          'reports',
          'operations-map',
          'areas-wards',
          'my-assigned-work',
          'collection-tasks',
          'vehicles',
          'departments',
          'analytics',
          'notifications',
          'org-profile',
        ].includes(viewParam)
      ) {
        setActiveView(viewParam as MunicipalView);
      }
    }
  }, [location.search]);

  // Work Orders & Reports State
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [stats, setStats] = useState<StaffStats>({
    total_assigned: 0,
    awaiting_action: 0,
    in_progress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Work Order Filter & Map Display Mode
  const [workFilter, setWorkFilter] = useState<'all' | 'pending_accept' | 'in_progress' | 'completed'>('all');
  const [reportsDisplayMode, setReportsDisplayMode] = useState<'table' | 'map'>('table');

  // Selected work order for modal
  const [selectedReport, setSelectedReport] = useState<WasteReport | null>(null);

  // Quick Action State for Updating Work Order
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getStaffAssignedReports({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setReports(res.reports || []);
      setStats(
        res.stats || {
          total_assigned: 0,
          awaiting_action: 0,
          in_progress: 0,
          completed: 0,
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not retrieve staff work orders.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Persistent Notifications State & Polling
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
      console.warn('Failed to load municipal notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Quick Action 1: Staff Accepts Assignment
  const handleAcceptAssignment = async (order: WasteReport) => {
    setActionLoadingId(order.id);
    try {
      await reportService.acceptStaffAssignment(order.id);
      success(`Assignment #${order.report_number} accepted. Ready to start clearance.`);
      await fetchWorkOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept assignment.';
      toastError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick Action 2: Staff Starts Field Work
  const handleStartWork = async (order: WasteReport) => {
    setActionLoadingId(order.id);
    try {
      await reportService.startStaffWork(order.id);
      success(`Work started for #${order.report_number}. Status updated to In Progress.`);
      await fetchWorkOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start work.';
      toastError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Exact 12-Item Navigation matching Part 12 prompt requirements
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4 text-[#E76F51]" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'operations-map', label: 'Operations Map', icon: <Map className="w-4 h-4 text-[#16836A]" /> },
    { id: 'areas-wards', label: 'Areas & Wards', icon: <Building2 className="w-4 h-4" /> },
    { id: 'my-assigned-work', label: 'My Assigned Work', icon: <Briefcase className="w-4 h-4 text-[#FF6848]" /> },
    { id: 'collection-tasks', label: 'Collection Tasks', icon: <Truck className="w-4 h-4 text-[#16836A]" /> },
    { id: 'vehicles', label: 'Vehicles', icon: <Car className="w-4 h-4" /> },
    { id: 'departments', label: 'Departments', icon: <Building className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
    },
    { id: 'org-profile', label: 'Organization Profile', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  // Extract actual vehicle/staff assignments from real backend collection tasks
  const activeAssignedVehicles = reports
    .filter((r) => r.assigned_staff || r.assigned_staff_name || (r as any).assigned_task?.assigned_vehicle)
    .map((r) => ({
      id: (r as any).assigned_task?.task_number || `TASK-${r.report_number}`,
      reportRef: formatReportNumber(r.report_number || r.id),
      staffOrVehicle: r.assigned_staff_name || r.assigned_staff || (r as any).assigned_task?.assigned_vehicle || 'Assigned Crew',
      department: r.assigned_department || (r as any).assigned_task?.department || 'Solid Waste Management',
      zone: r.ward || 'Central District',
      status: r.status,
    }));

  // Recharts Data Prep
  const categoryCounts = reports.reduce<Record<string, number>>((acc, r) => {
    const cat = r.waste_category || 'General';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const chartCategoryData = Object.entries(categoryCounts).map(([name, count]) => ({ name, count }));

  const statusPieData = [
    { name: 'Submitted / Awaiting', value: stats.awaiting_action || 0, color: '#E76F51' },
    { name: 'In Progress', value: stats.in_progress || 0, color: '#F59E0B' },
    { name: 'Resolved', value: stats.completed || 0, color: '#16836A' },
  ].filter((d) => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Work Order Modal */}
      {selectedReport && (
        <WorkOrderDetailModal
          report={selectedReport}
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdated={fetchWorkOrders}
        />
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DCE8E2]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#103D35] tracking-tight">
              Municipal Operations Console
            </h1>
            <Badge role="municipal_staff" size="sm" />
            {user?.staff_id && (
              <span className="text-xs font-mono font-bold bg-[#16836A] text-white px-2.5 py-0.5 rounded-full">
                {user.staff_id}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Officer: <strong className="text-slate-800">{user?.full_name}</strong> • Department:{' '}
            <span className="text-[#16836A] font-semibold">{user?.organization || 'Solid Waste Management'}</span> • District:{' '}
            <span className="text-slate-700 font-semibold">{user?.district || 'Central District'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchWorkOrders}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Sync Orders
          </Button>
        </div>
      </div>

      {/* Main Grid: 10-Item Sidebar + View Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Sidebar */}
        <aside className="lg:col-span-3 space-y-2">
          <div className="bg-white rounded-2xl border border-[#DCE8E2] shadow-card p-3 space-y-1">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operations Navigation
            </p>
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id as MunicipalView)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-[#16836A] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#103D35] hover:bg-[#F5F8F5]'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.id === 'collection-tasks' && stats.total_assigned > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#E8F5F1] text-[#16836A]'
                      }`}
                    >
                      {stats.total_assigned}
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#FF6848] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Authority Badge */}
          <div className="p-4 rounded-2xl bg-white border border-[#DCE8E2] shadow-subtle text-xs space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Municipal Authority</span>
            <p className="font-bold text-[#103D35]">{user?.organization || 'Central Municipality'}</p>
            <p className="text-[11px] text-slate-500">Jurisdiction: {user?.district || 'Central District'}</p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="lg:col-span-9 space-y-6">
          {error && <AlertBanner variant="error" message={error} onRetry={fetchWorkOrders} />}

          {/* ========================================================
              VIEW 1: OVERVIEW
             ======================================================== */}
          {activeView === 'overview' && (
            <div className="space-y-6">
              {/* Actual Operational Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card variant="flat" className="p-5 border-l-4 border-l-[#103D35] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Assigned Tasks</span>
                    <Truck className="w-4 h-4 text-[#103D35]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#103D35] mt-2">{stats.total_assigned}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assigned work orders</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#E76F51] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Awaiting Action</span>
                    <Clock className="w-4 h-4 text-[#E76F51]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#E76F51] mt-2">{stats.awaiting_action}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Requires crew dispatch</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#F59E0B] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>In Progress</span>
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#F59E0B] mt-2">{stats.in_progress}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Active collection on site</p>
                </Card>

                <Card variant="flat" className="p-5 border-l-4 border-l-[#16836A] bg-white">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                    <span>Resolved</span>
                    <CheckCircle2 className="w-4 h-4 text-[#16836A]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-[#16836A] mt-2">{stats.completed}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Cleared & verified</p>
                </Card>
              </div>

              {/* Active High-Priority Incidents Box */}
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">
                    High Priority Field Queue
                  </h3>
                  <button
                    onClick={() => setActiveView('collection-tasks')}
                    className="text-xs font-semibold text-[#16836A] hover:underline flex items-center gap-1"
                  >
                    View All ({reports.length})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {reports.length === 0 ? (
                  <EmptyState
                    icon={<Truck className="w-8 h-8 text-[#16836A]" />}
                    title="No Assigned Tasks"
                    description="You currently have zero pending work orders. New municipal dispatches will appear here."
                  />
                ) : (
                  <div className="divide-y divide-[#DCE8E2]">
                    {reports.slice(0, 5).map((order) => (
                      <div key={order.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#103D35]">
                              {formatReportNumber(order.report_number || order.id)}
                            </span>
                            <Badge priority={order.ai_priority || order.priority} size="sm" />
                            <Badge status={order.status} size="sm" />
                          </div>
                          <p className="text-slate-700 font-semibold">{order.waste_category}</p>
                          <p className="text-[11px] text-slate-500">
                            Location: {order.ward || order.address || 'Central District'} • Submitted {formatDate(order.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedReport(order)}
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          Manage Work Order
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 2: INCIDENTS (WITH DUPLICATE REVIEW CHECK)
             ======================================================== */}
          {activeView === 'incidents' && (
            <div className="space-y-4">
              <Card variant="flat" className="p-5 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#103D35]">Active Incidents & AI Triage Analysis</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#E8F5F1] text-[#16836A]">
                    Automated Proximity Grouping Enabled
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Review incoming complaints, AI department recommendations, and duplicate report detection.
                </p>
              </Card>

              {reports.map((r) => (
                <Card key={r.id} variant="flat" className="p-5 bg-white border border-[#DCE8E2] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#103D35]">
                        {formatReportNumber(r.report_number || r.id)}
                      </span>
                      <Badge priority={r.ai_priority || r.priority} size="sm" />
                      <Badge status={r.status} size="sm" />
                    </div>
                    <span className="text-[11px] text-slate-400">{formatDate(r.created_at)}</span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">
                    {r.description || 'No description provided by citizen.'}
                  </p>

                  {/* AI Recommendations */}
                  <div className="p-3 rounded-xl bg-[#E8F5F1] border border-[#16836A]/20 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#103D35]">
                      <Bot className="w-3.5 h-3.5 text-[#16836A]" />
                      <span>Gemini AI Recommendation</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Category: <strong>{r.ai_category || r.waste_category}</strong> • Recommended Dept:{' '}
                      <strong>{r.ai_department || 'Solid Waste Management'}</strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#DCE8E2] text-xs">
                    <span className="text-slate-500">Location: {r.ward || r.address || 'Central Zone'}</span>
                    <Button variant="emerald" size="sm" onClick={() => setSelectedReport(r)}>
                      Action Work Order
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ========================================================
              VIEW 3: REPORTS (CITIZEN REPORTS DATABASE + MAP TOGGLE)
             ======================================================== */}
          {activeView === 'reports' && (
            <div className="space-y-4">
              <Card variant="flat" className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-[#103D35]">Citizen Complaints Database</h2>
                  <span className="text-xs text-slate-500">{reports.length} total logged complaints</span>
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
                  selectedReport={selectedReport}
                  onSelectReport={(r) => setSelectedReport(r)}
                  onOpenWorkOrder={(r) => setSelectedReport(r)}
                  role="municipal_staff"
                  title="Municipal Field Operations Map"
                  subtitle="Authorized assignments and collection tasks plotted by real GPS coordinates"
                  heightClass="h-[650px]"
                  onRefresh={fetchWorkOrders}
                />
              ) : (
                <Card variant="flat" className="p-6 bg-white space-y-4">
                  {reports.length === 0 ? (
                    <EmptyState
                      icon={<FileText className="w-8 h-8 text-[#16836A]" />}
                      title="No Reports Found"
                      description="No citizen reports logged under current criteria."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-[#F5F8F5] border-b border-[#DCE8E2] text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Report ID</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Ward</th>
                            <th className="px-4 py-3">Priority</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Details</th>
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
                              <td className="px-4 py-3 text-right">
                                <Button variant="secondary" size="sm" onClick={() => setSelectedReport(r)}>
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* ========================================================
              VIEW 4: OPERATIONS MAP
             ======================================================== */}
          {activeView === 'operations-map' && (
            <div className="space-y-4">
              <OperationsMap
                reports={reports}
                onSelectReport={(r) => setSelectedReport(r)}
                onOpenWorkOrder={(r) => setSelectedReport(r)}
                role="municipal_staff"
                title="Municipal Field Operations Map"
                subtitle="Live geolocated collection dispatches, status filters, and waste markers across your service area."
                onRefresh={fetchWorkOrders}
              />
            </div>
          )}

          {/* ========================================================
              VIEW 5: AREAS & WARDS
             ======================================================== */}
          {activeView === 'areas-wards' && (
            <div className="space-y-6">
              <Card variant="flat" className="p-6 bg-white space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#103D35]">Municipal Service Areas & Wards</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Designated administrative coverage zones and active operational status.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {WARDS_LIST.map((wardName, idx) => {
                    const wardCount = reports.filter((r) => r.ward === wardName).length;
                    return (
                      <div key={idx} className="p-4 rounded-xl border border-[#DCE8E2] bg-[#F5F8F5] text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#103D35]">{wardName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#16836A] border border-[#DCE8E2]">
                            Active Coverage
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            Active Incidents: <strong>{wardCount}</strong>
                          </span>
                          <span>
                            Status: <strong>{wardCount > 0 ? 'Action Pending' : 'Clear'}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 5: COLLECTION TASKS & MY ASSIGNED WORK SECTION
             ======================================================== */}
          {(activeView === 'collection-tasks' || activeView === 'my-assigned-work') && (
            <div className="space-y-5">
              <Card variant="flat" className="p-5 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE8E2]">
                  <div>
                    <h2 className="text-base font-bold text-[#103D35] flex items-center gap-2">
                      <Truck className="w-5 h-5 text-[#16836A]" />
                      My Assigned Work & Collection Tasks
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Direct dispatches allocated to your officer account. Accept assignments, execute field work, and submit resolution details.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={fetchWorkOrders}
                      leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs matching required workflow: Accept, Start, Submit Resolution, View Completed */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setWorkFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      workFilter === 'all'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    All Tasks ({reports.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkFilter('pending_accept')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      workFilter === 'pending_accept'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>Pending Acceptance</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        reports.filter((r) => r.lifecycle_stage === 'ASSIGNED' || r.status === 'Assigned' || r.status === 'Submitted').length > 0
                          ? 'bg-[#E76F51] text-white'
                          : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {reports.filter((r) => r.lifecycle_stage === 'ASSIGNED' || r.status === 'Assigned' || r.status === 'Submitted').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkFilter('in_progress')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      workFilter === 'in_progress'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>In Progress</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        workFilter === 'in_progress' ? 'bg-white/20 text-white' : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {reports.filter((r) => r.lifecycle_stage === 'IN_PROGRESS' || r.status === 'In Progress' || r.lifecycle_stage === 'ACCEPTED').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWorkFilter('completed')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      workFilter === 'completed'
                        ? 'bg-[#103D35] text-white shadow-sm'
                        : 'bg-[#F5F8F5] text-slate-600 hover:text-[#103D35] border border-[#DCE8E2]'
                    }`}
                  >
                    <span>Completed Assignments</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        workFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-[#DCE8E2] text-slate-600'
                      }`}
                    >
                      {reports.filter((r) => r.status === 'Resolved' || r.lifecycle_stage === 'RESOLVED').length}
                    </span>
                  </button>
                </div>
              </Card>

              {/* Work Orders List / Grid */}
              {(() => {
                const filteredList = reports.filter((r) => {
                  if (workFilter === 'pending_accept') {
                    return r.lifecycle_stage === 'ASSIGNED' || r.status === 'Assigned' || r.status === 'Submitted';
                  }
                  if (workFilter === 'in_progress') {
                    return r.lifecycle_stage === 'IN_PROGRESS' || r.status === 'In Progress' || r.lifecycle_stage === 'ACCEPTED';
                  }
                  if (workFilter === 'completed') {
                    return r.status === 'Resolved' || r.lifecycle_stage === 'RESOLVED';
                  }
                  return true;
                });

                if (filteredList.length === 0) {
                  return (
                    <Card variant="flat" className="p-8 bg-white">
                      <EmptyState
                        icon={<CheckCircle2 className="w-8 h-8 text-[#16836A]" />}
                        title={
                          workFilter === 'completed'
                            ? 'No Completed Assignments Yet'
                            : workFilter === 'pending_accept'
                            ? 'No Pending Acceptances'
                            : 'No Active Work Orders'
                        }
                        description={
                          workFilter === 'completed'
                            ? 'Resolved and verified collection assignments will be archived here.'
                            : 'All current work orders have been acknowledged or transitioned.'
                        }
                      />
                    </Card>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredList.map((order) => {
                      const isPendingAcceptance =
                        order.lifecycle_stage === 'ASSIGNED' ||
                        (order.status === 'Assigned' && !order.timeline?.find((t) => t.stage === 'ACCEPTED' && t.completed));
                      const isAcceptedReadyToStart =
                        order.lifecycle_stage === 'ACCEPTED';
                      const isInProgress =
                        order.lifecycle_stage === 'IN_PROGRESS' || order.status === 'In Progress';
                      const isResolutionSubmitted =
                        order.lifecycle_stage === 'RESOLUTION_SUBMITTED';
                      const isResolved =
                        order.status === 'Resolved' || order.lifecycle_stage === 'RESOLVED';

                      const isActing = actionLoadingId === order.id;

                      return (
                        <Card
                          key={order.id}
                          variant="flat"
                          className="p-5 bg-white border border-[#DCE8E2] space-y-3 flex flex-col justify-between hover:border-[#16836A]/40 transition-colors shadow-subtle"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-sm text-[#103D35]">
                                {formatReportNumber(order.report_number || order.id)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Badge priority={order.ai_priority || order.priority} size="sm" />
                                <Badge status={order.status} size="sm" />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-mono bg-[#F5F8F5] px-2.5 py-1.5 rounded-lg border border-[#DCE8E2]">
                              <span className="text-slate-500 font-semibold">TASK ID:</span>
                              <span className="font-bold text-[#16836A]">
                                {order.task_number || order.assigned_task?.task_number || order.task_id || `TSK-${String(order.report_number || order.id).padStart(4, '0')}`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <h4 className="font-bold text-slate-800">{order.waste_category}</h4>
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {order.assigned_department || order.ai_department || 'General Waste Collection'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2 bg-[#F5F8F5] p-2.5 rounded-xl border border-[#DCE8E2]">
                              {order.description || 'No description provided.'}
                            </p>

                            {/* Location & Reported Date */}
                            <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-[#DCE8E2]">
                              <div className="flex justify-between">
                                <span>
                                  Ward: <strong>{order.ward || 'Central'}</strong>
                                </span>
                                <span>
                                  Assigned:{' '}
                                  <strong>
                                    {formatDate(
                                      order.timeline?.find((t) => t.stage === 'ASSIGNED')?.timestamp ||
                                      order.updated_at ||
                                      order.created_at
                                    )}
                                  </strong>
                                </span>
                              </div>
                              <div>
                                Address: <strong>{order.address || 'Address not specified'}</strong>
                              </div>
                              {order.assigned_instructions && (
                                <div className="text-[11px] text-slate-700 bg-amber-50/70 p-2 rounded border border-amber-200/60 mt-1">
                                  <strong className="text-amber-900">Instructions:</strong> {order.assigned_instructions}
                                </div>
                              )}
                              {order.latitude && order.longitude && (
                                <div className="font-mono text-[#16836A]">
                                  GPS: {order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}
                                </div>
                              )}
                            </div>

                            {/* Resolution Details When Present */}
                            {order.resolution_notes && (
                              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                                <span className="font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-[#16836A]" />
                                  Resolution Notes:
                                </span>
                                <p>{order.resolution_notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Status-Dependent Action Buttons */}
                          <div className="pt-3 border-t border-[#DCE8E2] flex items-center justify-between gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedReport(order)}
                            >
                              {isResolved ? 'View Completed Assignment' : 'View Details'}
                            </Button>

                            {isPendingAcceptance && (
                              <Button
                                variant="emerald"
                                size="sm"
                                isLoading={isActing}
                                onClick={() => handleAcceptAssignment(order)}
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Accept Assignment
                              </Button>
                            )}

                            {isAcceptedReadyToStart && (
                              <Button
                                variant="coral"
                                size="sm"
                                isLoading={isActing}
                                onClick={() => handleStartWork(order)}
                                leftIcon={<Play className="w-3.5 h-3.5" />}
                              >
                                Start Work
                              </Button>
                            )}

                            {isInProgress && (
                              <Button
                                variant="emerald"
                                size="sm"
                                onClick={() => setSelectedReport(order)}
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Submit Resolution
                              </Button>
                            )}

                            {isResolutionSubmitted && (
                              <span className="text-[10px] font-bold text-[#FF6848] bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                Awaiting Manager Verification
                              </span>
                            )}

                            {isResolved && (
                              <span className="text-[10px] font-bold text-[#16836A] bg-[#E8F5F1] px-2 py-1 rounded border border-[#16836A]/20">
                                ✓ Resolved & Verified
                              </span>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================
              VIEW 6: VEHICLES
             ======================================================== */}
          {activeView === 'vehicles' && (
            <Card variant="flat" className="p-6 bg-white space-y-5">
              <div>
                <h2 className="text-base font-bold text-[#103D35]">Municipal Fleet Records & Vehicle Status</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified fleet records, truck types, and active route assignments.
                </p>
              </div>

              {activeAssignedVehicles.length === 0 ? (
                <EmptyState
                  icon={<Car className="w-8 h-8 text-[#16836A]" />}
                  title="No Active Vehicle Dispatches"
                  description="No vehicles or crews are assigned to active collection tasks. Assignments made by the Operations Manager will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-[#F5F8F5] border-b border-[#DCE8E2] text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Task ID</th>
                        <th className="px-4 py-3">Related Incident</th>
                        <th className="px-4 py-3">Assigned Staff / Vehicle</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Zone</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE8E2]">
                      {activeAssignedVehicles.map((v) => (
                        <tr key={v.id} className="hover:bg-[#F5F8F5]/50">
                          <td className="px-4 py-3 font-mono font-bold text-[#103D35]">{v.id}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800">{v.reportRef}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{v.staffOrVehicle}</td>
                          <td className="px-4 py-3 text-slate-600">{v.department}</td>
                          <td className="px-4 py-3 text-slate-600">{v.zone}</td>
                          <td className="px-4 py-3">
                            <Badge status={v.status} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ========================================================
              VIEW 7: DEPARTMENTS
             ======================================================== */}
          {activeView === 'departments' && (
            <Card variant="flat" className="p-6 bg-white space-y-5">
              <div>
                <h2 className="text-base font-bold text-[#103D35]">Municipal Cleansing Departments</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operational divisions responsible for specialized municipal sanitation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MUNICIPAL_DEPARTMENTS.map((dept, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-[#DCE8E2] bg-[#F5F8F5] text-xs space-y-2">
                    <div className="flex items-center gap-2 text-[#103D35] font-bold">
                      <Building2 className="w-4 h-4 text-[#16836A]" />
                      <span>{dept}</span>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      Handles rapid collection tasks, community complaints, and automated AI work orders.
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ========================================================
              VIEW 8: ANALYTICS (RECHARTS VISUALIZATION)
             ======================================================== */}
          {activeView === 'analytics' && (
            <div className="space-y-6">
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <h3 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">
                  Assigned Reports by Waste Category
                </h3>
                {chartCategoryData.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No reports available to generate chart.</p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartCategoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#DCE8E2" />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                        <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#16836A" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Status Breakdown Pie */}
              <Card variant="flat" className="p-6 bg-white space-y-4">
                <h3 className="text-sm font-bold text-[#103D35] uppercase tracking-wider">
                  Operational Status Distribution
                </h3>
                {statusPieData.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No tasks to chart.</p>
                ) : (
                  <div className="h-60 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ========================================================
              VIEW 9: NOTIFICATIONS
             ======================================================== */}
          {activeView === 'notifications' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8E2]">
                <div>
                  <h2 className="text-base font-bold text-[#103D35] flex items-center gap-2">
                    <Bell className="w-5 h-5 text-[#16836A]" />
                    Operational & Work Dispatch Notifications
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live updates when new work is assigned to your division, tasks are approved, or instructions updated.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded ${
                      unreadNotifCount > 0 ? 'bg-[#FF6848] text-white' : 'bg-[#E8F5F1] text-[#16836A]'
                    }`}
                  >
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
                      Mark All Read
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchNotifications}
                    leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingNotifications ? 'animate-spin' : ''}`} />}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {loadingNotifications ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner text="Checking municipal notification feed..." />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={<Bell className="w-8 h-8 text-[#16836A]" />}
                  title="No Operational Notifications"
                  description="Field operations alert queue is currently clear. When tasks are dispatched to you, alerts will appear here."
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
                            try {
                              const rep = await reportService.getReportById(String(n.report_id));
                              if (rep?.report) {
                                setSelectedReport(rep.report);
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
                          <div
                            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              n.type === 'REPORT_RESOLVED'
                                ? 'bg-emerald-100 text-[#16836A]'
                                : n.type === 'WORK_ASSIGNED'
                                ? 'bg-blue-100 text-blue-700'
                                : n.type === 'WORK_STARTED' || n.type === 'WORK_COMPLETED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {n.type === 'WORK_ASSIGNED' ? (
                              <Briefcase className="w-4 h-4" />
                            ) : n.type === 'REPORT_RESOLVED' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Bell className="w-4 h-4" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-bold ${isUnread ? 'text-[#103D35]' : 'text-slate-800'}`}>
                                {n.title}
                              </h4>
                              {isUnread && <span className="w-2 h-2 rounded-full bg-[#FF6848] shrink-0" />}
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
              VIEW 10: ORGANIZATION PROFILE
             ======================================================== */}
          {activeView === 'org-profile' && (
            <Card variant="flat" className="p-6 sm:p-8 bg-white space-y-6">
              <div>
                <h2 className="text-base font-bold text-[#103D35]">Municipal Organization Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authenticated municipal agency credentials and duty division.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#DCE8E2] text-xs">
                <div>
                  <span className="font-bold text-slate-500 block">Staff Name</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{user?.full_name}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Registered Staff ID</span>
                  <p className="text-sm font-mono font-bold text-[#16836A] mt-1">{user?.staff_id || 'STF-50101'}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Municipal Agency</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {user?.organization || 'Central Municipality'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Jurisdiction District</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{user?.district || 'Central District'}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Clearance Level</span>
                  <div className="mt-1">
                    <Badge role="municipal_staff" size="sm" />
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-500 block">Authorization Status</span>
                  <div className="mt-1">
                    <Badge status="Approved" size="sm" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#DCE8E2] flex items-center justify-between">
                <span className="text-xs text-slate-500">End your field operations shift safely:</span>
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
