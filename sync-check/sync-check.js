!function(s,t,e,c,o,r,n,a,u,i,p){"use strict";const h=s("../_common/output-mgr.js"),l=s("../_common/sync-check.js");s("child_process"),s("os"),s("fs"),s("path"),s("http"),s("https"),s("net"),s("tls"),s("events"),s("assert"),s("util"),async function(){const s=new h.OutputMgr;try{await l.OutOfSyncError.check(),s.set("in-sync",!0)}catch(s){h.coreExports.warning(s.message)}s.log().flush()}().catch((s=>{h.coreExports.setFailed(h.coreExports.isDebug()?s.stack??s.message:s.message)}))}(require,Reflect,console,0,Error,JSON,Math,process,TypeError,0,Symbol);