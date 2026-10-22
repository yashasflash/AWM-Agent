import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Clock, ShieldAlert, RefreshCw, LogOut, ArrowLeft } from 'lucide-react';

export const PendingApprovalPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const refreshed = await refreshUser();
      if (refreshed) {
        if (refreshed.approval_status === 'approved' && !refreshed.is_pending_approval) {
          info('Your account has been authorized! Redirecting to your workspace...');
          if (refreshed.role === 'manager' || refreshed.is_manager) {
            navigate('/manager');
          } else if (refreshed.role === 'municipal_staff' || refreshed.is_staff) {
            navigate('/municipal');
          } else {
            navigate('/citizen');
          }
          return;
        }
      }
      info('Your registration is currently under review by Municipal Operations.');
    } catch {
      info('Could not refresh status at this time. Please check back shortly.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
      <div className="w-full max-w-lg">
        <Card variant="flat" className="shadow-card p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF7E6] border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center mx-auto mb-5 shadow-subtle">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF7E6] text-[#B45309] border border-[#F59E0B]/30 mb-3">
            Approval Pending Review
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-[#103D35] mb-2">
            Authorization in Progress
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
            Your application for{' '}
            <strong className="text-slate-900 font-semibold">
              {user?.requested_role === 'manager' ? 'Operations Manager' : 'Municipal Field Staff'}
            </strong>{' '}
            has been securely registered in the municipal database. An authorized administrator must approve
            your role before you can access privileged work orders.
          </p>

          <div className="p-4 rounded-xl bg-[#F5F8F5] border border-[#DCE8E2] text-left text-xs space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-slate-500">Applicant:</span>
              <span className="font-semibold text-slate-800">{user?.full_name || 'Staff Member'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Registered Email:</span>
              <span className="font-semibold text-slate-800">{user?.email || 'Registered Email'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Requested Tier:</span>
              <span className="font-semibold text-[#16836A] capitalize">
                {user?.requested_role || 'Municipal Staff'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jurisdiction:</span>
              <span className="font-semibold text-slate-800">
                {user?.organization || 'Central Municipality'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleCheckStatus}
              isLoading={checking}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Check Approval Status
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                logout();
                navigate('/auth/login');
              }}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out
            </Button>
          </div>

          <div className="mt-8 pt-5 border-t border-[#DCE8E2] text-xs text-slate-500">
            Need urgent deployment? Contact the Municipal Administration Office at (080) 555-MUNI.
          </div>
        </Card>
      </div>
    </div>
  );
};
