# AssetNova Platform — Product Knowledge Base
### Renewable Asset Intelligence — AI Reporting & Compliance Copilot for O&M Operators

> **Note:** This is a starter draft built to give the knowledge base a working structure. Product codes follow a proposed naming convention (below) rather than an existing catalog — swap in your real SKUs, module names, and pricing tiers as they're finalized. Regulatory references are the standards/authorities most commonly cited for each asset class in the US market; always confirm current versions and any state-specific rules with counsel/compliance before publishing to customers.

## Product Code Naming Convention

`AN-[ASSET]-[FUNCTION]-[NUMBER]`

**Segment Values**
- **ASSET**: SOL (Solar), WND (Wind), BESS (Storage), HYB (Hybrid/Microgrid), EVC (EV Charging), CORE (Cross-cutting platform)
- **FUNCTION**: MON (Monitoring), CMP (Compliance), RPT (Reporting), WO (Work Order/Field Ops), SAFE (Safety), FIN (Financial/Performance)
- **NUMBER**: Sequential ID within the family

---

## 1. Solar PV Asset Management

### 1.1 Products / Modules

| Code | Module Name | Description |
|---|---|---|
| AN-SOL-MON-101 | SolarPulse Monitoring | Real-time inverter, string, and combiner-box telemetry ingestion with anomaly detection |
| AN-SOL-WO-102 | Field Work Order Assistant (Solar) | Auto-drafts corrective/preventive maintenance work orders from ticket + telemetry data |
| AN-SOL-RPT-103 | Owner Performance Reporting | Auto-generates monthly/quarterly performance reports (PR, availability, degradation) for asset owners |
| AN-SOL-CMP-104 | Interconnection Compliance Tracker | Tracks utility interconnection agreement terms, curtailment events, and reporting deadlines |
| AN-SOL-SAFE-105 | NEC Article 690/705 Safety Checklist Generator | Generates site-specific electrical safety checklists for PV installations and rapid-shutdown compliance |
| AN-SOL-FIN-106 | PPA/Incentive Compliance Copilot | Tracks Power Purchase Agreement milestones, ITC/depreciation documentation, and RPS/REC reporting |

### 1.2 Regulatory & Standards References

- NEC (National Electrical Code) Article 690 — Solar Photovoltaic Systems; Article 705 — Interconnected Electric Power Production Sources
- IEEE 1547 — Standard for Interconnection and Interoperability of Distributed Energy Resources
- UL 1741 / UL 1703 — Inverter and PV module safety standards
- IEC 61215 / IEC 61730 — PV module design qualification and safety
- IEC 62446 — Grid-connected PV system documentation, commissioning tests, and inspection
- OSHA 1910.269 / 1926 Subpart V — Electrical safety for construction and O&M work
- NABCEP — PV Installation Professional certification standards (often referenced for technician qualification)
- FERC Order 2222 / state interconnection standards — DER market participation and interconnection procedures
- State Renewable Portfolio Standard (RPS) / REC reporting rules — vary by state; check each jurisdiction's PUC

### 1.3 Suggested Reference Reading

- NABCEP.org — certification standards and technician requirements
- NFPA.org — NEC code text and interpretive guides
- IEEE Standards Association — IEEE 1547 series documentation
- Your state Public Utility Commission (PUC) interconnection handbook

---

## 2. Wind Asset Management

### 2.1 Products / Modules

| Code | Module Name | Description |
|---|---|---|
| AN-WND-MON-201 | TurbinePulse Monitoring | SCADA data ingestion, vibration/gearbox anomaly detection, curtailment event logging |
| AN-WND-WO-202 | Field Work Order Assistant (Wind) | Drafts blade inspection, gearbox, and nacelle maintenance work orders with parts/labor estimates |
| AN-WND-RPT-203 | Owner Performance Reporting (Wind) | Availability, capacity factor, and downtime-cause reporting for turbine owners |
| AN-WND-CMP-204 | Avian/Environmental Compliance Tracker | Logs bird/bat mortality monitoring events and curtailment-for-wildlife compliance windows |
| AN-WND-SAFE-205 | Tower Climb & Rescue Safety Log | Tracks technician certifications, fall-protection equipment inspections, and confined-space entries |
| AN-WND-FIN-206 | PTC/REC Compliance Copilot | Tracks Production Tax Credit qualification data and REC generation reporting |

### 2.2 Regulatory & Standards References

- IEC 61400 series — Wind turbine design, safety, and testing requirements (61400-1 design, 61400-12 power performance, 61400-13 blade fatigue)
- OSHA 1910.269 / 1926 Subpart V — Electrical and fall-protection safety for wind technicians
- ANSI/ASSP Z359 — Fall protection code (relevant to tower climbing)
- FAA Advisory Circular 70/7460-1 — Obstruction marking/lighting for turbines near flight paths
- Migratory Bird Treaty Act (MBTA) / Bald and Golden Eagle Protection Act — wildlife take and curtailment compliance
- U.S. Fish & Wildlife Service Land-Based Wind Energy Guidelines — siting and monitoring best practices
- NERC Reliability Standards (PRC, VAR series) — for wind generation interconnected to bulk power system
- State decommissioning/bonding requirements — vary by state for wind farm end-of-life

### 2.3 Suggested Reference Reading

- IEC Webstore — 61400 series standards
- FWS.gov — Land-Based Wind Energy Guidelines
- NERC.com — Reliability Standards library
- OSHA.gov — wind turbine safety guidance pages

---

## 3. Battery Energy Storage Systems (BESS)

