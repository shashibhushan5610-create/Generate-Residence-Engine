// rule-engine.js
window.RuleEngine = (function () {

    let authoritiesData = window.AUTHORITIES_DATA ? window.AUTHORITIES_DATA.authorities : null;

    /**
     * Loads the authority configuration.
     */
    function loadAuthorities() {
        // Already loaded via authorities-data.js
        authoritiesData = window.AUTHORITIES_DATA ? window.AUTHORITIES_DATA.authorities : null;
        return Promise.resolve(authoritiesData);
    }

    /**
     * Calculates rules based on area, land use, and roads.
     */
    function calculateRules(authorityId, landUse, plotAreaSqm, roads, options = {}) {
        const { developmentType = 'plotted_single', proposedHeight = 0, isCornerPlot = false } = options;

        if (!authoritiesData || !authoritiesData[authorityId]) {
            return { error: `Authority '${authorityId}' not found.` };
        }

        const auth = authoritiesData[authorityId];
        const authRules = auth.rules;
        if (!authRules || !authRules[landUse]) {
            return { error: `Land Use '${landUse}' not defined for Authority '${authorityId}'.` };
        }

        const rules = authRules[landUse];
        const report = { status: "Passed", errors: [], warnings: [] };

        // 1. Feasibility Check (UP Comprehensive)
        if (auth.type === 'comprehensive' && rules.feasibility) {
            const feat = rules.feasibility[developmentType];
            if (feat) {
                if (plotAreaSqm < feat.minArea) report.errors.push(`Plot Area ${plotAreaSqm} fails min ${feat.minArea} requirement.`);
                const maxRoad = roads && roads.length > 0 ? Math.max(...roads.map(r => r.width)) : 0;
                if (maxRoad < feat.minRoad) report.errors.push(`Road Width ${maxRoad} fails min ${feat.minRoad} requirement.`);
            }
        }

        // 2. Resolve Setbacks
        let finalSetbacks = { front: 0, rear: 0, side1: 0, side2: 0 };

        // Priority Logic: Height Safety Override
        let heightOverrideActive = false;
        if (auth.type === 'comprehensive' && rules.heightSafetySetbacks && proposedHeight >= 15.0) {
            let safetyVal = 7.0; // Base for >27m
            for (const hSet of rules.heightSafetySetbacks) {
                if (proposedHeight >= hSet.minH && proposedHeight < hSet.maxH) {
                    safetyVal = hSet.val;
                    break;
                }
            }
            if (proposedHeight >= 21.0) {
                const increments = Math.floor((proposedHeight - 21.0) / 6.0);
                safetyVal = 7.0 + increments;
            }
            finalSetbacks = { front: safetyVal, rear: safetyVal, side1: safetyVal, side2: safetyVal };
            heightOverrideActive = true;
        }

        // Area-based Setbacks (if no height override)
        if (!heightOverrideActive) {
            if (rules.areaThresholds) {
                for (const threshold of rules.areaThresholds) {
                    const minOk = threshold.min === undefined || plotAreaSqm >= threshold.min;
                    const maxOk = threshold.max === undefined || plotAreaSqm < threshold.max;
                    if (minOk && maxOk) {
                        finalSetbacks = { ...threshold.setbacks };
                        break;
                    }
                }
            } else if (rules.setbacks) {
                finalSetbacks = {
                    front: rules.setbacks.front.min,
                    rear: rules.setbacks.rear.min,
                    side1: rules.setbacks.side1.min,
                    side2: rules.setbacks.side2.min
                };
            }
        }

        // Road-Facing Side Rule: Any side that has a road must get at least the front setback.
        // This handles both corner plots and any non-standard configuration where a road
        // is on the side or rear direction. Automatically applies if there are multiple roads.
        if (roads && roads.length > 0 && (isCornerPlot || roads.length > 1)) {
            const { primaryRoadSideIndex, nSides: n = 4 } = options;
            const primaryIdx = primaryRoadSideIndex !== undefined
                ? primaryRoadSideIndex
                : (roads[0]?.sideIndex ?? 0);
            roads.forEach(road => {
                const sIdx = road.sideIndex;
                if (sIdx === undefined || sIdx === primaryIdx) return; // primary front already set
                const offset = (sIdx - primaryIdx + n) % n;
                if (offset === 1) {
                    finalSetbacks.side1 = Math.max(finalSetbacks.side1, finalSetbacks.front);
                } else if (offset === n - 1) {
                    finalSetbacks.side2 = Math.max(finalSetbacks.side2, finalSetbacks.front);
                } else if (offset === 2 && n >= 4) {
                    // Road is on the rear — rear also gets at least front setback
                    finalSetbacks.rear = Math.max(finalSetbacks.rear, finalSetbacks.front);
                } else {
                    // Fallback for unusual topologies
                    finalSetbacks.side1 = Math.max(finalSetbacks.side1, finalSetbacks.front);
                }
            });
        }

        // 3. FAR Logic (Telescopic vs Flat)
        let effectiveBaseFAR = rules.maxFAR || 0;
        let maxPurchasableFAR = rules.maxFAR || 0;

        if (rules.telescopicFAR) {
            let remainingArea = plotAreaSqm;
            let permissibleFloorArea = 0.0;
            for (const slice of rules.telescopicFAR) {
                if (remainingArea <= 0) break;
                const sliceArea = Math.min(remainingArea, slice.limit);
                permissibleFloorArea += sliceArea * slice.multiplier;
                remainingArea -= sliceArea;
            }
            effectiveBaseFAR = permissibleFloorArea / plotAreaSqm;
            maxPurchasableFAR = plotAreaSqm < 150 ? (rules.maxPurchasableFAR?.tiny || 2.25) : (rules.maxPurchasableFAR?.regular || 2.50);
        }

        const maxBuiltUpArea = plotAreaSqm * effectiveBaseFAR;
        const maxGroundCoverageArea = plotAreaSqm * (rules.maxGroundCoverage / 100 || 0.6);

        // 4. Parking (ECS)
        let ecsRequiredCount = 0;
        if (rules.parking && Array.isArray(rules.parking)) {
            let ecsPerUnit = 1.0;
            for (const p of rules.parking) {
                if (plotAreaSqm < (p.max || Infinity)) {
                    ecsPerUnit = p.ecs;
                    break;
                }
            }
            ecsRequiredCount = Math.ceil(ecsPerUnit * (options.totalUnits || 1));
        } else {
            ecsRequiredCount = Math.ceil((maxBuiltUpArea / 100) * (rules.parkingRequirementPer100Sqm || 1));
        }

        return {
            authorityName: auth.name,
            landUse: landUse,
            plotArea: plotAreaSqm,
            status: report.errors.length > 0 ? "Failed" : "Passed",
            errors: report.errors,
            maxFAR: parseFloat(effectiveBaseFAR.toFixed(2)),
            maxPurchasableFAR: maxPurchasableFAR,
            maxBuiltUpArea: parseFloat(maxBuiltUpArea.toFixed(2)),
            maxGroundCoverageArea: parseFloat(maxGroundCoverageArea.toFixed(2)),
            maxHeight: rules.maxHeight || (plotAreaSqm < 300 ? 15.0 : 17.5),
            parkingRequired: ecsRequiredCount,
            setbacks: finalSetbacks,
            basementRule: plotAreaSqm < 100 ? "Prohibited" : (plotAreaSqm <= 500 ? "1 Allowed" : "Multiple Allowed"),
            socialHousing: (plotAreaSqm >= 4000 && (developmentType === 'group_housing' || developmentType === 'plotted_multi')) ?
                { status: "Mandatory", EWS: Math.ceil((options.totalUnits || 1) * 0.10), LIG: Math.ceil((options.totalUnits || 1) * 0.10) } :
                { status: "Not Applicable" }
        };
    }

    return {
        loadAuthorities,
        calculateRules
    };

})();
