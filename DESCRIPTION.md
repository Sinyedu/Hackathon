# DockProof — Product Description

## One-line pitch
DockProof is a local-first delivery reconciliation assistant that automatically compares what a business ordered with what arrived, detects discrepancies, and prepares an evidence-backed supplier claim for human approval.

## The problem
Small businesses, restaurants, and warehouses manually compare purchase orders, delivery notes, and invoices. Suppliers may use different names for the same product, and deliveries may contain missing or incorrect quantities. Manual reconciliation takes time and makes mistakes easy to overlook.

## The solution
DockProof turns document uploads into a completed operational workflow:

1. **Scan** a purchase order and a delivery note with a phone camera (or upload an image, screenshot or PDF from a laptop); an invoice or emailed receipt is optional for the hackathon MVP.
2. **Extract** line items with a local OCR engine, show them next to the scanned image for user confirmation, and retain source snippets and page references.
3. **Match** products using deterministic normalization and fuzzy matching first, then a small local open-weight model for ambiguous descriptions.
4. **Reconcile** quantities and units with deterministic, validated calculations.
5. **Create** a persisted discrepancy case and draft supplier claim with supporting evidence.
6. **Review and approve** the claim or receiving record; nothing consequential is sent or finalized without user confirmation.

Example: A purchase order lists **24 cases of “Tomatoes, case 5 kg”**, while a delivery note lists **18 “Tomato Box 5KG.”** The AI recognizes the descriptions as potential equivalents. Validated code identifies a **six-case shortage**, and DockProof creates a reviewable claim. It does not invent missing quantities or silently convert units.

## Who it serves
- Restaurants and cafés receiving frequent ingredient deliveries.
- Small retailers reconciling shipments and supplier invoices.
- Warehouses and independent operators without sophisticated procurement software.

## Why AI is essential
Supplier product names are inconsistent. A strict string comparison cannot reliably determine whether two differently worded line items refer to the same product. A small language model resolves *ambiguous semantic matches* against a known candidate list. All arithmetic, validation, state transitions, and persistence remain deterministic.

## MVP technology
- **Frontend:** React, Vite, TypeScript, pnpm, native `fetch`.
- **Backend:** Python, FastAPI, Pydantic.
- **Storage:** Process-local memory, cleared when the backend restarts.
- **Scan reading:** local OCR (RapidOCR) for photos and screenshots; PyMuPDF for text-based PDFs. Numbers come from OCR text, never from the model.
- **Devices:** responsive web app; phone camera via native file capture on the local network.
- **Matching:** normalization, RapidFuzz, and Ollama with **Qwen3 1.7B** (small open-weight model, Apache 2.0 model-family license; check the specific model distribution before redistribution).
- **Execution:** locally on a developer laptop, without paid AI APIs or complex infrastructure.

## Scope for a four-hour hackathon
### Must work
- Scan or upload a purchase order and delivery note (phone or laptop).
- Extract or load validated line items from those documents.
- Use the local AI model to match at least one ambiguous product description.
- Identify a genuine quantity mismatch using deterministic calculations.
- Show evidence and create a persisted draft discrepancy claim.
- Require explicit user approval before finalizing the claim.
- Demonstrate the workflow repeatedly with synthetic fixtures.

### Only if time remains
Invoice comparison, email sending, external supplier integrations, ERP connections, complex authentication, or multi-user deployment.

## Live demo (60–90 seconds)
1. Scan two synthetic documents with a phone (or upload them) with inconsistent product descriptions.
2. Watch DockProof match equivalent products and show the supporting source lines.
3. See the shortage calculated and a draft claim generated automatically.
4. Approve the claim and refresh the dashboard to prove that the approved state was persisted.

**Success criterion:** a real document discrepancy becomes an evidence-backed, persisted, reviewable business action. The UI must never fake inference, claims, or approvals.

## Safety and trust
- AI may select only existing product candidates or return `NO_MATCH`.
- Ambiguous mappings require review; invalid model outputs are rejected.
- Money and quantities use validated deterministic logic; unit conversions are explicit.
- Document text is untrusted input, not an instruction to the model or application.
- Claims are drafts until approved. External communication is outside MVP scope.
- Demo data is synthetic and reproducible.

