import {secureStudyUrl} from '../lib/study/secure-url.mjs';
import {build} from 'esbuild';
import {mkdir,rm,writeFile,copyFile,readFile} from 'node:fs/promises';
await rm('dist-esa',{recursive:true,force:true});
await mkdir('dist-esa',{recursive:true});
const client=await build({entryPoints:['esa/client.tsx'],outdir:'dist-esa/assets',entryNames:'study-[hash]',bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',minify:true,metafile:true,define:{'process.env.NODE_ENV':'"production"'}});
const files=Object.keys(client.metafile.outputs);
const script=files.find(p=>p.endsWith('.js')).replace('dist-esa','');
const style=files.find(p=>p.endsWith('.css')).replace('dist-esa','');
const browserCode=await readFile('dist-esa'+script,'utf8');
const privatePool=JSON.parse(await readFile('data/pool.json','utf8'));
if(privatePool.some(q=>browserCode.includes(q.id))||['DATABASE_URL','STUDY_ADMIN_KEY','STUDY_GATEWAY_KEY','COS_SECRET_KEY'].some(k=>browserCode.includes(k)))throw new Error('Private server data found in ESA browser bundle');
await writeFile('dist-esa/index.html',`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><script>(()=>{const target=(${secureStudyUrl.toString()})(window.location.href);if(target)window.location.replace(target)})();</script><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="description" content="观看竞技游戏短片段，评价意图标签与描述的画面依据。"><title>Game-Intention · 意图标注研究</title><link rel="stylesheet" href="${style}"></head><body><div id="root"></div><script type="module" src="${script}"></script></body></html>`);
await writeFile('dist-esa/robots.txt','User-agent: *\nDisallow: /\n');
await copyFile('public/study-demo.mp4','dist-esa/study-demo.mp4');
await build({entryPoints:['esa/worker.mjs'],outfile:'work/esa-worker.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022'});
// Pin the external dependency for Deno; local business logic and the private pool
// are bundled only into Supabase, never into the ESA static assets.
await build({entryPoints:['supabase/functions/survey-api/entry.mjs'],outfile:'supabase/functions/survey-api/index.mjs',bundle:true,format:'esm',platform:'node',target:'es2022',external:['node:*'],plugins:[{name:'deno-postgres',setup(b){b.onResolve({filter:/^postgres$/},()=>({path:'npm:postgres@3.4.7',external:true}));}}]});
console.log('ESA assets, edge API proxy, and Supabase survey-api bundle built.');
