import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
const env=loadEnv("development",process.cwd(),"VITE_");
const url=new URL(env.VITE_SUPABASE_URL);
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url.pathname,"/","Use the Supabase project root URL, without /rest/v1 or other paths.");
const client=createClient(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
for(const name of ["event_summary","suggestion_feed"]){
 const {data,error}=await client.rpc(name);
 assert.equal(error,null,`${name}: ${error?.message}`);
 assert.ok(Array.isArray(data));
 console.log(`PASS live public ${name} RPC`);
}
const {error:settingsError}=await client.from("site_settings").select("id").single();
assert.equal(settingsError,null,settingsError?.message);
console.log("PASS live singleton site settings");
for(const table of ["profiles","user_roles","event_registrations","notifications"]){
 const {error}=await client.from(table).select("*").limit(0);
 assert.equal(error?.code,"42501",`${table}: anonymous access should be denied`);
 console.log(`PASS live anonymous ${table} isolation`);
}
const {error:registerError}=await client.rpc("register_event",{p_event:"00000000-0000-0000-0000-000000000000"});
assert.equal(registerError?.code,"42501","Anonymous registration RPC should be denied before execution");
console.log("PASS live anonymous registration denied");
const response=await fetch(`${url.origin}/functions/v1/image-upload`,{headers:{apikey:key},signal:AbortSignal.timeout(10000)});
const body=await response.json().catch(()=>({}));
console.log(JSON.stringify({imageUploadFunctionStatus:response.status,...(response.status===404?{code:body.code}:{}),note:"GET probe only; no file upload or data changes"}));
