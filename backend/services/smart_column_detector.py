"""
Smart column detection for flexible Excel file processing
Handles different column names, positions, and header rows
"""
import pandas as pd
import re
from typing import Dict, Optional, Tuple


# Column name variations for smart detection
COLUMN_MAPPINGS = {
    'PO': ['po', 'purchase order', 'order', 'po number', 'order number'],
    'Vendor': ['vendor', 'supplier', 'vendor code', 'vendor id'],
    'Warehouse': ['warehouse', 'location', 'ship to', 'ship to location', 'destination'],
    'ASIN': ['asin', 'amazon asin', 'product id'],
    'External ID': ['external id', 'ean', 'barcode', 'upc', 'gtin', 'sku barcode'],
    'Model Number': ['model number', 'sku', 'model', 'item number', 'product code', 'reference'],
    'Title': ['title', 'description', 'product name', 'item name'],
    'Quantity Requested': ['quantity requested', 'quantity', 'qty', 'order quantity', 'expected quantity', 'qty requested'],
    'Unit Cost': ['unit cost', 'price', 'unit price', 'cost', 'item cost', 'purchase price']
}


def normalize_column_name(col_name: str) -> str:
    """Normalize column name for comparison"""
    if pd.isna(col_name):
        return ''
    return str(col_name).strip().lower()


def find_column_match(columns: list, target_col: str) -> Optional[str]:
    """
    Find the best matching column from the list based on target column variations
    
    Args:
        columns: List of column names from the Excel file
        target_col: Target column name we're looking for (e.g., 'ASIN')
        
    Returns:
        Actual column name from the file, or None if not found
    """
    variations = COLUMN_MAPPINGS.get(target_col, [])
    normalized_columns = {normalize_column_name(col): col for col in columns}
    
    # Try exact match first
    if target_col.lower() in normalized_columns:
        return normalized_columns[target_col.lower()]
    
    # Try variations
    for variation in variations:
        if variation in normalized_columns:
            return normalized_columns[variation]
    
    # Try partial match (contains)
    for norm_col, orig_col in normalized_columns.items():
        for variation in [target_col.lower()] + variations:
            if variation in norm_col or norm_col in variation:
                return orig_col
    
    return None


def detect_header_row(file_path: str, max_rows: int = 5) -> Tuple[int, Dict[str, str]]:
    """
    Detect which row contains headers and map columns
    
    Args:
        file_path: Path to Excel file
        max_rows: Maximum number of rows to check for headers
        
    Returns:
        Tuple of (header_row_index, column_mapping_dict)
    """
    best_score = 0
    best_header_row = 0
    best_mapping = {}
    
    for header_row in range(max_rows):
        try:
            df = pd.read_excel(file_path, engine='openpyxl', header=header_row)
            columns = list(df.columns)
            
            # Score based on how many required columns we can find
            mapping = {}
            score = 0
            
            # Required columns for PO processing
            required_cols = ['ASIN', 'Model Number', 'Quantity Requested', 'Unit Cost']
            optional_cols = ['PO', 'Vendor', 'Warehouse', 'External ID', 'Title']
            
            for target_col in required_cols:
                matched_col = find_column_match(columns, target_col)
                if matched_col:
                    mapping[target_col] = matched_col
                    score += 10  # Higher weight for required columns
            
            for target_col in optional_cols:
                matched_col = find_column_match(columns, target_col)
                if matched_col:
                    mapping[target_col] = matched_col
                    score += 1
            
            if score > best_score:
                best_score = score
                best_header_row = header_row
                best_mapping = mapping
                
        except Exception:
            continue
    
    return best_header_row, best_mapping


def load_excel_with_smart_detection(file_path: str) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    Load Excel file with intelligent column detection
    
    Args:
        file_path: Path to Excel file
        
    Returns:
        Tuple of (DataFrame, column_mapping_dict)
    """
    header_row, column_mapping = detect_header_row(file_path)
    
    # Load data with detected header row
    df = pd.read_excel(file_path, engine='openpyxl', header=header_row)
    
    # Rename columns to standard names
    reverse_mapping = {v: k for k, v in column_mapping.items()}
    df_renamed = df.rename(columns=reverse_mapping)
    
    # Ensure required columns exist (with defaults if missing)
    required_defaults = {
        'PO': '',
        'Vendor': '',
        'Warehouse': '',
        'ASIN': '',
        'External ID': '',
        'Model Number': '',
        'Title': '',
        'Quantity Requested': 0,
        'Unit Cost': 0.0
    }
    
    for col, default_val in required_defaults.items():
        if col not in df_renamed.columns:
            df_renamed[col] = default_val
    
    return df_renamed, column_mapping
