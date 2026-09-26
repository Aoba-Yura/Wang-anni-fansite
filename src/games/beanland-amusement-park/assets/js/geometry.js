/* 豆城光辉游乐园 v1.11.0：轨道、道路、自交层级与碰撞几何 */
(() => {
  'use strict';
  function catmull(p0,p1,p2,p3,t){
    const t2=t*t,t3=t2*t;
    return [
      .5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
      .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
    ];
  }
  function smoothSamples(points){
    if(points.length<3)return points.map(p=>[...p]);
    const out=[];
    for(let i=0;i<points.length-1;i++){
      const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
      const chord=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),steps=Math.max(8,Math.ceil(chord/8));
      for(let j=0;j<steps;j++)out.push(catmull(p0,p1,p2,p3,j/steps));
    }
    out.push([...points.at(-1)]);return out;
  }
  function cross(ax,ay,bx,by){return ax*by-ay*bx;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  class PathGeometry{
    constructor(controlPoints){
      this.controlPoints=controlPoints.map(p=>[...p]);
      this.points=smoothSamples(controlPoints);
      this.segs=[];this.total=0;
      for(let i=0;i<this.points.length-1;i++){
        const a=this.points[i],b=this.points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
        if(len<.001)continue;
        this.segs.push({a,b,dx,dy,len,start:this.total,end:this.total+len,index:i});this.total+=len;
      }
      this._intersections=null;
    }
    _segAt(s){
      if(!this.segs.length)return null;
      s=clamp(s,0,this.total);let lo=0,hi=this.segs.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(s<=this.segs[mid].end)hi=mid;else lo=mid+1;}
      return this.segs[lo];
    }
    pointAt(s){
      const seg=this._segAt(s);if(!seg)return{x:0,y:0};s=clamp(s,0,this.total);
      const t=seg.len?(s-seg.start)/seg.len:0;return{x:seg.a[0]+seg.dx*t,y:seg.a[1]+seg.dy*t};
    }
    tangentAt(s){
      const a=this.pointAt(Math.max(0,s-4)),b=this.pointAt(Math.min(this.total,s+4)),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      return{x:dx/len,y:dy/len};
    }
    normalAt(s){const t=this.tangentAt(s);return{x:-t.y,y:t.x};}
    angleAt(s){const t=this.tangentAt(s);return Math.atan2(t.y,t.x);}
    project(pt){
      let best={s:0,x:0,y:0,dist2:Infinity,segment:null};
      for(const seg of this.segs){
        const den=seg.len*seg.len,t=den?clamp(((pt.x-seg.a[0])*seg.dx+(pt.y-seg.a[1])*seg.dy)/den,0,1):0;
        const x=seg.a[0]+seg.dx*t,y=seg.a[1]+seg.dy*t,dx=pt.x-x,dy=pt.y-y,d2=dx*dx+dy*dy;
        if(d2<best.dist2)best={s:seg.start+seg.len*t,x,y,dist2:d2,segment:seg};
      }
      return best;
    }
    sampleRange(s0=0,s1=this.total,step=5){
      const a=clamp(Math.min(s0,s1),0,this.total),b=clamp(Math.max(s0,s1),0,this.total),out=[];
      for(let s=a;s<b;s+=step){const p=this.pointAt(s),n=this.normalAt(s);out.push({s,p,n});}
      const p=this.pointAt(b),n=this.normalAt(b);out.push({s:b,p,n});return out;
    }
    selfIntersections(minPathGap=120){
      if(this._intersections)return this._intersections.map(x=>({...x}));
      const found=[];
      for(let i=0;i<this.segs.length;i++){
        const A=this.segs[i];
        for(let j=i+1;j<this.segs.length;j++){
          const B=this.segs[j];
          if(Math.abs(A.index-B.index)<5||Math.abs(A.start-B.start)<minPathGap)continue;
          const den=cross(A.dx,A.dy,B.dx,B.dy);if(Math.abs(den)<1e-8)continue;
          const qx=B.a[0]-A.a[0],qy=B.a[1]-A.a[1];
          const ta=cross(qx,qy,B.dx,B.dy)/den,tb=cross(qx,qy,A.dx,A.dy)/den;
          if(ta<=1e-5||ta>=1-1e-5||tb<=1e-5||tb>=1-1e-5)continue;
          const sA=A.start+ta*A.len,sB=B.start+tb*B.len,x=A.a[0]+ta*A.dx,y=A.a[1]+ta*A.dy;
          const tA=this.tangentAt(sA),tB=this.tangentAt(sB),sin=Math.abs(cross(tA.x,tA.y,tB.x,tB.y));
          found.push({sA,sB,x,y,sinAngle:sin,angle:Math.asin(clamp(sin,0,1))});
        }
      }
      found.sort((a,b)=>a.x-b.x||a.y-b.y);
      this._intersections=found;return found.map(x=>({...x}));
    }
  }

  class RoadGeometry{
    constructor(path,width=50){
      this.path=path;
      this.width=width;
      this.half=width/2;
      this._segmentCache=new Map();
    }
    boundaryPoint(s,halfWidth=this.half,side=1){
      const p=this.path.pointAt(s),n=this.path.normalAt(s);
      return{x:p.x+n.x*halfWidth*side,y:p.y+n.y*halfWidth*side};
    }
    ribbon(s0=0,s1=this.path.total,halfWidth=this.half,step=4){
      const samples=this.path.sampleRange(s0,s1,step),left=[],right=[];
      for(const q of samples){
        left.push({x:q.p.x+q.n.x*halfWidth,y:q.p.y+q.n.y*halfWidth,s:q.s});
        right.push({x:q.p.x-q.n.x*halfWidth,y:q.p.y-q.n.y*halfWidth,s:q.s});
      }
      return{left,right,s0:samples[0]?.s??0,s1:samples.at(-1)?.s??0};
    }
    segments(step=4){
      const key=String(step);
      if(this._segmentCache.has(key))return this._segmentCache.get(key);
      const q=this.path.sampleRange(0,this.path.total,step),out=[];
      for(let i=0;i<q.length-1;i++){
        const a=q[i],b=q[i+1];
        out.push({
          s0:a.s,s1:b.s,mid:(a.s+b.s)/2,
          p0:a.p,p1:b.p,n0:a.n,n1:b.n
        });
      }
      this._segmentCache.set(key,out);
      return out;
    }
    quad(seg,halfWidth=this.half,dx=0,dy=0){
      return[
        {x:seg.p0.x+seg.n0.x*halfWidth+dx,y:seg.p0.y+seg.n0.y*halfWidth+dy},
        {x:seg.p1.x+seg.n1.x*halfWidth+dx,y:seg.p1.y+seg.n1.y*halfWidth+dy},
        {x:seg.p1.x-seg.n1.x*halfWidth+dx,y:seg.p1.y-seg.n1.y*halfWidth+dy},
        {x:seg.p0.x-seg.n0.x*halfWidth+dx,y:seg.p0.y-seg.n0.y*halfWidth+dy}
      ];
    }
    sideBand(seg,outerHalf,innerHalf,side=1,dx=0,dy=0){
      const so=outerHalf*side,si=innerHalf*side;
      return[
        {x:seg.p0.x+seg.n0.x*so+dx,y:seg.p0.y+seg.n0.y*so+dy},
        {x:seg.p1.x+seg.n1.x*so+dx,y:seg.p1.y+seg.n1.y*so+dy},
        {x:seg.p1.x+seg.n1.x*si+dx,y:seg.p1.y+seg.n1.y*si+dy},
        {x:seg.p0.x+seg.n0.x*si+dx,y:seg.p0.y+seg.n0.y*si+dy}
      ];
    }
  }

  class CrossingSystem{
    constructor(path,road,{mode='none',ballRadius=14}={}){
      this.path=path;
      this.road=road;
      this.mode=mode;
      this.ballRadius=ballRadius;
      this.items=[];
      if(mode==='none')return;

      for(const hit of path.selfIntersections(120)){
        const earlier=Math.min(hit.sA,hit.sB),later=Math.max(hit.sA,hit.sB);
        const upperS=mode==='later-over'?later:earlier;
        const lowerS=mode==='later-over'?earlier:later;

        // Exact strip-overlap extent along either branch.
        // For two equal half-width road strips crossing at angle θ:
        // h_render = h * (1 + |cosθ|) / |sinθ|
        const sin=Math.max(1e-6,hit.sinAngle||1);
        const cos=Math.sqrt(Math.max(0,1-sin*sin));
        const renderHalf=road.half*(1+Math.abs(cos))/sin+12; // include a visual transition beyond the geometric overlap

        // Lower-branch collision occlusion:
        // as soon as a lower ball's circle touches the upper strip, direct projectile hits are disabled.
        const lowerOcclusionHalf=(road.half+ballRadius)/sin;

        // Upper-branch rendering:
        // every upper ball whose sprite can overlap the z=+1 road geometry must be rendered
        // AFTER that road.  This span therefore contains the whole road render span plus
        // one ball radius.  It must never be smaller than renderHalf.
        const upperBallHalf=renderHalf+ballRadius;

        this.items.push({
          ...hit,
          upperS,lowerS,
          renderHalf,
          upperBallHalf,
          lowerOcclusionHalf
        });
      }
      this.items.sort((a,b)=>a.upperS-b.upperS);
    }
    layerAt(s){
      let upper=false,lower=false;
      for(const c of this.items){
        if(Math.abs(s-c.upperS)<=c.renderHalf)upper=true;
        if(Math.abs(s-c.lowerS)<=c.renderHalf)lower=true;
      }
      if(upper)return 1;
      if(lower)return -1;
      return 0;
    }
    isUpper(s){
      // Rendering classification only.
      // A ball in this span is always drawn after the z=+1 road layer,
      // so its own upper road can never cover it.
      return this.items.some(c=>Math.abs(s-c.upperS)<=c.upperBallHalf);
    }
    isOccluded(s){
      // Collision classification only for the lower branch.
      return this.items.some(c=>Math.abs(s-c.lowerS)<=c.lowerOcclusionHalf);
    }
    debugSummary(){
      return this.items.map((c,i)=>({
        index:i+1,
        x:Math.round(c.x),y:Math.round(c.y),
        upperS:Math.round(c.upperS),lowerS:Math.round(c.lowerS),
        renderHalf:+c.renderHalf.toFixed(1),
        upperBallHalf:+c.upperBallHalf.toFixed(1),
        lowerOcclusionHalf:+c.lowerOcclusionHalf.toFixed(1)
      }));
    }
  }

  function buildPath(controlPoints){return new PathGeometry(controlPoints);}
  function pathPoint(path,s){return path.pointAt(s);}
  function pathTangent(path,s){return path.tangentAt(s);}
  function pathNormal(path,s){return path.normalAt(s);}
  function pathAngle(path,s){return path.angleAt(s);}
  function movingCircleHitT(p0,p1,q0,q1,radius){
    const ax=p0.x-q0.x,ay=p0.y-q0.y,bx=p1.x-q1.x,by=p1.y-q1.y,dx=bx-ax,dy=by-ay;
    const c=ax*ax+ay*ay-radius*radius;if(c<=0)return 0;const a=dx*dx+dy*dy;if(a<1e-9)return null;
    const b=2*(ax*dx+ay*dy),disc=b*b-4*a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
  }
  function bezier2(a,b,c,t){const u=1-t;return{x:u*u*a.x+2*u*t*b.x+t*t*c.x,y:u*u*a.y+2*u*t*b.y+t*t*c.y};}
  function easeOutCubic(t){return 1-Math.pow(1-t,3);}
  function easeInOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  window.DC.geo={PathGeometry,RoadGeometry,CrossingSystem,buildPath,pathPoint,pathTangent,pathNormal,pathAngle,movingCircleHitT,bezier2,easeOutCubic,easeInOut};
})();
