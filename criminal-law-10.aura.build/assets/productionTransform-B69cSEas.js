function h(e){const c=[...e],i=d(e);return i.some(t=>t.detected)&&p(c,i),l(c,i),f(c,i),c}function d(e){const c=[{type:"unicornstudio",detected:!1,packageName:"unicornstudio-react",version:"2.1.4-1"},{type:"spline",detected:!1,packageName:"@splinetool/react-spline",version:"^2.2.6"},{type:"lottie",detected:!1,packageName:"lottie-react",version:"^2.4.0"},{type:"gsap",detected:!1,packageName:"gsap",version:"^3.12.5"},{type:"three",detected:!1,packageName:"three",version:"^0.160.0"}];return e.forEach(i=>{if(i.type==="file"){const t=i.content.toLowerCase();if(t.includes("data-us-project")||t.includes("unicornstudio")){const n=c.find(s=>s.type==="unicornstudio");if(n){n.detected=!0;const s=i.content.match(/data-us-project=["']([^"']+)["']/);s&&(n.projectId=s[1])}}if(t.includes("spline")||t.includes("@splinetool")){const n=c.find(s=>s.type==="spline");n&&(n.detected=!0)}if(t.includes("lottie")){const n=c.find(s=>s.type==="lottie");n&&(n.detected=!0)}if(t.includes("gsap")){const n=c.find(s=>s.type==="gsap");n&&(n.detected=!0)}if(t.includes("three.js")||t.includes("threejs")){const n=c.find(s=>s.type==="three");n&&(n.detected=!0)}}}),c}function p(e,c){e.forEach(i=>{if(i.type==="file"&&(i.path.endsWith(".jsx")||i.path.endsWith(".tsx"))){let t=i.content;const n=c.find(s=>s.type==="unicornstudio"&&s.detected);n&&n.projectId&&(t=u(t,n.projectId)),i.content=t}})}function u(e,c){if(!e.includes("data-us-project")&&!e.includes("UnicornStudio"))return e;const i=e.includes("useEffect"),t=e.includes("window.UnicornStudio");if(i&&t&&(e=e.replace(/useEffect\(\(\) => \{[\s\S]*?window\.UnicornStudio[\s\S]*?\}, \[\]\);?/g,""),e.includes("useEffect(")||(e=e.replace(/,?\s*useEffect\s*,?/g,""),e=e.replace(/import React from 'react';/,"import React from 'react';"))),!e.includes("unicornstudio-react")){const s=e.match(/import React.*?;/);s&&(e=e.replace(s[0],s[0]+`
`+`import UnicornScene from 'unicornstudio-react';
`))}const n=/<div[^>]*data-us-project=["']([^"']+)["'][^>]*>[\s\S]*?<\/div>/g;return e=e.replace(n,(s,o)=>{const r=s.match(/className=["']([^"']+)["']/),a=r?r[1]:"";return`<UnicornScene
      projectId="${o}"
      ${a?`className="${a}"`:""}
    />`}),e}function l(e,c){const i=e.find(t=>t.type==="file"&&t.path==="package.json");if(i&&i.type==="file")try{const t=JSON.parse(i.content);c.forEach(n=>{n.detected&&(t.dependencies||(t.dependencies={}),t.dependencies[n.packageName]=n.version)}),i.content=JSON.stringify(t,null,2)}catch(t){console.error("Error updating package.json:",t)}}function f(e,c){const i=c.filter(o=>o.detected);if(i.length===0)return;const t=i.map(o=>`- **${o.packageName}** (${o.version}) - ${m(o.type)}`).join(`
`),n=`# React Component

Auto-generated React component.

## Setup

\`\`\`bash
npm install
npm start
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`
${i.length>0?`
## External Libraries
${t}
`:""}
${i.length>0?`## Usage

${i.map(o=>g(o)).join(`

`)}`:""}

---
*Generated with Aura*
`,s=e.find(o=>o.type==="file"&&o.path==="README.md");s&&s.type==="file"?s.content=n:e.push({name:"README.md",path:"README.md",type:"file",content:n})}function m(e){return{unicornstudio:"Interactive WebGL scenes",spline:"3D design and animation",lottie:"Lottie animations",gsap:"Animation library",three:"Three.js 3D graphics"}[e]||"External library"}function g(e){return e.type==="unicornstudio"&&e.projectId?`### Unicorn Studio
\`\`\`jsx
import UnicornScene from 'unicornstudio-react';

<UnicornScene projectId="${e.projectId}" />
\`\`\``:e.type==="spline"?`### Spline
\`\`\`jsx
import Spline from '@splinetool/react-spline';

<Spline scene="https://prod.spline.design/your-scene-id/scene.splinecode" />
\`\`\``:`### ${e.packageName}
See the package documentation for usage details.`}export{h as transformToProduction};
