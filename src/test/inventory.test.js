import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{await import('../app.js');await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));await vi.waitFor(()=>expect(document.querySelector('#inventoryResultCount').textContent).toContain('0 itens'));});

describe('Controle de estoque',()=>{
  it('cadastra item com saldo, mínimo e custo em centavos',async()=>{
    document.querySelector('.inventory-action').click();const form=document.querySelector('#inventoryForm');form.elements.name.value='Papel A4';form.elements.sku.value='PAP-A4';form.elements.category.value='Material de escritório';form.elements.unit_measure.value='pct';form.elements.unit_id.value='unt_1';form.elements.quantity.value='10';form.elements.minimum_quantity.value='3';form.elements.unit_cost.value='32.50';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#inventoryRows').textContent).toContain('Papel A4'));expect(globalThis.__apiState.inventory[0].unit_cost_cents).toBe(3250);expect(document.querySelector('#inventoryValue').textContent).toContain('325');
  });
  it('registra saída e atualiza saldo e histórico',async()=>{
    document.querySelector('[data-inventory-id="stk_1"]').click();await vi.waitFor(()=>expect(document.querySelector('#movementForm')).toBeTruthy());const form=document.querySelector('#movementForm');form.elements.type.value='out';form.elements.quantity.value='4';form.elements.reason.value='Consumo da recepção';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(globalThis.__apiState.inventory[0].quantity).toBe(6));await vi.waitFor(()=>expect(document.querySelector('#inventoryRows').textContent).toContain('6 pct'));
  });
  it('impede saída superior ao saldo',async()=>{
    document.querySelector('[data-inventory-id="stk_1"]').click();await vi.waitFor(()=>expect(document.querySelector('#movementForm')).toBeTruthy());const form=document.querySelector('#movementForm');form.elements.type.value='out';form.elements.quantity.value='99';form.elements.reason.value='Saída inválida';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(document.querySelector('#toast').textContent).toContain('Estoque insuficiente'));expect(globalThis.__apiState.inventory[0].quantity).toBe(6);document.querySelector('#inventoryDetail').close();
  });
  it('exporta a posição atual em CSV',()=>{document.querySelector('#inventoryExport').click();expect(URL.createObjectURL).toHaveBeenCalled();});
});
