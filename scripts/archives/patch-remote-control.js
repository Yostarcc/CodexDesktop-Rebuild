#!/usr/bin/env node
/**
 * Optional patch: expose and unblock the Windows phone Remote Control path.
 *
 * Scope is intentionally pinned to Codex Desktop 26.616.*. If upstream changes
 * the minified bundle shape, fail loudly and update the exact anchors instead
 * of carrying compatibility branches for older bundles.
 */
const fs = require("fs");
const path = require("path");
const { PROJECT_ROOT, SRC_DIR, relPath } = require("./patch-util");

const SUPPORTED_VERSION_PREFIX = "26.616.";
const SUPPORTED_PLATFORMS = ["win"];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function replaceExact(text, oldText, newText, label) {
  if (!text.includes(oldText)) {
    throw new Error(`${label} anchor not found`);
  }
  return text.replace(oldText, newText);
}

function ensureMarker(text, marker, label) {
  if (!text.includes(marker)) {
    throw new Error(`${label} marker missing after patch: ${marker}`);
  }
}

function getPlatforms(platform) {
  if (platform != null) {
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      throw new Error(`Remote Control patch supports only: ${SUPPORTED_PLATFORMS.join(", ")}`);
    }
    return [platform];
  }
  return SUPPORTED_PLATFORMS.filter((candidate) =>
    fs.existsSync(path.join(SRC_DIR, candidate, "_asar")),
  );
}

function getAsarRoot(platform) {
  const root = path.join(SRC_DIR, platform, "_asar");
  if (!fs.existsSync(root)) {
    throw new Error(`${platform}/_asar not found. Run node tools/sync-upstream.js first.`);
  }
  const packageJsonPath = path.join(root, "package.json");
  const version = JSON.parse(read(packageJsonPath)).version;
  if (!String(version).startsWith(SUPPORTED_VERSION_PREFIX)) {
    throw new Error(
      `${platform} bundle version ${version} is not supported by this latest-only Remote Control patch; expected ${SUPPORTED_VERSION_PREFIX}x`,
    );
  }
  return root;
}

function findOne(jsFiles, label, predicate) {
  const hit = jsFiles.find((file) => predicate(file, read(file)));
  if (hit == null) {
    throw new Error(`could not find ${label}`);
  }
  return hit;
}

function findAll(jsFiles, label, predicate) {
  const hits = jsFiles.filter((file) => predicate(file, read(file)));
  if (hits.length === 0) {
    throw new Error(`could not find ${label}`);
  }
  return hits;
}

