"""
FAR Rule Engine — Municipal Intelligence Engine (MIE)
Based on UP Model Building Bye-laws 2025

A standalone, decoupled FAR Logic Compiler that computes:
- Base FAR (BFAR)
- Purchasable FAR (PFAR)
- Premium Purchasable FAR (PPFAR)
- Maximum Permissible FAR (MFAR)
- Financial charges for density boosts
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import math


# ============================================================================
# DATA SCHEMA
# ============================================================================

@dataclass
class SpatialElement:
    type: str           # 'balcony', 'stilt_parking', 'basement', 'lift_shaft',
                        # 'atrium', 'enclosed_garage', 'mezzanine'
    area: float = 0.0
    width: float = 0.0
    length: float = 0.0
    height: float = 0.0
    location: str = ""  # 'setback', 'internal', etc.


@dataclass
class FARInput:
    plot_area: float
    net_plot_area: float
    road_width: float
    building_type: str          # 'residential_plotted', 'group_housing',
                                # 'commercial', 'mixed_use', 'institutional', 'industrial'
    zone_type: str              # 'built_up', 'non_built_up'
    is_tod_zone: bool = False
    surrendered_area_for_road: float = 0.0
    green_building_rating: str = "none"  # 'none', 'silver', 'gold', 'platinum'
    circle_rate: float = 0.0
    proposed_extra_far_area: float = 0.0
    spatial_elements: List[Dict[str, Any]] = field(default_factory=list)


# ============================================================================
# FAR RULE ENGINE
# ============================================================================

class FARRuleEngine:
    """
    Computes FAR compliance per UP Model Building Bye-laws 2025.
    Execution order:
        1. Calculate Base FAR (Telescopic or Road-Width Gate)
        2. Calculate MFAR Cap
        3. Apply Incentive Overlays (TOD, Compensatory, Green)
        4. Compute PFAR/PPFAR Economic Charges
        5. Filter Geometric Exemptions (consumed FAR)
    """

    # ── Telescopic Slicing Brackets ──────────────────────────────────────
    TELESCOPIC_SLICES = [
        (0,    150,  2.00),
        (150,  300,  1.80),
        (300,  500,  1.75),
        (500,  1200, 1.50),
        (1200, float('inf'), 1.25),
    ]

    # ── Road-Width Density Gate Matrices ─────────────────────────────────
    # Format: (min_road, max_road): (BFAR, MFAR)
    GROUP_HOUSING_BUILT_UP = {
        (9,  12):  (1.50, 2.10),
        (12, 18):  (1.50, 3.00),
        (18, 24):  (1.50, 3.50),
        (24, 45):  (1.50, 5.25),
        (45, 999): (1.50, -1),     # -1 = Unrestricted
    }

    GROUP_HOUSING_NON_BUILT_UP = {
        (12, 18):  (2.50, 5.00),
        (18, 24):  (2.50, 5.50),
        (24, 45):  (2.50, 7.00),
        (45, 999): (2.50, -1),
    }

    COMMERCIAL_BUILT_UP = {
        (9,  12):  (1.50, 2.25),
        (12, 18):  (1.50, 3.50),
        (18, 24):  (1.50, 4.00),
        (24, 45):  (1.50, 5.25),
        (45, 999): (1.50, -1),
    }

    COMMERCIAL_NON_BUILT_UP = {
        (12, 18):  (2.50, 5.00),
        (18, 24):  (2.50, 6.00),
        (24, 45):  (2.50, 7.50),
        (45, 999): (2.50, -1),
    }

    INDUSTRIAL = {
        (9,  12):  (1.25, 1.75),
        (12, 18):  (1.25, 2.00),
        (18, 24):  (1.25, 2.50),
        (24, 999): (1.25, 3.00),
    }

    # ── Economic Pricing Factors ─────────────────────────────────────────
    PRICING_FACTORS = {
        'commercial':           (0.50, 1.00),
        'mixed_use':            (0.45, 0.90),
        'residential_plotted':  (0.40, 0.80),
        'group_housing':        (0.40, 0.80),
        'institutional':        (0.20, 0.40),
        'industrial':           (0.30, 0.60),
    }

    # ── Green Building Bonuses ───────────────────────────────────────────
    GREEN_BONUSES = {
        'none':     0.00,
        'silver':   0.03,
        'gold':     0.05,
        'platinum': 0.07,
    }

    def __init__(self, inp: FARInput):
        self.inp = inp

    # ====================================================================
    # MODULE 1: TELESCOPIC SOLVER (Residential Plotted)
    # ====================================================================
    def _telescopic_solve(self) -> Dict[str, float]:
        """
        Slices net_plot_area through descending multiplier brackets.
        Returns base_far_area and base_far_ratio.
        """
        area = self.inp.net_plot_area
        total_far_area = 0.0

        for lower, upper, multiplier in self.TELESCOPIC_SLICES:
            if area <= lower:
                break
            slice_width = min(area, upper) - lower
            total_far_area += slice_width * multiplier

        base_far_ratio = total_far_area / area if area > 0 else 0.0

        # MFAR Cap
        if area < 150:
            mfar_ratio = 2.25
        else:
            mfar_ratio = 2.50

        mfar_area = area * mfar_ratio

        return {
            'base_far_area': round(total_far_area, 2),
            'base_far_ratio': round(base_far_ratio, 4),
            'mfar_ratio': mfar_ratio,
            'mfar_area': round(mfar_area, 2),
        }

    # ====================================================================
    # MODULE 2: ROAD-WIDTH DENSITY GATES (Group Housing, Commercial, etc.)
    # ====================================================================
    def _road_width_gates(self) -> Dict[str, Any]:
        """
        Lookup BFAR and MFAR from road_width × zone_type × building_type matrix.
        """
        road = self.inp.road_width
        btype = self.inp.building_type
        zone = self.inp.zone_type

        # Select the correct matrix
        if btype == 'group_housing':
            matrix = self.GROUP_HOUSING_BUILT_UP if zone == 'built_up' else self.GROUP_HOUSING_NON_BUILT_UP
        elif btype in ('commercial', 'mixed_use'):
            matrix = self.COMMERCIAL_BUILT_UP if zone == 'built_up' else self.COMMERCIAL_NON_BUILT_UP
        elif btype == 'industrial':
            matrix = self.INDUSTRIAL
        else:
            # Fallback for institutional or unknown
            matrix = self.COMMERCIAL_BUILT_UP if zone == 'built_up' else self.COMMERCIAL_NON_BUILT_UP

        bfar_ratio = 0.0
        mfar_ratio = 0.0
        is_unrestricted = False

        for (lo, hi), (bf, mf) in matrix.items():
            if lo <= road < hi:
                bfar_ratio = bf
                if mf == -1:
                    is_unrestricted = True
                    mfar_ratio = float('inf')
                else:
                    mfar_ratio = mf
                break

        area = self.inp.net_plot_area
        bfar_area = round(area * bfar_ratio, 2)
        mfar_area = round(area * mfar_ratio, 2) if not is_unrestricted else float('inf')

        return {
            'base_far_area': bfar_area,
            'base_far_ratio': bfar_ratio,
            'mfar_ratio': mfar_ratio,
            'mfar_area': mfar_area,
            'is_unrestricted': is_unrestricted,
        }

    # ====================================================================
    # MODULE 3: THE ECONOMIC COMPILER (PFAR & PPFAR Pricing)
    # ====================================================================
    def _economic_compile(self, base_far_ratio: float) -> Dict[str, float]:
        """
        Calculates the financial charges for purchasing additional FAR.
        Formula: C = Le × Rc × Factor
        Where Le = proposed_extra_far_area / base_far_ratio
        """
        extra = self.inp.proposed_extra_far_area
        Rc = self.inp.circle_rate

        if extra <= 0 or Rc <= 0 or base_far_ratio <= 0:
            return {
                'pfar_charge': 0.0,
                'ppfar_charge': 0.0,
                'total_charge': 0.0,
                'proportional_land': 0.0,
            }

        Le = extra / base_far_ratio
        p_factor, pp_factor = self.PRICING_FACTORS.get(
            self.inp.building_type, (0.40, 0.80)
        )

        # In TOD zones, PFAR and PPFAR factors are equalized
        if self.inp.is_tod_zone:
            pp_factor = p_factor

        pfar_charge = round(Le * Rc * p_factor, 2)
        ppfar_charge = round(Le * Rc * pp_factor, 2)

        return {
            'pfar_charge': pfar_charge,
            'ppfar_charge': ppfar_charge,
            'total_charge': round(pfar_charge + ppfar_charge, 2),
            'proportional_land': round(Le, 2),
        }

    # ====================================================================
    # MODULE 4: INCENTIVE & BONUS CALCULATOR (Overlays)
    # ====================================================================
    def _incentive_overlay(self, mfar_area: float, mfar_ratio: float,
                           base_far_ratio: float, is_unrestricted: bool) -> Dict[str, Any]:
        """
        Applies TOD override, Compensatory FAR, and Green Building bonuses.
        """
        result = {
            'tod_override_applied': False,
            'tod_mfar_ratio': None,
            'compensatory_far_area': 0.0,
            'green_bonus_percent': 0.0,
            'green_bonus_area': 0.0,
            'final_mfar_area': mfar_area,
            'final_mfar_ratio': mfar_ratio,
        }
        area = self.inp.net_plot_area

        # ── TOD Override ──
        if self.inp.is_tod_zone:
            road = self.inp.road_width
            if road < 12:
                tod_mult = 1.50
            elif 12 <= road < 24:
                tod_mult = 2.50
            elif 24 <= road < 45:
                tod_mult = 3.50
            else:
                tod_mult = float('inf')
                is_unrestricted = True

            tod_mfar = base_far_ratio * tod_mult if not is_unrestricted else float('inf')
            result['tod_override_applied'] = True
            result['tod_mfar_ratio'] = tod_mfar
            mfar_ratio = tod_mfar
            mfar_area = area * mfar_ratio if not is_unrestricted else float('inf')

        # ── Compensatory FAR ──
        surr = self.inp.surrendered_area_for_road
        if surr > 0:
            comp_far = 2.0 * surr
            result['compensatory_far_area'] = round(comp_far, 2)
            if not is_unrestricted:
                mfar_area += comp_far

        # ── Green Building Bonus ──
        green = self.inp.green_building_rating.lower()
        bonus_pct = self.GREEN_BONUSES.get(green, 0.0)
        if bonus_pct > 0 and not is_unrestricted:
            bonus_area = mfar_area * bonus_pct
            result['green_bonus_percent'] = bonus_pct * 100
            result['green_bonus_area'] = round(bonus_area, 2)
            mfar_area += bonus_area

        result['final_mfar_area'] = round(mfar_area, 2) if not is_unrestricted else float('inf')
        result['final_mfar_ratio'] = round(mfar_area / area, 4) if (area > 0 and not is_unrestricted) else mfar_ratio

        return result

    # ====================================================================
    # MODULE 5: THE GEOMETRIC EXEMPTION FILTER
    # ====================================================================
    def _exemption_filter(self) -> Dict[str, Any]:
        """
        Filters spatial elements to determine consumed FAR.
        
        Exempt (0%): stilt_parking, basement, lift_shaft (counted once at GF), atrium (>3000 sqm commercial)
        Conditional: balcony <=2m = exempt, >2m = 25% of excess area
        Full (100%): enclosed_garage in setbacks, mezzanine
        """
        consumed = 0.0
        exemptions = []
        penalties = []
        lift_counted = False

        for elem_dict in self.inp.spatial_elements:
            etype = elem_dict.get('type', '').lower()
            earea = elem_dict.get('area', 0.0)
            ewidth = elem_dict.get('width', 0.0)
            elength = elem_dict.get('length', 0.0)
            elocation = elem_dict.get('location', '')

            if etype == 'stilt_parking':
                exemptions.append({'type': etype, 'area': earea, 'status': 'EXEMPT'})
                # Not counted in FAR

            elif etype == 'basement':
                exemptions.append({'type': etype, 'area': earea, 'status': 'EXEMPT'})

            elif etype == 'lift_shaft':
                if not lift_counted:
                    consumed += earea
                    lift_counted = True
                    exemptions.append({'type': etype, 'area': earea, 'status': 'COUNTED_ONCE_GF'})
                else:
                    exemptions.append({'type': etype, 'area': earea, 'status': 'EXEMPT_UPPER'})

            elif etype == 'atrium':
                # Exempt only for commercial plots > 3000 sqm
                if self.inp.building_type in ('commercial', 'mixed_use') and self.inp.plot_area > 3000:
                    exemptions.append({'type': etype, 'area': earea, 'status': 'EXEMPT'})
                else:
                    consumed += earea
                    exemptions.append({'type': etype, 'area': earea, 'status': 'COUNTED'})

            elif etype == 'balcony':
                if ewidth <= 2.0:
                    exemptions.append({'type': etype, 'area': earea, 'status': 'EXEMPT'})
                else:
                    # Penalty: (width - 2.0) * length * 0.25
                    excess = ewidth - 2.0
                    penalty_area = excess * elength * 0.25
                    consumed += penalty_area
                    penalties.append({
                        'type': etype,
                        'excess_width': round(excess, 2),
                        'penalty_area': round(penalty_area, 2),
                    })

            elif etype == 'enclosed_garage' and elocation == 'setback':
                consumed += earea
                exemptions.append({'type': etype, 'area': earea, 'status': 'FULL_COUNT'})

            elif etype == 'mezzanine':
                consumed += earea
                exemptions.append({'type': etype, 'area': earea, 'status': 'FULL_COUNT'})

            else:
                # Unknown element — count fully
                consumed += earea
                exemptions.append({'type': etype, 'area': earea, 'status': 'COUNTED'})

        return {
            'consumed_far': round(consumed, 2),
            'element_audit': exemptions,
            'penalties': penalties,
        }

    # ====================================================================
    # MASTER SOLVER
    # ====================================================================
    def compute(self) -> Dict[str, Any]:
        """
        Orchestrates all 5 modules and returns the FAR_Compliance_Report.
        """
        btype = self.inp.building_type

        # ── Step 1: Base FAR ──
        if btype == 'residential_plotted':
            base = self._telescopic_solve()
            is_unrestricted = False
        else:
            base = self._road_width_gates()
            is_unrestricted = base.get('is_unrestricted', False)

        base_far_area = base['base_far_area']
        base_far_ratio = base['base_far_ratio']
        mfar_ratio = base['mfar_ratio']
        mfar_area = base['mfar_area']

        # ── Step 2: Incentive Overlays ──
        incentives = self._incentive_overlay(
            mfar_area, mfar_ratio, base_far_ratio, is_unrestricted
        )
        final_mfar_area = incentives['final_mfar_area']

        # ── Step 3: Economic Charges ──
        economics = self._economic_compile(base_far_ratio)

        # ── Step 4: Geometric Exemptions ──
        exemptions = self._exemption_filter()

        # ── Assemble Report ──
        report = {
            'input_summary': {
                'plot_area': self.inp.plot_area,
                'net_plot_area': self.inp.net_plot_area,
                'road_width': self.inp.road_width,
                'building_type': btype,
                'zone_type': self.inp.zone_type,
            },
            'base_far': {
                'area': base_far_area,
                'ratio': base_far_ratio,
                'method': 'telescopic' if btype == 'residential_plotted' else 'road_width_gate',
            },
            'max_permissible_far': {
                'base_mfar_area': base['mfar_area'],
                'base_mfar_ratio': mfar_ratio,
                'is_unrestricted': is_unrestricted,
                'final_mfar_area': final_mfar_area,
                'final_mfar_ratio': incentives['final_mfar_ratio'],
            },
            'incentives': {
                'tod_override': incentives['tod_override_applied'],
                'tod_mfar_ratio': incentives['tod_mfar_ratio'],
                'compensatory_far_area': incentives['compensatory_far_area'],
                'green_bonus_percent': incentives['green_bonus_percent'],
                'green_bonus_area': incentives['green_bonus_area'],
            },
            'financial_impact': {
                'pfar_charge': economics['pfar_charge'],
                'ppfar_charge': economics['ppfar_charge'],
                'total_charge': economics['total_charge'],
                'proportional_land': economics['proportional_land'],
            },
            'consumed_far': {
                'total': exemptions['consumed_far'],
                'audit': exemptions['element_audit'],
                'penalties': exemptions['penalties'],
            },
        }

        return report


# ============================================================================
# TEST HARNESS
# ============================================================================
if __name__ == '__main__':
    import json

    def run_test(name, inp_dict):
        print(f"\n{'='*60}")
        print(f"  TEST: {name}")
        print(f"{'='*60}")
        inp = FARInput(**inp_dict)
        engine = FARRuleEngine(inp)
        report = engine.compute()
        print(json.dumps(report, indent=2, default=str))
        return report

    # ── Test 1: Residential Plotted — 280 sqm ──
    r1 = run_test("Telescopic Solver (280 sqm Residential)", {
        'plot_area': 280.0,
        'net_plot_area': 260.0,
        'road_width': 18.0,
        'building_type': 'residential_plotted',
        'zone_type': 'built_up',
    })
    # Expected: Slice 1 = 150*2.0=300, Slice 2 = 110*1.80=198 → Total = 498
    assert r1['base_far']['area'] == 498.0, f"FAIL: Expected 498.0, got {r1['base_far']['area']}"
    print("✓ Test 1 PASSED: Telescopic base FAR = 498.0 sqm")

    # ── Test 2: Group Housing — 18m road, built-up ──
    r2 = run_test("Road-Width Gate (Group Housing, 18m, built-up)", {
        'plot_area': 2000.0,
        'net_plot_area': 1800.0,
        'road_width': 18.0,
        'building_type': 'group_housing',
        'zone_type': 'built_up',
    })
    assert r2['base_far']['ratio'] == 1.50, f"FAIL: Expected BFAR 1.50"
    assert r2['max_permissible_far']['base_mfar_ratio'] == 3.50
    print("✓ Test 2 PASSED: Group Housing BFAR=1.50, MFAR=3.50")

    # ── Test 3: PFAR Pricing — Commercial ──
    r3 = run_test("Economic Compiler (Commercial, 100 sqm extra)", {
        'plot_area': 500.0,
        'net_plot_area': 480.0,
        'road_width': 18.0,
        'building_type': 'commercial',
        'zone_type': 'built_up',
        'circle_rate': 38500,
        'proposed_extra_far_area': 100.0,
    })
    # Le = 100 / 1.50 = 66.67, PFAR = 66.67 * 38500 * 0.50 = ~1,283,416
    assert r3['financial_impact']['pfar_charge'] > 0
    print(f"✓ Test 3 PASSED: PFAR charge = ₹{r3['financial_impact']['pfar_charge']:,.2f}")

    # ── Test 4: TOD Zone Override ──
    r4 = run_test("TOD Override (Group Housing, 24m road)", {
        'plot_area': 3000.0,
        'net_plot_area': 2800.0,
        'road_width': 24.0,
        'building_type': 'group_housing',
        'zone_type': 'built_up',
        'is_tod_zone': True,
    })
    assert r4['incentives']['tod_override'] == True
    assert r4['incentives']['tod_mfar_ratio'] == 1.50 * 3.50
    print(f"✓ Test 4 PASSED: TOD MFAR ratio = {r4['incentives']['tod_mfar_ratio']}")

    # ── Test 5: Green Gold Bonus ──
    r5 = run_test("Green Building Gold Bonus (Residential 500 sqm)", {
        'plot_area': 500.0,
        'net_plot_area': 500.0,
        'road_width': 12.0,
        'building_type': 'residential_plotted',
        'zone_type': 'built_up',
        'green_building_rating': 'gold',
    })
    assert r5['incentives']['green_bonus_percent'] == 5.0
    print(f"✓ Test 5 PASSED: Green bonus = +{r5['incentives']['green_bonus_percent']}%")

    # ── Test 6: Balcony >2m Penalty ──
    r6 = run_test("Balcony Penalty (2.5m wide)", {
        'plot_area': 300.0,
        'net_plot_area': 300.0,
        'road_width': 12.0,
        'building_type': 'residential_plotted',
        'zone_type': 'built_up',
        'spatial_elements': [
            {'type': 'balcony', 'width': 2.5, 'length': 4.0, 'area': 10.0},
            {'type': 'stilt_parking', 'area': 80.0},
            {'type': 'lift_shaft', 'area': 4.0},
            {'type': 'lift_shaft', 'area': 4.0},  # Second occurrence — exempt
        ],
    })
    # Penalty: (2.5 - 2.0) * 4.0 * 0.25 = 0.50
    assert r6['consumed_far']['total'] == 4.50  # 0.50 balcony + 4.0 lift (once)
    print(f"✓ Test 6 PASSED: Consumed FAR = {r6['consumed_far']['total']} sqm")

    # ── Test 7: Compensatory FAR ──
    r7 = run_test("Compensatory FAR (20 sqm surrendered)", {
        'plot_area': 280.0,
        'net_plot_area': 260.0,
        'road_width': 12.0,
        'building_type': 'residential_plotted',
        'zone_type': 'built_up',
        'surrendered_area_for_road': 20.0,
    })
    assert r7['incentives']['compensatory_far_area'] == 40.0
    print(f"✓ Test 7 PASSED: Compensatory FAR = {r7['incentives']['compensatory_far_area']} sqm")

    print(f"\n{'='*60}")
    print("  ALL TESTS PASSED ✓")
    print(f"{'='*60}")
