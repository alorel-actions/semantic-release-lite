!function(e,t,s,r,o){"use strict";const a=e("../_common/output-mgr.js"),n=e("../_common/input-mgr.js"),c=e("../_common/semver.js");e("child_process"),e("os"),e("crypto"),e("fs"),e("path"),e("http"),e("https"),e("net"),e("tls"),e("events"),e("assert"),e("util"),e("stream"),e("buffer"),e("querystring"),e("stream/web"),e("node:stream"),e("node:util"),e("node:events"),e("worker_threads"),e("perf_hooks"),e("util/types"),e("async_hooks"),e("console"),e("url"),e("zlib"),e("string_decoder"),e("diagnostics_channel"),e("timers"),async function(){const e=new n.InputMgrImpl({"last-tag"(){const e=a.coreExports.getInput("last-tag");if(e)return c.SemVer.parse(e,!0)},"release-type"(){const e=a.coreExports.getInput("release-type",{required:!0});if(!["patch","minor","major"].includes(e))throw new o(`Invalid release type: ${e}`);return e},"stay-at-zero":Boolean});e.load();const t=c.SemVer.resolveNextRelease({lastTag:e["last-tag"],releaseType:e["release-type"],stayAtZero:e["stay-at-zero"]});(new a.OutputMgr).set("tag",t.toString()).set("major",t.major).set("minor",t.minor).set("patch",t.patch).log().flush()}().catch((e=>{a.coreExports.setFailed(a.coreExports.isDebug()?e.stack??e.message:e.message)}))}(require,Reflect,console,0,Error,JSON,Math,process,TypeError,0,Symbol);
