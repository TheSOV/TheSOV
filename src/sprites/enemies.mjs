import { makeSprite, ell, tseg, seg, or } from "./raster.mjs";

// Enemies of the contribution level, drawn with the same rasterizer, facing left toward the hero.
// Two frames each; hover marks the ones that float above the ground.
export const ENEMIES=[
  {name:"BUG",hover:0,frames:[0,1].map(f=>makeSprite(26,18,({part})=>{
    for(let l=0;l<3;l++)part(seg(9+l*5,12,7+l*5+(f?1.5:-1.5)*(l%2?1:-1),17,.9),"metal");
    part(ell(14,10,9,6),"purple",{shade:(x,y,i)=>(i>1&&Math.abs(x-15)<.5&&y<13)?1:null});
    part(ell(5.5,10,4.2,4),"metal");
    part(seg(4,7,1,2,.7),"metal");part(seg(6,7,6,1.5,.7),"metal");
    part(ell(3.5,9.5,1.2,1.2),"red",{flat:4});
  }))},
  {name:"FAN SPIKE",hover:1,frames:[0,1].map(f=>makeSprite(24,24,({part})=>{
    part(ell(12,12,11,11),"metal");
    part(ell(12,12,8.3,8.3),"dark",{flat:1});
    for(let q=0;q<4;q++){const a=q*Math.PI/2+f*Math.PI/4;part(tseg(12,12,12+Math.cos(a)*7.5,12+Math.sin(a)*7.5,1.2,2.6),"orange");}
    part(ell(12,12,2.6,2.6),"gold");
    part(ell(12,12,1,1),"red",{flat:4});
  }))},
  {name:"OOM",hover:0,frames:[0,1].map(f=>makeSprite(24,20,({part})=>{
    part(or(ell(12,13+f*.5,11,7-f*.5),ell(12,6+f,5,4.5),ell(18,4+f,2,2.5)),"purple");
    [[8,11],[15,11]].forEach(([ex,ey])=>{part(ell(ex,ey+f,2.4,2.8),"white");part(ell(ex-.6,ey+f+.6,1,1.3),"dark",{flat:1});});
    part((x,y)=>Math.abs(x-12)<3.5&&Math.abs(y-(16+f))<.8,"dark",{flat:1});
  }))},
  {name:"NaN",hover:1,frames:[0,1].map(f=>makeSprite(22,22,({part})=>{
    part((x,y)=>Math.abs(x-11)<=9&&y>=2&&y<=17+Math.sin((x+f*3)*1.2)*1.6&&!(y<5&&Math.abs(x-11)>6.5&&Math.hypot(Math.abs(x-11)-6.5,y-5)>2.5),"blue");
    part(ell(7.5,9,2,2.6),"white");part(ell(14.5,9,2,2.6),"white");
    part(ell(7,9.5,.9,1.2),"dark",{flat:1});part(ell(14,9.5,.9,1.2),"dark",{flat:1});
    part((x,y)=>Math.abs(y-13.5)<.7&&x>8&&x<14&&Math.round(x)%2===0,"dark",{flat:1});
  }))}];
