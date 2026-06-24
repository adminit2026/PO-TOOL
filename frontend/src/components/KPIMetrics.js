import React from 'react';
import { CurrencyEur, CheckCircle, TrendUp, Warning } from '@phosphor-icons/react';

/**
 * KPIMetrics - Display key performance indicators for PO analysis
 * Shows Total PO Amount, Approved Amount, Margin, and Items Needing Review
 */
const KPIMetrics = ({ metrics, needsReviewCount }) => {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total PO Amount */}
      <div className="bg-gray-50 border-2 border-gray-400 p-6">
        <div className="flex items-center gap-2 mb-2">
          <CurrencyEur size={20} weight="bold" className="text-gray-700" />
          <p className="text-xs font-mono uppercase tracking-wider text-gray-700">Total PO Amount</p>
        </div>
        <p className="text-3xl font-black text-gray-900" data-testid="total-po-amount">
          €{metrics.totalOrderAmount}
        </p>
        <p className="text-xs text-gray-500 mt-1">All line items</p>
      </div>

      {/* Approved PO Amount */}
      <div className="bg-gray-50 border-2 border-green-600 p-6">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={20} weight="bold" className="text-green-600" />
          <p className="text-xs font-mono uppercase tracking-wider text-green-700">Approved PO Amount</p>
        </div>
        <p className="text-3xl font-black text-green-600" data-testid="approved-po-amount">
          €{metrics.approvedOrderAmount}
        </p>
        <p className="text-xs text-gray-500 mt-1">{metrics.approvedCount} items approved</p>
      </div>

      {/* Approved Margin */}
      <div className="bg-gray-50 border-2 border-blue-600 p-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendUp size={20} weight="bold" className="text-blue-600" />
          <p className="text-xs font-mono uppercase tracking-wider text-blue-700">Approved Margin</p>
        </div>
        <p className="text-3xl font-black text-blue-600" data-testid="approved-margin">
          €{metrics.approvedMargin}
        </p>
        <p className="text-xs text-gray-500 mt-1">{metrics.marginPercentage}% margin</p>
      </div>

      {/* Needs Review */}
      <div className="bg-gray-50 border-2 border-red-500 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Warning size={20} weight="bold" className="text-red-500" />
          <p className="text-xs font-mono uppercase tracking-wider text-red-500">Needs Review</p>
        </div>
        <p className="text-3xl font-black text-red-500" data-testid="needs-review-count">
          {needsReviewCount}
        </p>
        <p className="text-xs text-gray-500 mt-1">Low margin items</p>
      </div>
    </div>
  );
};

export default KPIMetrics;
