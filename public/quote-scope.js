// Public scoping qualification; NO new unreviewed price factors.
// This module is identical on the browser and Supabase edges by contract test.
export const scopeSchema = {
  "scopeSchemaVersion": 1,
  "fields": [
    {
      "key": "cloudAccountBand",
      "name": "quote_cloud_account_band",
      "label": "Cloud accounts / production environments",
      "defaultId": "1-2",
      "options": [
        {
          "id": "1-2",
          "label": "1–2"
        },
        {
          "id": "3-10",
          "label": "3–10"
        },
        {
          "id": "11-plus",
          "label": "11 or more"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    },
    {
      "key": "productionSystems",
      "name": "quote_production_systems",
      "label": "Production systems in scope",
      "defaultId": "2-5",
      "options": [
        {
          "id": "one",
          "label": "One production system"
        },
        {
          "id": "2-5",
          "label": "2–5 production systems"
        },
        {
          "id": "6-plus",
          "label": "6 or more production systems"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    },
    {
      "key": "evidenceMaturity",
      "name": "quote_evidence_maturity",
      "label": "Current control evidence",
      "defaultId": "partial",
      "options": [
        {
          "id": "organized",
          "label": "Mostly organized and current"
        },
        {
          "id": "partial",
          "label": "Some organized; gaps remain"
        },
        {
          "id": "early",
          "label": "Mostly missing / starting from scratch"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    },
    {
      "key": "controlOwnerBand",
      "name": "quote_control_owner_band",
      "label": "Control owners / stakeholders",
      "defaultId": "1-5",
      "options": [
        {
          "id": "1-5",
          "label": "1–5"
        },
        {
          "id": "6-20",
          "label": "6–20"
        },
        {
          "id": "21-plus",
          "label": "21 or more"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    },
    {
      "key": "dataFootprint",
      "name": "quote_data_footprint",
      "label": "Regulatory / jurisdiction footprint",
      "defaultId": "single",
      "options": [
        {
          "id": "single",
          "label": "One primary jurisdiction / entity"
        },
        {
          "id": "multi",
          "label": "Several regions, one legal entity"
        },
        {
          "id": "multi-regulated",
          "label": "Several regulated entities / jurisdictions"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    },
    {
      "key": "dataExposure",
      "name": "quote_data_exposure",
      "label": "Production data classification",
      "defaultId": "business",
      "options": [
        {
          "id": "business",
          "label": "Standard business data"
        },
        {
          "id": "sensitive",
          "label": "Personal / sensitive data"
        },
        {
          "id": "regulated",
          "label": "Regulated data in production"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    },
    {
      "key": "remediationLoad",
      "name": "quote_remediation_load",
      "label": "Expected technical remediation",
      "defaultId": "moderate",
      "options": [
        {
          "id": "light",
          "label": "Advisory / minor fixes"
        },
        {
          "id": "moderate",
          "label": "Some implementation work"
        },
        {
          "id": "heavy",
          "label": "Substantial implementation / overhaul"
        },
        {
          "id": "unknown",
          "label": "Not sure yet"
        }
      ]
    }
  ]
};

export const validateScope = (raw) => {
  if (raw === undefined) return null; // Older clients: keep wire compatibility during rollout.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_quote_selection');
  const expected = scopeSchema.fields.map((field) => field.key);
  if (Object.keys(raw).length !== expected.length || Object.keys(raw).some((key) => !expected.includes(key))) {
    throw new Error('invalid_quote_selection');
  }
  for (const field of scopeSchema.fields) {
    if (typeof raw[field.key] !== 'string' || !field.options.some((option) => option.id === raw[field.key])) {
      throw new Error('invalid_quote_selection');
    }
  }
  return Object.fromEntries(expected.map((key) => [key, raw[key]]));
};

export const scopeLabels = (scope) => scope
  ? scopeSchema.fields.map((field) => ({
      name: field.label,
      value: field.options.find((item) => item.id === scope[field.key])?.label || '',
    }))
  : [];

// Return the reason, not an invented large-project surcharge. Apply the same
// policy in the browser and on the authoritative server.
export const customScopeReason = (selection, rawMidpoint, config) => {
  if (selection.standardIds.includes('fedramp')) return 'FedRAMP and federal authorization work require a separate scoped proposal.';
  const scope = selection.scope;
  if (scope) {
    if (Object.values(scope).includes('unknown')) return 'Some scope assumptions are unknown; please request a reviewed proposal.';
    if (scope.productionSystems === '6-plus') return 'Six or more production systems need a reviewed engagement boundary.';
    if (scope.evidenceMaturity === 'early' && selection.deliveryDepthId !== 'advisory') return 'A new program with managed operations or implementation needs a tailored statement of work.';
    if (scope.dataExposure === 'regulated' && selection.deliveryDepthId === 'remediation') return 'Remediation of regulated production data needs a tailored technical assessment.';
    if (scope.cloudAccountBand === '11-plus') return 'More than ten cloud environments need a system inventory and custom scope.';
    if (scope.controlOwnerBand === '21-plus') return 'More than twenty control owners require custom delivery planning.';
    if (scope.dataFootprint === 'multi-regulated') return 'Multiple regulated entities or jurisdictions require bespoke scoping.';
    if (scope.evidenceMaturity === 'early' && selection.speedWeeks === 3) return 'A three-week deadline with little existing evidence needs a feasibility review.';
    if (scope.remediationLoad === 'heavy' && selection.deliveryDepthId === 'remediation') return 'Substantial hands-on remediation must be scoped from an implementation backlog.';
  }
  if (selection.employeeBandId === '1001-plus' && selection.complexityId === 'complex') {
    return 'Large regulated enterprise programs require a tailored statement of work.';
  }
  if (rawMidpoint > config.midpointCeilingUsd || rawMidpoint * config.upperFactor > config.estimateCeilingUsd) {
    return 'The modeled effort exceeds the published estimator range; request a tailored proposal.';
  }
  return '';
};
