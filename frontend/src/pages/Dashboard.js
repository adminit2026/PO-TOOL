import React, { useState, useEffect, useMemo } from 'react';
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
  CheckSquare,
  CurrencyEur,
  TrendUp,
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

  // Calculate real-time totals
  const metrics = useMemo(() => {
    if (!results || !results.results) return null;
    
    const totalOrderAmount = results.results.reduce((sum, item) => sum + (item['Total Cost'] || 0), 0);
    const totalMargin = results.results.reduce((sum, item) => sum + (item['Total Margin'] || 0), 0);
    const approvedCount = results.results.filter(item => item['Approval Status'] === 'approved').length;
    
    return {
      totalOrderAmount: totalOrderAmount.toFixed(2),
      totalMargin: totalMargin.toFixed(2),
      marginPercentage: totalOrderAmount > 0 ? ((totalMargin / totalOrderAmount) * 100).toFixed(2) : 0,
      approvedCount
    };
  }, [results]);

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
      const response = await axios.post(
        `${API}/download/${uploadId}`,
        { results: results.results },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
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

  const handleDownloadExport = async (uploadId) => {
    try {
      const response = await axios.post(
        `${API}/download-export/${uploadId}`,
        { results: results.results },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `EXPORT.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('EXPORT file downloaded!');
    } catch (error) {
      toast.error('Failed to download EXPORT file');
    }
  };

  const handleDownloadBox = async (uploadId) => {
    try {
      const response = await axios.post(
        `${API}/download-box/${uploadId}`,
        { results: results.results },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BOX_FR.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('BOX file downloaded!');
    } catch (error) {
      toast.error('Failed to download BOX file');
    }
  };

  const handleDataChange = (updatedData) => {
    setResults(prev => ({
      ...prev,
      results: updatedData
    }));
  };

  const handleApproveAll = () => {
    if (!results || !results.results) return;
    
    const updatedData = results.results.map(item => ({
      ...item,
      'Approval Status': 'approved'
    }));
    
    setResults(prev => ({
      ...prev,
      results: updatedData
    }));
    
    toast.success('All items approved!');
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-black" data-testid="dashboard">
      {/* Header */}
      <header className="bg-black border-b-2 border-green-500">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/ambiance-logo.png" alt="Ambiance Sticker" className="h-16" />
            <div>
              <h1
                className="text-2xl font-black tracking-tight text-green-400"
                style={{ fontFamily: "'Courier New', monospace" }}
                data-testid="dashboard-title"
              >
                PO ANALYSIS FOR AMBIANCE STICKER
              </h1>
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">
                Production Cost Analysis System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-green-500 hover:bg-green-950 transition-colors"
              data-testid="history-toggle-button"
            >
              <Clock size={24} weight="bold" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-green-500 hover:bg-green-950 transition-colors"
              data-testid="settings-toggle-button"
            >
              <Gear size={24} weight="bold" />
            </button>
            <div className="h-8 w-px bg-green-800"></div>
            <div className="text-right">
              <p className="text-sm font-medium text-green-400">{user?.name}</p>
              <p className="text-xs text-gray-500 font-mono">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-red-500 hover:bg-red-950 transition-colors"
              data-testid="logout-button"
            >
              <SignOut size={24} weight="bold" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="bg-black border-2 border-green-500 max-w-2xl w-full relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-2 text-green-500 hover:bg-green-950 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="bg-black border-2 border-green-500 max-w-4xl w-full relative max-h-[80vh] overflow-hidden">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 p-2 text-green-500 hover:bg-green-950 transition-colors z-10"
              data-testid="close-history-button"
            >
              <X size={24} weight="bold" />
            </button>
            <UploadHistory onSelectUpload={(upload) => {
              setShowHistory(false);
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
          <div className="bg-black border-2 border-green-500 p-8">
            <h2 className="text-2xl font-black mb-6 text-green-400" style={{ fontFamily: "'Courier New', monospace" }}>
              UPLOAD PURCHASE ORDER
            </h2>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-4 border-dashed p-8 transition-colors ${
                isDragging ? 'border-green-400 bg-green-950' : 'border-green-800 bg-black'
              }`}
              data-testid="file-drop-zone"
            >
              <div className="text-center mb-6">
                <Upload size={48} weight="bold" className="mx-auto mb-3 text-green-500" />
                <p className="text-base font-mono uppercase tracking-wider mb-2 text-green-400">
                  Upload Excel Files
                </p>
                <p className="text-xs text-gray-500">Drag & drop or browse files</p>
              </div>

              {/* File Upload Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PO File */}
                <div className="border-2 border-green-700 p-4 bg-black">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-green-400 mb-2">
                    Purchase Order *
                  </p>
                  <label
                    htmlFor="po-file-input"
                    className="block text-center bg-green-600 text-black px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-green-500 transition-colors"
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
                      <p className="text-xs text-green-400 truncate" title={poFile.name}>{poFile.name}</p>
                      <p className="text-xs text-gray-500">{(poFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                </div>

                {/* Stock File */}
                <div className="border-2 border-green-700 p-4 bg-black">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-green-400 mb-2">
                    Stock/Inventory
                  </p>
                  <label
                    htmlFor="stock-file-input"
                    className="block text-center bg-green-800 text-green-400 px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-green-700 transition-colors"
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
                      <p className="text-xs text-green-400 truncate" title={stockFile.name}>{stockFile.name}</p>
                      <p className="text-xs text-gray-500">{(stockFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                  {!stockFile && <p className="text-xs text-gray-600 mt-2">Optional</p>}
                </div>

                {/* Sales File */}
                <div className="border-2 border-green-700 p-4 bg-black">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-green-400 mb-2">
                    Sales Data
                  </p>
                  <label
                    htmlFor="sales-file-input"
                    className="block text-center bg-green-800 text-green-400 px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-green-700 transition-colors"
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
                      <p className="text-xs text-green-400 truncate" title={salesFile.name}>{salesFile.name}</p>
                      <p className="text-xs text-gray-500">{(salesFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                  {!salesFile && <p className="text-xs text-gray-600 mt-2">Optional</p>}
                </div>
              </div>
            </div>

            {poFile && (
              <div className="mt-6 p-4 bg-green-600 text-black flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider font-bold">Ready to Process</p>
                  <p className="font-medium">
                    {poFile.name}
                    {stockFile && ' + Stock'}
                    {salesFile && ' + Sales'}
                  </p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-black text-green-400 px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-900 border-2 border-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="upload-button"
                >
                  {uploading ? 'Processing...' : 'Process Files'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {results && metrics && (
          <div className="space-y-6">
            {/* Live Metrics - Matrix Style */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-black border-2 border-green-500 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyEur size={20} weight="bold" className="text-green-400" />
                  <p className="text-xs font-mono uppercase tracking-wider text-green-500">Total Order Amount</p>
                </div>
                <p className="text-4xl font-black text-green-400" data-testid="total-order-amount">€{metrics.totalOrderAmount}</p>
              </div>
              <div className="bg-black border-2 border-green-500 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendUp size={20} weight="bold" className="text-green-400" />
                  <p className="text-xs font-mono uppercase tracking-wider text-green-500">Total Margin</p>
                </div>
                <p className="text-4xl font-black text-green-400" data-testid="total-margin">€{metrics.totalMargin}</p>
                <p className="text-sm text-gray-500 mt-1">{metrics.marginPercentage}% margin</p>
              </div>
              <div className="bg-black border-2 border-red-500 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Warning size={20} weight="bold" className="text-red-400" />
                  <p className="text-xs font-mono uppercase tracking-wider text-red-500">Needs Review</p>
                </div>
                <p className="text-4xl font-black text-red-400" data-testid="needs-review-count">{results.needs_review}</p>
              </div>
              <div className="bg-black border-2 border-green-500 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} weight="bold" className="text-green-400" />
                  <p className="text-xs font-mono uppercase tracking-wider text-green-500">Approved</p>
                </div>
                <p className="text-4xl font-black text-green-400" data-testid="approved-count">{metrics.approvedCount}</p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="bg-black border-2 border-green-500 p-6 flex justify-between items-center">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-green-500">Current File</p>
                <p className="font-medium text-green-400" data-testid="current-filename">{results.filename}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleApproveAll}
                  className="bg-green-600 text-black px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-green-500 border-2 border-green-500 transition-colors flex items-center gap-2"
                  data-testid="approve-all-button"
                >
                  <CheckSquare size={20} weight="bold" />
                  Approve All
                </button>
                <button
                  onClick={() => handleDownloadExport(results.upload_id)}
                  className="bg-yellow-600 text-black px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-yellow-500 border-2 border-yellow-500 transition-colors flex items-center gap-2"
                  data-testid="download-export-button"
                >
                  <DownloadSimple size={20} weight="bold" />
                  Download EXPORT
                </button>
                <button
                  onClick={() => handleDownloadBox(results.upload_id)}
                  className="bg-orange-600 text-black px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-orange-500 border-2 border-orange-500 transition-colors flex items-center gap-2"
                  data-testid="download-box-button"
                >
                  <DownloadSimple size={20} weight="bold" />
                  Download BOX
                </button>
                <button
                  onClick={() => handleDownload(results.upload_id)}
                  className="bg-green-900 border-2 border-green-500 text-green-400 px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-green-800 transition-colors flex items-center gap-2"
                  data-testid="download-excel-button"
                >
                  <DownloadSimple size={20} weight="bold" />
                  Download Analysis
                </button>
                <button
                  onClick={() => {
                    setResults(null);
                    setPoFile(null);
                    setStockFile(null);
                    setSalesFile(null);
                  }}
                  className="bg-black border-2 border-green-500 text-green-400 px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-green-950 transition-colors"
                  data-testid="new-upload-button"
                >
                  New Upload
                </button>
              </div>
            </div>

            {/* Results Table */}
            <ResultsTable 
              data={results.results} 
              onDataChange={handleDataChange}
              onApproveAll={handleApproveAll}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
