import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/Loading';
import { AlertBanner } from '../../components/common/Error';
import { authService } from '../../services/authService';
import { useToast } from '../../hooks/useToast';
import { PendingApproval } from '../../types/auth';
import { formatDate } from '../../utils/formatters';
import { UserCheck, UserX, Clock, Building2, MapPin, CheckCircle2, ShieldAlert } from 'lucide-react';

interface PendingApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const PendingApprovalsModal: React.FC<PendingApprovalsModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { success, error } = useToast();

  const fetchApprovals = () => {
    setLoading(true);
    setErrorMessage(null);
    authService
      .getPendingApprovals()
      .then((data) => {
        setApprovals(data || []);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Could not fetch pending approvals.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchApprovals();
    }
  }, [isOpen]);

  const handleReview = async (userId: string, action: 'approve' | 'reject') => {
    setProcessingId(userId);
    try {
      const res = await authService.reviewApproval(userId, action);
      success(res.message || `Application ${action === 'approve' ? 'approved' : 'rejected'}.`);
      setApprovals((prev) => prev.filter((a) => a.user_id !== userId));
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review action failed.';
      error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Staff & Manager Registration Approvals"
      subtitle="Review pending role authorization requests submitted to the municipal database."
      maxWidth="2xl"
      footer={
        <Button variant="secondary" size="md" onClick={onClose}>
          Close Queue
        </Button>
      }
    >
      <div className="space-y-4">
        {errorMessage && (
          <AlertBanner
            message={errorMessage}
            variant="error"
            onRetry={fetchApprovals}
          />
        )}

        {loading ? (
          <LoadingSpinner text="Loading pending authorization queue..." />
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center bg-[#F5F8F5] border border-[#DCE8E2] rounded-xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#16836A] mx-auto" />
            <h4 className="text-sm font-bold text-[#103D35]">Authorization Queue Clear</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no pending staff or manager registration requests awaiting review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((item) => (
              <div
                key={item.user_id}
                className="p-4 rounded-xl border border-[#DCE8E2] bg-white shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.full_name}</span>
                    <Badge role={item.requested_role} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{item.email}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 pt-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-[#16836A]" /> {item.organization}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#16836A]" /> {item.district} ({item.ward})
                    </span>
                    {item.created_at && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">
                          Applied {formatDate(item.created_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DCE8E2]">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReview(item.user_id, 'reject')}
                    isLoading={processingId === item.user_id}
                    leftIcon={<UserX className="w-3.5 h-3.5" />}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="emerald"
                    size="sm"
                    onClick={() => handleReview(item.user_id, 'approve')}
                    isLoading={processingId === item.user_id}
                    leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                  >
                    Approve & Issue ID
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
