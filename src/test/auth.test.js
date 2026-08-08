import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(async () => {
  sessionStorage.clear();
  await import('../app.js');
});

describe('Psyché login experience', () => {
  it('starts with the authentication screen visible', () => {
    expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(false);
    expect(document.querySelector('#loginForm')).toBeTruthy();
  });

  it('toggles password visibility without changing its value', () => {
    const input=document.querySelector('#loginForm').elements.password;
    input.value='SenhaSegura';
    document.querySelector('#togglePassword').click();
    expect(input.type).toBe('text');
    expect(input.value).toBe('SenhaSegura');
    document.querySelector('#togglePassword').click();
    expect(input.type).toBe('password');
  });

  it('accepts passwords starting at six characters in the login form',()=>{
    expect(document.querySelector('#loginForm').elements.password.minLength).toBe(6);
    expect(document.querySelector('#patientPortalLoginForm').elements.password.minLength).toBe(6);
  });

  it('shows a generic error for invalid credentials', async () => {
    const form=document.querySelector('#loginForm');
    form.elements.email.value='admin@psyche.local';
    form.elements.password.value='senha-incorreta';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#authError').textContent).toBe('Credenciais inválidas'));
    expect(sessionStorage.getItem('psyche:apiToken')).toBeNull();
  });

  it('authenticates valid credentials and persists the tab session', async () => {
    const form=document.querySelector('#loginForm');
    form.elements.password.value='Psyche@2026!';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));
    expect(sessionStorage.getItem('psyche:apiToken')).toBe('authenticated-token');
    expect(document.querySelector('.profile-copy strong').textContent).toBe('Carolina Martins');
  });

  it('logs out and returns to the authentication screen', async () => {
    document.querySelector('#logoutBtn').click();
    await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(false));
    expect(sessionStorage.getItem('psyche:apiToken')).toBeNull();
  });
});