## AutoRecover (implemented extension)
When reconciliation finds a **shortage**, DockProof can prepare a recovery plan instead of just reporting it. The original MVP above is unchanged; AutoRecover is added on top of its persisted discrepancies.

### Recovery workflow
1. On a shortage, the user selects **Find Recovery Options**.
2. The backend loads the persisted discrepancy, computes the missing quantity and the required amount (6 cases x 5 kg = 30 kg), and searches the supplier catalog.
3. Deterministic rules classify every candidate: **exact match**, **verified repackaging** (same product, different pack size), **ambiguous** (related product), or **rejected** (different product, different measure, other category, unavailable).
4. Only ambiguous candidates go to Qwen3 1.7B, one at a time. Its structured answer is validated; an unknown candidate ID, invalid JSON or an outage drops that candidate with a visible warning.
5. Python calculates packages needed, stock coverage, `Decimal` total cost, package-rounding surplus and lead time, then ranks the options.
6. The plan is persisted. The user can create a **draft replacement order** from a complete option, then approve or reject it. Approval changes an internal status only.

### AI versus deterministic responsibilities
| Qwen3 1.7B (local) | Python (deterministic) |
|---|---|
| Judges whether an *ambiguous* candidate (e.g. cherry vs regular tomatoes) is a usable substitute, with a short reason | Category, measure and package checks; quantity and package conversion |
| Nothing else | Costs (`Decimal`), stock coverage, lead time, ranking and its explanations, persistence, state transitions, duplicate prevention |

The model never supplies suppliers, products, prices, quantities, lead times or identifiers. If it is unavailable, exact and repackaged options are still returned.

### Ranking (transparent, no AI score)
Complete fulfilment first, then verified compatibility before AI-assessed substitutes, then the user's priority (**cheapest first** by default, or **fastest first**), then supplier name. Each option lists the factual reasons for its position (for example "Lowest total cost among complete options (540.00 DKK)").

### Supplier catalog
Synthetic suppliers in `fixtures/suppliers.json` are loaded into process-local memory by an idempotent seed. It runs at backend startup. Each product has supplier, description, category, sale unit, package size and unit, unit price and currency (DKK), available quantity, lead time and an availability flag. The demo data covers exact matches, a repackaged option, an ambiguous variant, a different product, a pieces-based package (rejected, no conversion), partial stock and an unavailable supplier. Prices and stock are invented, not real offers.

### Human approval and safeguards
- Replacement orders start as **draft**; at most one live (draft or approved) order exists per recovery plan, and repeated requests return the same order.
- Approving an **AI-assessed substitute** requires explicit confirmation in the UI and API.
- Approve and reject are one-way. They only record a status: no email, no supplier contact, no real order, no inventory change. Totals exclude taxes and shipping.

### Synthetic demonstration scenario: Missing Tomatoes
The demo button runs the real pipeline (OCR, matching, reconciliation) on the fixture scans: 24 cases ordered, 18 delivered, shortage of 6 cases = 30 kg. Expected result with the seed data: FarmDirect (3 x 10 kg box, 540.00 DKK, 2 days) recommended on cost; GreenSupply (6 x 5 kg, 612.00 DKK, same day) on speed; Nordic Fresh (570.00 DKK, 1 day) as the middle option; a partial option; and excluded candidates with reasons. Demo steps are in `README.md`.

### Current limitations
- Single-supplier recovery only; no split orders across suppliers.
- Conversion only between identical measures (kg to kg, l to l, pcs to pcs); there is no kg/g or volume/weight conversion.
- Prices are per package with no tax, shipping, minimum order or price tiers.
- Compatibility of ambiguous products is judged by a 1.7B model on a handful of hand-written cases; every AI judgement needs human confirmation.
- Recovery is available for shortages only, not over-deliveries or wrong items.
- Supplier data is a static seed file; there is no supplier management UI or live catalog.

## Potential after the hackathon
Add invoice reconciliation, handwriting and low-quality scan support, accounting/POS integrations, supplier-specific catalogs, claim delivery and status tracking, multi-location receiving, and measurable recovery of shortages and overcharges.

## Development guidance
See [`AGENTS.md`](AGENTS.md) for shared agent instructions and [`CLAUDE.md`](CLAUDE.md) for Claude Code-specific behavior. Both prioritize the smallest reliable end-to-end workflow over architectural complexity.
