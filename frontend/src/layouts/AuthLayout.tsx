import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8F5] text-slate-800">
      {/* Dedicated Minimal Authentication Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-[#DCE8E2] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#103D35] flex items-center justify-center text-white shadow-sm group-hover:bg-[#16836A] transition-colors">
              <ShieldAlert className="w-5 h-5 text-[#FF6848]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-[#103D35]">
                  AWM <span className="text-[#16836A]">Agent</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-[#E8F5F1] text-[#16836A] rounded border border-[#16836A]/20">
                  Municipal Auth
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                Autonomous AI Waste Management
              </p>
            </div>
          </Link>

          <Link
            to="/portals"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#103D35] px-3 py-1.5 rounded-lg border border-[#DCE8E2] bg-white hover:bg-[#F5F8F5] transition-all shadow-subtle"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Role Selection</span>
          </Link>
        </div>
      </header>

      {/* Main Authentication Card Container */}
      <main className="flex-1 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};
