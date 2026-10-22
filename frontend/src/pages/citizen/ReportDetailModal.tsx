import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/Loading';
import { reportService } from '../../services/reportService';
import { WasteReport, CollectionTask } from '../../types/report';
import { formatDate, formatReportNumber } from '../../utils/formatters';
import {
  MapPin,
  Calendar,
  Bot,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Clock,
  Compass,
} from 'lucide-react';

interface ReportDetailModalProps {
  reportId: string | number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ reportId, isOpen, onClose }) => {
  const [report, setReport] = useState<WasteReport | null>(null);
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && reportId) {
      setLoading(true);
      setError(null);
      reportService
        .getReportDetail(reportId)
        .then((res) => {
          setReport(res.report);
          setTasks(res.tasks || []);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Could not load report details.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setReport(null);
      setTasks([]);
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={report ? `Incident Record ${formatReportNumber(report.report_number)}` : 'Loading Incident...'}
      subtitle={report ? `Submitted on ${formatDate(report.created_at)}` : undefined}
      maxWidth="xl"
      footer={
        <Button variant="secondary" size="md" onClick={onClose}>
          Close Record
        </Button>
      }
    >
      {loading ? (
        <LoadingSpinner text="Retrieving municipal incident record..." />
      ) : error ? (
        <div className="p-6 text-center text-sm text-[#E76F51]">{error}</div>
      ) : report ? (
        <div className="space-y-6">
          {/* Header Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#F5F8F5] border border-[#DCE8E2] rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Status:</span>
              <Badge status={report.status} />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">AI Priority:</span>
              <Badge priority={report.ai_priority || 'MEDIUM'} />
            </div>

            <div className="text-xs text-slate-600">
              <span className="text-slate-500">Category:</span>{' '}
              <strong className="text-slate-900">{report.waste_category}</strong>
            </div>
          </div>

          {/* Photo Display (if attached) */}
          {(report.photo_signed_url || report.photo_url) && (
            <div>
              <p className="text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-2">
                Field Evidence Photo
              </p>
              <div className="rounded-xl overflow-hidden border border-[#DCE8E2] bg-slate-900 max-h-72 flex items-center justify-center">
                <img
                  src={report.photo_signed_url || report.photo_url || ''}
                  alt={`Waste Evidence #${report.report_number}`}
                  className="w-full h-72 object-cover"
                />
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-1.5">
              Citizen Description
            </p>
            <div className="p-4 bg-white border border-[#DCE8E2] rounded-xl text-sm text-slate-700 leading-relaxed">
              {report.description}
            </div>
          </div>

          {/* Gemini AI Decision Section */}
          <div className="p-4 rounded-xl bg-[#E8F5F1] border border-[#16836A]/30 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#103D35]">
              <Bot className="w-4 h-4 text-[#16836A]" />
              <span>Gemini AI Autonomous Decision Record</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">AI Verified Category:</span>
                <span className="font-semibold text-slate-800">
                  {report.ai_category || report.waste_category}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Department:</span>
                <span className="font-semibold text-slate-800">
                  {report.assigned_department || 'Solid Waste Management'}
                </span>
              </div>
            </div>
            {report.ai_summary && (
              <div className="text-xs text-slate-700 bg-white/70 p-3 rounded-lg border border-[#16836A]/20">
                <span className="font-semibold block text-[#103D35] mb-1">Automated Summary:</span>
                {report.ai_summary}
              </div>
            )}
          </div>

          {/* Location & Ward */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-[#DCE8E2] bg-[#FBFDFB]">
              <span className="text-slate-500 block mb-1">Ward Jurisdiction:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#16836A]" />
                {report.ward || 'Central District'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#DCE8E2] bg-[#FBFDFB]">
              <span className="text-slate-500 block mb-1">Physical Location:</span>
              <span className="font-semibold text-slate-800">
                {report.address || (report.latitude ? `${report.latitude}, ${report.longitude}` : 'Location unrecorded')}
              </span>
            </div>
          </div>

          {/* Collection Tasks & Crew Field Notes */}
          {tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#103D35] uppercase tracking-wider mb-2">
                Field Dispatch & Work Order Logs ({tasks.length})
              </p>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl border border-[#DCE8E2] bg-white text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{task.task_number || 'TASK-DISPATCH'}</span>
                      <Badge status={task.status} size="sm" />
                    </div>
                    {task.assigned_vehicle && (
                      <p className="text-slate-600 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-[#16836A]" /> Assigned Crew: {task.assigned_vehicle}
                      </p>
                    )}
                    {task.description && (
                      <div className="p-2.5 rounded bg-[#F5F8F5] text-slate-700 whitespace-pre-wrap mt-1">
                        {task.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
