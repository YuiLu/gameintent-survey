import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { analyze } from '../lib/study/analysis.mjs';
const args=process.argv.slice(2);const get=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1]};const input=get('--input'),out=get('--out','outputs/analysis');
if(!input){console.error('Usage: node scripts/analyze-study.mjs --input study-export.json [--out outputs/analysis] [--replicates 5000] [--mode crossed|source|reviewer]');process.exit(1)}
const raw=fs.readFileSync(input,'utf8'),snapshot=JSON.parse(raw),participants=new Map(snapshot.participants.map(p=>[p.id,p]));
const rows=snapshot.responses.map(r=>{const p=participants.get(r.participant_id);return {...r,eligible:!!p&&['active','completed'].includes(p.status)&&!!p.consented_at&&!!p.qualified_at&&r.study_phase==='live'}});
const result=analyze(rows,snapshot.questions,snapshot.study.config,{replicates:Number(get('--replicates',5000)),mode:get('--mode','crossed'),clipSensitivity:args.includes('--clip-sensitivity')});
result.export_sha256=crypto.createHash('sha256').update(raw).digest('hex');result.pool_hash=snapshot.study.pool_hash;result.dataset_revision=snapshot.study.config.datasetRevision;
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'analysis.json'),JSON.stringify(result,null,2)+'\n');
const keys=['label_support','description_grounding','joint_validity','insufficient_evidence'];const headers=['game','clips',...keys.flatMap(k=>[k,k+'_lower95',k+'_upper95']),'alpha_label','alpha_description'];const entries=Object.entries(result.games).map(([game,g])=>[game,g.clips,...keys.flatMap(k=>[g.metrics[k].value,...(g.metrics[k].ci95||[null,null])]),g.agreement.label.alpha,g.agreement.description.alpha]);
for(const [name,g] of [['game_macro',result.game_macro],['dataset_weighted',result.dataset_weighted]])if(g)entries.push([name,result.coverage.complete_clips,...keys.flatMap(k=>[g[k].value,...(g[k].ci95||[null,null])]),null,null]);
fs.writeFileSync(path.join(out,'metrics.csv'),[headers,...entries].map(r=>r.map(v=>v===null?'':v).join(',')).join('\n')+'\n');
console.log(JSON.stringify({status:result.status,coverage:result.coverage,output:out,export_sha256:result.export_sha256},null,2));
