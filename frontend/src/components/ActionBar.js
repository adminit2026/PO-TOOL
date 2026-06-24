import React from 'react';
import { DownloadSimple, CheckSquare } from '@phosphor-icons/react';

/**
 * ActionBar - Download buttons and actions for processed results
 */
const ActionBar = ({
  filename,
  uploadId,
  onApproveAll,
  onDownloadExport,
  onDownloadBox,
  onDownloadProductionSheets,
  onDownloadEANList,
  onDownloadPackingList,
  onDownloadAnalysis,
  onNewUpload
}) => {
  return (
    <div className="bg-white border-2 border-gray-300 p-4">
      <div className="mb-4">
        <p className="text-xs font-mono uppercase tracking-wider text-gray-600">Current File</p>
        <p className="font-medium text-gray-900" data-testid="current-filename">{filename}</p>
      </div>
      
      {/* Buttons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <ActionButton
          onClick={onApproveAll}
          icon={<CheckSquare size={16} weight="bold" />}
          label="Approve All"
          testId="approve-all-button"
        />
        <ActionButton
          onClick={() => onDownloadExport(uploadId)}
          icon={<DownloadSimple size={16} weight="bold" />}
          label="EXPORT"
          testId="download-export-button"
        />
        <ActionButton
          onClick={() => onDownloadBox(uploadId)}
          icon={<DownloadSimple size={16} weight="bold" />}
          label="BOX"
          testId="download-box-button"
        />
        <ActionButton
          onClick={() => onDownloadProductionSheets(uploadId)}
          icon={<DownloadSimple size={16} weight="bold" />}
          label="Prod Sheets"
          testId="download-production-sheets-button"
        />
        <ActionButton
          onClick={() => onDownloadEANList(uploadId)}
          icon={<DownloadSimple size={16} weight="bold" />}
          label="EAN List"
          testId="download-ean-list-button"
        />
        <ActionButton
          onClick={() => onDownloadPackingList(uploadId)}
          icon={<DownloadSimple size={16} weight="bold" />}
          label="Packing"
          testId="download-packing-list-button"
        />
        <ActionButton
          onClick={() => onDownloadAnalysis(uploadId)}
          icon={<DownloadSimple size={16} weight="bold" />}
          label="Analysis"
          testId="download-excel-button"
        />
        <button
          onClick={onNewUpload}
          className="bg-gray-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-gray-700 transition-colors"
          data-testid="new-upload-button"
        >
          New Upload
        </button>
      </div>
    </div>
  );
};

/**
 * ActionButton - Reusable button component for actions
 */
const ActionButton = ({ onClick, icon, label, testId }) => {
  return (
    <button
      onClick={onClick}
      className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
      data-testid={testId}
    >
      {icon}
      {label}
    </button>
  );
};

export default ActionBar;
