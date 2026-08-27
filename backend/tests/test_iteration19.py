"""Iteration 19 — download endpoint auth gating + QA Tracker API (admin-only)."""
import os

import pytest
import requests

DOWNLOAD_PATHS = [
    "/download/team-credentials",
    "/download/workflows-pdf",
    "/download/test-cases-xlsx",
    "/download/source",
]


@pytest.fixture(scope="module")
def exec_headers(api):
    r = requests.post(f"{api}/auth/login",
                      json={"email": "executive@assetnova.com", "password": "Executive@123"},
                      timeout=30)
    if r.status_code != 200:
        pytest.fail(f"executive login failed {r.status_code}: {r.text[:300]}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --- Downloads: unauthenticated must be rejected ---
@pytest.mark.parametrize("path", DOWNLOAD_PATHS)
def test_download_requires_auth(api, path):
    r = requests.get(f"{api}{path}", timeout=60)
    assert r.status_code in (401, 403), f"{path} -> {r.status_code} body={r.text[:200]}"


# --- Downloads: non-admin must get 403 ---
@pytest.mark.parametrize("path", DOWNLOAD_PATHS)
def test_download_forbidden_for_executive(api, path, exec_headers):
    r = requests.get(f"{api}{path}", headers=exec_headers, timeout=60)
    assert r.status_code == 403, f"{path} -> {r.status_code} body={r.text[:200]}"


# --- Downloads: admin gets the file with right content-type + signature ---
@pytest.mark.parametrize("path,ctype,sig", [
    ("/download/team-credentials", "text/csv", None),
    ("/download/workflows-pdf", "application/pdf", b"%PDF"),
    ("/download/test-cases-xlsx",
     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b"PK"),
    ("/download/source", "application/zip", b"PK"),
])
def test_download_admin_ok(api, admin_headers, path, ctype, sig):
    r = requests.get(f"{api}{path}", headers=admin_headers, timeout=120)
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
    assert ctype in r.headers.get("content-type", "")
    assert len(r.content) > 100
    if sig:
        assert r.content.startswith(sig), f"{path} bad signature {r.content[:8]!r}"
    cd = r.headers.get("content-disposition", "")
    assert "filename" in cd


# --- Startup artefact regeneration ---
def test_artifacts_exist_on_disk():
    for f in ["/app/downloads/assetnova-user-workflows.pdf",
              "/app/downloads/assetnova-manual-test-cases.xlsx"]:
        assert os.path.exists(f), f"missing {f}"
        assert os.path.getsize(f) > 1000


# --- QA API ---
def test_qa_test_cases_requires_auth(api):
    r = requests.get(f"{api}/qa/test-cases", timeout=30)
    assert r.status_code in (401, 403)


def test_qa_endpoints_forbidden_for_executive(api, exec_headers):
    for path in ["/qa/test-cases", "/qa/summary"]:
        r = requests.get(f"{api}{path}", headers=exec_headers, timeout=30)
        assert r.status_code == 403, f"{path} -> {r.status_code}"
    r = requests.post(f"{api}/qa/results", headers=exec_headers,
                      json={"test_id": "TC001", "status": "Passed"}, timeout=30)
    assert r.status_code == 403


def test_qa_test_cases_shape(api, admin_headers):
    r = requests.get(f"{api}/qa/test-cases", headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "count" in d and "test_cases" in d
    assert d["count"] == len(d["test_cases"])
    assert d["count"] >= 30, f"only {d['count']} test cases"
    keys = {"id", "role", "feature", "title", "prio", "pre", "steps",
            "expected", "status", "notes", "last_run_at", "last_run_by"}
    for c in d["test_cases"][:5]:
        missing = keys - set(c)
        assert not missing, f"missing keys {missing} in {c.get('id')}"
    assert "_id" not in d["test_cases"][0]


def test_qa_result_invalid_status(api, admin_headers):
    r = requests.post(f"{api}/qa/results", headers=admin_headers,
                      json={"test_id": "TC002", "status": "Foo"}, timeout=30)
    assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"


def test_qa_result_records_and_summary_updates(api, admin_headers):
    before = requests.get(f"{api}/qa/summary", headers=admin_headers, timeout=60).json()
    r = requests.post(f"{api}/qa/results", headers=admin_headers,
                      json={"test_id": "TC002", "status": "Failed", "notes": "TEST_demo"},
                      timeout=30)
    assert r.status_code == 200, r.text[:300]
    run = r.json()["run"]
    assert run["status"] == "Failed" and run["test_id"] == "TC002"
    assert run["notes"] == "TEST_demo"
    assert "_id" not in run

    cases = requests.get(f"{api}/qa/test-cases", headers=admin_headers, timeout=60).json()["test_cases"]
    tc = next(c for c in cases if c["id"] == "TC002")
    assert tc["status"] == "Failed"
    assert tc["notes"] == "TEST_demo"
    assert tc["last_run_at"] and tc["last_run_by"]

    after = requests.get(f"{api}/qa/summary", headers=admin_headers, timeout=60).json()
    assert after["total"] == before["total"]
    assert after["counts"]["Failed"] >= 1
    assert isinstance(after["pass_rate_pct"], (int, float))
    assert sum(after["counts"].values()) == after["total"]

    # now flip to Passed and verify pass_rate increases
    requests.post(f"{api}/qa/results", headers=admin_headers,
                  json={"test_id": "TC002", "status": "Passed", "notes": "TEST_pass"}, timeout=30)
    after2 = requests.get(f"{api}/qa/summary", headers=admin_headers, timeout=60).json()
    assert after2["pass_rate_pct"] > after["pass_rate_pct"]
    assert after2["counts"]["Passed"] == after["counts"]["Passed"] + 1

    # reset to Not Run to leave state clean
    requests.post(f"{api}/qa/results", headers=admin_headers,
                  json={"test_id": "TC002", "status": "Not Run", "notes": ""}, timeout=30)
