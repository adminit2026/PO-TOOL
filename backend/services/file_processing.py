"""
File processing utilities for loading and processing Excel files
"""
import logging
import pandas as pd


def load_stock_data(file_path: str) -> dict:
    """
    Load stock data and return dict keyed by ASIN
    
    Args:
        file_path: Path to the stock Excel file
        
    Returns:
        Dictionary with ASIN as key and stock info as value
    """
    try:
        df = pd.read_excel(file_path, engine='openpyxl', header=1)
        stock_dict = {}
        for _, row in df.iterrows():
            asin = row.get('ASIN')
            if pd.notna(asin):
                stock_qty = row.get('Sellable On Hand Units', 0)
                stock_val = row.get('Sellable On Hand Inventory', 0)
                stock_dict[asin] = {
                    'stock_quantity': int(stock_qty) if pd.notna(stock_qty) and stock_qty else 0,
                    'stock_value': float(stock_val) if pd.notna(stock_val) and stock_val else 0.0
                }
        return stock_dict
    except Exception as e:
        logging.error(f"Error loading stock data: {e}")
        return {}


def load_sales_data(file_path: str) -> dict:
    """
    Load sales data and return dict keyed by ASIN
    
    Args:
        file_path: Path to the sales Excel file
        
    Returns:
        Dictionary with ASIN as key and sales info as value
    """
    try:
        df = pd.read_excel(file_path, engine='openpyxl', header=1)
        sales_dict = {}
        for _, row in df.iterrows():
            asin = row.get('ASIN')
            if pd.notna(asin):
                units = row.get('Dispatched units', 0)
                revenue = row.get('Dispatched revenue', 0)
                sales_dict[asin] = {
                    'sales_units': int(units) if pd.notna(units) and units else 0,
                    'sales_revenue': float(revenue) if pd.notna(revenue) and revenue else 0.0
                }
        return sales_dict
    except Exception as e:
        logging.error(f"Error loading sales data: {e}")
        return {}


def calculate_order_costs(df: pd.DataFrame, settings: dict, stock_data: dict, sales_data: dict) -> pd.DataFrame:
    """
    Calculate production costs, margins, and approval status with stock/sales data.
    
    Args:
        df: DataFrame with PO data
        settings: Settings dictionary with commission rates and costs
        stock_data: Stock information by ASIN
        sales_data: Sales information by ASIN
        
    Returns:
        DataFrame with calculated costs and margins
    """
    results = []
    
    for idx, row in df.iterrows():
        asin = row.get('ASIN', '')
        quantity = row.get('Quantity Requested', 0) or row.get('Expected Quantity', 0) or 0
        unit_cost = row.get('Unit Cost', 0) or 0
        
        # Get stock and sales data
        stock_info = stock_data.get(asin, {})
        sales_info = sales_data.get(asin, {})
        
        # Simple production cost estimation (40% of unit cost)
        production_cost = unit_cost * 0.4
        
        # Calculate commission based on marketplace (default FR)
        commission_rate = settings['commission_fr'] / 100
        commission = unit_cost * commission_rate
        
        # UPS cost and operational cost per unit
        ups_cost = settings.get('ups_cost_default', 1.0)
        operational_cost = settings['operational_cost']
        
        # Total cost per unit
        total_cost_per_unit = production_cost + ups_cost + operational_cost + commission
        
        # Margin calculation
        margin_per_unit = unit_cost - total_cost_per_unit
        margin_percentage = (margin_per_unit / unit_cost * 100) if unit_cost > 0 else 0
        
        # Total values
        total_cost = total_cost_per_unit * quantity
        total_margin = margin_per_unit * quantity
        
        # Determine if needs review
        needs_review = margin_per_unit < 0 or margin_percentage < settings['minimum_margin']
        status = "NEEDS_REVIEW" if needs_review else "APPROVED"
        
        result = {
            'PO': row.get('PO', ''),
            'Vendor': row.get('Vendor', ''),
            'Ship to Location': row.get('Warehouse', ''),
            'ASIN': asin,
            'External ID': row.get('External ID', ''),
            'Model Number': row.get('Model Number', ''),
            'Title': row.get('Title', ''),
            'Quantity': quantity,
            'Unit Cost': round(unit_cost, 2),
            'Production Cost': round(production_cost, 2),
            'UPS Cost': round(ups_cost, 2),
            'Operational Cost': round(operational_cost, 2),
            'Commission': round(commission, 2),
            'Total Cost/Unit': round(total_cost_per_unit, 2),
            'Margin/Unit': round(margin_per_unit, 2),
            'Margin %': round(margin_percentage, 2),
            'Total Cost': round(total_cost, 2),
            'Total Margin': round(total_margin, 2),
            'Stock Quantity': int(stock_info.get('stock_quantity', 0)),
            'Sales Units (30d)': int(sales_info.get('sales_units', 0)),
            'Status': status,
            'Needs Review': needs_review
        }
        results.append(result)
    
    return pd.DataFrame(results)