function patchFlowHelpers(text) {
  if (text.includes("remote_control_flow_log_ready")) {
    return { text, status: "already-patched" };
  }

  const helper = `function __codexRemoteControlEnrollScope(){return typeof i$=="string"?i$:"codex.remote_control.enroll"}function __codexRemoteControlAuthLog(e,t={}){try{typeof __codexRemoteControlFlowLog=="function"?__codexRemoteControlFlowLog(e,{marker:"remote_control_auth_isolated_store_priority_check",...t}):console.warn("remote_control_auth_isolated_store_priority_check",e,t)}catch{}}function __codexRemoteControlAuthJsonPath(e){let t=require("node:os"),n=require("node:path");if(e!=="remote-control-oauth.json"&&e!=="remote.json")throw Error("remote_control_auth_forbidden_file");let r=n.resolve(n.join(t.homedir(),".codex",e)),i=n.resolve(n.join(t.homedir(),".codex","auth.json"));if(r===i)throw Error("remote_control_auth_global_auth_rejected");return r}function __codexRemoteControlFindAccessToken(e,t=0){if(e==null||t>8)return null;if(typeof e=="string"){let t=e.trim();return t.split(".").length>=3?t:null}if(typeof e!="object")return null;for(let n of["access_token","accessToken"]){let r=e[n];if(typeof r=="string"&&r.trim().length>0)return r.trim()}for(let n of["tokens","auth","response","credential","credentials","remote","remote_control","step_up_token_exchange_stored_isolated"]){let r=__codexRemoteControlFindAccessToken(e[n],t+1);if(r)return r}if(e.entries&&typeof e.entries=="object")for(let n of Object.values(e.entries)){let e=__codexRemoteControlFindAccessToken(n,t+1);if(e)return e}for(let n of Object.values(e)){let e=__codexRemoteControlFindAccessToken(n,t+1);if(e)return e}return null}function __codexRemoteControlAuthOverrideWithOrder(e,t){for(let n of e)try{let e=require("node:fs"),r=__codexRemoteControlAuthJsonPath(n),i=JSON.parse(e.readFileSync(r,"utf8")),a=__codexRemoteControlFindAccessToken(i),o=__codexRemoteControlJwtPayload(a),s=__codexRemoteControlScopes(o),c=s.includes(__codexRemoteControlEnrollScope());if(a)return __codexRemoteControlAuthLog("remote_control_auth_isolated_store_priority_check",{source:n,path:t??null,hasToken:!0,scopeCount:s.length,hasEnrollScope:c}),a;__codexRemoteControlAuthLog("remote_control_auth_isolated_store_priority_check",{source:n,path:t??null,hasToken:!1})}catch(e){__codexRemoteControlAuthLog("remote_control_auth_isolated_store_priority_check",{source:n,path:t??null,hasToken:!1,errorName:e?.name,errorMessage:e?.message,errorCode:e?.code})}return null}function __codexRemoteControlAuthOverrideForPath(e){let t=String(e??""),n=/\\/(?:backend-api\\/)?wham\\/remote\\/control\\/clients(?:\\/|$)/.test(t)||/\\/(?:backend-api\\/)?wham\\/remote\\/control\\/environments(?:\\/|$)/.test(t)?["remote.json","remote-control-oauth.json"]:["remote-control-oauth.json","remote.json"];return __codexRemoteControlAuthOverrideWithOrder(n,t)}function __codexRemoteControlAuthOverride(){return __codexRemoteControlAuthOverrideForPath("")}function __codexRemoteControlSafeWriteFile(e,t){let n=require("node:os"),r=require("node:path"),i=require("node:fs"),a=r.resolve(String(e)),o=r.resolve(r.join(n.homedir(),".codex","auth.json"));if(a===o)throw Error("remote_control_private_file_target_rejected: software_device_key_private_helper_required");try{let e=i.realpathSync.native?i.realpathSync.native(a):i.realpathSync(a);if(e===o)throw Error("remote_control_private_file_target_rejected: software_device_key_private_helper_required")}catch(e){if(e?.code!=="ENOENT")throw e}try{let e=i.lstatSync(a);if(e.isSymbolicLink())throw Error("remote_control_private_file_target_rejected: symlink")}catch(e){if(e?.code!=="ENOENT")throw e}i.mkdirSync(r.dirname(a),{recursive:!0});i.writeFileSync(a,t,{encoding:"utf8",mode:384});try{i.chmodSync(a,384)}catch{}}function __codexRemoteControlFlowLog(e,t={}){try{let n=require("node:os"),r=require("node:path"),i=require("node:fs"),a=r.join(n.homedir(),".codex","remote-control-flow.log"),o={time:new Date().toISOString(),pid:process.pid,marker:"remote_control_flow_log_ready",stage:e,...t};for(let e of["access_token","refresh_token","id_token","step_up_token","authorization_code","code","codeVerifier","code_verifier","Authorization","authorization","bearer"])delete o[e];i.mkdirSync(r.dirname(a),{recursive:!0});i.appendFileSync(a,JSON.stringify(o)+"\\n","utf8")}catch(e){try{console.warn("remote_control_flow_log_failed",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code})}catch{}}}function __codexRemoteControlStepUpStorePath(){let e=require("node:os"),t=require("node:path");return t.join(e.homedir(),".codex","remote-control-oauth.json")}function __codexRemoteControlReadStepUpStore(){try{let e=require("node:fs");return JSON.parse(e.readFileSync(__codexRemoteControlStepUpStorePath(),"utf8"))}catch{return{schema:"codex-remote-control-oauth-isolated-v1",entries:{}}}}function __codexRemoteControlJwtPayload(e){let t=String(e||"").split(".");if(t.length<2||!t[1])return null;try{return JSON.parse(Buffer.from(t[1],"base64url").toString("utf8"))}catch{return null}}function __codexRemoteControlScopes(e){let t=new Set;for(let n of e?.scope?.split?.(/\\s+/)??[])n&&t.add(n);for(let n of Array.isArray(e?.scp)?e.scp:[])n&&t.add(n);return[...t]}function __codexRemoteControlReadFreshStepUpToken(e){try{let t=__codexRemoteControlReadStepUpStore(),n=t.tokens?.access_token??t.access_token??t.entries?.step_up_token_exchange_stored_isolated?.response?.access_token??t.step_up_token_exchange_stored_isolated?.response?.access_token;if(typeof n!="string"||n.trim().length===0)return __codexRemoteControlFlowLog("remote_control_step_up_cached_missing",{}),null;n=n.trim();let r=__codexRemoteControlJwtPayload(n);if(r==null)return __codexRemoteControlFlowLog("remote_control_step_up_cached_invalid_jwt",{}),null;let i=Math.floor(Date.now()/1e3),a=Date.now(),o=r["https://api.openai.com/auth"]??{},s=o.chatgpt_account_id??o.account_id,c=o.chatgpt_account_user_id??o.account_user_id,l=__codexRemoteControlScopes(r),u=l.includes(__codexRemoteControlEnrollScope()),d=typeof r.exp=="number"&&r.exp>i+30,f=typeof r.iat=="number"&&i-r.iat<240,p=typeof r.pwd_auth_time=="number"&&a-r.pwd_auth_time<240000,m=e==null||s==null||s===e;if(d&&f&&p&&u&&m)return __codexRemoteControlFlowLog("remote_control_step_up_cached_reused",{source:"remote-control-oauth.json",scopeCount:l.length,hasAccountId:!!s,hasAccountUserId:!!c,expiresAt:r.exp}),n;return __codexRemoteControlFlowLog("remote_control_step_up_cached_rejected",{source:"remote-control-oauth.json",hasRequiredScope:u,accountMatches:m,expiresOk:d,issuedFresh:f,passwordFresh:p,scopeCount:l.length,hasAccountId:!!s,hasAccountUserId:!!c}),null}catch(t){return __codexRemoteControlFlowLog("remote_control_step_up_cached_read_failed",{errorName:t?.name,errorMessage:t?.message,errorCode:t?.code}),null}}function __codexRemoteControlStoreStepUpTokenResponse(e,t={}){try{let n=__codexRemoteControlReadStepUpStore();n.schema="codex-remote-control-oauth-isolated-v1";n.updatedAt=new Date().toISOString();n.entries??={};n.entries.step_up_token_exchange_stored_isolated={time:new Date().toISOString(),pid:process.pid,...t,response:e};__codexRemoteControlSafeWriteFile(__codexRemoteControlStepUpStorePath(),JSON.stringify(n,null,2)+"\\n");__codexRemoteControlFlowLog("remote_control_oauth_store_write",{store:"remote-control-oauth.json",responseKeys:e&&typeof e=="object"?Object.keys(e).slice(0,20):[]})}catch(e){__codexRemoteControlFlowLog("remote_control_oauth_store_write_failed",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code})}}`;
  const anchor = "var QQ=`app_EMoamEEZ73f0CkXaXp7hrann`";
  const next = replaceExact(text, anchor, `${helper}${anchor}`, "remote-control flow helper insertion");
  return { text: next, status: "patched" };
}

