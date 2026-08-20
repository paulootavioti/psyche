import { describe, expect, it } from 'vitest';
import { annualSavings, commercialPlans } from '../plans.js';

describe('catálogo comercial do Psyché',()=>{
  it('preserva os preços aprovados e o desconto anual de 10%',()=>{
    expect(commercialPlans.map(plan=>[plan.key,plan.monthlyCents,plan.yearlyCents])).toEqual([
      ['essential',14700,158760],
      ['professional',27700,299160],
      ['enterprise',34700,374760]
    ]);
    commercialPlans.forEach(plan=>{
      expect(plan.yearlyCents).toBe(Math.round(plan.monthlyCents*12*.9));
      expect(annualSavings(plan)).toBe(Math.round(plan.monthlyCents*12*.1));
    });
  });
});
