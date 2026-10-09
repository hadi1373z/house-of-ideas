import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// Build real mesh geometry in Node without importing browser-only orbit controls.
export async function geometryModule(){
 const rewrite=source=>{
  source=source.replace(/import \{OrbitControls\}[^\n]+/,'const OrbitControls=undefined;');
  for(const file of ['./vendor/three.module.js','./model.js','./joystick.js','./navigation.js','./home-interior.js','./idea-display.js','./design-scene.js','./xr.js','./art-city-scene.js','./art-city-navigation.js','./makers-city-scene.js','./math-city-scene.js','./math-city-data.js','./city-facilities.js','./artist-residents.js','./artist-city-editions.js','./residence-scene-v1.js','./residence-data.js'])source=source.replaceAll(file,pathToFileURL(process.cwd()+'/web/'+file.slice(2)).href);
  return source;
 };
 const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const legacy=url(rewrite(await fs.readFile('web/legacy-scene.js','utf8')));
 const inhabited=url(rewrite(await fs.readFile('web/inhabited-scene-v1.js','utf8')).replaceAll('./legacy-scene.js',legacy));
 const source=rewrite(await fs.readFile('web/scene.js','utf8')).replaceAll('./legacy-scene.js',legacy).replaceAll('./inhabited-scene-v1.js',inhabited);
 return import(url(source));
}
