import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {bridgeMotion} from '../js/game/bridgeMotion.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url=process.env.GAME_URL || 'http://127.0.0.1:8765';
for(const fps of [15,30,60,144]) {
  const m=bridgeMotion(4,13,268);
  for(let i=0;i<fps*10;i++)m.update(1/fps);
  assert.ok(Math.abs(m.z-134)<1e-7);assert.equal(m.speed,13);
  m.mode='floor';m.update(1/fps);assert.ok(m.speed>13);
  const held=bridgeMotion(240,13,268);
  for(let i=0;i<fps*30;i++)held.update(1/fps);
  assert.equal(held.z,262);assert.equal(held.speed,0);
  held.mode='floor';held.update(1/fps);assert.ok(held.speed>0);assert.ok(held.z>262);
}
console.log('PASS bridge kinematics at 15, 30, 60, 144 FPS');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
const results=[];
try {
  for(const fps of [15,30,60,144]) {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // Export private scene routines only in this test response; shipping API stays unchanged.
    await page.route('**/js/story/night4.js*',async route=>{
      const res=await route.fetch();await route.fulfill({response:res,body:(await res.text())+'\nexport {spawnBoardingCrowd,boardQueue,bridge,sink,plunge,riseCabinWater};'});
    });
    await page.goto(url+'/?test&night=4');
    await page.waitForFunction(()=>window.__lastStop);
    const result=await page.evaluate(async fps=>{
      window.__manual=true;
      const L=window.__lastStop,{g,bus,drive,player,camera,scene,input,director}=L;
      const THREE=await import('three');
      const {people}=await import('/js/world/people.js');
      const N=await import('/js/story/night4.js');
      const {route}=await import('/js/world/route.js');
      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
      const step=async()=>{people.update(1/fps);director.update(1/fps);bus.update(1/fps,{speed:drive.speed,clock:'00:19',late:0,steer:0});scene.updateMatrixWorld(true);for(let k=0;k<8;k++)await Promise.resolve()};
      // Camera limit crossing used to wrap from one rear shoulder to the other.
      player.sitIn(bus.group,bus.driverEye);
      player.state.yaw=Math.PI+2.65;player.state.viewYaw=player.state.yaw;
      player.update(1/fps,{dx:-300,dy:0,down:()=>false,hit:()=>false});
      check(player.state.yaw===Math.PI+2.7,'camera wrapped at rear limit');
      check(player.state.viewYaw>Math.PI+2.6,'camera moved to opposite shoulder');
      player.lookAtSoon(new THREE.Vector3(100,2,100));
      player.update(1/fps,{dx:0.1,dy:0,down:()=>false,hit:()=>false});
      check(!player.state.look,'slow input did not cancel auto pan');
      input.dx=900;input.dy=900;player.walkAt(new THREE.Vector3(0,1.7,0));
      check(input.dx===0&&input.dy===0,'stale delta survived transition');
      Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>input.canvas});
      document.dispatchEvent(new Event('pointerlockchange'));
      input.init(input.canvas);
      dispatchEvent(new MouseEvent('mousemove',{movementX:4,movementY:-2}));
      check(input.dx===4*input.sensitivity&&input.dy===-2*input.sensitivity,'duplicate or incorrect mouse delta');
      dispatchEvent(new Event('blur'));
      check(input.dx===0&&input.dy===0&&input.keys.size===0,'blur retained input');
      delete document.pointerLockElement;
      document.dispatchEvent(new Event('pointerlockchange'));
      const counts=[];
      for(const carmenRode of [false,true]) {
        g.despawnAll();g.flags.carmenRode=carmenRode;
        g.props.mystery.place(1200);drive.d=1196.1;drive.park();
        if(carmenRode){g.spawn('carmen','carmen');g.seat('carmen','R1')}
        const roster=N.spawnBoardingCrowd(g,1200);
        check(roster.length+(carmenRode?1:0)===14,'incorrect passenger count');
        const positions=new Map(),entered=new Set();let maxStep=0,minGap=Infinity;
        roster.forEach(([key])=>positions.set(key,g.actor(key).root.getWorldPosition(new THREE.Vector3())));
        let done=false;const boarding=N.boardQueue(g,roster).then(()=>done=true);
        let frames=0;
        while(!done&&frames<fps*180){
          await step();frames++;
          const active=[];
          for(const [key] of roster){const p=g.actor(key),at=p.root.getWorldPosition(new THREE.Vector3());
            maxStep=Math.max(maxStep,at.distanceTo(positions.get(key)));positions.set(key,at.clone());
            const local=bus.group.worldToLocal(at.clone());
            if(local.x>-1.3&&local.z>3.6&&local.z<5.7)entered.add(key);
            if(p.mode==='walk')active.push(at);
          }
          for(let i=0;i<active.length;i++)for(let j=0;j<i;j++)minGap=Math.min(minGap,active[i].distanceTo(active[j]));
        }
        check(done,'boarding softlock '+fps+' FPS: '+roster.map(([k])=>[k,g.actor(k).mode,g.actor(k).root.position.toArray()]));
        await boarding;
        check(entered.size===roster.length,'passenger bypassed entrance');
        check(roster.every(([k])=>g.actor(k).mode==='sit'),'missing seated passenger');
        check(maxStep<0.3,'visible passenger teleport '+maxStep);
        check(minGap>0.65,'passenger overlap '+minGap);
        counts.push({carmenRode,total:roster.length+(carmenRode?1:0),seconds:frames/fps,maxStep,minGap});
      }
      const water=[];let waterDone=false;
      N.riseCabinWater({...g,bus:{setWater:v=>water.push(v)}}).then(()=>waterDone=true);
      for(let i=0;i<fps*6&&!waterDone;i++)await step();
      check(waterDone&&water.at(-1)===0.25,'water rise incomplete');
      check(water.every((v,i)=>i===0||v>=water[i-1]&&v-water[i-1]<0.01),'water jumped or reversed');
      const bridges=[];
      for(const floor of [false,true]) {
        drive.d=1196.1;drive.auto(14);bus.setWater(0.25);
        g.flags.rheeTruth=true;
        let done=false,error=null,selected=false,choiceSpeed=0,firstSpeed=null,revealed=false,hitWater=false,underwater=false;
        const spoken=[];
        const shim={...g,
          say:async(who,text)=>{spoken.push(text);await g.wait(1800)},
          think:()=>g.wait(2500),
          fade:async(to,ms)=>{if(to===0&&!revealed){revealed=true;check(drive.speed===13,'bridge revealed stopped')}await g.wait(ms)},
          choose:async options=>{selected=true;choiceSpeed=drive.speed;return floor?options.length-1:1},
          sfx:(name)=>{if(name==='plunge')hitWater=true},
          faceScare:()=>g.wait(10),
          underwater:on=>{underwater=on;g.underwater(on)},
          park:()=>{check(!drive.state.detached,'route not restored');check(!underwater,'underwater effect leaked');throw Error('SCENE_COMPLETE')},
        };
        N.bridge(shim).then(()=>done=true).catch(e=>{error=e.message;done=true});
        let frames=0;
        while(!done&&frames<fps*150){
          const before=bus.group.position.z;
          await step();frames++;
          check(Number.isFinite(bus.group.position.y+bus.group.position.z+drive.speed),'nonfinite crash physics');
          if(floor&&selected&&firstSpeed===null&&drive.speed!==choiceSpeed)firstSpeed=drive.speed;
          if(floor&&selected&&!hitWater)check(bus.group.position.z>before,'Floor It stopped motion');
        }
        check(done&&error==='SCENE_COMPLETE','bridge failed '+error);
        check(floor?g.flags.obeyedN4:g.flags.brakedN4&&g.flags.defiedRhee,'choice outcome lost');
        if(floor){check(firstSpeed>choiceSpeed,'Floor It did not accelerate immediately');check(hitWater,'missing plunge');check(spoken.includes('Stay with us.'),'underwater dialogue missing')}
        bridges.push({floor,seconds:frames/fps,choiceSpeed,firstSpeed,hitWater});
      }
      return {fps,counts,waterSamples:water.length,bridges};
    },fps);
    assert.deepEqual(errors,[]);results.push(result);console.log('PASS',JSON.stringify(result));
    await page.close();
  }
} finally {await browser.close()}
if(process.env.REPORT_PATH)await fs.writeFile(process.env.REPORT_PATH,JSON.stringify(results,null,2));

