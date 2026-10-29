import {createApp} from './server.js';
const app=await createApp();await app.listen({host:'0.0.0.0',port:Number(process.env.PORT||3001)});

for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void app.close().then(()=>process.exit(0)).catch(()=>process.exit(1))});
