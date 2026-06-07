"""PO Review System - Backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://po-review-hub.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'admin@poreview.com')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'admin123')
TEST_FILE = "/app/uploads/test_sample_order.xlsx"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "admin"
    # cookie should be set
    assert "access_token" in s.cookies
    return s


# === Auth ===
def test_login_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_auth_me(session):
    r = session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == ADMIN_EMAIL


def test_auth_me_unauthenticated():
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


# === Settings ===
def test_get_settings(session):
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    data = r.json()
    for k in ["commission_fr", "commission_es", "commission_it", "minimum_margin", "operational_cost", "shipping_cost"]:
        assert k in data


def test_update_settings(session):
    payload = {
        "commission_fr": 25.0, "commission_es": 38.0, "commission_it": 27.0,
        "minimum_margin": 15.0, "operational_cost": 0.6, "shipping_cost": 1.2
    }
    r = session.post(f"{BASE_URL}/api/settings", json=payload)
    assert r.status_code == 200, r.text
    # Verify persisted
    r = session.get(f"{BASE_URL}/api/settings")
    assert r.json()["commission_fr"] == 25.0
    assert r.json()["minimum_margin"] == 15.0
    # restore defaults
    session.post(f"{BASE_URL}/api/settings", json={
        "commission_fr": 24.0, "commission_es": 37.0, "commission_it": 26.0,
        "minimum_margin": 100.0, "operational_cost": 0.5, "shipping_cost": 1.0
    })


# === Upload + History + Download ===
@pytest.fixture(scope="module")
def upload_id(session):
    assert os.path.exists(TEST_FILE), f"Test file missing: {TEST_FILE}"
    with open(TEST_FILE, "rb") as f:
        files = {"file": ("test_sample_order.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = session.post(f"{BASE_URL}/api/upload", files=files)
    assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
    data = r.json()
    assert "upload_id" in data
    assert data["total_items"] > 0
    assert "results" in data and len(data["results"]) > 0
    # Validate row schema
    row = data["results"][0]
    for k in ["PO", "Quantity", "Unit Cost", "Production Cost", "Commission",
              "Total Cost/Unit", "Margin/Unit", "Margin %", "Status", "Needs Review"]:
        assert k in row, f"Missing field: {k}"
    return data["upload_id"]


def test_upload_invalid_extension(session):
    files = {"file": ("test.txt", b"hello", "text/plain")}
    r = session.post(f"{BASE_URL}/api/upload", files=files)
    assert r.status_code == 400


def test_history_contains_upload(session, upload_id):
    r = session.get(f"{BASE_URL}/api/history")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert any(it["upload_id"] == upload_id for it in items)


def test_get_results(session, upload_id):
    r = session.get(f"{BASE_URL}/api/results/{upload_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["upload_id"] == upload_id
    assert "results" in data


def test_download(session, upload_id):
    r = session.get(f"{BASE_URL}/api/download/{upload_id}")
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("content-type", "") or len(r.content) > 100


def test_download_unknown_404(session):
    r = session.get(f"{BASE_URL}/api/download/nonexistent-id")
    assert r.status_code == 404


# === Logout ===
def test_logout():
    s = requests.Session()
    s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    r = s.post(f"{BASE_URL}/api/auth/logout")
    assert r.status_code == 200
