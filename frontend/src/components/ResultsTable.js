import React, { useState, useEffect, useMemo } from 'react';
import { Warning, CheckCircle, Check, X, Package, CaretUp, CaretDown, Funnel, MagnifyingGlass } from '@phosphor-icons/react';

const ResultsTable = ({ data, onDataChange, onApproveAll }) => {
  const [tableData, setTableData] = useState(data || []);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setTableData(data || []);
  }, [data]);

  // Filtered and sorted data
  const processedData = useMemo(() => {
    let filtered = tableData;

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(row => 
        Object.values(row).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        filtered = filtered.filter(row =>
          String(row[key]).toLowerCase().includes(filters[key].toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        // Handle numbers
        if (!isNaN(aVal) && !isNaN(bVal)) {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle strings
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortConfig.direction === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          return bStr < aStr ? -1 : bStr > aStr ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [tableData, sortConfig, filters, searchTerm]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (column, value) => {
    setFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

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
    <div className="bg-white border border-gray-300 w-full overflow-hidden" data-testid="results-table">
      {/* Filter Toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 p-2 flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-2 py-1 text-[10px] font-bold flex items-center gap-1 ${showFilters ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} border border-gray-300`}
        >
          <Funnel size={12} weight="bold" />
          FILTERS
        </button>
        
        <div className="flex-1 flex items-center gap-1 bg-white border border-gray-300 px-2">
          <MagnifyingGlass size={12} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 py-1 text-[10px] outline-none"
          />
        </div>
        
        <span className="text-[10px] text-gray-600">
          Showing {processedData.length} of {tableData.length} items
        </span>
        
        {(Object.keys(filters).length > 0 || searchTerm) && (
          <button
            onClick={clearFilters}
            className="px-2 py-1 text-[10px] font-bold bg-red-500 text-white"
          >
            CLEAR
          </button>
        )}
      </div>

      <div className="w-full">
        <table className="w-full border-collapse" style={{fontSize: '8px', lineHeight: '1.2'}}>
          <thead className="bg-blue-700 text-white sticky top-0">
            <tr>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '40px'}} onClick={() => handleSort('Needs Review')}>
                <div className="flex items-center gap-0.5">
                  Stat
                  {sortConfig.key === 'Needs Review' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '50px'}} onClick={() => handleSort('PO')}>
                <div className="flex items-center gap-0.5">
                  PO
                  {sortConfig.key === 'PO' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '40px'}} onClick={() => handleSort('Vendor')}>
                <div className="flex items-center gap-0.5">
                  Vend
                  {sortConfig.key === 'Vendor' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '80px'}} onClick={() => handleSort('Ship to Location')}>
                <div className="flex items-center gap-0.5">
                  Location
                  {sortConfig.key === 'Ship to Location' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '70px'}} onClick={() => handleSort('ASIN')}>
                <div className="flex items-center gap-0.5">
                  ASIN
                  {sortConfig.key === 'ASIN' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '80px'}} onClick={() => handleSort('External ID')}>
                <div className="flex items-center gap-0.5">
                  EAN
                  {sortConfig.key === 'External ID' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-left font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '100px'}} onClick={() => handleSort('Model Number')}>
                <div className="flex items-center gap-0.5">
                  Model
                  {sortConfig.key === 'Model Number' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-center font-bold uppercase bg-blue-100 text-blue-900 border-r border-blue-600 cursor-pointer hover:bg-blue-200" style={{width: '35px'}} onClick={() => handleSort('Quantity')}>
                <div className="flex items-center justify-center gap-0.5">
                  Qty
                  {sortConfig.key === 'Quantity' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-center font-bold uppercase bg-blue-100 text-blue-900 border-r border-blue-600 cursor-pointer hover:bg-blue-200" style={{width: '40px'}} onClick={() => handleSort('Unit Cost')}>
                <div className="flex items-center justify-center gap-0.5">
                  U€
                  {sortConfig.key === 'Unit Cost' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-center font-bold uppercase bg-blue-100 text-blue-900 border-r border-blue-600 cursor-pointer hover:bg-blue-200" style={{width: '40px'}} onClick={() => handleSort('Production Cost')}>
                <div className="flex items-center justify-center gap-0.5">
                  P€
                  {sortConfig.key === 'Production Cost' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-center font-bold uppercase bg-blue-100 text-blue-900 border-r border-blue-600 cursor-pointer hover:bg-blue-200" style={{width: '40px'}} onClick={() => handleSort('UPS Cost')}>
                <div className="flex items-center justify-center gap-0.5">
                  UPS
                  {sortConfig.key === 'UPS Cost' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-right font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '50px'}} onClick={() => handleSort('Total Margin')}>
                <div className="flex items-center justify-end gap-0.5">
                  Mrg€
                  {sortConfig.key === 'Total Margin' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-right font-bold uppercase border-r border-blue-600 cursor-pointer hover:bg-blue-600" style={{width: '35px'}} onClick={() => handleSort('Margin %')}>
                <div className="flex items-center justify-end gap-0.5">
                  %
                  {sortConfig.key === 'Margin %' && (
                    sortConfig.direction === 'asc' ? <CaretUp size={8} weight="bold" /> : <CaretDown size={8} weight="bold" />
                  )}
                </div>
              </th>
              <th className="px-0.5 py-0.5 text-center font-bold uppercase bg-yellow-100 text-yellow-900 border-r border-blue-600" style={{width: '40px'}}>Box</th>
              <th className="px-0.5 py-0.5 text-center font-bold uppercase" style={{width: '50px'}}>Act</th>
            </tr>
            
            {/* Filter Row */}
            {showFilters && (
              <tr className="bg-gray-100 text-gray-900">
                <td className="px-0.5 py-0.5"></td>
                <td className="px-0.5 py-0.5">
                  <input type="text" onChange={(e) => handleFilterChange('PO', e.target.value)} className="w-full text-[8px] px-0.5 py-0 border border-gray-300" placeholder="Filter..." />
                </td>
                <td className="px-0.5 py-0.5">
                  <input type="text" onChange={(e) => handleFilterChange('Vendor', e.target.value)} className="w-full text-[8px] px-0.5 py-0 border border-gray-300" placeholder="Filter..." />
                </td>
                <td className="px-0.5 py-0.5">
                  <input type="text" onChange={(e) => handleFilterChange('Ship to Location', e.target.value)} className="w-full text-[8px] px-0.5 py-0 border border-gray-300" placeholder="Filter..." />
                </td>
                <td className="px-0.5 py-0.5">
                  <input type="text" onChange={(e) => handleFilterChange('ASIN', e.target.value)} className="w-full text-[8px] px-0.5 py-0 border border-gray-300" placeholder="Filter..." />
                </td>
                <td className="px-0.5 py-0.5">
                  <input type="text" onChange={(e) => handleFilterChange('External ID', e.target.value)} className="w-full text-[8px] px-0.5 py-0 border border-gray-300" placeholder="Filter..." />
                </td>
                <td className="px-0.5 py-0.5">
                  <input type="text" onChange={(e) => handleFilterChange('Model Number', e.target.value)} className="w-full text-[8px] px-0.5 py-0 border border-gray-300" placeholder="Filter..." />
                </td>
                <td colSpan="8" className="px-0.5 py-0.5 text-center text-[8px] text-gray-500">
                  Click column headers to sort ↑↓
                </td>
              </tr>
            )}
          </thead>
          <tbody style={{fontSize: '8px'}}>
            {processedData.map((row, idx) => {
              const needsReview = row['Needs Review'];
              const approvalStatus = row['Approval Status'] || 'pending';
              // Use unique combination of External ID and index as key
              const uniqueKey = `${row['External ID']}-${row['Model Number']}-${idx}`;
              
              return (
                <tr
                  key={uniqueKey}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                    needsReview ? 'bg-red-100 border-l-2 border-l-red-400' : 'bg-white'
                  } ${approvalStatus === 'approved' ? 'border-l-2 border-l-green-600 bg-green-50' : ''} ${approvalStatus === 'rejected' ? 'border-l-2 border-l-gray-500 opacity-60 bg-gray-100' : ''}`}
                  data-testid={needsReview ? 'needs-review-row' : 'approved-row'}
                >
                  <td className="px-0.5 py-0.5">
                    {(() => {
                      if (needsReview) {
                        return (
                          <div className="flex items-center gap-0.5 text-red-600">
                            <Warning size={10} weight="bold" />
                            <span className="text-[8px] font-bold">!</span>
                          </div>
                        );
                      }
                      if (approvalStatus === 'approved') {
                        return (
                          <div className="flex items-center gap-0.5 text-green-600">
                            <CheckCircle size={10} weight="bold" />
                            <span className="text-[8px] font-bold">✓</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-0.5 text-gray-600">
                          <CheckCircle size={10} weight="bold" />
                          <span className="text-[8px] font-bold">OK</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-0.5 py-0.5 text-[8px]">{row.PO}</td>
                  <td className="px-0.5 py-0.5 text-[8px]">{row.Vendor}</td>
                  <td className="px-0.5 py-0.5 text-[8px] truncate" title={row['Ship to Location']} style={{maxWidth: '80px'}}>
                    {row['Ship to Location']}
                  </td>
                  <td className="px-0.5 py-0.5 text-[8px]">{row.ASIN}</td>
                  <td className="px-0.5 py-0.5 text-[8px]">{row['External ID']}</td>
                  <td className="px-0.5 py-0.5 text-[8px] truncate" title={row['Model Number']} style={{maxWidth: '100px'}}>{row['Model Number']}</td>
                  
                  {/* Editable Quantity */}
                  <td className="px-0.5 py-0.5 bg-blue-50">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row['Quantity']}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      className="w-full px-0.5 py-0 border border-blue-300 focus:border-blue-600 focus:outline-none text-[8px] text-center font-bold bg-white"
                      style={{height: '16px'}}
                      data-testid={`quantity-input-${idx}`}
                    />
                  </td>
                  
                  {/* Editable Unit Cost */}
                  <td className="px-0.5 py-0.5 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['Unit Cost']}
                      onChange={(e) => handleUnitCostChange(idx, e.target.value)}
                      className="w-full px-0.5 py-0 border border-blue-300 focus:border-blue-600 focus:outline-none text-[8px] text-right font-bold bg-white"
                      style={{height: '16px'}}
                      data-testid={`unit-cost-input-${idx}`}
                    />
                  </td>
                  
                  {/* Editable Production Cost */}
                  <td className="px-0.5 py-0.5 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['Production Cost']}
                      onChange={(e) => handleProductionCostChange(idx, e.target.value)}
                      className="w-full px-0.5 py-0 border border-blue-300 focus:border-blue-600 focus:outline-none text-[8px] text-right font-bold bg-white"
                      style={{height: '16px'}}
                      data-testid={`prod-cost-input-${idx}`}
                    />
                  </td>
                  
                  {/* Editable UPS Cost */}
                  <td className="px-0.5 py-0.5 bg-blue-50">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row['UPS Cost']}
                      onChange={(e) => handleUPSCostChange(idx, e.target.value)}
                      className="w-full px-0.5 py-0 border border-blue-300 focus:border-blue-600 focus:outline-none text-[8px] text-right font-bold bg-white"
                      style={{height: '16px'}}
                      data-testid={`ups-cost-input-${idx}`}
                    />
                  </td>
                  
                  <td className="px-0.5 py-0.5 text-[8px] text-right font-bold">€{row['Total Margin']}</td>
                  <td className="px-0.5 py-0.5 text-[8px] text-right font-bold">{row['Margin %']}%</td>
                  
                  {/* Editable Box Number */}
                  <td className="px-0.5 py-0.5 bg-yellow-50">
                    {approvalStatus === 'approved' ? (
                      <input
                        type="text"
                        value={row['Box Number'] || ''}
                        onChange={(e) => handleBoxNumberChange(idx, e.target.value)}
                        placeholder="Box"
                        className="w-full px-0.5 py-0 border border-yellow-500 focus:border-yellow-600 focus:outline-none text-[8px] text-center font-bold bg-white"
                        style={{height: '16px'}}
                        data-testid={`box-number-input-${idx}`}
                      />
                    ) : (
                      <span className="text-gray-400 text-[8px]">-</span>
                    )}
                  </td>
                  
                  {/* Approve and Reject Buttons */}
                  <td className="px-0.5 py-0.5 text-center">
                    <div className="flex gap-0.5 justify-center">
                      {approvalStatus === 'approved' ? (
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-green-600 text-white px-1 py-0.5 text-[8px] font-bold hover:bg-green-700"
                          style={{minWidth: '20px', height: '16px'}}
                          data-testid={`approved-button-${idx}`}
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(idx)}
                          className="bg-white border border-gray-300 text-gray-900 px-1 py-0.5 text-[8px] font-bold hover:bg-green-600 hover:text-white"
                          style={{minWidth: '20px', height: '16px'}}
                          data-testid={`approve-button-${idx}`}
                        >
                          ✓
                        </button>
                      )}
                      
                      {approvalStatus === 'rejected' ? (
                        <button
                          onClick={() => handleApprove(idx)}
                          className="bg-gray-500 text-white px-1 py-0.5 text-[8px] font-bold hover:bg-gray-600"
                          style={{minWidth: '20px', height: '16px'}}
                          data-testid={`rejected-button-${idx}`}
                        >
                          ✗
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReject(idx)}
                          className="bg-white border border-red-500 text-red-600 px-1 py-0.5 text-[8px] font-bold hover:bg-red-600 hover:text-white"
                          style={{minWidth: '20px', height: '16px'}}
                          data-testid={`reject-button-${idx}`}
                        >
                          ✗
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