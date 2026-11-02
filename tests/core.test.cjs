const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/core.js');
test('180 formal search trials: all 18 cells exactly 10; practice isolated',()=>{let t=C.searchTrials(),counts={};assert.equal(t.length,180);for(const x of t)counts[x.cond]=(counts[x.cond]||0)+1;assert.equal(Object.keys(counts).length,18);assert.ok(Object.values(counts).every(n=>n===10));assert.equal(C.searchTrials(true).length,12);});
test('generated stimulus always has exactly the intended target and set size',()=>{for(let j=0;j<20;j++)for(const t of C.searchTrials()){const a=C.searchItems(t);assert.equal(a.length,t.size);assert.equal(new Set(a.map(x=>x.cell)).size,t.size);assert.equal(a.filter(x=>x.shape==='T'&&x.color==='red').length,t.present);if(t.mode==='grouped')for(const side of [0,1])assert.equal(new Set(a.filter(x=>(x.cell%6<3?0:1)===side).map(x=>x.color)).size,1);}});
test('graphical tasks pair the same 20 true proportions across 3 conditions',()=>{const t=C.graphTrials();assert.equal(t.length,60);const modes=['bar','pie','pie_ticks'];const truths=modes.map(m=>t.filter(x=>x.mode===m).map(x=>x.truth).sort((a,b)=>a-b));assert.deepEqual(truths[0],truths[1]);assert.deepEqual(truths[1],truths[2]);assert.equal(C.graphTrials(true).length,6);});
test('RT excludes errors, timeout, practice and invalid; accuracy includes timeout',()=>{const r={practice:0,valid:1,mode:'feature',size:12,present:1,correct:1,rt:600,timeout:0};let rows=C.summarize([r,{...r,correct:0,rt:900},{...r,timeout:1,correct:0,rt:5000},{...r,valid:0,rt:99999},{...r,practice:1,rt:1}],'search');assert.equal(rows[0].n,3);assert.equal(rows[0].rt,600);assert.equal(rows[0].accuracy,1/3);});
test('slope and empty results are defined without artificial zero data',()=>{assert.equal(C.slope([[12,600],[24,840],[36,1080]]),20);assert.equal(C.slope([]),null);assert.deepEqual(C.summarize([],'graph'),[]);});
test('CSV quotes are escaped, long anonymous IDs preserved',()=>{const text=C.csv([{id:'P-123456789012',note:'a,"b"'}]);assert.ok(text.includes('"a,""b"""'));assert.ok(text.includes('P-123456789012'));});

test('only complete balanced non-demo participants counted, latest complete session retained',()=>{
 const trials=C.graphTrials().map(t=>({...t,protocol:C.VERSION,practice:0,is_demo:0,valid:1,correct:1,rt:900,timeout:0,abs_error:2,log_error:1,completed_at:'2026-11-02T01:00:00Z'}));
 const records=[{participant:'P1',trials},{participant:'P1',trials:trials.map(t=>({...t,abs_error:4,completed_at:'2026-11-02T02:00:00Z'}))},{participant:'P2',trials:trials.slice(0,59)},{participant:'P3',trials:trials.map(t=>({...t,is_demo:1}))},{participant:'P4',trials:trials.map(t=>({...t,mode:'bar'}))},{participant:'P5',trials:trials.map(t=>({...t,planned_trial:1}))}];
 const p=C.participantSummary(records,'graph');assert.equal(p.length,1);assert.equal(p[0].rows[0].mae,4);
 assert.equal(C.participantSummary(records,'search').length,0);
});

test('full search records accepted; slopes require all three set sizes',()=>{
 const trials=C.searchTrials().map(t=>({...t,protocol:C.VERSION,practice:0,is_demo:0,valid:1,correct:1,rt:400+20*t.size,timeout:0,completed_at:'2026-11-02T01:00:00Z'}));
 const p=C.participantSummary([{participant:'P1',trials}], 'search');assert.equal(p.length,1);assert.equal(p[0].slopes.conjunction_1,20);
 assert.equal(C.searchSlopes(trials.filter(t=>t.size!==36)).conjunction_1,null);
 const payload={project:'6NU4VG',participant:'P1',experiment:C.EXPERIMENTS[0],condition:'search',meta:{protocol:C.VERSION},trials:trials.map(t=>({...t,stimulus:C.encodeStimulus(C.searchItems(t)),session:'01234567-0123-4567-89ab-0123456789ab',trial:t.planned_trial,response_mode:'keyboard',response:t.present,invalid_reason:'',abs_error:-1,log_error:-1,started_at:'2026-11-02T01:00:00Z',consent_version:'2026-11-02',experiment_order:'search_graph',recommended_order:'search_graph',viewport_w:1440,viewport_h:900}))};
 assert.ok(Buffer.byteLength(JSON.stringify(payload))<250000);
});

