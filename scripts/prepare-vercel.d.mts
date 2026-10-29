export function prepareVercel(value:string|undefined,output?:string,source?:string):Promise<{version:number;routes:Array<{src?:string;dest?:string;headers?:Record<string,string>;handle?:string}>}>;
