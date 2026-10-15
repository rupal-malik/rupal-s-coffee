(function(){
  var $=function(s){return document.querySelector(s)};
  var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};

  /* static drawing helpers (work even if GSAP fails to load) */
  (function drawCoil(){
    var d='M128 308', y=308, i;
    for(i=0;i<9;i++){ d+=' C128 '+(y+7)+' 160 '+(y+7)+' 160 '+(y+12)+' C160 '+(y+19)+' 128 '+(y+19)+' 128 '+(y+24); y+=24; }
    $('#coil').setAttribute('d',d); $('#coilBack').setAttribute('d',d);
  })();
  (function drawBurst(){
    var pts=[],n=14,i,r,a;
    for(i=0;i<n*2;i++){ r=i%2?44:70; a=Math.PI*i/n; pts.push((Math.cos(a)*r*1.12).toFixed(1)+','+(Math.sin(a)*r*.9).toFixed(1)); }
    $('#burst').setAttribute('points',pts.join(' '));
  })();

  /* viewBox follows the window shape: whole kitchen when wide, machine close-up when tall */
  var wide=window.matchMedia('(min-aspect-ratio: 7/5)');
  function fit(){ $('#art').setAttribute('viewBox', wide.matches ? '0 0 1000 720' : '190 60 620 660'); }
  fit(); (wide.addEventListener?wide.addEventListener('change',fit):wide.addListener(fit));

  window.Rupal=window.Rupal||{};
  if(!window.gsap||!window.ScrollTrigger){ return; }
  gsap.registerPlugin(ScrollTrigger);

  var STEPS=[0,1.0,3.0,5.8,10.4,13.8];
  var TOTAL=16;
  var cards=$$('.card'), bar=$('#bar'), txt=$('#meterTxt');
  var active=0;

  var rig=window.Rupal.rig;
  var paper=rig('#paper',310,330), mound=rig('#mound',310,308), pourS=rig('#pourStream',514,484),
      badge=rig('#badge',0,0), pouch=rig('#pouch',0,0), carafe=rig('#carafe',310,582), click=rig('#click',0,0);
  paper.o.y=-135; paper.o.r=-6; paper.ap();
  mound.o.sy=0; mound.ap();
  pourS.o.sy=0; pourS.ap();
  badge.o.sx=badge.o.sy=0; badge.ap();
  click.o.sx=click.o.sy=.2; click.ap();

  var tl=gsap.timeline({paused:true,defaults:{ease:'power1.inOut'},
    onUpdate:function(){
      var t=tl.time(), p=tl.progress(), s=0, i;
      for(i=0;i<STEPS.length;i++){ if(t>=STEPS[i]) s=i; }
      if(s!==active){ cards[active].classList.remove('on'); cards[s].classList.add('on'); active=s; }
      bar.style.width=(p*100).toFixed(1)+'%';
      txt.innerHTML = p<0.015 ? 'Scroll to brew <i class="arrow">&darr;</i>' : p>0.985 ? 'Enjoy!' : 'Brewing '+Math.round(p*100)+'%';
    }});

  function T(g,v,pos){ v.onUpdate=g.ap; return tl.to(g.o,v,pos); }

  /* 1. filter drops into the basket */
  T(paper,{y:0,r:0,duration:1.8,ease:'power2.out'},1.1);

  /* 2. the bag swings over and the grounds fall in */
  T(pouch,{x:-104,y:-170,r:-110,duration:1.1},3.0);
  T(pouch,{r:-120,duration:.25,yoyo:true,repeat:3,ease:'sine.inOut'},4.1);
  tl
    .to('#grounds',{keyframes:{y:[0,18,36],opacity:[0,1,0],easeEach:'none'},duration:.55,stagger:.07},4.15)
    ;
  T(mound,{sy:1,duration:1.3,ease:'power1.out'},4.3);
  T(pouch,{x:230,y:-250,r:12,duration:.9},5.2);
  tl.to('#pouch',{opacity:0,duration:.6},5.5);

  /* 3. click, copper glows, water starts to move */
  T(click,{sx:1,sy:1,r:4,duration:.25,ease:'back.out(3)'},5.9);
  tl.to('#click',{opacity:1,duration:.1},5.9)
    .to('#click',{opacity:0,duration:.35},6.7)
    .to('#light',{attr:{fill:'#ffd24a'},duration:.2},5.9)
    .to('#coilGlow',{opacity:.95,duration:.7},6.0)
    .to('#coil',{stroke:'#ff9d2e',duration:.7},6.0)
    .to('#hotsteam',{opacity:1,duration:.5},6.8)
    .to('#drops',{opacity:1,duration:.3},6.9);

  /* 4. slow drip: reservoir empties, carafe fills */
  tl.to('#water',{attr:{y:226,height:32},duration:3.4,ease:'none'},7.0)
    .to('#wave',{y:114,duration:3.4,ease:'none'},7.0)
    .to('#stream',{opacity:1,duration:.4},7.3)
    .to('#carLiquid',{attr:{y:476,height:108},duration:3.0,ease:'none'},7.6)
    .to('#carLiquidTop',{y:-108,opacity:1,duration:3.0,ease:'none'},7.6)
    .to(['#stream','#drops','#hotsteam'],{opacity:0,duration:.4},10.2)
    .to('#coilGlow',{opacity:.2,duration:.5},10.2)
    .to('#coil',{stroke:'#c8692b',duration:.5},10.2);

  /* 5. lift the carafe and pour into the mug */
  T(carafe,{x:60,y:-35,r:42,duration:1.2},10.5);
  T(pourS,{sy:1,duration:.35,ease:'none'},11.7);
  tl.to('#pourStream',{opacity:1,duration:.05},11.7)
    .to('#mugCoffee',{opacity:1,duration:.4},12.0)
    .to('#carLiquid',{attr:{y:540,height:44},duration:1.6,ease:'none'},11.9)
    .to('#carLiquidTop',{y:-44,duration:1.6,ease:'none'},11.9)
    .to('#pourStream',{opacity:0,duration:.3},13.5)
    ;
  T(carafe,{x:0,y:0,r:0,duration:1.0},13.6);

  /* 6. ready */
  tl.to('#mugSteam',{opacity:1,duration:.6},14.2)
    ;
  T(badge,{sx:1,sy:1,r:-4,duration:.7,ease:'back.out(2.4)'},14.4);
  $$('.conf').forEach(function(el,i){
    var a=(-150+i*60)*Math.PI/180, d=88+(i%2)*26;
    tl.fromTo(el,{x:0,y:0,opacity:0,scale:.2},{x:Math.cos(a)*d*1.15,y:Math.sin(a)*d*.8,opacity:1,scale:1,rotation:i*40-90,duration:.9,ease:'back.out(1.8)'},14.5+i*.04);
  });
  tl.to('#beansBg',{y:-70,duration:TOTAL,ease:'none'},0);
  tl.to({},{duration:.01},TOTAL);

  var st=ScrollTrigger.create({trigger:'#story',start:'top top',end:'bottom bottom',animation:tl,scrub:.5,invalidateOnRefresh:true});

  /* nav + logo jump to a moment in the story */
  var reduce=window.Rupal.reduceMotion();
  $$('[data-go]').forEach(function(el){
    el.addEventListener('click',function(e){
      e.preventDefault();
      var t=parseFloat(el.getAttribute('data-go'))||0;
      var y=st.start+(st.end-st.start)*(t/TOTAL);
      window.scrollTo({top:y,behavior:reduce?'auto':'smooth'});
    });
  });
  if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(function(){ ScrollTrigger.refresh(); }); }
  window.Rupal.story={tl:tl,TOTAL:TOTAL,st:st};
})();