function patchDesktopFetch(text) {
  const marker = "remote_control_desktop_fetch_new_auth_path_used";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const oldKf =
    "async function KF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i}){if(!i.attachAuth)return i;if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new WF(n,t,e)}}";
  const newKf =
    "async function KF({appServerClient:e,errorStatus:t,failureMessage:n,refreshToken:r,state:i,resolvedUrl:a}){if(!i.attachAuth)return i;let o=(()=>{try{return new URL(a).pathname}catch{return String(a??``)}})(),s=/\\/(?:backend-api\\/)?wham\\/remote\\/control\\//.test(o)||o===`/backend-api/accounts/mfa_info`||o===`/accounts/mfa_info`;if(s){let e=typeof __codexRemoteControlAuthOverrideForPath==\"function\"?__codexRemoteControlAuthOverrideForPath(o):typeof __codexRemoteControlAuthOverride==\"function\"?__codexRemoteControlAuthOverride():null;if(e)return typeof __codexRemoteControlFlowLog==\"function\"&&__codexRemoteControlFlowLog(\"remote_control_desktop_fetch_new_auth_path_used\",{path:o,refreshToken:r}),{...i,tokenSource:`remote-control-isolated`,token:e}}if(!r){let t=e.getCachedAuthToken?.();if(t!==void 0)return{...i,tokenSource:`cached`,token:t}}try{let t=await e.getAuthToken({refreshToken:r});return{...i,tokenSource:r?`refreshed`:`loaded`,token:t}}catch(e){throw new WF(n,t,e)}}";
  const oldInitialAuth =
    "u=await KF({appServerClient:this.getAppServerConnection(z),errorStatus:432,failureMessage:`Failed to retrieve authentication token`,refreshToken:!1,state:u})";
  const newInitialAuth =
    "u=await KF({appServerClient:this.getAppServerConnection(z),errorStatus:432,failureMessage:`Failed to retrieve authentication token`,refreshToken:!1,state:u,resolvedUrl:o})";
  const oldRetryAuth =
    "u=await KF({appServerClient:this.getAppServerConnection(z),errorStatus:401,failureMessage:`Failed to refresh authentication token`,refreshToken:!0,state:u})";
  const newRetryAuth =
    "u=await KF({appServerClient:this.getAppServerConnection(z),errorStatus:401,failureMessage:`Failed to refresh authentication token`,refreshToken:!0,state:u,resolvedUrl:o})";
  let next = replaceExact(text, oldKf, newKf, "desktop_fetch auth fallback");
  next = replaceExact(next, oldInitialAuth, newInitialAuth, "desktop_fetch initial auth call");
  next = replaceExact(next, oldRetryAuth, newRetryAuth, "desktop_fetch retry auth call");
  ensureMarker(next, marker, "desktop_fetch auth fallback");
  return { text: next, status: "patched" };
}

