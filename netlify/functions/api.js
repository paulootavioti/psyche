import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

const application=createApp({runtime:'netlify'});
const adapter=serverless(application.handler,{
  request(request,event){
    const source=event.rawUrl||event.raw_url||event.path||request.url||'/api';
    const parsed=new URL(source,'https://psyche.local');
    let pathname=parsed.pathname;
    const functionPrefix='/.netlify/functions/api';
    if(pathname.startsWith(functionPrefix))pathname=`/api${pathname.slice(functionPrefix.length)}`;
    if(!pathname.startsWith('/api'))pathname=`/api${pathname.startsWith('/')?'':'/'}${pathname}`;
    request.url=`${pathname}${parsed.search}`;
  }
});

export const handler=(event,context)=>adapter(event,context);
