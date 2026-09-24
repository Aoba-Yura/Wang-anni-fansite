/* 豆城光辉游乐园 v1.9.3-P1：图片资源加载与画布资源生成 */
(() => {
  'use strict';
  function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').imageSmoothingEnabled=false;return c;}
  function loadImage(src){const i=new Image();i.decoding='async';i.src=src;return i;}
  function imageReady(i){return i.complete&&i.naturalWidth?Promise.resolve(i):new Promise(resolve=>{i.addEventListener('load',()=>resolve(i),{once:true});i.addEventListener('error',()=>resolve(i),{once:true});});}
  function buildAssets(){
    const a={
      balls:['assets/images/ball-pink.png','assets/images/ball-orange.png','assets/images/ball-blue.png','assets/images/ball-green.png','assets/images/ball-purple.png'].map(loadImage),
      bomb:loadImage('assets/images/bomb.png'),redbean:loadImage('assets/images/redbean-sheet.png'),
      grass:['assets/images/grass-1.png','assets/images/grass-2.png','assets/images/grass-3.png','assets/images/grass-4.png','assets/images/grass-5.png','assets/images/grass-6.png'].map(loadImage),
      flowers:['assets/images/flower-1.png','assets/images/flower-2.png','assets/images/flower-3.png','assets/images/flower-4.png'].map(loadImage),
      rocks:['assets/images/rock-1.png','assets/images/rock-2.png','assets/images/rock-3.png'].map(loadImage),
      clover:loadImage('assets/images/clover.png'),tuft:loadImage('assets/images/grass-tuft.png'),bush:loadImage('assets/images/bush.png'),
      tree:loadImage('assets/images/tree.png'),sakura:loadImage('assets/images/sakura-tree.png'),hydrangea:loadImage('assets/images/hydrangea.png'),lantern:loadImage('assets/images/lantern.png'),gardenPond:loadImage('assets/images/garden-pond.png'),bunting:loadImage('assets/images/bunting.png'),launcherPlaza:loadImage('assets/images/launcher-plaza.png'),bench:loadImage('assets/images/bench.png'),sign:loadImage('assets/images/sign.png'),menuBg:loadImage('assets/images/menu-background.png'),
      stump:loadImage('assets/images/stump.png'),fence:loadImage('assets/images/fence.png'),cobbles:[loadImage('assets/images/cobble-1.png'),loadImage('assets/images/cobble-2.png')],leaf:loadImage('assets/images/leaf.png'),
      launcherBase:loadImage('assets/images/launcher-base.png'),launcherBarrel:loadImage('assets/images/launcher-barrel.png'),hole:loadImage('assets/images/hole.png')
    };
    const imgs=[...a.balls,a.bomb,a.redbean,...a.grass,...a.flowers,...a.rocks,a.clover,a.tuft,a.bush,a.tree,a.sakura,a.hydrangea,a.lantern,a.gardenPond,a.bunting,a.launcherPlaza,a.bench,a.sign,a.menuBg,a.stump,a.fence,...a.cobbles,a.leaf,a.launcherBase,a.launcherBarrel,a.hole];
    a.ready=Promise.all(imgs.map(imageReady));return a;
  }
  window.DC.assets={makeCanvas,buildAssets};
})();
