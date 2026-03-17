// upBylawEngine.js — ES Module port of Rule_Engine_Implementation.js

const OPERATORS = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>':  (a, b) => a > b,
  '<':  (a, b) => a < b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  'in':      (a, b) => Array.isArray(b) && b.includes(a),
  'not_in':  (a, b) => Array.isArray(b) && !b.includes(a),
  'between': (a, b) => Array.isArray(b) && b.length === 2 && a >= b[0] && a <= b[1],
};

function resolveField(fieldPath, proposal) {
  if (!fieldPath) return undefined;
  return fieldPath.split('.').reduce((obj, key) => obj != null ? obj[key] : undefined, proposal);
}

function evaluateCondition(condition, proposal) {
  if (!condition) return true;
  if (condition.operator === 'AND' && Array.isArray(condition.conditions)) return condition.conditions.every(c => evaluateCondition(c, proposal));
  if (condition.operator === 'OR' && Array.isArray(condition.conditions)) return condition.conditions.some(c => evaluateCondition(c, proposal));
  const fieldValue = resolveField(condition.field, proposal);
  if (fieldValue === undefined || fieldValue === null) return false;
  const op = OPERATORS[condition.operator];
  if (!op) return false;
  return op(fieldValue, condition.value);
}

function calculateDerivedValues(proposal) {
  const p = { ...proposal };
  if (p.totalFloorArea != null && p.netPlotArea != null && p.netPlotArea > 0) p.FAR = p.totalFloorArea / p.netPlotArea;
  if (p.footprintArea != null && p.plotArea != null && p.plotArea > 0) p.groundCoverage = (p.footprintArea / p.plotArea) * 100;
  if (p.netPlotArea == null && p.plotArea != null) p.netPlotArea = p.plotArea - (p.roadWideningArea || 0);
  if (p.numberOfStoreys == null && p.proposedHeight != null) p.numberOfStoreys = Math.ceil(p.proposedHeight / 3.5);
  if (p.primaryRoadWidth == null && p.roads && p.roads.length > 0) p.primaryRoadWidth = Math.max(...p.roads.map(r => r.proposedWidth || r.width || 0));
  if (p.plotWidth == null && p.plotLength != null && p.plotArea != null) p.plotWidth = p.plotArea / p.plotLength;
  return p;
}

function isRuleApplicable(rule, proposal) {
  if (rule.building_type?.length > 0 && !rule.building_type.includes(proposal.building_type)) return false;
  if (rule.land_use?.length > 0 && !rule.land_use.includes(proposal.land_use)) return false;
  return true;
}

function evaluateConstraint(rule, proposal) {
  if (rule.condition && !evaluateCondition(rule.condition, proposal)) return { applies: false };
  const param = rule.parameter;
  const actualValue = resolveField(param.name, proposal);
  if (actualValue === undefined || actualValue === null) {
    return { applies: true, rule_id: rule.rule_id, rule_name: rule.rule_name, section: rule.section, severity: rule.severity, status: 'skipped', message: `Field "${param.name}" not provided — rule skipped.`, required: param.value, actual: null, unit: param.unit, parameter: param.name };
  }
  const op = OPERATORS[param.operator];
  const passed = op ? op(actualValue, param.value) : false;
  return {
    applies: true, rule_id: rule.rule_id, rule_name: rule.rule_name, section: rule.section,
    severity: passed ? 'pass' : rule.severity,
    status: passed ? 'pass' : 'fail',
    message: passed ? `✔ ${rule.rule_name}: ${actualValue} ${param.operator} ${param.value} ${param.unit} — OK` : `✖ ${rule.message}  (Provided: ${actualValue} ${param.unit}, Required: ${param.operator} ${param.value} ${param.unit})`,
    required: param.value, operator: param.operator, actual: actualValue, unit: param.unit, parameter: param.name, notes: rule.notes || '',
  };
}

export class UPBylawRuleEngine {
  constructor(rulesData) {
    this.rules = rulesData?.rules || [];
    this.meta  = rulesData?._meta || {};
    this.defs  = rulesData?.definitions || {};
    this.calcs = rulesData?.calculations || {};
    this.perms = rulesData?.permissibility_matrix || {};
    this._auditLog = [];
  }

