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

  // Calculate real-time totals and location breakdown
  const metrics = useMemo(() => {
    if (!results || !results.results) return null;
    
    // Total PO Amount (all items)
    const totalOrderAmount = results.results.reduce((sum, item) => sum + (item['Total Cost'] || 0), 0);
    
    // Approved items only
    const approvedItems = results.results.filter(item => item['Approval Status'] === 'approved');
    const approvedOrderAmount = approvedItems.reduce((sum, item) => sum + (item['Total Cost'] || 0), 0);
    const approvedMargin = approvedItems.reduce((sum, item) => sum + (item['Total Margin'] || 0), 0);
    const approvedCount = approvedItems.length;
    
    // Calculate margin by location (ONLY FOR APPROVED ITEMS)
    const locationBreakdown = {};
    approvedItems.forEach(item => {
      const location = item['Ship to Location'] || 'Unknown';
      if (!locationBreakdown[location]) {
        locationBreakdown[location] = {
          totalCost: 0,
          totalMargin: 0,
          items: 0
        };
      }
      locationBreakdown[location].totalCost += item['Total Cost'] || 0;
      locationBreakdown[location].totalMargin += item['Total Margin'] || 0;
      locationBreakdown[location].items += 1;
    });
    
    // Calculate margin percentage for each location
    const locationStats = Object.entries(locationBreakdown).map(([location, data]) => ({
      location,
      totalMargin: data.totalMargin.toFixed(2),
      marginPercentage: data.totalCost > 0 ? ((data.totalMargin / data.totalCost) * 100).toFixed(2) : 0,
      items: data.items
    })).sort((a, b) => parseFloat(b.totalMargin) - parseFloat(a.totalMargin));
    
    return {
      totalOrderAmount: totalOrderAmount.toFixed(2),
      approvedOrderAmount: approvedOrderAmount.toFixed(2),
      approvedMargin: approvedMargin.toFixed(2),
      marginPercentage: approvedOrderAmount > 0 ? ((approvedMargin / approvedOrderAmount) * 100).toFixed(2) : 0,
      approvedCount,
      locationStats
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

  const handleDownloadProductionSheets = async (uploadId) => {
    try {
      const response = await axios.post(
        `${API}/download-production-sheets/${uploadId}`,
        { results: results.results },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
      link.href = url;
      link.setAttribute('download', `${date}-ProductionSheets.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Production Sheets downloaded!');
    } catch (error) {
      toast.error('Failed to download Production Sheets');
    }
  };

  const handleDownloadEANList = async (uploadId) => {
    try {
      const response = await axios.post(
        `${API}/download-ean-list/${uploadId}`,
        { results: results.results },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
      link.href = url;
      link.setAttribute('download', `${date}-EANList.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('EAN List downloaded!');
    } catch (error) {
      toast.error('Failed to download EAN List');
    }
  };

  const handleDownloadPackingList = async (uploadId) => {
    try {
      const response = await axios.post(
        `${API}/download-packing-list/${uploadId}`,
        { results: results.results },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
      link.href = url;
      link.setAttribute('download', `${date}-PackingList.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Packing List downloaded!');
    } catch (error) {
      toast.error('Failed to download Packing List');
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
    <div className="min-h-screen bg-gray-50" data-testid="dashboard">
      {/* Header */}
      <header className="bg-gray-50 border-b-2 border-blue-600">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/ambiance-logo.png" alt="Ambiance Sticker" className="h-16" />
            <div>
              <h1
                className="text-2xl font-black tracking-tight text-blue-600"
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
              className="p-2 text-blue-700 hover:bg-blue-50 transition-colors"
              data-testid="history-toggle-button"
            >
              <Clock size={24} weight="bold" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-blue-700 hover:bg-blue-50 transition-colors"
              data-testid="settings-toggle-button"
            >
              <Gear size={24} weight="bold" />
            </button>
            <div className="h-8 w-px bg-blue-700"></div>
            <div className="text-right">
              <p className="text-sm font-medium text-blue-600">{user?.name}</p>
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
        <div className="fixed inset-0 bg-gray-50 bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="bg-gray-50 border-2 border-blue-600 max-w-2xl w-full relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-2 text-blue-700 hover:bg-blue-50 transition-colors"
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
        <div className="fixed inset-0 bg-gray-50 bg-opacity-90 z-50 flex items-center justify-center p-8">
          <div className="bg-gray-50 border-2 border-blue-600 max-w-4xl w-full relative max-h-[80vh] overflow-hidden">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 p-2 text-blue-700 hover:bg-blue-50 transition-colors z-10"
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
          <div className="bg-gray-50 border-2 border-blue-600 p-8">
            <h2 className="text-2xl font-black mb-6 text-blue-600" style={{ fontFamily: "'Courier New', monospace" }}>
              UPLOAD PURCHASE ORDER
            </h2>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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

              {/* File Upload Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PO File */}
                <div className="border-2 border-gray-300 p-4 bg-gray-50">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 mb-2">
                    Purchase Order *
                  </p>
                  <label
                    htmlFor="po-file-input"
                    className="block text-center bg-blue-600 text-black px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-blue-700 transition-colors"
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
                      <p className="text-xs text-blue-600 truncate" title={poFile.name}>{poFile.name}</p>
                      <p className="text-xs text-gray-500">{(poFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                </div>

                {/* Stock File */}
                <div className="border-2 border-gray-300 p-4 bg-gray-50">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 mb-2">
                    Stock/Inventory
                  </p>
                  <label
                    htmlFor="stock-file-input"
                    className="block text-center bg-blue-700 text-blue-600 px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-green-700 transition-colors"
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
                      <p className="text-xs text-blue-600 truncate" title={stockFile.name}>{stockFile.name}</p>
                      <p className="text-xs text-gray-500">{(stockFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                  {!stockFile && <p className="text-xs text-gray-600 mt-2">Optional</p>}
                </div>

                {/* Sales File */}
                <div className="border-2 border-gray-300 p-4 bg-gray-50">
                  <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600 mb-2">
                    Sales Data
                  </p>
                  <label
                    htmlFor="sales-file-input"
                    className="block text-center bg-blue-700 text-blue-600 px-4 py-2 text-sm font-mono font-bold uppercase cursor-pointer hover:bg-green-700 transition-colors"
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
                      <p className="text-xs text-blue-600 truncate" title={salesFile.name}>{salesFile.name}</p>
                      <p className="text-xs text-gray-500">{(salesFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  )}
                  {!salesFile && <p className="text-xs text-gray-600 mt-2">Optional</p>}
                </div>
              </div>
            </div>

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
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-gray-50 text-blue-600 px-6 py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-900 border-2 border-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            {/* Live Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total PO Amount */}
              <div className="bg-gray-50 border-2 border-gray-400 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CurrencyEur size={20} weight="bold" className="text-gray-700" />
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-700">Total PO Amount</p>
                </div>
                <p className="text-3xl font-black text-gray-900" data-testid="total-po-amount">€{metrics.totalOrderAmount}</p>
                <p className="text-xs text-gray-500 mt-1">All line items</p>
              </div>

              {/* Approved PO Amount */}
              <div className="bg-gray-50 border-2 border-green-600 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} weight="bold" className="text-green-600" />
                  <p className="text-xs font-mono uppercase tracking-wider text-green-700">Approved PO Amount</p>
                </div>
                <p className="text-3xl font-black text-green-600" data-testid="approved-po-amount">€{metrics.approvedOrderAmount}</p>
                <p className="text-xs text-gray-500 mt-1">{metrics.approvedCount} items approved</p>
              </div>

              {/* Approved Margin */}
              <div className="bg-gray-50 border-2 border-blue-600 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendUp size={20} weight="bold" className="text-blue-600" />
                  <p className="text-xs font-mono uppercase tracking-wider text-blue-700">Approved Margin</p>
                </div>
                <p className="text-3xl font-black text-blue-600" data-testid="approved-margin">€{metrics.approvedMargin}</p>
                <p className="text-xs text-gray-500 mt-1">{metrics.marginPercentage}% margin</p>
              </div>

              {/* Needs Review */}
              <div className="bg-gray-50 border-2 border-red-500 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Warning size={20} weight="bold" className="text-red-500" />
                  <p className="text-xs font-mono uppercase tracking-wider text-red-500">Needs Review</p>
                </div>
                <p className="text-3xl font-black text-red-500" data-testid="needs-review-count">{results.needs_review}</p>
                <p className="text-xs text-gray-500 mt-1">Low margin items</p>
              </div>
            </div>

            {/* Margin Breakdown by Location (Approved Items Only) */}
            {metrics.locationStats && metrics.locationStats.length > 0 && (
              <div className="bg-white border-2 border-gray-300 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2 font-mono uppercase tracking-wider">Margin by Location (Approved Items)</h3>
                <p className="text-xs text-gray-600 mb-4">Real-time margin updates when items are approved</p>
                <div className="space-y-3">
                  {metrics.locationStats.map((loc, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{loc.location}</p>
                        <p className="text-xs text-gray-600">{loc.items} approved items</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">€{loc.totalMargin}</p>
                        <p className="text-xs text-gray-600">{loc.marginPercentage}% margin</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="bg-white border-2 border-gray-300 p-4">
              <div className="mb-4">
                <p className="text-xs font-mono uppercase tracking-wider text-gray-600">Current File</p>
                <p className="font-medium text-gray-900" data-testid="current-filename">{results.filename}</p>
              </div>
              
              {/* Buttons Grid - Uniform Style */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <button
                  onClick={handleApproveAll}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="approve-all-button"
                >
                  <CheckSquare size={16} weight="bold" />
                  Approve All
                </button>
                <button
                  onClick={() => handleDownloadExport(results.upload_id)}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="download-export-button"
                >
                  <DownloadSimple size={16} weight="bold" />
                  EXPORT
                </button>
                <button
                  onClick={() => handleDownloadBox(results.upload_id)}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="download-box-button"
                >
                  <DownloadSimple size={16} weight="bold" />
                  BOX
                </button>
                <button
                  onClick={() => handleDownloadProductionSheets(results.upload_id)}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="download-production-sheets-button"
                >
                  <DownloadSimple size={16} weight="bold" />
                  Prod Sheets
                </button>
                <button
                  onClick={() => handleDownloadEANList(results.upload_id)}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="download-ean-list-button"
                >
                  <DownloadSimple size={16} weight="bold" />
                  EAN List
                </button>
                <button
                  onClick={() => handleDownloadPackingList(results.upload_id)}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="download-packing-list-button"
                >
                  <DownloadSimple size={16} weight="bold" />
                  Packing
                </button>
                <button
                  onClick={() => handleDownload(results.upload_id)}
                  className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  data-testid="download-excel-button"
                >
                  <DownloadSimple size={16} weight="bold" />
                  Analysis
                </button>
                <button
                  onClick={() => {
                    setResults(null);
                    setPoFile(null);
                    setStockFile(null);
                    setSalesFile(null);
                  }}
                  className="bg-gray-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-gray-700 transition-colors"
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
