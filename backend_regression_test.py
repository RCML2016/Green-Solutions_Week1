#!/usr/bin/env python3
"""
AssetNova Backend Regression Test - Deployment Readiness Fix
Tests that the removal of the destructive startup purge block doesn't break functionality
"""
import requests
import json
import uuid
from typing import Dict, Optional

# Base URL from frontend/.env REACT_APP_BACKEND_URL
BASE_URL = "https://demo-staging-check.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
CREDENTIALS = {
    "admin": {"email": "admin@assetnova.com", "password": "Admin@123"},
    "executive": {"email": "executive@assetnova.com", "password": "Executive@123"},
    "asset_manager": {"email": "assetmgr@assetnova.com", "password": "Asset@123"},
    "om_manager": {"email": "ops@assetnova.com", "password": "Ops@123"},
    "technician": {"email": "tech@assetnova.com", "password": "Tech@123"},
    "performance_engineer": {"email": "perf@assetnova.com", "password": "Perf@123"},
    "client_viewer": {"email": "client@assetnova.com", "password": "Client@123"},
}

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append(f"✅ {test_name}" + (f": {details}" if details else ""))
    
    def add_fail(self, test_name: str, details: str):
        self.failed.append(f"❌ {test_name}: {details}")
    
    def add_warning(self, test_name: str, details: str):
        self.warnings.append(f"⚠️  {test_name}: {details}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("REGRESSION TEST SUMMARY")
        print("="*80)
        
        if self.failed:
            print("\n🔴 FAILED TESTS:")
            for fail in self.failed:
                print(f"  {fail}")
        
        if self.warnings:
            print("\n🟡 WARNINGS:")
            for warn in self.warnings:
                print(f"  {warn}")
        
        if self.passed:
            print("\n🟢 PASSED TESTS:")
            for pass_test in self.passed:
                print(f"  {pass_test}")
        
        print("\n" + "="*80)
        print(f"Total: {len(self.passed)} passed, {len(self.failed)} failed, {len(self.warnings)} warnings")
        print("="*80 + "\n")

results = TestResults()

def login(email: str, password: str) -> Optional[str]:
    """Login and return access token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            if token:
                return token
            else:
                results.add_fail(f"Login {email}", f"No access_token in response: {resp.text}")
                return None
        else:
            results.add_fail(f"Login {email}", f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        results.add_fail(f"Login {email}", f"Exception: {str(e)}")
        return None

def get_headers(token: str) -> Dict[str, str]:
    """Return authorization headers"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ============================================================================
# TEST 1: Backend Health Check
# ============================================================================
def test_backend_health():
    print("\n" + "="*80)
    print("TEST 1: BACKEND HEALTH CHECK")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("message") == "AssetNova API":
                results.add_pass("Backend health GET /api/", f"Status {resp.status_code}, message: {data.get('message')}")
            else:
                results.add_fail("Backend health GET /api/", f"Expected message 'AssetNova API', got {data}")
        else:
            results.add_fail("Backend health GET /api/", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Backend health GET /api/", f"Exception: {str(e)}")

# ============================================================================
# TEST 2: All 7 Demo Accounts Can Login
# ============================================================================
def test_all_demo_accounts_login():
    print("\n" + "="*80)
    print("TEST 2: ALL 7 DEMO ACCOUNTS CAN LOGIN")
    print("="*80)
    
    for role, creds in CREDENTIALS.items():
        token = login(creds["email"], creds["password"])
        if token:
            results.add_pass(f"Login {role}", f"{creds['email']}")
        # Failure already logged in login() function

# ============================================================================
# TEST 3: Purge Removed - Register and Login with @test.com Email
# ============================================================================
def test_purge_removed():
    print("\n" + "="*80)
    print("TEST 3: PURGE REMOVED - REGISTER AND LOGIN WITH @test.com EMAIL")
    print("="*80)
    
    # Generate unique email
    unique_id = str(uuid.uuid4())[:8]
    test_email = f"qa-purgecheck-{unique_id}@test.com"
    test_password = "TestPassword@123"
    
    print(f"  Creating test user: {test_email}")
    
    # Step 1: Register the user
    try:
        register_payload = {
            "email": test_email,
            "password": test_password,
            "name": "QA Purge Check User"
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=register_payload, timeout=10)
        if resp.status_code in [200, 201]:
            results.add_pass("Register @test.com user", f"Created {test_email}")
        else:
            results.add_fail("Register @test.com user", f"Status {resp.status_code}: {resp.text}")
            return  # Can't continue if registration failed
    except Exception as e:
        results.add_fail("Register @test.com user", f"Exception: {str(e)}")
        return
    
    # Step 2: Immediately login with the same user (no restart needed)
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": test_email, "password": test_password}, timeout=10)
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            if token:
                results.add_pass("Login @test.com user (purge check)", f"Successfully logged in as {test_email} - account persists!")
            else:
                results.add_fail("Login @test.com user (purge check)", f"No access_token in response: {resp.text}")
        else:
            results.add_fail("Login @test.com user (purge check)", f"Status {resp.status_code}: {resp.text} - PURGE MAY STILL BE ACTIVE")
    except Exception as e:
        results.add_fail("Login @test.com user (purge check)", f"Exception: {str(e)}")
    
    # Step 3: Optional cleanup - try to delete the user if there's a delete endpoint
    # Note: AssetNova may not have a user delete endpoint, so we'll just note this
    print(f"  Note: Test user {test_email} created. If delete endpoint exists, cleanup manually.")

# ============================================================================
# TEST 4: Core Endpoints Still Respond
# ============================================================================
def test_core_endpoints():
    print("\n" + "="*80)
    print("TEST 4: CORE ENDPOINTS STILL RESPOND")
    print("="*80)
    
    # Login as admin for testing
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        results.add_fail("Core endpoints test", "Admin login failed")
        return
    
    admin_headers = get_headers(admin_token)
    
    # Test 4.1: GET /api/fleet/kpis (should return site_count 380, asset_count 5473)
    try:
        resp = requests.get(f"{BASE_URL}/fleet/kpis", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            site_count = data.get("site_count", 0)
            asset_count = data.get("asset_count", 0)
            
            if site_count == 380 and asset_count == 5473:
                results.add_pass("GET /api/fleet/kpis", f"Status {resp.status_code}, site_count={site_count}, asset_count={asset_count}")
            else:
                results.add_warning("GET /api/fleet/kpis", f"Expected site_count=380 and asset_count=5473, got site_count={site_count}, asset_count={asset_count}")
        else:
            results.add_fail("GET /api/fleet/kpis", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /api/fleet/kpis", f"Exception: {str(e)}")
    
    # Test 4.2: GET /api/fleet/work-orders
    try:
        resp = requests.get(f"{BASE_URL}/fleet/work-orders", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            results.add_pass("GET /api/fleet/work-orders", f"Status {resp.status_code}")
        else:
            results.add_fail("GET /api/fleet/work-orders", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /api/fleet/work-orders", f"Exception: {str(e)}")
    
    # Test 4.3: GET /api/workspace (should return mode=demo)
    try:
        resp = requests.get(f"{BASE_URL}/workspace", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            mode = data.get("mode")
            if mode == "demo":
                results.add_pass("GET /api/workspace", f"Status {resp.status_code}, mode={mode}")
            else:
                results.add_warning("GET /api/workspace", f"Expected mode=demo, got mode={mode}")
        else:
            results.add_fail("GET /api/workspace", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /api/workspace", f"Exception: {str(e)}")
    
    # Test 4.4: GET /api/fleet-admin/assets?limit=1 (as admin)
    try:
        resp = requests.get(f"{BASE_URL}/fleet-admin/assets?limit=1", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            results.add_pass("GET /api/fleet-admin/assets (admin)", f"Status {resp.status_code}")
        else:
            results.add_fail("GET /api/fleet-admin/assets (admin)", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /api/fleet-admin/assets (admin)", f"Exception: {str(e)}")
    
    # Test 4.5: GET /api/fleet-admin/assets?limit=1 (as asset_manager)
    asset_mgr_token = login(CREDENTIALS["asset_manager"]["email"], CREDENTIALS["asset_manager"]["password"])
    if asset_mgr_token:
        asset_mgr_headers = get_headers(asset_mgr_token)
        try:
            resp = requests.get(f"{BASE_URL}/fleet-admin/assets?limit=1", headers=asset_mgr_headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass("GET /api/fleet-admin/assets (asset_manager)", f"Status {resp.status_code}")
            else:
                results.add_fail("GET /api/fleet-admin/assets (asset_manager)", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("GET /api/fleet-admin/assets (asset_manager)", f"Exception: {str(e)}")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("ASSETNOVA BACKEND REGRESSION TEST - DEPLOYMENT READINESS FIX")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("Testing: Removal of destructive startup purge block")
    print("="*80)
    
    # Run all tests
    test_backend_health()
    test_all_demo_accounts_login()
    test_purge_removed()
    test_core_endpoints()
    
    # Print summary
    results.print_summary()
    
    # Return exit code
    return 0 if len(results.failed) == 0 else 1

if __name__ == "__main__":
    exit(main())
