import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Select, Input } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/Error';
import { LoadingSpinner } from '../../components/common/Loading';
import { authService } from '../../services/authService';
import { reportService } from '../../services/reportService';
import { useToast } from '../../hooks/useToast';
import { WasteReport } from '../../types/report';
import { StaffMember } from '../../types/auth';
import { MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import { formatReportNumber } from '../../utils/formatters';
import { Truck, UserCheck, ShieldCheck, Send } from 'lucide-react';

interface AssignStaffModalProps {
  report: WasteReport | null;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignStaffModal: React.FC<AssignStaffModalProps> = ({
  report,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState('');
  const [department, setDepartment] = useState(
    report?.ai_department || report?.assigned_department || MUNICIPAL_DEPARTMENTS[0]
  );
  const [priority, setPriority] = useState<string>(
    report?.ai_priority || report?.priority || 'MEDIUM'
  );
  const [instructions, setInstructions] = useState<string>(
    report?.assigned_instructions || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success } = useToast();

  useEffect(() => {
    if (isOpen && report) {
      setDepartment(report.ai_department || report.assigned_department || MUNICIPAL_DEPARTMENTS[0]);
      setPriority(report.ai_priority || report.priority || 'MEDIUM');
      setInstructions(report.assigned_instructions || '');
      setLoadingStaff(true);
      setErrorMsg(null);
      authService
        .getStaffList()
        .then((staff) => {
          setStaffList(staff);
          if (staff.length > 0) {
            const currentStaff = report.assigned_staff?.toLowerCase();
            const matched = staff.find((s) => s.email.toLowerCase() === currentStaff);
            setSelectedStaffEmail(matched ? matched.email : staff[0].email);
          }
        })
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Could not fetch available staff.');
        })
        .finally(() => {
          setLoadingStaff(false);
        });
    }
  }, [isOpen, report]);

  if (!isOpen || !report) return null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffEmail) {
      setErrorMsg('Please select a municipal staff member.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const chosenStaff = staffList.find((s) => s.email === selectedStaffEmail);

    try {
      await reportService.assignReport(report.id, {
        staff_email: selectedStaffEmail,
        staff_name: chosenStaff?.name,
        department,
        priority: priority.toUpperCase(),
        manager_note: instructions.trim() || undefined,
      });

      success(
        `Incident #${report.report_number} dispatched to ${chosenStaff?.name || selectedStaffEmail}!`
      );
      onAssigned();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign staff member.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Work: Incident ${formatReportNumber(report.report_number)}`}
      subtitle={`Review incident, AI analysis, and dispatch authorized municipal personnel.`}
      maxWidth="lg"
    >
      <form onSubmit={handleAssign} className="space-y-4">
        {errorMsg && (
          <AlertBanner
            message={errorMsg}
            variant="error"
            onDismiss={() => setErrorMsg(null)}
          />
        )}

        {/* Incident Summary & AI Analysis Card */}
        <div className="p-4 rounded-xl bg-[#F5F8F5] border border-[#DCE8E2] text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-[#103D35] text-sm">
              {report.waste_category}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-slate-500">
                {formatReportNumber(report.report_number)}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#DCE8E2] text-slate-700">
                Status: {report.status}
              </span>
            </div>
          </div>

          <p className="text-slate-600">{report.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#DCE8E2] text-[11px] text-slate-600">
            <div>
              <span className="text-slate-400 font-medium">Ward:</span>{' '}
              <strong className="text-slate-800">{report.ward || 'Central District'}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Address:</span>{' '}
              <strong className="text-slate-800">{report.address || 'Not specified'}</strong>
            </div>
            {report.latitude && report.longitude && (
              <div className="sm:col-span-2 font-mono text-[#16836A]">
                GPS Coordinates: {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </div>
            )}
          </div>

          {/* AI Analysis Summary */}
          {report.ai_summary && (
            <div className="p-2.5 rounded-lg bg-[#E8F5F1] border border-[#16836A]/20 text-[11px] text-slate-700 space-y-1">
              <span className="font-bold text-[#103D35] block">Gemini AI Analysis:</span>
              <p className="italic">"{report.ai_summary}"</p>
              <div className="flex items-center gap-3 pt-1 text-[10px] text-[#16836A] font-semibold">
                <span>AI Category: {report.ai_category || report.waste_category}</span>
                <span>AI Priority: {report.ai_priority || 'MEDIUM'}</span>
                <span>Recommended Dept: {report.ai_department || 'Solid Waste Management'}</span>
              </div>
            </div>
          )}

          {/* Evidence Photo Preview */}
          {(report.photo_signed_url || report.photo_url) && (
            <div className="pt-2 border-t border-[#DCE8E2]">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                Citizen Attached Photo:
              </span>
              <div className="rounded-lg overflow-hidden border border-[#DCE8E2] max-h-36 bg-slate-900 flex items-center justify-center">
                <img
                  src={report.photo_signed_url || report.photo_url || ''}
                  alt="Incident evidence"
                  className="w-full h-36 object-cover"
                />
              </div>
            </div>
          )}

          {(report.assigned_staff || report.assigned_staff_name) && (
            <div className="pt-2 border-t border-[#DCE8E2] flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Currently Assigned Officer:</span>
              <span className="font-semibold text-[#16836A]">
                {report.assigned_staff_name || report.assigned_staff} ({report.assigned_department || 'Solid Waste Management'})
              </span>
            </div>
          )}
        </div>

        {report.status === 'Resolved' && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
            ✓ This complaint has already been resolved and verified. No further assignment is required.
          </div>
        )}

        {loadingStaff ? (
          <LoadingSpinner text="Retrieving available municipal personnel..." />
        ) : staffList.length === 0 ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            No active municipal field staff found. You can approve pending staff registrations in the Personnel queue.
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
                Select Municipal Staff Officer
              </label>
              <select
                value={selectedStaffEmail}
                onChange={(e) => setSelectedStaffEmail(e.target.value)}
                disabled={report.status === 'Resolved'}
                className="w-full bg-white border border-[#DCE8E2] rounded-lg text-sm text-slate-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#16836A]/20 focus:border-[#16836A] disabled:bg-slate-100 disabled:cursor-not-allowed"
                required
              >
                {staffList.map((staff) => (
                  <option key={staff.id || staff.email} value={staff.email}>
                    {staff.name} ({staff.staff_id || staff.designation || staff.email})
                  </option>
                ))}
              </select>
            </div>

            {report.assigned_staff && report.assigned_staff.toLowerCase() === selectedStaffEmail.toLowerCase() && report.status !== 'Resolved' && (
              <p className="text-[11px] text-amber-600 font-medium">
                ⚠️ Notice: Report #{report.report_number} is already assigned to this officer. Selecting another officer will reassign it.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Operating Department Division"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={report.status === 'Resolved'}
                options={MUNICIPAL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
                  Set Incident Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={report.status === 'Resolved'}
                  className="w-full bg-white border border-[#DCE8E2] rounded-lg text-sm text-slate-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#16836A]/20 focus:border-[#16836A] disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="HIGH">High Priority (Urgent)</option>
                  <option value="MEDIUM">Medium Priority (Standard)</option>
                  <option value="LOW">Low Priority (Routine)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
                Dispatch Instructions & Operational Notes (Optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Enter specific field instructions, equipment requirements, or access directions..."
                rows={2}
                disabled={report.status === 'Resolved'}
                className="w-full bg-white border border-[#DCE8E2] rounded-lg text-xs text-slate-800 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#16836A]/20 focus:border-[#16836A] disabled:bg-slate-100 disabled:cursor-not-allowed resize-none"
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE8E2]">
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            isLoading={isSubmitting}
            disabled={staffList.length === 0 || report.status === 'Resolved'}
            leftIcon={<Send className="w-4 h-4" />}
          >
            {report.assigned_staff ? 'Update Assignment' : 'Confirm Dispatch Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
