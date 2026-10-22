import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/Error';
import { reportService } from '../../services/reportService';
import { useToast } from '../../hooks/useToast';
import { WasteReport } from '../../types/report';
import { formatDate, formatReportNumber } from '../../utils/formatters';
import {
  MapPin,
  Clock,
  Bot,
  Truck,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  Send,
  Play,
  Upload,
  Check,
  ShieldCheck,
  Camera,
} from 'lucide-react';

interface WorkOrderDetailModalProps {
  report: WasteReport | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const WorkOrderDetailModal: React.FC<WorkOrderDetailModalProps> = ({
  report,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [staffNote, setStaffNote] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [directResolve, setDirectResolve] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { success, error: toastError } = useToast();

  if (!isOpen || !report) return null;

  const currentStage = report.lifecycle_stage || (
    report.status === 'Resolved'
      ? 'RESOLVED'
      : report.status === 'In Progress'
      ? 'IN_PROGRESS'
      : 'ASSIGNED'
  );

  // 1. Staff Accepts Assignment
  const handleAcceptAssignment = async () => {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await reportService.acceptStaffAssignment(report.id);
      success(`Assignment for #${report.report_number} accepted. Ready to start field work.`);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept assignment.';
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // 2. Staff Starts Work
  const handleStartWork = async () => {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await reportService.startStaffWork(report.id);
      success(`Work started for #${report.report_number}. Status updated to 'In Progress'.`);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start work.';
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. Staff Submits Resolution
  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNote.trim()) {
      setErrorMessage('Please provide field resolution notes explaining the clearance.');
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      let uploadedPhotoUrl: string | undefined = undefined;

      // Upload completion evidence photo if selected
      if (resolutionPhoto) {
        const uploadRes = await reportService.uploadPhoto(resolutionPhoto);
        uploadedPhotoUrl = uploadRes.file_path;
      }

      await reportService.submitStaffResolution(report.id, {
        staff_note: staffNote.trim(),
        photo_url: uploadedPhotoUrl,
        direct_resolve: directResolve,
      });

      success(
        directResolve
          ? `Work order #${report.report_number} resolved directly.`
          : `Resolution submitted for #${report.report_number}. Awaiting Manager verification.`
      );
      setStaffNote('');
      setResolutionPhoto(null);
      setPhotoPreview(null);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit resolution.';
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResolutionPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Work Order ${formatReportNumber(report.report_number)}`}
      subtitle={`Assigned field dispatch incident • ${report.waste_category}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {errorMessage && (
          <AlertBanner
            message={errorMessage}
            variant="error"
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Priority & Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#F5F8F5] border border-[#DCE8E2] rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Current Status:</span>
            <Badge status={report.status} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Severity:</span>
            <Badge priority={report.ai_priority || 'MEDIUM'} />
          </div>

          <div className="text-xs text-slate-600">
            <span className="text-slate-500">Reported:</span>{' '}
            <strong className="text-slate-800">{formatDate(report.created_at)}</strong>
          </div>
        </div>

        {/* Workflow Lifecycle Step Indicator */}
        <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#103D35] uppercase tracking-wider">
              Field Execution Lifecycle
            </span>
            <span className="text-[11px] font-mono font-bold text-[#16836A] bg-[#E8F5F1] px-2.5 py-0.5 rounded-full">
              Stage: {currentStage}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center pt-2">
            <div className={`p-2 rounded-lg text-xs font-semibold ${
              ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED', 'RESOLVED'].includes(currentStage)
                ? 'bg-[#16836A] text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              1. Assigned
            </div>
            <div className={`p-2 rounded-lg text-xs font-semibold ${
              ['ACCEPTED', 'IN_PROGRESS', 'RESOLUTION_SUBMITTED', 'RESOLVED'].includes(currentStage)
                ? 'bg-[#16836A] text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              2. Accepted
            </div>
            <div className={`p-2 rounded-lg text-xs font-semibold ${
              ['IN_PROGRESS', 'RESOLUTION_SUBMITTED', 'RESOLVED'].includes(currentStage)
                ? 'bg-[#F59E0B] text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              3. In Progress
            </div>
            <div className={`p-2 rounded-lg text-xs font-semibold ${
              currentStage === 'RESOLVED'
                ? 'bg-[#16836A] text-white'
                : currentStage === 'RESOLUTION_SUBMITTED'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              4. Resolved
            </div>
          </div>
        </div>

        {/* Citizen Evidence Photo */}
        {(report.photo_signed_url || report.photo_url) && (
          <div>
            <p className="text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-2">
              Citizen Evidence Photo
            </p>
            <div className="rounded-xl overflow-hidden border border-[#DCE8E2] bg-slate-900 max-h-60 flex items-center justify-center">
              <img
                src={report.photo_signed_url || report.photo_url || ''}
                alt="Citizen Evidence"
                className="w-full h-60 object-cover"
              />
            </div>
          </div>
        )}

        {/* Description & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#DCE8E2] bg-white space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Citizen Description
            </span>
            <p className="text-xs text-slate-700 leading-relaxed">{report.description}</p>
          </div>

          <div className="p-4 rounded-xl border border-[#DCE8E2] bg-white space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dispatch Location
            </span>
            <p className="text-xs text-slate-800 font-semibold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#16836A]" />
              {report.address || 'Address unrecorded'}
            </p>
            <p className="text-xs text-slate-600">Ward: {report.ward || 'Central District'}</p>
            {report.latitude && report.longitude ? (
              <p className="text-[11px] text-[#16836A] font-mono">
                GPS: {report.latitude}, {report.longitude}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Location unavailable (no GPS)</p>
            )}
          </div>
        </div>

        {/* Gemini AI Decision */}
        {report.ai_summary && (
          <div className="p-3.5 rounded-xl bg-[#E8F5F1] border border-[#16836A]/30 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[#103D35]">
              <Bot className="w-4 h-4 text-[#16836A]" />
              <span>Gemini AI Triage Assessment</span>
            </div>
            <p className="text-slate-700 italic">{report.ai_summary}</p>
          </div>
        )}

        {/* Resolution Notes & Photo (If already submitted) */}
        {report.resolution_notes && (
          <div className="p-4 rounded-xl bg-white border border-[#DCE8E2] space-y-2">
            <span className="text-xs font-bold text-[#103D35] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#16836A]" />
              Submitted Field Resolution Evidence
            </span>
            <p className="text-xs text-slate-700 bg-[#F5F8F5] p-3 rounded-lg border border-[#DCE8E2]">
              {report.resolution_notes}
            </p>
            {report.resolution_photo_signed_url && (
              <div className="mt-2 rounded-lg overflow-hidden border border-[#DCE8E2] max-h-48">
                <img
                  src={report.resolution_photo_signed_url}
                  alt="Resolution Evidence"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            STAGE-SPECIFIC ACTIONS
           ======================================================== */}

        {/* STEP 1 ACTION: Accept Assignment */}
        {currentStage === 'ASSIGNED' && (
          <div className="p-5 bg-[#F5F8F5] border border-[#DCE8E2] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#103D35]">
              <Check className="w-4 h-4 text-[#16836A]" />
              <span>Step 1: Accept Assigned Work Order</span>
            </div>
            <p className="text-xs text-slate-600">
              Confirm receipt of this dispatch order to inform the Operations Manager that you have acknowledged the assignment.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="emerald"
                size="md"
                onClick={handleAcceptAssignment}
                isLoading={isUpdating}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Accept Assignment
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 ACTION: Start Work */}
        {currentStage === 'ACCEPTED' && (
          <div className="p-5 bg-[#F5F8F5] border border-[#DCE8E2] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#103D35]">
              <Play className="w-4 h-4 text-[#F59E0B]" />
              <span>Step 2: Start Field Collection Work</span>
            </div>
            <p className="text-xs text-slate-600">
              Mark this task as 'In Progress' upon dispatching the collection vehicle or arriving at the site.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleStartWork}
                isLoading={isUpdating}
                leftIcon={<Play className="w-4 h-4" />}
              >
                Start Collection Work
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 ACTION: Submit Resolution */}
        {currentStage === 'IN_PROGRESS' && (
          <form onSubmit={handleSubmitResolution} className="p-4 bg-[#FBFDFB] border border-[#DCE8E2] rounded-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#103D35] flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#16836A]" />
              Step 3: Submit Resolution & Completion Evidence
            </h4>

            <Textarea
              label="Field Resolution Notes / Remarks *"
              placeholder="e.g. Crew A arrived with Compactor 04. 1.2 tons of plastic waste cleared from roadway. Site sanitised."
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              rows={3}
              required
              helperText="Describe the actions taken, vehicles used, and outcome for the permanent municipal record."
            />

            {/* Completion Photo Evidence Upload */}
            <div>
              <label className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
                Upload Completion Evidence Photo (Optional)
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-3.5 py-2 bg-white border border-[#DCE8E2] rounded-xl text-xs font-semibold text-slate-700 hover:bg-[#F5F8F5] transition-colors">
                  <Camera className="w-4 h-4 text-[#16836A]" />
                  <span>{resolutionPhoto ? 'Change Photo' : 'Choose Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
                {resolutionPhoto && (
                  <span className="text-xs text-[#16836A] font-medium truncate max-w-xs">
                    {resolutionPhoto.name}
                  </span>
                )}
              </div>
              {photoPreview && (
                <div className="mt-2.5 rounded-xl overflow-hidden border border-[#DCE8E2] max-h-40">
                  <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
                </div>
              )}
            </div>

            {/* Direct Resolve Toggle */}
            <div className="pt-2 border-t border-[#DCE8E2]">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={directResolve}
                  onChange={(e) => setDirectResolve(e.target.checked)}
                  className="rounded border-[#DCE8E2] text-[#16836A] focus:ring-[#16836A]"
                />
                <span className="text-slate-700 font-medium">
                  Direct Resolution (Mark as fully Resolved without requiring secondary Manager approval)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" size="md" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="emerald"
                size="md"
                type="submit"
                isLoading={isUpdating}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {directResolve ? 'Resolve Complaint' : 'Submit for Verification'}
              </Button>
            </div>
          </form>
        )}

        {/* STAGE: RESOLUTION_SUBMITTED */}
        {currentStage === 'RESOLUTION_SUBMITTED' && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Resolution Submitted — Awaiting Operations Manager Verification
            </p>
            <p className="text-blue-700">
              Your field resolution notes and evidence have been logged. The Operations Manager will verify completion and transition this report to final 'Resolved' status.
            </p>
          </div>
        )}

        {/* STAGE: RESOLVED */}
        {currentStage === 'RESOLVED' && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#16836A]" />
              Complaint Resolved Successfully
            </p>
            <p className="text-emerald-700">
              This municipal work order has been completed, verified, and officially closed.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
