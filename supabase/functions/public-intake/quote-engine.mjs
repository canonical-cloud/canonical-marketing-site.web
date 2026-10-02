import quoteConfig from './quote-estimator.v2.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundMoney = (value) => Math.round(value / quoteConfig.roundToUsd) * quoteConfig.roundToUsd;

const itemById = (items, id) =>
  typeof id === 'string' ? items.find((item) => item.id === id) : undefined;

export const computeQuote = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('invalid_quote_selection');
  }
  const scope = raw;
  const allowedKeys = new Set([
    'speedWeeks',
    'standardIds',
    'deliveryDepthId',
    'complexityId',
    'companyStageId',
    'employeeBandId',
    'sectorId',
  ]);
  if (Object.keys(scope).some((key) => !allowedKeys.has(key))) {
    throw new Error('invalid_quote_selection');
  }

  if (!Number.isInteger(scope.speedWeeks)) {
    throw new Error('invalid_quote_selection');
  }
  const speedWeeks = scope.speedWeeks;
  const speed = quoteConfig.speeds.find((item) => item.weeks === speedWeeks);
  const depth = itemById(quoteConfig.deliveryDepths, scope.deliveryDepthId);
  const complexity = itemById(quoteConfig.complexities, scope.complexityId);
  const stage = itemById(quoteConfig.companyStages, scope.companyStageId);
  const employees = itemById(quoteConfig.employeeBands, scope.employeeBandId);
  const sector = itemById(quoteConfig.sectors, scope.sectorId);

  if (
    !Array.isArray(scope.standardIds) ||
    scope.standardIds.length < 1 ||
    !scope.standardIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    throw new Error('invalid_quote_selection');
  }
  const standardIds = scope.standardIds;
  const uniqueStandardIds = [...new Set(standardIds)];
  const standards = uniqueStandardIds
    .map((id) => itemById(quoteConfig.standards, id))
    .filter(Boolean);

  if (
    !speed || !depth || !complexity || !stage || !employees || !sector ||
    uniqueStandardIds.length < 1 ||
    uniqueStandardIds.length !== standardIds.length ||
    standards.length !== uniqueStandardIds.length
  ) {
    throw new Error('invalid_quote_selection');
  }

  const additive =
    speed.baseUsd +
    standards.reduce((sum, item) => sum + item.amountUsd, 0) +
    depth.amountUsd +
    complexity.amountUsd +
    employees.amountUsd +
    sector.amountUsd;

  const midpoint = clamp(
    additive * stage.multiplier,
    quoteConfig.midpointFloorUsd,
    quoteConfig.midpointCeilingUsd,
  );
  const lowerUsd = clamp(
    roundMoney(midpoint * quoteConfig.lowerFactor),
    quoteConfig.estimateFloorUsd,
    quoteConfig.estimateCeilingUsd,
  );
  const upperUsd = clamp(
    roundMoney(midpoint * quoteConfig.upperFactor),
    lowerUsd,
    quoteConfig.estimateCeilingUsd,
  );

  const labels = {
    deliverySpeed: speed.label,
    standards: standards.map((item) => item.label),
    serviceDepth: depth.label,
    complexity: complexity.label,
    companyStage: stage.label,
    employeeBand: employees.label,
    sector: sector.label,
  };

  return {
    selection: {
      speedWeeks,
      standardIds: uniqueStandardIds,
      deliveryDepthId: depth.id,
      complexityId: complexity.id,
      companyStageId: stage.id,
      employeeBandId: employees.id,
      sectorId: sector.id,
    },
    labels,
    range: { lowerUsd, upperUsd, currency: quoteConfig.currency },
    summary: [
      labels.deliverySpeed,
      labels.standards.join(' + '),
      labels.serviceDepth,
      labels.complexity,
      labels.companyStage,
      labels.employeeBand,
      labels.sector,
    ].join(' · '),
  };
};
