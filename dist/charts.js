/* 仅绘图，不读取网络或改变原始数据。空值留空，所有坐标轴从零起。 */
(function(root){'use strict';
const colors=['#196653','#cc6946','#376fa3'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const value=(v,unit)=>finite(v)?(unit==='ms'?v.toFixed(0):v.toFixed(1))+' '+unit:'暂无数据';
function ceiling(values,limit){if(limit)return limit;const max=Math.max(0,...values.filter(finite));if(!max)return 1;const step=10**Math.floor(Math.log10(max));return Math.ceil(max/step)*step;}
function frame(title,body,legend=''){return `<figure class="result-figure"><figcaption>${esc(title)}</figcaption>${body}${legend}</figure>`;}
function line(title,xs,series,unit='ms',limit){
 const vals=series.flatMap(s=>s.values);if(!vals.some(finite))return frame(title,'<p class="empty">没有可计算的数据</p>');
 const w=560,h=310,left=60,right=30,top=25,bottom=55,max=ceiling(vals,limit),pw=w-left-right,ph=h-top-bottom;
 const x=i=>left+(xs.length===1?pw/2:i*pw/(xs.length-1)),y=v=>top+ph*(1-v/max);
 let body=`<text x="${left}" y="15">${esc(unit)}</text>`;
 for(let i=0;i<=4;i++){const v=max*i/4,py=y(v);body+=`<line x1="${left}" y1="${py}" x2="${w-right}" y2="${py}" class="gridline"/><text x="${left-10}" y="${py+4}" text-anchor="end">${esc(unit==='ms'?v.toFixed(0):v.toFixed(1))}</text>`;}
 xs.forEach((n,i)=>body+=`<text x="${x(i)}" y="${h-30}" text-anchor="middle">${esc(n)}</text>`);
 body+=`<text x="${left+pw/2}" y="${h-7}" text-anchor="middle">项目数</text>`;
 series.forEach((s,j)=>{let path='',connected=false;const color=colors[j%colors.length];s.values.forEach((v,i)=>{if(!finite(v)){connected=false;return;}path+=(connected?'L':'M')+x(i)+' '+y(v)+' ';connected=true;});body+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5"/>`;s.values.forEach((v,i)=>{if(!finite(v))return;body+=`<circle cx="${x(i)}" cy="${y(v)}" r="5" fill="${color}" stroke="white" stroke-width="2"><title>${esc(s.name)} · ${xs[i]}项：${value(v,unit)}</title></circle>`;});});
 const legend=`<div class="chart-legend">${series.map((s,i)=>`<span><i style="background:${colors[i%3]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
 return frame(title,`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><desc>${esc(series.map(s=>s.name+': '+xs.map((n,i)=>n+'项 '+value(s.values[i],unit)).join('，')).join('；'))}</desc>${body}</svg>`,legend);
}
function bars(title,items,unit,limit){
 if(!items.some(t=>finite(t.value)))return frame(title,'<p class="empty">没有可计算的数据</p>');
 const w=560,h=100+items.length*64,left=135,right=85,top=28,max=ceiling(items.map(i=>i.value),limit),pw=w-left-right;
 let body='';for(let i=0;i<=4;i++){const px=left+pw*i/4;body+=`<line x1="${px}" y1="${top-8}" x2="${px}" y2="${h-45}" class="gridline"/><text x="${px}" y="${h-23}" text-anchor="middle">${(max*i/4).toFixed(unit==='ms'?0:1)}</text>`;}
 items.forEach((a,i)=>{const y=top+i*64,available=finite(a.value),bw=available?pw*a.value/max:0;body+=`<text x="${left-12}" y="${y+24}" text-anchor="end">${esc(a.name)}</text>${available?`<rect x="${left}" y="${y+4}" width="${bw}" height="30" rx="4" fill="${colors[i%3]}"><title>${esc(a.name)}：${value(a.value,unit)}；可用人数 ${a.n??1}</title></rect>`:''}<text x="${left+bw+9}" y="${y+24}" class="chart-value">${available?esc(value(a.value,unit)):'—'}</text>`;});
 return frame(title,`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><desc>${esc(items.map(a=>a.name+' '+value(a.value,unit)).join('；'))}</desc>${body}</svg>`);
}
root.AttentionCharts={line,bars};
})(typeof window!=='undefined'?window:globalThis);
