/* 豆城光辉游乐园 v1.11.0：程序化音效 */
(() => {
  'use strict';
  class AudioEngine {
    constructor(enabled=true){ this.enabled=enabled; this.ctx=null; this.noiseBuffer=null; }
    setEnabled(v){ this.enabled=!!v; }
    ensure(){
      if(!this.enabled) return null;
      if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      if(this.ctx.state==='suspended') this.ctx.resume();
      return this.ctx;
    }
    tone(freq,dur,gain=.045,type='square',endFreq=null,when=0){
      const c=this.ensure(); if(!c) return;
      const t=c.currentTime+when,o=c.createOscillator(),g=c.createGain(); o.type=type; o.connect(g); g.connect(c.destination);
      o.frequency.setValueAtTime(freq,t); if(endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+dur);
      g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0008,t+dur); o.start(t); o.stop(t+dur+.01);
    }
    noise(dur=.08,gain=.025,when=0){
      const c=this.ensure(); if(!c) return;
      if(!this.noiseBuffer){
        const n=Math.floor(c.sampleRate*.25),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
        for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
        this.noiseBuffer=b;
      }
      const t=c.currentTime+when,s=c.createBufferSource(),g=c.createGain(); s.buffer=this.noiseBuffer; s.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0008,t+dur); s.start(t); s.stop(t+dur);
    }
    play(kind){
      if(!this.enabled) return;
      switch(kind){
        case 'shoot': this.tone(390,.04,.035,'square',510); break;
        case 'insert': this.tone(560,.035,.028,'square',680); break;
        case 'pop': this.tone(760,.055,.035,'square',520); this.tone(980,.035,.018,'square',760,.015); break;
        case 'chain': this.tone(900,.07,.038,'square',1180); this.tone(1180,.055,.022,'square',1450,.025); break;
        case 'bomb': this.noise(.14,.055); this.tone(120,.15,.06,'sawtooth',48); break;
        case 'special': this.tone(210,.05,.03,'square',390); this.tone(420,.06,.02,'square',610,.04); break;
        case 'clear': [660,825,990].forEach((f,i)=>this.tone(f,.12,.035,'square',f*1.04,i*.07)); break;
        case 'fail': this.tone(170,.19,.045,'square',82); break;
      }
    }
  }
  window.DC.AudioEngine=AudioEngine;
})();
