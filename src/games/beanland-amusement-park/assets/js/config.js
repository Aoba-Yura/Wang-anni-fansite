/* 豆城光辉游乐园 v1.9.3-P1：版本、调色板、关卡路线与玩法常量 */
(() => {
  'use strict';
  const P = Object.freeze({
    grass:'#74A953', grassAlt:'#89BA5E', grassDark:'#477554', grassDeep:'#365D4C', grassLight:'#B9D978', grassCool:'#507465',
    soil:'#967059', path:'#D3B27B', pathHi:'#F1D99A', pathMid:'#C69B68', pathDeep:'#66535A',
    stone:'#A9A4A5', stoneLight:'#E8DEC9', stoneMid:'#C7C0B4', stoneDark:'#4F5268', stoneCool:'#77758A',
    ink:'#34364A', ink2:'#505268', cream:'#FFF1CF', gold:'#F0C85B', pink:'#E34B82', orange:'#EDA72B',
    blue:'#54A9E1', green:'#6B9F4B', purple:'#6937A5', white:'#FFF9E8', paper:'#F8E3B9', paper2:'#EBCB96', wood:'#98603D',
    shadow:'#42495E', water:'#67B7C8', moss:'#568653'
  });
  const levels = [
    // 1: wide hook — basic aiming, but already asks the player to rotate left/right instead of only shooting upward.
    {pressureSec:76,koukiTarget:56,colors:4,targetSec:85,path:[[40,110],[190,90],[405,100],[645,95],[840,145],[865,245],[790,315],[690,390],[610,425]]},
    // 2: broad C / inward hook — near and far targets coexist around the fixed launcher.
    {pressureSec:85,koukiTarget:75,colors:4,targetSec:100,path:[[920,95],[760,85],[580,110],[410,165],[230,225],[110,255],[90,300],[165,335],[280,320],[445,270],[615,225],[770,240],[850,300],[810,390],[660,455],[460,465],[200,430]]},
    // 3: switchback skill check — preserves the pressure profile that already tested well.
    {pressureSec:87,koukiTarget:132,colors:4,targetSec:115,path:[[35,95],[245,90],[505,108],[760,125],[855,180],[865,255],[775,315],[655,305],[545,240],[465,175],[325,160],[190,225],[135,315],[210,400],[340,445],[500,450],[675,475],[830,465]]},
    // 4: compact hook / gap-shot lesson — multiple sight lines into the inside of the route.
    {pressureSec:81,koukiTarget:143,colors:4,targetSec:130,path:[[40,440],[170,425],[210,300],[210,175],[320,110],[545,98],[765,145],[790,285],[770,425],[670,475]]},
    // 5: nested curve — nearby but non-adjacent route sections reward spatial bomb use without a self-crossing track.
    {pressureSec:75,koukiTarget:160,colors:5,targetSec:145,path:[[40,95],[310,85],[680,100],[850,160],[870,310],[815,445],[700,475],[635,415],[650,300],[565,205],[405,170],[260,205],[200,310],[215,430],[305,485]]},
    // 6: butterfly — left/right attention switching around one permanent launcher position.
    {pressureSec:79,koukiTarget:182,colors:5,targetSec:160,path:[[930,190],[720,78],[555,110],[400,175],[375,230],[425,275],[545,270],[670,270],[730,305],[775,410],[690,475],[535,490],[390,455],[310,345],[225,225],[110,190],[60,260],[90,365],[170,445],[280,475]]},
    // 7: dense switchback — close parallel sections make world-space bombs and long-angle shots matter.
    {pressureSec:84,koukiTarget:218,colors:5,targetSec:175,path:[[40,125],[185,90],[315,140],[330,235],[220,280],[185,390],[260,475],[365,430],[395,315],[445,220],[565,180],[690,225],[670,325],[715,450],[815,465],[865,370],[800,290],[755,220],[800,145],[900,190]]},
    // 8: final composite — switchbacks + side loop + central sight-line pressure, still a single track.
    {pressureSec:91,koukiTarget:260,colors:5,targetSec:195,path:[[925,100],[740,85],[490,95],[225,115],[100,160],[95,225],[190,230],[340,205],[460,160],[545,165],[675,190],[785,275],[785,375],[675,465],[530,480],[390,455],[270,385],[210,325],[150,305],[95,330],[65,390],[85,460],[160,495],[210,450],[255,385],[330,320]],crossingMode:'earlier-over'}
  ];
  window.DC = window.DC || {};
  window.DC.cfg = Object.freeze({
    VERSION:'1.9.3-P1-SPLIT-PROJECT', W:960, H:540, TILE:32, BALL_R:14, BALL_DIAM:28, BALL_SPACING:29,
    PROJECTILE_SPEED:720, INSERT_DURATION:.085, FULLSCREEN_COUNTDOWN_MS:5000,
    RETRACT_SPEED:520, RETRACT_MIN:.09, RETRACT_MAX:.24, RETRACT_PRE:.075, RETRACT_POST:.020,
    BOMB_RADIUS:64, FIRE_BUFFER:.55, FIRE_RECOVERY:.24, GAP_SAMPLE:8, SIM_DT:1/120, MAX_STEPS:5,
    STORAGE_KEY:'doucheng-kouki-save', LEGACY_KEYS:['doucheng-kouki-v0.1'],
    LAUNCHER:Object.freeze({x:480,y:373,ballSocket:{x:480,y:365}}),
    REDBEAN:Object.freeze({size:64,idleGround:{x:420,y:440},idleBallOffset:{x:0,y:-8},rideGroundOffset:{x:0,y:-11},pivot:{x:32,y:62}}),
    RELOAD:Object.freeze({deliverEnd:.15,departEnd:.21,shopEnd:.21,returnEnd:.49}),
    PALETTE:P, COLORS:[P.pink,P.orange,P.blue,P.green,P.purple], LEVELS:levels
  });
})();
