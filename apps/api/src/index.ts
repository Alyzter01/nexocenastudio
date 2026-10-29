import {createApp} from './server.js';
const app=await createApp();await app.listen({host:'0.0.0.0',port:Number(process.env.PORT||3001)});
