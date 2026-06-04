import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Clock, Eye } from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UploadHistory = ({ onSelectUpload }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data } = await axios.get(`${API}/history`, { withCredentials: true });
      setHistory(data);
    } catch (error) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 overflow-y-auto max-h-[70vh]">
      <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        UPLOAD HISTORY
      </h2>
      <p className="text-sm text-gray-600 mb-6">Recent file uploads and analyses</p>

      {history.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No upload history yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div
              key={item.upload_id}
              className="border-2 border-gray-300 p-4 hover:border-black transition-colors cursor-pointer"
              onClick={() => onSelectUpload(item)}
              data-testid="history-item"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{item.filename}</p>
                  <p className="text-xs text-gray-600 font-mono">{formatDate(item.timestamp)}</p>
                </div>
                <button
                  className="p-2 hover:bg-gray-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUpload(item);
                  }}
                >
                  <Eye size={20} weight="bold" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-gray-600">Total</p>
                  <p className="text-lg font-bold">{item.total_items}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-red-600">Needs Review</p>
                  <p className="text-lg font-bold text-red-600">{item.needs_review}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-green-600">Approved</p>
                  <p className="text-lg font-bold text-green-600">{item.approved}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadHistory;
