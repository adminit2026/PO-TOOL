import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import {
  Gear,
  Clock,
  SignOut,
  X,
} from '@phosphor-icons/react';
import SettingsPanel from '@/components/SettingsPanel';
import ResultsTable from '@/components/ResultsTable';
import UploadHistory from '@/components/UploadHistory';
import KPIMetrics from '@/components/KPIMetrics';
import LocationBreakdown from '@/components/LocationBreakdown';
import FileUploadSection from '@/components/FileUploadSection';
import ActionBar from '@/components/ActionBar';
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
      link.setAttribute('download', `${date}-EANLists.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('EAN Lists downloaded! (ZIP file with multiple CSVs)');
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

  const handleLoadUpload = (uploadData) => {
    setResults({
      upload_id: uploadData.upload_id,
      filename: uploadData.filename,
      total_items: uploadData.total_items,
      needs_review: uploadData.needs_review,
      approved: uploadData.approved,
      timestamp: uploadData.timestamp,
      results: uploadData.results
    });
    toast.success('Previous upload loaded! Continue where you left off.');
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

      {/* History Panel - Overlay */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-8">
          <div className="bg-white border-2 border-gray-300 max-w-5xl w-full relative max-h-[90vh] overflow-hidden">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 p-2 text-gray-600 hover:bg-gray-100 transition-colors z-10 rounded"
              data-testid="close-history-button"
            >
              <X size={24} weight="bold" />
            </button>
            <UploadHistory 
              onLoadUpload={(uploadData) => {
                handleLoadUpload(uploadData);
                setShowHistory(false);
              }}
              currentUploadId={results?.upload_id}
              standalone={false}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Upload Section */}
        {!results && (
          <FileUploadSection
            poFile={poFile}
            stockFile={stockFile}
            salesFile={salesFile}
            isDragging={isDragging}
            uploading={uploading}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFileChange={handleFileChange}
            onUpload={handleUpload}
          />
        )}

        {/* Results Section */}
        {results && metrics && (
          <div className="space-y-6">
            {/* KPI Metrics */}
            <KPIMetrics metrics={metrics} needsReviewCount={results.needs_review} />

            {/* Location Breakdown */}
            <LocationBreakdown locationStats={metrics.locationStats} />

            {/* Action Bar */}
            <ActionBar
              filename={results.filename}
              uploadId={results.upload_id}
              onApproveAll={handleApproveAll}
              onDownloadExport={handleDownloadExport}
              onDownloadBox={handleDownloadBox}
              onDownloadProductionSheets={handleDownloadProductionSheets}
              onDownloadEANList={handleDownloadEANList}
              onDownloadPackingList={handleDownloadPackingList}
              onDownloadAnalysis={handleDownload}
              onNewUpload={() => {
                setResults(null);
                setPoFile(null);
                setStockFile(null);
                setSalesFile(null);
              }}
            />

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