function patchAppServerAuthFallback(text) {
  const marker = "remote_control_appserver_bh_isolated_auth_fallback";
  const helperMarker = "remote_control_connection_auth_fallback_used";
  let status = "already-patched";
  let next = text;
  if (!next.includes(helperMarker)) {
    const helperAnchor = "function __codexRemoteControlAuthOverride(){";
    const helper =
      "function __codexRemoteControlConnectionAuthOverride(){let e=`remote.json`;try{let t=require(\"node:fs\"),n=__codexRemoteControlAuthJsonPath(e),r=JSON.parse(t.readFileSync(n,\"utf8\")),i=__codexRemoteControlFindAccessToken(r),a=__codexRemoteControlJwtPayload(i),o=a?.[\"https://api.openai.com/auth\"]??{},s=__codexRemoteControlScopes(a);if(i)return __codexRemoteControlAuthLog(\"remote_control_connection_auth_fallback_used\",{source:e,hasToken:!0,scopeCount:s.length,hasAccountId:!!(o.chatgpt_account_id??o.account_id),hasAccountUserId:!!(o.chatgpt_account_user_id??o.account_user_id),hasEnrollScope:s.includes(__codexRemoteControlEnrollScope())}),i;__codexRemoteControlAuthLog(\"remote_control_connection_auth_fallback_used\",{source:e,hasToken:!1})}catch(t){__codexRemoteControlAuthLog(\"remote_control_connection_auth_fallback_used\",{source:e,hasToken:!1,errorName:t?.name,errorMessage:t?.message,errorCode:t?.code})}return null}";
    next = replaceExact(next, helperAnchor, helper + helperAnchor, "remote-control app-server auth fallback helper");
    status = "patched";
  }
  if (!next.includes(marker)) {
    const oldV_ =
      "async function v_({action:e,appServerClient:t,desktopOriginator:n,headers:i={},refreshToken:a=!1}){let o=await t.getAuthToken({refreshToken:a});if(!o){let t=r.tt();throw Error(t===`ChatGPT`?`Sign in to ChatGPT to ${e}.`:`Sign in to ChatGPT in ${t} to ${e}.`)}let s={...i};return y_(s,o,{desktopOriginator:n}),s}";
    const newV_ =
      "async function v_({action:e,appServerClient:t,desktopOriginator:n,headers:i={},refreshToken:a=!1}){let o=await t.getAuthToken({refreshToken:a});if(!o)try{o=typeof __codexRemoteControlConnectionAuthOverride==\"function\"?__codexRemoteControlConnectionAuthOverride():null,o&&typeof __codexRemoteControlFlowLog==\"function\"&&(__codexRemoteControlFlowLog(\"remote_control_appserver_bh_isolated_auth_fallback\",{action:e,refreshToken:a}),__codexRemoteControlFlowLog(\"remote_control_desktop_fetch_override_used\",{path:\"/codex/remote/control\",action:e}))}catch(t){try{typeof __codexRemoteControlFlowLog==\"function\"&&__codexRemoteControlFlowLog(\"remote_control_appserver_bh_isolated_auth_fallback_failed\",{action:e,errorName:t?.name,errorMessage:t?.message,errorCode:t?.code})}catch{}}if(!o){let t=r.tt();throw Error(t===`ChatGPT`?`Sign in to ChatGPT to ${e}.`:`Sign in to ChatGPT in ${t} to ${e}.`)}let s={...i};return y_(s,o,{desktopOriginator:n}),s}";
    next = replaceExact(next, oldV_, newV_, "remote-control app-server auth fallback");
    status = "patched";
  }
  ensureMarker(next, marker, "remote-control app-server auth fallback");
  ensureMarker(next, helperMarker, "remote-control app-server auth fallback");
  return { text: next, status };
}

function patchStepUpFlow(text) {
  const flowMarker = "__codexRemoteControlCachedStepUp";
  const exchangeMarker = "remote_control_step_up_token_exchange_started";
  let status = "already-patched";
  let next = text;
  if (!next.includes(flowMarker)) {
    const oldC$ =
      "async function c$({accountId:e,desktopApiOptions:t,fetchToken:n=(e,t)=>a.net.fetch(e,t),openExternalUrl:r=e=>a.shell.openExternal(e),timeoutMs:i=r$}){let o=u$(),s=f$(),c=p$(32),l=await h$({state:c,timeoutMs:i});try{return await r(l$({issuer:o,clientId:QQ,redirectUri:l.redirectUri,codeChallenge:s.codeChallenge,state:c,originator:t.desktopOriginator,accountId:e})),(await m$({code:await l.authorizationCode,codeVerifier:s.codeVerifier,clientId:QQ,issuer:o,redirectUri:l.redirectUri,fetchToken:n})).access_token}finally{l.close()}}";
    const newC$ =
      "async function c$({accountId:e,desktopApiOptions:t,fetchToken:n=(e,t)=>a.net.fetch(e,t),openExternalUrl:r=e=>a.shell.openExternal(e),timeoutMs:i=r$}){let __codexRemoteControlCachedStepUp=typeof __codexRemoteControlReadFreshStepUpToken==\"function\"?__codexRemoteControlReadFreshStepUpToken(e):null;if(__codexRemoteControlCachedStepUp)return __codexRemoteControlCachedStepUp;let o=u$(),s=f$(),c=p$(32),l=await h$({state:c,timeoutMs:i});try{__codexRemoteControlFlowLog(\"remote_control_step_up_browser_open\",{issuer:o,redirectUri:l.redirectUri,accountId:e??null});await r(l$({issuer:o,clientId:QQ,redirectUri:l.redirectUri,codeChallenge:s.codeChallenge,state:c,originator:t.desktopOriginator,accountId:e}));__codexRemoteControlFlowLog(\"remote_control_step_up_wait_callback\",{redirectUri:l.redirectUri});let __codexRemoteControlCode=await l.authorizationCode;__codexRemoteControlFlowLog(\"remote_control_step_up_callback_received\",{codeLength:typeof __codexRemoteControlCode==\"string\"?__codexRemoteControlCode.length:null});return (await m$({code:__codexRemoteControlCode,codeVerifier:s.codeVerifier,clientId:QQ,issuer:o,redirectUri:l.redirectUri,fetchToken:n})).access_token}catch(e){__codexRemoteControlFlowLog(\"remote_control_step_up_failed\",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code,stack:e?.stack});throw e}finally{l.close();__codexRemoteControlFlowLog(\"remote_control_step_up_listener_closed\",{})}}";
    next = replaceExact(next, oldC$, newC$, "remote-control step-up flow");
    status = "patched";
  }
  if (!next.includes(exchangeMarker)) {
    const oldM$ =
      "async function m$({code:e,codeVerifier:t,clientId:n,issuer:r,redirectUri:i,fetchToken:a}){let o=await a(new URL(`/oauth/token`,d$(r)).toString(),{method:`POST`,headers:{\"Content-Type\":`application/x-www-form-urlencoded`},body:new URLSearchParams({grant_type:`authorization_code`,code:e,redirect_uri:i,client_id:n,code_verifier:t}).toString()});if(!o.ok)throw Error(`Remote control step-up token exchange failed with status ${o.status}.`);return s$.parse(await o.json())}";
    const newM$ =
      "async function m$({code:e,codeVerifier:t,clientId:n,issuer:r,redirectUri:i,fetchToken:a}){__codexRemoteControlFlowLog(\"remote_control_step_up_token_exchange_started\",{issuer:r,redirectUri:i});let o=await a(new URL(`/oauth/token`,d$(r)).toString(),{method:`POST`,headers:{\"Content-Type\":`application/x-www-form-urlencoded`},body:new URLSearchParams({grant_type:`authorization_code`,code:e,redirect_uri:i,client_id:n,code_verifier:t}).toString()});if(!o.ok){let e=\"\";try{e=await o.text()}catch{}__codexRemoteControlFlowLog(\"remote_control_step_up_token_exchange_failed\",{status:o.status,bodySnippet:e.slice(0,500)});throw Error(\"Remote control step-up token exchange failed with status \"+o.status+\".\")}let c=await o.json(),l=s$.parse(c);try{__codexRemoteControlStoreStepUpTokenResponse(l,{source:String(i).includes(\"/deviceauth/callback\")?\"device_code\":\"pkce\",issuer:r,redirectUri:i})}catch(e){__codexRemoteControlFlowLog(\"remote_control_step_up_store_failed\",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code})}__codexRemoteControlFlowLog(\"remote_control_step_up_token_exchange_done\",{status:o.status,responseKeys:l&&typeof l==\"object\"?Object.keys(l).slice(0,20):[]});return l}";
    next = replaceExact(next, oldM$, newM$, "remote-control step-up token exchange");
    status = "patched";
  }
  ensureMarker(next, flowMarker, "remote-control step-up flow");
  ensureMarker(next, exchangeMarker, "remote-control step-up token exchange");
  return { text: next, status };
}

