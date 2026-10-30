/** D1 structural types without extra paid services or dependencies. */
export interface D1Statement {
 bind(...values:(string|number|null)[]):D1Statement;
 first<T=Record<string,unknown>>():Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
 run():Promise<{meta:{changes:number}}>;
}
export interface D1Database {prepare(sql:string):D1Statement}
export interface Env {
 DB:D1Database;
 EXPERIMENT_REGISTRATION?:string;
 EXPERIMENT_OWNER_EMAIL?:string;
 EXPERIMENT_REMOTE_ENABLED?:string;
}