test('stimulus encoding fits backend short-string limit and is reversible',()=>{
 for(const t of C.searchTrials()){
  const items=C.searchItems(t),encoded=C.encodeStimulus(items);
  assert.ok(encoded.length<=143);
  const decoded=encoded.split(',').map(s=>({cell:parseInt(s[0],36),color:s[1]==='R'?'red':'cyan',shape:s[2]}));
  assert.deepEqual(decoded,items);
 }
});
test('test-marked complete records never count as research participants',()=>{
 const trials=C.graphTrials().map(t=>({...t,protocol:C.VERSION,practice:0,is_demo:0,is_test:1,valid:1,correct:1,rt:900,timeout:0,abs_error:2,log_error:1}));
 assert.equal(C.participantSummary([{participant:'TEST',trials}],'graph').length,0);
});

test('all recorded trials survive upload packaging: practice, invalid and partial',()=>{
 const trials=[{task:'graph',trial:1,practice:1,valid:1,rt:700},{task:'graph',trial:2,practice:1,valid:0,invalid_reason:'visibility_or_pause',rt:200}];
 const run={id:'session-a',task:'graph',participant:'P1',practice:true,trials};
 for(const complete of [true,false]){
  const s=C.makeUploadSession(run,complete,'2026-11-02T01:00:00Z');
  assert.equal(s.trials.length,2);assert.equal(s.trials[1].invalid_reason,'visibility_or_pause');
  assert.equal(s.trials[1].practice,1);assert.equal(s.trials[0].phase_complete,complete?1:0);
  assert.equal(s.experiment,complete?'practice_graph_v1':'partial_graph_practice_v1');
 }
 assert.equal(C.makeUploadSession({...run,trials:[]},false),null);
 assert.equal(trials[0].phase_complete,undefined,'raw input not mutated');
});
test('upload routes fit backend naming limit for all phases and test markers',()=>{
 for(const task of ['search','graph'])for(const practice of [true,false])for(const complete of [true,false])for(const isTest of [true,false]){
  const s=C.makeUploadSession({id:'s',participant:'p',task,practice,isTest,trials:[{is_demo:0}]},complete);
  assert.match(s.experiment,/^[a-z0-9_]{1,32}$/);assert.equal(s.trials[0].is_test,isTest?1:0);
 }
});
test('observation merge deduplicates local/cloud sessions and preserves participant alias',()=>{
 const t={protocol:C.VERSION,task:'graph',session:'same',participant:'P-raw',practice:0,phase_complete:1,valid:1,mode:'pie',correct:1,rt:600,timeout:0,abs_error:2,log_error:1};
 const remote=[{participant:'P04',trials:[t]}],local=[{id:'same',participant:'P-raw',task:'graph',trials:[t]},{id:'new',participant:'P-raw',task:'graph',trials:[{...t,session:'new',practice:1}]}];
 const r=C.observationRecords(remote,local);assert.equal(r.length,2);assert.ok(r.every(x=>x.participant==='P04'));assert.equal(r.find(x=>x.id==='same').source,'后台');assert.equal(r.find(x=>x.id==='new').phase,'practice');
});
test('observation scopes select latest per person and do not silently include tests or practice',()=>{
 const records=[{id:'a',participant:'P04',task:'search',phase:'formal',stamp:'1'},{id:'b',participant:'P04',task:'search',phase:'formal',stamp:'2'},{id:'c',participant:'P04',task:'search',phase:'practice',stamp:'3'},{id:'d',participant:'P05',task:'search',phase:'formal',stamp:'4',isTest:true}];
 assert.deepEqual(C.latestObservations(records,{task:'search'}).map(r=>r.id),['b']);assert.equal(C.latestObservations(records,{task:'search',showTests:true}).length,2);assert.equal(C.latestObservations(records,{task:'search',phase:'practice'})[0].id,'c');
});
test('group charts weight people equally, preserve practice raw data, and keep missing RT null',()=>{
 const row={task:'graph',practice:1,valid:1,mode:'pie',correct:1,rt:600,timeout:0,abs_error:2,log_error:1};
 const records=[{participant:'A',trials:[row]},{participant:'B',trials:Array.from({length:10},()=>({...row,rt:1000,abs_error:8}))}];
 const s=C.observationSummary(records,'graph');assert.equal(s.rows[0].rt,800);assert.equal(s.rows[0].mae,5);assert.equal(s.rows[0].n,11);assert.equal(row.practice,1);
 assert.equal(C.observationModeMetric(s.people,'pie','mae').value,5);
 const timeout=C.observationSummary([{trials:[{...row,correct:0,timeout:1}]}],'graph');assert.equal(timeout.rows[0].rt,null);assert.equal(timeout.timeouts,1);
});
