# DockProof — Product Description

## One-line pitch
DockProof is a local-first delivery reconciliation assistant that automatically compares what a business ordered with what arrived, detects discrepancies, and prepares an evidence-backed supplier claim for human approval.

## The problem
Small businesses, restaurants, and warehouses manually compare purchase orders, delivery notes, and invoices. Suppliers may use different names for the same product, and deliveries may contain missing or incorrect quantities. Manual reconciliation takes time and makes mistakes easy to overlook.

## The solution
DockProof turns document uploads into a completed operational workflow:

1. **Upload** a text-based purchase order and delivery note; an invoice is optional for the hackathon MVP.
2. **Extract** line items and retain source snippets and page references.
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
- **Storage:** SQLite.
- **PDF extraction:** PyMuPDF for text-based PDFs.
- **Matching:** normalization, RapidFuzz, and Ollama with **Qwen3 1.7B** (small open-weight model, Apache 2.0 model-family license; check the specific model distribution before redistribution).
- **Execution:** locally on a developer laptop, without paid AI APIs or complex infrastructure.

## Scope for a four-hour hackathon
### Must work
- Upload a purchase order and delivery note.
- Extract or load validated line items from those documents.
- Use the local AI model to match at least one ambiguous product description.
- Identify a genuine quantity mismatch using deterministic calculations.
- Show evidence and create a persisted draft discrepancy claim.
- Require explicit user approval before finalizing the claim.
- Demonstrate the workflow repeatedly with synthetic fixtures.

### Only if time remains
Invoice comparison, scanned-document OCR, email sending, external supplier integrations, ERP connections, complex authentication, or multi-user deployment.

## Live demo (60–90 seconds)
1. Upload two synthetic documents with inconsistent product descriptions.
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

## Potential after the hackathon
Add invoice reconciliation, OCR, accounting/POS integrations, supplier-specific catalogs, claim delivery and status tracking, multi-location receiving, and measurable recovery of shortages and overcharges.

## Development guidance
See [`AGENTS.md`](AGENTS.md) for shared agent instructions and [`CLAUDE.md`](CLAUDE.md) for Claude Code-specific behavior. Both prioritize the smallest reliable end-to-end workflow over architectural complexity.
