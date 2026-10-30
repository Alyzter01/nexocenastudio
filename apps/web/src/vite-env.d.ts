/// <reference types="vite/client" />
interface ImportMetaEnv {
 readonly VITE_NEXOCENA_EXPERIMENTAL?:string;
 readonly VITE_NEXOCENA_PREVIEW_DEMO?:string;
}
interface ImportMeta {
 readonly env:ImportMetaEnv;
}
