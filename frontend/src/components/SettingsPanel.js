import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SettingsPanel = ({ onClose }) => {
  const [settings, setSettings] = useState({
    commission_fr: 24.0,
    commission_es: 37.0,
    commission_it: 26.0,
    minimum_margin: 10.0,
    operational_cost: 0.5,
    shipping_cost: 1.0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await axios.get(`${API}/settings`, { withCredentials: true });
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/settings`, settings, { withCredentials: true });
      toast.success('Settings saved successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        THRESHOLD SETTINGS
      </h2>
      <p className="text-sm text-gray-600 mb-6">Configure cost calculation parameters</p>

      <div className="space-y-6">
        {/* Commission Rates */}
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider mb-4 text-gray-700">
            Commission Rates (%)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">France (FR)</label>
              <input
                type="number"
                step="0.1"
                value={settings.commission_fr}
                onChange={(e) => handleChange('commission_fr', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 focus:border-black focus:outline-none"
                data-testid="commission-fr-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Spain (ES)</label>
              <input
                type="number"
                step="0.1"
                value={settings.commission_es}
                onChange={(e) => handleChange('commission_es', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 focus:border-black focus:outline-none"
                data-testid="commission-es-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Italy (IT)</label>
              <input
                type="number"
                step="0.1"
                value={settings.commission_it}
                onChange={(e) => handleChange('commission_it', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 focus:border-black focus:outline-none"
                data-testid="commission-it-input"
              />
            </div>
          </div>
        </div>

        {/* Minimum Margin */}
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider mb-4 text-gray-700">
            Minimum Margin Threshold
          </h3>
          <div>
            <label className="block text-sm font-medium mb-2">Minimum Margin (%)</label>
            <input
              type="number"
              step="0.1"
              value={settings.minimum_margin}
              onChange={(e) => handleChange('minimum_margin', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 focus:border-black focus:outline-none"
              data-testid="minimum-margin-input"
            />
            <p className="text-xs text-gray-500 mt-1">Items below this margin will be flagged for review</p>
          </div>
        </div>

        {/* Operational Costs */}
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider mb-4 text-gray-700">
            Operational Costs (per unit)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Operational Cost (€)</label>
              <input
                type="number"
                step="0.1"
                value={settings.operational_cost}
                onChange={(e) => handleChange('operational_cost', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 focus:border-black focus:outline-none"
                data-testid="operational-cost-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Shipping Cost (€)</label>
              <input
                type="number"
                step="0.1"
                value={settings.shipping_cost}
                onChange={(e) => handleChange('shipping_cost', e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 focus:border-black focus:outline-none"
                data-testid="shipping-cost-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-black text-white py-3 font-mono font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50"
          style={{ boxShadow: saving ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)' }}
          data-testid="save-settings-button"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 border-2 border-black font-mono font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors"
          data-testid="cancel-settings-button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
