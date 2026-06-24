import React from 'react';

/**
 * LocationBreakdown - Display margin breakdown by location for approved items
 */
const LocationBreakdown = ({ locationStats }) => {
  if (!locationStats || locationStats.length === 0) return null;

  return (
    <div className="bg-white border-2 border-gray-300 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2 font-mono uppercase tracking-wider">
        Margin by Location (Approved Items)
      </h3>
      <p className="text-xs text-gray-600 mb-4">Real-time margin updates when items are approved</p>
      
      <div className="space-y-3">
        {locationStats.map((loc) => (
          <div 
            key={loc.location} 
            className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200"
          >
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">{loc.location}</p>
              <p className="text-xs text-gray-600">{loc.items} approved items</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-600">€{loc.totalMargin}</p>
              <p className="text-xs text-gray-600">{loc.marginPercentage}% margin</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocationBreakdown;
