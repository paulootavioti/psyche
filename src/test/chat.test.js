import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  localStorage.clear();
  await import('../app.js');
  await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));
  await vi.waitFor(()=>expect(document.querySelector('#conversationItems').textContent).toContain('Mariana Costa'));
});

describe('Comunicação segura',()=>{
  it('carrega indicadores e conversas do backend',()=>{
    expect(document.querySelector('#conversationTotal').textContent).toBe('1');
    expect(document.querySelector('#conversationItems').textContent).toContain('Mariana Costa');
  });

  it('abre o histórico e habilita o compositor',async()=>{
    document.querySelector('[data-conversation="cnv_1"]').click();
    await vi.waitFor(()=>expect(document.querySelector('#messageForm textarea').disabled).toBe(false));
    expect(document.querySelector('#chatName').textContent).toBe('Mariana Costa');
  });

  it('aplica resposta rápida e envia mensagem',async()=>{
    document.querySelector('[data-quick="Olá! Como podemos ajudar?"]').click();
    expect(document.querySelector('#messageForm textarea').value).toContain('Como podemos ajudar');
    document.querySelector('#messageForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#chatMessages').textContent).toContain('Como podemos ajudar'));
    expect(globalThis.__apiState.messages.at(-1).sender_type).toBe('staff');
  });

  it('abre uma conversa pelo seletor de pacientes',()=>{
    document.querySelector('.chat-action').click();
    expect(document.querySelector('#newConversationDialog').open).toBe(true);
    expect(document.querySelector('#newConversationForm').textContent).toContain('Paciente');
    document.querySelector('#newConversationDialog').close();
  });
});
