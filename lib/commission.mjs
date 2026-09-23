/** Pure evaluation only. Call from trusted reconciliation code, never a public client.
 * Amounts are decimal integer strings in a SINGLE settlement currency.
 * A result is NOT a disbursement instruction or authority to pay.
 */
export function evaluateCommission(input, now = new Date()) {
  const hold = reason => ({status: 'held', reason, payableMinor: '0'});
  if (!input?.purchase) return {status: 'attribution_only', payableMinor: '0'};
  const {purchase: p, settlement: s, terms: t} = input;
  const validTime = value => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  const past = value => validTime(value) && Date.parse(value) <= now.getTime();
  if (!Number.isFinite(now.getTime())) return hold('invalid_clock');
  if (!p.verified || !p.transactionId || !p.verifiedCustomerId || !p.attributionVerified || !past(p.purchasedAt)) return hold('purchase_or_attribution_unverified');
  if (!t?.approvedVersion || !t.entitlementVerified || !Number.isInteger(t.rateBps) || t.rateBps < 0 || t.rateBps > 10000 || t.rounding !== 'floor') return hold('commercial_terms_unapproved');
  if (!s?.reportId || !s.bankReference || !s.allocationId || s.transactionId !== p.transactionId || !s.reconciled) return hold('settlement_unreconciled');
  if (!past(s.platformPeriodCompletedAt)) return hold('platform_period_incomplete');
  if (!past(s.receivedAt) || !past(s.clearedAt)) return hold('revenue_not_received_and_cleared');
  if (Date.parse(s.receivedAt) < Date.parse(p.purchasedAt) || Date.parse(s.clearedAt) < Date.parse(s.receivedAt)) return hold('invalid_evidence_order');
  if (!/^[A-Z]{3}$/.test(p.currency) || p.currency !== s.currency) return hold('currency_mismatch');
  if (input.disputeOpen) return hold('dispute_open');
  try {
    const money = x => { if (typeof x !== 'string' || !/^\d+$/.test(x)) throw Error(); return BigInt(x); };
    // Gross allocation is limited to this transaction's received/cleared portion.
    // For platform-net inputs, the adapter must expand and reconcile to this gross basis first.
    if (s.basis !== 'gross_allocated') return hold('unsupported_accounting_basis');
    const gross = money(s.grossMinor);
    const deducted = ['refundMinor','reversalMinor','chargebackMinor','taxMinor','platformFeeMinor'].map(k => money(s[k])).reduce((a,b) => a+b, 0n);
    if (!s.exclusionsReconciled || deducted > gross) return hold('exclusions_unreconciled');
    const net = gross - deducted;
    if (net > money(s.clearedNetMinor)) return hold('net_exceeds_cleared_allocation');
    const entitlement = net * BigInt(t.rateBps) / 10000n;
    const paid = money(input.alreadyPaidMinor);
    if (paid > entitlement) return {status:'adjustment_review', payableMinor:'0', overpaidMinor:(paid-entitlement).toString()};
    return {status:'payable', netMinor:net.toString(), payableMinor:(entitlement-paid).toString(), termsVersion:t.approvedVersion, allocationId:s.allocationId};
  } catch { return hold('invalid_money'); }
}