  validateBuilding(proposal) {
    const enriched = calculateDerivedValues(proposal);
    const errors = [], warnings = [], infos = [], skipped = [], passed = [];
    const applicable = this.rules.filter(r => isRuleApplicable(r, enriched));
    applicable.forEach(rule => {
      let result;
      try { result = evaluateConstraint(rule, enriched); }
      catch (err) { result = { applies: true, rule_id: rule.rule_id, rule_name: rule.rule_name, section: rule.section, severity: 'error', status: 'engine_error', message: `Rule engine error: ${err.message}`, actual: null, required: null, unit: '', parameter: '' }; }
      if (!result.applies) return;
      if (result.status === 'skipped') { skipped.push(result); return; }
      if (result.status === 'pass') { passed.push(result); return; }
      switch (result.severity) {
        case 'error': errors.push(result); break;
        case 'warning': warnings.push(result); break;
        case 'info': infos.push(result); break;
        default: errors.push(result);
      }
    });
    const isValid = errors.length === 0;
    const validationId = 'VAL-' + Date.now().toString(36).toUpperCase();
    const summary = { validationId, timestamp: new Date().toISOString(), isValid, totalRules: applicable.length, passed: passed.length, errors: errors.length, warnings: warnings.length, infos: infos.length, skipped: skipped.length, building_type: enriched.building_type, land_use: enriched.land_use, plotArea: enriched.plotArea, FAR: enriched.FAR?.toFixed(2) || 'N/A', groundCoverage: enriched.groundCoverage?.toFixed(1) || 'N/A', proposedHeight: enriched.proposedHeight };
    this._auditLog.push({ ...summary, proposal: enriched });
    return { validationId, isValid, summary, errors, warnings, infos, skipped, passed, derivedValues: { FAR: enriched.FAR, groundCoverage: enriched.groundCoverage, netPlotArea: enriched.netPlotArea, numberOfStoreys: enriched.numberOfStoreys }, report: [...errors, ...warnings, ...infos, ...passed].filter(r => r).sort((a, b) => (a.section || '').localeCompare(b.section || '')) };
  }

  checkPermissibility(proposal) {
    const zone = proposal.zoneType || proposal.land_use || 'residential_zone';
    const key = zone.toLowerCase().replace(/\s+/g, '_') + '_zone';
    const zoneRules = this.perms[key] || this.perms['residential_zone'];
    if (!zoneRules) return { permitted: true, note: 'Zone not found in permissibility matrix' };
    const bt = proposal.building_type;
    if (zoneRules.prohibited?.includes(bt)) return { permitted: false, type: 'prohibited', message: `Building type "${bt}" is PROHIBITED in zone "${zone}".` };
    if (zoneRules.conditional?.includes(bt)) return { permitted: null, type: 'conditional', message: `Building type "${bt}" is CONDITIONALLY permitted in zone "${zone}".` };
    if (zoneRules.permitted?.includes(bt)) return { permitted: true, type: 'as_of_right', message: `Building type "${bt}" is permitted in zone "${zone}".` };
    return { permitted: false, type: 'not_listed', message: `Building type "${bt}" is NOT listed in zone "${zone}".` };
  }

  getApplicableRules(proposal) {
    return this.rules.filter(r => isRuleApplicable(r, calculateDerivedValues(proposal)));
  }

  getRulesBySection(section) {
    return this.rules.filter(r => r.section === section || r.section.startsWith(section));
  }

  getAuditLog(limit = 20) { return this._auditLog.slice(-limit); }
  clearAuditLog() { this._auditLog = []; }

  getStats() {
    const bySection = {}, bySeverity = {};
    this.rules.forEach(r => { bySection[r.section] = (bySection[r.section] || 0) + 1; bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1; });
    return { totalRules: this.rules.length, bySection, bySeverity, extraction: this.meta.extraction_status || {} };
  }
}

UPBylawRuleEngine.createProposal = function ({ building_type = 'single_unit', land_use = 'Residential', plotArea = 0, plotWidth = null, plotLength = null, proposedHeight = 0, totalFloorArea = 0, footprintArea = null, primaryRoadWidth = null, roads = [], roadWideningArea = 0, netPlotArea = null, parkingECS = null, numberOfStoreys = null, basementAllowed = false, basementDepth = 0, openSpacePercent = null, carpetAreaPerUnit = null, zoneType = null, overrides = {} } = {}) {
  return { building_type, land_use, plotArea, plotWidth, plotLength, proposedHeight, totalFloorArea, footprintArea, primaryRoadWidth, roads, roadWideningArea, netPlotArea, parkingECS, numberOfStoreys, basementAllowed, basementDepth, openSpacePercent, carpetAreaPerUnit, zoneType, overrides };
};

UPBylawRuleEngine.fromDashboardState = function (state, rulesData) {
  const engine = new UPBylawRuleEngine(rulesData);
  const roads = state.roads || [];
  const primaryRoadWidth = roads.length > 0 ? Math.max(...roads.map(r => parseFloat(r.proposedWidth) || parseFloat(r.width) || 0)) : 0;
  const plotArea = parseFloat(state.geometry?.area) || 0;
  const proposal = UPBylawRuleEngine.createProposal({ building_type: state.developmentType === 'plotted_single' ? 'single_unit' : 'multi_unit', land_use: state.landUse || 'Residential', plotArea, proposedHeight: parseFloat(state.proposedHeight) || 0, primaryRoadWidth, roads, roadWideningArea: state.geometry?.surrenderedArea || 0 });
  return { engine, proposal, result: engine.validateBuilding(proposal) };
};
