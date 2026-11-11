/* 豆城光辉游乐园 v1.11.0：游戏状态、规则、界面和主循环 */
(() => {
  'use strict';
  const C=window.DC.cfg,G=window.DC.geo;
  class Game{
    constructor(){
      this.$=id=>document.getElementById(id);this.menu=this.$('menu');this.levelsScreen=this.$('levels');this.gameScreen=this.$('game');this.canvas=this.$('gameCanvas');
      this.assetLoader=this.$('assetLoader');this.assetLoaderText=this.$('assetLoaderText');this.assetsReady=false;
      this.overlay=this.$('overlay');this.overlayTitle=this.$('overlayTitle');this.overlaySub=this.$('overlaySub');this.overlayButtons=this.$('overlayButtons');this.tutorial=this.$('tutorial');this.rotateGate=this.$('rotateGate');
      this.fullscreenRestoreBtn=this.$('fullscreenRestoreBtn');this.rotateRestoreBtn=this.$('rotateRestoreBtn');
      this.save=this.loadSave();this.assets=window.DC.assets.buildAssets();this.audio=new window.DC.AudioEngine(this.save.sound);this.state=null;this.acc=0;this.lastTs=performance.now();
      this.fullscreenRecoveryPending=false;this.fullscreenCountdownPending=false;this.lastFullscreenCountdownAt=0;this.intentionalFullscreenExit=false;this.wasFullscreen=this.isFullscreenLike();
      this.chain=new window.DC.ChainSystem(this);this.renderer=new window.DC.Renderer(this,this.canvas,this.assets);this.input=new window.DC.InputController(this,this.canvas);this.bindUI();this.syncViewport();
      this.prepareAssets();
      requestAnimationFrame(t=>this.frame(t));
    }
    waitForImage(image){if(image.complete)return image.naturalWidth?Promise.resolve():Promise.reject(new Error(`Image failed: ${image.currentSrc||image.src}`));return new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error(`Image failed: ${image.currentSrc||image.src}`)),{once:true});});}
    async prepareAssets(){try{await Promise.all([this.assets.ready,...[...document.images].map(image=>this.waitForImage(image)),document.fonts?.ready||Promise.resolve()]);this.assetsReady=true;this.$('startBtn').disabled=false;document.body.classList.remove('is-loading');this.assetLoader.hidden=true;}catch(error){console.error(error);this.assetLoaderText.textContent='资源加载失败，请刷新页面重试';}}
    defaultSave(){return{progressLevel:1,scores:{},tutorialSeen:false,bombTutorialSeen:false,tunnelTutorialSeen:false,sound:true,lang:'zh'};}
    loadSave(){try{let raw=localStorage.getItem(C.STORAGE_KEY);if(!raw)for(const k of C.LEGACY_KEYS){const v=localStorage.getItem(k);if(v){raw=v;break;}}const prior=raw?JSON.parse(raw):{},save=Object.assign(this.defaultSave(),prior);if(!Number.isInteger(prior.progressLevel)){let next=1;while(next<C.LEVELS.length&&Object.prototype.hasOwnProperty.call(save.scores,next))next++;save.progressLevel=next;}save.progressLevel=Math.max(1,Math.min(C.LEVELS.length,save.progressLevel));return save;}catch(_){return this.defaultSave();}}
    persist(){try{localStorage.setItem(C.STORAGE_KEY,JSON.stringify(this.save));}catch(_){}}
    l(zh,ja){return this.save.lang==='ja'?ja:zh;}
    applyLanguage(){
      document.documentElement.lang=this.save.lang==='ja'?'ja':'zh-CN';
      const set=(id,text)=>{const el=this.$(id);if(el)el.textContent=text;};
      set('startBtn',this.l('进入游乐园','あそびに行く'));
      set('helpBtn',this.l('玩法','遊び方'));
      set('langBtn',this.l('中文','日本語'));
      set('levelTitle',this.l('选择路线','コースを選ぶ'));
      
      set('fullscreenRestoreLabel',this.l('全屏','全画面'));
      set('rotateHint',this.l('请横屏游玩','横向きで遊んでね'));
      set('rotateRestoreBtn',this.l('全屏继续','全画面で再開'));
      const fs=this.$('fullscreenRestoreBtn');if(fs)fs.setAttribute('aria-label',this.l('返回全屏','全画面に戻る'));
      const lang=this.$('langBtn');if(lang)lang.setAttribute('aria-label',this.l('切换到日语','中国語に切り替える'));
      this.updateMenuSound();
      if(this.levelsScreen.classList.contains('active'))this.makeLevelButtons();
    }
    isTouchDevice(){return matchMedia('(pointer:coarse)').matches;}
    fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null;}
    canRequestFullscreen(){const root=document.documentElement;return!!(document.fullscreenEnabled||root.requestFullscreen||root.webkitRequestFullscreen);}
    isStandalone(){return matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
    isFullscreenLike(){return!!this.fullscreenElement()||this.isStandalone();}
    isPortrait(){const vv=window.visualViewport;return(vv?vv.height:innerHeight)>(vv?vv.width:innerWidth);}
    bindUI(){
      this.$('startBtn').onclick=()=>{this.makeLevelButtons();this.showScreen(this.levelsScreen);};this.$('backMenuBtn').onclick=()=>this.showScreen(this.menu);
      this.$('helpBtn').onclick=()=>this.showInfoOverlay();this.$('soundBtn').onclick=()=>{this.save.sound=!this.save.sound;this.audio.setEnabled(this.save.sound);this.persist();this.updateMenuSound();};
      this.$('langBtn').onclick=()=>{this.save.lang=this.save.lang==='ja'?'zh':'ja';this.persist();this.applyLanguage();};
      this.applyLanguage();
      this.fullscreenRestoreBtn.onclick=()=>this.restoreFullscreenFromGesture(true);
      this.rotateRestoreBtn.onclick=()=>this.restoreFullscreenFromGesture(true);
      const onViewport=()=>{this.syncViewport();this.updateOrientationGate();this.updateFullscreenRecoveryUI();requestAnimationFrame(()=>this.input.syncMetrics());};
      const onFullscreenChange=()=>setTimeout(()=>{onViewport();this.handleFullscreenChange();},40);
      addEventListener('resize',onViewport);addEventListener('orientationchange',()=>setTimeout(()=>{onViewport();this.handleLandscapeReturn();},120));document.addEventListener('fullscreenchange',onFullscreenChange);document.addEventListener('webkitfullscreenchange',onFullscreenChange);
      if(window.visualViewport){visualViewport.addEventListener('resize',onViewport);visualViewport.addEventListener('scroll',onViewport);}
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pauseGame();this.lastTs=performance.now();this.acc=0;});
    }
    updateMenuSound(){const b=this.$('soundBtn');if(b){b.textContent=`${this.l('音效','効果音')} ${this.save.sound?'ON':'OFF'}`;b.setAttribute('aria-pressed',String(this.save.sound));}}
    showInfoOverlay(){
      const zh=`【打出三消】
瞄准球链，凑齐至少3颗同色球就能消除。
电脑移动鼠标瞄准，点击发射；手机拖动瞄准，松开发射。
点红豆能换球！

【点亮光辉】
消球与连锁可以积累光辉。
光辉集满后，新球停止入场。清空余球，赢下这一关！

【再来一手】
连续消球可保持连击，并给炸弹充能。`;

      const ja=`【3つそろえて消そう】
同じ色の玉を3つ以上つなげると消えます。
PCはマウスで狙ってクリック。スマホはドラッグで狙い、指を離して発射。
紅豆をタップして玉を交換。

【光輝を集めよう】
玉を消し、連鎖をつないで光輝を集めよう。
満タンになると新しい玉は止まります。残りを消してクリア！

【狙いを変えて】
連続で消すとコンボが続き、爆弾もチャージ！`;

      this.showOverlay(this.l('游玩指南','遊び方'),this.l(zh,ja),[[this.l('明白了','わかった'),()=>this.hideOverlay()]]);
      this.overlay.classList.add('help-overlay');
    }
    syncViewport(){const vv=window.visualViewport,w=Math.max(1,Math.round(vv?vv.width:innerWidth)),h=Math.max(1,Math.round(vv?vv.height:innerHeight));document.documentElement.style.setProperty('--app-w',w+'px');document.documentElement.style.setProperty('--app-h',h+'px');}
    showScreen(el){[this.menu,this.levelsScreen,this.gameScreen].forEach(s=>s.classList.remove('active'));el.classList.add('active');this.syncViewport();this.updateOrientationGate();this.updateFullscreenRecoveryUI();requestAnimationFrame(()=>this.input.syncMetrics());}
    makeLevelButtons(){
      const grid=this.$('levelGrid');grid.replaceChildren();
      C.LEVELS.forEach((level,i)=>{
        const n=i+1,locked=n>this.save.progressLevel,b=document.createElement('button');
        b.type='button';b.className=`level-btn${locked?' locked':''}`;b.disabled=locked;
        const no=document.createElement('span');no.className='level-no';no.textContent=this.l(`第 ${n} 关`,`ステージ ${n}`);
        const score=document.createElement('span');score.className='level-score';score.textContent=this.l(`最高分 ${this.save.scores[n]||0}`,`BEST ${this.save.scores[n]||0}`);
        const current=document.createElement('span');current.className='level-time';current.textContent=locked?this.l('尚未解锁','未解放'):n===this.save.progressLevel?this.l('正在挑战','挑戦中'):'';
        b.append(no,score,current);
        if(!locked)b.onclick=async()=>{await this.enterPlayMode();await this.startLevel(n);};
        grid.appendChild(b);
      });
    }
    async enterPlayMode(){
      if(!this.isTouchDevice())return true;
      const wasFullscreen=this.isFullscreenLike();
      try{
        const root=document.documentElement;
        if(!this.fullscreenElement()&&!this.isStandalone()){
          if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});
          else if(root.webkitRequestFullscreen)root.webkitRequestFullscreen();
        }
      }catch(_){}
      const nowFullscreen=this.isFullscreenLike();
      if(!wasFullscreen&&nowFullscreen){this.wasFullscreen=true;this.beginFullscreenCountdown();}
      try{if(screen.orientation?.lock&&nowFullscreen)await screen.orientation.lock('landscape');}catch(_){}
      this.syncViewport();this.updateOrientationGate();this.updateFullscreenRecoveryUI();
      return nowFullscreen;
    }
    async restoreFullscreenFromGesture(resumeAfter=false){
      if(!this.isTouchDevice())return false;
      const ok=await this.enterPlayMode();
      if(ok){
        this.fullscreenRecoveryPending=false;
        if(resumeAfter&&this.state?.paused)this.resumeGame();
        else if(this.state?.paused)this.showPauseOverlay();
      }else if(this.state?.paused){
        this.showPauseOverlay('fullscreen-error');
      }
      this.updateFullscreenRecoveryUI();
      return ok;
    }
    async exitPlayMode(){
      try{screen.orientation?.unlock?.();}catch(_){}
      try{
        if(document.fullscreenElement&&document.exitFullscreen){this.intentionalFullscreenExit=true;await document.exitFullscreen();}
        else if(document.webkitFullscreenElement&&document.webkitExitFullscreen){this.intentionalFullscreenExit=true;document.webkitExitFullscreen();}
      }catch(_){this.intentionalFullscreenExit=false;}
      this.syncViewport();this.updateOrientationGate();this.updateFullscreenRecoveryUI();
    }
    beginFullscreenCountdown(){
      if(!this.state){this.fullscreenCountdownPending=true;return;}
      const now=performance.now();if(now-this.lastFullscreenCountdownAt<500)return;
      this.lastFullscreenCountdownAt=now;this.fullscreenCountdownPending=false;this.state.fullscreenCountdownEndsAt=now+C.FULLSCREEN_COUNTDOWN_MS;this.state.fireBuffer=null;this.acc=0;this.lastTs=now;
    }
    fullscreenCountdownRemaining(){return Math.max(0,((this.state?.fullscreenCountdownEndsAt||0)-performance.now())/1000);}
    handleFullscreenChange(){
      const now=this.isFullscreenLike(),entered=!this.wasFullscreen&&now,lost=this.wasFullscreen&&!now;
      this.wasFullscreen=now;
      if(entered)this.beginFullscreenCountdown();
      if(now){this.fullscreenRecoveryPending=false;if(this.state?.paused&&!this.overlay.classList.contains('hidden'))this.showPauseOverlay();return;}
      if(!lost)return;
      if(this.intentionalFullscreenExit){this.intentionalFullscreenExit=false;if(this.state?.paused)this.showPauseOverlay();this.updateFullscreenRecoveryUI();return;}
      if(!this.isTouchDevice()||!this.gameScreen.classList.contains('active')||!this.state||this.state.phase!=='play')return;
      this.fullscreenRecoveryPending=true;
      if(!this.state.paused){this.state.paused=true;this.state.fireBuffer=null;}
      this.showPauseOverlay('fullscreen-lost');
      this.updateFullscreenRecoveryUI();
    }
    handleLandscapeReturn(){
      if(!this.isTouchDevice()||!this.gameScreen.classList.contains('active')||!this.state||this.state.phase!=='play'||this.isPortrait()||this.isFullscreenLike())return;
      if(this.fullscreenRecoveryPending&&this.state.paused)this.showPauseOverlay('fullscreen-lost');
      this.updateFullscreenRecoveryUI();
    }
    async returnToMenu(){this.state=null;this.input.touch=null;this.hideOverlay();await this.exitPlayMode();this.makeLevelButtons();this.showScreen(this.levelsScreen);this.updateOrientationGate();}
    async startLevel(n){
      await this.assets.ready;const baseLevel=C.LEVELS[n-1],path=G.buildPath(baseLevel.path),road=new G.RoadGeometry(path,50),crossings=new G.CrossingSystem(path,road,{mode:baseLevel.crossingMode||'none',ballRadius:C.BALL_R}),level={...baseLevel,speed:path.total/baseLevel.pressureSec},redbeanGround=([2,3,6,8].includes(n)?{x:580,y:370}:n===7?{x:550,y:420}:[1,4].includes(n)?{x:380,y:440}:C.REDBEAN.idleGround);this.state={levelNo:n,level,path,road,crossings,redbeanGround,balls:[],generated:0,score:0,kouki:0,spawnClosed:false,streak:0,bestStreak:0,bombCharge:0,pendingBomb:0,current:null,next:null,projectile:null,ammoGenerated:0,phase:'play',paused:false,fullscreenCountdownEndsAt:0,aim:-Math.PI/2,fireCooldown:0,fireBuffer:null,deferNextAmmo:false,insertAnim:null,retractAnim:null,pendingJoins:[],gapWindows:[],nextGapId:1,popups:[],effects:[],elapsed:0,spawnCd:0,redbean:{mode:'idle',x:redbeanGround.x,y:redbeanGround.y,visible:true,carriedPos:null,cargoBall:null,queuedSwap:false,travel:null}};
      this.state.current=this.randAmmo();this.state.next=this.randAmmo();this.tutorial.style.setProperty('--hint-left',redbeanGround.x/C.W*100+'%');this.tutorial.style.setProperty('--hint-top',(redbeanGround.y+15)/C.H*100+'%');this.state.scene=this.renderer.buildStaticScene();this.state.upperRoadLayer=this.renderer.buildUpperRoadLayer();this.input.touch=null;this.hideOverlay();clearTimeout(this.showToast._t);this.tutorial.classList.add('hidden');this.showScreen(this.gameScreen);this.updateOrientationGate();this.acc=0;this.lastTs=performance.now();
      if(this.fullscreenCountdownPending)this.beginFullscreenCountdown();
      if(this.save.tutorialVersion!==C.VERSION){this.showToast(this.isTouchDevice()?this.l('松开发射','離して発射'):this.l('点击发射','クリックで発射'),4500);this.save.tutorialVersion=C.VERSION;this.save.tutorialSeen=true;this.persist();}

    }
    randNormalBall(){return{type:'normal',color:Math.floor(Math.random()*this.state.level.colors)};}
    liveChainColors(){return this.chain.liveColors();}
    isEndgame(){const s=this.state;return!!(s&&s.spawnClosed&&s.balls.length>0&&s.balls.length<=10);}
    randAmmoNormal(){
      if(this.isEndgame()){
        const pool=this.liveChainColors();
        if(pool.length)return{type:'normal',color:pool[Math.floor(Math.random()*pool.length)]};
      }
      return this.randNormalBall();
    }
    randAmmo(){
      const s=this.state;s.ammoGenerated++;
      if(s.levelNo>=2&&s.pendingBomb>0){s.pendingBomb--;return{type:'bomb',color:-1};}
      return this.randAmmoNormal();
    }
    shotOrigin(){return{x:C.LAUNCHER.ballSocket.x,y:C.LAUNCHER.ballSocket.y};}
    isOccludedS(pos){return!!this.state?.crossings?.isOccluded(pos);}
    isOverpassS(pos){return!!this.state?.crossings?.isUpper(pos);}
    gameplayLocked(){return!!this.state?.insertAnim;}
    canFire(){const s=this.state;return!!(s&&s.phase==='play'&&!s.paused&&this.fullscreenCountdownRemaining()<=0&&!s.projectile&&!s.insertAnim&&!this.swapInProgress()&&s.fireCooldown<=0&&s.current);}
    requestFire(angle=this.state?.aim){const s=this.state;if(!s||s.phase!=='play'||s.paused||this.fullscreenCountdownRemaining()>0)return;if(this.canFire()){this.fire(angle);return;}s.fireBuffer={ttl:C.FIRE_BUFFER,angle};}
    consumeFireBuffer(){const s=this.state,b=s?.fireBuffer;if(!b||b.ttl<=0||!this.canFire())return false;s.fireBuffer=null;this.fire(b.angle);return true;}
    redbeanGround(){return this.state?.redbeanGround||C.REDBEAN.idleGround;}
    redbeanIdleBall(){const p=this.redbeanGround();return{x:p.x+C.REDBEAN.idleBallOffset.x,y:p.y+C.REDBEAN.idleBallOffset.y};}
    startRedbeanDelivery(){
      const s=this.state,rb=s?.redbean;if(!s||!rb||s.phase!=='play')return;
      const idle=this.redbeanIdleBall();
      const from=rb.carriedPos?{x:rb.carriedPos.x,y:rb.carriedPos.y}:
        rb.mode==='idle'?idle:
        {x:rb.x-C.REDBEAN.rideGroundOffset.x,y:rb.y-C.REDBEAN.rideGroundOffset.y};
      rb.cargoBall=s.current;
      rb.travel={phase:'deliver',t:0,fromBall:from};
      rb.mode='deliver';rb.visible=true;rb.carriedPos={x:from.x,y:from.y};
    }
    swapInProgress(){
      const phase=this.state?.redbean?.travel?.phase;
      return phase==='swapDeliver'||phase==='swapReturn';
    }
    startSwapExchange(){
      const s=this.state,rb=s?.redbean;if(!s||!rb||!s.current||!s.next||rb.travel||s.current.type==='bomb'||s.next.type==='bomb')return false;
      const idle=this.redbeanIdleBall();
      rb.cargoBall=s.next;
      rb.travel={phase:'swapDeliver',t:0,fromBall:idle};
      rb.mode='swapDeliver';rb.visible=true;rb.carriedPos={x:idle.x,y:idle.y};
      rb.x=this.redbeanGround().x;rb.y=this.redbeanGround().y;
      this.sound('insert');
      return true;
    }
    updateRedbeanCourier(dt){
      const s=this.state,rb=s?.redbean,tr=rb?.travel;if(!s||!rb||!tr||s.phase!=='play')return;
      tr.t+=dt;
      const idle=this.redbeanIdleBall(),socket=C.LAUNCHER.ballSocket;

      if(tr.phase==='deliver'){
        const dur=C.RELOAD.deliverEnd,u=Math.min(1,tr.t/dur);
        const from=tr.fromBall,ctrl={x:(from.x+socket.x)*.5,y:Math.min(from.y,socket.y)-20};
        const ball=G.bezier2(from,ctrl,socket,G.easeInOut(u));
        rb.mode='deliver';rb.visible=true;rb.carriedPos=ball;
        rb.x=ball.x+C.REDBEAN.rideGroundOffset.x;rb.y=ball.y+C.REDBEAN.rideGroundOffset.y;
        if(u>=1){
          rb.cargoBall=null;rb.carriedPos=null;
          rb.travel={phase:'depart',t:0,fromDog:{x:rb.x,y:rb.y}};
          rb.mode='depart';
        }
        return;
      }

      if(tr.phase==='depart'){
        const dur=.16,u=Math.min(1,tr.t/dur);
        const from=tr.fromDog,to=this.redbeanGround();
        const p=G.bezier2(from,{x:448,y:405},to,G.easeInOut(u));
        rb.mode='depart';rb.visible=true;rb.carriedPos=null;rb.cargoBall=null;rb.x=p.x;rb.y=p.y;
        if(u>=1){
          rb.x=to.x;rb.y=to.y;rb.visible=true;rb.carriedPos=null;rb.cargoBall=null;
          if(!s.next&&s.deferNextAmmo){
            rb.travel={phase:'waitPickup',t:0};
            rb.mode='idle';
          }else{
            rb.travel=null;rb.mode='idle';
            if(rb.queuedSwap&&s.current&&s.next){
              rb.queuedSwap=false;
              this.startSwapExchange();
            }
          }
        }
        return;
      }

      if(tr.phase==='waitPickup'){
        rb.mode='idle';rb.visible=true;rb.x=this.redbeanGround().x;rb.y=this.redbeanGround().y;rb.carriedPos=null;rb.cargoBall=null;
        if(s.next){
          rb.travel=null;
          if(rb.queuedSwap&&s.current&&s.next){
            rb.queuedSwap=false;
            this.startSwapExchange();
          }
        }
        return;
      }

      if(tr.phase==='swapDeliver'){
        const dur=.13,u=Math.min(1,tr.t/dur);
        const from=tr.fromBall,ctrl={x:(from.x+socket.x)*.5,y:Math.min(from.y,socket.y)-24};
        const ball=G.bezier2(from,ctrl,socket,G.easeInOut(u));
        rb.mode='swapDeliver';rb.visible=true;rb.carriedPos=ball;
        rb.x=ball.x+C.REDBEAN.rideGroundOffset.x;rb.y=ball.y+C.REDBEAN.rideGroundOffset.y;
        if(u>=1){
          const oldCurrent=s.current,oldNext=s.next;
          s.current=oldNext;s.next=oldCurrent;
          rb.cargoBall=s.next;
          rb.travel={phase:'swapReturn',t:0,fromBall:{x:socket.x,y:socket.y}};
          rb.mode='swapReturn';rb.carriedPos={x:socket.x,y:socket.y};
        }
        return;
      }

      if(tr.phase==='swapReturn'){
        const dur=.13,u=Math.min(1,tr.t/dur);
        const from=tr.fromBall,ball=G.bezier2(from,{x:(from.x+idle.x)*.5,y:Math.max(from.y,idle.y)+35},idle,G.easeInOut(u));
        rb.mode='swapReturn';rb.visible=true;rb.carriedPos=ball;
        rb.x=ball.x+C.REDBEAN.rideGroundOffset.x;rb.y=ball.y+C.REDBEAN.rideGroundOffset.y;
        if(u>=1){
          rb.travel=null;rb.mode='idle';rb.visible=true;rb.carriedPos=null;rb.cargoBall=null;
          rb.x=this.redbeanGround().x;rb.y=this.redbeanGround().y;
          if(rb.queuedSwap&&s.current&&s.next){
            rb.queuedSwap=false;
            this.startSwapExchange();
          }
        }
      }
    }
    swapAmmo(){
      const s=this.state,rb=s?.redbean;
      if(!s||s.phase!=='play'||s.paused||this.fullscreenCountdownRemaining()>0||!rb||!s.current||!s.next||s.current.type==='bomb'||s.next.type==='bomb')return false;
      if(rb.travel){
        rb.queuedSwap=!rb.queuedSwap;
        this.sound('insert');
        return true;
      }
      return this.startSwapExchange();
    }
    fire(angle){
      if(!this.canFire())return;
      const s=this.state,o=this.shotOrigin(),shot=s.current,defer=s.spawnClosed;
      s.current=s.next;
      if(defer){s.next=null;s.deferNextAmmo=true;}
      else{s.next=this.randAmmo();s.deferNextAmmo=false;}
      s.fireCooldown=C.FIRE_RECOVERY;
      s.projectile={x:o.x,y:o.y,vx:Math.cos(angle)*C.PROJECTILE_SPEED,vy:Math.sin(angle)*C.PROJECTILE_SPEED,ball:shot,crossedGaps:new Set(),pendingImpact:null};
      this.startRedbeanDelivery();this.sound('shoot');
      if(s.next?.type==='bomb'&&!this.save.bombTutorialSeen){this.showToast(this.l('炸弹已就绪！','爆弾、準備完了！'),3000);this.save.bombTutorialSeen=true;this.persist();}
    }
    createGapWindow(left,right){const s=this.state;if(!s||!left||!right)return;const exists=s.gapWindows.some(g=>g.left===left&&g.right===right);if(!exists)s.gapWindows.push({id:s.nextGapId++,left,right,age:0});}
    segmentPointDistanceSq(a,b,p){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,d=vx*vx+vy*vy;let t=d>1e-9?(wx*vx+wy*vy)/d:0;t=Math.max(0,Math.min(1,t));const dx=a.x+vx*t-p.x,dy=a.y+vy*t-p.y;return dx*dx+dy*dy;}
    trackGapCrossings(p,p0,p1){
      const s=this.state;if(!s.gapWindows.length)return;for(const gap of s.gapWindows){if(p.crossedGaps.has(gap.id))continue;if(!s.balls.includes(gap.left)||!s.balls.includes(gap.right))continue;let a=this.chain.visualS(gap.left),b=this.chain.visualS(gap.right);if(a>b)[a,b]=[b,a];a+=C.BALL_R*.65;b-=C.BALL_R*.65;if(b-a<C.BALL_DIAM*.85)continue;let crossed=false;for(let q=a;q<=b;q+=C.GAP_SAMPLE){const pt=G.pathPoint(s.path,q);if(this.segmentPointDistanceSq(p0,p1,pt)<=Math.pow(C.BALL_R*.82,2)){crossed=true;break;}}if(crossed)p.crossedGaps.add(gap.id);}
    }
    updateGapWindows(dt){const s=this.state;for(const g of s.gapWindows)g.age+=dt;s.gapWindows=s.gapWindows.filter(g=>{if(g.age>1.35||!s.balls.includes(g.left)||!s.balls.includes(g.right))return false;const d=Math.abs(this.chain.visualS(g.right)-this.chain.visualS(g.left));return d>C.BALL_SPACING*1.15;});}
    addKouki(amount){
      const s=this.state;if(s.spawnClosed||amount<=0)return;const before=s.kouki;s.kouki=Math.min(s.level.koukiTarget,s.kouki+amount);if(before<s.level.koukiTarget&&s.kouki>=s.level.koukiTarget){s.spawnClosed=true;this.sound('special');this.showToast(this.l('光辉满格！清空余球','光輝満タン！残りを消そう'),2800);}
    }
    awardRemoval(count,mult,where){
      const s=this.state,points=count*100*mult;s.score+=points;const meter=Math.max(1,Math.round(count*(1+(mult-1)*.75)));this.addKouki(meter);
      const label=`+${points}${mult>1?` ×${mult}`:''}`;if(where?.atXY)this.addPopupAtXY(where.atXY.x,where.atXY.y,label);else this.addPopupAtS(where?.atS||0,label);
    }
    onShotResolved(success,gapCount,x,y,shotType='normal'){
      const s=this.state;if(!s||s.phase!=='play')return;
      if(success){
        s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak);
        const streakScore=Math.min(600,Math.max(0,(s.streak-1)*75));
        if(streakScore)s.score+=streakScore;

        if(gapCount>0){
          const double=gapCount>=2,bonus=double?1200:500,meter=double?10:5;
          s.score+=bonus;this.addKouki(meter);
          this.addPopupAtXY(x,y,double?`${this.l('双重穿缝','ダブルギャップ')} +${bonus}`:`${this.l('穿缝射击','ギャップショット')} +${bonus}`);
          this.sound('special');
        }

        if(s.levelNo>=2&&shotType!=='bomb'){
          s.bombCharge=Math.min(5,s.bombCharge+1);
          if(s.bombCharge>=5&&s.pendingBomb<2){
            s.bombCharge=0;
            s.pendingBomb++;
            this.addPopupAtXY(this.redbeanGround().x,this.redbeanGround().y-40,this.l('炸弹已就绪！','爆弾、準備完了！'));
            this.sound('special');
          }
        }
      }else{
        s.streak=0;
      }

      if(s.deferNextAmmo){
        s.deferNextAmmo=false;
        if(s.balls.length>0){
          s.next=this.randAmmo();
          if(s.next?.type==='bomb'&&!this.save.bombTutorialSeen){
            this.showToast(this.l('炸弹已就绪！','爆弾、準備完了！'),3000);
            this.save.bombTutorialSeen=true;this.persist();
          }
        }
      }
    }
    updateProjectile(dt,motionStart,useVisualEnd=false){
      const s=this.state,p=s.projectile;if(!p)return;
      if(p.pendingImpact){if(s.retractAnim)return;const idx=s.balls.indexOf(p.pendingImpact.ball);if(idx>=0){p.pendingImpact=null;this.chain.beginInsert(p,idx);return;}p.pendingImpact=null;}
      const p0={x:p.x,y:p.y},p1={x:p.x+p.vx*dt,y:p.y+p.vy*dt};this.trackGapCrossings(p,p0,p1);let hit=-1,hitT=Infinity;
      for(let i=0;i<s.balls.length;i++){const b=s.balls[i],s0=motionStart.get(b)??(useVisualEnd?this.chain.visualS(b):b.s),s1=useVisualEnd?this.chain.visualS(b):b.s;if(this.isOccludedS((s0+s1)*.5))continue;const q0=G.pathPoint(s.path,s0),q1=G.pathPoint(s.path,s1),t=G.movingCircleHitT(p0,p1,q0,q1,C.BALL_R*2-1);if(t!==null&&t<hitT){hitT=t;hit=i;}}
      if(hit>=0){p.x=p0.x+(p1.x-p0.x)*hitT;p.y=p0.y+(p1.y-p0.y)*hitT;if(s.retractAnim){p.pendingImpact={ball:s.balls[hit]};return;}this.chain.beginInsert(p,hit);return;}p.x=p1.x;p.y=p1.y;
      if(p.x<-24||p.x>C.W+24||p.y<-24||p.y>C.H+24){s.projectile=null;this.onShotResolved(false,0,p.x,p.y,p.ball?.type||'normal');}
    }
    updatePopups(dt){const s=this.state;for(const p of s.popups)p.t+=dt;s.popups=s.popups.filter(p=>p.t<p.duration);}
    updateEffects(dt){const s=this.state;for(const e of s.effects)e.t+=dt;s.effects=s.effects.filter(e=>e.t<e.duration);}
    addPopupAtS(pos,text){const p=G.pathPoint(this.state.path,pos);this.addPopupAtXY(p.x,p.y,text);}
    addPopupAtXY(x,y,text){this.state.popups.push({x,y,text,t:0,duration:.76});}
    update(dt){
      const s=this.state;if(!s||s.phase!=='play'||s.paused||this.fullscreenCountdownRemaining()>0||!this.rotateGate.classList.contains('hidden'))return;s.elapsed+=dt;s.fireCooldown=Math.max(0,s.fireCooldown-dt);if(s.fireBuffer){s.fireBuffer.ttl-=dt;if(s.fireBuffer.ttl<=0)s.fireBuffer=null;}this.updateRedbeanCourier(dt);this.updatePopups(dt);this.updateEffects(dt);this.updateGapWindows(dt);this.consumeFireBuffer();
      if(s.insertAnim){this.chain.updateInsert(dt);if(s.insertAnim)return;}
      let motion,useVisual=false;
      if(s.retractAnim){motion=new Map(s.balls.map(b=>[b,this.chain.visualS(b)]));this.chain.updateRetraction(dt);useVisual=true;}else motion=this.chain.advance(dt);
      this.updateProjectile(dt,motion,useVisual);
      if(s.balls.some(b=>this.chain.visualS(b)>=s.path.total-C.BALL_R)){this.failLevel();return;}
      if(s.spawnClosed&&s.balls.length===0&&!s.projectile&&!s.insertAnim&&!s.retractAnim){this.clearLevel();}
    }
    sound(k){this.audio.play(k);}
    failLevel(){const s=this.state;if(!s||s.phase!=='play')return;s.phase='fail';s.fireBuffer=null;this.sound('fail');s.redbean.travel=null;s.redbean.carriedPos=null;s.redbean.mode='fail';s.redbean.visible=true;this.showOverlay(this.l('球链进洞了','ゲームオーバー'),this.l('换个角度，再试一次！','狙いを変えて、もう一度！'),[[this.l('再来一次','もう一度'),()=>this.startLevel(s.levelNo)],[this.l('选择路线','コース選択'),()=>this.returnToMenu()]]);}
    clearLevel(){const s=this.state;if(!s||s.phase!=='play')return;s.current=null;s.next=null;s.fireBuffer=null;s.projectile=null;s.phase='clear';this.sound('clear');s.redbean.travel=null;s.redbean.carriedPos=null;s.redbean.mode='clear';s.redbean.visible=true;const n=s.levelNo;this.save.scores[n]=Math.max(this.save.scores[n]||0,Math.round(s.score));this.save.progressLevel=Math.max(this.save.progressLevel,Math.min(C.LEVELS.length,n+1));this.persist();const sub=n===8?this.l('八条路线，全都通关！','全8コース、クリア！'):this.l(`得分 ${Math.round(s.score)}  ·  最高连击 ${s.bestStreak}`,`スコア ${Math.round(s.score)}  ·  最大コンボ ${s.bestStreak}`),buttons=[];if(n<C.LEVELS.length)buttons.push([this.l('下一关','次のステージ'),()=>this.startLevel(n+1)]);buttons.push([this.l('选择路线','コース選択'),()=>this.returnToMenu()]);this.showOverlay(this.l('过关啦！','クリア！'),sub,buttons);}
    pauseGame(){const s=this.state;if(!s||s.phase!=='play'||s.paused)return;s.paused=true;s.fireBuffer=null;this.showPauseOverlay();}
    resumeGame(){if(!this.state?.paused)return;this.state.paused=false;this.hideOverlay();this.lastTs=performance.now();this.acc=0;}
    showPauseOverlay(reason='pause'){
      const canRestore=this.isTouchDevice()&&!this.isFullscreenLike()&&this.canRequestFullscreen();
      const buttons=[];
      const lost=this.fullscreenRecoveryPending||reason==='fullscreen-lost',err=reason==='fullscreen-error';
      if(canRestore&&lost){
        buttons.push([this.l('全屏继续','全画面で再開'),()=>this.restoreFullscreenFromGesture(true)]);
      }else{
        buttons.push([this.l('继续','続ける'),()=>{this.fullscreenRecoveryPending=false;this.resumeGame();}]);
      }
      buttons.push([this.l('重新开始','やり直す'),()=>this.startLevel(this.state.levelNo)],[`${this.l('音效','効果音')} ${this.save.sound?'ON':'OFF'}`,()=>{this.save.sound=!this.save.sound;this.audio.setEnabled(this.save.sound);this.persist();this.showPauseOverlay(reason);}]);
      buttons.push([this.l('选择路线','コース選択'),()=>this.returnToMenu()]);
      const subtitle=err?this.l('请确认浏览器允许全屏，然后再试一次。','ブラウザの全画面許可を確認して、もう一度タップしてください。'):lost?(canRestore?this.l('点击“全屏继续”返回横屏游戏。','「全画面で再開」を押して横画面のゲームへ戻ってください。'):this.l('当前设备无法恢复全屏，可以直接继续。','この端末では全画面へ戻れなかったため、そのまま続けられます。')):'';
      this.showOverlay(lost?this.l('全屏已退出','全画面が解除されました'):this.l('暂停中','一時停止'),subtitle,buttons);
      this.updateFullscreenRecoveryUI();
    }
    showOverlay(title,sub,buttons){this.tutorial.classList.add('hidden');this.overlay.classList.remove('help-overlay');this.overlayTitle.textContent=title;this.overlaySub.textContent=sub||'';this.overlayButtons.innerHTML='';for(const [label,fn]of buttons){const b=document.createElement('button');b.textContent=label;b.onclick=fn;this.overlayButtons.appendChild(b);}this.overlay.classList.remove('hidden');}
    hideOverlay(){this.overlay.classList.add('hidden');this.overlay.classList.remove('help-overlay');this.updateFullscreenRecoveryUI();}
    showToast(message,ms=2500){this.tutorial.textContent=message;this.tutorial.classList.remove('hidden');clearTimeout(this.showToast._t);this.showToast._t=setTimeout(()=>this.tutorial.classList.add('hidden'),ms);}
    updateOrientationGate(){
      if(!this.gameScreen.classList.contains('active')){this.rotateGate.classList.add('hidden');return;}
      const portrait=this.isPortrait(),show=this.isTouchDevice()&&portrait;
      this.rotateGate.classList.toggle('hidden',!show);
      this.rotateRestoreBtn.classList.toggle('hidden',!(show&&!this.isFullscreenLike()&&this.canRequestFullscreen()));
    }
    updateFullscreenRecoveryUI(){
      if(!this.fullscreenRestoreBtn)return;
      const show=this.isTouchDevice()&&this.gameScreen.classList.contains('active')&&!!this.state&&this.state.phase==='play'&&!this.isPortrait()&&!this.isFullscreenLike()&&this.canRequestFullscreen()&&this.overlay.classList.contains('hidden');
      this.fullscreenRestoreBtn.classList.toggle('hidden',!show);
    }
    frame(ts){
      let realDt=Math.min(.10,Math.max(0,(ts-this.lastTs)/1000));this.lastTs=ts;if(this.state)this.input.applyAim();this.acc+=realDt;let steps=0;
      while(this.acc>=C.SIM_DT&&steps<C.MAX_STEPS){this.update(C.SIM_DT);this.acc-=C.SIM_DT;steps++;}if(steps===C.MAX_STEPS&&this.acc>C.SIM_DT*2)this.acc=0;if(this.state)this.renderer.draw();requestAnimationFrame(t=>this.frame(t));
    }
  }
  const game=new Game();window.__DOUCHENG__={version:C.VERSION,game};
})();
