import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClockCounterClockwise, FolderOpen, CheckCircle, Package } from '@phosphor-icons/react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : '/api';

/**
 * UploadHistory - Component to display and load previous upload sessions
 */
const UploadHistory = ({ onLoadUpload, currentUploadId, standalone = true }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/history`, {
        withCredentials: true
      });
      setHistory(response.data);
    } catch (error) {
      // Silent fail - history is optional feature
      toast.error('Failed to load upload history');
    } finally {
      setLoading(false);
    }
  }, [setHistory, setLoading]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleLoadUpload = async (uploadId) => {
    try {
      const response = await axios.get(`${API}/upload/${uploadId}`, {
        withCredentials: true
      });
      onLoadUpload(response.data);
      if (standalone) {
        setIsOpen(false);
      }
      toast.success('Upload loaded successfully!');
    } catch (error) {
      toast.error('Failed to load upload');
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (upload) => {
    const status = upload.status || 'In Progress';
    if (status === 'Complete') return <CheckCircle size={16} weight="fill" className="text-green-600" />;
    if (status === 'BOX Downloaded') return <Package size={16} weight="fill" className="text-blue-600" />;
    return <ClockCounterClockwise size={16} weight="fill" className="text-yellow-600" />;
  };

  const getStatusColor = (upload) => {
    const status = upload.status || 'In Progress';
    if (status === 'Complete') return 'bg-green-50 border-green-300';
    if (status === 'BOX Downloaded') return 'bg-blue-50 border-blue-300';
    return 'bg-yellow-50 border-yellow-300';
  };

  // Render history list content
  const renderHistoryContent = useMemo(() => {
    if (loading) {
      return <div className="text-center py-8 text-gray-500">Loading history...</div>;
    }
    
    if (history.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FolderOpen size={48} className="mx-auto mb-2 text-gray-300" />
          <p>No previous uploads found</p>
        </div>
      );
    }
    
    return (
      <div className="overflow-y-auto max-h-[540px] p-4">
        <div className="space-y-3">
          {history.map((upload) => (
            <div
              key={upload.upload_id}
              className={`border-2 p-3 ${getStatusColor(upload)} ${
                currentUploadId === upload.upload_id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(upload)}
                    <span className="font-bold text-sm text-gray-900">{upload.filename}</span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <div>📅 {formatDate(upload.timestamp)}</div>
                    <div>📊 Total: {upload.total_items} items</div>
                    <div>✓ Approved: {upload.approved || 0} items</div>
                    <div>⚠️ Review: {upload.needs_review || 0} items</div>
                    {upload.user_email && (
                      <div>👤 By: {upload.user_email}</div>
                    )}
                  </div>
                </div>
                
                <div className="ml-3">
                  {currentUploadId === upload.upload_id ? (
                    <div className="bg-blue-600 text-white px-3 py-1.5 text-xs font-bold rounded">
                      CURRENT
                    </div>
                  ) : (
                    <button
                      onClick={() => handleLoadUpload(upload.upload_id)}
                      className="bg-blue-600 text-white px-3 py-1.5 text-xs font-mono font-bold uppercase hover:bg-blue-700 transition-colors"
                    >
                      LOAD
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-gray-300">
                <span className="text-xs font-mono text-gray-500">
                  Status: {upload.status || 'In Progress'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [loading, history, currentUploadId, handleLoadUpload, getStatusIcon, getStatusColor, formatDate]);

  // If not standalone, just return the content
  if (!standalone) {
    return renderHistoryContent;
  }

  // Standalone mode with toggle button and panel
  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white px-4 py-2 font-mono font-bold text-sm uppercase hover:bg-blue-700 transition-colors flex items-center gap-2 border-2 border-blue-600"
        data-testid="history-toggle-button"
      >
        <FolderOpen size={18} weight="bold" />
        Upload History
        {history.length > 0 && (
          <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
            {history.length}
          </span>
        )}
      </button>

      {/* History Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-[600px] max-h-[600px] bg-white border-2 border-gray-300 shadow-xl">
          <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
            <h3 className="font-mono font-bold uppercase text-sm flex items-center gap-2">
              <ClockCounterClockwise size={20} weight="bold" />
              Upload History
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {renderHistoryContent}
        </div>
      )}
    </div>
  );
};

export default UploadHistory;
