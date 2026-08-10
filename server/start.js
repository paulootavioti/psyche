import { createApp } from './app.js';

const { server }=createApp();
const port=Number(process.env.PORT||8787);

server.listen(port,'127.0.0.1',()=>{
  console.log(`Psyché API em http://127.0.0.1:${port}`);
});
