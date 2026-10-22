import React, { useState, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input, Textarea, Select } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/Error';
import { Badge } from '../../components/common/Badge';
import { reportService } from '../../services/reportService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useToast } from '../../hooks/useToast';
import { WasteCategory, AIAutomationResult, WasteReport } from '../../types/report';
import { WASTE_CATEGORIES, WARDS_LIST } from '../../utils/constants';
import {
  Camera,
  Upload,
  MapPin,
  Compass,
  CheckCircle2,
  Bot,
  AlertCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (report: WasteReport, aiResult?: AIAutomationResult) => void;
}

export const NewReportModal: React.FC<NewReportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [category, setCategory] = useState<WasteCategory>('Garbage Overflow');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [ward, setWard] = useState(WARDS_LIST[0]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission & AI result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIAutomationResult | null>(null);
  const [createdReport, setCreatedReport] = useState<WasteReport | null>(null);

  const { getLocation, loading: geoLoading, error: geoError } = useGeolocation();
  const { success } = useToast();

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Photo exceeds 5 MB limit. Please select a smaller image.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Only JPG, PNG, and WEBP formats are accepted.');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrorMessage(null);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGetLocation = async () => {
    try {
      const coords = await getLocation();
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      if (!address) {
        setAddress(`GPS: ${coords.latitude}, ${coords.longitude}`);
      }
    } catch {
      // Error handled by hook
    }
  };

  const resetForm = () => {
    setCategory('Garbage Overflow');
    setDescription('');
    setAddress('');
    setWard(WARDS_LIST[0]);
    setLatitude(null);
    setLongitude(null);
    removePhoto();
    setErrorMessage(null);
    setAiResult(null);
    setCreatedReport(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (description.trim().length < 5) {
      setErrorMessage('Please describe the waste incident in at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    let uploadedFilePath: string | undefined = undefined;

    try {
      // 1. Upload Photo if selected
      if (photoFile) {
        const uploadRes = await reportService.uploadPhoto(photoFile);
        if (uploadRes.file_path) {
          uploadedFilePath = uploadRes.file_path;
        }
      }

      // 2. Create Report & Trigger AI Triage
      const response = await reportService.createReport({
        waste_category: category,
        description: description.trim(),
        address: address.trim() || undefined,
        ward: ward.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        photo_url: uploadedFilePath,
      });

      setCreatedReport(response.report);
      if (response.automation_result) {
        setAiResult(response.automation_result);
      }

      success(`Incident #${response.report.report_number} submitted to municipal dispatch!`);
      onSuccess(response.report, response.automation_result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report. Please check connection.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={aiResult ? 'Incident Submitted & AI Triaged' : 'Report New Waste Incident'}
      subtitle={
        aiResult
          ? 'Automated Gemini AI classification decision recorded in municipal ledger.'
          : 'Provide incident details, photo, and location for autonomous municipal dispatch.'
      }
      maxWidth="lg"
    >
      {/* SUCCESS / AI RESULT BANNER VIEW */}
      {aiResult && createdReport ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 rounded-xl bg-[#E8F5F1] border border-[#16836A]/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#16836A] text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#103D35]">
                    Gemini AI Autonomous Decision
                  </h4>
                  <p className="text-[11px] text-slate-500">Processed via n8n workflow engine</p>
                </div>
              </div>
              <Badge priority={aiResult.priority || 'MEDIUM'} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#16836A]/20">
              <div>
                <span className="text-slate-500 block">Classified Category:</span>
                <span className="font-semibold text-slate-800">
                  {aiResult.waste_category || createdReport.waste_category}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Unit:</span>
                <span className="font-semibold text-slate-800">
                  {aiResult.assigned_department || 'Solid Waste Management'}
                </span>
              </div>
            </div>

            {aiResult.reason && (
              <div className="text-xs text-slate-700 bg-white/70 p-2.5 rounded-lg border border-[#16836A]/20">
                <span className="font-semibold block text-[#103D35] mb-0.5">AI Triage Summary:</span>
                {aiResult.reason}
              </div>
            )}

            {aiResult.recommended_action && (
              <div className="text-xs text-[#103D35] font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#16836A]" />
                Recommended Action: {aiResult.recommended_action}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[#F5F8F5] border border-[#DCE8E2] text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Official Incident Tracking #:</span>
              <span className="font-bold text-[#103D35]">WM-{createdReport.report_number.toString().padStart(4, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jurisdiction Ward:</span>
              <span className="font-semibold text-slate-800">{createdReport.ward || 'Central District'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dispatch Status:</span>
              <Badge status={createdReport.status} size="sm" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="md" onClick={handleClose}>
              View in My Reports
            </Button>
          </div>
        </div>
      ) : (
        /* REPORT INPUT FORM */
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <AlertBanner
              message={errorMessage}
              variant="error"
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          {/* Category & Ward */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Incident Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as WasteCategory)}
              options={WASTE_CATEGORIES.map((c) => ({ label: c, value: c }))}
              required
            />

            <Select
              label="Municipal Ward"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              options={WARDS_LIST.map((w) => ({ label: w, value: w }))}
              required
            />
          </div>

          {/* Description */}
          <Textarea
            label="Incident Description"
            placeholder="Describe the waste situation, accumulation size, hazards, or obstruction..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            helperText="Minimum 5 characters. AI will evaluate this description for triage severity."
          />

          {/* Photo Upload with Live Preview */}
          <div>
            <label className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
              Evidence Waste Photo (Max 5 MB)
            </label>

            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[#DCE8E2] max-h-48 bg-slate-900 flex items-center justify-center">
                <img
                  src={photoPreview}
                  alt="Waste Evidence Preview"
                  className="w-full h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition-colors"
                  aria-label="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#DCE8E2] hover:border-[#16836A] rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#F5F8F5]/50 flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-[#DCE8E2] flex items-center justify-center text-[#16836A] shadow-subtle">
                  <Camera className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#103D35]">
                  Click to attach a waste photo (JPG, PNG, WEBP)
                </p>
                <p className="text-[11px] text-slate-400">Photos help field crews locate and dispatch appropriate equipment</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* Location & GPS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#103D35] uppercase tracking-wider">
                Location / Street Address
              </label>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={geoLoading}
                className="text-xs font-semibold text-[#16836A] hover:underline flex items-center gap-1"
              >
                <Compass className="w-3.5 h-3.5" />
                {geoLoading ? 'Acquiring GPS...' : 'Use Current GPS'}
              </button>
            </div>

            <Input
              placeholder="e.g. Near 14th Main Cross, opposite Central Park"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4" />}
            />

            {latitude && longitude && (
              <p className="text-[11px] text-[#16836A] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Geo-Coordinates Attached: {latitude}, {longitude}
              </p>
            )}

            {geoError && <p className="text-[11px] text-[#E76F51]">{geoError}</p>}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE8E2]">
            <Button variant="secondary" size="md" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="coral"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Submit & Run AI Triage
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
