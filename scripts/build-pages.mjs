import fs from 'node:fs/promises';
await fs.mkdir('dist/pages',{recursive:true});
await fs.cp('web','dist/pages',{recursive:true});
let html=await fs.readFile('web/index.html','utf8');
html=html.replace('<body>','<body data-mode="preview">');
html=html.replace('Your house · Your learning','Explore the house · Preview');
await fs.writeFile('dist/pages/index.html',html);
await fs.copyFile('docs/.nojekyll','dist/pages/.nojekyll');
console.log('Built the explorable house preview for GitHub Pages.');
