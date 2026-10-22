import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/Error';
import { UserRole } from '../../types/auth';
import {
  ShieldAlert,
  User,
  Truck,
  LayoutDashboard,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  X,
} from 'lucide-react';

interface LoginPageProps {
  forcedRole?: 'citizen' | 'municipal_staff' | 'manager';
}

export const LoginPage: React.FC<LoginPageProps> = ({ forcedRole }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signInWithGoogle, user } = useAuth();
  const { success } = useToast();

  // Determine active role strictly from prop or exact URL
  const determineRole = (): UserRole => {
    if (forcedRole) return forcedRole;
    if (location.pathname.includes('/login/municipal')) return 'municipal_staff';
    if (location.pathname.includes('/login/manager')) return 'manager';
    if (location.pathname.includes('/login/user')) return 'citizen';
    return 'citizen';
  };

  const [activeRole, setActiveRole] = useState<UserRole>(determineRole());
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);

  useEffect(() => {
    setActiveRole(determineRole());
    setFormError(null);
    setForgotPasswordNotice(false);
  }, [location.pathname, forcedRole]);

  // If already authenticated with authorized role, redirect to corresponding dashboard
  useEffect(() => {
    if (user) {
      if (user.approval_status === 'pending' || user.is_pending_approval) {
        navigate('/auth/pending-approval', { replace: true });
      } else if (user.role === 'manager' || user.is_manager) {
        navigate('/manager', { replace: true });
      } else if (user.role === 'municipal_staff' || user.is_staff) {
        navigate('/municipal', { replace: true });
      } else if (user.role === 'citizen') {
        navigate('/user', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!identifier.trim()) {
      setFormError(
        activeRole === 'citizen'
          ? 'Please enter your email address.'
          : activeRole === 'municipal_staff'
          ? 'Please enter your official email or Staff ID (STF-XXXXX).'
          : 'Please enter your administrative email or Manager ID (MGR-XXXXX).'
      );
      return;
    }

    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await login({
        identifier: identifier.trim(),
        password,
        portal: activeRole,
      });

      // Role authorization verification
      if (activeRole === 'manager') {
        if (!loggedUser.is_manager && loggedUser.role !== 'manager') {
          setFormError(
            'Access Denied: Operations Manager clearance required. Your account does not have Manager permissions.'
          );
          setIsSubmitting(false);
          return;
        }
        success(`Welcome back, Manager ${loggedUser.full_name || ''}!`);
        navigate('/manager');
      } else if (activeRole === 'municipal_staff') {
        if (!loggedUser.is_staff && loggedUser.role !== 'municipal_staff' && !loggedUser.is_manager && loggedUser.role !== 'manager') {
          setFormError(
            'Access Denied: Municipal Officer credentials required. Your account has Citizen permissions.'
          );
          setIsSubmitting(false);
          return;
        }
        if (loggedUser.approval_status === 'pending' || loggedUser.is_pending_approval) {
          navigate('/auth/pending-approval');
        } else {
          success(`Welcome back, Officer ${loggedUser.full_name || ''}!`);
          navigate('/municipal');
        }
      } else {
        // Citizen login portal
        if (loggedUser.is_manager || loggedUser.role === 'manager') {
          success(`Welcome back, Manager ${loggedUser.full_name || ''}!`);
          navigate('/manager');
        } else if (loggedUser.is_staff || loggedUser.role === 'municipal_staff') {
          if (loggedUser.approval_status === 'pending' || loggedUser.is_pending_approval) {
            navigate('/auth/pending-approval');
          } else {
            success(`Welcome back, Officer ${loggedUser.full_name || ''}!`);
            navigate('/municipal');
          }
        } else {
          success(`Welcome back, ${loggedUser.full_name || 'Resident'}!`);
          navigate('/user');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your email/ID and password.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle(activeRole);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication initiation failed. Please try again.';
      setFormError(msg);
      setIsGoogleLoading(false);
    }
  };

  // Role-Specific Metadata strictly following requirements
  const roleConfig = {
    citizen: {
      heading: 'Welcome Back',
      roleLabel: 'CITIZEN LOGIN',
      description: 'Sign in to report waste issues and track your complaints.',
      leftSubtitle: 'Autonomous civic reporting and verified municipal waste management.',
      supportingStatement: 'Every verified report triggers immediate autonomous AI analysis and coordinates municipal response across your ward.',
      idLabel: 'Email Address',
      idPlaceholder: 'citizen@example.com',
      inputType: 'email',
      primaryBtnText: 'Login as Citizen',
      primaryBtnVariant: 'coral' as const,
      roleBadgeBg: 'bg-[#FFF2EE] text-[#FF6848] border-[#FF6848]/20',
      icon: <User className="w-5 h-5 text-[#FF6848]" />,
      registerLink: '/auth/register-citizen',
      registerText: 'Create a free Citizen account',
      features: [
        'Photo-based waste incident reporting',
        'Automatic Gemini AI hazard classification',
        'Real-time 7-stage complaint timeline',
      ],
    },
    municipal_staff: {
      heading: 'Municipal Operations Login',
      roleLabel: 'MUNICIPAL OFFICER',
      description: 'Access municipal reports, incidents, and waste collection operations.',
      leftSubtitle: 'Field operations, cleansing fleet dispatch, and work-order resolution.',
      supportingStatement: 'Direct dispatch integration connecting field sanitation crews with AI-prioritized collection tasks and real-time route updates.',
      idLabel: 'Official Email or Staff ID (STF-XXXXX)',
      idPlaceholder: 'STF-50101 or staff@awm.gov',
      inputType: 'text',
      primaryBtnText: 'Login as Municipal Officer',
      primaryBtnVariant: 'emerald' as const,
      roleBadgeBg: 'bg-[#E8F5F1] text-[#16836A] border-[#16836A]/20',
      icon: <Truck className="w-5 h-5 text-[#16836A]" />,
      registerLink: '/auth/register-staff',
      registerText: 'Request Staff Registration',
      features: [
        'Assigned collection tasks and incident work orders',
        'One-click task status updates and clearance notes',
        'Field vehicle and service zone coordination',
      ],
    },
    manager: {
      heading: 'Manager Access',
      roleLabel: 'OPERATIONS MANAGER',
      description: 'Access authorized operational reports, incidents, and performance data.',
      leftSubtitle: 'Strategic operations command, department workload triage, and SLA oversight.',
      supportingStatement: 'City-wide resource allocation, autonomous AI decision oversight, and municipal accountability across all wards.',
      idLabel: 'Administrative Email or Manager ID (MGR-XXXXX)',
      idPlaceholder: 'MGR-66281 or manager@awm.gov',
      inputType: 'text',
      primaryBtnText: 'Login as Manager',
      primaryBtnVariant: 'primary' as const,
      roleBadgeBg: 'bg-[#F5F8F5] text-[#103D35] border-[#103D35]/20',
      icon: <LayoutDashboard className="w-5 h-5 text-[#103D35]" />,
      registerLink: '/auth/register-manager',
      registerText: 'Request Manager Authorization',
      features: [
        'City-wide operational metrics and live incident oversight',
        'Department dispatch and crew assignment management',
        'Municipal staff authorization and SLA compliance monitoring',
      ],
    },
  };

  const config = roleConfig[activeRole];

  return (
    <div className="max-w-5xl w-full mx-auto">
      {/* Standalone Two-Column Login Card on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-[#DCE8E2] shadow-card bg-white">
        {/* =========================================================
            LEFT PANEL: Branding, Role Description & Subtle Visual
           ========================================================= */}
        <div className="lg:col-span-5 bg-[#103D35] p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Background Glows */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#103D35] via-[#103D35]/95 to-[#0b2823] pointer-events-none" />
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-[#16836A]/20 blur-3xl pointer-events-none" />

          {/* Top: Logo & Product Name */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-[#FF6848]" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-white">
                  AWM <span className="text-[#FF6848]">Agent</span>
                </span>
                <p className="text-[11px] text-white/70">
                  Autonomous AI Waste Management
                </p>
              </div>
            </div>

            {/* Role Header & Description */}
            <div className="space-y-3 pt-3">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-white/10 text-white border border-white/20">
                {config.roleLabel}
              </span>
              <h2 className="text-2xl font-extrabold text-white leading-tight">
                {config.heading}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                {config.leftSubtitle}
              </p>
            </div>

            {/* Professional Waste Management Subtle Visual Block */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-3 my-4">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-white/90">
                <Sparkles className="w-4 h-4 text-[#FF6848] shrink-0" />
                <span>Autonomous AI Operations</span>
              </div>
              <ul className="space-y-2">
                {config.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px] text-white/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16836A] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom: Minimal Supporting Statement */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/10">
            <p className="text-xs text-white/70 leading-relaxed italic">
              "{config.supportingStatement}"
            </p>
          </div>
        </div>

        {/* =========================================================
            RIGHT PANEL: Role Heading, Form, Google Login, Secondary Link
           ========================================================= */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Role Indicator & Heading */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${config.roleBadgeBg}`}
                >
                  {config.icon}
                  <span>{config.roleLabel}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#103D35] tracking-tight">
                {config.heading}
              </h1>

              <p className="text-xs sm:text-sm text-slate-500">
                {config.description}
              </p>
            </div>

            {/* Error Message */}
            {formError && (
              <AlertBanner
                message={formError}
                variant="error"
                onDismiss={() => setFormError(null)}
              />
            )}

            {/* Forgot Password Information Banner */}
            {forgotPasswordNotice && (
              <div className="p-3.5 rounded-xl bg-[#E8F5F1] border border-[#16836A]/20 text-xs text-[#103D35] flex items-start gap-2.5 animate-fadeIn">
                <HelpCircle className="w-4 h-4 text-[#16836A] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Password Reset Assistance</p>
                  <p className="text-slate-600 mt-0.5">
                    For security verification, password resets must be initiated through your municipal administrator or by contacting support at support@awm.gov.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotPasswordNotice(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={config.idLabel}
                type={config.inputType}
                placeholder={config.idPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
                autoFocus
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordNotice(true)}
                    className="text-[11px] font-semibold text-[#16836A] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#DCE8E2] rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16836A] focus:border-transparent transition-all shadow-subtle"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#16836A] focus:ring-[#16836A] border-[#DCE8E2]"
                  />
                  <span>Remember me</span>
                </label>
              </div>

              {/* Primary Action Button */}
              <Button
                type="submit"
                variant={config.primaryBtnVariant}
                size="lg"
                className="w-full justify-center mt-2 shadow-sm font-semibold"
                isLoading={isSubmitting}
                disabled={isGoogleLoading}
              >
                {config.primaryBtnText}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#DCE8E2]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
                  Or
                </span>
              </div>
            </div>

            {/* Existing Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isGoogleLoading}
              className="w-full py-2.5 px-4 bg-white border border-[#DCE8E2] hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-subtle flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            {/* Registration & Secondary Navigation Links */}
            <div className="pt-4 border-t border-[#DCE8E2] text-center text-xs text-slate-600 space-y-2">
              <p>
                Need account access?{' '}
                <Link
                  to={config.registerLink}
                  className="font-bold text-[#16836A] hover:underline"
                >
                  {config.registerText}
                </Link>
              </p>

              <div>
                <Link
                  to="/portals"
                  className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-[#103D35] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Role Selection</span>
                </Link>
              </div>

              {activeRole === 'manager' && (
                <p className="text-[11px] text-slate-400 pt-1">
                  Initial administrator bootstrapping:{' '}
                  <Link
                    to="/auth/setup-manager"
                    className="text-slate-600 font-medium hover:underline"
                  >
                    Bootstrap Initial Manager
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