### 3.1 Products / Modules

| Code | Module Name | Description |
|---|---|---|
| AN-BESS-MON-301 | StoragePulse Monitoring | Cell/rack-level SOC, SOH, thermal event, and BMS alarm ingestion |
| AN-BESS-WO-302 | Field Work Order Assistant (BESS) | Drafts maintenance/inspection work orders including thermal management and fire-suppression checks |
| AN-BESS-SAFE-303 | Fire & Thermal Runaway Compliance Log | Tracks NFPA 855 clearance, ventilation, and suppression system inspection compliance |
| AN-BESS-CMP-304 | UL 9540A Documentation Tracker | Manages large-scale fire test documentation and AHJ (Authority Having Jurisdiction) submittals |
| AN-BESS-RPT-305 | Owner Performance & Degradation Reporting | Round-trip efficiency, cycle count, and capacity fade reporting for storage asset owners |
| AN-BESS-FIN-306 | ITC/Storage Incentive Compliance Copilot | Tracks standalone storage ITC eligibility documentation and state storage incentive filings |

### 3.2 Regulatory & Standards References

- NFPA 855 — Standard for the Installation of Stationary Energy Storage Systems (fire/life safety)
- UL 9540 — Safety standard for Energy Storage Systems and Equipment
- UL 9540A — Test method for evaluating thermal runaway fire propagation
- UL 1973 — Batteries for use in stationary applications
- IEEE 1547 / IEEE 2030.2 — Interconnection and interoperability for DER including storage
- NEC Article 706 — Energy Storage Systems
- OSHA 1910.147 / general industry standards — lockout/tagout and hazardous energy control during BESS servicing
- Local Fire Code / AHJ requirements — often layered on top of NFPA 855, varies by municipality
- State-level BESS siting and safety regulations — several states (CA, NY, MA, etc.) have adopted supplemental BESS safety rules post high-profile incidents

### 3.3 Suggested Reference Reading

- NFPA.org — NFPA 855 standard text and FAQs
- UL.com — UL 9540/9540A test methodology overviews
- Your state Energy Storage Safety guidance (e.g., CPUC, NY DPS bulletins)
- Local AHJ/fire marshal permitting requirements

---

## 4. Hybrid, Microgrid & Emerging Asset Classes

### 4.1 Products / Modules

| Code | Module Name | Description |
|---|---|---|
| AN-HYB-MON-401 | HybridPulse Monitoring | Unified monitoring across co-located solar+storage or wind+storage sites, including dispatch logic tracking |
| AN-HYB-CMP-402 | Microgrid Interconnection Compliance | Tracks islanding/anti-islanding test compliance and microgrid controller certification |
| AN-EVC-MON-403 | EV Charging Fleet Monitoring | Uptime, utilization, and fault monitoring for Level 2/DCFC charging assets co-located with generation |
| AN-EVC-CMP-404 | NEVI/State EV Program Compliance Tracker | Tracks National Electric Vehicle Infrastructure (NEVI) or state EV incentive program reporting requirements |
| AN-HYB-RPT-405 | Multi-Asset Owner Reporting | Consolidated performance reporting across mixed generation + storage + EV portfolios |
| AN-CORE-CMP-406 | Cybersecurity & NERC CIP Compliance Copilot | Tracks NERC CIP control evidence, access logs, and patching cadence for interconnected assets |

### 4.2 Regulatory & Standards References

- IEEE 1547.4 — Interconnection guidelines for intentional islanding of DER with electric power systems (microgrids)
- UL 3001 — Standard for microgrid interconnection equipment
- NEC Article 710/712 — Stand-alone and DC microgrid systems
- NEVI Formula Program (FHWA/DOE) — federal EV charging infrastructure funding requirements
- SAE J1772 / ISO 15118 — EV charging connector and communication standards
- NERC CIP-002 through CIP-014 — Critical Infrastructure Protection standards for bulk electric system cybersecurity and physical security
- FERC Order 841 / 2222 — storage and DER participation in wholesale markets
- EPA regulations — end-of-life battery recycling/disposal (varies; RCRA hazardous waste rules may apply)

### 4.3 Suggested Reference Reading

- NERC.com — CIP standards library
- DOE.gov / FHWA NEVI program guidance
- IEEE Standards Association — 1547 family
- EPA.gov — battery stewardship and RCRA guidance

---

## 5. Cross-Cutting Platform Modules

These apply across all asset classes and are typically bundled into every AssetNova deployment.

| Code | Module Name | Description |
|---|---|---|
| AN-CORE-MON-501 | Unified Asset Health Dashboard | Cross-fleet KPI rollup regardless of asset type |
| AN-CORE-WO-502 | AI Work Order Drafting Engine | Shared LLM-based drafting engine underlying all asset-specific work order modules |
| AN-CORE-RPT-503 | Automated Compliance Report Generator | Templated regulatory/compliance report generation (LangGraph + FastMCP pipeline) |
| AN-CORE-CMP-504 | Data Retention & Audit Trail | Immutable audit logging for compliance evidence (supports NERC CIP, UL, and insurance audits) |
| AN-CORE-SAFE-505 | Technician Certification Tracker | Cross-asset tracking of OSHA, NABCEP, confined-space, and fall-protection certifications |

---

## Disclaimer

This document is a working knowledge-base draft generated to accelerate structuring the AssetNova catalog. Regulatory citations reflect widely recognized U.S. standards as of the platform's design phase — always verify current edition numbers, state-specific overlays, and AHJ interpretations before using this content in customer-facing compliance materials.
