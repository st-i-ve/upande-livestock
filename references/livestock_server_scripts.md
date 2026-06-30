# Westwood Dairies — Livestock Module: Server Scripts Reference

**Site:** `upande-kaitet2.c.frappe.cloud`  
**Company:** Westwood Dairies Ltd (WDL)  
**Currency:** KES  
**Last updated:** 2026-05-22  

This document contains every server-side automation script that backs the livestock module.  
Your front-end app talks to Frappe via `frappe.client.*` REST calls — it creates and submits documents, and these scripts fire automatically. You do not call them directly.

---

## Table of contents

1. [Sandbox rules — what the scripts cannot use](#1-sandbox-rules)
2. [Livestock Settings — master config](#2-livestock-settings)
3. [Script 1 — Animal Event (After Submit)](#3-script-1-animal-event)
4. [Script 2 — Milk Recording (After Submit)](#4-script-2-milk-recording)
5. [Script 3 — Animal Disposal (After Submit)](#5-script-3-animal-disposal)
6. [Script 4 — Animal Capitalisation JE (After Submit)](#6-script-4-animal-capitalisation)
7. [Script 5 — Weight History Backfill (API)](#7-script-5-backfill-api)
8. [Front-end integration guide](#8-front-end-integration-guide)
9. [Event type field map](#9-event-type-field-map)
10. [DocType schemas (fields your app must send)](#10-doctype-schemas)
11. [Accounts & cost centres reference](#11-accounts-and-cost-centres)
12. [Known disabled / retired scripts](#12-disabled-scripts)

---

## 1. Sandbox rules

Frappe server scripts run in a **restricted Python sandbox**. Every script in this module was written to comply. When extending them, keep these rules:

| Rule | Detail |
|------|--------|
| No `import` or `from X import Y` | Blocked unconditionally |
| No `str.format()` | `format` is an unsafe attribute — use `+` concatenation |
| No f-strings `f"..."` | Blocked |
| No `getattr()` | Blocked — access attributes directly |
| No `def` function definitions | Blocked — write all logic inline |
| No augmented assignment on dict/list items (`d[k] += v`) | Use `d[k] = d[k] + v` |
| No `frappe.db.commit()` | Blocked — Frappe auto-commits after the script |
| No raw `INSERT` SQL | Use `row_doc.db_insert()` for child table rows |
| `doc` is pre-injected | Do **not** re-fetch with `frappe.get_doc(...)` at top |
| Use `frappe.db.set_value()` to update submitted Animals | `animal.save()` raises on submitted docs |
| `frappe.log_error(title, message)` | First arg = title (short), second arg = message (detail). **Do not put the full message in the title** — it throws an error |

---

## 2. Livestock Settings

Single DocType — all config lives here. Read with `frappe.db.get_single_value('Livestock Settings', field)`.

| Field | Current value | Purpose |
|-------|--------------|---------|
| `custom_default_company` | `Westwood Dairies Ltd` | Posted on every JE / SE |
| `custom_default_credit_account` | `1010030402 - Petty Cash Endebess Kaitet Account - WDL` | CR side of cash receipts; DR of expense JEs |
| `custom_animal_asset_account` | `Livestock & Poultry - WDL` | Fixed asset account for animals |
| `custom_disposal_account` | `Gain/Loss on Asset Disposal - WDL` | Write-off DR account |
| `custom_animal_sale_income_account` | `40701201 - Gain On Disposal of Biological Assets - WDL` | Income on sold animals |
| `custom_insurance_receivable_account` | `1010020302 - Herritage Insurance (Claims Receivable) - WDL` | DR on insurance claim JE |
| `custom_insurance_income_account` | `407002 - Dairy Other Income - WDL` | CR on insurance claim JE |
| `custom_milk_income_account` | `404001 - Dairy Milk Sales - WDL` | Milk revenue CR |
| `custom_vet_expense_account` | `50101906 - Dairy Veterinary costs - WDL` | Vet cost DR |
| `custom_feed_expense_account` | `50101905 - Dairy Feed - WDL` | Feed cost DR |
| `custom_milk_item` | `WestWood Dairy Milk (kg)` | Item used in milk Stock Entries |
| `custom_milk_target_warehouse` | `Finished Goods - WDL` | Where sellable milk goes |
| `custom_milk_discard_warehouse` | `Stores - WDL` | Where discarded milk goes |
| `custom_milking_stock_entry_type` | `Milking` | SE type for milk receipts |
| `custom_milk_price_per_kg` | `60.0` | Default milk price |
| `custom_semen_warehouse` | `Stores - WDL` | Source for semen straws |
| `custom_drug_warehouse` | `Stores - WDL` | Source for drugs |
| `custom_animal_sale_item` | `LIVESTOCK-SALE` | Item on Sales Invoice when selling an animal |
| `custom_farm` | `Kapkolia` | Required on Sales Invoices (`custom_farm` field) |
| `custom_milk_business_unit` | `Westwood Milk` | Required on Sales Invoices (`custom_business_unit`) |
| `custom_default_heifer_herd` | `0-2` | Default herd for newborn females |
| `custom_default_bull_herd` | `BULLS` | Default herd for newborn males |
| `custom_default_dry_herd` | `STEAMERS` | Default herd for dry cows |
| `custom_default_payout_percent` | `90.0` | Insurance payout default % |

---

## 3. Script 1 — Animal Event

**Name:** `Animal Event — After Submit: Create Animal, Move Herds, Issue Stock`  
**Type:** DocType Event — After Submit  
**DocType:** `Animal Event`  

### What it does by event type

| `event_type` | Automation |
|---|---|
| `Weight Recording` | Updates `Animal.last_weight_kg`, `last_bcs`; appends row to `Animal Weight Record` child table with `daily_gain_g` vs previous record |
| `Vaccination` | Issues drugs (Material Issue SE); sets `last_vaccination_date`, `milk_safe_date`, `in_treatment=1`; creates expense JE |
| `Deworming` | Same as Vaccination; sets `last_deworming_date`; `milk_safe_date` = max across all drug rows |
| `Hoof Trimming` | Issues drugs if any; expense JE if `custom_activity_cost > 0` |
| `Dehorning` | Same as Hoof Trimming |
| `Heat Detection` | No automation — observation only |
| `Service` | Issues 1 semen straw (Material Issue); sets `repro_status=Served`, `last_service_date`, `last_service_sire`, increments `total_services` |
| `Pregnancy Diagnosis` | Confirmed → `repro_status=Pregnant`, `expected_calving_date = event_date + 280d`; else → `repro_status=Open` |
| `Drying Off` | Moves animal to `custom_to_herd`, sets `repro_status=Dry`; issues DCT drugs |
| `Calving` / `Birth` | Moves dam to `custom_to_herd`, `repro_status=Open`, `parity++`, sets `last_calving_date`; on Live Birth creates new Animal + Calf Rearing |
| `Movement` | Sets `Animal.current_herd = custom_to_herd` |

### Full script

```python
# Animal Event — After Submit (v7)
# Sandbox: no imports, no str.format(), no getattr(), no def
# frappe.log_error(title, message) — title first, message second

company     = frappe.db.get_single_value('Livestock Settings', 'custom_default_company') or 'Westwood Dairies Ltd'
animal_ref  = doc.custom_animal_ref or doc.animal
cost_center = None

animal = None
if animal_ref:
    try:
        animal = frappe.get_doc('Animal', animal_ref)
    except Exception:
        animal = None

herd_name = (animal.current_herd if animal else None) or doc.current_herd
if herd_name:
    cost_center = frappe.db.get_value('Herds', herd_name, 'cost_center')

vet_account = None
if herd_name:
    vet_account = frappe.db.get_value('Herds', herd_name, 'custom_vet_account')
if not vet_account:
    vet_account = frappe.db.get_single_value('Livestock Settings', 'custom_vet_expense_account')

# ================================================================
# SERVICE
# ================================================================
if doc.event_type == 'Service':
    semen_item = doc.custom_semen_item
    if semen_item:
        wh = frappe.db.get_single_value('Livestock Settings', 'custom_semen_warehouse') or 'Stores - WDL'
        try:
            se = frappe.new_doc('Stock Entry')
            se.stock_entry_type = 'Material Issue'
            se.company          = company
            se.posting_date     = doc.event_date
            se.remarks          = 'Semen issue for Animal Event ' + doc.name
            row = se.append('items', {})
            row.item_code   = semen_item
            row.qty         = 1
            row.s_warehouse = wh
            if cost_center: row.cost_center = cost_center
            se.insert(ignore_permissions=True)
            se.submit()
            frappe.db.set_value('Animal Event', doc.name, 'custom_material_issue_entry', se.name)
        except Exception as e:
            frappe.log_error('Livestock', 'Material Issue (semen) failed: ' + str(e))
    if animal:
        try:
            frappe.db.set_value('Animal', animal.name, {
                'repro_status':      'Served',
                'last_service_date': doc.event_date,
                'last_service_sire': doc.sire or '',
                'total_services':    (animal.total_services or 0) + 1
            })
        except Exception as e:
            frappe.log_error('Livestock', 'Animal update (service) failed: ' + str(e))

# ================================================================
# PREGNANCY DIAGNOSIS
# ================================================================
elif doc.event_type == 'Pregnancy Diagnosis' and animal:
    try:
        if doc.diagnosis_result == 'Confirmed':
            frappe.db.set_value('Animal', animal.name, {
                'repro_status':          'Pregnant',
                'expected_calving_date': frappe.utils.add_days(doc.event_date, 280)
            })
        else:
            frappe.db.set_value('Animal', animal.name, {
                'repro_status':          'Open',
                'expected_calving_date': None
            })
    except Exception as e:
        frappe.log_error('Livestock', 'Animal update (PD) failed: ' + str(e))

# ================================================================
# HEALTH EVENTS
# ================================================================
elif doc.event_type in ['Vaccination', 'Deworming', 'Dehorning', 'Hoof Trimming']:
    max_wd_date = None
    drug_wh = frappe.db.get_single_value('Livestock Settings', 'custom_drug_warehouse') or 'Stores - WDL'

    for row in (doc.custom_drug_issues or []):
        wh = row.source_warehouse or drug_wh
        try:
            se = frappe.new_doc('Stock Entry')
            se.stock_entry_type = 'Material Issue'
            se.company          = company
            se.posting_date     = doc.event_date
            se.remarks          = 'Drug issue for Animal Event ' + doc.name
            si = se.append('items', {})
            si.item_code   = row.item_code
            si.qty         = row.qty
            si.s_warehouse = wh
            if cost_center: si.cost_center = cost_center
            se.insert(ignore_permissions=True)
            se.submit()
            if row.name:
                frappe.db.set_value('Animal Drug Issue', row.name, 'stock_entry_ref', se.name)
        except Exception as e:
            frappe.log_error('Livestock', 'Drug Material Issue failed for ' + str(row.item_code) + ': ' + str(e))

        wd   = row.withdrawal_days or 0
        safe = row.milk_safe_date
        if wd > 0 and safe:
            safe_date = frappe.utils.getdate(safe)
            if not max_wd_date or safe_date > max_wd_date:
                max_wd_date = safe_date

    if animal:
        update_fields = {}
        if doc.event_type == 'Vaccination':
            update_fields['last_vaccination_date'] = doc.event_date
        elif doc.event_type == 'Deworming':
            update_fields['last_deworming_date'] = doc.event_date
        if max_wd_date:
            update_fields['milk_safe_date'] = max_wd_date
            update_fields['in_treatment']   = 1
        if update_fields:
            try:
                frappe.db.set_value('Animal', animal.name, update_fields)
            except Exception as e:
                frappe.log_error('Livestock', 'Animal health fields update failed: ' + str(e))

    cost = frappe.utils.flt(doc.custom_activity_cost or 0)
    if cost > 0 and vet_account:
        credit_account = frappe.db.get_single_value('Livestock Settings', 'custom_default_credit_account')
        try:
            je = frappe.new_doc('Journal Entry')
            je.company      = company
            je.posting_date = doc.event_date
            je.user_remark  = doc.event_type + ' - ' + doc.animal + ' - ' + str(doc.event_date)
            dr = je.append('accounts', {})
            dr.account                   = vet_account
            dr.debit_in_account_currency = cost
            if cost_center: dr.cost_center = cost_center
            cr = je.append('accounts', {})
            cr.account                    = credit_account
            cr.credit_in_account_currency = cost
            je.insert(ignore_permissions=True)
            je.submit()
            frappe.db.set_value('Animal Event', doc.name, 'custom_journal_entry', je.name)
        except Exception as e:
            frappe.log_error('Livestock', 'Expense JE failed: ' + str(e))

# ================================================================
# CALVING / BIRTH
# ================================================================
elif doc.event_type in ['Calving', 'Birth']:
    calf_outcome = doc.custom_calf_outcome or doc.custom_calving_outcome or 'Live Birth'
    to_herd = doc.custom_to_herd

    if animal and to_herd:
        try:
            frappe.db.set_value('Animal', animal.name, {
                'current_herd':      to_herd,
                'repro_status':      'Open',
                'parity':            (animal.parity or 0) + 1,
                'last_calving_date': doc.event_date,
                'days_in_milk':      0
            })
        except Exception as e:
            frappe.log_error('Livestock', 'Dam update (calving) failed: ' + str(e))

    book_no = doc.custom_calf_book_number
    burn_nm = doc.custom_calf_burn_name
    if calf_outcome == 'Live Birth' and book_no and burn_nm:
        gender      = doc.custom_calf_gender or 'Female'
        target_herd = doc.custom_calf_target_herd
        if not target_herd:
            setting     = 'custom_default_heifer_herd' if gender == 'Female' else 'custom_default_bull_herd'
            target_herd = frappe.db.get_single_value('Livestock Settings', setting)
        try:
            calf = frappe.new_doc('Animal')
            calf.tag_number       = book_no
            calf.burn_name        = burn_nm
            calf.sex              = gender
            calf.origin           = 'Born on Farm'
            calf.date_of_birth    = doc.event_date
            calf.acquisition_date = doc.event_date
            calf.birth_weight_kg  = frappe.utils.flt(doc.custom_birth_weight_kg or 0)
            calf.coat_colour      = doc.custom_calf_coat_colour or ''
            calf.sire_name        = doc.sire or ''
            calf.dam              = animal_ref
            calf.current_herd     = target_herd
            calf.status           = 'Active'
            calf.repro_status     = 'Heifer' if gender == 'Female' else 'Bull'
            calf.company          = company
            calf.insert(ignore_permissions=True)
            calf.submit()
            frappe.db.set_value('Animal Event', doc.name, 'custom_calf_animal_created', calf.name)
            cr_doc = frappe.new_doc('Calf Rearing')
            cr_doc.animal  = calf.name
            cr_doc.company = company
            cr_doc.insert(ignore_permissions=True)
        except Exception as e:
            frappe.log_error('Livestock Calving', 'Calf creation failed: ' + str(e))

# ================================================================
# DRYING OFF
# ================================================================
elif doc.event_type == 'Drying Off':
    to_herd = doc.custom_to_herd
    if animal and to_herd:
        try:
            frappe.db.set_value('Animal', animal.name, {
                'current_herd': to_herd,
                'repro_status': 'Dry'
            })
        except Exception as e:
            frappe.log_error('Livestock', 'Animal update (drying off) failed: ' + str(e))

    drug_wh = frappe.db.get_single_value('Livestock Settings', 'custom_drug_warehouse') or 'Stores - WDL'
    for row in (doc.custom_drug_issues or []):
        wh = row.source_warehouse or drug_wh
        try:
            se = frappe.new_doc('Stock Entry')
            se.stock_entry_type = 'Material Issue'
            se.company          = company
            se.posting_date     = doc.event_date
            se.remarks          = 'DCT issue for Animal Event ' + doc.name
            si = se.append('items', {})
            si.item_code   = row.item_code
            si.qty         = row.qty
            si.s_warehouse = wh
            if cost_center: si.cost_center = cost_center
            se.insert(ignore_permissions=True)
            se.submit()
        except Exception as e:
            frappe.log_error('Livestock', 'DCT Material Issue failed: ' + str(e))

# ================================================================
# WEIGHT RECORDING
# ================================================================
elif doc.event_type == 'Weight Recording' and animal:
    wt  = frappe.utils.flt(doc.custom_weight or 0)
    bcs = frappe.utils.flt(doc.custom_bcs or 0)
    if wt:
        try:
            frappe.db.set_value('Animal', animal.name, {'last_weight_kg': wt, 'last_bcs': bcs})
        except Exception as e:
            frappe.log_error('Livestock', 'Animal weight update failed: ' + str(e))

        daily_gain = 0
        prev = frappe.db.sql(
            'SELECT recording_date, weight_kg FROM `tabAnimal Weight Record` '
            'WHERE parent = %s ORDER BY recording_date DESC LIMIT 1',
            animal.name, as_dict=True
        )
        if prev:
            days_diff = frappe.utils.date_diff(doc.event_date, str(prev[0].recording_date))
            if days_diff > 0:
                daily_gain = frappe.utils.flt(
                    (wt - frappe.utils.flt(prev[0].weight_kg)) * 1000.0 / days_diff, 0
                )

        max_idx = frappe.db.sql(
            'SELECT COALESCE(MAX(idx),0) AS mx FROM `tabAnimal Weight Record` WHERE parent = %s',
            animal.name, as_dict=True
        )
        next_idx = (frappe.utils.cint(max_idx[0].mx) if max_idx else 0) + 1

        try:
            row_doc = frappe.new_doc('Animal Weight Record')
            row_doc.parent         = animal.name
            row_doc.parenttype     = 'Animal'
            row_doc.parentfield    = 'weight_history'
            row_doc.idx            = next_idx
            row_doc.recording_date = doc.event_date
            row_doc.weight_kg      = wt
            row_doc.bcs            = bcs
            row_doc.daily_gain_g   = daily_gain
            row_doc.event_ref      = doc.name
            row_doc.db_insert()
        except Exception as e:
            frappe.log_error('Livestock', 'Weight history insert failed: ' + str(e))

# ================================================================
# MOVEMENT
# ================================================================
elif doc.event_type == 'Movement' and animal:
    to_herd = doc.custom_to_herd or doc.new_herd
    if to_herd:
        try:
            frappe.db.set_value('Animal', animal.name, {'current_herd': to_herd})
        except Exception as e:
            frappe.log_error('Livestock', 'Animal movement update failed: ' + str(e))

# HEAT DETECTION — observation only, no automation
```

---

## 4. Script 2 — Milk Recording

**Name:** `Milk Recording — After Submit: Stock Entry + Revenue JE`  
**Type:** DocType Event — After Submit  
**DocType:** `Milk Recording`  

### What it does

1. Creates a **Stock Entry** (type = `custom_milking_stock_entry_type`, default `Milking`) posting `net_yield_kg` to `target_warehouse` and optionally `discarded_kg` to `discard_warehouse`.
2. Creates a **Journal Entry** crediting milk income and debiting the default credit account.
3. Stores `stock_entry` and `journal_entry` names back on the Milk Recording.

### Full script

```python
# Milk Recording — After Submit
# Sandbox: no imports, no str.format(), no getattr(), no def
# frappe.log_error(title, message)

company     = frappe.db.get_single_value('Livestock Settings', 'custom_default_company') or 'Westwood Dairies Ltd'
milk_item   = frappe.db.get_single_value('Livestock Settings', 'custom_milk_item')
target_wh   = doc.target_warehouse or frappe.db.get_single_value('Livestock Settings', 'custom_milk_target_warehouse')
se_type     = frappe.db.get_single_value('Livestock Settings', 'custom_milking_stock_entry_type') or 'Material Receipt'
income_acct = doc.income_account or frappe.db.get_single_value('Livestock Settings', 'custom_milk_income_account')
credit_acct = frappe.db.get_single_value('Livestock Settings', 'custom_default_credit_account')
cost_center = doc.cost_center
net_yield   = frappe.utils.flt(doc.net_yield_kg)
discarded   = frappe.utils.flt(doc.discarded_kg)
revenue     = frappe.utils.flt(doc.milk_revenue)

try:
    discard_wh = doc.discard_warehouse
except Exception:
    discard_wh = None
if not discard_wh:
    discard_wh = frappe.db.get_single_value('Livestock Settings', 'custom_milk_discard_warehouse')

if not milk_item:
    frappe.throw('Milk item not set in Livestock Settings (custom_milk_item).')
if not target_wh:
    frappe.throw('Milk target warehouse not set in Livestock Settings or on this record.')

# 1. Stock Entry
se = frappe.new_doc('Stock Entry')
se.stock_entry_type = se_type
se.company          = company
se.posting_date     = doc.recording_date
se.posting_time     = '00:00:00'
se.remarks = 'Milk Recording - ' + str(doc.herd) + ' - ' + str(doc.session) + ' - ' + str(doc.recording_date)

if net_yield > 0:
    r1 = se.append('items', {})
    r1.item_code   = milk_item
    r1.qty         = net_yield
    r1.t_warehouse = target_wh
    if cost_center: r1.cost_center = cost_center

if discarded > 0 and discard_wh:
    r2 = se.append('items', {})
    r2.item_code   = milk_item
    r2.qty         = discarded
    r2.t_warehouse = discard_wh
    if cost_center: r2.cost_center = cost_center

try:
    se.insert(ignore_permissions=True)
    se.submit()
    frappe.db.set_value('Milk Recording', doc.name, 'stock_entry', se.name)
except Exception as e:
    frappe.log_error('Milk Recording', 'Stock Entry creation failed: ' + str(e))

# 2. Revenue JE
if revenue > 0 and income_acct and credit_acct:
    try:
        je = frappe.new_doc('Journal Entry')
        je.company      = company
        je.posting_date = doc.recording_date
        je.user_remark  = 'Milk sales - ' + str(doc.herd) + ' - ' + str(doc.session) + ' - ' + str(net_yield) + ' kg'
        cr = je.append('accounts', {})
        cr.account                    = income_acct
        cr.credit_in_account_currency = revenue
        if cost_center: cr.cost_center = cost_center
        dr = je.append('accounts', {})
        dr.account                   = credit_acct
        dr.debit_in_account_currency = revenue
        je.insert(ignore_permissions=True)
        je.submit()
        frappe.db.set_value('Milk Recording', doc.name, 'journal_entry', je.name)
    except Exception as e:
        frappe.log_error('Milk Recording', 'Revenue JE failed: ' + str(e))

se_ref = frappe.db.get_value('Milk Recording', doc.name, 'stock_entry') or 'pending'
frappe.msgprint(
    'Stock Entry ' + se_ref + ' created. ' + str(net_yield) + ' kg milk posted.' +
    (' Revenue KES ' + str(int(revenue)) + '.' if revenue > 0 else ''),
    indicator='green', title='Milk Recording submitted'
)
```

---

## 5. Script 3 — Animal Disposal

**Name:** `Animal Disposal — After Submit: JEs and Animal Status`  
**Type:** DocType Event — After Submit  
**DocType:** `Animal Disposal`  

### Three paths

**PATH A — SOLD** (`disposal_type = 'Sold'`, `sale_price > 0`)
1. Find or create Customer (`customer_group=Individual`, `territory=Kenya`)
2. Create Sales Invoice (`LIVESTOCK-SALE` item, `debit_to=1010020402 - Others - WDL`, mandatory `custom_farm=Kapkolia`, `custom_business_unit=Westwood Milk`)
3. Create Payment Entry (Receive, `mode_of_payment=Petty Cash`)
4. Create write-off JE (DR `Gain/Loss on Asset Disposal`, CR `Livestock & Poultry - WDL`)
5. `gain_loss = sale_price − book_value`

**PATH B — CULLED/DIED with insurance**
1. Auto-lookup active policy from `tabLivestock Insurance Policy Animal` where `animal = doc.animal`
2. `claim_amount = insured_value × payout_percent / 100`
3. Write-off JE (book_value)
4. Insurance receivable JE (DR `Heritage Insurance Claims Receivable`, CR `Dairy Other Income`)
5. `gain_loss = claim_amount − book_value`

**PATH C — CULLED/DIED no insurance**
1. Write-off JE only; `gain_loss = −book_value`

### Status mapping

| `disposal_type` | `Animal.status` |
|---|---|
| `Sold` | `Sold` |
| `Culled (Farm Use)` | `Culled` |
| `Died — Natural Causes` | `Dead` |
| `Died — Disease` | `Dead` |
| `Died — Accident` | `Dead` |
| `Condemned` | `Culled` |
| `Slaughtered` | `Culled` |

> Disposal type strings use **em-dashes** (`—`, `\u2014`), not hyphens. Send the exact string.

### Fields written back on submit

| Field | Set to |
|---|---|
| `sales_invoice` | SI name (SOLD) |
| `payment_entry` | PE name (SOLD) |
| `writeoff_journal_entry` | Write-off JE name |
| `sale_journal_entry` | Insurance receivable JE (PATH B) |
| `insurance_policy` | Auto-detected |
| `insured_value` | From policy |
| `insurance_claim_amount` | Calculated |
| `payout_percent` | From policy or 90 |
| `gain_loss` | Computed |

### Full script

```python
# Animal Disposal — After Submit (v10)
# Sandbox: no imports, no str.format(), no getattr(), no def
# frappe.log_error(title, message)

STATUS_MAP = {
    'Sold':                  'Sold',
    'Culled (Farm Use)':     'Culled',
    'Died \u2014 Natural Causes': 'Dead',
    'Died \u2014 Disease':        'Dead',
    'Died \u2014 Accident':       'Dead',
    'Condemned':             'Culled',
    'Slaughtered':           'Culled',
}
new_status = STATUS_MAP.get(doc.disposal_type, 'Dead')

company       = frappe.db.get_single_value('Livestock Settings', 'custom_default_company') or 'Westwood Dairies Ltd'
asset_account = frappe.db.get_single_value('Livestock Settings', 'custom_animal_asset_account')
disposal_acct = doc.disposal_account or frappe.db.get_single_value('Livestock Settings', 'custom_disposal_account')
cash_account  = frappe.db.get_single_value('Livestock Settings', 'custom_default_credit_account')
book_value    = frappe.utils.flt(doc.book_value)
sale_price    = frappe.utils.flt(doc.sale_price)
farm          = frappe.db.get_single_value('Livestock Settings', 'custom_farm') or 'Kapkolia'
biz_unit      = frappe.db.get_single_value('Livestock Settings', 'custom_milk_business_unit') or 'Westwood Milk'

cost_center = doc.cost_center
if not cost_center and frappe.db.exists('Animal', doc.animal):
    herd = frappe.db.get_value('Animal', doc.animal, 'current_herd')
    if herd:
        cost_center = frappe.db.get_value('Herds', herd, 'cost_center')
if not cost_center:
    cost_center = 'Main - WDL'

if frappe.db.exists('Animal', doc.animal):
    frappe.db.set_value('Animal', doc.animal, 'status', new_status)
if frappe.db.exists('Asset', doc.animal):
    frappe.db.set_value('Asset', doc.animal, 'status', 'Scrapped' if new_status != 'Sold' else 'Sold')

# ================================================================
# PATH A: SOLD
# ================================================================
if doc.disposal_type == 'Sold' and sale_price > 0:

    sale_item      = frappe.db.get_single_value('Livestock Settings', 'custom_animal_sale_item') or 'LIVESTOCK-SALE'
    income_account = doc.income_account or frappe.db.get_single_value('Livestock Settings', 'custom_animal_sale_income_account')
    debtors_acct   = '1010020402 - Others - WDL'
    buyer          = doc.buyer_name or 'Cash Buyer'

    customer_name = frappe.db.get_value('Customer', {'customer_name': buyer}, 'name')
    if not customer_name:
        try:
            cust = frappe.new_doc('Customer')
            cust.customer_name  = buyer
            cust.customer_type  = 'Individual'
            cust.customer_group = 'Individual'
            cust.territory      = 'Kenya'
            cust.insert(ignore_permissions=True)
            customer_name = cust.name
        except Exception as e:
            frappe.log_error('Livestock Disposal', 'Customer creation failed: ' + str(e))

    si_name = None
    if customer_name:
        try:
            si = frappe.new_doc('Sales Invoice')
            si.company              = company
            si.customer             = customer_name
            si.posting_date         = doc.disposal_date
            si.due_date             = doc.disposal_date
            si.set_posting_time     = 1
            si.debit_to             = debtors_acct
            si.custom_farm          = farm
            si.custom_business_unit = biz_unit
            si.remarks              = 'Animal sale: ' + doc.animal
            row = si.append('items', {})
            row.item_code      = sale_item
            row.item_name      = 'Livestock Sale'
            row.description    = 'Sale of ' + doc.animal + ' (' + (doc.animal_name or '') + ')'
            row.qty            = 1
            row.rate           = sale_price
            row.income_account = income_account
            row.cost_center    = cost_center
            si.insert(ignore_permissions=True)
            si.submit()
            si_name = si.name
            frappe.db.set_value('Animal Disposal', doc.name, 'sales_invoice', si_name)
        except Exception as e:
            frappe.log_error('Livestock Disposal', 'Sales Invoice failed: ' + str(e))

    if si_name and customer_name:
        try:
            pe = frappe.new_doc('Payment Entry')
            pe.payment_type               = 'Receive'
            pe.company                    = company
            pe.posting_date               = doc.disposal_date
            pe.party_type                 = 'Customer'
            pe.party                      = customer_name
            pe.paid_amount                = sale_price
            pe.received_amount            = sale_price
            pe.paid_from                  = debtors_acct
            pe.paid_to                    = cash_account
            pe.paid_to_account_currency   = 'KES'
            pe.paid_from_account_currency = 'KES'
            pe.mode_of_payment            = 'Petty Cash'
            pe.reference_no               = doc.name
            pe.reference_date             = doc.disposal_date
            pe.remarks                    = 'Payment for sale: ' + doc.animal
            ref = pe.append('references', {})
            ref.reference_doctype = 'Sales Invoice'
            ref.reference_name    = si_name
            ref.allocated_amount  = sale_price
            pe.insert(ignore_permissions=True)
            pe.submit()
            frappe.db.set_value('Animal Disposal', doc.name, 'payment_entry', pe.name)
        except Exception as e:
            frappe.log_error('Livestock Disposal', 'Payment Entry failed: ' + str(e))

    if book_value > 0 and asset_account and disposal_acct:
        try:
            wo = frappe.new_doc('Journal Entry')
            wo.company      = company
            wo.posting_date = doc.disposal_date
            wo.user_remark  = 'Asset write-off on sale: ' + doc.animal
            dr = wo.append('accounts', {})
            dr.account                   = disposal_acct
            dr.debit_in_account_currency = book_value
            dr.cost_center               = cost_center
            cr = wo.append('accounts', {})
            cr.account                    = asset_account
            cr.credit_in_account_currency = book_value
            cr.cost_center                = cost_center
            wo.insert(ignore_permissions=True)
            wo.submit()
            frappe.db.set_value('Animal Disposal', doc.name, 'writeoff_journal_entry', wo.name)
        except Exception as e:
            frappe.log_error('Livestock Disposal', 'Write-off JE failed: ' + str(e))

    frappe.db.set_value('Animal Disposal', doc.name, 'gain_loss', sale_price - book_value)

# ================================================================
# PATH B & C: CULLED / DIED
# ================================================================
else:

    try:
        policy_name = doc.insurance_policy
    except Exception:
        policy_name = None
    try:
        insured_value = frappe.utils.flt(doc.insured_value)
    except Exception:
        insured_value = 0
    try:
        payout_pct = frappe.utils.flt(doc.payout_percent) or 90
    except Exception:
        payout_pct = 90

    if not policy_name:
        pol_row = frappe.db.sql(
            'SELECT parent, insured_value FROM `tabLivestock Insurance Policy Animal` '
            'WHERE animal = %s LIMIT 1',
            doc.animal, as_dict=True
        )
        if pol_row:
            policy_name   = pol_row[0].parent
            insured_value = frappe.utils.flt(pol_row[0].insured_value)

    if not policy_name:
        animal_name_val = doc.animal_name or doc.animal
        pol_row2 = frappe.db.sql(
            'SELECT parent, insured_value FROM `tabLivestock Insurance Policy Animal` '
            'WHERE animal_name = %s LIMIT 1',
            animal_name_val, as_dict=True
        )
        if pol_row2:
            policy_name   = pol_row2[0].parent
            insured_value = frappe.utils.flt(pol_row2[0].insured_value)

    if insured_value == 0 and frappe.db.exists('Animal', doc.animal):
        insured_value = frappe.utils.flt(
            frappe.db.get_value('Animal', doc.animal, 'insured_value') or 0
        )

    if policy_name:
        pol_pct = frappe.db.get_value('Livestock Insurance Policy', policy_name, 'payout_percent')
        if pol_pct:
            payout_pct = frappe.utils.flt(pol_pct)

    claim_amount = frappe.utils.flt(insured_value * payout_pct / 100) if insured_value > 0 else 0

    frappe.db.set_value('Animal Disposal', doc.name, 'insured_value', insured_value)
    frappe.db.set_value('Animal Disposal', doc.name, 'insurance_claim_amount', claim_amount)
    frappe.db.set_value('Animal Disposal', doc.name, 'payout_percent', payout_pct)
    if policy_name:
        frappe.db.set_value('Animal Disposal', doc.name, 'insurance_policy', policy_name)

    if book_value > 0 and asset_account and disposal_acct:
        try:
            wo = frappe.new_doc('Journal Entry')
            wo.company      = company
            wo.posting_date = doc.disposal_date
            wo.user_remark  = 'Asset write-off: ' + doc.animal + ' (' + doc.disposal_type + ')'
            dr = wo.append('accounts', {})
            dr.account                   = disposal_acct
            dr.debit_in_account_currency = book_value
            dr.cost_center               = cost_center
            cr = wo.append('accounts', {})
            cr.account                    = asset_account
            cr.credit_in_account_currency = book_value
            cr.cost_center                = cost_center
            wo.insert(ignore_permissions=True)
            wo.submit()
            frappe.db.set_value('Animal Disposal', doc.name, 'writeoff_journal_entry', wo.name)
        except Exception as e:
            frappe.log_error('Livestock Disposal', 'Write-off JE failed: ' + str(e))

    if claim_amount > 0:
        recv_acct   = frappe.db.get_single_value('Livestock Settings', 'custom_insurance_receivable_account') or '1010020302 - Herritage Insurance (Claims Receivable) - WDL'
        income_acct = frappe.db.get_single_value('Livestock Settings', 'custom_insurance_income_account') or '407002 - Dairy Other Income - WDL'
        try:
            ins_je = frappe.new_doc('Journal Entry')
            ins_je.company      = company
            ins_je.posting_date = doc.disposal_date
            ins_je.user_remark  = (
                'Insurance claim: ' + doc.animal +
                ' KES ' + str(int(claim_amount)) +
                ' (' + str(int(payout_pct)) + '% of KES ' + str(int(insured_value)) + ')'
            )
            dr2 = ins_je.append('accounts', {})
            dr2.account                   = recv_acct
            dr2.debit_in_account_currency = claim_amount
            if policy_name:
                insurer_cust = frappe.db.get_value('Livestock Insurance Policy', policy_name, 'custom_insurer_customer')
                if insurer_cust:
                    dr2.party_type = 'Customer'
                    dr2.party      = insurer_cust
            cr2 = ins_je.append('accounts', {})
            cr2.account                    = income_acct
            cr2.credit_in_account_currency = claim_amount
            cr2.cost_center                = cost_center
            ins_je.insert(ignore_permissions=True)
            ins_je.submit()
            frappe.db.set_value('Animal Disposal', doc.name, 'sale_journal_entry', ins_je.name)
        except Exception as e:
            frappe.log_error('Livestock Disposal', 'Insurance receivable JE failed: ' + str(e))

    frappe.db.set_value('Animal Disposal', doc.name, 'gain_loss', claim_amount - book_value)

# ================================================================
# Summary
# ================================================================
wo_je  = frappe.db.get_value('Animal Disposal', doc.name, 'writeoff_journal_entry') or ''
si_ref = frappe.db.get_value('Animal Disposal', doc.name, 'sales_invoice') or ''
pe_ref = frappe.db.get_value('Animal Disposal', doc.name, 'payment_entry') or ''
ins_je = frappe.db.get_value('Animal Disposal', doc.name, 'sale_journal_entry') or ''
claim  = frappe.utils.flt(frappe.db.get_value('Animal Disposal', doc.name, 'insurance_claim_amount') or 0)
gl     = frappe.utils.flt(frappe.db.get_value('Animal Disposal', doc.name, 'gain_loss') or 0)

parts = ['Animal ' + doc.animal + ' marked as ' + new_status + '.']
if wo_je:  parts.append('Write-off JE: ' + wo_je + '.')
if si_ref: parts.append('Sales Invoice: ' + si_ref + '.')
if pe_ref: parts.append('Payment Entry: ' + pe_ref + '.')
if ins_je: parts.append('Insurance receivable JE: ' + ins_je + ' (KES ' + str(int(claim)) + ').')
if not ins_je and doc.disposal_type != 'Sold': parts.append('No insurance found - write-off only.')
gl_label = 'Gain' if gl >= 0 else 'Loss'
parts.append(gl_label + ': KES ' + str(int(abs(gl))) + '.')

frappe.msgprint(' '.join(parts), indicator='green', title='Disposal complete')
```

---

## 6. Script 4 — Animal Capitalisation

**Name:** `Animal — After Submit: Capitalisation Journal Entry`  
**Type:** DocType Event — After Submit  
**DocType:** `Animal`  

Creates a capitalisation JE only when `is_capitalised = 1` AND `purchase_value > 0`. Born-on-farm calves have neither set, so no JE fires for them.

```python
# Animal — After Submit: Capitalisation Journal Entry
# Sandbox: no imports, no f-strings, no getattr(), no def
# frappe.log_error(title, message)

if not doc.is_capitalised or not frappe.utils.flt(doc.purchase_value):
    pass
else:
    asset_account  = frappe.db.get_single_value('Livestock Settings', 'custom_animal_asset_account')
    credit_account = frappe.db.get_single_value('Livestock Settings', 'custom_default_credit_account')
    company        = frappe.db.get_single_value('Livestock Settings', 'custom_default_company') or 'Westwood Dairies Ltd'

    if not asset_account:
        frappe.log_error('Livestock Capitalisation', 'custom_animal_asset_account not set in Livestock Settings')
    elif not credit_account:
        frappe.log_error('Livestock Capitalisation', 'custom_default_credit_account not set in Livestock Settings')
    else:
        cost_center = None
        if doc.current_herd:
            cost_center = frappe.db.get_value('Herds', doc.current_herd, 'cost_center')

        try:
            je = frappe.new_doc('Journal Entry')
            je.company      = company
            je.posting_date = doc.acquisition_date or frappe.utils.today()
            je.user_remark  = 'Capitalisation of ' + (doc.burn_name or doc.name) + ' (' + doc.name + ')'

            dr = je.append('accounts', {})
            dr.account                   = asset_account
            dr.debit_in_account_currency = frappe.utils.flt(doc.purchase_value)
            if cost_center: dr.cost_center = cost_center

            cr = je.append('accounts', {})
            cr.account                    = credit_account
            cr.credit_in_account_currency = frappe.utils.flt(doc.purchase_value)

            je.insert(ignore_permissions=True)
            je.submit()
        except Exception as e:
            frappe.log_error('Livestock Capitalisation', 'Journal Entry creation failed: ' + str(e))
```

---

## 7. Script 5 — Weight History Backfill API

**Name:** `livestock.backfill_weight_history`  
**Type:** API  
**Method:** `livestock.backfill_weight_history`  

Run **once** after deploy to backfill `Animal Weight Record` rows for all historical weight recording events. Idempotent — skips already-processed events.

**Call from browser console:**
```javascript
frappe.call({
  method: 'livestock.backfill_weight_history',
  callback: r => console.log(r.message)
})
// → "Done. Inserted: 17, Skipped: 3, Errors: 0"
```

```python
# Weight History Backfill API
# Sandbox: no imports, no def
# frappe.log_error(title, message)

events = frappe.db.sql(
    'SELECT name, event_date, animal, custom_animal_ref, custom_weight, custom_bcs '
    'FROM `tabAnimal Event` '
    'WHERE docstatus = 1 AND event_type = %s ORDER BY animal, event_date ASC',
    'Weight Recording', as_dict=True
)

inserted = 0
skipped  = 0
errors   = 0

for ev in events:
    animal_name = ev.custom_animal_ref or ev.animal
    wt  = frappe.utils.flt(ev.custom_weight)
    bcs = frappe.utils.flt(ev.custom_bcs)

    if not animal_name or not wt:
        skipped = skipped + 1
        continue

    if not frappe.db.exists('Animal', animal_name):
        skipped = skipped + 1
        continue

    exists = frappe.db.sql(
        'SELECT name FROM `tabAnimal Weight Record` WHERE parent = %s AND event_ref = %s LIMIT 1',
        (animal_name, ev.name), as_dict=True
    )
    if exists:
        skipped = skipped + 1
        continue

    prev = frappe.db.sql(
        'SELECT recording_date, weight_kg FROM `tabAnimal Weight Record` '
        'WHERE parent = %s AND recording_date < %s ORDER BY recording_date DESC LIMIT 1',
        (animal_name, ev.event_date), as_dict=True
    )
    daily_gain = 0
    if prev:
        days_diff = frappe.utils.date_diff(str(ev.event_date), str(prev[0].recording_date))
        if days_diff > 0:
            daily_gain = frappe.utils.flt(
                (wt - frappe.utils.flt(prev[0].weight_kg)) * 1000.0 / days_diff, 0
            )

    max_idx = frappe.db.sql(
        'SELECT COALESCE(MAX(idx),0) AS mx FROM `tabAnimal Weight Record` WHERE parent = %s',
        animal_name, as_dict=True
    )
    next_idx = (frappe.utils.cint(max_idx[0].mx) if max_idx else 0) + 1

    try:
        row = frappe.new_doc('Animal Weight Record')
        row.parent         = animal_name
        row.parenttype     = 'Animal'
        row.parentfield    = 'weight_history'
        row.idx            = next_idx
        row.recording_date = ev.event_date
        row.weight_kg      = wt
        row.bcs            = bcs
        row.daily_gain_g   = daily_gain
        row.event_ref      = ev.name
        row.db_insert()
        inserted = inserted + 1
    except Exception as e:
        frappe.log_error('Weight Backfill', 'Insert failed for event ' + str(ev.name) + ': ' + str(e))
        errors = errors + 1

frappe.db.commit()
frappe.response['message'] = 'Done. Inserted: ' + str(inserted) + ', Skipped: ' + str(skipped) + ', Errors: ' + str(errors)
```

---

## 8. Front-end integration guide

### Authentication

```
Authorization: token <api_key>:<api_secret>
Content-Type: application/json
```

### Create → Submit (two-step, scripts fire on submit)

```javascript
// Step 1: Create draft
const draft = await fetch('/api/method/frappe.client.insert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'token key:secret' },
  body: JSON.stringify({ doc: { doctype: 'Animal Event', ...fields } })
}).then(r => r.json());

// Step 2: Submit — triggers the server script
const result = await fetch('/api/method/frappe.client.submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'token key:secret' },
  body: JSON.stringify({ doc: draft.message })
}).then(r => r.json());

// result.message has all auto-populated fields (JE names, SE names, etc.)
```

### Reading an animal with full weight history

```javascript
const res = await fetch(
  '/api/method/frappe.client.get?doctype=Animal&name=TESTHF-001%2F24',
  { headers: { 'Authorization': 'token key:secret' } }
).then(r => r.json());

// res.message.weight_history — array of Animal Weight Record rows:
// [{ recording_date, weight_kg, bcs, daily_gain_g, event_ref }, ...]
```

### Error handling

```javascript
const res = await frappe.call({ method: 'frappe.client.submit', args: { doc } });
if (res.exc) {
  // Script threw — message in res.exc or res._server_messages
  // Also visible in Frappe Error Log: /app/error-log
}
```

---

## 9. Event type field map

All events: `doctype`, `animal`, `event_type`, `event_date`, `operator`, `current_herd` required.

### Weight Recording
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name (same as `animal`) |
| `custom_weight` | Float kg |
| `custom_bcs` | Float 1–5 |

**Effect:** `last_weight_kg`, `last_bcs` updated; row appended to `weight_history` with `daily_gain_g`.

---

### Vaccination / Deworming / Hoof Trimming / Dehorning
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name |
| `custom_activity_cost` | Float KES |
| `custom_drug_issues` | Array of drug rows |

**Drug row:**
```json
{
  "item_code": "4040020167",
  "qty": 2,
  "uom": "ECH",
  "source_warehouse": "Stores - WDL",
  "withdrawal_days": 10,
  "milk_safe_date": "2026-05-12"
}
```

---

### Heat Detection
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name |

No automation — observation recorded only.

---

### Service (A.I.)
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name |
| `custom_semen_item` | Item code e.g. `Semen Delta Stormer-F` |
| `sire` | Sire name |

**Effect:** `repro_status=Served`; `last_service_date`; `last_service_sire`; `total_services++`; semen SE created.

---

### Pregnancy Diagnosis
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name |
| `diagnosis_result` | `Confirmed` or `Not Pregnant` |

**Effect:** Confirmed → `repro_status=Pregnant`, `expected_calving_date = +280d`. Other → `repro_status=Open`.

---

### Drying Off
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name |
| `custom_to_herd` | Target herd (e.g. `STEAMERS`) |
| `custom_drug_issues` | DCT drug rows |

**Effect:** `current_herd` changed; `repro_status=Dry`; drug SEs created.

---

### Calving / Birth
| Field | Value |
|---|---|
| `custom_animal_ref` | Dam's Animal name |
| `custom_to_herd` | Where dam goes (e.g. `LACTATION GROUP 2`) |
| `custom_calving_outcome` | `Live Birth`, `Still Birth`, or `Abortion` |
| `custom_calf_book_number` | New tag e.g. `IVYCALF-001/27` |
| `custom_calf_burn_name` | Calf's name |
| `custom_calf_gender` | `Female` or `Male` |
| `custom_calf_target_herd` | Optional — defaults from Settings |
| `custom_birth_weight_kg` | Float |
| `sire` | Sire name |

**Effect:** Dam moved, `parity++`, `repro_status=Open`, `last_calving_date` set. Live Birth → new Animal + Calf Rearing created.

---

### Movement
| Field | Value |
|---|---|
| `custom_animal_ref` | Animal name |
| `custom_to_herd` | Destination herd |

**Effect:** `Animal.current_herd` updated.

---

## 10. DocType schemas

### Animal Disposal
```json
{
  "doctype": "Animal Disposal",
  "animal": "EVITA-129296",
  "animal_name": "EVITA",
  "disposal_date": "2026-05-22",
  "disposal_type": "Sold",
  "book_value": 65000,
  "sale_price": 85000,
  "buyer_name": "Francis Mutai",
  "buyer_contact": "0733445566",
  "reason_details": "End of productive life",
  "witness": "Joseph Kirui",
  "disposal_account": "Gain/Loss on Asset Disposal - WDL",
  "income_account": "40701201 - Gain On Disposal of Biological Assets - WDL",
  "cost_center": "Main - WDL"
}
```

For culled/died: omit `sale_price` and `buyer_name`. Optionally pass `insured_value` and `payout_percent` — auto-detected from policy if absent.

### Milk Recording
```json
{
  "doctype": "Milk Recording",
  "herd": "LACTATION GROUP 2",
  "session": "AM \u2014 Morning",
  "recording_date": "2026-05-22",
  "company": "Westwood Dairies Ltd",
  "total_yield_kg": 545.0,
  "discarded_kg": 5.0,
  "net_yield_kg": 540.0,
  "price_per_kg": 60.0,
  "milk_revenue": 32400.0,
  "cows_milked": 12,
  "target_warehouse": "Finished Goods - WDL",
  "cost_center": "Main - WDL",
  "income_account": "404001 - Dairy Milk Sales - WDL"
}
```

`session` options: `AM — Morning`, `PM — Afternoon`, `Evening` (en-dash `\u2014`).

---

## 11. Accounts and cost centres reference

### Cost centres — WDL

All herds must use **`Main - WDL`** (leaf node). Never use `WestwoodDairies Ltd - WDL` — it is a group node and JEs against it are rejected.

### Key WDL accounts

| Account | Type | Used for |
|---|---|---|
| `Livestock & Poultry - WDL` | Fixed Asset | Animal asset |
| `Gain/Loss on Asset Disposal - WDL` | Expense | Write-off DR |
| `40701201 - Gain On Disposal of Biological Assets - WDL` | Income | Sale income CR |
| `1010020302 - Herritage Insurance (Claims Receivable) - WDL` | Receivable | Insurance claim DR |
| `407002 - Dairy Other Income - WDL` | Income | Insurance claim CR |
| `404001 - Dairy Milk Sales - WDL` | Income | Milk revenue CR |
| `50101906 - Dairy Veterinary costs - WDL` | Expense | Vet DR |
| `1010030402 - Petty Cash Endebess Kaitet Account - WDL` | Cash | Cash receipts / expense CR |
| `1010020402 - Others - WDL` | Receivable | Sales Invoice debtors |

---

## 12. Disabled scripts

Do not re-enable — these are old versions with the bugs that were fixed.

| Name | Reason disabled |
|---|---|
| `Animal Disposal — After Submit — JEs and Status Update` | Replaced by v10 |
| `Milk Recording — After Submit — Stock Entry and JE` | Replaced by current |
| `Animal — After Submit — Capitalisation JE` | Replaced by current |
| `Animal Event — After Submit — Create JE and Stock Issues` | Replaced by v7 |
| `Livestock Auto Journal Entry` | Replaced by v7 |

---

*End of document. All scripts live on `upande-kaitet2.c.frappe.cloud` as of 2026-05-22.*
