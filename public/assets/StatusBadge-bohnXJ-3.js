import{d as o,u as i,j as r,b as c}from"./index-CTugDpeh.js";import{C as m}from"./circle-check-U1ojJStc.js";import{T as l}from"./triangle-alert-DP1lCHES.js";import{C as p}from"./circle-alert-CuMykUNi.js";/**
 * @license lucide-react v1.14.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=[["path",{d:"M16 7h6v6",key:"box55l"}],["path",{d:"m22 7-8.5 8.5-5-5L2 17",key:"1t1m79"}]],h=o("trending-up",d),g={critical:p,warning:l,optimal:m,high:h};function j({status:a,showIcon:t=!0,label:s}){const{t:e}=i(),n=g[a];return r.jsxs(c,{variant:a,className:"gap-1",children:[t&&r.jsx(n,{className:"h-3 w-3"}),r.jsx("span",{children:s??e(`status.${a}`)})]})}export{j as S,h as T};
