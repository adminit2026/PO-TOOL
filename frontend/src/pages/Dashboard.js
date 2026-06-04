import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import {
  Upload,
  DownloadSimple,
  Gear,
  Clock,
  SignOut,
  Warning,
  CheckCircle,
  X,
} from '@phosphor-icons/react';
import SettingsPanel from '@/components/SettingsPanel';
import ResultsTable from '@/components/ResultsTable';
import UploadHistory from '@/components/UploadHistory';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [poFile, setPoFile] = useState(null);
  const [stockFile, setStockFile] = useState(null);
  const [salesFile, setSalesFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      // Auto-detect file type based on name
      if (droppedFile.name.toLowerCase().includes('stock') || droppedFile.name.toLowerCase().includes('inventory')) {
        setStockFile(droppedFile);
        toast.success('Stock file added!');
      } else if (droppedFile.name.toLowerCase().includes('sales')) {
        setSalesFile(droppedFile);
        toast.success('Sales file added!');
      } else {
        setPoFile(droppedFile);
        toast.success('PO file added!');
      }
    } else {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
    }
  };

  const handleFileChange = (e, type) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (type === 'po') setPoFile(selectedFile);
      else if (type === 'stock') setStockFile(selectedFile);
      else if (type === 'sales') setSalesFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!poFile) {
      toast.error('Please select a PO file first');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('po_file', poFile);
    if (stockFile) formData.append('stock_file', stockFile);
    if (salesFile) formData.append('sales_file', salesFile);

    try {
      const { data } = await axios.post(`${API}/upload`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResults(data);
      const msg = `File processed successfully! ${stockFile ? '✓ Stock data included. ' : ''}${salesFile ? '✓ Sales data included.' : ''}`;
      toast.success(msg);
      setPoFile(null);
      setStockFile(null);
      setSalesFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (uploadId) => {
    try {
      const response = await axios.get(`${API}/download/${uploadId}`, {
        withCredentials: true,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `po_analysis_${uploadId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('File downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard">
      {/* Header */}
      <header className="bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center">
          <div>
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
              data-testid="dashboard-title"
            >
              PO REVIEW HUB
            </h1>
            <p className="text-xs font-mono uppercase tracking-wider text-gray-600 mt-1">
              Production Cost Analysis Dashboard
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-100 transition-colors"
              data-testid="history-toggle-button"
            >
              <Clock size={24} weight="bold" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 transition-colors"
              data-testid="settings-toggle-button"
            >
              <Gear size={24} weight="bold" />
            </button>
            <div className="h-8 w-px bg-gray-300"></div>
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-600 font-mono">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 hover:text-red-600 transition-colors"
              data-testid="logout-button"
            >
              <SignOut size={24} weight="bold" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-8">
          <div className="bg-white max-w-2xl w-full border-2 border-black relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 transition-colors"
              data-testid="close-settings-button"
            >
              <X size={24} weight="bold" />
            </button>
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-8">
          <div className="bg-white max-w-4xl w-full border-2 border-black relative max-h-[80vh] overflow-hidden">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 transition-colors z-10"
              data-testid="close-history-button"
            >
              <X size={24} weight="bold" />
            </button>
            <UploadHistory onSelectUpload={(upload) => {
              setShowHistory(false);
              // Load the selected upload
              axios.get(`${API}/results/${upload.upload_id}`, { withCredentials: true })
                .then(({ data }) => setResults(data))
                .catch((err) => toast.error('Failed to load upload'));
            }} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Upload Section */}
        {!results && (
          <div className="bg-white border-2 border-black p-8">
            <h2 className="text-2xl font-black mb-6" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              UPLOAD PURCHASE ORDER
            </h2>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-4 border-dashed p-8 transition-colors ${
                isDragging ? 'border-black bg-gray-100' : 'border-gray-300 bg-gray-50'
              }`}
              data-testid="file-drop-zone"
            >
              <div className="text-center mb-6">
                <Upload size={48} weight="bold" className="mx-auto mb-3 text-gray-400" />
                <p className="text-base font-mono uppercase tracking-wider mb-2">
                  Upload Excel Files
                </p>
                <p className="text-xs text-gray-600">Drag & drop or browse files</p>
              </div>

              {/* File Upload Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PO File */}
                <div className="border-2 border-gray-300 p-4 bg-white">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Purchase Order *
                  </p>
                  <label
                    htmlFor="po-file-input"
                    className="block text-center bg-black text-white px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    {poFile ? 'Change File' : 'Browse PO'}
                  </label>
                  <input
                    id="po-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(e, 'po')}
                    className="hidden"
                    data-testid="po-file-input"
                  />
                  {poFile && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 truncate" title={poFile.name}>{poFile.name}</p>
                      <p className="text-xs text-gray-500">{(poFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                </div>

                {/* Stock File */}
                <div className="border-2 border-gray-300 p-4 bg-white">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Stock/Inventory
                  </p>
                  <label
                    htmlFor="stock-file-input"
                    className="block text-center bg-gray-700 text-white px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    {stockFile ? 'Change File' : 'Browse Stock'}
                  </label>
                  <input
                    id="stock-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(e, 'stock')}
                    className="hidden"
                    data-testid="stock-file-input"
                  />
                  {stockFile && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 truncate" title={stockFile.name}>{stockFile.name}</p>
                      <p className="text-xs text-gray-500">{(stockFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                  {!stockFile && <p className="text-xs text-gray-500 mt-2">Optional</p>}
                </div>

                {/* Sales File */}
                <div className="border-2 border-gray-300 p-4 bg-white">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Sales Data
                  </p>
                  <label
                    htmlFor="sales-file-input"
                    className="block text-center bg-gray-700 text-white px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    {salesFile ? 'Change File' : 'Browse Sales'}
                  </label>
                  <input
                    id="sales-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(e, 'sales')}
                    className="hidden"
                    data-testid="sales-file-input"
                  />
                  {salesFile && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 truncate" title={salesFile.name}>{salesFile.name}</p>
                      <p className="text-xs text-gray-500">{(salesFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                  {!salesFile && <p className="text-xs text-gray-500 mt-2">Optional</p>}
                </div>
              </div>
            </div>

            {poFile && (
              <div className="mt-6 p-4 bg-black text-white flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-300">Ready to Process</p>
                  <p className="font-medium">
                    {poFile.name}
                    {stockFile && ' + Stock'}
                    {salesFile && ' + Sales'}
                  </p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-white text-black px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: uploading ? 'none' : '4px 4px 0px 0px rgba(255,255,255,1)' }}
                  data-testid="upload-button"
                >
                  {uploading ? 'Processing...' : 'Process Files'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border-2 border-black p-6">
                <p className="text-xs font-mono uppercase tracking-wider text-gray-600 mb-2">Total Items</p>
                <p className="text-4xl font-black" data-testid="total-items-count">{results.total_items}</p>
              </div>
              <div className="bg-red-50 border-2 border-red-600 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Warning size={20} weight="bold" className="text-red-600" />
                  <p className="text-xs font-mono uppercase tracking-wider text-red-600">Needs Review</p>
                </div>
                <p className="text-4xl font-black text-red-600" data-testid="needs-review-count">{results.needs_review}</p>
              </div>
              <div className="bg-green-50 border-2 border-green-600 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} weight="bold" className="text-green-600" />
                  <p className="text-xs font-mono uppercase tracking-wider text-green-600">Approved</p>
                </div>
                <p className="text-4xl font-black text-green-600" data-testid="approved-count">{results.approved}</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-white border-2 border-black p-6 flex justify-between items-center">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-gray-600">Current File</p>
                <p className="font-medium" data-testid="current-filename">{results.filename}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleDownload(results.upload_id)}
                  className="bg-black text-white px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
                  data-testid="download-excel-button"
                >
                  <DownloadSimple size={20} weight="bold" />
                  Download Excel
                </button>
                <button
                  onClick={() => {
                    setResults(null);
                    setPoFile(null);
                    setStockFile(null);
                    setSalesFile(null);
                  }}
                  className="bg-transparent border-2 border-black px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors"
                  data-testid="new-upload-button"
                >
                  New Upload
                </button>
              </div>
            </div>

            {/* Results Table */}
            <ResultsTable data={results.results} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
