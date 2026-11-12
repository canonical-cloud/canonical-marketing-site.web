// This is a scope/eligibility guard beside the pinned public quote-estimator v2
// pricing model. It is not a new pricing multiplier or an audit-cost estimate.
const allowed = Object.freeze({
  systemsInScope: ['one', 'two-to-five', 'six-plus', 'unsure'],
  readinessBaseline: ['established', 'partial', 'new', 'unsure'],
  dataExposure: ['business', 'sensitive', 'regulated', 'unsure'],
  cloudAccountBand: ['1-2', '3-10', '11-plus', 'unknown'],
  controlOwnerBand: ['1-5', '6-20', '21-plus', 'unknown'],
  dataFootprint: ['single', 'multi', 'multi-regulated', 'unknown'],
  remediationLoad: ['light', 'moderate', 'heavy', 'unknown'],
});

export const scopeDefaults = Object.freeze({
  systemsInScope: 'two-to-five',
  readinessBaseline: 'partial',
  dataExposure: 'business',
  cloudAccountBand: '1-2',
  controlOwnerBand: '1-5',
  dataFootprint: 'single',
  remediationLoad: 'moderate',
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
  if (raw.cloudAccountBand === '11-plus') reasons.push('Eleven or more cloud accounts');
  if (raw.cloudAccountBand === 'unknown') reasons.push('Cloud-account boundary not yet known');
  if (raw.controlOwnerBand === '21-plus') reasons.push('More than 20 control owners');
  if (raw.controlOwnerBand === 'unknown') reasons.push('Control-owner count not yet known');
  if (raw.dataFootprint === 'multi-regulated') reasons.push('Multiple regulated entities or jurisdictions');
  if (raw.dataFootprint === 'unknown') reasons.push('Regulatory footprint not yet known');
  if (raw.remediationLoad === 'unknown') reasons.push('Remediation effort not yet known');
  if (raw.readinessBaseline === 'new' && selection.deliveryDepthId !== 'advisory') {
    reasons.push('New program with operational delivery');
  }
  if (raw.dataExposure === 'regulated' && selection.deliveryDepthId === 'remediation') {
    reasons.push('Regulated-data engineering remediation');
  }
  if (raw.remediationLoad === 'heavy' && selection.deliveryDepthId === 'remediation') {
    reasons.push('Substantial technical remediation');
  }
  if (raw.readinessBaseline === 'new' && selection.speedWeeks <= 3) {
    reasons.push('Accelerated delivery without an established control program');
  }
  if (selection.companyStageId === 'enterprise' && selection.employeeBandId === '1001-plus' &&
      selection.complexityId === 'complex') {
    reasons.push('Large, complex enterprise scope');
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
      cloudAccountBand: {
        '1-2': '1–2 cloud accounts',
        '3-10': '3–10 cloud accounts',
        '11-plus': '11+ cloud accounts',
        unknown: 'Cloud-account count not yet known',
      }[raw.cloudAccountBand],
      controlOwnerBand: {
        '1-5': '1–5 control owners',
        '6-20': '6–20 control owners',
        '21-plus': '21+ control owners',
        unknown: 'Control-owner count not yet known',
      }[raw.controlOwnerBand],
      dataFootprint: {
        single: 'One primary entity/jurisdiction',
        multi: 'Multiple regions, one legal entity',
        'multi-regulated': 'Multiple regulated entities/jurisdictions',
        unknown: 'Regulatory footprint not yet known',
      }[raw.dataFootprint],
      remediationLoad: {
        light: 'Advisory or minor fixes',
        moderate: 'Some implementation work',
        heavy: 'Substantial technical implementation',
        unknown: 'Technical remediation not yet known',
      }[raw.remediationLoad],
    },
  };
};