function patchRemoteControlHttp(text) {
  const marker = "remote_control_http_response";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const oldP_ =
    "async function P_({action:e,appServerClient:t,desktopApiOptions:n,path:r,method:i,headers:o={},body:s,mapNotFoundToFeatureUnavailable:c=!0}){let l=__(n,r),u=await F_({action:e,appServerClient:t,desktopApiOptions:n,headers:o}),d=await a.net.fetch(l,{method:i,headers:u,body:s});if(d.status===401&&(u=await F_({action:e,appServerClient:t,desktopApiOptions:n,headers:o,refreshToken:!0}),d=await a.net.fetch(l,{method:i,headers:u,body:s})),d.status===404&&c)throw new O_;if(d.status===403)throw new A_(await H_(d));if(d.status===401)throw new k_(I_(e));if(!d.ok)throw Error(`Remote control request failed (${d.status}): ${await H_(d)}`);return d}";
  const newP_ =
    "async function P_({action:e,appServerClient:t,desktopApiOptions:n,path:r,method:i,headers:o={},body:s,mapNotFoundToFeatureUnavailable:c=!0}){let l=__(n,r),u=await F_({action:e,appServerClient:t,desktopApiOptions:n,headers:o}),d=await a.net.fetch(l,{method:i,headers:u,body:s});__codexRemoteControlFlowLog(\"remote_control_http_response\",{path:r,method:i,status:d.status,ok:d.ok,refreshed:!1});if(d.status===401){u=await F_({action:e,appServerClient:t,desktopApiOptions:n,headers:o,refreshToken:!0});d=await a.net.fetch(l,{method:i,headers:u,body:s});__codexRemoteControlFlowLog(\"remote_control_http_response\",{path:r,method:i,status:d.status,ok:d.ok,refreshed:!0})}if(!d.ok){let e=\"\";try{let t=d.clone?d.clone():d;e=await t.text()}catch(e){e=\"<<body read failed: \"+(e?.message??e)+\">>\"}__codexRemoteControlFlowLog(\"remote_control_http_failure_body\",{path:r,status:d.status,bodySnippet:e.slice(0,500)})}if(d.status===404&&c)throw new O_;if(d.status===403)throw new A_(await H_(d));if(d.status===401)throw new k_(I_(e));if(!d.ok)throw Error(\"Remote control request failed (\"+d.status+\"): \"+await H_(d));return d}";
  const next = replaceExact(text, oldP_, newP_, "remote-control HTTP diagnostics");
  ensureMarker(next, marker, "remote-control HTTP diagnostics");
  return { text: next, status: "patched" };
}

