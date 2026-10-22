import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import {
  User,
  Truck,
  LayoutDashboard,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';

export const PortalsPage: React.FC = () => {
  const portals = [
    {
      role: 'user',
      title: 'USER / CITIZEN',
      heading: 'Citizen Portal',
      badge: 'CITIZEN',
      description: 'Report waste and track complaints.',
      highlights: [
        'Photo-based waste incident reporting',
        'Automated Gemini AI hazard triage',
        '8-stage complaint tracking timeline',
      ],
      link: '/login/user',
      buttonText: 'Continue as Citizen',
      icon: <User className="w-6 h-6 text-[#FF6848]" />,
      buttonVariant: 'coral' as const,
      borderHover: 'hover:border-[#FF6848]/60 hover:shadow-md',
      badgeColor: 'bg-[#FFF2EE] text-[#FF6848] border-[#FF6848]/20',
    },
    {
      role: 'municipal',
      title: 'MUNICIPAL',
      heading: 'Municipal Operations',
      badge: 'MUNICIPAL',
      description: 'Receive assignments and coordinate waste collection.',
      highlights: [
        'Assigned collection task management',
        'Fieldwork status clearance & notes',
        'Sanitation crew & vehicle coordination',
      ],
      link: '/login/municipal',
      buttonText: 'Continue as Municipal',
      icon: <Truck className="w-6 h-6 text-[#16836A]" />,
      buttonVariant: 'emerald' as const,
      borderHover: 'hover:border-[#16836A]/60 hover:shadow-md',
      badgeColor: 'bg-[#E8F5F1] text-[#16836A] border-[#16836A]/20',
    },
    {
      role: 'manager',
      title: 'MANAGER',
      heading: 'Operations Manager',
      badge: 'MANAGER',
      description: 'Assign work and monitor operations.',
      highlights: [
        'City-wide operational oversight & KPIs',
        'Department dispatch & crew assignment',
        'Municipal staff authorization & review',
      ],
      link: '/login/manager',
      buttonText: 'Continue as Manager',
      icon: <LayoutDashboard className="w-6 h-6 text-[#103D35]" />,
      buttonVariant: 'primary' as const,
      borderHover: 'hover:border-[#103D35]/60 hover:shadow-md',
      badgeColor: 'bg-[#F5F8F5] text-[#103D35] border-[#103D35]/20',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8F5]">
      {/* Dedicated Clean Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-[#DCE8E2] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
                  Role Portals
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                Autonomous AI Waste Management
              </p>
            </div>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#103D35] px-3.5 py-1.5 rounded-lg border border-[#DCE8E2] bg-white hover:bg-[#F5F8F5] transition-all shadow-subtle"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex flex-col justify-center space-y-12">
        {/* Header Block */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#DCE8E2] shadow-subtle">
            <ShieldCheck className="w-4 h-4 text-[#16836A]" />
            <span className="text-xs font-semibold text-[#103D35]">
              Authorized Role-Based Access Control
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#103D35] tracking-tight">
            Select Your Operating Portal
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Choose your designated portal to access role-specific workflows.
            Credentials and permissions are validated by municipal security protocols.
          </p>
        </div>

        {/* 3 Portal Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto w-full">
          {portals.map((portal) => (
            <div
              key={portal.role}
              className={`bg-white rounded-3xl border-2 border-[#DCE8E2] ${portal.borderHover} p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 shadow-card`}
            >
              <div className="space-y-6">
                {/* Top Badge & Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] flex items-center justify-center">
                    {portal.icon}
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${portal.badgeColor}`}
                  >
                    {portal.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-[#103D35]">
                    {portal.title}
                  </h2>
                  <p className="text-xs font-semibold text-[#16836A]">
                    {portal.heading}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                    {portal.description}
                  </p>
                </div>

                {/* Capabilities list */}
                <div className="pt-4 border-t border-[#DCE8E2] space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Key Features
                  </p>
                  <ul className="space-y-2">
                    {portal.highlights.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16836A] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-8">
                <Link to={portal.link} className="block w-full">
                  <Button
                    variant={portal.buttonVariant}
                    size="lg"
                    className="w-full justify-center"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    {portal.buttonText}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Security Statement & Simple Back to Home */}
        <div className="text-center pt-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Role-based isolation enforced. Municipal staff and operations manager consoles require verified authorization.
            </span>
          </div>

          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#103D35] hover:underline transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="py-4 border-t border-[#DCE8E2] bg-white/60 text-center text-xs text-slate-400">
        <span>© 2026 AWM Agent • Municipal Autonomous Waste Management System</span>
      </footer>
    </div>
  );
};
