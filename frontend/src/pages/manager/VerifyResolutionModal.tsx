import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/Error';
import { reportService } from '../../services/reportService';
import { useToast } from '../../hooks/useToast';
import { WasteReport } from '../../types/report';
import { formatReportNumber, formatDate } from '../../utils/formatters';
import { CheckCircle2, XCircle, ShieldCheck, FileCheck, AlertTriangle } from 'lucide-react';

interface VerifyResolutionModalProps {
  report: WasteReport | null;
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export const VerifyResolutionModal: React.FC<VerifyResolutionModalProps> = ({
  report,
  isOpen,
  onClose,
  onVerified,
}) => {
  const [managerNote, setManagerNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success, error: toastError } = useToast();

  if (!isOpen || !report) return null;

  const handleAction = async (action: 'approve' | 'reject') => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await reportService.verifyManagerResolution(report.id, {
        action,
        manager_note: managerNote.trim() || undefined,
      });

      if (action === 'approve') {
        success(`Report #${report.report_number} verified and marked as Resolved!`);
      } else {
        success(`Report #${report.report_number} resolution rejected. Returned to 'In Progress'.`);
      }
      onVerified();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete resolution verification.';
      setErrorMsg(msg);
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Verify Resolution: ${formatReportNumber(report.report_number)}`}
      subtitle={`Review field clearance evidence submitted by municipal crew.`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {errorMsg && (
          <AlertBanner
            message={errorMsg}
            variant="error"
            onDismiss={() => setErrorMsg(null)}
          />
        )}

        {/* Incident Summary */}
        <div className="p-3.5 rounded-xl bg-[#F5F8F5] border border-[#DCE8E2] text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#103D35]">{report.waste_category}</span>
            <span className="text-slate-500">{formatDate(report.created_at)}</span>
          </div>
          <p className="text-slate-600 line-clamp-2">{report.description}</p>
          <div className="text-[11px] text-[#16836A] font-semibold pt-1">
            Assigned to: {report.assigned_staff_name || report.assigned_staff || 'Field Officer'} ({report.assigned_department || 'Solid Waste Management'})
          </div>
        </div>

        {/* Staff Submitted Notes & Evidence */}
        <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-3">
          <span className="text-xs font-bold text-[#103D35] uppercase tracking-wider flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-[#16836A]" />
            Field Crew Resolution Submission
          </span>

          <div className="text-xs text-slate-800 bg-[#F5F8F5] p-3 rounded-lg border border-[#DCE8E2]">
            <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Crew Resolution Notes:</span>
            {report.resolution_notes || 'No resolution notes were recorded.'}
          </div>

          {(report.resolution_photo_signed_url || report.resolution_photo_url) && (
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                Resolution Photographic Evidence
              </span>
              <div className="rounded-xl overflow-hidden border border-[#DCE8E2] max-h-56 flex items-center justify-center bg-slate-900">
                <img
                  src={report.resolution_photo_signed_url || report.resolution_photo_url || ''}
                  alt="Field Clearance Evidence"
                  className="w-full h-56 object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Manager Verification Review Notes */}
        <div>
          <Textarea
            label="Manager Verification Notes / Audit Remarks"
            placeholder="e.g. Field inspection confirmed clearance. Street pavement reopened for civic use."
            value={managerNote}
            onChange={(e) => setManagerNote(e.target.value)}
            rows={2}
            helperText="Appends your executive verification signature to the permanent task record."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[#DCE8E2]">
          <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="coral"
              size="md"
              onClick={() => handleAction('reject')}
              isLoading={isSubmitting}
              leftIcon={<XCircle className="w-4 h-4" />}
            >
              Reject & Request Redo
            </Button>
            <Button
              variant="emerald"
              size="md"
              onClick={() => handleAction('approve')}
              isLoading={isSubmitting}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve & Resolve Complaint
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