function patchRemoteControlAuthorize(text) {
  const marker = "remote_control_qm_start";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const oldQ_ =
    "async function Q_({appServerClient:e,desktopApiOptions:t,deviceKeyClient:n,globalState:r,requestRemoteControlEnrollmentStepUpToken:i}){await rv({appServerClient:e,deviceKeyClient:n,desktopApiOptions:t,enrollmentKey:ev(t),globalState:r,headers:await nv({action:`authorize remote control environments`,appServerClient:e,desktopApiOptions:t}),requestRemoteControlEnrollmentStepUpToken:i})}";
  const newQ_ =
    "async function Q_({appServerClient:e,desktopApiOptions:t,deviceKeyClient:n,globalState:r,requestRemoteControlEnrollmentStepUpToken:i}){__codexRemoteControlFlowLog(\"remote_control_qm_start\",{hasStepUp:typeof i==\"function\"});try{let a=await nv({action:`authorize remote control environments`,appServerClient:e,desktopApiOptions:t});__codexRemoteControlFlowLog(\"remote_control_qm_headers_ready\",{headerKeys:Object.keys(a).filter(e=>e.toLowerCase()!==\"authorization\").sort(),hasAuthorization:Object.keys(a).some(e=>e.toLowerCase()===\"authorization\"),hasChatGptAccountId:Object.keys(a).some(e=>e.toLowerCase()===\"chatgpt-account-id\")});await rv({appServerClient:e,deviceKeyClient:n,desktopApiOptions:t,enrollmentKey:ev(t),globalState:r,headers:a,requestRemoteControlEnrollmentStepUpToken:i});__codexRemoteControlFlowLog(\"remote_control_qm_completed\",{})}catch(e){__codexRemoteControlFlowLog(\"remote_control_qm_failed\",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code,stack:e?.stack});throw e}}";
  const next = replaceExact(text, oldQ_, newQ_, "remote-control authorize flow");
  ensureMarker(next, marker, "remote-control authorize flow");
  return { text: next, status: "patched" };
}

function patchDeviceKeyCreationLogs(text) {
  const marker = "remote_control_create_device_key_start";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const oldCreate =
    "async function jv({accountUserId:e,clientId:t,deviceKeyClient:n}){let r=await n.createDeviceKey(`allow_os_protected_nonextractable`);return{accountUserId:e,algorithm:r.algorithm,clientId:t,keyId:r.keyId,protectionClass:r.protectionClass,publicKeySpkiDerBase64:r.publicKeySpkiDerBase64}}";
  const newCreate =
    "async function jv({accountUserId:e,clientId:t,deviceKeyClient:n}){__codexRemoteControlFlowLog(\"remote_control_create_device_key_start\",{});try{let r=await n.createDeviceKey(`allow_os_protected_nonextractable`);return __codexRemoteControlFlowLog(\"remote_control_create_device_key_done\",{algorithm:r.algorithm,protectionClass:r.protectionClass}),{accountUserId:e,algorithm:r.algorithm,clientId:t,keyId:r.keyId,protectionClass:r.protectionClass,publicKeySpkiDerBase64:r.publicKeySpkiDerBase64}}catch(e){__codexRemoteControlFlowLog(\"remote_control_create_device_key_failed\",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code});throw e}}";
  const next = replaceExact(text, oldCreate, newCreate, "remote-control device-key creation logs");
  ensureMarker(next, marker, "remote-control device-key creation logs");
  return { text: next, status: "patched" };
}

function patchSoftwareDeviceKeyFallback(text) {
  const marker = "software_device_key_async_fallback";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const oldL$ =
    "function L$({resourcesPath:e}){let t=null,n=()=>{if(process.platform!==`darwin`)throw Error(`Remote control device keys are only available on macOS`);if(e==null)throw Error(`Remote control device keys require resourcesPath`);return t??=N$((0,s.join)(e,`native`,P$)),t};return{createDeviceKey:e=>n().createDeviceKey(e??`hardware_only`),deleteDeviceKey:e=>n().deleteDeviceKey(e),getDeviceKeyPublic:e=>n().getDeviceKeyPublic(e),signDeviceKey:async(e,t)=>{let r=R$(t);return{...await n().signDeviceKey(e,r),signedPayloadBase64:r.toString(`base64`)}}}}";
  const newL$ =
    "function __codexSoftwareRemoteControlDeviceKeyClient(){let e=null,t=()=>{let t=require(\"node:os\"),n=require(\"node:path\"),r=require(\"node:fs\"),i=process.env.CODEX_REMOTE_CONTROL_SOFTWARE_DEVICE_KEYS_JSON?.trim()||n.join(t.homedir(),\".codex\",\"remote-control-device-keys.json\");return e??={path:i,fs:r,pathModule:n,crypto:require(\"node:crypto\")},e},n=()=>{let{path:e,fs:n}=t();try{return JSON.parse(n.readFileSync(e,\"utf8\"))}catch(e){if(e?.code===\"ENOENT\")return{keys:{}};throw e}},r=e=>{let{path:n}=t();__codexRemoteControlSafeWriteFile(n,JSON.stringify(e,null,2)+\"\\n\")},i=e=>{try{let t=n();return t.keys?.[e]??null}catch{return null}},a=e=>{let t=n();t.keys?.[e]&&delete t.keys[e];r(t)},o=e=>{let{crypto:t}=globalThis.__codexSoftwareRemoteControlDeviceKeyClientState??(globalThis.__codexSoftwareRemoteControlDeviceKeyClientState={crypto:require(\"node:crypto\")}),i=n(),a=t.generateKeyPairSync(\"ec\",{namedCurve:\"prime256v1\",publicKeyEncoding:{type:\"spki\",format:\"der\"},privateKeyEncoding:{type:\"pkcs8\",format:\"pem\"}}),o=\"sw_\"+t.randomUUID().replace(/-/g,\"\"),s={algorithm:\"ecdsa_p256_sha256\",keyId:o,protectionClass:\"os_protected_nonextractable\",publicKeySpkiDerBase64:a.publicKey.toString(\"base64\"),privateKeyPkcs8Pem:a.privateKey,createdAt:new Date().toISOString(),policy:e};return i.keys??={},i.keys[o]=s,r(i),{algorithm:s.algorithm,keyId:s.keyId,protectionClass:s.protectionClass,publicKeySpkiDerBase64:s.publicKeySpkiDerBase64}},s=(e,n)=>{let r=i(e);if(r==null)throw Error(\"software remote-control device key not found\");let{crypto:a}=t(),o=a.sign(\"sha256\",n,{key:r.privateKeyPkcs8Pem,dsaEncoding:\"der\"});return{algorithm:r.algorithm,signatureDerBase64:o.toString(\"base64\")}},c=e=>i(e)!=null;return{hasDeviceKey:c,createDeviceKey:o,deleteDeviceKey:a,getDeviceKeyPublic:e=>{let t=i(e);if(t==null)throw Error(\"software remote-control device key not found\");return{algorithm:t.algorithm,keyId:t.keyId,protectionClass:t.protectionClass,publicKeySpkiDerBase64:t.publicKeySpkiDerBase64}},signDeviceKey:s}}function L$({resourcesPath:e}){let t=null,n=()=>{if(process.platform!==`darwin`)throw Error(`Remote control device keys are only available on macOS`);if(e==null)throw Error(`Remote control device keys require resourcesPath`);return t??=N$((0,s.join)(e,`native`,P$)),t},r=null,i=()=>r??=__codexSoftwareRemoteControlDeviceKeyClient(),a=e=>{__codexRemoteControlFlowLog(\"software_device_key_async_fallback\",{errorName:e?.name,errorMessage:e?.message,errorCode:e?.code})};return{createDeviceKey:async e=>{try{return await n().createDeviceKey(e??`hardware_only`)}catch(t){if((process.env.CODEX_REMOTE_CONTROL_SOFTWARE_DEVICE_KEY_FALLBACK??`1`)===`0`)throw t;a(t);return i().createDeviceKey(e??`hardware_only`)}},deleteDeviceKey:e=>i().hasDeviceKey(e)?i().deleteDeviceKey(e):n().deleteDeviceKey(e),getDeviceKeyPublic:e=>i().hasDeviceKey(e)?i().getDeviceKeyPublic(e):n().getDeviceKeyPublic(e),signDeviceKey:async(e,t)=>{let r=R$(t);if(i().hasDeviceKey(e)){let t=i().signDeviceKey(e,r);return{...t,signedPayloadBase64:r.toString(`base64`)}}return{...await n().signDeviceKey(e,r),signedPayloadBase64:r.toString(`base64`)}}}}";
  const next = replaceExact(text, oldL$, newL$, "remote-control software device-key fallback");
  ensureMarker(next, marker, "remote-control software device-key fallback");
  return { text: next, status: "patched" };
}

