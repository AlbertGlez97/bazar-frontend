# Historical distribution agreements

Active socios in Gestión can confirm an accepted simulation as an immutable agreement, read its history, void it with a reason, create a linked replacement, and generate a snapshot PDF. No operation registers payments or changes financial source records.

## Quick path

1. Simulate and review the current result. Calculation alone persists nothing.
2. Open Crear acuerdo de reparto, enter a required title and optional note, review and explicitly confirm.
3. Read the confirmed folio in Acuerdos. Generate PDF requests fresh authoritative detail before exporting.
4. Correct by voiding with a required reason, then creating a replacement from a new simulation.

## Contract boundaries

| Area | Behavior |
| --- | --- |
| Contract | See ../bazar-api/doc/finance-distribution-agreements.md. UUIDv7, exclusive period end, sim1 fingerprint, strict body, active/voided only. |
| Freshness | Pending edits, errors, failed calculations, changed financial base, offline state and drift block new confirmation. |
| Exact replay | Uncertain create/reversal bodies retain identity, time and origin in memory. Manual retry sends the original body; no automatic sends or offline queue. |
| Session | Account/API/member/device/token changes reset memory and invalidate late replies. UI-mode navigation does not discard uncertain identity. |
| Immutability | Detail and PDF use frozen participants, amounts, rule, work and warnings. Live status/reversal/replacement references come from authoritative detail. |
| Replacement | A route ID is validated and fetched. Only a voided unreplaced target can be attached; its folio is reviewed before a fresh calculation/confirmation. Backend 422 remains authoritative. |
| PDF | Pure A4 definition; installed pdfmake and fonts load only on demand. Download is a temporary Blob URL named acuerdo-<sanitized-folio>.pdf. No PDF persistence or simulation request. |

## PDF content and limits

The LA MARCHANTA heading is application branding, not a historical business-name field. The backend snapshot provides no business name; the PDF labels its context identifier honestly instead of inserting the current business name.

The PDF includes folio, title/note, original dates and period, financial base/status, requested amount, percentages, EQUAL partner mode, work basis/pools, frozen participant names/roles/active flags/work/component amounts, stored totals, human warning labels, exact stored notice, and blank handwritten signature/date spaces for every participant. ANULADO and its actual reason/date appear prominently and in repeated headers. Signatures are not automatically filled or digitally recorded.

Export always refreshes live detail. If refresh fails or the selection/session changes while generation is pending, no stale active PDF is downloaded. A local PDF represents status at the successful detail read, not future reversals; externally saved copies cannot update automatically. The document is not a payment, withdrawal, transfer or legal-contract promise. Legal effect depends on context and applicable law; this feature offers no legal advice.

## Local evidence and integrated checklist

Fixture PDFs and unit tests do not establish real backend integration or legal effect.

- [ ] Real authorized test: simulate, confirm, list/detail and export without source financial changes.
- [ ] Change source data after simulation: observe drift, no creation, recalculate/reconfirm.
- [ ] Lose a create/reversal response: exact manual retry returns the original identity/folio.
- [ ] Void and replace: authoritative status/reason and bidirectional references; allocations unchanged.
- [ ] Export active, voided, partial and long documents; inspect all pages, accents, headers and signatures.
- [ ] Verify keyboard focus, offline/session restrictions and layouts at 320/390/768/1280 pixels.
- [ ] Confirm PDF Blob/URL is not persisted and no payment/withdrawal/transfer is created.

## Review and rollback boundary

Review pure PDF definition/render tests, guarded store export, view actions and help articles. Removing the PDF service/export/UI/help additions does not remove agreements or alter A1-A4 allocations/history. Backend mutation, payment handling, Phase 6 and deployment remain out of scope.
