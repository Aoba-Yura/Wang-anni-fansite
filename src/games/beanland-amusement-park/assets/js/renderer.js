/* 豆城光辉游乐园 v1.10.0：场景、道路、角色、球链与 HUD 绘制 */
(() => {
  'use strict';
  const C=window.DC.cfg,G=window.DC.geo,A=window.DC.assets;
  const RB_FRAMES={idle0:0,idle1:1,idle2:2,ride0:3,ride1:4,ride2:5,ride3:6,ride4:7,ride5:8,fail0:9,fail1:10,clear0:11,clear1:12,clear2:13};
  class Renderer{
    constructor(game,canvas,assets){
      this.game=game;this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.ctx.imageSmoothingEnabled=false;this.assets=assets;
      this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    buildStaticScene(){
      const c=A.makeCanvas(C.W,C.H),g=c.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
      this.drawGrass(g);
      this.drawScenicFocal(g);
      this.drawRoadLayer(g,0);
      this.drawRoadsideTufts(g);
      this.drawDecor(g);
      this.drawHomePlaza(g);
      this.drawHole(g);
      this.drawSunFlecks(g);
      return c;
    }
    buildUpperRoadLayer(){
      const c=A.makeCanvas(C.W,C.H),g=c.getContext('2d');g.imageSmoothingEnabled=false;
      g.clearRect(0,0,C.W,C.H);
      this.drawUpperContactShadow(g);
      this.drawRoadLayer(g,1);
      // Feather the bridge into the identical ground ribbon beyond the junction.
      // The center stays opaque so lower balls remain covered by the upper road.
      const mask=A.makeCanvas(C.W,C.H),mg=mask.getContext('2d');
      for(const item of this.game.state.crossings.items){
        const p0=G.pathPoint(this.game.state.path,item.upperS-item.renderHalf);
        const p1=G.pathPoint(this.game.state.path,item.upperS+item.renderHalf);
        const ramp=Math.min(.16,9/(item.renderHalf*2));
        const fade=mg.createLinearGradient(p0.x,p0.y,p1.x,p1.y);
        fade.addColorStop(0,'rgba(0,0,0,0)');
        fade.addColorStop(ramp,'rgba(0,0,0,1)');
        fade.addColorStop(1-ramp,'rgba(0,0,0,1)');
        fade.addColorStop(1,'rgba(0,0,0,0)');
        mg.fillStyle=fade;
        mg.fillRect(Math.min(p0.x,p1.x)-45,Math.min(p0.y,p1.y)-45,
                    Math.abs(p1.x-p0.x)+90,Math.abs(p1.y-p0.y)+90);
      }
      if(this.game.state.crossings.items.length){
        g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);
        g.globalCompositeOperation='source-over';
      }
      return c;
    }
    draw(){
      const s=this.game.state;if(!s)return;const g=this.ctx;g.imageSmoothingEnabled=false;
      g.drawImage(s.scene,0,0);

      // Same topological road, different local z-order.
      // Lower/normal balls are physically present first.
      this.drawBalls(false);
      this.drawInsertion(false);

      // Genuine z=+1 road geometry, generated from the same continuous ribbon.
      if(s.upperRoadLayer)g.drawImage(s.upperRoadLayer,0,0);

      // Balls travelling on the z=+1 branch sit above that road.
      this.drawBalls(true);
      this.drawInsertion(true);

      this.drawEffects();
      this.drawLauncher();
      this.drawAim();
      this.drawProjectile();
      this.drawRedbean();
      this.drawPopups();
      this.drawHUD();
      this.drawFullscreenCountdown();
    }
    drawGrass(g){
      for(let y=0;y<C.H;y+=C.TILE)for(let x=0;x<C.W;x+=C.TILE){
        const tx=x/C.TILE,ty=y/C.TILE,h=(tx*19+ty*37+tx*ty*5+this.game.state.levelNo*11)%61;let v=0;
        if(h===0)v=5;else if(h===1)v=4;else if(h<6)v=1+(h%3);
        const im=this.assets.grass[v];if(im.complete&&im.naturalWidth)g.drawImage(im,x,y);else{g.fillStyle=C.PALETTE.grass;g.fillRect(x,y,C.TILE,C.TILE);}
      }
      // Dappled, stepped sunlight and canopy shade: irregular blocks, no smooth gradient rectangles.
      const patch=(x,y,c,a,rows)=>{g.save();g.globalAlpha=a;g.fillStyle=c;for(let i=0;i<rows.length;i++){const [off,w]=rows[i];g.fillRect(x+off,y+i*10,w,10);}g.restore();};
      patch(54,354,C.PALETTE.grassLight,.16,[[28,92],[12,132],[0,150],[18,116],[36,78]]);
      patch(724,360,C.PALETTE.grassLight,.14,[[18,126],[0,162],[10,148],[36,100]]);
      patch(286,382,C.PALETTE.grassLight,.13,[[22,84],[0,118],[14,96]]);
      patch(0,458,C.PALETTE.shadow,.09,[[0,86],[0,112],[0,74],[0,46]]);
      patch(868,446,C.PALETTE.shadow,.09,[[34,58],[18,74],[0,92],[28,64]]);
      const d=this.game.state.levelNo*11;
      patch(160+d,190,C.PALETTE.grassLight,.10,[[0,70],[16,106],[8,120],[24,82]]);
      patch(600-d,420,C.PALETTE.grassDark,.07,[[18,90],[0,128],[12,112],[28,64]]);
    }
    pathDistance(x,y){
      const s=this.game.state;let best=1e9;for(let d=0;d<=s.path.total;d+=20){const p=G.pathPoint(s.path,d),dx=x-p.x,dy=y-p.y,dd=dx*dx+dy*dy;if(dd<best)best=dd;}return Math.sqrt(best);
    }
    safeDecor(x,y,margin=72){
      const s=this.game.state,end=G.pathPoint(s.path,s.path.total),L=C.LAUNCHER;return this.pathDistance(x,y)>margin&&Math.hypot(x-L.x,y-L.y)>100&&Math.hypot(x-end.x,y-end.y)>96;
    }
    // Evaluate an entire sprite footprint; checking its foot alone lets trees cut across a road.
    canPlaceScenery(im,x,y,ax=.5,ay=1){
      if(!im?.complete||!im.naturalWidth)return false;
      const left=x-im.width*ax,top=y-im.height*ay;
      if(left<12||top<66||left+im.width>C.W-12||top+im.height>C.H-8)return false;
      for(const u of [.12,.5,.88])for(const v of [.18,.55,.85])
        if(this.pathDistance(left+im.width*u,top+im.height*v)<34)return false;
      const end=G.pathPoint(this.game.state.path,this.game.state.path.total);
      return Math.hypot(x-end.x,y-end.y)>82;
    }
    drawScenicFocal(g){
      const lvl=this.game.state.levelNo,A=this.assets;
      this.sceneryFootprints=[];
      const place=(im,x,y,ax=.5,ay=1)=>{if(this.canPlaceScenery(im,x,y,ax,ay)){const left=x-im.width*ax,top=y-im.height*ay;g.drawImage(im,Math.round(left),Math.round(top));this.sceneryFootprints.push([left,top,left+im.width,top+im.height]);return true;}return false;};
      const gardenCluster=(x,y,blossom=false)=>{
        const tree=blossom?A.sakura:A.tree,painted=place(tree,x,y);
        place(A.hydrangea,x+58,y+4,.5,1);
        place(A.lantern,x-54,y+6,.5,1);
        if(blossom&&painted){g.fillStyle='#F0A8BC';for(const [dx,dy] of [[-34,-4],[30,4],[46,-18],[-18,9]])g.fillRect(Math.round(x+dx),Math.round(y+dy),2,2);}
      };
      const pondAt=(x,y)=>{if(A.gardenPond?.complete&&this.safeDecor(x,y-58,118))place(A.gardenPond,x,y);};
      if(lvl===1){pondAt(126,526);gardenCluster(790,514,true);}
      else if(lvl===2){gardenCluster(126,520,true);gardenCluster(820,518,false);}
      else if(lvl===3){pondAt(820,526);gardenCluster(112,520,false);}
      else if(lvl===4){gardenCluster(126,520,true);if(A.bench?.complete)place(A.bench,816,515,.5,1);}
      else if(lvl===5){pondAt(132,526);gardenCluster(816,520,false);}
      else if(lvl===6){gardenCluster(128,520,false);gardenCluster(826,520,true);if(A.bunting?.complete&&this.safeDecor(810,398,72))g.drawImage(A.bunting,744,372);}
      else if(lvl===7){gardenCluster(126,520,true);if(A.hydrangea?.complete){place(A.hydrangea,790,512);place(A.hydrangea,844,522);}if(A.bunting?.complete&&this.safeDecor(800,400,72))g.drawImage(A.bunting,736,374);}
      else {pondAt(132,526);gardenCluster(824,522,true);if(A.bunting?.complete&&this.safeDecor(720,400,72))g.drawImage(A.bunting,654,374);}
      // A few level-specific trees restore atmosphere in verified clear areas.
      const extras={2:[[A.tree,890,515]],4:[[A.sakura,105,350],[A.tree,890,515]],
                    5:[[A.sakura,105,505]],6:[[A.sakura,890,350]],8:[[A.tree,850,250]]};
      for(const [im,x,y] of extras[lvl]||[])place(im,x,y);
    }
    drawHomePlaza(g){
      const o=C.LAUNCHER.ballSocket;
      g.save();

      // One compact stepped plinth belongs to the cannon only.
      const bx=Math.round(o.x),by=Math.round(o.y+24);
      g.fillStyle='rgba(52,54,74,.22)';
      g.fillRect(bx-61,by+20,122,9);

      g.fillStyle=C.PALETTE.stoneDark;
      g.fillRect(bx-58,by+11,116,14);

      g.fillStyle=C.PALETTE.stoneMid;
      g.fillRect(bx-50,by+4,100,12);

      g.fillStyle=C.PALETTE.stone;
      g.fillRect(bx-42,by-2,84,10);

      g.fillStyle=C.PALETTE.stoneLight;
      g.fillRect(bx-34,by-4,68,3);

      // Small darker feet visually anchor the cannon; Redbean stands directly on grass.
      g.fillStyle=C.PALETTE.pathDeep;
      g.fillRect(bx-55,by+16,10,8);
      g.fillRect(bx+45,by+16,10,8);

      g.restore();
    }
    drawDecor(g){
      const lvl=this.game.state.levelNo;
      const anchors=[[68,432],[150,386],[250,474],[332,408],[652,420],[744,472],[850,392],[910,462],[76,292],[888,288],[118,170],[286,148],[690,150],[858,158]];
      for(let i=0;i<anchors.length;i++){
        const [x,y]=anchors[i];if(!this.safeDecor(x,y,68))continue;
        if(this.sceneryFootprints?.some(([l,t,r,b])=>x>=l-10&&x<=r+10&&y>=t-12&&y<=b+8))continue;
        const code=(i*7+lvl*13)%13;
        const candidate=[this.assets.sakura,this.assets.tree,this.assets.hydrangea,this.assets.lantern,this.assets.bush,this.assets.bench,this.assets.sign,this.assets.stump,this.assets.fence][code];
        if(candidate&&!this.canPlaceScenery(candidate,x,y))continue;
        if(code===0&&this.assets.sakura?.complete){g.drawImage(this.assets.sakura,Math.round(x-48),Math.round(y-104));continue;}
        if(code===1&&this.assets.tree?.complete){g.drawImage(this.assets.tree,Math.round(x-48),Math.round(y-104));continue;}
        if(code===2&&this.assets.hydrangea?.complete){g.drawImage(this.assets.hydrangea,Math.round(x-24),Math.round(y-38));continue;}
        if(code===3&&this.assets.lantern?.complete){g.drawImage(this.assets.lantern,Math.round(x-20),Math.round(y-52));continue;}
        if(code===4&&this.assets.bush?.complete){g.drawImage(this.assets.bush,Math.round(x-28),Math.round(y-44));continue;}
        if(code===5&&this.assets.bench?.complete&&y>330){g.drawImage(this.assets.bench,Math.round(x-36),Math.round(y-32));continue;}
        if(code===6&&this.assets.sign?.complete&&x<190){g.drawImage(this.assets.sign,Math.round(x-26),Math.round(y-50));continue;}
        if(code===7&&this.assets.stump?.complete){g.drawImage(this.assets.stump,Math.round(x-18),Math.round(y-31));continue;}
        if(code===8&&this.assets.fence?.complete&&y>300){g.drawImage(this.assets.fence,Math.round(x-18),Math.round(y-32));continue;}
        const f=this.assets.flowers[(i+lvl)%this.assets.flowers.length],r=this.assets.rocks[(i+2*lvl)%this.assets.rocks.length];
        if(this.canPlaceScenery(f,x-18+f.width/2,y-28+f.height))g.drawImage(f,Math.round(x-18),Math.round(y-28));
        if(this.canPlaceScenery(r,x+14+r.width/2,y-16+r.height))g.drawImage(r,Math.round(x+14),Math.round(y-16));
        if(i%2===0&&this.canPlaceScenery(this.assets.clover,x-36+this.assets.clover.width/2,y-12+this.assets.clover.height))g.drawImage(this.assets.clover,Math.round(x-36),Math.round(y-12));
      }
      const small=[[34,500],[205,510],[607,502],[925,492],[38,350],[928,332]];
      for(const [x,y] of small)if(this.safeDecor(x,y,48)&&this.assets.tuft.complete)g.drawImage(this.assets.tuft,x-16,y-16);
      if(lvl>=7&&this.assets.leaf?.complete){for(const [x,y] of [[265,486],[710,384],[892,438],[126,414]])if(this.safeDecor(x,y,44))g.drawImage(this.assets.leaf,x-8,y-8);}
    }
    tracePolygon(g,pts){
      if(!pts?.length)return;
      g.beginPath();g.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);
      g.closePath();
    }
    fillQuad(g,pts,color,alpha=1){
      g.save();g.globalAlpha=alpha;g.fillStyle=color;this.tracePolygon(g,pts);g.fill();g.restore();
    }
    roadSegmentsForLayer(layer){
      const st=this.game.state,all=st.road.segments(4);
      // The ground path stays one continuous object even where the bridge crosses it.
      return layer===0?all:all.filter(seg=>st.crossings.layerAt(seg.mid)===layer);
    }
    roadRuns(segs){
      const runs=[];let run=[];
      for(const seg of segs){
        if(run.length&&seg.s0-run.at(-1).s1>.01){runs.push(run);run=[];}
        run.push(seg);
      }
      if(run.length)runs.push(run);
      return runs;
    }
    fillRoadStrip(g,segs,outer,inner,color,alpha=1,side=0,dx=0,dy=0){
      // Each band is a single filled polygon. Adjacent quads would leave hairline seams
      // on diagonal turns because their antialiased edges are composited separately.
      for(const run of this.roadRuns(segs)){
        const point=(seg,which,width,sign)=>{
          const p=which?seg.p1:seg.p0,n=which?seg.n1:seg.n0;
          return{x:p.x+n.x*width*sign+dx,y:p.y+n.y*width*sign+dy};
        };
        const trace=(width,sign)=>{
          for(const seg of run){const p=point(seg,false,width,sign);g.lineTo(p.x,p.y);}
          const p=point(run.at(-1),true,width,sign);g.lineTo(p.x,p.y);
        };
        g.save();g.globalAlpha=alpha;g.fillStyle=color;g.beginPath();
        const begin=point(run[0],false,outer,side||1);g.moveTo(begin.x,begin.y);
        trace(outer,side||1);
        if(side){
          const q=point(run.at(-1),true,inner,side);g.lineTo(q.x,q.y);
          for(let i=run.length-1;i>=0;i--){const p=point(run[i],false,inner,side);g.lineTo(p.x,p.y);}
        }else{
          const q=point(run.at(-1),true,outer,-1);g.lineTo(q.x,q.y);
          for(let i=run.length-1;i>=0;i--){const p=point(run[i],false,outer,-1);g.lineTo(p.x,p.y);}
        }
        g.closePath();g.fill();g.restore();
      }
    }
    drawRoadQuadPass(g,segs,halfWidth,color,alpha=1,dx=0,dy=0){
      this.fillRoadStrip(g,segs,halfWidth,0,color,alpha,0,dx,dy);
    }
    drawRoadSideBandPass(g,segs,outerHalf,innerHalf,color,alpha=1){
      this.fillRoadStrip(g,segs,outerHalf,innerHalf,color,alpha,1);
      this.fillRoadStrip(g,segs,outerHalf,innerHalf,color,alpha,-1);
    }
    drawRoadTextureLayer(g,layer){
      const st=this.game.state,cs=st.crossings;
      if(!this.assets.cobbles?.length)return;
      let k=0;
      for(let d=44;d<st.path.total-44;){
        if(layer===0||cs.layerAt(d)===layer){
          const p=st.path.pointAt(d),ang=st.path.angleAt(d),im=this.assets.cobbles[k%this.assets.cobbles.length];
          if(im?.complete&&im.naturalWidth){
            g.save();
            g.translate(Math.round(p.x),Math.round(p.y+2));
            g.rotate(ang+(k%3-1)*.025);
            g.globalAlpha=.11+(k%2)*.05;
            g.drawImage(im,-14,-10);
            g.restore();
          }
        }
        d+=78+((k*19+st.levelNo*17)%37);k++;
      }
      g.globalAlpha=1;
    }
    drawRoadLayer(g,layer){
      const segs=this.roadSegmentsForLayer(layer);
      if(!segs.length)return;

      // All road edge colours are FILLED GEOMETRIC BANDS.
      // No boundary stroke, no line cap, no crossing patch.
      this.drawRoadSideBandPass(g,segs,28,25,C.PALETTE.shadow,.15);
      this.drawRoadQuadPass(g,segs,25,C.PALETTE.pathDeep,1);
      this.drawRoadQuadPass(g,segs,23,C.PALETTE.soil,1);
      this.drawRoadQuadPass(g,segs,20,C.PALETTE.path,1);
      this.drawRoadQuadPass(g,segs,16,'#DEC28B',1);

      // Thin continuous highlight bands are also geometry, not stroked lines.
      this.drawRoadSideBandPass(g,segs,20,19,C.PALETTE.pathHi,.34);

      this.drawRoadTextureLayer(g,layer);
    }
    drawUpperContactShadow(g){
      const st=this.game.state;
      if(!st.crossings?.items?.length)return;

      // A displaced dark silhouette gives the upper road a visible underside.
      // Fade the ends into the ground road rather than exposing square caps.
      const segs=this.roadSegmentsForLayer(1),road=st.road;
      for(const seg of segs){
        const c=st.crossings.items.reduce((best,item)=>Math.abs(seg.mid-item.upperS)<Math.abs(seg.mid-best.upperS)?item:best);
        const fade=Math.max(0,Math.min(1,(c.renderHalf-Math.abs(seg.mid-c.upperS))/12));
        if(!fade)continue;
        this.fillQuad(g,road.quad(seg,26,3,10),C.PALETTE.shadow,.42*fade);
        this.fillQuad(g,road.quad(seg,25,0,6),C.PALETTE.pathDeep,.95*fade);
      }
    }
    drawRoadsideTufts(g){
      const st=this.game.state;
      if(!this.assets.tuft.complete)return;
      for(let d=80;d<st.path.total-60;d+=190){
        const p=st.path.pointAt(d),n=st.path.normalAt(d),side=((d/190|0)&1)?1:-1;
        g.globalAlpha=.82;
        g.drawImage(this.assets.tuft,Math.round(p.x+n.x*31*side-16),Math.round(p.y+n.y*31*side-15));
      }
      g.globalAlpha=1;
    }
    drawPath(g){
      // Compatibility wrapper for non-layer-aware callers.
      this.drawRoadLayer(g,0);
      this.drawRoadLayer(g,1);
      this.drawRoadsideTufts(g);
    }
    drawHole(g){
      const s=this.game.state,end=G.pathPoint(s.path,s.path.total),im=this.assets.hole;if(im.complete&&im.naturalWidth)g.drawImage(im,Math.round(end.x-59),Math.round(end.y-62));
    }
    pixelShadow(g,x,y,w=22,h=6,alpha=.22){
      g.save();g.globalAlpha=alpha;g.fillStyle=C.PALETTE.shadow;const X=Math.round(x),Y=Math.round(y);g.fillRect(X-w/2+4,Y-1,w-8,3);g.fillRect(X-w/2+8,Y-3,w-16,2);g.fillRect(X-w/2,Y+2,w,2);g.restore();
    }
    drawBallAt(x,y,b,g=this.ctx,shadow=true){
      if(!b)return;const im=b.type==='bomb'?this.assets.bomb:this.assets.balls[b.color];if(!im?.complete||!im.naturalWidth)return;
      const size=b.type==='bomb'?Math.round(C.BALL_DIAM*1.04):C.BALL_DIAM;
      if(shadow)this.pixelShadow(g,x+2,y+Math.round(size*.42),Math.round(size*.9),Math.max(6,Math.round(size*.24)),.24);
      g.drawImage(im,Math.round(x-size/2),Math.round(y-size/2),size,size);
      if(b.type==='bomb'){const flick=((this.game.state?.elapsed||0)*12|0)%2,fx=Math.round(x+size*.45),fy=Math.round(y-size*.78);g.fillStyle=flick?C.PALETTE.orange:C.PALETTE.gold;g.fillRect(fx,fy,4,4);g.fillStyle=C.PALETTE.white;g.fillRect(fx+1,fy-1,2,2);}
    }
    drawBalls(upperPass=false){
      const s=this.game.state;
      for(const b of s.balls){
        const vs=this.game.chain.visualS(b),isUpper=this.game.isOverpassS(vs);
        if(isUpper!==upperPass)continue;
        const p=G.pathPoint(s.path,vs);
        this.drawBallAt(p.x,p.y,b);
      }
    }
    drawInsertion(upperPass=false){
      const s=this.game.state,a=s.insertAnim;if(!a)return;
      const isUpper=this.game.isOverpassS(a.targetS);
      if(isUpper!==upperPass)return;
      const t=G.easeOutCubic(Math.min(1,a.t/a.duration)),target=G.pathPoint(s.path,a.targetS);
      this.drawBallAt(a.startX+(target.x-a.startX)*t,a.startY+(target.y-a.startY)*t,a.ball);
    }
    drawLauncher(){
      const s=this.game.state,g=this.ctx,b=this.assets.launcherBase,bar=this.assets.launcherBarrel,o=C.LAUNCHER.ballSocket;
      if(b.complete&&b.naturalWidth)g.drawImage(b,Math.round(o.x-46),Math.round(o.y-49));
      if(bar.complete&&bar.naturalWidth){g.save();g.translate(o.x,o.y);g.rotate(s.aim);g.drawImage(bar,-7,-13);g.restore();}
      if(s.current&&s.redbean?.mode!=='deliver')this.drawBallAt(o.x,o.y,s.current,g,false);
    }
    drawAim(){
      const s=this.game.state;if(!this.game.canFire())return;const g=this.ctx,o=C.LAUNCHER.ballSocket,ca=Math.cos(s.aim),sa=Math.sin(s.aim);
      for(let d=38;d<=112;d+=19){const x=Math.round(o.x+ca*d),y=Math.round(o.y+sa*d);g.fillStyle='rgba(255,249,232,.94)';g.fillRect(x-2,y-1,5,3);g.fillRect(x-1,y-2,3,5);g.fillStyle='rgba(52,54,74,.27)';g.fillRect(x+2,y+2,2,2);}
    }
    drawProjectile(){const p=this.game.state.projectile;if(p)this.drawBallAt(p.x,p.y,p.ball);}
    redbeanFrame(){
      const s=this.game.state,rb=s.redbean,t=s.elapsed;if(rb.mode==='fail')return((t*4|0)%2)?'fail1':'fail0';if(rb.mode==='clear')return['clear0','clear1','clear2'][(t*7|0)%3];if(rb.mode==='deliver'||rb.mode==='depart'||rb.mode==='swapDeliver'||rb.mode==='swapReturn')return'ride'+((t*12|0)%6);const cycle=t%4.4;if(cycle>4.12&&cycle<4.28)return'idle2';return((t*1.7|0)%2)?'idle1':'idle0';
    }
    drawRedbean(){
      const s=this.game.state,rb=s.redbean,sheet=this.assets.redbean;if(!rb.visible||!sheet.complete||!sheet.naturalWidth)return;let x=rb.x,y=rb.y,rot=0;
      if(!this.reduceMotion){if(rb.mode==='idle')y+=Math.sin(s.elapsed*2.8)*.45;else if(rb.mode==='clear')y-=Math.abs(Math.sin(s.elapsed*7.2))*4;}if(rb.mode==='fail'){y+=4;rot=-.018;}
      this.pixelShadow(this.ctx,x+3,y-1,38,8,rb.mode==='clear'?.15:.28);
      let carried=null,pos=null;
      if(rb.mode==='idle'&&s.next){
        carried=s.next;
        pos={x:x+C.REDBEAN.idleBallOffset.x,y:y+C.REDBEAN.idleBallOffset.y};
      }else if(rb.carriedPos&&rb.cargoBall){
        carried=rb.cargoBall;
        pos=rb.carriedPos;
      }
      const idx=RB_FRAMES[this.redbeanFrame()]??0,sx=(idx%6)*64,sy=((idx/6)|0)*64,g=this.ctx;g.save();g.translate(Math.round(x),Math.round(y));g.rotate(rot);g.drawImage(sheet,sx,sy,64,64,-C.REDBEAN.pivot.x,-C.REDBEAN.pivot.y,64,64);g.restore();
      // 红豆携带的球放在角色前景层，避免视觉上像球卡在身体下方。
      if(carried&&pos)this.drawBallAt(pos.x,pos.y,carried);

    }
    uiFont(weight,size){
      const fam=this.game.save.lang==='ja'
        ? '"Yu Gothic UI","Yu Gothic","Hiragino Kaku Gothic ProN","Meiryo","Noto Sans CJK JP",Arial,sans-serif'
        : '"Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Source Han Sans SC","Heiti SC",Arial,sans-serif';
      return `${weight} ${size}px ${fam}`;
    }
    spark(g,x,y,size,color){g.fillStyle=color;g.fillRect(Math.round(x)-size,Math.round(y)-1,size*2+1,3);g.fillRect(Math.round(x)-1,Math.round(y)-size,3,size*2+1);g.fillStyle=C.PALETTE.white;g.fillRect(Math.round(x),Math.round(y),1,1);}
    drawEffects(){
      const g=this.ctx,s=this.game.state;for(const fx of s.effects){const t=Math.min(1,fx.t/fx.duration),alpha=1-t;
        if(fx.kind==='blast'){const r=12+(fx.radius-12)*(1-Math.pow(1-t,3));g.globalAlpha=alpha*.32;g.strokeStyle=C.PALETTE.gold;g.lineWidth=5;g.beginPath();g.arc(fx.x,fx.y,r,0,Math.PI*2);g.stroke();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r2=r+(i%2?2:-5);g.globalAlpha=alpha*(i%3===0?.98:.72);this.spark(g,fx.x+Math.cos(a)*r2,fx.y+Math.sin(a)*r2,i%4===0?3:2,i%2?C.PALETTE.orange:C.PALETTE.gold);}}
        else if(fx.kind==='pop'){g.globalAlpha=alpha;for(let i=0;i<6;i++){const a=i*Math.PI*2/6,r=3+t*13;this.spark(g,fx.x+Math.cos(a)*r,fx.y+Math.sin(a)*r,2,i%2?C.PALETTE.white:fx.color);}}
      }g.globalAlpha=1;
    }
    drawPopups(){
      const g=this.ctx,s=this.game.state;g.font=this.uiFont(700,17);g.textAlign='center';g.textBaseline='middle';
      for(const p of s.popups){const t=p.t/p.duration;g.globalAlpha=Math.max(0,1-t);g.fillStyle=C.PALETTE.ink;g.fillText(p.text,Math.round(p.x+2),Math.round(p.y-17-t*18+2));g.fillStyle=C.PALETTE.cream;g.fillText(p.text,Math.round(p.x),Math.round(p.y-17-t*18));}g.globalAlpha=1;g.textAlign='left';
    }
    drawFullscreenCountdown(){
      const remaining=this.game.fullscreenCountdownRemaining();if(remaining<=0)return;const g=this.ctx,n=Math.ceil(remaining),ja=this.game.save.lang==='ja';
      g.fillStyle='rgba(35,50,42,.58)';g.fillRect(0,0,C.W,C.H);this.ticketPanel(g,390,158,180,220,C.PALETTE.gold);
      g.textAlign='center';g.textBaseline='middle';g.fillStyle=C.PALETTE.ink2;g.font=this.uiFont(800,15);g.fillText(ja?'まもなくスタート':'准备开始',480,198);
      g.fillStyle=C.PALETTE.pink;g.font=this.uiFont(900,112);g.fillText(String(n),480,280);
      g.fillStyle=C.PALETTE.ink;g.font=this.uiFont(800,14);g.fillText(ja?'照準を合わせよう':'调整好瞄准方向',480,344);g.textAlign='left';
    }
    ticketPanel(g,x,y,w,h,accent=C.PALETTE.pink){
      g.fillStyle='rgba(52,54,74,.26)';g.fillRect(x+5,y+6,w,h);g.fillStyle=C.PALETTE.ink;g.fillRect(x,y,w,h);g.fillStyle=C.PALETTE.paper;g.fillRect(x+3,y+3,w-6,h-6);g.fillStyle=C.PALETTE.cream;g.fillRect(x+6,y+5,w-12,3);g.fillStyle=accent;g.fillRect(x+6,y+h-7,w-12,3);g.fillStyle=C.PALETTE.ink2;g.fillRect(x+13,y+12,3,3);g.fillRect(x+w-16,y+12,3,3);
    }
    drawHUD(){
      const g=this.ctx,s=this.game.state;this.ticketPanel(g,16,14,205,42,C.PALETTE.gold);this.ticketPanel(g,330,14,300,42,C.PALETTE.pink);this.ticketPanel(g,650,14,170,42,C.PALETTE.green);this.ticketPanel(g,872,14,72,42,C.PALETTE.blue);
      const ja=this.game.save.lang==='ja';
      g.fillStyle=C.PALETTE.ink;g.font=this.uiFont(800,17);g.textBaseline='middle';g.fillText(`${ja?'スコア':'得分'} ${Math.round(s.score)}`,29,34);g.fillText(`${ja?'ステージ':'第'}${ja?' ':''}${s.levelNo}${ja?'':'关'}`,344,34);
      const prog=Math.min(1,s.kouki/s.level.koukiTarget),bx=447,by=27,bw=164;g.fillStyle=C.PALETTE.stoneDark;g.fillRect(bx,by,bw,15);g.fillStyle=s.spawnClosed?C.PALETTE.gold:C.PALETTE.pink;g.fillRect(bx+2,by+2,(bw-4)*prog,11);g.fillStyle=C.PALETTE.white;g.fillRect(bx+2,by+2,Math.max(2,(bw-4)*prog),2);g.fillStyle=C.PALETTE.ink;g.font=this.uiFont(800,9);g.fillText(s.spawnClosed?(ja?'残りを消そう':'清空余球'):(ja?'進行度':'进度'),bx+5,by-5);
      g.font=this.uiFont(900,15);g.fillText(`${ja?'コンボ':'连击'} ${s.streak}`,665,34);g.font=this.uiFont(800,11);if(s.pendingBomb>0){g.fillStyle=C.PALETTE.orange;g.fillText(ja?'爆弾！':'炸弹！',758,34);}else if(s.levelNo>=2){g.fillStyle=C.PALETTE.ink;g.fillText(`${s.bombCharge}/5`,758,34);}g.fillStyle=C.PALETTE.ink;g.font='800 21px ui-monospace,monospace';g.fillText('Ⅱ',897,35);
    }
    drawSunFlecks(g){
      const lvl=this.game.state.levelNo;const flecks=[[38,332],[222,352],[612,346],[846,350],[94,516],[780,512],[540,496]];g.globalAlpha=.72;
      for(let i=0;i<flecks.length;i++){const [x,y]=flecks[i];if(!this.safeDecor(x,y,38))continue;g.fillStyle=i%3===0?C.PALETTE.gold:C.PALETTE.cream;g.fillRect(x,y,2,2);if((i+lvl)%2===0)g.fillRect(x+5,y-4,1,1);}g.globalAlpha=1;
    }
  }
  window.DC.Renderer=Renderer;
})();
