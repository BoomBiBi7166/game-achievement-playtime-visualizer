window.SteamCityBuilding = { renderCity };

function renderCity(state, $, percent, escapeHTML) {
  const grid = $('#cityGrid');
  // Ground-level points omit height; defaulting it to zero keeps every SVG face finite.
  const rotateWorld = (x,z) => {
    const angle=state.rotation*Math.PI/180;
    return {x:x*Math.cos(angle)-z*Math.sin(angle),z:x*Math.sin(angle)+z*Math.cos(angle)};
  };
  const project = (x,z,y=0,originX=380,originY=250) => {
    const p=rotateWorld(x,z);
    return [originX+(p.x-p.z)*.62,originY-(p.x+p.z)*.31-y];
  };
  const point = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const polygon = (points, fill, extra='') => `<polygon points="${points.map(point).join(' ')}" fill="${fill}" ${extra}/>`;
  const solidFace = (points, fill) => `<polygon points="${points.map(point).join(' ')}" style="fill:${fill};fill-opacity:1;opacity:1" stroke="#0a1115" stroke-width="1"/>`;
  const blend = (source,target,amount) => {
    const rgb = color => color.match(/[\da-f]{2}/gi).map(part=>parseInt(part,16));
    const a=rgb(source),b=rgb(target);
    return `#${a.map((channel,index)=>Math.round(channel*(1-amount)+b[index]*amount).toString(16).padStart(2,'0')).join('')}`;
  };
  const citySlots = state.cityGames || state.games.slice(0, 9);
  const cityGames = citySlots.filter(Boolean);
  const maxHours = Math.max(1,...cityGames.map(game => game.hours));
  let svg = `<defs>
    <linearGradient id="tileTop" x2="0" y2="1"><stop stop-color="#28433f"/><stop offset="1" stop-color="#172c2d"/></linearGradient>
    <linearGradient id="glass" x2="0" y2="1"><stop stop-color="#d5f7db"/><stop offset="1" stop-color="#75c6a1"/></linearGradient>
    <linearGradient id="districtFloor" x2="0" y2="1"><stop stop-color="#303936"/><stop offset="1" stop-color="#202927"/></linearGradient>
    <linearGradient id="grass" x2="0" y2="1"><stop stop-color="#5a805e"/><stop offset="1" stop-color="#355342"/></linearGradient>
    <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>`;
  const coords = (index) => ({ x: (index%3-1)*120, z: (Math.floor(index/3)-1)*120 });
  // A darker plaza rotates with the city, set inside the larger asphalt street scene.
  const districtCorners=[[-320,-320],[320,-320],[320,320],[-320,320]].map(([x,z])=>project(x,z));
  const districtLower=[[-320,-320],[320,-320],[320,320],[-320,320]].map(([x,z])=>project(x,z,-7));
  for(let edge=0;edge<districtCorners.length;edge++){
    const next=(edge+1)%districtCorners.length;
    svg+=polygon([districtCorners[edge],districtCorners[next],districtLower[next],districtLower[edge]],'#1a2220','stroke="#111816" stroke-width="1"');
  }
  svg+=polygon(districtCorners,'url(#districtFloor)','stroke="#65716b" stroke-opacity=".6" stroke-width="1.5"');
  const streetRing=[[-220,-220],[220,-220],[220,220],[-220,220]].map(([x,z])=>project(x,z,-.5));
  const ringPath=`M ${point(streetRing[0])} L ${point(streetRing[1])} L ${point(streetRing[2])} L ${point(streetRing[3])} Z`;
  svg+=`<path d="${ringPath}" fill="none" stroke="#101715" stroke-opacity=".55" stroke-width="31" stroke-linejoin="round"/><path d="${ringPath}" fill="none" stroke="#646e67" stroke-width="26" stroke-linejoin="round"/><path d="${ringPath}" fill="none" stroke="#292f2d" stroke-width="21" stroke-linejoin="round"/><path d="${ringPath}" fill="none" stroke="#d1c48f" stroke-opacity=".58" stroke-width="1.4" stroke-dasharray="8 11" stroke-linejoin="round"/>`;
  const grassPatch=(x,z,rx=25,rz=18)=>{
    const patch=[[-rx,0],[0,-rz],[rx,0],[0,rz]].map(([dx,dz])=>project(x+dx,z+dz,1));
    return `<g>${polygon(patch,'url(#grass)','stroke="#9bb487" stroke-opacity=".35" stroke-width=".8"')}<path d="M ${point(project(x-rx*.6,z))} l 4 -7 m 3 9 l 5 -8 m 3 7 l 4 -6" fill="none" stroke="#b4ca8c" stroke-opacity=".7" stroke-width="1.3" stroke-linecap="round"/></g>`;
  };
  const bush=(x,z)=>{
    const p=project(x,z,0);
    return `<g><ellipse cx="${p[0]}" cy="${p[1]+2}" rx="12" ry="4" fill="#101a16" opacity=".55"/><ellipse cx="${p[0]-6}" cy="${p[1]-5}" rx="7" ry="6" fill="#47764f"/><ellipse cx="${p[0]+1}" cy="${p[1]-8}" rx="8" ry="7" fill="#5b8b58"/><ellipse cx="${p[0]+7}" cy="${p[1]-4}" rx="6" ry="5" fill="#3d6948"/><circle cx="${p[0]-2}" cy="${p[1]-10}" r="2" fill="#8caf69" opacity=".75"/></g>`;
  };
  const bench=(x,z)=>{
    const a=project(x-12,z-3,3),b=project(x+12,z-3,3),c=project(x+12,z+3,3),d=project(x-12,z+3,3);
    const leg1=project(x-8,z,0),leg2=project(x+8,z,0);
    return `<g stroke-linejoin="round"><path d="M ${point(leg1)} l 0 -8 M ${point(leg2)} l 0 -8" stroke="#252d2a" stroke-width="2.5"/><path d="M ${point(a)} L ${point(b)} L ${point(c)} L ${point(d)} Z" fill="#8a6849" stroke="#443a2e" stroke-width="1"/><path d="M ${point(project(x-12,z-3,7))} L ${point(project(x+12,z-3,7))} L ${point(project(x+12,z+1,7))} L ${point(project(x-12,z+1,7))} Z" fill="#a17b54" stroke="#554432" stroke-width="1"/><path d="M ${point(project(x-9,z-2,8))} L ${point(project(x+9,z-2,8))}" stroke="#d0a36e" stroke-opacity=".65" stroke-width=".8"/></g>`;
  };
  const lantern=(x,z)=>{
    const p=project(x,z,0),top=project(x,z,24);
    return `<g><ellipse cx="${p[0]}" cy="${p[1]+2}" rx="7" ry="3" fill="#101714" opacity=".5"/><path d="M ${point(p)} L ${point(top)}" stroke="#343d38" stroke-width="3"/><path d="M ${point(top)} l -5 -4 5 -5 5 5z" fill="#29342e" stroke="#71816b" stroke-width=".9"/><circle cx="${top[0]}" cy="${top[1]-4}" r="2.2" fill="#ffdf91"/><circle cx="${top[0]}" cy="${top[1]-4}" r="7" fill="#ffdf91" opacity=".11"/></g>`;
  };
  const tree=(x,z)=>{
    const p=project(x,z,0);
    return `<g><ellipse cx="${p[0]}" cy="${p[1]+3}" rx="13" ry="5" fill="#101714" opacity=".45"/><path d="M ${p[0]} ${p[1]} v -22" stroke="#594b37" stroke-width="5"/><circle cx="${p[0]-6}" cy="${p[1]-25}" r="10" fill="#3d704b"/><circle cx="${p[0]+5}" cy="${p[1]-29}" r="11" fill="#568756"/><circle cx="${p[0]}" cy="${p[1]-36}" r="9" fill="#6b995e"/><circle cx="${p[0]-4}" cy="${p[1]-39}" r="3" fill="#a5bd77" opacity=".7"/></g>`;
  };
  const flowerbed=(x,z)=>{
    const p=project(x,z,0),bed=[[-18,0],[0,-9],[18,0],[0,9]].map(([dx,dz])=>project(x+dx,z+dz,1));
    return `<g>${polygon(bed,'#42634b','stroke="#8ca47a" stroke-opacity=".6" stroke-width=".8"')}<circle cx="${p[0]-8}" cy="${p[1]-3}" r="2.2" fill="#e8a7a1"/><circle cx="${p[0]}" cy="${p[1]-6}" r="2.2" fill="#f0d18c"/><circle cx="${p[0]+8}" cy="${p[1]-3}" r="2.2" fill="#d7a9df"/><path d="M ${p[0]-8} ${p[1]-1} v -3 M ${p[0]} ${p[1]-3} v -3 M ${p[0]+8} ${p[1]-1} v -3" stroke="#b3ce8f" stroke-width="1"/></g>`;
  };
  // Green pockets and street furniture ring the district while leaving the building plots clear.
  svg+=grassPatch(-250,-170,30,22)+grassPatch(250,-170,30,22)+grassPatch(-250,170,30,22)+grassPatch(250,170,30,22);
  svg+=grassPatch(-265,0,19,34)+grassPatch(265,0,19,34)+grassPatch(0,-270,32,20)+grassPatch(0,270,32,20);
  svg+=bush(-252,-164)+bush(252,-164)+bush(-252,164)+bush(252,164)+bush(-260,18)+bush(260,-18);
  svg+=bench(-255,-52)+bench(255,52)+bench(-65,270)+bench(65,-270);
  svg+=lantern(-265,-95)+lantern(265,95)+lantern(-95,265)+lantern(95,-265);
  svg+=tree(-270,160)+tree(270,-160)+tree(-160,-270)+tree(160,270);
  svg+=flowerbed(-260,80)+flowerbed(260,-80)+flowerbed(-80,-265)+flowerbed(80,265);
  citySlots.forEach((game,index) => { if(game)Object.assign(game,coords(index),{citySlot:index}); });
  const depth = game => { const p=rotateWorld(game.x,game.z); return p.x+p.z; };
  const ordered = [...cityGames].sort((a,b) => depth(b)-depth(a));
  // Lay down every parcel so removed buildings leave an obvious add-game tile.
  citySlots.forEach((game,index) => {
    const {x,z}=coords(index), w=47, d=47;
    const corners=[project(x-w,z-d),project(x+w,z-d),project(x+w,z+d),project(x-w,z+d)];
    if(game){
      svg += `<g class="city-lot">${polygon(corners,'url(#tileTop)','stroke="#426158" stroke-width="1"')}<path d="M ${point(corners[0])} L ${point(corners[1])} L ${point(corners[2])} L ${point(corners[3])} Z" fill="none" stroke="#8ab9a329" stroke-width=".7"/>`;
      svg += `<path d="M ${point(project(x-32,z))} L ${point(project(x,z-32))} L ${point(project(x+32,z))} L ${point(project(x,z+32))} Z" fill="#8ec1a00b"/></g>`;
    }else{
      const center=project(x,z);
      svg += `<g class="empty-city-slot" tabindex="0" role="button" aria-label="Add a game building" data-slot="${index}">${polygon(corners,'#172126','stroke="#52665f" stroke-width="1.4" stroke-dasharray="5 4')}<circle cx="${center[0]}" cy="${center[1]}" r="18" fill="#253633" stroke="#8ce0bd" stroke-opacity=".75" stroke-width="1.5"/><path d="M ${center[0]-9} ${center[1]} H ${center[0]+9} M ${center[0]} ${center[1]-9} V ${center[1]+9}" fill="none" stroke="#a5edce" stroke-width="3" stroke-linecap="round"/></g>`;
    }
  });
  for (const game of ordered) {
    const {x,z}=game, w=25, d=25;
    const skin=['classic','burj-khalifa','mahanakhon','pisa'].includes(game.skin)?game.skin:'classic';
    const score=state.mode==='achievements'?percent(game):Math.round(game.hours/maxHours*100);
    const height=46+score*1.18;
    const towerProject=(px,pz,y=0)=>project(px,pz,y);
    const base=[[x-w,z-d],[x+w,z-d],[x+w,z+d],[x-w,z+d]].map(([px,pz])=>project(px,pz));
    const top=[[x-w,z-d],[x+w,z-d],[x+w,z+d],[x-w,z+d]].map(([px,pz])=>towerProject(px,pz,height));
    const [a,b,c,d0]=top, [ab,bb,cb,db]=base;
    const roofColor=blend(game.tone,'#f4e9c1',.27);
    const floors=Math.max(3,Math.round(height/16));
    svg+=`<g class="iso-building" tabindex="0" role="button" aria-label="Edit ${escapeHTML(game.name)} building" data-game="${escapeHTML(game.id)}" data-slot="${game.citySlot}"><title>Edit ${escapeHTML(game.name)} building</title>`;
    const center=project(x,z,0);
    svg+=`<ellipse cx="${center[0]}" cy="${center[1]+4}" rx="38" ry="10" fill="#000" opacity=".35" filter="url(#softShadow)"/>`;
    if(skin==='pisa'){
      const storyCount=Math.max(4,Math.min(10,Math.round(height/17)));
      const storyHeight=height/storyCount;
      const stone=blend(game.tone,'#d8ccb0',.35);
      for(let story=0;story<storyCount;story++){
        const y0=story*storyHeight,y1=(story+1)*storyHeight;
        const radius=story===storyCount-1?w*.78:w*(1-story*.012);
        const corners=Array.from({length:8},(_,index)=>{
          const angle=Math.PI/8+index*Math.PI/4;
          return [x+Math.cos(angle)*radius,z+Math.sin(angle)*radius];
        });
        const faces=corners.map((from,index)=>{
          const to=corners[(index+1)%corners.length],middle=rotateWorld((from[0]+to[0])/2,(from[1]+to[1])/2),angle=Math.PI/8+(index+.5)*Math.PI/4,normal=rotateWorld(Math.cos(angle),Math.sin(angle));
          return {index,from,to,depth:middle.x+middle.z,light:normal.x+normal.z};
        }).sort((first,second)=>second.depth-first.depth);
        for(const face of faces){
          const [fx,fz]=face.from,[tx,tz]=face.to;
          const faceLength=Math.hypot(tx-fx,tz-fz),ux=(tx-fx)/faceLength,uz=(tz-fz)/faceLength;
          const wallShade=face.light>0?.1:.29,wall=blend(stone,'#555346',wallShade);
          svg+=solidFace([towerProject(fx,fz,y1),towerProject(tx,tz,y1),towerProject(tx,tz,y0),towerProject(fx,fz,y0)],wall);
          const half=faceLength*.23,midX=(fx+tx)/2,midZ=(fz+tz)/2;
          const leftBase=towerProject(midX-ux*half,midZ-uz*half,y0+storyHeight*.23);
          const leftSpring=towerProject(midX-ux*half,midZ-uz*half,y0+storyHeight*.64);
          const archTop=towerProject(midX,midZ,y0+storyHeight*.91);
          const rightSpring=towerProject(midX+ux*half,midZ+uz*half,y0+storyHeight*.64);
          const rightBase=towerProject(midX+ux*half,midZ+uz*half,y0+storyHeight*.23);
          const archPath=`M ${point(leftBase)} L ${point(leftSpring)} Q ${archTop[0]} ${archTop[1]} ${point(rightSpring)} L ${point(rightBase)} Z`;
          svg+=`<path d="${archPath}" fill="#17201e" stroke="#b8a984" stroke-width=".8"/><path d="M ${point(leftSpring)} Q ${archTop[0]} ${archTop[1]} ${point(rightSpring)}" fill="none" stroke="#e6d8b8" stroke-opacity=".85" stroke-width="1"/>`;
          const columnTone=blend(stone,'#f3e8d0',.3);
          svg+=`<path d="M ${point(towerProject(fx,fz,y0+2))} L ${point(towerProject(fx,fz,y1-2))} M ${point(towerProject(tx,tz,y0+2))} L ${point(towerProject(tx,tz,y1-2))}" fill="none" stroke="${columnTone}" stroke-opacity=".7" stroke-width="1.1"/>`;
          if(story===storyCount-1){
            const bell=towerProject(midX,midZ,y0+storyHeight*.45);
            svg+=`<circle cx="${bell[0]}" cy="${bell[1]}" r="1.2" fill="#e9d9ad"/>`;
          }
        }
        const gallery=corners.map(([px,pz])=>towerProject(px,pz,y1));
        svg+=polygon(gallery,blend(stone,'#fff1d1',.17),'stroke="#f0e4c4" stroke-opacity=".8" stroke-width=".8"');
      }
    }else if(skin==='burj-khalifa'){
      // Fewer, broader tiers on short buildings; more setbacks as the stats make them taller.
      const tierCount=Math.max(2,Math.min(6,Math.floor(height/25)));
      for(let tier=0;tier<tierCount;tier++){
        const y0=height*tier/tierCount,y1=height*(tier+1)/tierCount;
        const tierWidth=Math.max(4,w*Math.pow(.75,tier));
        const faces=[
          {normal:[0,-1],from:[x-tierWidth,z-tierWidth],to:[x+tierWidth,z-tierWidth]},
          {normal:[1,0],from:[x+tierWidth,z-tierWidth],to:[x+tierWidth,z+tierWidth]},
          {normal:[0,1],from:[x+tierWidth,z+tierWidth],to:[x-tierWidth,z+tierWidth]},
          {normal:[-1,0],from:[x-tierWidth,z+tierWidth],to:[x-tierWidth,z-tierWidth]}
        ].map(face=>{
          const p=rotateWorld((face.from[0]+face.to[0])/2,(face.from[1]+face.to[1])/2),n=rotateWorld(...face.normal);
          return {...face,depth:p.x+p.z,light:n.x+n.z};
        }).sort((first,second)=>second.depth-first.depth);
        for(const face of faces){
          const [fx,fz]=face.from,[tx,tz]=face.to;
          const shade=face.light>0?.2:.58;
          svg+=solidFace([project(fx,fz,y1),project(tx,tz,y1),project(tx,tz,y0),project(fx,fz,y0)],blend(game.tone,'#182326',shade));
          const length=Math.hypot(tx-fx,tz-fz),ux=(tx-fx)/length,uz=(tz-fz)/length,winY=(y0+y1)/2;
          for(const t of [.3,.7]){
            const wx=fx+(tx-fx)*t,wz=fz+(tz-fz)*t,half=Math.min(3,tierWidth*.22);
            const win=[project(wx-ux*half,wz-uz*half,winY+4),project(wx+ux*half,wz+uz*half,winY+4),project(wx+ux*half,wz+uz*half,winY-4),project(wx-ux*half,wz-uz*half,winY-4)];
            svg+=polygon(win,'url(#glass)',`opacity="${score>50?.88:.48}"`);
          }
        }
        const ledge=[[x-tierWidth,z-tierWidth],[x+tierWidth,z-tierWidth],[x+tierWidth,z+tierWidth],[x-tierWidth,z+tierWidth]].map(([px,pz])=>project(px,pz,y1));
        svg+=polygon(ledge,blend(game.tone,'#f4e9c1',.27),'stroke="#e8e6cf" stroke-opacity=".55" stroke-width=".8"');
      }
    }else{
    // Every side gets a solid wall, story lines, and windows. Sort the faces using
    // the rotated camera depth so a full pair remains visible from every angle.
    const wallFaces=[
      {index:0,normal:[0,-1],from:[x-w,z-d],to:[x+w,z-d]},
      {index:1,normal:[1,0],from:[x+w,z-d],to:[x+w,z+d]},
      {index:2,normal:[0,1],from:[x+w,z+d],to:[x-w,z+d]},
      {index:3,normal:[-1,0],from:[x-w,z+d],to:[x-w,z-d]}
    ].map(face=>{
      const center=rotateWorld((face.from[0]+face.to[0])/2,(face.from[1]+face.to[1])/2);
      const normal=rotateWorld(face.normal[0],face.normal[1]);
      return {...face,depth:center.x+center.z,light:normal.x+normal.z};
    }).sort((first,second)=>second.depth-first.depth);
    for(const face of wallFaces){
      const [fx,fz]=face.from,[tx,tz]=face.to;
      const length=Math.hypot(tx-fx,tz-fz),ux=(tx-fx)/length,uz=(tz-fz)/length,[nx,nz]=face.normal;
      const top0=project(fx,fz,height),top1=project(tx,tz,height);
      const bottom0=project(fx,fz),bottom1=project(tx,tz);
      const shade=face.light>0?.2:.58;
      const wallColor=blend(game.tone,'#182326',shade);
      svg+=solidFace([top0,top1,bottom1,bottom0],wallColor);
      for(let floor=1;floor<floors;floor++){
        const rise=height*floor/floors;
        svg+=`<path d="M ${point(project(fx,fz,rise))} L ${point(project(tx,tz,rise))}" fill="none" stroke="#11171b" stroke-opacity=".4" stroke-width="1.2"/>`;
        for(const t of [.28,.66]){
          const wx=fx+(tx-fx)*t,wz=fz+(tz-fz)*t;
          const half=3;
          const windowPoints=[
            project(wx-ux*half,wz-uz*half,rise+10),
            project(wx+ux*half,wz+uz*half,rise+10),
            project(wx+ux*half,wz+uz*half,rise+3),
            project(wx-ux*half,wz-uz*half,rise+3)
          ];
          svg+=polygon(windowPoints,'url(#glass)',`opacity="${score>50?.88:.48}"`);
        }
        if(skin==='mahanakhon'){
          const scratchPath=[.2,.36,.56,.76,.82,.65,.43,.24],t=scratchPath[(floor+face.index*2)%scratchPath.length];
          const wx=fx+(tx-fx)*t,wz=fz+(tz-fz)*t,cutHalf=8.5,depth=1.6;
          const wallPoint=(along,y,offset=depth)=>project(wx+ux*along+nx*offset,wz+uz*along+nz*offset,y);
          const cutBottom=rise+1,cutTop=Math.min(height-1,rise+11);
          const cutout=[wallPoint(-cutHalf,cutTop),wallPoint(cutHalf,cutTop),wallPoint(cutHalf,cutBottom),wallPoint(-cutHalf,cutBottom)];
          // Deep, broad notches create the Mahanakhon's recognizable pixelated scratch.
          svg+=polygon(cutout,'#080e10','stroke="#05090a" stroke-width="1"');
          const highlight=[wallPoint(-cutHalf,cutTop+1),wallPoint(cutHalf*.45,cutTop+1),wallPoint(cutHalf*.45,cutTop+2.8),wallPoint(-cutHalf,cutTop+2.8)];
          svg+=polygon(highlight,blend(game.tone,'#f1f1dd',.62));
          const stepCenter=t+(floor%2?.18:-.18),stepX=fx+(tx-fx)*stepCenter,stepZ=fz+(tz-fz)*stepCenter,stepHalf=4.5;
          const step=[project(stepX-ux*stepHalf+nx*(depth+1),stepZ-uz*stepHalf+nz*(depth+1),Math.min(height-1,cutTop+4)),project(stepX+ux*stepHalf+nx*(depth+1),stepZ+uz*stepHalf+nz*(depth+1),Math.min(height-1,cutTop+4)),project(stepX+ux*stepHalf+nx*(depth+1),stepZ+uz*stepHalf+nz*(depth+1),cutTop),project(stepX-ux*stepHalf+nx*(depth+1),stepZ-uz*stepHalf+nz*(depth+1),cutTop)];
          svg+=polygon(step,blend(game.tone,'#101719',.24),'stroke="#dce7d4" stroke-opacity=".5" stroke-width=".6"');
        }
      }
    }
    }
    if(skin==='pisa'){
      const crown=towerProject(x,z,height),crownTop=towerProject(x,z,height+5);
      svg+=`<ellipse cx="${crown[0]}" cy="${crown[1]}" rx="10" ry="4" fill="#806e51" stroke="#e1d3b3" stroke-width=".8"/><path d="M ${crown[0]-7} ${crown[1]-1} Q ${crownTop[0]} ${crownTop[1]-2} ${crown[0]+7} ${crown[1]-1}" fill="#a28d67" stroke="#e1d3b3" stroke-width=".8"/>`;
    }else if(skin==='burj-khalifa'){
      const spireHeight=Math.max(12,height*.22),shaftBase=[[x-2,z-2],[x+2,z-2],[x+2,z+2],[x-2,z+2]].map(([px,pz])=>project(px,pz,height));
      const shaftTop=[[x-1,z-1],[x+1,z-1],[x+1,z+1],[x-1,z+1]].map(([px,pz])=>project(px,pz,height+spireHeight*.72));
      const tip=project(x,z,height+spireHeight);
      svg+=polygon([shaftBase[0],shaftBase[1],shaftTop[1],shaftTop[0]],blend(game.tone,'#17201e',.4));
      svg+=polygon([shaftBase[1],shaftBase[2],shaftTop[2],shaftTop[1]],blend(game.tone,'#f1e5c4',.22));
      svg+=polygon([shaftTop[0],shaftTop[1],tip],blend(game.tone,'#eee3c3',.2));
      svg+=`<path d="M ${point(tip)} L ${point(project(x,z,height+spireHeight+4))}" stroke="#e7dbbb" stroke-width=".9"/>`;
    }else{
      // Classic keeps its simple roof; Mahanakhon keeps the same core with a pixel-block facade.
      svg+=`<path d="M ${point(a)} L ${point(d0)} L ${point(db)}" fill="none" stroke="#ffffff29" stroke-width="1.3"/>`;
      svg+=polygon([a,b,c,d0],roofColor,'stroke="#e8e6cf" stroke-opacity=".58" stroke-width="1"');
      const roofHeight=Math.min(15,Math.max(7,height*.1));
      const roofTop=[[x-w+5,z-d+5],[x+w-5,z-d+5],[x+w-5,z+d-5],[x-w+5,z+d-5]].map(([px,pz])=>project(px,pz,height+roofHeight));
      const roofBase=[[x-w+5,z-d+5],[x+w-5,z-d+5],[x+w-5,z+d-5],[x-w+5,z+d-5]].map(([px,pz])=>project(px,pz,height));
      svg+=polygon([roofBase[3],roofBase[2],roofTop[2],roofTop[3]],blend(game.tone,'#111719',.58));
      svg+=polygon([roofBase[1],roofBase[2],roofTop[2],roofTop[1]],blend(game.tone,'#182023',.3));
      svg+=polygon(roofTop,blend(game.tone,'#fff1c9',.32),'stroke="#f2e8ca" stroke-opacity=".75" stroke-width=".8"');
      const roofCenter=project(x,z,height+roofHeight);
      svg+=`<rect x="${roofCenter[0]-4}" y="${roofCenter[1]-6}" width="8" height="6" fill="#202a28" stroke="#e6d7a2" stroke-width=".8"/><rect x="${roofCenter[0]-1.5}" y="${roofCenter[1]-4}" width="3" height="4" fill="#c7eed1" opacity=".8"/>`;
    }
    const label=project(x,z,0);
    svg+=`<path d="M ${label[0]-33} ${label[1]+19} l33 -7 33 7 -33 7z" fill="#0e1519" opacity=".86"/><text x="${label[0]}" y="${label[1]+21}" text-anchor="middle" fill="#d8e4da" font-size="8" font-family="DM Sans, sans-serif" font-weight="600">${escapeHTML(game.name)}</text></g>`;
  }
  grid.innerHTML=svg;
}

