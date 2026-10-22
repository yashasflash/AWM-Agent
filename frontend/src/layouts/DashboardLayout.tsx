import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Badge } from '../components/common/Badge';
import {
  ShieldAlert,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Settings,
  Bell,
  Building2,
  Truck,
  LayoutDashboard,
  CheckCircle2,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    const roleLabel =
      user?.role === 'manager'
        ? 'Operations Manager'
        : user?.role === 'municipal_staff'
        ? 'Municipal Staff'
        : 'Citizen';

    const confirmed = window.confirm(`Are you sure you want to sign out of your ${roleLabel} session?`);
    if (!confirmed) return;

    try {
      setDropdownOpen(false);
      // 1. Clear session and cached data via existing auth mechanism
      logout();
      // 2. Display success toast
      success('You have been signed out successfully.');
      // 3. Redirect to landing page with history replacement
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      toastError(msg);
    }
  };

  const getDashboardHome = () => {
    if (user?.role === 'manager' || user?.is_manager) return '/manager';
    if (user?.role === 'municipal_staff' || user?.is_staff) return '/municipal';
    return '/user';
  };

  const getWorkspaceTitle = () => {
    if (user?.role === 'manager' || user?.is_manager) return 'Operations Command';
    if (user?.role === 'municipal_staff' || user?.is_staff) return 'Municipal Operations';
    return 'Citizen Portal';
  };

  const handleProfileClick = () => {
    setDropdownOpen(false);
    if (user?.role === 'manager' || user?.is_manager) {
      navigate('/manager?view=settings');
    } else if (user?.role === 'municipal_staff' || user?.is_staff) {
      navigate('/municipal?view=org-profile');
    } else {
      navigate('/user?view=profile');
    }
  };

  const handleSettingsClick = () => {
    setDropdownOpen(false);
    if (user?.role === 'manager' || user?.is_manager) {
      navigate('/manager?view=settings');
    } else if (user?.role === 'municipal_staff' || user?.is_staff) {
      navigate('/municipal?view=org-profile');
    } else {
      navigate('/user?view=profile');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8F5]">
      {/* Global Authenticated Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DCE8E2] shadow-subtle transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Logo & Workspace Tag */}
            <div className="flex items-center gap-3">
              <Link to={getDashboardHome()} className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-[#103D35] flex items-center justify-center text-white shadow-sm group-hover:bg-[#16836A] transition-colors">
                  <ShieldAlert className="w-5 h-5 text-[#FF6848]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tracking-tight text-[#103D35]">
                      AWM <span className="text-[#16836A]">Agent</span>
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E8F5F1] text-[#16836A] border border-[#16836A]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16836A] animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium hidden sm:block">
                    Autonomous Waste Management
                  </p>
                </div>
              </Link>

              <span className="h-5 w-px bg-[#DCE8E2] hidden sm:block" />

              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#F5F8F5] text-[#103D35] border border-[#DCE8E2]">
                {getWorkspaceTitle()}
              </span>
            </div>

            {/* Right: User Avatar, Display Name, Role Badge, and Dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  id="dashboard-user-profile-menu-button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded-full border border-[#DCE8E2] bg-[#FBFDFB] hover:bg-white hover:border-[#16836A]/40 transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#16836A]"
                >
                  {/* User Avatar Circle */}
                  <div className="w-8 h-8 rounded-full bg-[#103D35] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>

                  {/* Display Name and Role */}
                  <div className="hidden sm:block text-xs">
                    <p className="font-bold text-[#103D35] leading-none truncate max-w-[130px]">
                      {user.full_name || user.email.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5 flex items-center gap-1">
                      <span>
                        {user.role === 'manager'
                          ? 'Manager'
                          : user.role === 'municipal_staff'
                          ? 'Municipal Staff'
                          : 'Citizen'}
                      </span>
                      {(user.staff_id || user.manager_id) && (
                        <span className="font-mono text-[#16836A]">({user.staff_id || user.manager_id})</span>
                      )}
                    </p>
                  </div>

                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 mr-1 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-[#DCE8E2] rounded-2xl shadow-dropdown py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-[#DCE8E2]">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {user.full_name || 'Authenticated User'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <Badge role={user.role} size="sm" />
                        {user.staff_id && (
                          <span className="text-[10px] font-mono font-bold bg-[#E8F5F1] text-[#16836A] px-1.5 py-0.5 rounded border border-[#16836A]/20">
                            {user.staff_id}
                          </span>
                        )}
                        {user.manager_id && (
                          <span className="text-[10px] font-mono font-bold bg-[#E8F5F1] text-[#103D35] px-1.5 py-0.5 rounded border border-[#103D35]/20">
                            {user.manager_id}
                          </span>
                        )}
                        {user.ward && (
                          <span className="text-[10px] text-slate-500 px-1 py-0.5">
                            {user.ward}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Menu Navigation Options */}
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={handleProfileClick}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-[#F5F8F5] transition-colors text-left"
                      >
                        <UserIcon className="w-4 h-4 text-[#16836A]" />
                        <span>My Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSettingsClick}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-[#F5F8F5] transition-colors text-left"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span>Settings & Security</span>
                      </button>
                    </div>

                    {/* Logout Option */}
                    <div className="border-t border-[#DCE8E2] pt-1">
                      <button
                        type="button"
                        id="global-logout-button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#E76F51] hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 text-[#E76F51]" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Dashboard Content Outlet */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
