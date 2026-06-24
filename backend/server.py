from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, Form
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from bson import ObjectId
import secrets
import pandas as pd
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment
import json
import shutil

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

# === Models ===
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    invite_code: str

class User(BaseModel):
    id: str
    email: str
    name: str
    role: str

class SettingsModel(BaseModel):
    commission_fr: float = 24.0
    commission_es: float = 37.0
    commission_it: float = 26.0
    minimum_margin: float = 10.0
    operational_cost: float = 0.5
    shipping_cost: float = 1.0
    ups_cost_default: float = 1.0

class UploadResult(BaseModel):
    upload_id: str
    filename: str
    total_items: int
    needs_review: int
    approved: int
    timestamp: str
    summary: dict

# === Auth Helpers ===
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "default_secret_key_change_in_production")

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# === Helper Functions ===
def load_stock_data(file_path: str) -> dict:
    """Load stock data and return dict keyed by ASIN"""
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
    """Load sales data and return dict keyed by ASIN"""
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

# === Cost Calculation Logic ===
def calculate_order_costs(df: pd.DataFrame, settings: dict, stock_data: dict, sales_data: dict) -> pd.DataFrame:
    """
    Calculate production costs, margins, and approval status with stock/sales data.
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

def create_excel_with_formatting(results_df: pd.DataFrame, output_path: str):
    """
    Create Excel file with conditional formatting and all requested fields.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "PO Analysis"
    
    # Write headers
    headers = [
        'PO', 'Vendor', 'Ship to Location', 'ASIN', 'External ID', 'Model Number', 'Title',
        'Quantity', 'Unit Cost', 'Production Cost', 'UPS Cost', 'Operational Cost', 
        'Commission', 'Total Cost/Unit', 'Margin/Unit', 'Margin %', 
        'Total Cost', 'Total Margin', 'Stock Quantity', 'Sales Units (30d)', 'Status'
    ]
    
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = Font(bold=True, size=11)
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.fill = PatternFill(start_color="000000", end_color="000000", fill_type="solid")
        cell.font = Font(bold=True, size=11, color="FFFFFF")
    
    # Define fills
    red_fill = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
    red_font = Font(color="CC0000", bold=True)
    
    # Write data with formatting
    for row_idx, row_data in enumerate(results_df.itertuples(index=False), 2):
        needs_review = row_data[-1]  # Last column is 'Needs Review'
        
        # Write data (exclude 'Needs Review' column from output)
        for col_idx, value in enumerate(row_data[:-1], 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            
            # Apply red formatting for items needing review
            if needs_review:
                cell.fill = red_fill
                if col_idx == 21:  # Status column
                    cell.font = red_font
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except (TypeError, AttributeError):
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    wb.save(output_path)

def create_excel_with_approval(results_list: list, output_path: str):
    """
    Create Excel file with separate sheets for Approved and Non-Approved orders.
    Approved items = RED background, Non-approved = NO background color.
    """
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet
    
    # Define headers
    headers = [
        'PO', 'Vendor', 'Ship to Location', 'ASIN', 'External ID', 'Model Number', 'Title',
        'Quantity', 'Unit Cost', 'Production Cost', 'UPS Cost', 'Operational Cost', 
        'Commission', 'Total Cost/Unit', 'Margin/Unit', 'Margin %', 
        'Total Cost', 'Total Margin', 'Stock Quantity', 'Sales Units (30d)', 'Status'
    ]
    
    # Separate data by approval status
    approved_items = [item for item in results_list if item.get('Approval Status') == 'approved']
    rejected_items = [item for item in results_list if item.get('Approval Status') == 'rejected']
    pending_items = [item for item in results_list if item.get('Approval Status', 'pending') == 'pending']
    
    # Define fills and fonts  
    green_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")  # Green for approved
    red_fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")  # Red for rejected
    yellow_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")  # Yellow for edited cells
    header_fill = PatternFill(start_color="0A5F9C", end_color="0A5F9C", fill_type="solid")  # Professional blue
    header_font = Font(bold=True, size=11, color="FFFFFF")
    
    def write_sheet(ws, data, color_by_status=True):
        # Write headers
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.fill = header_fill
        
        # Write data
        for row_idx, item in enumerate(data, 2):
            is_approved = item.get('Approval Status') == 'approved'
            is_rejected = item.get('Approval Status') == 'rejected'
            edited_fields = item.get('edited', {})
            
            for col_idx, header in enumerate(headers, 1):
                value = item.get(header, '')
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                
                # Determine cell color
                if color_by_status:
                    # Check if this specific cell was edited
                    field_edited = False
                    if header == 'Quantity' and edited_fields.get('quantity'):
                        field_edited = True
                    elif header == 'Unit Cost' and edited_fields.get('unitCost'):
                        field_edited = True
                    elif header == 'Production Cost' and edited_fields.get('productionCost'):
                        field_edited = True
                    elif header == 'UPS Cost' and edited_fields.get('upsCost'):
                        field_edited = True
                    elif header == 'Box Number' and edited_fields.get('boxNumber'):
                        field_edited = True
                    
                    # Apply colors: Yellow for edited cells, Green for approved rows, Red for rejected rows
                    if field_edited:
                        cell.fill = yellow_fill
                    elif is_approved:
                        cell.fill = green_fill
                    elif is_rejected:
                        cell.fill = red_fill
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except (TypeError, AttributeError):
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
    
    # Create Approved Orders sheet - GREEN with YELLOW for edited cells
    if approved_items:
        ws_approved = wb.create_sheet("Approved Orders")
        write_sheet(ws_approved, approved_items, color_by_status=True)
    
    # Create Rejected Orders sheet - RED
    if rejected_items:
        ws_rejected = wb.create_sheet("Rejected Orders")
        write_sheet(ws_rejected, rejected_items, color_by_status=True)
    
    # Create Non-Approved (Pending) Orders sheet - NO COLOR
    if pending_items:
        ws_pending = wb.create_sheet("Pending Orders")
        write_sheet(ws_pending, pending_items, color_by_status=False)
    
    # Create All Orders sheet - Mixed colors
    ws_all = wb.create_sheet("All Orders", 0)  # Insert at beginning
    write_sheet(ws_all, results_list, color_by_status=True)
    
    wb.save(output_path)

def create_export_file(approved_items: list, output_path: str):
    """
    Create EXPORT file with approved items in specific format.
    Columns: PO, Vendor, Ship to location, Model Number, ASIN, External ID, Title, Availability
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "POout"
    
    # Headers
    headers = ['PO', 'Vendor', 'Ship to location', 'Model Number', 'ASIN', 'External ID', 'Title', 'Availability']
    
    # Write headers
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = Font(bold=True)
    
    # Write data
    for row_idx, item in enumerate(approved_items, 2):
        ws.cell(row=row_idx, column=1, value=item.get('PO', ''))
        ws.cell(row=row_idx, column=2, value=item.get('Vendor', ''))
        ws.cell(row=row_idx, column=3, value=item.get('Ship to Location', ''))
        ws.cell(row=row_idx, column=4, value=item.get('Model Number', ''))
        ws.cell(row=row_idx, column=5, value=item.get('ASIN', ''))
        ws.cell(row=row_idx, column=6, value=item.get('External ID', ''))
        ws.cell(row=row_idx, column=7, value=item.get('Title', ''))
        ws.cell(row=row_idx, column=8, value='Accepted: In stock')
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except (TypeError, AttributeError):
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    wb.save(output_path)

def create_box_file(approved_items: list, output_path: str):
    """
    Create BOX file with box numbers.
    Columns: PO, Vendor, Ship to location, Model Number, Expected Quantity, BOX
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "POout"
    
    # Headers
    headers = ['PO', 'Vendor', 'Ship to location', 'Model Number', 'Expected Quantity', 'BOX']
    
    # Write headers
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = Font(bold=True)
    
    # Write data
    for row_idx, item in enumerate(approved_items, 2):
        ws.cell(row=row_idx, column=1, value=item.get('PO', ''))
        ws.cell(row=row_idx, column=2, value=item.get('Vendor', ''))
        ws.cell(row=row_idx, column=3, value=item.get('Ship to Location', ''))
        ws.cell(row=row_idx, column=4, value=item.get('Model Number', ''))
        ws.cell(row=row_idx, column=5, value=item.get('Quantity', 0))
        ws.cell(row=row_idx, column=6, value=item.get('Box Number', ''))
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except (TypeError, AttributeError):
                pass
        adjusted_width = min(max_length + 2, 30)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    wb.save(output_path)

def load_reference_data():
    """Load MT-AMAZON-StockProdRefs reference data for Color and Taille matching"""
    try:
        ref_file = '/app/backend/reference_data.xlsx'
        df = pd.read_excel(ref_file, engine='openpyxl')
        # Create a dictionary for quick lookup by SKU
        reference_dict = {}
        for _, row in df.iterrows():
            sku = row.get('SKU', '')
            if pd.notna(sku):
                reference_dict[str(sku).strip()] = {
                    'color': row.get('Color', ''),
                    'taille': row.get('Taille', ''),
                    'prod_or_stock': row.get('Prod or Stock', '')
                }
        return reference_dict
    except Exception as e:
        logging.error(f"Error loading reference data: {e}")
        return {}

def create_production_sheets(approved_items: list, output_path: str):
    """
    Create Production Sheets Excel with two sheets:
    - 'To Print Stock' for SKUs starting with 'J'
    - 'To Print Prod' for all other SKUs
    Matches with reference file to get Color and Taille
    """
    wb = openpyxl.Workbook()
    # Don't remove the default sheet yet - we'll handle it at the end
    
    # Load reference data
    reference_dict = load_reference_data()
    
    # Prepare items with reference data
    items_with_ref = []
    for item in approved_items:
        # Try to match with reference data
        model = item.get('Model Number', '')
        ref_data = reference_dict.get(str(model).strip(), {})
        
        # Add reference data to item
        item_with_ref = {
            **item,
            'Color': ref_data.get('color', '') if pd.notna(ref_data.get('color')) else '',
            'Taille': ref_data.get('taille', '') if pd.notna(ref_data.get('taille')) else ''
        }
        items_with_ref.append(item_with_ref)
    
    # Separate items by SKU prefix
    stock_items = []  # SKUs starting with 'J'
    prod_items = []   # All other SKUs
    
    for item in items_with_ref:
        sku = str(item.get('Model Number', '')).strip()
        if sku.upper().startswith('J'):
            stock_items.append(item)
        else:
            prod_items.append(item)
    
    # Headers for production sheets
    headers = ['REF', 'COLOR', 'TAILLE', 'QTY']
    
    header_fill = PatternFill(start_color="0A5F9C", end_color="0A5F9C", fill_type="solid")
    header_font = Font(bold=True, size=11, color="FFFFFF")
    
    sheets_created = []
    
    # Create "To Print Prod" sheet first (most common)
    if prod_items:
        ws_prod = wb.active
        ws_prod.title = 'To Print Prod'
        sheets_created.append('To Print Prod')
        
        # Write headers
        for col_idx, header in enumerate(headers, 1):
            cell = ws_prod.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center')
        
        # Write data
        for row_idx, item in enumerate(prod_items, 2):
            ws_prod.cell(row=row_idx, column=1, value=item.get('Model Number', ''))  # REF
            ws_prod.cell(row=row_idx, column=2, value=item.get('Color', ''))        # COLOR
            ws_prod.cell(row=row_idx, column=3, value=item.get('Taille', ''))       # TAILLE
            ws_prod.cell(row=row_idx, column=4, value=item.get('Quantity', 0))      # QTY
        
        # Auto-adjust column widths
        for column in ws_prod.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except (TypeError, AttributeError):
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws_prod.column_dimensions[column_letter].width = adjusted_width
    
    # Create "To Print Stock" sheet
    if stock_items:
        ws_stock = wb.create_sheet('To Print Stock', 0)  # Insert at beginning
        sheets_created.append('To Print Stock')
        
        # Write headers
        for col_idx, header in enumerate(headers, 1):
            cell = ws_stock.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center')
        
        # Write data
        for row_idx, item in enumerate(stock_items, 2):
            ws_stock.cell(row=row_idx, column=1, value=item.get('Model Number', ''))  # REF
            ws_stock.cell(row=row_idx, column=2, value=item.get('Color', ''))        # COLOR
            ws_stock.cell(row=row_idx, column=3, value=item.get('Taille', ''))       # TAILLE
            ws_stock.cell(row=row_idx, column=4, value=item.get('Quantity', 0))      # QTY
        
        # Auto-adjust column widths
        for column in ws_stock.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except (TypeError, AttributeError):
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws_stock.column_dimensions[column_letter].width = adjusted_width
    
    # If no prod items but we have stock items, rename the default sheet
    if not prod_items and stock_items:
        # The stock sheet was already created, nothing to do
        pass
    
    # If neither sheet has items, create an empty "To Print Prod" sheet
    if not prod_items and not stock_items:
        ws_empty = wb.active
        ws_empty.title = 'To Print Prod'
        for col_idx, header in enumerate(headers, 1):
            cell = ws_empty.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center')
    
    wb.save(output_path)

def create_ean_list_csv_by_location(approved_items: list, output_dir: str):
    """
    Create separate EAN List CSV files for each location
    Returns path to ZIP file containing all CSVs
    
    Format varies by location:
    - CDG7: semicolon-separated (EAN;ASIN;SKU;QTY)
    - XCD2: space-separated (EAN ASIN SKU QTY)
    - XOR1/XOR2/XOR4: comma-separated with Title (EAN,ASIN,Title,QTY)
    """
    import csv
    import zipfile
    from pathlib import Path
    
    # Group items by location
    location_groups = {}
    for item in approved_items:
        location = item.get('Ship to Location', 'Unknown')
        # Extract location code (e.g., "CDG7" from "CDG7 - Senlis, Oise")
        location_code = location.split('-')[0].strip() if '-' in location else location.strip()
        
        if location_code not in location_groups:
            location_groups[location_code] = []
        location_groups[location_code].append(item)
    
    # Create directory for CSV files
    csv_dir = Path(output_dir) / 'ean_csvs'
    csv_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine format based on location
    def get_location_format(location_code):
        loc_upper = location_code.upper()
        if 'CDG' in loc_upper:
            return 'semicolon'  # EAN;ASIN;SKU;QTY
        elif 'XCD' in loc_upper:
            return 'space'  # EAN ASIN SKU QTY
        else:
            return 'comma_title'  # EAN,ASIN,Title,QTY
    
    csv_files = []
    
    # Create CSV for each location
    for location_code, items in location_groups.items():
        format_type = get_location_format(location_code)
        filename = f"{location_code} EAN.csv"
        filepath = csv_dir / filename
        
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            if format_type == 'semicolon':
                # CDG7 format: EAN;ASIN;SKU;QTY
                for item in items:
                    line = f"{item.get('External ID', '')};{item.get('ASIN', '')};{item.get('Model Number', '')};{item.get('Quantity', 0)}\n"
                    csvfile.write(line)
            
            elif format_type == 'space':
                # XCD2 format: EAN ASIN SKU QTY (space-separated)
                for item in items:
                    line = f"{item.get('External ID', '')} {item.get('ASIN', '')} {item.get('Model Number', '')} {item.get('Quantity', 0)}\n"
                    csvfile.write(line)
            
            else:  # comma_title
                # XOR1/XOR2/XOR4 format: EAN,ASIN,Title,QTY
                writer = csv.writer(csvfile)
                for item in items:
                    writer.writerow([
                        item.get('External ID', ''),
                        item.get('ASIN', ''),
                        item.get('Title', ''),
                        item.get('Quantity', 0)
                    ])
        
        csv_files.append(filepath)
    
    # Create ZIP file
    zip_path = Path(output_dir) / 'EAN_Lists.zip'
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for csv_file in csv_files:
            zipf.write(csv_file, csv_file.name)
    
    return str(zip_path)

def create_packing_list(approved_items: list, output_path: str):
    """
    Create Packing List Excel
    Columns: Destination (Location), Reference (SKU), QTY, Carton AMZNCC/SSCC
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Packing List"
    
    # Headers
    headers = ['Destination', 'Reference', 'QTY', 'Carton AMZNCC/SSCC']
    header_fill = PatternFill(start_color="0A5F9C", end_color="0A5F9C", fill_type="solid")
    header_font = Font(bold=True, size=11, color="FFFFFF")
    
    # Write headers
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')
    
    # Write data
    for row_idx, item in enumerate(approved_items, 2):
        ws.cell(row=row_idx, column=1, value=item.get('Ship to Location', ''))
        ws.cell(row=row_idx, column=2, value=item.get('Model Number', ''))
        ws.cell(row=row_idx, column=3, value=item.get('Quantity', 0))
        ws.cell(row=row_idx, column=4, value=item.get('Box Number', ''))  # Using Box Number as Carton AMZNCC/SSCC
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except (TypeError, AttributeError):
                pass
        adjusted_width = min(max_length + 2, 40)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    wb.save(output_path)


# === Auth Endpoints ===
@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    email = request.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Use secure cookies for production (HTTPS)
    is_production = "preview.emergentagent.com" in os.environ.get('FRONTEND_ORIGIN', '')
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=604800,
        path="/"
    )
    
    return {
        "id": user_id,
        "email": user["email"],
        "name": user.get("name", "Admin"),
        "role": user.get("role", "admin")
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

@api_router.post("/auth/signup")
async def signup(request: SignupRequest, response: Response):
    # Validate invite code
    invite_codes = {
        "IMAPPROVER1": "approver",
        "IMADMIN1": "admin"
    }
    
    if request.invite_code not in invite_codes:
        raise HTTPException(status_code=400, detail="Invalid invite code")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Determine role from invite code
    role = invite_codes[request.invite_code]
    
    # Hash password
    hashed_password = hash_password(request.password)
    
    # Create user
    user_data = {
        "email": request.email,
        "password_hash": hashed_password,
        "name": request.name,
        "role": role,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_data)
    user_id = str(result.inserted_id)
    
    # Create tokens
    access_token = create_access_token(user_id, request.email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    is_production = "preview.emergentagent.com" in os.environ.get('FRONTEND_ORIGIN', '')
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=604800,
        path="/"
    )
    
    return {
        "id": user_id,
        "email": request.email,
        "name": request.name,
        "role": role
    }

# === Settings Endpoints ===
@api_router.get("/settings")
async def get_settings(request: Request):
    await get_current_user(request)
    settings = await db.settings.find_one({"type": "po_thresholds"})
    if not settings:
        default_settings = SettingsModel().model_dump()
        await db.settings.insert_one({"type": "po_thresholds", **default_settings})
        return default_settings
    settings.pop("_id", None)
    settings.pop("type", None)
    return settings

@api_router.post("/settings")
async def update_settings(settings: SettingsModel, request: Request):
    await get_current_user(request)
    settings_dict = settings.model_dump()
    await db.settings.update_one(
        {"type": "po_thresholds"},
        {"$set": settings_dict},
        upsert=True
    )
    return {"message": "Settings updated successfully", "settings": settings_dict}

# === Upload & Processing Endpoints ===
@api_router.post("/upload")
async def upload_files(
    request: Request,
    po_file: UploadFile = File(...),
    stock_file: Optional[UploadFile] = File(None),
    sales_file: Optional[UploadFile] = File(None)
):
    user = await get_current_user(request)
    
    if not po_file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="PO file must be Excel format")
    
    # Get current settings
    settings = await db.settings.find_one({"type": "po_thresholds"})
    if not settings:
        settings = SettingsModel().model_dump()
    else:
        settings.pop("_id", None)
        settings.pop("type", None)
    
    # Save uploaded files
    upload_id = str(uuid.uuid4())
    po_path = f"/app/uploads/{upload_id}_po.xlsx"
    
    with open(po_path, "wb") as buffer:
        shutil.copyfileobj(po_file.file, buffer)
    
    # Load stock data if provided
    stock_data = {}
    if stock_file and stock_file.filename:
        stock_path = f"/app/uploads/{upload_id}_stock.xlsx"
        with open(stock_path, "wb") as buffer:
            shutil.copyfileobj(stock_file.file, buffer)
        stock_data = load_stock_data(stock_path)
    
    # Load sales data if provided
    sales_data = {}
    if sales_file and sales_file.filename:
        sales_path = f"/app/uploads/{upload_id}_sales.xlsx"
        with open(sales_path, "wb") as buffer:
            shutil.copyfileobj(sales_file.file, buffer)
        sales_data = load_sales_data(sales_path)
    
    try:
        # Read PO Excel file
        df = pd.read_excel(po_path, engine='openpyxl')
        
        # Process and calculate costs
        results_df = calculate_order_costs(df, settings, stock_data, sales_data)
        
        # Generate summary
        total_items = len(results_df)
        needs_review = results_df['Needs Review'].sum()
        approved = total_items - needs_review
        
        total_cost = results_df['Total Cost'].sum()
        total_margin = results_df['Total Margin'].sum()
        avg_margin_pct = results_df['Margin %'].mean()
        
        summary = {
            'total_cost': round(total_cost, 2),
            'total_margin': round(total_margin, 2),
            'avg_margin_pct': round(avg_margin_pct, 2),
            'with_stock_data': len(stock_data) > 0,
            'with_sales_data': len(sales_data) > 0
        }
        
        # Save results to Excel with formatting
        output_path = f"/app/uploads/{upload_id}_processed.xlsx"
        create_excel_with_formatting(results_df, output_path)
        
        # Convert numpy types to native Python (MongoDB can't encode np.int64/float64)
        results_records = json.loads(results_df.to_json(orient='records'))

        # Store in database
        upload_record = {
            "upload_id": upload_id,
            "filename": po_file.filename,
            "user_id": user.get('_id') or user.get('id'),
            "total_items": total_items,
            "needs_review": int(needs_review),
            "approved": int(approved),
            "summary": json.loads(json.dumps(summary, default=str)),
            "results": results_records,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "settings_used": settings,
            "has_stock_data": len(stock_data) > 0,
            "has_sales_data": len(sales_data) > 0,
            "user_email": user.get('email'),
            "status": "In Progress"
        }
        await db.uploads.insert_one(upload_record)
        
        return {
            "upload_id": upload_id,
            "filename": po_file.filename,
            "total_items": total_items,
            "needs_review": int(needs_review),
            "approved": int(approved),
            "timestamp": upload_record['timestamp'],
            "summary": summary,
            "results": results_records
        }
        
    except Exception as e:
        logging.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.get("/history")
async def get_history(request: Request):
    user = await get_current_user(request)
    
    uploads = await db.uploads.find(
        {},
        {"_id": 0, "upload_id": 1, "filename": 1, "total_items": 1, "needs_review": 1, "approved": 1, "timestamp": 1, "user_email": 1, "status": 1}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return uploads

@api_router.get("/upload/{upload_id}")
async def get_upload(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get upload record
    upload = await db.uploads.find_one({"upload_id": upload_id}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    # Get results
    results = await db.results.find(
        {"upload_id": upload_id},
        {"_id": 0}
    ).to_list(1000)
    
    return {
        "upload_id": upload_id,
        "filename": upload['filename'],
        "total_items": len(results),
        "needs_review": upload.get('needs_review', 0),
        "approved": upload.get('approved', 0),
        "timestamp": upload['timestamp'],
        "results": results
    }

@api_router.post("/download/{upload_id}")
async def download_file(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Create Excel with approval status
    output_path = f"/app/uploads/{upload_id}_final.xlsx"
    create_excel_with_approval(updated_results, output_path)
    
    return FileResponse(
        path=output_path,
        filename=f"po_analysis_{upload_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@api_router.post("/download-export/{upload_id}")
async def download_export_file(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Filter only approved items
    approved_items = [item for item in updated_results if item.get('Approval Status') == 'approved']
    
    # Create EXPORT file
    output_path = f"/app/uploads/{upload_id}_export.xlsx"
    create_export_file(approved_items, output_path)
    
    return FileResponse(
        path=output_path,
        filename="EXPORT.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@api_router.post("/download-box/{upload_id}")
async def download_box_file(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Filter only approved items with box numbers
    approved_with_box = [item for item in updated_results 
                        if item.get('Approval Status') == 'approved' and item.get('Box Number')]
    
    # Create BOX file
    output_path = f"/app/uploads/{upload_id}_box.xlsx"
    create_box_file(approved_with_box, output_path)
    
    return FileResponse(
        path=output_path,
        filename="BOX_FR.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@api_router.post("/download-production-sheets/{upload_id}")
async def download_production_sheets(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Filter only approved items
    approved_items = [item for item in updated_results 
                     if item.get('Approval Status') == 'approved']
    
    # Create Production Sheets file
    from datetime import datetime
    date_str = datetime.now().strftime('%Y%m%d')
    output_path = f"/app/uploads/{upload_id}_production_sheets.xlsx"
    create_production_sheets(approved_items, output_path)
    
    return FileResponse(
        path=output_path,
        filename=f"{date_str}-ProductionSheets.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@api_router.post("/download-ean-list/{upload_id}")
async def download_ean_list(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Filter only approved items
    approved_items = [item for item in updated_results 
                     if item.get('Approval Status') == 'approved']
    
    # Create EAN List ZIP with separate CSVs per location
    from datetime import datetime
    date_str = datetime.now().strftime('%Y%m%d')
    output_dir = f"/app/uploads/{upload_id}_ean"
    zip_path = create_ean_list_csv_by_location(approved_items, output_dir)
    
    return FileResponse(
        path=zip_path,
        filename=f"{date_str}-EANLists.zip",
        media_type="application/zip"
    )

@api_router.post("/download-packing-list/{upload_id}")
async def download_packing_list(upload_id: str, request: Request):
    await get_current_user(request)
    
    # Get the updated results from request body
    body = await request.json()
    updated_results = body.get('results', [])
    
    # Filter only approved items
    approved_items = [item for item in updated_results 
                     if item.get('Approval Status') == 'approved']
    
    # Create Packing List file
    from datetime import datetime
    date_str = datetime.now().strftime('%Y%m%d')
    output_path = f"/app/uploads/{upload_id}_packing_list.xlsx"
    create_packing_list(approved_items, output_path)
    
    return FileResponse(
        path=output_path,
        filename=f"{date_str}-PackingList.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@api_router.get("/results/{upload_id}")
async def get_results(upload_id: str, request: Request):
    await get_current_user(request)
    
    upload = await db.uploads.find_one({"upload_id": upload_id}, {"_id": 0})
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    return upload

# === Admin Seeding ===
@app.on_event("startup")
async def startup_event():
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@poreview.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logging.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logging.info(f"Admin password updated: {admin_email}")
    
    # Write test credentials
    with open('/app/memory/test_credentials.md', 'w') as f:
        f.write(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## API Endpoints
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- GET /api/settings
- POST /api/settings
- POST /api/upload (supports multiple files: po_file, stock_file, sales_file)
- GET /api/history
- GET /api/download/{{upload_id}}
- GET /api/results/{{upload_id}}
""")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.uploads.create_index("upload_id")
    await db.uploads.create_index("timestamp")
    
    logging.info("Application startup complete")

# Include router
app.include_router(api_router)

# CORS - Must be after router inclusion
frontend_origin = os.environ.get('FRONTEND_ORIGIN', 'https://po-review-hub.preview.emergentagent.com')
allowed_origins = [frontend_origin, 'http://localhost:3000']

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