function patchMobileSetup(text) {
  const marker = "remote_control_mobile_setup_no_auth_redirect";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const queryRedirectPattern =
    /e\.status===401\?\([A-Za-z_$][\w$]*\(\),new ([A-Za-z_$][\w$]*)\(`ChatGPT auth is required to load remote control environments\.`\)\)/;
  if (!queryRedirectPattern.test(text)) {
    throw new Error("mobile setup 401 redirect anchor not found");
  }
  const next = text.replace(
    queryRedirectPattern,
    (_match, ctor) =>
      `e.status===401?(void"remote_control_mobile_setup_no_auth_redirect",new ${ctor}(\`ChatGPT auth is required to load remote control environments.\`))`,
  );
  ensureMarker(next, marker, "mobile setup 401 redirect");
  return { text: next, status: "patched" };
}

function patchMobileSetupFlow(text) {
  const marker = "remote_control_mobile_setup_authorize_before_enable";
  if (text.includes(marker)) {
    return { text, status: "already-patched" };
  }
  const oldFlow =
    "async function F(e,t,n){return t===`local`?(await y(`set-local-remote-control-enabled`,{params:{enabled:n}}),k(e,n,{force:!0})):se(e,t,n)}";
  const newFlow =
    "async function F(e,t,n){return t===`local`?(n&&(void\"remote_control_mobile_setup_authorize_before_enable\",await y(`authorize-remote-control-connections`,{params:{}})),await y(`set-local-remote-control-enabled`,{params:{enabled:n}}),k(e,n,{force:!0})):se(e,t,n)}";
  const next = replaceExact(text, oldFlow, newFlow, "mobile setup authorize before local enable");
  ensureMarker(next, marker, "mobile setup authorize before local enable");
  return { text: next, status: "patched" };
}

function patchRemoteConnectionsSettingsVisibility(text) {
  const controlTabMarker = "remote_control_settings_force_control_this_pc_visible";
  const sectionMarker = "remote_control_settings_force_remote_control_section_visible";
  let status = "already-patched";
  let next = text;
  if (!next.includes(controlTabMarker)) {
    next = replaceExact(
      next,
      "nt=Ne&&!0,",
      "nt=(void\"remote_control_settings_force_control_this_pc_visible\",!0),",
      "remote connections local setup visibility",
    );
    status = "patched";
  }
  if (!next.includes(sectionMarker)) {
    next = replaceExact(
      next,
      "Ne=Xe(),X=!T,",
      "Ne=(void\"remote_control_settings_force_remote_control_section_visible\",!0),X=!T,",
      "remote connections section visibility",
    );
    status = "patched";
  }
  ensureMarker(next, controlTabMarker, "remote connections local setup visibility");
  ensureMarker(next, sectionMarker, "remote connections section visibility");
  return { text: next, status };
}

