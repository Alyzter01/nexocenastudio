import type {CapacitorConfig} from '@capacitor/cli';
const url=process.env.NEXOCENA_APP_URL;
if(url && new URL(url).protocol!=='https:')throw new Error('NEXOCENA_APP_URL exige HTTPS');
const config:CapacitorConfig={appId:'com.nexocena.studio',appName:'NEXOCENA STUDIO',webDir:'../web/dist',...(url?{server:{url,cleartext:false}}:{})};
export default config;
