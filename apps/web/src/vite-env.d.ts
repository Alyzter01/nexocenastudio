/// <reference types="vite/client" />
interface ImportMetaEnv {
 readonly VITE_NEXOCENA_EXPERIMENTAL?:string;
}
interface ImportMeta {
 readonly env:ImportMetaEnv;
}
