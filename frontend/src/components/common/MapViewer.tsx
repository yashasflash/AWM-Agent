import React from 'react';
import { WasteReport } from '../../types/report';
import { OperationsMap } from './OperationsMap';

interface MapViewerProps {
  reports: WasteReport[];
  selectedReport?: WasteReport | null;
  onSelectReport?: (report: WasteReport) => void;
  className?: string;
  userLocation?: { latitude: number; longitude: number } | { lat: number; lng: number } | null;
  title?: string;
  subtitle?: string;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  reports,
  selectedReport,
  onSelectReport,
  title = 'Municipal Operational Map',
  subtitle,
}) => {
  return (
    <OperationsMap
      reports={reports}
      selectedReport={selectedReport}
      onSelectReport={onSelectReport}
      title={title}
      subtitle={subtitle}
    />
  );
};

export default MapViewer;
