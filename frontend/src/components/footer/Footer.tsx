import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../common/BrandLogo';

export const Footer: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-white border-t border-[#DCE8E2] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Col 1: Brand & Mission */}
          <div className="md:col-span-5 space-y-4">
            <BrandLogo size="md" />
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Autonomous AI Waste Management Agent connects citizens, municipal teams and operations
              managers through intelligent waste reporting and coordinated action.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F5EF] text-[11px] font-semibold text-[#16836A]">
              <span>Cleaner Streets. Smarter Waste Management.</span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#103D35]">
              Platform Navigation
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('hero')}
                  className="hover:text-[#16836A] transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="hover:text-[#16836A] transition-colors"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="hover:text-[#16836A] transition-colors"
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('about')}
                  className="hover:text-[#16836A] transition-colors"
                >
                  About AWM Agent
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Role Workspaces */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#103D35]">
              Operating Portals
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <Link to="/login/user" className="hover:text-[#16836A] transition-colors">
                  Citizen Reporting Portal
                </Link>
              </li>
              <li>
                <Link to="/login/municipal" className="hover:text-[#16836A] transition-colors">
                  Municipal Field Operations Portal
                </Link>
              </li>
              <li>
                <Link to="/login/manager" className="hover:text-[#16836A] transition-colors">
                  Operations Command Dashboard
                </Link>
              </li>
              <li>
                <Link to="/portals" className="text-[#16836A] font-semibold hover:underline">
                  View All Role Portals →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#DCE8E2] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© {new Date().getFullYear()} AWM Agent (Autonomous AI Waste Management Agent). All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Municipal Technology Hackathon Presentation</span>
            <span>•</span>
            <span>Intelligent Waste Lifecycle</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
