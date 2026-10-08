import test from 'node:test';
import assert from 'node:assert/strict';
import { validEncounter, socialStep, socialTarget, socialAligned, socialFrame, socialNearby } from '../src/features/spirits/socialModel.ts';
const encounter = { members: ['mayank','pihu'], started: 10000, x: 250, y: 200, size: 128, action: 'hug' };
test('encounters require both known partners, finite coordinates and a valid shared clock', () => {
 assert.equal(validEncounter(encounter,'pihu',11000),true);
 for (const broken of [{...encounter,members:['pihu','pihu']},{...encounter,members:['other','pihu']},{...encounter,x:NaN},{...encounter,size:300},{...encounter,action:'unknown'},{...encounter,started:20000}]) assert.equal(validEncounter(broken,'pihu',11000),false);
 assert.equal(validEncounter(encounter,'mayank',1000000),true);
});
test('both characters converge on adjacent equal-height windows without crossing', () => {
 const left=socialTarget(encounter,'mayank'),right=socialTarget(encounter,'pihu');
 assert.equal(right.x-left.x,128);assert.equal(left.y,right.y);
 let a={x:160,y:215},b={x:340,y:185};
 for(let i=0;i<20;i++){ const x=socialStep(a,left,100),y=socialStep(b,right,100);a={x:a.x+x.x,y:a.y+x.y};b={x:b.x+y.x,y:b.y+y.y};assert.ok(a.x<b.x); }
 assert.ok(Math.hypot(a.x-left.x,a.y-left.y)<0.5);assert.ok(Math.hypot(b.x-right.x,b.y-right.y)<0.5);
 const self={id:'mayank',...a,size:128,busy:false,at:10000},peer={id:'pihu',...b,size:128,busy:false,at:10000};
 assert.equal(socialAligned(self,peer,encounter),true);
 assert.equal(socialAligned(self,{...peer,x:peer.x+15},encounter),false);
 assert.equal(socialAligned(self,{...peer,size:160},encounter),false);
});
test('slow sampling cannot teleport or overshoot a target', () => {
 assert.ok(Math.hypot(...Object.values(socialStep({x:0,y:0},{x:100,y:100},5000)))<=24.001);
 assert.deepEqual(socialStep({x:0,y:0},{x:2,y:0},200),{x:2,y:0});
});
test('pair frames use the same wall clock and hold the final pose', () => {
 assert.deepEqual([0,699,700,1400,2100,10000].map(ms=>socialFrame(1000,1000+ms)),[0,0,1,2,3,3]);
});

test('conversation mouth cycles repeat while greeting contact holds', () => {
 assert.deepEqual([0,400,800,1200,1600].map(ms=>socialFrame(1000,1000+ms,true)),[0,1,2,3,0]);
});

test("social sessions stay nearby until a companion is moved away", () => {
 const self={x:100,y:200,size:128};
 assert.equal(socialNearby(self,{x:228,y:200,size:128}),true);
 assert.equal(socialNearby(self,{x:400,y:200,size:128}),false);
 assert.equal(socialNearby(self,{x:228,y:500,size:128}),false);
});
