// This is a scope/eligibility guard beside the pinned public quote-estimator v2
// pricing model. It is not a new pricing multiplier or an audit-cost estimate.
const allowed = Object.freeze({
  systemsInScope: ['one', 'two-to-five', 'six-plus', 'unsure'],
  readinessBaseline: ['established', 'partial', 'new', 'unsure'],
  dataExposure: ['business', 'sensitive', 'regulated', 'unsure'],
});

export const scopeDefaults = Object.freeze({
  systemsInScope: 'two-to-five',
  readinessBaseline: 'partial',
  dataExposure: 'business',
});

export const qualifyQuoteScope = (raw, selection) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      !selection || typeof selection !== 'object' || Array.isArray(selection)) {
    throw new Error('invalid_quote_scope');
  }
  const keys = Object.keys(raw);
  if (keys.length !== Object.keys(allowed).length ||
      keys.some((key) => !Object.hasOwn(allowed, key)) ||
      Object.entries(allowed).some(([key, values]) => !values.includes(raw[key]))) {
    throw new Error('invalid_quote_scope');
  }
  if (!Array.isArray(selection.standardIds) ||
      selection.standardIds.some((id) => typeof id !== 'string')) {
    throw new Error('invalid_quote_scope');
  }
  const reasons = [];
  if (selection.standardIds.includes('fedramp')) reasons.push('Federal/FedRAMP work');
  if (raw.systemsInScope === 'six-plus') reasons.push('Six or more production systems');
  if (raw.systemsInScope === 'unsure') reasons.push('Unverified system boundary');
  if (raw.readinessBaseline === 'unsure') reasons.push('Unknown control maturity');
  if (raw.dataExposure === 'unsure') reasons.push('Unverified data classification');
  if (raw.readinessBaseline === 'new' && selection.deliveryDepthId !== 'advisory') {
    reasons.push('New program with operational delivery');
  }
  if (raw.dataExposure === 'regulated' && selection.deliveryDepthId === 'remediation') {
    reasons.push('Regulated-data engineering remediation');
  }
  return {
    requiresCustomScoping: reasons.length > 0,
    reasons,
    labels: {
      systemsInScope: {
        one: 'One production system',
        'two-to-five': '2–5 production systems',
        'six-plus': '6+ production systems',
        unsure: 'System count not yet known',
      }[raw.systemsInScope],
      readinessBaseline: {
        established: 'Established controls and evidence',
        partial: 'Some controls and evidence',
        new: 'Starting from scratch',
        unsure: 'Control maturity not yet known',
      }[raw.readinessBaseline],
      dataExposure: {
        business: 'Standard business data',
        sensitive: 'Personal or sensitive data',
        regulated: 'Regulated data in production',
        unsure: 'Data classification not yet known',
      }[raw.dataExposure],
    },
  };
};
