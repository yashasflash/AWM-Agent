import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { BrandLogo } from '../common/BrandLogo';
import {
  LogOut,
  ChevronDown,
  Menu,
  X,
  FileText,
  Truck,
  LayoutDashboard,
  Search,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    const roleLabel =
      user?.role === 'manager'
        ? 'Manager'
        : user?.role === 'municipal_staff'
        ? 'Municipal Staff'
        : 'Citizen';
    const confirmed = window.confirm(`Are you sure you want to sign out of your ${roleLabel} session?`);
    if (!confirmed) return;
    logout();
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/', { replace: true });
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${id}`);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isActive = (path: string) => location.pathname === path && !location.hash;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#DCE8E2] shadow-subtle transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* LEFT: AWM Agent Logo & Name */}
          <Link to="/" className="flex items-center group">
            <BrandLogo size="md" />
          </Link>

          {/* CENTRE: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className={`text-xs font-semibold uppercase tracking-wider py-1.5 transition-colors relative ${
                isActive('/')
                  ? 'text-[#103D35] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#16836A] after:rounded-full'
                  : 'text-slate-600 hover:text-[#103D35]'
              }`}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="text-xs font-semibold uppercase tracking-wider py-1.5 text-slate-600 hover:text-[#103D35] transition-colors"
            >
              How It Works
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="text-xs font-semibold uppercase tracking-wider py-1.5 text-slate-600 hover:text-[#103D35] transition-colors"
            >
              Features
            </button>

            <Link
              to="/portals"
              className={`text-xs font-semibold uppercase tracking-wider py-1.5 transition-colors ${
                location.pathname === '/portals'
                  ? 'text-[#16836A] font-bold'
                  : 'text-slate-600 hover:text-[#103D35]'
              }`}
            >
              Portals
            </Link>

            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="text-xs font-semibold uppercase tracking-wider py-1.5 text-slate-600 hover:text-[#103D35] transition-colors"
            >
              About
            </button>
          </nav>

          {/* RIGHT: Login & Get Started Buttons / Profile Menu */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded-full border border-[#DCE8E2] bg-[#FBFDFB] hover:bg-white hover:border-[#16836A]/40 transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-[#103D35] text-white flex items-center justify-center text-xs font-semibold">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden sm:block text-xs">
                    <p className="font-semibold text-[#103D35] leading-none truncate max-w-[120px]">
                      {user.full_name || user.email.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
                      {user.role === 'manager'
                        ? 'Manager'
                        : user.role === 'municipal_staff'
                        ? 'Staff'
                        : 'Citizen'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#DCE8E2] rounded-xl shadow-dropdown py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-3 border-b border-[#DCE8E2]">
                      <p className="text-xs font-semibold text-slate-900 truncate">{user.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Badge role={user.role} size="sm" />
                        {user.staff_id && (
                          <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            {user.staff_id}
                          </span>
                        )}
                        {user.manager_id && (
                          <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            {user.manager_id}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="py-1">
                      {user.role === 'citizen' && (
                        <Link
                          to="/user"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-[#F5F8F5]"
                        >
                          <FileText className="w-4 h-4 text-[#16836A]" />
                          Citizen Dashboard
                        </Link>
                      )}
                      {(user.role === 'municipal_staff' || user.is_manager) && (
                        <Link
                          to="/municipal"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-[#F5F8F5]"
                        >
                          <Truck className="w-4 h-4 text-[#16836A]" />
                          Municipal Dashboard
                        </Link>
                      )}
                      {user.is_manager && (
                        <Link
                          to="/manager"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-[#F5F8F5]"
                        >
                          <LayoutDashboard className="w-4 h-4 text-[#103D35]" />
                          Manager Dashboard
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-[#DCE8E2] pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#E76F51] hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out of Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/portals"
                  className="p-2 text-slate-500 hover:text-[#103D35] hover:bg-[#F5F8F5] rounded-lg transition-colors hidden sm:flex items-center justify-center"
                  title="Search & Quick Access"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" />
                </Link>

                <Link to="/portals">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-[#DCE8E2] text-slate-700 hover:border-[#16836A] hover:text-[#16836A]"
                  >
                    Login
                  </Button>
                </Link>

                <Link to="/portals">
                  <Button
                    variant="emerald"
                    size="sm"
                    className="font-bold px-4 shadow-sm"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-[#F5F8F5]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#DCE8E2] flex flex-col gap-2 bg-white">
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-[#F5F8F5] text-left"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-[#F5F8F5] text-left"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-[#F5F8F5] text-left"
            >
              Features
            </button>
            <Link
              to="/portals"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-[#16836A] hover:bg-[#E8F5F1] text-left font-semibold"
            >
              Role Portals
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-[#F5F8F5] text-left"
            >
              About
            </button>

            {user && (
              <div className="pt-2 border-t border-[#DCE8E2] mt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#E76F51] hover:bg-rose-50 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
