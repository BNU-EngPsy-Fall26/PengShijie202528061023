/* 纯函数：试次生成与统计，不连接网络，供网页与测试共同使用。 */
(function(root){'use strict';
const VERSION='2026-11-02-v1',EXPERIMENTS=['visual_search_v1','graphical_estimation_v1'];
function shuffle(xs,rng=Math.random){const a=xs.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function searchTrials(practice=false){let out=[];for(const mode of ['feature','conjunction','grouped'])for(const size of (practice?[12,24]:[12,24,36]))for(const present of [0,1])for(let k=0;k<(practice?1:10);k++)out.push({task:'search',mode,size,present,cond:`${mode}_n${size}_${present?'present':'absent'}`,repeat:k});return shuffle(out).map((t,i)=>({...t,planned_trial:i+1}));}
function graphTrials(practice=false){let out=[];const truth=practice?[23,67]:[13,17,21,26,31,37,42,48,54,59,64,68,72,77,81,19,29,39,49,69];for(const mode of ['bar','pie','pie_ticks'])for(let i=0;i<truth.length;i++)out.push({task:'graph',mode,truth:truth[i],cond:mode,repeat:i,planned_trial:out.length+1});return shuffle(out);}
function searchItems(t,rng=Math.random){const all=shuffle(Array.from({length:36},(_,i)=>i),rng),n=t.size;let positions,colors;if(t.mode==='grouped'){const left=shuffle(all.filter(i=>i%6<3),rng).slice(0,n/2),right=shuffle(all.filter(i=>i%6>=3),rng).slice(0,n/2);positions=left.concat(right);const flip=t.repeat%2===0;colors=positions.map((_,i)=>(i<n/2)===flip?'red':'cyan');}else{positions=all.slice(0,n);colors=t.mode==='feature'?Array(n).fill('cyan'):shuffle(Array.from({length:n},(_,i)=>i<n/2?'red':'cyan'),rng);}let items=positions.map((cell,i)=>({cell,color:colors[i],shape:t.mode==='feature'?'T':colors[i]==='red'?'L':'T'}));if(t.present){const eligible=items.map((x,i)=>t.mode==='feature'||x.color==='red'?i:-1).filter(i=>i>=0);let target=eligible[Math.floor(rng()*eligible.length)];items[target]={...items[target],color:'red',shape:'T'};}return items;}
// 后台会截断长字符串；36个格子的排列使用最多143字符的可逆编码。
function encodeStimulus(items){return items.map(i=>i.cell.toString(36)+(i.color==='red'?'R':'C')+i.shape).join(',');}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function slope(points){if(points.length<2)return null;const mx=mean(points.map(x=>x[0])),my=mean(points.map(x=>x[1]));let den=points.reduce((s,p)=>s+(p[0]-mx)**2,0);return den?points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/den:null;}
function summarize(trials,task){const valid=trials.filter(t=>t.valid===1&&t.practice===0);const groups={};for(const t of valid){const key=task==='search'?`${t.mode}_${t.size}_${t.present}`:t.mode;(groups[key]??=[]).push(t);}return Object.entries(groups).map(([key,a])=>{const first=a[0],rts=a.filter(t=>!t.timeout&&t.rt>=150&&(task!=='search'||t.correct===1)).map(t=>t.rt);return{key,mode:first.mode,size:first.size,present:first.present,n:a.length,accuracy:mean(a.map(t=>t.correct)),rt:mean(rts),rtN:rts.length,timeoutRate:mean(a.map(t=>t.timeout?1:0)),mae:task==='graph'?mean(a.filter(t=>!t.timeout).map(t=>t.abs_error)):null,logError:task==='graph'?mean(a.filter(t=>!t.timeout).map(t=>t.log_error)):null};});}
function searchSlopes(trials){let rows=summarize(trials,'search'),out={};for(let mode of ['feature','conjunction','grouped'])for(let present of [0,1]){const points=rows.filter(x=>x.mode===mode&&x.present===present&&x.rt!==null).map(x=>[x.size,x.rt]);out[`${mode}_${present}`]=points.length===3?slope(points):null;}return out;}
function csv(trials){const keys=[...new Set(trials.flatMap(Object.keys))];const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';return '\uFEFF'+keys.map(esc).join(',')+'\r\n'+trials.map(r=>keys.map(k=>esc(r[k])).join(',')).join('\r\n');}
// 完成需覆盖全部计划条件；无效补做不重复计数，试玩永不进入正式汇总。
function participantSummary(records,task){
 const by=new Map(),expected=task==='search'?searchTrials():graphTrials();
 for(const r of records){
  if(!r.participant||!Array.isArray(r.trials))continue;
  const trials=r.trials.filter(t=>t.protocol===VERSION&&t.task===task&&t.practice===0&&t.is_demo!==1&&t.is_test!==1);
  const valid=trials.filter(t=>t.valid===1),ids=new Set(valid.map(t=>t.planned_trial));
  if(valid.length!==expected.length||ids.size!==expected.length)continue;
  const counts={};for(const t of valid){const key=task==='search'?`${t.mode}_${t.size}_${t.present}`:t.mode;counts[key]=(counts[key]||0)+1;}
  if(expected.some(t=>counts[task==='search'?`${t.mode}_${t.size}_${t.present}`:t.mode] !== (task==='search'?10:20)))continue;
  const key=String(r.participant),candidate={...r,trials};
  if(!by.has(key)||String(trials[0]?.completed_at||'')>String(by.get(key).trials[0]?.completed_at||''))by.set(key,candidate);
 }
 return [...by.values()].map(r=>({participant:r.participant,rows:summarize(r.trials,task),slopes:task==='search'?searchSlopes(r.trials):{}}));
}
// 上传范围与统计范围分开：练习、未完成和无效试次均保存到后台。
function makeUploadSession(run,complete,endedAt=new Date().toISOString()){
 if(!run.trials?.length)return null;
 const practice=!!run.practice,isTest=!!run.isTest||run.trials.some(t=>t.is_test===1||t.is_demo===1);
 const base=complete?(practice?`practice_${run.task}_v1`:EXPERIMENTS[run.task==='search'?0:1]):`partial_${run.task}_${practice?'practice':'formal'}_v1`;
 const experiment=(isTest?'test_':'')+base;
 return {id:run.id,task:run.task,practice,complete,isTest,experiment,participant:run.participant,
  trials:run.trials.map(t=>({...t,practice:practice?1:0,is_test:isTest?1:0,phase_complete:complete?1:0,ended_at:endedAt,...(complete?{completed_at:endedAt}:{})})),
  completed_at:complete?endedAt:'',ended_at:endedAt,status:'pending',message:'等待上传'};
}

// 合并后台与本机：以session去重，后台匿名编号优先，保留练习/中断/测试来源。
function observationRecords(remote=[],local=[]){
 const aliases=new Map(),by=new Map();
 for(const r of remote){const raw=r.trials?.[0]?.participant;if(raw&&r.participant)aliases.set(raw,String(r.participant));}
 for(const [source,list] of [['本机',local],['后台',remote]])for(const r of list){
  const trials=(r.trials||[]).filter(t=>t.protocol===VERSION);if(!trials.length)continue;
  const t=trials[0],task=t.task||r.task;if(!['search','graph'].includes(task))continue;
  const raw=r.participant||t.participant,id=t.session||r.id||`${source}-${r.record_id}`;
  const participant=source==='后台'?String(r.participant):aliases.get(raw)||String(raw);
  const practice=t.practice===1||r.practice===true,isTest=trials.some(t=>t.is_test===1||t.is_demo===1)||!!r.isTest||/^test_/.test(r.experiment||'');
  const complete=r.complete!==undefined?r.complete:t.phase_complete!==undefined?t.phase_complete===1:!/(^|_)partial_/.test(r.experiment||'');
  const normalized={id,participant,rawParticipant:t.participant||raw,task,practice,isTest,complete,phase:complete?(practice?'practice':'formal'):'partial',trials,source,stamp:t.ended_at||t.completed_at||r.completed_at||r.created_at||t.started_at||''};
  if(!by.has(id)||source==='后台')by.set(id,normalized);
 }
 return [...by.values()].sort((a,b)=>String(a.stamp).localeCompare(String(b.stamp)));
}
function latestObservations(records,{task,phase='formal',showTests=false}={}){
 const latest=new Map();for(const r of records){if(r.task!==task||r.phase!==phase||(!showTests&&r.isTest))continue;const prev=latest.get(r.participant);if(!prev||String(r.stamp)>=String(prev.stamp))latest.set(r.participant,r);}
 return [...latest.values()].sort((a,b)=>a.participant.localeCompare(b.participant,undefined,{numeric:true}));
}
function observationSummary(records,task){
 // practice字段仅在临时统计副本中置0，原始记录完全保留。
 const people=records.map(r=>({...r,rows:summarize(r.trials.map(t=>({...t,practice:0})),task)}));
 const groups=new Map();for(const p of people)for(const row of p.rows){if(!groups.has(row.key))groups.set(row.key,[]);groups.get(row.key).push(row);}
 const rows=[...groups.values()].map(a=>{const r={...a[0],n:a.reduce((n,x)=>n+x.n,0),rtN:a.reduce((n,x)=>n+x.rtN,0),participants:a.length,metricN:{}};for(const metric of ['rt','accuracy','timeoutRate','mae','logError']){const values=a.map(x=>x[metric]).filter(v=>typeof v==='number'&&Number.isFinite(v));r[metric]=mean(values);r.metricN[metric]=values.length;}return r;});
 return {people,rows,totalTrials:records.reduce((n,r)=>n+r.trials.length,0),invalid:records.reduce((n,r)=>n+r.trials.filter(t=>t.valid!==1).length,0),timeouts:records.reduce((n,r)=>n+r.trials.filter(t=>t.valid===1&&t.timeout===1).length,0)};
}
function observationModeMetric(people,mode,metric){
 const values=people.map(p=>{const rows=p.rows.filter(r=>r.mode===mode),used=rows.filter(r=>typeof r[metric]==='number'&&Number.isFinite(r[metric]));const denom=used.reduce((n,r)=>n+r.n,0);return denom?used.reduce((n,r)=>n+r[metric]*r.n,0)/denom:null;}).filter(v=>v!==null);
 return {value:mean(values),n:values.length};
}

const api={VERSION,EXPERIMENTS,shuffle,searchTrials,graphTrials,searchItems,encodeStimulus,mean,slope,summarize,searchSlopes,csv,participantSummary,makeUploadSession,observationRecords,latestObservations,observationSummary,observationModeMetric};if(typeof module!=='undefined')module.exports=api;root.AttentionCore=api;
})(typeof window!=='undefined'?window:globalThis);
