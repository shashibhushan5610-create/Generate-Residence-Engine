export const AUTHORITIES_DATA = {
  authorities: {
    PDA: {
      name: "Prayagraj Development Authority",
      rules: {
        Residential: {
          maxFAR: 1.5,
          maxGroundCoverage: 60,
          maxHeight: 12.5,
          setbacks: {
            front: { min: 3.0, roadWidthThresholds: [{ minRoad: 9, setback: 3.0 }, { minRoad: 12, setback: 4.5 }] },
            rear: { min: 2.0 },
            side1: { min: 1.5 },
            side2: { min: 1.5 },
          },
          parkingRequirementPer100Sqm: 1,
        },
        Commercial: {
          maxFAR: 2.0,
          maxGroundCoverage: 50,
          maxHeight: 15.0,
          setbacks: {
            front: { min: 4.5 },
            rear: { min: 3.0 },
            side1: { min: 3.0 },
            side2: { min: 3.0 },
          },
          parkingRequirementPer100Sqm: 2,
        },
        "Mixed Use": {
          maxFAR: 1.75,
          maxGroundCoverage: 55,
          maxHeight: 15.0,
          setbacks: {
            front: { min: 4.5 },
            rear: { min: 3.0 },
            side1: { min: 2.0 },
            side2: { min: 2.0 },
          },
          parkingRequirementPer100Sqm: 1.5,
        },
      },
    },
    LDA: {
      name: "Lucknow Development Authority",
      rules: {
        Residential: {
          maxFAR: 1.75,
          maxGroundCoverage: 65,
          maxHeight: 15.0,
          setbacks: {
            front: { min: 3.0 },
            rear: { min: 2.0 },
            side1: { min: 1.2 },
            side2: { min: 1.2 },
          },
          parkingRequirementPer100Sqm: 1,
        },
        Commercial: {
          maxFAR: 2.5,
          maxGroundCoverage: 40,
          maxHeight: 24.0,
          setbacks: {
            front: { min: 6.0 },
            rear: { min: 4.5 },
            side1: { min: 4.5 },
            side2: { min: 4.5 },
          },
          parkingRequirementPer100Sqm: 3,
        },
      },
    },
    UP_2025: {
      name: "UP Model Building Bye-laws 2025",
      type: "comprehensive",
      rules: {
        Residential: {
          feasibility: {
            plotted_single: { minArea: 0, minRoad: 4.0 },
            plotted_multi: { minArea: 150, minRoad: 9.0 },
            group_housing: { minArea: 1000, minRoad: 9.0 },
          },
          maxFAR: 2.0,
          maxGroundCoverage: 60,
          telescopicFAR: [
            { limit: 150, multiplier: 2.0 },
            { limit: 150, multiplier: 1.8 },
            { limit: 200, multiplier: 1.75 },
            { limit: 700, multiplier: 1.5 },
            { limit: Infinity, multiplier: 1.25 },
          ],
          maxPurchasableFAR: { tiny: 2.25, regular: 2.5 },
          parking: [
            { max: 100, ecs: 1.0 },
            { max: 150, ecs: 1.25 },
            { max: Infinity, ecs: 1.5 },
          ],
          areaThresholds: [
            { max: 150, setbacks: { front: 1.0, rear: 0.0, side1: 0.0, side2: 0.0 } },
            { min: 150, max: 300, setbacks: { front: 3.0, rear: 1.5, side1: 0.0, side2: 0.0 } },
            { min: 300, max: 500, setbacks: { front: 3.0, rear: 3.0, side1: 0.0, side2: 0.0 } },
            { min: 500, max: 1200, setbacks: { front: 4.5, rear: 4.5, side1: 1.5, side2: 0.0 } },
            { min: 1200, setbacks: { front: 6.0, rear: 6.0, side1: 1.5, side2: 1.5 } },
          ],
          heightSafetySetbacks: [
            { minH: 15.0, maxH: 17.5, val: 5.0 },
            { minH: 17.5, maxH: 21.0, val: 6.0 },
            { minH: 21.0, maxH: 27.0, val: 7.0 },
          ],
        },
      },
    },
    Bye_laws_2025: {
      name: "Regulatory Rules (2025 Bye-laws)",
      rules: {
        Residential: {
          maxFAR: 1.5,
          maxGroundCoverage: 60,
          areaThresholds: [
            { max: 150, setbacks: { front: 1.0, rear: 0.0, side1: 0.0, side2: 0.0 } },
            { min: 150, max: 300, setbacks: { front: 3.0, rear: 1.5, side1: 0.0, side2: 0.0 } },
            { min: 300, max: 500, setbacks: { front: 3.0, rear: 3.0, side1: 0.0, side2: 0.0 } },
            { min: 500, max: 1200, setbacks: { front: 4.5, rear: 4.5, side1: 1.5, side2: 0.0 } },
            { min: 1200, setbacks: { front: 6.0, rear: 6.0, side1: 1.5, side2: 1.5 } },
          ],
        },
      },
    },
  },
};
