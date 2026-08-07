"""
File processing utilities for loading and processing Excel files
"""
import logging
import pandas as pd
import math


def safe_get_value(row, key, default):
    """Safely get value from row, handling NaN and None"""
    val = row.get(key, default)
    if pd.isna(val) or val is None:
        return default
    # Handle infinity
    if isinstance(val, (int, float)) and math.isinf(val):
        return default
    return val


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
            asin = safe_get_value(row, 'ASIN', '')
            if asin and pd.notna(asin):
                stock_qty = safe_get_value(row, 'Sellable On Hand Units', 0)
                stock_val = safe_get_value(row, 'Sellable On Hand Inventory', 0)
                stock_dict[str(asin).strip()] = {
                    'stock_quantity': int(float(stock_qty)) if stock_qty else 0,
                    'stock_value': float(stock_val) if stock_val else 0.0
                }
        logging.info(f"Loaded {len(stock_dict)} stock records")
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
            asin = safe_get_value(row, 'ASIN', '')
            if asin and pd.notna(asin):
                units = safe_get_value(row, 'Dispatched units', 0)
                revenue = safe_get_value(row, 'Dispatched revenue', 0)
                sales_dict[str(asin).strip()] = {
                    'sales_units': int(float(units)) if units else 0,
                    'sales_revenue': float(revenue) if revenue else 0.0
                }
        logging.info(f"Loaded {len(sales_dict)} sales records")
        return sales_dict
    except Exception as e:
        logging.error(f"Error loading sales data: {e}")
        return {}


def calculate_order_costs(df: pd.DataFrame, settings: dict, stock_data: dict, sales_data: dict) -> pd.DataFrame:
    """
    Calculate production costs, margins, and approval status with stock/sales data.
    Optimized with vectorized operations for large files.
    
    Args:
        df: DataFrame with PO data
        settings: Settings dictionary with commission rates and costs
        stock_data: Stock information by ASIN
        sales_data: Sales information by ASIN
        
    Returns:
        DataFrame with calculated costs and margins
    """
    # Extract and clean data with vectorized operations
    df['ASIN'] = df['ASIN'].fillna('').astype(str).str.strip()
    df['Quantity'] = pd.to_numeric(
        df.get('Quantity Requested', df.get('Expected Quantity', 0)),
        errors='coerce'
    ).fillna(0)
    df['Unit Cost'] = pd.to_numeric(df.get('Unit Cost', 0), errors='coerce').fillna(0)
    
    # Vectorized calculations
    df['Production Cost'] = (df['Unit Cost'] * 0.4).round(2)
    df['Commission'] = (df['Unit Cost'] * settings['commission_fr'] / 100).round(2)
    df['UPS Cost'] = settings.get('ups_cost_default', 1.0)
    df['Operational Cost'] = settings['operational_cost']
    
    df['Total Cost/Unit'] = (
        df['Production Cost'] + df['UPS Cost'] + 
        df['Operational Cost'] + df['Commission']
    ).round(2)
    
    df['Margin/Unit'] = (df['Unit Cost'] - df['Total Cost/Unit']).round(2)
    df['Margin %'] = (
        (df['Margin/Unit'] / df['Unit Cost'] * 100)
        .fillna(0)
        .round(2)
    )
    
    df['Total Cost'] = (df['Total Cost/Unit'] * df['Quantity']).round(2)
    df['Total Margin'] = (df['Margin/Unit'] * df['Quantity']).round(2)
    
    # Add stock and sales data (vectorized lookup)
    df['Stock Quantity'] = df['ASIN'].map(
        lambda x: stock_data.get(x, {}).get('stock_quantity', 0)
    ).fillna(0).astype(int)
    
    df['Sales Units (30d)'] = df['ASIN'].map(
        lambda x: sales_data.get(x, {}).get('sales_units', 0)
    ).fillna(0).astype(int)
    
    # Determine status
    df['Needs Review'] = (
        (df['Margin/Unit'] < 0) | 
        (df['Margin %'] < settings['minimum_margin'])
    )
    df['Status'] = df['Needs Review'].map({True: 'NEEDS_REVIEW', False: 'APPROVED'})
    
    # Prepare final result with clean column names
    result_df = pd.DataFrame({
        'PO': df.get('PO', '').fillna('').astype(str),
        'Vendor': df.get('Vendor', '').fillna('').astype(str),
        'Ship to Location': df.get('Warehouse', '').fillna('').astype(str),
        'ASIN': df['ASIN'],
        'External ID': df.get('External ID', '').fillna('').astype(str),
        'Model Number': df.get('Model Number', '').fillna('').astype(str),
        'Title': df.get('Title', '').fillna('').astype(str),
        'Quantity': df['Quantity'].astype(int),
        'Unit Cost': df['Unit Cost'],
        'Production Cost': df['Production Cost'],
        'UPS Cost': df['UPS Cost'],
        'Operational Cost': df['Operational Cost'],
        'Commission': df['Commission'],
        'Total Cost/Unit': df['Total Cost/Unit'],
        'Margin/Unit': df['Margin/Unit'],
        'Margin %': df['Margin %'],
        'Total Cost': df['Total Cost'],
        'Total Margin': df['Total Margin'],
        'Stock Quantity': df['Stock Quantity'],
        'Sales Units (30d)': df['Sales Units (30d)'],
        'Status': df['Status'],
        'Needs Review': df['Needs Review']
    })
    
    return result_df
