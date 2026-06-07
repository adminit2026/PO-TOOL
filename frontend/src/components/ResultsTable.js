import React, { useState, useEffect } from 'react';
import { Warning, CheckCircle, Check, X, Package } from '@phosphor-icons/react';

const ResultsTable = ({ data, onDataChange, onApproveAll }) => {
  const [tableData, setTableData] = useState(data || []);

  useEffect(() => {
    setTableData(data || []);
  }, [data]);

  if (!tableData || tableData.length === 0) {
    return (
      <div className="bg-white border-2 border-gray-300 p-8 text-center">
        <p className="text-gray-700 font-mono">No data to display</p>
      </div>
    );
  }

  const recalculateRow = (row, newUnitCost = null, newUPSCost = null, newQuantity = null, newProductionCost = null) => {
    const unitCost = newUnitCost !== null ? newUnitCost : row['Unit Cost'];
    const upsCost = newUPSCost !== null ? newUPSCost : row['UPS Cost'];
    const quantity = newQuantity !== null ? newQuantity : row['Quantity'];
    const productionCost = newProductionCost !== null ? newProductionCost : (row['Production Cost'] || unitCost * 0.4);
    
    const operationalCost = row['Operational Cost'];
    const commissionRate = 0.24;
    const commission = unitCost * commissionRate;
    
    const totalCostPerUnit = productionCost + upsCost + operationalCost + commission;
    const marginPerUnit = unitCost - totalCostPerUnit;
    const marginPercentage = (marginPerUnit / unitCost * 100) || 0;
    
    // Track if fields were edited
    const edited = {
      ...row.edited,
      quantity: newQuantity !== null || row.edited?.quantity,
      unitCost: newUnitCost !== null || row.edited?.unitCost,
      upsCost: newUPSCost !== null || row.edited?.upsCost,
      productionCost: newProductionCost !== null || row.edited?.productionCost
    };
    
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
      'Status': (marginPerUnit < 0 || marginPercentage < 10) ? 'NEEDS_REVIEW' : 'APPROVED',
      'edited': edited
    };
  };

  const handleQuantityChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseInt(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], null, null, parsedValue, null);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleUnitCostChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseFloat(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], parsedValue, null, null, null);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleUPSCostChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseFloat(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], null, parsedValue, null, null);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleProductionCostChange = (idx, newValue) => {
    const updatedData = [...tableData];
    const parsedValue = parseFloat(newValue) || 0;
    updatedData[idx] = recalculateRow(updatedData[idx], null, null, null, parsedValue);
    
    setTableData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleBoxNumberChange = (idx, newValue) => {
    const updatedData = [...tableData];
    updatedData[idx]['Box Number'] = newValue;
    if (!updatedData[idx].edited) updatedData[idx].edited = {};
    updatedData[idx].edited.boxNumber = true;
    
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
    <div className="bg-white border-2 border-gray-300" data-testid="results-table">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-blue-700 text-white sticky top-0">
            <tr>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Status</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">PO</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Vendor</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Location</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">ASIN</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">External ID</th>
              <th className="px-2 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider">Model</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-900">Qty (Edit)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-900">Unit Cost (Edit)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-900">Prod Cost (Edit)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-900">UPS Cost (Edit)</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Op Cost</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Commission</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin/Unit</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Margin %</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Total Margin</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Stock</th>
              <th className="px-2 py-3 text-right text-xs font-mono font-bold uppercase tracking-wider">Sales (30d)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-yellow-100 text-yellow-900">Box # (Edit)</th>
              <th className="px-2 py-3 text-center text-xs font-mono font-bold uppercase tracking-wider bg-blue-600 text-white">Actions</th>
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
                    needsReview ? 'bg-red-50 border-l-4 border-l-red-500' : 'bg-white'
                  } ${approvalStatus === 'approved' ? 'border-l-4 border-l-green-600 bg-green-50' : ''} ${approvalStatus === 'rejected' ? 'border-l-4 border-l-gray-500 opacity-60 bg-gray-100' : ''}`}
                  data-testid={needsReview ? 'needs-review-row' : 'approved-row'}
                >
                  <td className="px-2 py-2">
                    {needsReview ? (
                      <div className="flex items-center gap-1 text-red-600">
                        <Warning size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">REVIEW</span>
                      </div>
                    ) : approvalStatus === 'approved' ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">APPROVED</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-600">
                        <CheckCircle size={16} weight="bold" />
                        <span className="text-xs font-mono font-bold">OK</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-sm font-mono text-gray-900">{row.PO}</td>
                  <td className="px-2 py-2 text-sm font-mono text-gray-900">{row.Vendor}</td>
                  <td className="px-2 py-2 text-sm max-w-xs truncate text-gray-700" title={row['Ship to Location']}>
                    {row['Ship to Location']}
                  </td>
                  <td className="px-2 py-2 text-sm font-mono text-gray-900">{row.ASIN}</td>
                  <td className="px-2 py-2 text-sm font-mono text-gray-700">{row['External ID']}</td>
                  <td className="px-2 py-2 text-sm text-gray-700">{row['Model Number']}</td>
                  
                  {/* Editable Quantity */}
                  <td className="px-2 py-2 bg-blue-50">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row['Quantity']}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      className="w-16 px-2 py-1 border-2 border-blue-300 focus:border-blue-600 focus:outline-none text-sm text-center font-mono font-bold bg-white text-gray-900"
                      data-testid={`quantity-input-${idx}`}
                    />
                  </td>
                  
                  {/* Editable Unit Cost */}
                  <td className="px-2 py-2 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['Unit Cost']}
                      onChange={(e) => handleUnitCostChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 border-2 border-blue-300 focus:border-blue-600 focus:outline-none text-sm text-right font-mono font-bold bg-white text-gray-900"
                      data-testid={`unit-cost-input-${idx}`}
                    />
                    <span className="ml-1 text-sm text-gray-900">€</span>
                  </td>
                  
                  
                  {/* Editable Production Cost */}
                  <td className="px-2 py-2 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['Production Cost']}
                      onChange={(e) => handleProductionCostChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 border-2 border-blue-300 focus:border-blue-600 focus:outline-none text-sm text-right font-mono font-bold bg-white text-gray-900"
                      data-testid={`prod-cost-input-${idx}`}
                    />
                    <span className="ml-1 text-sm text-gray-900">€</span>
                  </td>
                  
                  {/* Editable UPS Cost */}
                  <td className="px-2 py-2 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['UPS Cost']}
                      onChange={(e) => handleUPSCostChange(idx, e.target.value)}
                      className="w-20 px-2 py-1 border-2 border-blue-300 focus:border-blue-600 focus:outline-none text-sm text-right font-mono font-bold bg-white text-gray-900"
                      data-testid={`ups-cost-input-${idx}`}
                    />
                    <span className="ml-1 text-sm text-gray-900">€</span>
                  </td>
                  
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-700">€{row['Operational Cost']}</td>
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-700">€{row.Commission}</td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Margin/Unit'] < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    €{row['Margin/Unit']}
                  </td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Margin %'] < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {row['Margin %']}%
                  </td>
                  <td
                    className={`px-2 py-2 text-sm text-right font-mono font-bold ${
                      row['Total Margin'] < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    €{row['Total Margin']}
                  </td>
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-600">
                    {row['Stock Quantity'] > 0 ? row['Stock Quantity'] : '-'}
                  </td>
                  <td className="px-2 py-2 text-sm text-right font-mono text-gray-600">
                    {row['Sales Units (30d)'] > 0 ? row['Sales Units (30d)'] : '-'}
                  </td>
                  
                  {/* Editable Box Number - only for approved items */}
                  <td className="px-2 py-2 bg-yellow-50">
                    {approvalStatus === 'approved' ? (
                      <input
                        type="text"
                        value={row['Box Number'] || ''}
                        onChange={(e) => handleBoxNumberChange(idx, e.target.value)}
                        placeholder="Box #"
                        className="w-16 px-2 py-1 border-2 border-yellow-500 focus:border-yellow-600 focus:outline-none text-sm text-center font-mono font-bold bg-white text-gray-900"
                        data-testid={`box-number-input-${idx}`}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  
                  {/* Approve and Reject Buttons */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      {approvalStatus === 'approved' ? (
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-green-600 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-green-700 transition-colors flex items-center gap-1"
                          data-testid={`approved-button-${idx}`}
                        >
                          <Check size={14} weight="bold" />
                          Approved
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(idx)}
                          className="bg-white border-2 border-gray-300 text-gray-900 px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-green-600 hover:text-white hover:border-green-600 transition-colors"
                          data-testid={`approve-button-${idx}`}
                        >
                          Approve
                        </button>
                      )}
                      
                      {approvalStatus === 'rejected' ? (
                        <button
                          onClick={() => handleApprove(idx)}
                          className="bg-gray-500 text-white px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-gray-600 transition-colors flex items-center gap-1"
                          data-testid={`rejected-button-${idx}`}
                        >
                          <X size={14} weight="bold" />
                          Rejected
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-white border-2 border-red-500 text-red-600 px-3 py-2 text-xs font-mono font-bold uppercase hover:bg-red-600 hover:text-white transition-colors"
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
