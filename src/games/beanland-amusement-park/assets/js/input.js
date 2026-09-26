/* 豆城光辉游乐园 v1.11.0：鼠标、触摸与键盘输入 */
(() => {
  'use strict';
  const C=window.DC.cfg;
  class InputController{
    constructor(game,canvas){
      this.game=game;this.canvas=canvas;this.rect=null;this.pointer={valid:false,x:0,y:0};this.touch=null;
      this.onMove=this.onMove.bind(this);this.onDown=this.onDown.bind(this);this.onUp=this.onUp.bind(this);this.onCancel=this.onCancel.bind(this);this.onKey=this.onKey.bind(this);
      if('onpointerrawupdate' in window) canvas.addEventListener('pointerrawupdate',this.onMove,{passive:true});
      canvas.addEventListener('pointermove',this.onMove,{passive:false});canvas.addEventListener('pointerdown',this.onDown,{passive:false});canvas.addEventListener('pointerup',this.onUp,{passive:false});canvas.addEventListener('pointercancel',this.onCancel,{passive:true});
      canvas.addEventListener('contextmenu',e=>e.preventDefault());
      window.addEventListener('keydown',this.onKey);this.syncMetrics();
    }
    syncMetrics(){const r=this.canvas.getBoundingClientRect();this.rect={left:r.left,top:r.top,sx:C.W/Math.max(1,r.width),sy:C.H/Math.max(1,r.height)};}
    logical(clientX,clientY){const r=this.rect;if(!r)return null;return{x:(clientX-r.left)*r.sx,y:(clientY-r.top)*r.sy};}
    record(e){this.pointer.valid=true;this.pointer.x=e.clientX;this.pointer.y=e.clientY;}
    applyAim(){if(!this.pointer.valid||!this.game.state)return;const p=this.logical(this.pointer.x,this.pointer.y);if(!p)return;const o=C.LAUNCHER.ballSocket;this.game.state.aim=Math.atan2(p.y-o.y,p.x-o.x);}
    redbeanHit(p){
      const rb=this.game.state?.redbean;if(!rb?.visible)return false;
      const cx=rb.x,cy=rb.y-30,rx=27,ry=31;
      const dx=(p.x-cx)/rx,dy=(p.y-cy)/ry;
      return dx*dx+dy*dy<=1;
    }
    onMove(e){if(!this.game.state)return;if(e.pointerType!=='mouse'&&e.pointerType!=='pen'&&this.touch?.id!==e.pointerId)return;if(e.pointerType==='touch')e.preventDefault();this.record(e);if(this.touch?.id===e.pointerId)this.touch.p=this.logical(e.clientX,e.clientY);}
    onDown(e){
      if(!this.game.state)return;this.record(e);const p=this.logical(e.clientX,e.clientY);if(!p)return;
      if(e.button===2){e.preventDefault();this.game.swapAmmo();return;}if(e.button!==0)return;
      this.applyAim();
      if(p.x>850&&p.y<72){e.preventDefault();this.touch=null;this.game.pauseGame();return;}
      if(this.redbeanHit(p)){e.preventDefault();this.touch=null;this.game.swapAmmo();return;}
      if(e.pointerType==='mouse'||e.pointerType==='pen'){this.game.requestFire(this.game.state.aim);return;}
      e.preventDefault();this.touch={id:e.pointerId,p};try{this.canvas.setPointerCapture(e.pointerId);}catch(_){}
    }
    onUp(e){if((e.pointerType==='mouse'||e.pointerType==='pen')||this.touch?.id!==e.pointerId)return;e.preventDefault();this.record(e);this.applyAim();this.game.requestFire(this.game.state.aim);this.touch=null;try{this.canvas.releasePointerCapture(e.pointerId);}catch(_){} }
    onCancel(e){if(this.touch?.id===e.pointerId)this.touch=null;}
    onKey(e){
      if(!this.game.state)return;
      if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(this.game.state.paused)this.game.resumeGame();else this.game.pauseGame();}
      else if(e.code==='Space'){e.preventDefault();this.game.swapAmmo();}
      else if(e.code==='Enter'){e.preventDefault();this.game.requestFire(this.game.state.aim);}
      else if(e.code==='KeyR'&&this.game.state.phase==='play'){e.preventDefault();this.game.startLevel(this.game.state.levelNo);}
    }
  }
  window.DC.InputController=InputController;
})();
