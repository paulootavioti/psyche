const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function createEmailService({provider=process.env.PSYCHE_EMAIL_PROVIDER,apiKey=process.env.RESEND_API_KEY,from=process.env.PSYCHE_EMAIL_FROM,fetchImpl=globalThis.fetch}={}){
  const configured=provider==='resend'&&Boolean(apiKey&&from);
  return{
    provider:configured?'resend':null,
    configured,
    async sendSignupVerification({id,to,name,clinicName,verificationUrl,expiresAt}){
      if(!configured)throw Object.assign(new Error('Serviço de e-mail transacional não configurado'),{status:503});
      const firstName=escapeHtml(String(name).trim().split(/\s+/)[0]),safeClinic=escapeHtml(clinicName),safeUrl=escapeHtml(verificationUrl),expiration=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(expiresAt));
      const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','idempotency-key':`psyche-signup-${id}`},body:JSON.stringify({from,to:[to],subject:'Confirme seu cadastro no Psyché',html:`<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#29483e"><div style="max-width:600px;margin:0 auto;padding:36px 20px"><div style="font-family:Georgia,serif;font-size:26px;margin-bottom:28px">Psyché</div><div style="background:#fff;border:1px solid #d9e3de;border-radius:18px;padding:34px"><p style="font-size:12px;letter-spacing:.12em;color:#54816f">CONFIRMAÇÃO DE CADASTRO</p><h1 style="font-family:Georgia,serif;font-weight:normal">Olá, ${firstName}.</h1><p style="line-height:1.7;color:#60726c">Recebemos a solicitação para criar o ambiente <strong>${safeClinic}</strong>. Confirme seu e-mail para ativar o período de avaliação de 14 dias.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#315e50;color:#fff;text-decoration:none;font-weight:bold">Confirmar meu cadastro</a></p><p style="font-size:12px;line-height:1.6;color:#7b8984">O link expira em ${expiration}. Se você não iniciou este cadastro, ignore esta mensagem.</p></div><p style="font-size:11px;color:#89958f;text-align:center;margin-top:22px">Psyché · gestão responsável para psicologia</p></div></body></html>`,text:`Olá, ${String(name).trim().split(/\s+/)[0]}. Confirme o cadastro de ${clinicName} no Psyché: ${verificationUrl}\n\nO link expira em ${expiration}. Se você não iniciou este cadastro, ignore esta mensagem.`})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Object.assign(new Error('Não foi possível enviar o e-mail de verificação'),{status:502,providerStatus:response.status});
      return{id:payload.id,provider:'resend'};
    }
  };
}
