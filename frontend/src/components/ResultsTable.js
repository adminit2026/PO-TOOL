import React, { useState, useEffect } from 'react';
import { Warning, CheckCircle, Check, X, Package } from '@phosphor-icons/react';

const ResultsTable = ({ data, onDataChange, onApproveAll }) => {
  const [tableData, setTableData] = useState(data || []);

  useEffect(() => {
    setTableData(data || []);
  }, [data]);

  if (!tableData || tableData.length === 0) {
    return (
      <div className="bg-black border-2 border-green-500 p-8 text-center">
        <p className="text-green-500 font-mono">No data to display</p>
      </div>
    );
  }

  const recalculateRow = (row, newUnitCost = null, newUPSCost = null, newQuantity = null) => {
    const unitCost = newUnitCost !== null ? newUnitCost : row['Unit Cost'];
    const upsCost = newUPSCost !== null ? newUPSCost : row['UPS Cost'];
    const quantity = newQuantity !== null ? newQuantity : row['Quantity'];
    
    const productionCost = unitCost * 0.4;
    const operationalCost = row['Operational Cost'];
    const commissionRate = 0.24;
    const commission = unitCost * commissionRate;
    
    const totalCostPerUnit = productionCost + upsCost + operationalCost + commission;
    const marginPerUnit = unitCost - totalCostPerUnit;
    const marginPercentage = (marginPerUnit / unitCost * 100) || 0;
    
    return {
      ...row,
      'Quantity': parseInt(quantity) || 0,
      'Unit Cost': parseFloat(unitCost.toFixed(2)),
      'Production Cost': parseFloat(productionCost.toFixed(2)),
      'UPS Cost': parseFloat(upsCost.toFixed(2)),
      'Commission': parseFloat(commission.toFixed(2)),
      'Total Cost/Unit': parseFloat(totalCostPerUnit.toFixed(2)),
      'Margin/Unit': parseFloat(marginPerUnit.toFixed(2)),
      'Margin %': parseFloat(marginPercentage.toFixed(2)),
      'Total Cost': parseFloat((totalCostPerUnit * quantity).toFixed(2)),
      'Total Margin': parseFloat((marginPerUnit * quantity).toFixed(2)),
      'Needs Review': marginPerUnit < 0 || marginPercentage < 10,
      'Status': (marginPerUnit < 0 || marginPercentage < 10) ? 'NEEDS_REVIEW' : 'APPROVED'
    };
  };

  const handleQuantityChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseInt(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], null, null, parsedValue);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleUnitCostChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseFloat(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], parsedValue, null, null);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleUPSCostChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseFloat(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], null, parsedValue, null);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleBoxNumberChange = (idx, newValue) => {
    const updatedData = [...tableData];
    updatedData[idx]['Box Number'] = newValue;
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleApprove = (idx) => {
    const updatedData = [...tableData];
    updatedData[idx]['Approval Status'] = 'approved';
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleReject = (idx) => {
    const updatedData = [...tableData];
    updatedData[idx]['Approval Status'] = 'rejected';
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  return (
    <div className="bg-black border-2 border-green-500" data-testid="results-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-green-600 text-black sticky top-0">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Status</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">PO</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Vendor</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Location</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">ASIN</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">External ID</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Model</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-green-700">Qty (Edit)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-green-700">Unit Cost (Edit)</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Prod Cost</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-green-700">UPS Cost (Edit)</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Op Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Commission</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin/Unit</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin %</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Total Margin</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Stock</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Sales (30d)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-yellow-700">Box # (Edit)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-green-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => {
              const needsReview = row['Needs Review'];
              const approvalStatus = row['Approval Status'] || 'pending';
              
              return (
                <tr
                  key={idx}
                  className={`border-b border-green-900 hover:bg-gray-900 transition-colors ${
                    needsReview ? 'bg-red-950 border-l-4 border-l-red-500' : 'bg-black'
                  } ${approvalStatus === 'approved' ? 'border-l-4 border-l-blue-500 bg-blue-950' : ''} ${approvalStatus === 'rejected' ? 'border-l-4 border-l-gray-600 opacity-60 bg-gray-950' : ''}`}
                  data-testid={needsReview ? 'needs-review-row' : 'approved-row'}
                >
                  <td className="px-2 py-2">
                    {needsReview ? (
                      <div className="flex items-center gap-1 text-red-400">
                        <Warning size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">REVIEW</span>
                      </div>
                    ) : approvalStatus === 'approved' ? (
                      <div className="flex items-center gap-1 text-blue-400">
                        <CheckCircle size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">APPROVED</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckCircle size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">OK</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-sm font-mono text-green-400">{row.PO}</td>
                  <td className="px-2 py-2 text-sm font-mono text-green-400">{row.Vendor}</td>
                  <td className="px-2 py-2 text-sm max-w-xs truncate text-gray-300" title={row['Ship to Location']}>
                    {row['Ship to Location']}
                  </td>
                  <td className="px-2 py-2 text-sm font-mono text-green-400">{row.ASIN}</td>
                  <td className="px-2 py-2 text-sm font-mono text-gray-300">{row['External ID']}</td>
                  <td className="px-2 py-2 text-sm text-gray-300">{row['Model Number']}</td>
                  
                  {/* Editable Quantity */}
                  <td className="px-2 py-2 bg-green-950">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row['Quantity']}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      className="w-16 px-2 py-1 border-2 border-green-500 focus:border-green-400 focus:outline-none text-sm text-center font-mono font-bold bg-black text-green-400"
                      data-testid={`quantity-input-${idx}`}
                    />
                  </td>
                  
                  {/* Editable Unit Cost */}
                  <td className="px-2 py-2 bg-green-950">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['Unit Cost']}
                      onChange={(e) => handleUnitCostChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 border-2 border-green-500 focus:border-green-400 focus:outline-none text-sm text-right font-mono font-bold bg-black text-green-400"
                      data-testid={`unit-cost-input-${idx}`}
                    />
                    <span className="ml-1 text-sm text-green-400">€</span>
                  </td>
                  
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-300">€{row['Production Cost']}</td>
                  
                  {/* Editable UPS Cost */}
                  <td className="px-2 py-2 bg-green-950">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['UPS Cost']}
                      onChange={(e) => handleUPSCostChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 border-2 border-green-500 focus:border-green-400 focus:outline-none text-sm text-right font-mono font-bold bg-black text-green-400"
                      data-testid={`ups-cost-input-${idx}`}
                    />
                    <span className="ml-1 text-sm text-green-400">€</span>
                  </td>
                  
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-300">€{row['Operational Cost']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-300">€{row.Commission}</td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Margin/Unit'] < 0 ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    €{row['Margin/Unit']}
                  </td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Margin %'] < 0 ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    {row['Margin %']}%
                  </td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Total Margin'] < 0 ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    €{row['Total Margin']}
                  </td>
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-400">
                    {row['Stock Quantity'] > 0 ? row['Stock Quantity'] : '-'}
                  </td>
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-400">
                    {row['Sales Units (30d)'] > 0 ? row['Sales Units (30d)'] : '-'}
                  </td>
                  
                  {/* Editable Box Number - only for approved items */}
                  <td className="px-2 py-2 bg-yellow-950">
                    {approvalStatus === 'approved' ? (
                      <input
                        type="text"
                        value={row['Box Number'] || ''}
                        onChange={(e) => handleBoxNumberChange(idx, e.target.value)}
                        placeholder="Box #"
                        className="w-16 px-2 py-1 border-2 border-yellow-500 focus:border-yellow-400 focus:outline-none text-sm text-center font-mono font-bold bg-black text-yellow-400"
                        data-testid={`box-number-input-${idx}`}
                      />
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
                  </td>
                  
                  {/* Approve and Reject Buttons */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      {approvalStatus === 'approved' ? (
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-blue-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-blue-500 transition-colors flex items-center gap-1"
                          data-testid={`approved-button-${idx}`}
                        >
                          <Check size={14} weight="bold" />
                          Approved
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(idx)}
                          className="bg-green-900 border-2 border-green-500 text-green-400 px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-green-800 transition-colors"
                          data-testid={`approve-button-${idx}`}
                        >
                          Approve
                        </button>
                      )}
                      
                      {approvalStatus === 'rejected' ? (
                        <button
                          onClick={() => handleApprove(idx)}
                          className="bg-gray-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-gray-500 transition-colors flex items-center gap-1"
                          data-testid={`rejected-button-${idx}`}
                        >
                          <X size={14} weight="bold" />
                          Rejected
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-red-900 border-2 border-red-500 text-red-400 px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-red-800 transition-colors"
                          data-testid={`reject-button-${idx}`}
                        >
                          Reject
                        </button>
                      )}
                    </div>
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
