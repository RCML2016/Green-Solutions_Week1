"""Fast, database-free validation coverage for Fleet Admin payloads/imports."""
import io

import pytest

from routers.fleet_admin import AssetWrite, SitePatch, SiteWrite, uploaded_rows


def test_site_payload_accepts_valid_coordinates():
    site = SiteWrite(site_id="TX-101", site_name="Prosper Solar", site_type="Utility-Scale Solar",
                     site_capacity_kW=1200, state="TX", latitude=33.2, longitude=-96.8)
    assert site.site_capacity_kW == 1200


def test_site_payload_rejects_invalid_coordinates():
    with pytest.raises(ValueError):
        SiteWrite(site_id="TX-101", site_name="Prosper Solar", site_type="Solar",
                  site_capacity_kW=1200, state="TX", latitude=100)


def test_asset_requires_valid_identifier_and_positive_capacity():
    with pytest.raises(ValueError):
        AssetWrite(asset_id="bad id", site_id="TX-101", asset_type="Inverter", nameplate_kW=-1)


def test_patch_requires_optimistic_lock_version():
    with pytest.raises(ValueError):
        SitePatch(site_name="Changed")


def test_csv_parser_handles_utf8_bom():
    rows = uploaded_rows("\ufeffsite_id,site_name\nTX-1,North\n".encode(), "sites.csv")
    assert rows == [{"site_id": "TX-1", "site_name": "North"}]


def test_xlsx_parser_uses_first_sheet():
    import openpyxl
    book = openpyxl.Workbook(); sheet = book.active
    sheet.append(["asset_id", "site_id"]); sheet.append(["INV-1", "TX-1"])
    stream = io.BytesIO(); book.save(stream)
    assert uploaded_rows(stream.getvalue(), "assets.xlsx") == [{"asset_id": "INV-1", "site_id": "TX-1"}]
