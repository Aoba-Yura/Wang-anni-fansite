/* 豆城光辉游乐园 v1.10.0：球链移动、插入、消除与回缩 */
(() => {
  'use strict';
  const C=window.DC.cfg,G=window.DC.geo;
  class ChainSystem{
    constructor(game){ this.game=game; }
    get s(){ return this.game.state; }
    randNormalBall(level){ return {type:'normal',color:Math.floor(Math.random()*level.colors)}; }
    sameNormal(a,b){ return !!(a&&b&&a.type==='normal'&&b.type==='normal'&&a.color===b.color); }
    liveColors(){ return [...new Set(this.s.balls.filter(b=>b.type==='normal').map(b=>b.color))]; }
    visualS(ball){
      const s=this.s;
      if(s.insertAnim){ const sh=s.insertAnim.shiftMap.get(ball); if(sh){ const t=G.easeOutCubic(Math.min(1,s.insertAnim.t/s.insertAnim.duration)); return sh.from+(sh.to-sh.from)*t; } }
      if(s.retractAnim){ const r=s.retractAnim,sh=r.shiftMap.get(ball); if(sh){ const raw=r.duration>0?(r.t-r.delayIn)/r.duration:1,t=G.easeInOut(Math.max(0,Math.min(1,raw))); return sh.from+(sh.to-sh.from)*t; } }
      return ball.s;
    }
    advance(dt){
      const s=this.s,motionStart=new Map(s.balls.map(b=>[b,b.s]));
      for(const b of s.balls) b.s+=s.level.speed*dt;
      if(!s.spawnClosed){
        s.spawnCd-=dt; let minS=Infinity; for(const b of s.balls) if(b.s<minS) minS=b.s;
        if(s.spawnCd<=0&&minS>C.BALL_SPACING*1.02){
          const spawned=Object.assign(this.randNormalBall(s.level),{s:0}); s.balls.push(spawned); motionStart.set(spawned,0);
          s.balls.sort((a,b)=>a.s-b.s); s.generated++; s.spawnCd=.04;
        }
      }
      return motionStart;
    }
    makeInsertionPlan(proj,targetIdx){
      const s=this.s,target=s.balls[targetIdx],targetVisualS=this.visualS(target);
      const prev=targetIdx>0?s.balls[targetIdx-1]:null,next=targetIdx<s.balls.length-1?s.balls[targetIdx+1]:null;

      // The player aims at a GAP, not at the left/right half of the ball that happens to collide first.
      // Score the two adjacent insertion slots against the actual shot ray.
      const beforeVisualS=prev?(this.visualS(prev)+targetVisualS)*.5:Math.max(0,targetVisualS-C.BALL_SPACING*.72);
      const afterVisualS=next?(targetVisualS+this.visualS(next))*.5:Math.min(s.path.total,targetVisualS+C.BALL_SPACING*.72);
      const origin=this.game.shotOrigin(),vlen=Math.hypot(proj.vx||0,proj.vy||0)||1,ux=(proj.vx||0)/vlen,uy=(proj.vy||0)/vlen;
      const hitAlong=(proj.x-origin.x)*ux+(proj.y-origin.y)*uy;
      const slotScore=(slotS)=>{
        const q=G.pathPoint(s.path,slotS),rx=q.x-origin.x,ry=q.y-origin.y;
        const along=rx*ux+ry*uy,perp=Math.abs(rx*uy-ry*ux);
        return perp+Math.abs(along-hitAlong)*.055+(along<0?1000:0);
      };
      const beforeScore=slotScore(beforeVisualS),afterScore=slotScore(afterVisualS);

      // Near-perfect ties fall back to the old local tangent side, so the result stays deterministic.
      let insertAfter;
      if(Math.abs(beforeScore-afterScore)<2.25){
        const center=G.pathPoint(s.path,targetVisualS),tangent=G.pathTangent(s.path,targetVisualS);
        insertAfter=((proj.x-center.x)*tangent.x+(proj.y-center.y)*tangent.y)>=0;
      }else insertAfter=afterScore<beforeScore;

      const insertIndex=targetIdx+(insertAfter?1:0),targetS=target.s+(insertAfter?C.BALL_SPACING:0);
      const temp=s.balls.map((ball,i)=>({ball,s:ball.s,isNew:false,order:i})),marker={ball:null,s:targetS,isNew:true}; temp.splice(insertIndex,0,marker);
      for(let i=insertIndex+1;i<temp.length;i++) temp[i].s=Math.max(temp[i].s,temp[i-1].s+C.BALL_SPACING);
      const shifts=temp.filter(x=>!x.isNew).map(x=>({ball:x.ball,from:x.ball.s,to:x.s}));
      return {t:0,duration:C.INSERT_DURATION,ball:proj.ball,startX:proj.x,startY:proj.y,targetS:marker.s,insertIndex,shifts,shiftMap:new Map(shifts.map(x=>[x.ball,x])),gapCount:proj.crossedGaps?.size||0};
    }
    beginInsert(proj,targetIdx){ this.s.insertAnim=this.makeInsertionPlan(proj,targetIdx); this.s.projectile=null; }
    updateInsert(dt){
      const s=this.s,a=s.insertAnim; if(!a) return false;
      a.t+=dt; if(a.t<a.duration) return true;
      for(const sh of a.shifts) sh.ball.s=sh.to;
      const newBall={type:a.ball.type,color:a.ball.color,s:a.targetS}; s.balls.push(newBall); s.balls.sort((x,y)=>x.s-y.s);
      const idx=s.balls.indexOf(newBall),hit=G.pathPoint(s.path,newBall.s); s.insertAnim=null; this.game.sound('insert');
      let success=false;
      if(newBall.type==='bomb') success=this.explodeAt(idx)>0; else success=this.resolveMatchAt(idx,1);
      this.game.onShotResolved(success,a.gapCount||0,hit.x,hit.y,a.ball?.type||'normal');
      return true;
    }
    resolveMatchAt(idx,mult){
      const s=this.s;if(idx<0||idx>=s.balls.length)return false; const b=s.balls[idx];if(b.type!=='normal')return false;
      let lo=idx,hi=idx;while(lo>0&&this.sameNormal(s.balls[lo-1],b))lo--;while(hi<s.balls.length-1&&this.sameNormal(s.balls[hi+1],b))hi++;
      const count=hi-lo+1;if(count>=3){this.removeRange(lo,count,mult,false);return true;}return false;
    }
    explodeAt(idx){
      const s=this.s,bomb=s.balls[idx];if(!bomb)return 0;const center=G.pathPoint(s.path,bomb.s),reach=C.BOMB_RADIUS+C.BALL_R,reach2=reach*reach;
      const hits=s.balls.filter(ball=>{if(ball!==bomb&&this.game.isOccludedS(ball.s))return false;const p=G.pathPoint(s.path,ball.s),dx=p.x-center.x,dy=p.y-center.y;return dx*dx+dy*dy<=reach2;});
      s.effects.push({kind:'blast',x:center.x,y:center.y,t:0,duration:.24,radius:C.BOMB_RADIUS});const n=this.removeBallSet(hits,1,true,center);this.game.sound('bomb');return n;
    }
    popEffects(removed){
      const s=this.s,reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce)return;
      for(const b of removed){const p=G.pathPoint(s.path,b.s);s.effects.push({kind:'pop',x:p.x,y:p.y,t:0,duration:.16,color:b.type==='normal'?C.COLORS[b.color]:C.PALETTE.gold});}
    }
    startRetraction(shifts,joinPairs,nextMult){
      const moving=shifts.filter(sh=>Math.abs(sh.from-sh.to)>.1),maxDist=moving.reduce((m,sh)=>Math.max(m,Math.abs(sh.to-sh.from)),0);
      const duration=moving.length?Math.max(C.RETRACT_MIN,Math.min(C.RETRACT_MAX,maxDist/C.RETRACT_SPEED)):0;
      this.s.retractAnim={t:0,delayIn:moving.length?C.RETRACT_PRE:.005,duration,delayOut:C.RETRACT_POST,joinPairs,nextMult,shifts:moving,shiftMap:new Map(moving.map(x=>[x.ball,x]))};
    }
    removeRange(lo,count,mult,isBomb){
      const s=this.s,before=s.balls,removed=before.slice(lo,lo+count);if(!removed.length)return 0;
      const left=lo>0?before[lo-1]:null,right=lo+count<before.length?before[lo+count]:null,centerS=removed.reduce((n,b)=>n+b.s,0)/removed.length;
      this.popEffects(removed);s.balls=before.filter((_,i)=>i<lo||i>=lo+count);if(left&&right)this.game.createGapWindow(left,right);
      this.game.awardRemoval(removed.length,mult,{isBomb,atS:centerS});if(!isBomb)this.game.sound(mult>1?'chain':'pop');
      let shift=0;
      if(lo===0&&s.balls.length&&!s.spawnClosed)shift=Math.min(s.balls[0].s,removed.length*C.BALL_SPACING);
      else if(lo>0&&lo<s.balls.length)shift=Math.max(0,s.balls[lo].s-(s.balls[lo-1].s+C.BALL_SPACING));
      const moving=shift>.1?(lo===0?s.balls:s.balls.slice(lo)):[],joins=left&&right?[{left,right}]:[];
      this.startRetraction(moving.map(ball=>({ball,from:ball.s,to:Math.max(0,ball.s-shift)})),joins,mult+1);return removed.length;
    }
    removeBallSet(hitBalls,mult,isBomb,popupPoint){
      const s=this.s,hitSet=new Set(hitBalls),before=s.balls.slice(),removed=before.filter(b=>hitSet.has(b));if(!removed.length)return 0;
      const gapPairs=[];let i=0;while(i<before.length){if(!hitSet.has(before[i])){i++;continue;}let a=i;while(i+1<before.length&&hitSet.has(before[i+1]))i++;let b=i,left=a>0?before[a-1]:null,right=b+1<before.length?before[b+1]:null;if(left&&right&&!hitSet.has(left)&&!hitSet.has(right))gapPairs.push([left,right]);i++;}
      const infos=before.map((ball,index)=>({ball,index,s:ball.s})).filter(x=>!hitSet.has(x.ball));
      this.popEffects(removed);s.balls=infos.map(x=>x.ball);for(const [left,right] of gapPairs)this.game.createGapWindow(left,right);
      this.game.awardRemoval(removed.length,mult,{isBomb,atXY:popupPoint});if(!isBomb)this.game.sound(mult>1?'chain':'pop');
      if(!infos.length){this.startRetraction([],[],mult+1);return removed.length;}
      let cumulative=0;if(infos[0].index>0&&!s.spawnClosed)cumulative=Math.min(infos[0].s,infos[0].index*C.BALL_SPACING);
      const targets=[],joins=[];let prev=null;
      for(const info of infos){
        let target=Math.max(0,info.s-cumulative);
        if(prev&&info.index>prev.index+1){const desired=prev.target+C.BALL_SPACING,extra=Math.max(0,target-desired);cumulative+=extra;target=Math.max(0,info.s-cumulative);joins.push({left:prev.ball,right:info.ball});}
        const item={...info,target};targets.push(item);prev=item;
      }
      this.startRetraction(targets.map(i=>({ball:i.ball,from:i.s,to:i.target})),joins,mult+1);return removed.length;
    }
    resolvePendingJoin(){
      const s=this.s;while(s.pendingJoins.length){const p=s.pendingJoins.shift(),li=s.balls.indexOf(p.left),ri=s.balls.indexOf(p.right);if(li<0||ri!==li+1||!this.sameNormal(p.left,p.right))continue;let a=li,b=ri;while(a>0&&this.sameNormal(s.balls[a-1],p.left))a--;while(b<s.balls.length-1&&this.sameNormal(s.balls[b+1],p.left))b++;if(b-a+1>=3){this.removeRange(a,b-a+1,p.mult,false);return true;}}return false;
    }
    finishRetraction(pairs,nextMult){const s=this.s;for(const p of pairs)s.pendingJoins.push({left:p.left,right:p.right,mult:nextMult});this.resolvePendingJoin();}
    updateRetraction(dt){
      const s=this.s,r=s.retractAnim;if(!r)return false;r.t+=dt;const total=r.delayIn+r.duration+r.delayOut;if(r.t<total)return true;
      for(const sh of r.shifts)sh.ball.s=sh.to;const pairs=r.joinPairs,m=r.nextMult;s.retractAnim=null;this.finishRetraction(pairs,m);return true;
    }
  }
  window.DC.ChainSystem=ChainSystem;
})();
