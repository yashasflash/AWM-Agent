import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  ArrowRight,
  Play,
  FileText,
  Users,
  ShieldCheck,
  Clock,
  Layers,
  Eye,
  Camera,
  Bot,
  Truck,
  CheckCircle2,
  MapPin,
  CheckCircle,
  BarChart2,
  Settings,
  Building2,
  LayoutDashboard,
  Server,
  Database,
  Cpu,
  Workflow,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleReportWasteClick = () => {
    if (user?.role === 'citizen') {
      navigate('/user');
    } else {
      navigate('/login/user');
    }
  };

  return (
    <div className="flex flex-col gap-20 sm:gap-28 pb-20 bg-[#FFFFFF]">
      {/* ========================================================
          06. HERO SECTION (SPLIT TWO-COLUMN WITH REALISTIC PHOTO)
         ======================================================== */}
      <section
        id="hero"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14 lg:pt-16 w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Headline, Description & CTAs */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-7">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16836A]" />
              <span>SMART CITY WASTE MANAGEMENT</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-[#103D35] leading-[1.12]">
              Cleaner Streets.{' '}
              <span className="text-[#16836A] block mt-1">
                Smarter Waste Management.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              Report waste problems, track your complaints and help municipal teams keep your
              neighbourhood clean. AWM Agent connects citizens and waste-management teams through
              intelligent reporting and coordinated action.
            </p>

            {/* Primary & Secondary Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                variant="coral"
                size="lg"
                onClick={handleReportWasteClick}
                className="font-bold px-7 py-3 text-sm sm:text-base shadow-md hover:shadow-lg transition-all"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Report a Waste Issue
              </Button>

              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-[#F5F8F5] text-[#103D35] font-bold text-sm border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle"
              >
                <span>Explore How It Works</span>
                <Play className="w-3.5 h-3.5 fill-[#16836A] text-[#16836A]" />
              </button>
            </div>

            {/* Three Compact Benefit Chips */}
            <div className="pt-6 border-t border-[#DCE8E2] grid grid-cols-3 gap-3 max-w-md text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <FileText className="w-4 h-4 text-[#16836A] shrink-0" />
                <span>Easy reporting</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Users className="w-4 h-4 text-[#16836A] shrink-0" />
                <span>Smarter coordination</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#16836A] shrink-0" />
                <span>Complaint tracking</span>
              </div>
            </div>
          </div>

          {/* Right Column: Large Realistic Waste Management Image with UI Callout Badges */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-3xl overflow-hidden border border-[#DCE8E2] shadow-card bg-slate-100 group">
              <img
                src="/images/hero_waste_truck.jpg"
                alt="AWM Agent Municipal Waste Collection Vehicle in Clean Urban Indian Neighborhood"
                className="w-full h-[360px] sm:h-[440px] lg:h-[480px] object-cover transition-transform duration-700 group-hover:scale-105"
                loading="eager"
              />

              {/* Subtle Gradient Vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#103D35]/30 via-transparent to-transparent pointer-events-none" />

              {/* Floating UI Callout Badges matching Reference Image */}
              {/* Badge 1: REPORT */}
              <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#DCE8E2] shadow-md flex items-center gap-2 text-xs font-bold text-[#103D35] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="w-5 h-5 rounded-full bg-[#E9F5EF] flex items-center justify-center text-[#16836A]">
                  <MapPin className="w-3 h-3" />
                </div>
                <span>REPORT</span>
              </div>

              {/* Badge 2: COLLECT */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#DCE8E2] shadow-md flex items-center gap-2 text-xs font-bold text-[#103D35] animate-in fade-in zoom-in-90 duration-700">
                <div className="w-5 h-5 rounded-full bg-[#E9F5EF] flex items-center justify-center text-[#16836A]">
                  <MapPin className="w-3 h-3" />
                </div>
                <span>COLLECT</span>
              </div>

              {/* Badge 3: RECYCLE */}
              <div className="absolute top-8 right-6 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#DCE8E2] shadow-md flex items-center gap-2 text-xs font-bold text-[#103D35] animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="w-5 h-5 rounded-full bg-[#E9F5EF] flex items-center justify-center text-[#16836A]">
                  <MapPin className="w-3 h-3" />
                </div>
                <span>RECYCLE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          08. BENEFIT STRIP
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full -mt-6 sm:-mt-10">
        <div className="bg-[#E9F5EF]/80 rounded-2xl border border-[#DCE8E2] p-5 sm:p-6 shadow-subtle">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#DCE8E2] gap-4 md:gap-0">
            {/* Benefit 1 */}
            <div className="flex items-center gap-4 px-3 py-2 sm:px-6">
              <div className="w-11 h-11 rounded-xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-sm shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#103D35]">
                  Easy Reporting
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Report waste problems with clear location details.
                </p>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="flex items-center gap-4 px-3 py-2 sm:px-6">
              <div className="w-11 h-11 rounded-xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-sm shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#103D35]">
                  Smarter Coordination
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Help authorised municipal teams organise their work.
                </p>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="flex items-center gap-4 px-3 py-2 sm:px-6">
              <div className="w-11 h-11 rounded-xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-sm shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#103D35]">
                  Complaint Tracking
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Follow your submitted complaint through its actual status.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          11. HOW IT WORKS (5-STEP PROCESS TIMELINE)
         ======================================================== */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
            <span>HOW IT WORKS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight">
            From Waste Report to Resolution
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            A simple, coordinated process that connects citizens, municipal teams and managers.
          </p>
        </div>

        {/* Desktop 5-Step Horizontal Timeline matching Reference Design */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {/* Step 1: Report */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all space-y-3 group">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">01</span>
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-sm group-hover:bg-[#16836A] group-hover:text-white transition-colors">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Report</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              A citizen submits a waste complaint with its location and details.
            </p>
          </div>

          {/* Step 2: Analyse */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all space-y-3 group">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">02</span>
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-sm group-hover:bg-[#16836A] group-hover:text-white transition-colors">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Analyse</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The existing AI workflow analyses the submitted report.
            </p>
          </div>

          {/* Step 3: Assign */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all space-y-3 group">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">03</span>
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#103D35] shadow-sm group-hover:bg-[#103D35] group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Assign</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              An authorised manager assigns the work to the appropriate team.
            </p>
          </div>

          {/* Step 4: Collect */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all space-y-3 group">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">04</span>
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-sm group-hover:bg-[#16836A] group-hover:text-white transition-colors">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Collect</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The assigned municipal team updates the actual work progress.
            </p>
          </div>

          {/* Step 5: Resolve */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#E9F5EF] border border-[#16836A]/30 hover:border-[#16836A] transition-all space-y-3 group">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] font-bold text-[#16836A]">05</span>
              <div className="w-12 h-12 rounded-2xl bg-[#16836A] text-white flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Resolve</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The complaint is marked resolved only after the required process is completed.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          09. PROBLEM SECTION (THE CHALLENGE - 3 CARDS)
         ======================================================== */}
      <section id="problem" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF2EE] text-[11px] font-bold text-[#FF6848] uppercase tracking-wider">
              <span>THE CHALLENGE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight leading-snug">
              Keeping Our Cities Clean Should Be Easier
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              Waste problems need timely reporting, clear coordination and a reliable way to follow progress.
            </p>

            <div className="space-y-4 pt-2">
              {/* Card 1 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] space-y-1">
                <h3 className="font-bold text-sm text-[#103D35] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E76F51]" />
                  Waste Goes Unreported
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Overflowing bins, uncollected waste and illegal dumping can remain unnoticed without a clear reporting process.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] space-y-1">
                <h3 className="font-bold text-sm text-[#103D35] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  Coordination Takes Time
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Reports need to reach the appropriate team so work can be reviewed and organised efficiently.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F8F5] border border-[#DCE8E2] space-y-1">
                <h3 className="font-bold text-sm text-[#103D35] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#16836A]" />
                  Progress Should Be Visible
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Citizens need a clear way to understand the actual status of the complaints they submit.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Problem context photo */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl overflow-hidden border border-[#DCE8E2] shadow-card bg-slate-100">
              <img
                src="/images/problem_waste.jpg"
                alt="Uncollected public roadside waste before automated reporting"
                className="w-full h-[360px] sm:h-[420px] object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          10. SOLUTION SECTION (THE AWM AGENT APPROACH)
         ======================================================== */}
      <section id="solution" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left: Solution Photograph */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="rounded-3xl overflow-hidden border border-[#DCE8E2] shadow-card bg-slate-100">
              <img
                src="/images/solution_coordination.jpg"
                alt="Municipal workers and supervisor coordinating waste collection with digital tablet"
                className="w-full h-[360px] sm:h-[420px] object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Right: Solution Explanation */}
          <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
              <span>THE AWM AGENT APPROACH</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight leading-snug">
              One Connected Platform for Waste Management
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              AWM Agent brings citizens, municipal teams and operations managers together in a coordinated workflow.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#DCE8E2]">
                <div className="w-10 h-10 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center shrink-0 font-bold text-xs">
                  01
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#103D35]">REPORT</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Citizens submit waste complaints with descriptions and locations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#DCE8E2]">
                <div className="w-10 h-10 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center shrink-0 font-bold text-xs">
                  02
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#103D35]">COORDINATE</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    The existing AI-assisted workflow analyses reports and supports the configured assignment process.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#DCE8E2]">
                <div className="w-10 h-10 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center shrink-0 font-bold text-xs">
                  03
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#103D35]">TRACK</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Users and authorised staff can follow the saved complaint and operational status.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          14. OPERATIONS VISUAL SECTION (REAL IMPACT)
         ======================================================== */}
      <section id="operations" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="bg-[#F5F8F5] rounded-3xl p-8 sm:p-12 border border-[#DCE8E2]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left: Operations Image */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden border border-[#DCE8E2] shadow-sm">
                <img
                  src="/images/operations_street.jpg"
                  alt="Municipal electric waste collection team working on clean urban neighborhood street"
                  className="w-full h-[320px] sm:h-[380px] object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Right: Operations Benefits */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
                <span>OPERATIONAL HARMONY</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight">
                Better Visibility. Better Coordination.
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                A structured digital workflow prevents miscommunication and ensures field sanitation teams have clear assignment details.
              </p>

              <div className="space-y-4 pt-1">
                <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-1">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#103D35]">
                    Report Visibility
                  </h3>
                  <p className="text-xs text-slate-600">
                    Help authorised teams review submitted reports.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-1">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#103D35]">
                    Coordinated Work
                  </h3>
                  <p className="text-xs text-slate-600">
                    Connect assignments to the appropriate operational workflow.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-1">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#103D35]">
                    Resolution Tracking
                  </h3>
                  <p className="text-xs text-slate-600">
                    Follow actual task and complaint updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          12. ROLE SELECTION SECTION (3 ROLE CARDS)
         ======================================================== */}
      <section id="portals" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
            <span>ACCESS YOUR PORTAL</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight">
            One Platform. Three Connected Roles.
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            Choose the workspace designed for your responsibilities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Citizen */}
          <div className="p-7 rounded-3xl bg-white border-2 border-[#DCE8E2] hover:border-[#FF6848]/60 transition-all shadow-card flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF2EE] text-[#FF6848] flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#103D35]">Citizen Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Report waste issues, view your complaints and track their progress.
              </p>
              <ul className="space-y-2 pt-2 border-t border-[#DCE8E2] text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Submit waste reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>View personal reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Track complaint status</span>
                </li>
              </ul>
            </div>
            <Link to="/login/user" className="block w-full">
              <Button variant="coral" size="md" className="w-full justify-center font-bold">
                Enter Citizen Portal
              </Button>
            </Link>
          </div>

          {/* Card 2: Municipal */}
          <div className="p-7 rounded-3xl bg-white border-2 border-[#DCE8E2] hover:border-[#16836A]/60 transition-all shadow-card flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#103D35]">Municipal Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manage authorised assignments and keep collection work moving.
              </p>
              <ul className="space-y-2 pt-2 border-t border-[#DCE8E2] text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>View assigned work</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Update task progress</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Submit resolution details</span>
                </li>
              </ul>
            </div>
            <Link to="/login/municipal" className="block w-full">
              <Button variant="emerald" size="md" className="w-full justify-center font-bold">
                Enter Municipal Portal
              </Button>
            </Link>
          </div>

          {/* Card 3: Manager */}
          <div className="p-7 rounded-3xl bg-white border-2 border-[#DCE8E2] hover:border-[#103D35]/60 transition-all shadow-card flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F8F5] text-[#103D35] flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#103D35]">Manager Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review incidents, assign authorised teams and monitor operations.
              </p>
              <ul className="space-y-2 pt-2 border-t border-[#DCE8E2] text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Review reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Coordinate work assignments</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-[#16836A]" />
                  <span>Monitor resolution progress</span>
                </li>
              </ul>
            </div>
            <Link to="/login/manager" className="block w-full">
              <Button variant="primary" size="md" className="w-full justify-center font-bold">
                Enter Manager Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================
          13. FEATURES SECTION (6 FEATURE CARDS)
         ======================================================== */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
            <span>PLATFORM CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight">
            Everything Needed to Coordinate Waste Management
          </h2>
          <p className="text-base text-slate-600 leading-relaxed">
            Essential operational tools designed around real municipal field realities.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-white border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Waste Issue Reporting</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Submit a waste complaint with a description and location.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-white border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#103D35]">AI-Assisted Report Analysis</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Analyse submitted reports using the existing configured AI workflow.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-2xl bg-white border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Complaint Tracking</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              View the actual saved status of your complaints.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-2xl bg-white border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Work Assignment</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Support authorised assignment of reports to municipal teams.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-2xl bg-white border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Collection Task Management</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Track authorised work assignments and their saved progress.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-2xl bg-white border border-[#DCE8E2] hover:border-[#16836A]/40 transition-all shadow-subtle space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9F5EF] text-[#16836A] flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#103D35]">Operations Analytics</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Review operational information derived from available application data.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          15. ABOUT AWM AGENT
         ======================================================== */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="bg-[#F5F8F5] rounded-3xl p-8 sm:p-12 border border-[#DCE8E2] space-y-8">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
              <span>ABOUT AWM AGENT</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#103D35] tracking-tight">
              Designed Around Real Waste-Management Workflows
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              AWM Agent is designed to connect citizen reporting, AI-assisted report analysis, authorised work assignment and complaint tracking within one waste-management platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#E9F5EF] text-[#16836A] flex items-center justify-center font-bold text-xs">
                01
              </div>
              <h3 className="font-bold text-sm text-[#103D35]">Make Waste Reporting Easier</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Provide residents with a direct, structured way to report local issues.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#E9F5EF] text-[#16836A] flex items-center justify-center font-bold text-xs">
                02
              </div>
              <h3 className="font-bold text-sm text-[#103D35]">Improve Coordination</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect field crews, supervisors and citizens across shared task records.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#E9F5EF] text-[#16836A] flex items-center justify-center font-bold text-xs">
                03
              </div>
              <h3 className="font-bold text-sm text-[#103D35]">Support Decisions</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Structured operational triage helps managers dispatch work systematically.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-[#E9F5EF] text-[#16836A] flex items-center justify-center font-bold text-xs">
                04
              </div>
              <h3 className="font-bold text-sm text-[#103D35]">Transparent Progress</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Citizens observe verified milestone updates as collection work proceeds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          16. TECHNOLOGY SECTION
         ======================================================== */}
      <section id="technology" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-bold text-[#16836A] uppercase tracking-wider">
            <span>ENGINEERING FOUNDATION</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#103D35] tracking-tight">
            Technology Behind AWM Agent
          </h2>
          <p className="text-sm text-slate-600">
            Built using modern, reliable open-source frameworks and production-ready cloud services.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
            <div className="flex items-center gap-2 text-[#103D35] font-bold text-sm">
              <Server className="w-4 h-4 text-[#16836A]" />
              <span>FastAPI</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Backend application and API layer handling authenticated route security and report lifecycle.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
            <div className="flex items-center gap-2 text-[#103D35] font-bold text-sm">
              <Database className="w-4 h-4 text-[#16836A]" />
              <span>Supabase</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              PostgreSQL persistent database storing user profiles, reports, and task progression.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
            <div className="flex items-center gap-2 text-[#103D35] font-bold text-sm">
              <Cpu className="w-4 h-4 text-[#16836A]" />
              <span>Gemini AI</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Multimodal image vision triage analyzing citizen uploads for waste classification and urgency.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#DCE8E2] space-y-2">
            <div className="flex items-center gap-2 text-[#103D35] font-bold text-sm">
              <Workflow className="w-4 h-4 text-[#16836A]" />
              <span>n8n Engine</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Event-driven webhook automation orchestrating background processing and departmental routing.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          17. FINAL CALL TO ACTION (FOREST GREEN WITH CORAL CTA)
         ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-[#103D35] text-white rounded-3xl p-10 sm:p-14 lg:p-16 border border-[#16836A]/30 shadow-card text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-bold text-[#E9F5EF] uppercase tracking-wider">
              <span>JOIN THE CIVIC CLEANUP</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Let's Make Waste Management Work Better
            </h2>
            <p className="text-base text-white/85 leading-relaxed max-w-xl mx-auto">
              Connect reporting, coordinated action and complaint tracking through one unified platform.
            </p>
            <div className="pt-2">
              <Link to="/portals">
                <Button
                  variant="coral"
                  size="lg"
                  className="font-bold px-9 py-3 text-base shadow-lg"
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                >
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
