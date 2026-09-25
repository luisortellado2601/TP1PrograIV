
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "redirectTo": "/cartelera",
    "route": "/"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-D7MW1Z8S.js",
      "chunk-D2LpFvUj.js",
      "chunk-DCFT-RaR.js",
      "chunk-uRCnHHuP.js"
    ],
    "route": "/cartelera"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-BD3ztQpu.js",
      "chunk-DCFT-RaR.js"
    ],
    "route": "/pelicula-detalle/*"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-Cs9WSsVV.js",
      "chunk-uRCnHHuP.js",
      "chunk-CoGddtZm.js"
    ],
    "route": "/login"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-BbGHQMOV.js",
      "chunk-uRCnHHuP.js",
      "chunk-CoGddtZm.js"
    ],
    "route": "/register"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-CvjPOfbe.js",
      "chunk-CfJ--Own.js"
    ],
    "route": "/candy-cliente"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-nhw7mpw8.js"
    ],
    "route": "/admin"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-Bn98hpLF.js",
      "chunk-uRCnHHuP.js",
      "chunk-CfJ--Own.js",
      "chunk-CoGddtZm.js"
    ],
    "route": "/admin-candy"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-a9foZp2-.js",
      "chunk-D2LpFvUj.js",
      "chunk-DCFT-RaR.js",
      "chunk-uRCnHHuP.js",
      "chunk-CoGddtZm.js"
    ],
    "route": "/peliculas"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 664, hash: '8ecb3aa11d53f7ba368c95d94dd0e31a693e94402cd05eb9eab7cf512241cf34', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1000, hash: 'd674dd0fb8a827c90a7504e78574950bee186d164928b106312b7634d21479d4', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-CGONZVKF.css': {size: 52, hash: 'KTlVjduO/1Q', text: () => import('./assets-chunks/styles-CGONZVKF_css.mjs').then(m => m.default)}
  },
};