function locateTargets(platform) {
  const root = getAsarRoot(platform);
  const jsFiles = walk(root).filter((file) => file.endsWith(".js"));
  const mainFile = findOne(jsFiles, "26.616 main remote-control bundle", (_file, text) =>
    text.includes("CODEX_API_BASE_URL") &&
    text.includes("authorize remote control environments") &&
    text.includes("async function P_({action:e,appServerClient:t,desktopApiOptions:n") &&
    text.includes("async function v_({action:e,appServerClient:t") &&
    text.includes("async function c$({accountId:e,desktopApiOptions:t"),
  );
  const mobileSetupNoAuthRedirectFiles = findAll(
    jsFiles,
    "26.616 codex mobile setup 401 redirect bundle",
    (file, text) =>
      path.basename(file).startsWith("codex-mobile-setup-") &&
      text.includes("ChatGPT auth is required to load remote control environments.") &&
      text.includes("e.status===401"),
  );
  const mobileSetupFlowFile = findOne(jsFiles, "26.616 codex mobile setup flow bundle", (file, text) =>
    path.basename(file).startsWith("codex-mobile-setup-flow-") &&
    text.includes("async function F(e,t,n)") &&
    text.includes("set-local-remote-control-enabled"),
  );
  const remoteConnectionsSettingsFile = findOne(
    jsFiles,
    "26.616 remote connections settings bundle",
    (file, text) =>
      path.basename(file).startsWith("remote-connections-settings-") &&
      text.includes("showControlThisMacTab") &&
      text.includes("control-this-mac") &&
      text.includes("remote_control_connections_state") &&
      (text.includes("nt=Ne&&!0,") || text.includes("remote_control_settings_force_control_this_pc_visible")),
  );

  return {
    mainFile,
    mobileSetupNoAuthRedirectFiles,
    mobileSetupFlowFile,
    remoteConnectionsSettingsFile,
  };
}

function applyPatchers(file, patchers, isCheck) {
  const source = read(file);
  let code = source;
  const results = [];
  for (const [id, patcher] of patchers) {
    const result = patcher(code);
    code = result.text;
    results.push({ id, status: result.status === "patched" && isCheck ? "would-patch" : result.status });
  }
  if (!isCheck && code !== source) {
    write(file, code);
  }
  return results;
}

function patchPlatform(platform, isCheck) {
  const targets = locateTargets(platform);
  const reports = [];
  reports.push({
    file: targets.mainFile,
    results: applyPatchers(
      targets.mainFile,
      [
        ["flowHelpers", patchFlowHelpers],
        ["desktopFetch", patchDesktopFetch],
        ["appServerAuthFallback", patchAppServerAuthFallback],
        ["stepUpFlow", patchStepUpFlow],
        ["httpDiagnostics", patchRemoteControlHttp],
        ["authorizeFlow", patchRemoteControlAuthorize],
        ["deviceKeyCreationLogs", patchDeviceKeyCreationLogs],
        ["softwareDeviceKeyFallback", patchSoftwareDeviceKeyFallback],
      ],
      isCheck,
    ),
  });
  for (const file of targets.mobileSetupNoAuthRedirectFiles) {
    reports.push({
      file,
      results: applyPatchers(file, [["mobileSetupNoAuthRedirect", patchMobileSetup]], isCheck),
    });
  }
  reports.push({
    file: targets.mobileSetupFlowFile,
    results: applyPatchers(
      targets.mobileSetupFlowFile,
      [["mobileSetupFlowAuthorizeBeforeEnable", patchMobileSetupFlow]],
      isCheck,
    ),
  });
  reports.push({
    file: targets.remoteConnectionsSettingsFile,
    results: applyPatchers(
      targets.remoteConnectionsSettingsFile,
      [["remoteConnectionsSettingsVisibility", patchRemoteConnectionsSettingsVisibility]],
      isCheck,
    ),
  });
  return reports;
}

function printReports(platform, reports) {
  console.log(`  [${platform}] Remote Control optional patch`);
  for (const report of reports) {
    console.log(`    ${relPath(report.file)}`);
    for (const result of report.results) {
      const prefix = result.status === "patched" || result.status === "would-patch" ? "*" : "ok";
      console.log(`      ${prefix} [${result.id}] ${result.status}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((arg) => SUPPORTED_PLATFORMS.includes(arg));
  const platforms = getPlatforms(platform);

  if (platforms.length === 0) {
    console.log("  [skip] No supported Remote Control platform found");
    return;
  }

  let changed = 0;
  for (const plat of platforms) {
    const reports = patchPlatform(plat, isCheck);
    printReports(plat, reports);
    for (const report of reports) {
      changed += report.results.filter((result) => result.status === "patched" || result.status === "would-patch").length;
    }
  }

  const nativePath = path.join(PROJECT_ROOT, "resources", "remote-control", "codex.exe");
  if (fs.existsSync(nativePath)) {
    console.log(`  [native] ${relPath(nativePath)} will be used by tools/build-from-upstream.js`);
  } else {
    console.log("  [native] optional resources/remote-control/codex.exe not found; keeping official upstream resources/codex.exe");
  }

  if (isCheck) {
    console.log(`  [?] ${changed} Remote Control replacement(s) would be applied`);
  } else {
    console.log(`  [ok] ${changed} Remote Control replacement(s) applied`);
  }
}

try {
  main();
} catch (error) {
  console.error(`  [x] ${error.message}`);
  process.exit(1);
}
