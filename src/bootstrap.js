const publicRoutes = new Set(['/planos', '/assinaturas', '/cadastro', '/cadastro/verificar', '/termos', '/privacidade']);

if (['/termos','/privacidade'].includes(window.location.pathname.replace(/\/$/,''))) import('./legal.js');
else if (window.location.pathname.startsWith('/cadastro')) import('./signup.js');
else if (publicRoutes.has(window.location.pathname.replace(/\/$/, '') || '/')) import('./sales.js');
else import('./app.js');
