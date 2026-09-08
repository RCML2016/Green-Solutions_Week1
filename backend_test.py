#!/usr/bin/env python3
"""
AssetNova Backend API Test Suite
Tests Fleet Admin CRUD, Workspace modes, Demo reset, Dashboards, and RBAC
"""
import requests
import json
from typing import Dict, Optional, List

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
        print("TEST SUMMARY")
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

def login(role: str) -> Optional[str]:
    """Login and return access token"""
    creds = CREDENTIALS.get(role)
    if not creds:
        results.add_fail(f"Login {role}", f"No credentials found for role {role}")
        return None
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            if token:
                results.add_pass(f"Login {role}", f"{creds['email']}")
                return token
            else:
                results.add_fail(f"Login {role}", f"No access_token in response: {resp.text}")
                return None
        else:
            results.add_fail(f"Login {role}", f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        results.add_fail(f"Login {role}", f"Exception: {str(e)}")
        return None

def get_headers(token: str) -> Dict[str, str]:
    """Return authorization headers"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ============================================================================
# TASK 1: FLEET ADMIN CRUD
# ============================================================================
def test_fleet_admin_crud():
    print("\n" + "="*80)
    print("TASK 1: FLEET ADMIN CRUD")
    print("="*80)
    
    # Test with admin
    admin_token = login("admin")
    if not admin_token:
        results.add_fail("Fleet Admin CRUD", "Admin login failed")
        return
    
    admin_headers = get_headers(admin_token)
    
    # 1.1: GET /assets?limit=1 (should show total 5473)
    try:
        resp = requests.get(f"{BASE_URL}/fleet-admin/assets?limit=1", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            total = data.get("total", 0)
            if total == 5473:
                results.add_pass("Fleet Admin GET /assets", f"Total assets: {total}")
            else:
                results.add_warning("Fleet Admin GET /assets", f"Expected 5473 assets, got {total}")
        else:
            results.add_fail("Fleet Admin GET /assets", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Fleet Admin GET /assets", f"Exception: {str(e)}")
    
    # 1.2: POST /sites (create test site)
    test_site_id = None
    try:
        site_payload = {
            "site_id": "TEST_SITE_001",
            "site_name": "Test Site for API Testing",
            "site_type": "Utility-Scale Solar",
            "site_capacity_kW": 10500.0,
            "state": "California",
            "latitude": 34.05,
            "longitude": -118.25,
            "cod_date": "2024-01-01",
            "owner_client": "Test Client"
        }
        resp = requests.post(f"{BASE_URL}/fleet-admin/sites", json=site_payload, headers=admin_headers, timeout=10)
        if resp.status_code in [200, 201]:
            test_site_id = resp.json().get("site_id")
            results.add_pass("Fleet Admin POST /sites", f"Created site {test_site_id}")
        else:
            results.add_fail("Fleet Admin POST /sites", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Fleet Admin POST /sites", f"Exception: {str(e)}")
    
    # 1.3: PATCH /sites/{site_id} (update it)
    if test_site_id:
        try:
            update_payload = {"site_capacity_kW": 12000.0, "version": 1}
            resp = requests.patch(f"{BASE_URL}/fleet-admin/sites/{test_site_id}", json=update_payload, headers=admin_headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass("Fleet Admin PATCH /sites", f"Updated site {test_site_id}")
            else:
                results.add_fail("Fleet Admin PATCH /sites", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin PATCH /sites", f"Exception: {str(e)}")
    
    # 1.4: DELETE /sites/{site_id} (soft-delete)
    if test_site_id:
        try:
            resp = requests.delete(f"{BASE_URL}/fleet-admin/sites/{test_site_id}", headers=admin_headers, timeout=10)
            if resp.status_code in [200, 204]:
                results.add_pass("Fleet Admin DELETE /sites", f"Soft-deleted site {test_site_id}")
            else:
                results.add_fail("Fleet Admin DELETE /sites", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin DELETE /sites", f"Exception: {str(e)}")
    
    # 1.5: POST /sites/{site_id}/restore (restore)
    if test_site_id:
        try:
            resp = requests.post(f"{BASE_URL}/fleet-admin/sites/{test_site_id}/restore", headers=admin_headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass("Fleet Admin POST /sites/restore", f"Restored site {test_site_id}")
            else:
                results.add_fail("Fleet Admin POST /sites/restore", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin POST /sites/restore", f"Exception: {str(e)}")
    
    # 1.6: POST /assets (create test asset)
    test_asset_id = None
    try:
        asset_payload = {
            "asset_id": "TEST_ASSET_001",
            "site_id": test_site_id or "SITE_001",
            "asset_type": "Inverter",
            "make": "Test Manufacturer",
            "model": "Test Model",
            "serial_number": "TEST123",
            "nameplate_kW": 100.0,
            "install_date": "2024-01-01",
            "status": "Active"
        }
        resp = requests.post(f"{BASE_URL}/fleet-admin/assets", json=asset_payload, headers=admin_headers, timeout=10)
        if resp.status_code in [200, 201]:
            test_asset_id = resp.json().get("asset_id")
            results.add_pass("Fleet Admin POST /assets", f"Created asset {test_asset_id}")
        else:
            results.add_fail("Fleet Admin POST /assets", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Fleet Admin POST /assets", f"Exception: {str(e)}")
    
    # 1.7: PATCH /assets/{asset_id}
    if test_asset_id:
        try:
            update_payload = {"nameplate_kW": 120.0, "version": 1}
            resp = requests.patch(f"{BASE_URL}/fleet-admin/assets/{test_asset_id}", json=update_payload, headers=admin_headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass("Fleet Admin PATCH /assets", f"Updated asset {test_asset_id}")
            else:
                results.add_fail("Fleet Admin PATCH /assets", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin PATCH /assets", f"Exception: {str(e)}")
    
    # 1.8: DELETE /assets/{asset_id}
    if test_asset_id:
        try:
            resp = requests.delete(f"{BASE_URL}/fleet-admin/assets/{test_asset_id}", headers=admin_headers, timeout=10)
            if resp.status_code in [200, 204]:
                results.add_pass("Fleet Admin DELETE /assets", f"Soft-deleted asset {test_asset_id}")
            else:
                results.add_fail("Fleet Admin DELETE /assets", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin DELETE /assets", f"Exception: {str(e)}")
    
    # 1.9: POST /assets/{asset_id}/restore
    if test_asset_id:
        try:
            resp = requests.post(f"{BASE_URL}/fleet-admin/assets/{test_asset_id}/restore", headers=admin_headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass("Fleet Admin POST /assets/restore", f"Restored asset {test_asset_id}")
            else:
                results.add_fail("Fleet Admin POST /assets/restore", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin POST /assets/restore", f"Exception: {str(e)}")
    
    # 1.10: GET /audit (admin-only)
    try:
        resp = requests.get(f"{BASE_URL}/fleet-admin/audit", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            results.add_pass("Fleet Admin GET /audit (admin)", "Admin can access audit log")
        else:
            results.add_fail("Fleet Admin GET /audit (admin)", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Fleet Admin GET /audit (admin)", f"Exception: {str(e)}")
    
    # 1.11: GET /audit-export (admin-only)
    try:
        resp = requests.get(f"{BASE_URL}/fleet-admin/audit-export", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            results.add_pass("Fleet Admin GET /audit-export (admin)", "Admin can export audit log")
        else:
            results.add_fail("Fleet Admin GET /audit-export (admin)", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Fleet Admin GET /audit-export (admin)", f"Exception: {str(e)}")
    
    # 1.12: Test RBAC - asset_manager should get 403 on /audit
    asset_mgr_token = login("asset_manager")
    if asset_mgr_token:
        asset_mgr_headers = get_headers(asset_mgr_token)
        try:
            resp = requests.get(f"{BASE_URL}/fleet-admin/audit", headers=asset_mgr_headers, timeout=10)
            if resp.status_code == 403:
                results.add_pass("Fleet Admin RBAC /audit", "Asset manager correctly denied (403)")
            else:
                results.add_fail("Fleet Admin RBAC /audit", f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin RBAC /audit", f"Exception: {str(e)}")
    
    # 1.13: Test RBAC - technician should be denied on writes
    tech_token = login("technician")
    if tech_token:
        tech_headers = get_headers(tech_token)
        try:
            site_payload = {
                "site_id": "TEST_SITE_TECH",
                "site_name": "Test Site by Technician",
                "site_type": "Utility-Scale Solar",
                "location": "Test",
                "capacity_mw": 5.0,
                "commissioned_date": "2024-01-01",
                "status": "Operational"
            }
            resp = requests.post(f"{BASE_URL}/fleet-admin/sites", json=site_payload, headers=tech_headers, timeout=10)
            if resp.status_code == 403:
                results.add_pass("Fleet Admin RBAC POST /sites", "Technician correctly denied (403)")
            else:
                results.add_fail("Fleet Admin RBAC POST /sites", f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Fleet Admin RBAC POST /sites", f"Exception: {str(e)}")
    
    # 1.14: Cleanup - permanently delete test data
    if test_asset_id:
        try:
            # First soft-delete if not already deleted
            requests.delete(f"{BASE_URL}/fleet-admin/assets/{test_asset_id}", headers=admin_headers, timeout=10)
            # Then permanently delete
            resp = requests.delete(f"{BASE_URL}/fleet-admin/assets/{test_asset_id}?permanent=true", headers=admin_headers, timeout=10)
            if resp.status_code in [200, 204]:
                results.add_pass("Fleet Admin Cleanup", f"Permanently deleted test asset {test_asset_id}")
        except Exception as e:
            results.add_warning("Fleet Admin Cleanup", f"Could not delete test asset: {str(e)}")
    
    if test_site_id:
        try:
            # First soft-delete if not already deleted
            requests.delete(f"{BASE_URL}/fleet-admin/sites/{test_site_id}", headers=admin_headers, timeout=10)
            # Then permanently delete
            resp = requests.delete(f"{BASE_URL}/fleet-admin/sites/{test_site_id}?permanent=true", headers=admin_headers, timeout=10)
            if resp.status_code in [200, 204]:
                results.add_pass("Fleet Admin Cleanup", f"Permanently deleted test site {test_site_id}")
        except Exception as e:
            results.add_warning("Fleet Admin Cleanup", f"Could not delete test site: {str(e)}")

# ============================================================================
# TASK 2: WORKSPACE MODES + FEATURE FLAGS
# ============================================================================
def test_workspace_modes():
    print("\n" + "="*80)
    print("TASK 2: WORKSPACE MODES + FEATURE FLAGS")
    print("="*80)
    
    admin_token = login("admin")
    if not admin_token:
        results.add_fail("Workspace Modes", "Admin login failed")
        return
    
    admin_headers = get_headers(admin_token)
    
    # 2.1: GET /workspace (any authenticated user)
    try:
        resp = requests.get(f"{BASE_URL}/workspace", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            mode = data.get("mode")
            features = data.get("features")
            data_label = data.get("data_label")
            external_side_effects = data.get("external_side_effects_enabled")
            scenarios = data.get("scenarios")
            
            results.add_pass("Workspace GET /workspace", f"mode={mode}, data_label={data_label}, external_side_effects={external_side_effects}")
            
            if not features:
                results.add_warning("Workspace GET /workspace", "No features map returned")
            if not scenarios:
                results.add_warning("Workspace GET /workspace", "No scenarios returned")
        else:
            results.add_fail("Workspace GET /workspace", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace GET /workspace", f"Exception: {str(e)}")
    
    # 2.2: PATCH /workspace to switch mode to "pilot"
    try:
        resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "pilot", "scenario": "portfolio_overview"}, headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("mode") == "pilot" and data.get("data_label") == "Pilot Data":
                results.add_pass("Workspace PATCH mode=pilot", f"data_label={data.get('data_label')}")
            else:
                results.add_fail("Workspace PATCH mode=pilot", f"Expected mode=pilot and data_label='Pilot Data', got {data}")
        else:
            results.add_fail("Workspace PATCH mode=pilot", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace PATCH mode=pilot", f"Exception: {str(e)}")
    
    # 2.3: PATCH /workspace to switch mode to "production"
    try:
        resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "production", "scenario": "portfolio_overview"}, headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("mode") == "production" and data.get("data_label") == "Live Data":
                results.add_pass("Workspace PATCH mode=production", f"data_label={data.get('data_label')}")
            else:
                results.add_fail("Workspace PATCH mode=production", f"Expected mode=production and data_label='Live Data', got {data}")
            
            # Check external_side_effects_enabled (should be true only if features.external_integrations=true)
            external_enabled = data.get("external_side_effects_enabled")
            features = data.get("features", {})
            external_integrations = features.get("external_integrations", False)
            
            if data.get("mode") == "production" and external_integrations and external_enabled:
                results.add_pass("Workspace external_side_effects", "Correctly enabled in production with external_integrations=true")
            elif data.get("mode") == "production" and not external_integrations and not external_enabled:
                results.add_pass("Workspace external_side_effects", "Correctly disabled (external_integrations=false)")
            else:
                results.add_warning("Workspace external_side_effects", f"mode={data.get('mode')}, external_integrations={external_integrations}, external_side_effects_enabled={external_enabled}")
        else:
            results.add_fail("Workspace PATCH mode=production", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace PATCH mode=production", f"Exception: {str(e)}")
    
    # 2.4: Toggle a feature flag off (e.g. reports:false)
    try:
        resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "production", "scenario": "portfolio_overview", "features": {"reports": False}}, headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("features", {}).get("reports") == False:
                results.add_pass("Workspace toggle feature flag", "reports=false persisted")
            else:
                results.add_fail("Workspace toggle feature flag", f"Expected reports=false, got {data.get('features')}")
        else:
            results.add_fail("Workspace toggle feature flag", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace toggle feature flag", f"Exception: {str(e)}")
    
    # 2.5: Verify feature flag persists on GET
    try:
        resp = requests.get(f"{BASE_URL}/workspace", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("features", {}).get("reports") == False:
                results.add_pass("Workspace feature flag persistence", "reports=false persisted on GET")
            else:
                results.add_warning("Workspace feature flag persistence", f"Expected reports=false, got {data.get('features')}")
        else:
            results.add_fail("Workspace feature flag persistence", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace feature flag persistence", f"Exception: {str(e)}")
    
    # 2.6: Send unknown feature flag (should get 422)
    try:
        resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "production", "scenario": "portfolio_overview", "features": {"unknown_feature": True}}, headers=admin_headers, timeout=10)
        if resp.status_code == 422:
            results.add_pass("Workspace unknown feature flag", "Correctly rejected with 422")
        else:
            results.add_fail("Workspace unknown feature flag", f"Expected 422, got {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace unknown feature flag", f"Exception: {str(e)}")
    
    # 2.7: Test RBAC - asset_manager should be denied PATCH
    asset_mgr_token = login("asset_manager")
    if asset_mgr_token:
        asset_mgr_headers = get_headers(asset_mgr_token)
        try:
            resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "demo", "scenario": "portfolio_overview"}, headers=asset_mgr_headers, timeout=10)
            if resp.status_code == 403:
                results.add_pass("Workspace RBAC PATCH", "Asset manager correctly denied (403)")
            else:
                results.add_fail("Workspace RBAC PATCH", f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Workspace RBAC PATCH", f"Exception: {str(e)}")
    
    # 2.8: Test RBAC - executive should be denied PATCH
    exec_token = login("executive")
    if exec_token:
        exec_headers = get_headers(exec_token)
        try:
            resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "demo", "scenario": "portfolio_overview"}, headers=exec_headers, timeout=10)
            if resp.status_code == 403:
                results.add_pass("Workspace RBAC PATCH", "Executive correctly denied (403)")
            else:
                results.add_fail("Workspace RBAC PATCH", f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Workspace RBAC PATCH", f"Exception: {str(e)}")
    
    # 2.9: IMPORTANT - Reset workspace to demo mode with default features
    try:
        default_features = {
            "overview": True,
            "portfolio": True,
            "assets": True,
            "ai": True,
            "operations": True,
            "work_orders": True,
            "reports": True,
            "administration": True,
            "evidence_upload": True,
            "notifications": False,
            "external_integrations": False,
            "my_work": True,
            "performance": True,
            "client_portal": True
        }
        resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "demo", "scenario": "portfolio_overview", "features": default_features}, headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("mode") == "demo":
                results.add_pass("Workspace reset to demo", "Successfully reset to mode=demo with default features")
            else:
                results.add_fail("Workspace reset to demo", f"Expected mode=demo, got {data}")
        else:
            results.add_fail("Workspace reset to demo", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Workspace reset to demo", f"Exception: {str(e)}")

# ============================================================================
# TASK 3: DEMO RESET
# ============================================================================
def test_demo_reset():
    print("\n" + "="*80)
    print("TASK 3: DEMO RESET")
    print("="*80)
    
    admin_token = login("admin")
    if not admin_token:
        results.add_fail("Demo Reset", "Admin login failed")
        return
    
    admin_headers = get_headers(admin_token)
    
    # 3.1: Ensure mode is demo
    try:
        resp = requests.get(f"{BASE_URL}/workspace", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            mode = resp.json().get("mode")
            if mode != "demo":
                # Switch to demo first
                requests.patch(f"{BASE_URL}/workspace", json={"mode": "demo", "scenario": "portfolio_overview"}, headers=admin_headers, timeout=10)
                results.add_warning("Demo Reset", "Switched workspace to demo mode first")
        else:
            results.add_fail("Demo Reset", f"Could not get workspace: {resp.status_code}")
    except Exception as e:
        results.add_fail("Demo Reset", f"Exception checking mode: {str(e)}")
    
    # 3.2: POST /workspace/reset-demo as admin
    try:
        resp = requests.post(f"{BASE_URL}/workspace/reset-demo", headers=admin_headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            counts = data.get("counts", {})
            fleet_sites = counts.get("fleet_sites", 0)
            fleet_assets = counts.get("fleet_assets", 0)
            
            if fleet_sites == 380 and fleet_assets == 5473:
                results.add_pass("Demo Reset POST /reset-demo", f"Restored baseline: {fleet_sites} sites, {fleet_assets} assets")
            else:
                results.add_warning("Demo Reset POST /reset-demo", f"Expected 380 sites and 5473 assets, got {fleet_sites} sites and {fleet_assets} assets")
        else:
            results.add_fail("Demo Reset POST /reset-demo", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Demo Reset POST /reset-demo", f"Exception: {str(e)}")
    
    # 3.3: Test RBAC - non-admin should get 403
    tech_token = login("technician")
    if tech_token:
        tech_headers = get_headers(tech_token)
        try:
            resp = requests.post(f"{BASE_URL}/workspace/reset-demo", headers=tech_headers, timeout=10)
            if resp.status_code == 403:
                results.add_pass("Demo Reset RBAC", "Technician correctly denied (403)")
            else:
                results.add_fail("Demo Reset RBAC", f"Expected 403, got {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("Demo Reset RBAC", f"Exception: {str(e)}")
    
    # 3.4: Test 409 when mode != demo (switch to pilot first)
    try:
        # Switch to pilot
        resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "pilot", "scenario": "portfolio_overview"}, headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            # Try reset-demo (should get 409)
            resp = requests.post(f"{BASE_URL}/workspace/reset-demo", headers=admin_headers, timeout=10)
            if resp.status_code == 409:
                results.add_pass("Demo Reset 409 check", "Correctly returns 409 when mode != demo")
            else:
                results.add_fail("Demo Reset 409 check", f"Expected 409, got {resp.status_code}: {resp.text}")
            
            # Switch back to demo
            requests.patch(f"{BASE_URL}/workspace", json={"mode": "demo", "scenario": "portfolio_overview"}, headers=admin_headers, timeout=10)
        else:
            results.add_warning("Demo Reset 409 check", "Could not switch to pilot mode for testing")
    except Exception as e:
        results.add_fail("Demo Reset 409 check", f"Exception: {str(e)}")
    
    # 3.5: Re-run reset to leave data intact
    try:
        resp = requests.post(f"{BASE_URL}/workspace/reset-demo", headers=admin_headers, timeout=30)
        if resp.status_code == 200:
            results.add_pass("Demo Reset final", "Re-ran reset to ensure baseline is intact")
        else:
            results.add_warning("Demo Reset final", f"Could not re-run reset: {resp.status_code}")
    except Exception as e:
        results.add_warning("Demo Reset final", f"Exception: {str(e)}")

# ============================================================================
# TASK 4: EXISTING DASHBOARDS REGRESSION
# ============================================================================
def test_dashboards_regression():
    print("\n" + "="*80)
    print("TASK 4: EXISTING DASHBOARDS REGRESSION")
    print("="*80)
    
    admin_token = login("admin")
    if not admin_token:
        results.add_fail("Dashboards Regression", "Admin login failed")
        return
    
    admin_headers = get_headers(admin_token)
    
    # Test all fleet endpoints
    endpoints = [
        "/fleet/kpis",
        "/fleet/categories",
        "/fleet/sites",
        "/fleet/alarms",
        "/fleet/work-orders"
    ]
    
    for endpoint in endpoints:
        try:
            resp = requests.get(f"{BASE_URL}{endpoint}", headers=admin_headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass(f"Dashboard {endpoint}", "OK")
            else:
                results.add_fail(f"Dashboard {endpoint}", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail(f"Dashboard {endpoint}", f"Exception: {str(e)}")
    
    # Test /fleet/performance/trend with a site_id
    try:
        # Get a site_id first
        resp = requests.get(f"{BASE_URL}/fleet/sites?limit=1", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            sites = resp.json().get("items", [])
            if sites:
                site_id = sites[0].get("site_id")
                resp = requests.get(f"{BASE_URL}/fleet/performance/trend?site_id={site_id}", headers=admin_headers, timeout=10)
                if resp.status_code == 200:
                    results.add_pass("Dashboard /fleet/performance/trend", "OK")
                else:
                    results.add_fail("Dashboard /fleet/performance/trend", f"Status {resp.status_code}: {resp.text}")
            else:
                results.add_warning("Dashboard /fleet/performance/trend", "No sites available to test")
        else:
            results.add_warning("Dashboard /fleet/performance/trend", "Could not get sites list")
    except Exception as e:
        results.add_fail("Dashboard /fleet/performance/trend", f"Exception: {str(e)}")
    
    # Check /fleet/kpis specifically for expected counts
    try:
        resp = requests.get(f"{BASE_URL}/fleet/kpis", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            site_count = data.get("site_count", 0)
            asset_count = data.get("asset_count", 0)
            
            if site_count == 380 and asset_count == 5473:
                results.add_pass("Dashboard /fleet/kpis counts", f"{site_count} sites, {asset_count} assets")
            else:
                results.add_warning("Dashboard /fleet/kpis counts", f"Expected 380 sites and 5473 assets, got {site_count} sites and {asset_count} assets")
    except Exception as e:
        results.add_fail("Dashboard /fleet/kpis counts", f"Exception: {str(e)}")
    
    # Test AI endpoint if present
    try:
        resp = requests.get(f"{BASE_URL}/ai/sessions", headers=admin_headers, timeout=10)
        if resp.status_code == 200:
            results.add_pass("Dashboard /ai/sessions", "OK")
        elif resp.status_code == 404:
            results.add_warning("Dashboard /ai/sessions", "Endpoint not found (404)")
        else:
            results.add_fail("Dashboard /ai/sessions", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Dashboard /ai/sessions", f"Exception: {str(e)}")

# ============================================================================
# TASK 5: ROLE-BASED ACCESS
# ============================================================================
def test_role_based_access():
    print("\n" + "="*80)
    print("TASK 5: ROLE-BASED ACCESS FOR ALL DEMO USERS")
    print("="*80)
    
    # Test each role can login and access basic endpoints
    roles = ["admin", "executive", "asset_manager", "om_manager", "technician", "performance_engineer", "client_viewer"]
    
    for role in roles:
        token = login(role)
        if not token:
            continue
        
        headers = get_headers(token)
        
        # Test basic fleet endpoint access
        try:
            resp = requests.get(f"{BASE_URL}/fleet/kpis", headers=headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass(f"RBAC {role} /fleet/kpis", "Can access")
            else:
                results.add_fail(f"RBAC {role} /fleet/kpis", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail(f"RBAC {role} /fleet/kpis", f"Exception: {str(e)}")
        
        # Test workspace GET (all authenticated users should access)
        try:
            resp = requests.get(f"{BASE_URL}/workspace", headers=headers, timeout=10)
            if resp.status_code == 200:
                results.add_pass(f"RBAC {role} /workspace GET", "Can access")
            else:
                results.add_fail(f"RBAC {role} /workspace GET", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail(f"RBAC {role} /workspace GET", f"Exception: {str(e)}")
        
        # Test fleet-admin write access (only admin and asset_manager should succeed)
        if role in ["admin", "asset_manager"]:
            try:
                resp = requests.get(f"{BASE_URL}/fleet-admin/assets?limit=1", headers=headers, timeout=10)
                if resp.status_code == 200:
                    results.add_pass(f"RBAC {role} fleet-admin read", "Can access")
                else:
                    results.add_fail(f"RBAC {role} fleet-admin read", f"Status {resp.status_code}: {resp.text}")
            except Exception as e:
                results.add_fail(f"RBAC {role} fleet-admin read", f"Exception: {str(e)}")
        else:
            # Note: GET /fleet-admin/assets is actually open to all authenticated users
            # Only writes (POST/PATCH/DELETE) require admin/asset_manager
            # So we test write access instead
            try:
                site_payload = {
                    "site_id": f"TEST_{role.upper()}",
                    "site_name": "Test Site",
                    "site_type": "Solar",
                    "site_capacity_kW": 1000.0,
                    "state": "CA"
                }
                resp = requests.post(f"{BASE_URL}/fleet-admin/sites", json=site_payload, headers=headers, timeout=10)
                if resp.status_code == 403:
                    results.add_pass(f"RBAC {role} fleet-admin write denied", "Correctly denied (403)")
                elif resp.status_code in [200, 201]:
                    results.add_fail(f"RBAC {role} fleet-admin write denied", f"Should be denied but got {resp.status_code}")
                else:
                    results.add_warning(f"RBAC {role} fleet-admin write denied", f"Got {resp.status_code} instead of 403")
            except Exception as e:
                results.add_fail(f"RBAC {role} fleet-admin write denied", f"Exception: {str(e)}")
        
        # Test workspace PATCH (only admin should succeed)
        if role == "admin":
            # Already tested in task 2
            pass
        else:
            try:
                resp = requests.patch(f"{BASE_URL}/workspace", json={"mode": "demo", "scenario": "portfolio_overview"}, headers=headers, timeout=10)
                if resp.status_code == 403:
                    results.add_pass(f"RBAC {role} workspace PATCH denied", "Correctly denied (403)")
                elif resp.status_code == 200:
                    results.add_fail(f"RBAC {role} workspace PATCH denied", f"Should be denied but got 200")
                else:
                    results.add_warning(f"RBAC {role} workspace PATCH denied", f"Got {resp.status_code} instead of 403")
            except Exception as e:
                results.add_fail(f"RBAC {role} workspace PATCH denied", f"Exception: {str(e)}")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("ASSETNOVA BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Run all tests
    test_fleet_admin_crud()
    test_workspace_modes()
    test_demo_reset()
    test_dashboards_regression()
    test_role_based_access()
    
    # Print summary
    results.print_summary()
    
    # Return exit code
    return 0 if len(results.failed) == 0 else 1

if __name__ == "__main__":
    exit(main())
