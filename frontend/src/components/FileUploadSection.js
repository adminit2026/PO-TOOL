import React from 'react';
import { Upload } from '@phosphor-icons/react';

// Constants
const BYTES_PER_KB = 1024;

/**
 * FileUploadSection - Component for uploading PO, Stock, and Sales Excel files
 */
const FileUploadSection = ({
  poFile,
  stockFile,
  salesFile,
  isDragging,
  uploading,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileChange,
  onUpload
}) => {
  return (
    <div className="bg-gray-50 border-2 border-blue-600 p-8">
      <h2 className="text-2xl font-black mb-6 text-blue-600" style={{ fontFamily: "'Courier New', monospace" }}>
        UPLOAD PURCHASE ORDER
      </h2>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-4 border-dashed p-8 transition-colors ${
          isDragging ? 'border-green-400 bg-blue-50' : 'border-green-800 bg-gray-50'
        }`}
        data-testid="file-drop-zone"
      >
        <div className="text-center mb-6">
          <Upload size={48} weight="bold" className="mx-auto mb-3 text-blue-700" />
          <p className="text-base font-mono uppercase tracking-wider mb-2 text-blue-600">
            Upload Excel Files
          </p>
          <p className="text-xs text-gray-500">Drag & drop or browse files</p>
        </div>

        {/* File Upload Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PO File */}
          <FileInputCard
            id="po-file-input"
            title="Purchase Order *"
            file={poFile}
            onFileChange={(e) => onFileChange(e, 'po')}
            buttonLabel={poFile ? 'Change File' : 'Browse PO'}
            testId="po-file-input"
          />

          {/* Stock File */}
          <FileInputCard
            id="stock-file-input"
            title="Stock/Inventory"
            file={stockFile}
            onFileChange={(e) => onFileChange(e, 'stock')}
            buttonLabel={stockFile ? 'Change File' : 'Browse Stock'}
            testId="stock-file-input"
            optional
          />

          {/* Sales File */}
          <FileInputCard
            id="sales-file-input"
            title="Sales Data"
            file={salesFile}
            onFileChange={(e) => onFileChange(e, 'sales')}
            buttonLabel={salesFile ? 'Change File' : 'Browse Sales'}
            testId="sales-file-input"
            optional
          />
        </div>
      </div>

      {/* Upload Button */}
      {poFile && (
        <div className="mt-6 p-4 bg-blue-600 text-black flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider font-bold">Ready to Process</p>
            <p className="font-medium">
              {poFile.name}
              {stockFile && ' + Stock'}
              {salesFile && ' + Sales'}
            </p>
          </div>
          <button
            onClick={onUpload}
            disabled={uploading}
            className="bg-gray-50 text-blue-600 px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-900 border-2 border-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="upload-button"
          >
            {uploading ? 'Processing...' : 'Process Files'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * FileInputCard - Individual file input card component
 */
const FileInputCard = ({ id, title, file, onFileChange, buttonLabel, testId, optional }) => {
  return (
    <div className="border-2 border-gray-300 p-4 bg-gray-50">
      <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 mb-2">
        {title}
      </p>
      <label
        htmlFor={id}
        className="block text-center bg-blue-600 text-black px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-blue-700 transition-colors"
      >
        {buttonLabel}
      </label>
      <input
        id={id}
        type="file"
        accept=".xlsx,.xls"
        onChange={onFileChange}
        className="hidden"
        data-testid={testId}
      />
      {file ? (
        <div className="mt-2">
          <p className="text-xs text-blue-600 truncate" title={file.name}>{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / BYTES_PER_KB).toFixed(1)} KB</p>
        </div>
      ) : (
        optional && <p className="text-xs text-gray-600 mt-2">Optional</p>
      )}
    </div>
  );
};

export default FileUploadSection;
