import React from 'react';
import { Warning, CheckCircle } from '@phosphor-icons/react';

const ResultsTable = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border-2 border-black p-8 text-center">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-black" data-testid="results-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black text-white sticky top-0">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Status</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">PO</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Vendor</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Location</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">ASIN</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">External ID</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Model</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Qty</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Unit Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Prod Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">UPS Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Op Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Commission</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin/Unit</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin %</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Total Margin</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Stock</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Sales (30d)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const needsReview = row['Needs Review'];
              return (
                <tr
                  key={idx}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    needsReview ? 'bg-red-50 border-l-4 border-l-red-600' : ''
                  } ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                  data-testid={needsReview ? 'needs-review-row' : 'approved-row'}
                >
                  <td className="px-2 py-2">
                    {needsReview ? (
                      <div className="flex items-center gap-1 text-red-600">
                        <Warning size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">REVIEW</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">OK</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-sm font-mono">{row.PO}</td>
                  <td className="px-2 py-2 text-sm font-mono">{row.Vendor}</td>
                  <td className="px-2 py-2 text-sm max-w-xs truncate" title={row['Ship to Location']}>
                    {row['Ship to Location']}
                  </td>
                  <td className="px-2 py-2 text-sm font-mono">{row.ASIN}</td>
                  <td className="px-2 py-2 text-sm font-mono">{row['External ID']}</td>
                  <td className="px-2 py-2 text-sm">{row['Model Number']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono">{row.Quantity}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono">€{row['Unit Cost']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono">€{row['Production Cost']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono font-bold text-blue-600">€{row['UPS Cost']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono">€{row['Operational Cost']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono">€{row.Commission}</td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Margin/Unit'] < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    €{row['Margin/Unit']}
                  </td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Margin %'] < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {row['Margin %']}%
                  </td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Total Margin'] < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    €{row['Total Margin']}
                  </td>
                  <td className="px-2 py-2 text-sm text-right font-mono">
                    {row['Stock Quantity'] > 0 ? row['Stock Quantity'] : '-'}
                  </td>
                  <td className="px-2 py-2 text-sm text-right font-mono">
                    {row['Sales Units (30d)'] > 0 ? row['Sales Units (30d)'] : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
