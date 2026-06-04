import React, { useState, useEffect } from 'react';
import { Warning, CheckCircle, Check, X } from '@phosphor-icons/react';

const ResultsTable = ({ data, onDataChange }) => {
  const [tableData, setTableData] = useState(data || []);

  useEffect(() => {
    setTableData(data || []);
  }, [data]);

  if (!tableData || tableData.length === 0) {
    return (
      <div className="bg-white border-2 border-black p-8 text-center">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  const handleUPSCostChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const row = updatedData[idx];
    
    // Parse new UPS cost
    const newUPSCost = parseFloat(newValue) || 0;
    row['UPS Cost'] = newUPSCost;
    
    // Recalculate costs and margins
    const productionCost = row['Production Cost'];
    const operationalCost = row['Operational Cost'];
    const commission = row['Commission'];
    const unitCost = row['Unit Cost'];
    const quantity = row['Quantity'];
    
    // New total cost per unit
    const totalCostPerUnit = productionCost + newUPSCost + operationalCost + commission;
    row['Total Cost/Unit'] = parseFloat(totalCostPerUnit.toFixed(2));
    
    // New margin calculations
    const marginPerUnit = unitCost - totalCostPerUnit;
    const marginPercentage = (marginPerUnit / unitCost * 100) || 0;
    
    row['Margin/Unit'] = parseFloat(marginPerUnit.toFixed(2));
    row['Margin %'] = parseFloat(marginPercentage.toFixed(2));
    row['Total Cost'] = parseFloat((totalCostPerUnit * quantity).toFixed(2));
    row['Total Margin'] = parseFloat((marginPerUnit * quantity).toFixed(2));
    
    // Update needs review status based on new margin
    row['Needs Review'] = marginPerUnit < 0 || marginPercentage < 10;
    row['Status'] = row['Needs Review'] ? 'NEEDS_REVIEW' : 'APPROVED';
    
    setTableData(updatedData);
    if (onDataChange) {
      onDataChange(updatedData);
    }
  };

  const handleApprovalToggle = (idx) => {
    const updatedData = [...tableData];
    const currentStatus = updatedData[idx]['Approval Status'] || 'pending';
    
    if (currentStatus === 'approved') {
      updatedData[idx]['Approval Status'] = 'rejected';
    } else {
      updatedData[idx]['Approval Status'] = 'approved';
    }
    
    setTableData(updatedData);
    if (onDataChange) {
      onDataChange(updatedData);
    }
  };

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
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-900">UPS Cost (Edit)</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Op Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Commission</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin/Unit</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin %</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Total Margin</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Stock</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Sales (30d)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-green-900">Action</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => {
              const needsReview = row['Needs Review'];
              const approvalStatus = row['Approval Status'] || 'pending';
              
              return (
                <tr
                  key={idx}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    needsReview ? 'bg-red-50 border-l-4 border-l-red-600' : ''
                  } ${approvalStatus === 'approved' ? 'border-l-4 border-l-green-600' : ''} ${approvalStatus === 'rejected' ? 'border-l-4 border-l-gray-600 opacity-60' : ''}`}
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
                  
                  {/* Editable UPS Cost */}
                  <td className="px-2 py-2 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['UPS Cost']}
                      onChange={(e) => handleUPSCostChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 border-2 border-blue-400 focus:border-blue-600 focus:outline-none text-sm text-right font-mono font-bold bg-white"
                      data-testid={`ups-cost-input-${idx}`}
                    />
                    <span className="ml-1 text-sm">€</span>
                  </td>
                  
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
                  
                  {/* Approve/Reject Button */}
                  <td className="px-2 py-2 text-center">
                    {approvalStatus === 'approved' ? (
                      <button
                        onClick={() => handleApprovalToggle(idx)}
                        className="bg-green-600 text-white px-4 py-2 text-xs font-mono font-bold uppercase hover:bg-green-700 transition-colors flex items-center gap-1 mx-auto"
                        data-testid={`approve-button-${idx}`}
                      >
                        <Check size={14} weight="bold" />
                        Approved
                      </button>
                    ) : approvalStatus === 'rejected' ? (
                      <button
                        onClick={() => handleApprovalToggle(idx)}
                        className="bg-gray-600 text-white px-4 py-2 text-xs font-mono font-bold uppercase hover:bg-gray-700 transition-colors flex items-center gap-1 mx-auto"
                        data-testid={`approve-button-${idx}`}
                      >
                        <X size={14} weight="bold" />
                        Rejected
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprovalToggle(idx)}
                        className="bg-black text-white px-4 py-2 text-xs font-mono font-bold uppercase hover:bg-gray-800 transition-colors"
                        data-testid={`approve-button-${idx}`}
                      >
                        Approve
                      </button>
                    )}
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
