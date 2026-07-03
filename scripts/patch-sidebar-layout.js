#!/usr/bin/env node
/**
 * Patch the current sidebar bundle:
 * - remove the top "New chat" action item from sidebar nav
 * - keep fixed nav items inside the top Search nav block
 * - hide the bottom Settings profile footer from sidebar nav
 * - restore project-row path tooltip
 * - hide the project expand arrow permanently
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const APP_MAIN = /^app-main-.*\.js$/;
const SIDEBAR_FLAT_SECTIONS = /^sidebar-flat-sections-.*\.js$/;

const TARGETS = [
  { kind: "app-main", pattern: APP_MAIN },
  { kind: "sidebar-flat-sections", pattern: SIDEBAR_FLAT_SECTIONS },
];

const PLUGINS_ICON =
  'e=>(0,mz.jsx)(`svg`,{width:20,height:20,viewBox:`0 0 20 20`,fill:`none`,xmlns:`http://www.w3.org/2000/svg`,...e,children:(0,mz.jsx)(`path`,{d:`M7.94562 14.0277C7.94556 12.9376 7.0621 12.054 5.97198 12.054C4.88197 12.0542 3.99841 12.9377 3.99835 14.0277C3.99835 15.1178 4.88194 16.0012 5.97198 16.0013C7.06213 16.0013 7.94562 15.1178 7.94562 14.0277ZM16.0013 14.0277C16.0012 12.9376 15.1178 12.054 14.0276 12.054C12.9376 12.0541 12.0541 12.9376 12.054 14.0277C12.054 15.1178 12.9376 16.0013 14.0276 16.0013C15.1178 16.0013 16.0013 15.1178 16.0013 14.0277ZM7.94562 5.97202C7.9455 4.88197 7.06206 3.99838 5.97198 3.99838C4.88201 3.9985 3.99847 4.88204 3.99835 5.97202C3.99835 7.06209 4.88194 7.94553 5.97198 7.94565C7.06213 7.94565 7.94562 7.06216 7.94562 5.97202ZM16.0013 5.97202C16.0012 4.88197 15.1177 3.99838 14.0276 3.99838C12.9376 3.99844 12.0541 4.882 12.054 5.97202C12.054 7.06213 12.9375 7.94559 14.0276 7.94565C15.1178 7.94565 16.0013 7.06216 16.0013 5.97202ZM9.2757 14.0277C9.2757 15.8524 7.79667 17.3314 5.97198 17.3314C4.1474 17.3313 2.66827 15.8523 2.66827 14.0277C2.66833 12.2031 4.14743 10.7241 5.97198 10.724C7.79664 10.724 9.27564 12.203 9.2757 14.0277ZM17.3314 14.0277C17.3314 15.8524 15.8523 17.3314 14.0276 17.3314C12.203 17.3313 10.7239 15.8523 10.7239 14.0277C10.724 12.2031 12.203 10.724 14.0276 10.724C15.8523 10.724 17.3313 12.203 17.3314 14.0277ZM9.2757 5.97202C9.2757 7.7967 7.79667 9.27573 5.97198 9.27573C4.1474 9.27561 2.66827 7.79663 2.66827 5.97202C2.66839 4.1475 4.14747 2.66842 5.97198 2.6683C7.7966 2.6683 9.27558 4.14743 9.2757 5.97202ZM17.3314 5.97202C17.3314 7.7967 15.8523 9.27573 14.0276 9.27573C12.203 9.27567 10.7239 7.79667 10.7239 5.97202C10.7241 4.14746 12.2031 2.66836 14.0276 2.6683C15.8523 2.6683 17.3312 4.14743 17.3314 5.97202Z`,fill:`currentColor`})})';

const PLUGINS_NAV =
  't&&(n===`codex`||s)?(0,mz.jsx)(JO,{icon:jp,onClick:()=>{rT(i,a,s)},isActive:o.pathname.startsWith(`/skills`),label:s?(0,mz.jsxs)(`span`,{className:`inline-flex items-center gap-1`,children:[(0,mz.jsx)(J,{id:`sidebarElectron.skillsAppsRouteNavLink`,defaultMessage:`Plugins`,description:`Nav link that opens the skills and apps page`}),(0,mz.jsx)(tz,{chipConfig:IR})]}):(0,mz.jsx)(J,{id:`sidebarElectron.skillsRouteNavLink`,defaultMessage:`Skills`,description:`Nav link that opens the skills page`})})';

const PROJECT_ROW = {
  from:
    'function Nu(e){let t=(0,Lu.c)(57),{ref:n,className:r,actions:i,collapsed:a,contentClassName:o,dragHandleListeners:s,dragHandleRef:c,icon:l,isActive:u,isDisabled:d,ariaLabel:f,label:p,labelEnd:m,onContextMenu:h,onPress:g,projectId:_,rowAttributes:v,selectAction:y,toggle:b,trailingContent:x}=e,S=u===void 0?!1:u,C=d===void 0?!1:d,w;t[0]!==C||t[1]!==g?(w=e=>{C||e.defaultPrevented||e.button!==0||g()},t[0]=C,t[1]=g,t[2]=w):w=t[2];let T=w,E;t[3]!==C||t[4]!==g?(E=e=>{C||e.defaultPrevented||e.currentTarget===e.target&&(e.key!==`Enter`&&e.key!==` `||(e.preventDefault(),g()))},t[3]=C,t[4]=g,t[5]=E):E=t[5];let D=E,O;t[6]!==a||t[7]!==p||t[8]!==_?(O=be.sidebarProjectRow({collapsed:a,label:p,projectId:_}),t[6]=a,t[7]=p,t[8]=_,t[9]=O):O=t[9];let k=S&&`bg-token-list-hover-background`,A=C&&`text-token-description-foreground opacity-70`,j;t[10]!==r||t[11]!==k||t[12]!==A?(j=V(`group/folder-row group relative flex h-[var(--height-token-row)] cursor-interaction items-center justify-between overflow-x-hidden rounded-[var(--radius-token-row)] text-sm text-token-foreground hover:bg-token-list-hover-background focus-visible:outline focus-visible:outline-offset-2`,k,A,r),t[10]=r,t[11]=k,t[12]=A,t[13]=j):j=t[13];let M=C?-1:0,N=f??p,P=S?`page`:void 0,F=b?.expanded,I=C||void 0,L;t[14]===l?L=t[15]:(L=(0,Ru.jsx)(`span`,{className:`relative flex h-6 w-6 items-center justify-center`,children:l}),t[14]=l,t[15]=L);let R=C?`text-token-description-foreground`:`text-token-foreground`,z=s!=null&&`cursor-interaction`,B;t[16]!==o||t[17]!==R||t[18]!==z?(B=V(`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap rounded-md py-1 pr-0 text-left text-base`,R,z,o),t[16]=o,t[17]=R,t[18]=z,t[19]=B):B=t[19];let H;t[20]===p?H=t[21]:(H=(0,Ru.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:p}),t[20]=p,t[21]=H);let U;t[22]===b?U=t[23]:(U=b==null?null:(0,Ru.jsx)(Pu,{...b}),t[22]=b,t[23]=U);let W;t[24]!==m||t[25]!==H||t[26]!==U?(W=(0,Ru.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-0.5`,children:[H,m,U]}),t[24]=m,t[25]=H,t[26]=U,t[27]=W):W=t[27];let G;t[28]!==W||t[29]!==x?(G=(0,Ru.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:[W,x]}),t[28]=W,t[29]=x,t[30]=G):G=t[30];let K;t[31]!==s||t[32]!==c||t[33]!==B||t[34]!==G?(K=(0,Ru.jsx)(`div`,{ref:c,className:B,...s,children:G}),t[31]=s,t[32]=c,t[33]=B,t[34]=G,t[35]=K):K=t[35];let q;t[36]!==L||t[37]!==K?(q=(0,Ru.jsxs)(`div`,{className:`flex min-w-0 flex-1 items-center gap-1 pl-0.5`,children:[L,K]}),t[36]=L,t[37]=K,t[38]=q):q=t[38];let ee;t[39]===y?ee=t[40]:(ee=y==null?null:(0,Ru.jsx)(`button`,{type:`button`,"aria-hidden":`true`,tabIndex:-1,className:`sr-only`,...be.sidebarProjectSelect,onClick:e=>{e.stopPropagation(),y.onSelect()}}),t[39]=y,t[40]=ee);let J;return t[41]!==i||t[42]!==T||t[43]!==D||t[44]!==h||t[45]!==n||t[46]!==v||t[47]!==N||t[48]!==P||t[49]!==F||t[50]!==I||t[51]!==q||t[52]!==ee||t[53]!==O||t[54]!==j||t[55]!==M?(J=(0,Ru.jsxs)(`div`,{...v,...O,ref:n,className:j,role:`button`,tabIndex:M,onClick:T,onKeyDown:D,onContextMenu:h,"aria-label":N,"aria-current":P,"aria-expanded":F,"aria-disabled":I,children:[q,i,ee]}),t[41]=i,t[42]=T,t[43]=D,t[44]=h,t[45]=n,t[46]=v,t[47]=N,t[48]=P,t[49]=F,t[50]=I,t[51]=q,t[52]=ee,t[53]=O,t[54]=j,t[55]=M,t[56]=J):J=t[56],J}',
  to:
    'function Nu(e){let t=(0,Lu.c)(60),{ref:n,className:r,actions:i,collapsed:a,contentClassName:o,dragHandleListeners:s,dragHandleRef:c,icon:l,isActive:u,isDisabled:d,ariaLabel:f,label:p,labelEnd:m,labelTooltipContent:Q0,onContextMenu:h,onMouseEnter:X0,onMouseLeave:Y0,onPress:g,projectId:_,rowAttributes:v,selectAction:y,toggle:b,trailingContent:x}=e,S=u===void 0?!1:u,C=d===void 0?!1:d,w;t[0]!==C||t[1]!==g?(w=e=>{C||e.defaultPrevented||e.button!==0||g()},t[0]=C,t[1]=g,t[2]=w):w=t[2];let T=w,E;t[3]!==C||t[4]!==g?(E=e=>{C||e.defaultPrevented||e.currentTarget===e.target&&(e.key!==`Enter`&&e.key!==` `||(e.preventDefault(),g()))},t[3]=C,t[4]=g,t[5]=E):E=t[5];let D=E,O;t[6]!==a||t[7]!==p||t[8]!==_?(O=be.sidebarProjectRow({collapsed:a,label:p,projectId:_}),t[6]=a,t[7]=p,t[8]=_,t[9]=O):O=t[9];let k=S&&`bg-token-list-hover-background`,A=C&&`text-token-description-foreground opacity-70`,j;t[10]!==r||t[11]!==k||t[12]!==A?(j=V(`group/folder-row group relative flex h-[var(--height-token-row)] cursor-interaction items-center justify-between overflow-x-hidden rounded-[var(--radius-token-row)] text-sm text-token-foreground hover:bg-token-list-hover-background focus-visible:outline focus-visible:outline-offset-2`,k,A,r),t[10]=r,t[11]=k,t[12]=A,t[13]=j):j=t[13];let M=C?-1:0,N=f??p,P=S?`page`:void 0,F=b?.expanded,I=C||void 0,L;t[14]===l?L=t[15]:(L=(0,Ru.jsx)(`span`,{className:`relative flex h-6 w-6 items-center justify-center`,children:l}),t[14]=l,t[15]=L);let R=C?`text-token-description-foreground`:`text-token-foreground`,z=s!=null&&`cursor-interaction`,B;t[16]!==o||t[17]!==R||t[18]!==z?(B=V(`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap rounded-md py-1 pr-0 text-left text-base`,R,z,o),t[16]=o,t[17]=R,t[18]=z,t[19]=B):B=t[19];let H;t[20]!==p||t[21]!==Q0?(H=Q0==null?(0,Ru.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:p}):(0,Ru.jsx)(le,{delayOpen:!0,tooltipContent:Q0,children:(0,Ru.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:p})}),t[20]=p,t[21]=Q0,t[22]=H):H=t[22];let U;t[23]===b?U=t[24]:(U=b==null?null:(0,Ru.jsx)(Pu,{...b}),t[23]=b,t[24]=U);let W;t[25]!==m||t[26]!==H||t[27]!==U?(W=(0,Ru.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-0.5`,children:[H,m,U]}),t[25]=m,t[26]=H,t[27]=U,t[28]=W):W=t[28];let G;t[29]!==W||t[30]!==x?(G=(0,Ru.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:[W,x]}),t[29]=W,t[30]=x,t[31]=G):G=t[31];let K;t[32]!==s||t[33]!==c||t[34]!==B||t[35]!==G?(K=(0,Ru.jsx)(`div`,{ref:c,className:B,...s,children:G}),t[32]=s,t[33]=c,t[34]=B,t[35]=G,t[36]=K):K=t[36];let q;t[37]!==L||t[38]!==K?(q=(0,Ru.jsxs)(`div`,{className:`flex min-w-0 flex-1 items-center gap-1 pl-0.5`,children:[L,K]}),t[37]=L,t[38]=K,t[39]=q):q=t[39];let ee;t[40]===y?ee=t[41]:(ee=y==null?null:(0,Ru.jsx)(`button`,{type:`button`,"aria-hidden":`true`,tabIndex:-1,className:`sr-only`,...be.sidebarProjectSelect,onClick:e=>{e.stopPropagation(),y.onSelect()}}),t[40]=y,t[41]=ee);let J;return t[42]!==i||t[43]!==T||t[44]!==D||t[45]!==h||t[46]!==X0||t[47]!==Y0||t[48]!==n||t[49]!==v||t[50]!==N||t[51]!==P||t[52]!==F||t[53]!==I||t[54]!==q||t[55]!==ee||t[56]!==O||t[57]!==j||t[58]!==M?(J=(0,Ru.jsxs)(`div`,{...v,...O,ref:n,className:j,role:`button`,tabIndex:M,onClick:T,onKeyDown:D,onContextMenu:h,onMouseEnter:X0,onMouseLeave:Y0,"aria-label":N,"aria-current":P,"aria-expanded":F,"aria-disabled":I,children:[q,i,ee]}),t[42]=i,t[43]=T,t[44]=D,t[45]=h,t[46]=X0,t[47]=Y0,t[48]=n,t[49]=v,t[50]=N,t[51]=P,t[52]=F,t[53]=I,t[54]=q,t[55]=ee,t[56]=O,t[57]=j,t[58]=M,t[59]=J):J=t[59],J}',
};

const PROJECT_ACTIONS = {
  from:
    'function Bu(e){let t=(0,Ku.c)(24),{action:n,actionTooltipContent:r,actionTooltipDisabled:i,indicator:a,isMenuOpen:o,menu:s}=e,c=o?`opacity-100`:`opacity-0 group-hover/folder-row:opacity-100`,l;t[0]!==c||t[1]!==s?(l=s==null?null:(0,Ju.jsx)(`div`,{className:c,children:s}),t[0]=c,t[1]=s,t[2]=l):l=t[2];let u=o&&`w-6`,d;t[3]===u?d=t[4]:(d=V(`mr-0.5 grid h-6 max-w-48 min-w-6 shrink grid-cols-1 items-center group-hover/folder-row:w-6`,u),t[3]=u,t[4]=d);let f;t[5]!==a||t[6]!==o?(f=a==null?null:(0,Ju.jsx)(`div`,{className:V(`col-start-1 row-start-1 flex min-w-0 items-center justify-end group-hover/folder-row:invisible`,o&&`invisible`),children:a}),t[5]=a,t[6]=o,t[7]=f):f=t[7];let p=i??r==null,m;t[8]===c?m=t[9]:(m=V(`col-start-1 row-start-1 inline-flex justify-self-end`,c),t[8]=c,t[9]=m);let h;t[10]!==n||t[11]!==m?(h=(0,Ju.jsx)(`span`,{className:m,children:n}),t[10]=n,t[11]=m,t[12]=h):h=t[12];let g;t[13]!==r||t[14]!==p||t[15]!==h?(g=(0,Ju.jsx)(le,{tooltipContent:r,delayOpen:!0,disabled:p,children:h}),t[13]=r,t[14]=p,t[15]=h,t[16]=g):g=t[16];let _;t[17]!==d||t[18]!==f||t[19]!==g?(_=(0,Ju.jsxs)(`div`,{className:d,children:[f,g]}),t[17]=d,t[18]=f,t[19]=g,t[20]=_):_=t[20];let v;return t[21]!==l||t[22]!==_?(v=(0,Ju.jsxs)(`div`,{className:`flex min-w-0 gap-1`,onClick:Uu,onKeyDown:Hu,onPointerDown:Vu,children:[l,_]}),t[21]=l,t[22]=_,t[23]=v):v=t[23],v}',
  to:
    'function Bu(e){let t=(0,Ku.c)(30),{action:n,actionTooltipContent:r,actionTooltipDisabled:i,indicator:a,isMenuOpen:o,menu:s,isRowHovered:R0}=e,S0=!!R0||o,T0=!S0&&a==null,N0;t[0]===T0?N0=t[1]:(N0=T0?{width:0,minWidth:0,overflow:`hidden`,pointerEvents:`none`}:void 0,t[0]=T0,t[1]=N0);let c=S0?`opacity-100`:`opacity-0 group-hover/folder-row:opacity-100`,l;t[2]!==c||t[3]!==s||t[4]!==N0?(l=s==null?null:(0,Ju.jsx)(`div`,{style:N0,className:c,children:s}),t[2]=c,t[3]=s,t[4]=N0,t[5]=l):l=t[5];let u=o&&`w-6`,d;t[6]===u?d=t[7]:(d=V(`mr-0.5 grid h-6 max-w-48 min-w-6 shrink grid-cols-1 items-center group-hover/folder-row:w-6`,u),t[6]=u,t[7]=d);let f;t[8]!==a||t[9]!==o?(f=a==null?null:(0,Ju.jsx)(`div`,{className:V(`col-start-1 row-start-1 flex min-w-0 items-center justify-end group-hover/folder-row:invisible`,o&&`invisible`),children:a}),t[8]=a,t[9]=o,t[10]=f):f=t[10];let p=i??r==null,m;t[11]===c?m=t[12]:(m=V(`col-start-1 row-start-1 inline-flex justify-self-end`,c),t[11]=c,t[12]=m);let h;t[13]!==n||t[14]!==m?(h=(0,Ju.jsx)(`span`,{className:m,children:n}),t[13]=n,t[14]=m,t[15]=h):h=t[15];let g;t[16]!==r||t[17]!==p||t[18]!==h?(g=(0,Ju.jsx)(le,{tooltipContent:r,delayOpen:!0,disabled:p,children:h}),t[16]=r,t[17]=p,t[18]=h,t[19]=g):g=t[19];let _;t[20]!==d||t[21]!==f||t[22]!==g||t[23]!==N0?(_=(0,Ju.jsxs)(`div`,{style:N0,className:d,children:[f,g]}),t[20]=d,t[21]=f,t[22]=g,t[23]=N0,t[24]=_):_=t[24];let v;return t[25]!==l||t[26]!==_||t[27]!==N0?(v=(0,Ju.jsxs)(`div`,{style:N0,className:`flex min-w-0 gap-1`,onClick:Uu,onKeyDown:Hu,onPointerDown:Vu,children:[l,_]}),t[25]=l,t[26]=_,t[27]=N0,t[28]=v):v=t[28],v}',
};

const PROJECT_ACTION_WRAPPER = {
  from:
    'function Sd(e){let t=(0,zd.c)(29),{group:n,threadKeys:r,collapsedStatusState:i,connectionHostId:a,remoteHostLabel:o,projectHeaderMenuKind:s,canCreateStableWorktree:c,onStartNewThread:l,onShowProjectHome:u,newThreadLabel:f,canStartNewThread:p,newThreadDisabledLabel:m,workspaceDropdownOpen:h,onWorkspaceDropdownOpenChange:g,showProjectEditAction:_,showProjectPinAction:v}=e,y=d(zt),b=d(kr),x=d(Fr),S=!p,C;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(C=(0,$.jsx)(Aa,{className:`icon-xs`}),t[0]=C):C=t[0];let w;t[1]!==f||t[2]!==l||t[3]!==S?(w=(0,$.jsx)(Gu,{ariaLabel:f,disabled:S,onClick:l,children:C}),t[1]=f,t[2]=l,t[3]=S,t[4]=w):w=t[4];let T;t[5]!==i||t[6]!==a||t[7]!==o?(T=i!=null||a!=null?(0,$.jsxs)(`span`,{className:`flex max-w-48 min-w-0 items-center whitespace-nowrap`,children:[o==null?null:(0,$.jsx)(`span`,{className:`min-w-0 truncate text-token-description-foreground`,children:o}),(0,$.jsx)(`span`,{className:`flex h-6 w-6 shrink-0 items-center justify-center`,children:i==null?a==null?null:(0,$.jsx)(dd,{hostId:a}):(0,$.jsx)(eo,{statusState:i})})]}):null,t[5]=i,t[6]=a,t[7]=o,t[8]=T):T=t[8];let E;t[9]!==c||t[10]!==y||t[11]!==n||t[12]!==u||t[13]!==g||t[14]!==s||t[15]!==_||t[16]!==v||t[17]!==r||t[18]!==h||t[19]!==x||t[20]!==b?(E=s===`local`&&n.projectKind===`local`?(0,$.jsx)(Ed,{project:n,threadKeys:r,currentThreadKey:y,canCreateStableWorktree:c,workspaceRootOptions:b,workspaceRootLabels:x,onArchivedCurrentThread:u,open:h,onOpenChange:g,showProjectEditAction:_,showProjectPinAction:v}):s===`remote`&&n.path!=null?(0,$.jsx)(kd,{hostId:n.hostId,projectId:n.projectId,remotePath:n.path,groupLabel:n.label,threadKeys:r,currentThreadKey:y,onArchivedCurrentThread:u,open:h,onOpenChange:g,showProjectPinAction:v}):null,t[9]=c,t[10]=y,t[11]=n,t[12]=u,t[13]=g,t[14]=s,t[15]=_,t[16]=v,t[17]=r,t[18]=h,t[19]=x,t[20]=b,t[21]=E):E=t[21];let D;return t[22]!==p||t[23]!==m||t[24]!==w||t[25]!==T||t[26]!==E||t[27]!==h?(D=(0,$.jsx)(Bu,{action:w,actionTooltipContent:m,actionTooltipDisabled:p,indicator:T,isMenuOpen:h,menu:E}),t[22]=p,t[23]=m,t[24]=w,t[25]=T,t[26]=E,t[27]=h,t[28]=D):D=t[28],D}',
  to:
    'function Sd(e){let t=(0,zd.c)(30),{group:n,threadKeys:r,collapsedStatusState:i,connectionHostId:a,remoteHostLabel:o,projectHeaderMenuKind:s,canCreateStableWorktree:c,onStartNewThread:l,onShowProjectHome:u,newThreadLabel:f,canStartNewThread:p,newThreadDisabledLabel:m,workspaceDropdownOpen:h,onWorkspaceDropdownOpenChange:g,showProjectEditAction:_,showProjectPinAction:v,isRowHovered:A0}=e,y=d(zt),b=d(kr),x=d(Fr),S=!p,C;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(C=(0,$.jsx)(Aa,{className:`icon-xs`}),t[0]=C):C=t[0];let w;t[1]!==f||t[2]!==l||t[3]!==S?(w=(0,$.jsx)(Gu,{ariaLabel:f,disabled:S,onClick:l,children:C}),t[1]=f,t[2]=l,t[3]=S,t[4]=w):w=t[4];let T;t[5]!==i||t[6]!==a||t[7]!==o?(T=i!=null||a!=null?(0,$.jsxs)(`span`,{className:`flex max-w-48 min-w-0 items-center whitespace-nowrap`,children:[o==null?null:(0,$.jsx)(`span`,{className:`min-w-0 truncate text-token-description-foreground`,children:o}),(0,$.jsx)(`span`,{className:`flex h-6 w-6 shrink-0 items-center justify-center`,children:i==null?a==null?null:(0,$.jsx)(dd,{hostId:a}):(0,$.jsx)(eo,{statusState:i})})]}):null,t[5]=i,t[6]=a,t[7]=o,t[8]=T):T=t[8];let E;t[9]!==c||t[10]!==y||t[11]!==n||t[12]!==u||t[13]!==g||t[14]!==s||t[15]!==_||t[16]!==v||t[17]!==r||t[18]!==h||t[19]!==x||t[20]!==b?(E=s===`local`&&n.projectKind===`local`?(0,$.jsx)(Ed,{project:n,threadKeys:r,currentThreadKey:y,canCreateStableWorktree:c,workspaceRootOptions:b,workspaceRootLabels:x,onArchivedCurrentThread:u,open:h,onOpenChange:g,showProjectEditAction:_,showProjectPinAction:v}):s===`remote`&&n.path!=null?(0,$.jsx)(kd,{hostId:n.hostId,projectId:n.projectId,remotePath:n.path,groupLabel:n.label,threadKeys:r,currentThreadKey:y,onArchivedCurrentThread:u,open:h,onOpenChange:g,showProjectPinAction:v}):null,t[9]=c,t[10]=y,t[11]=n,t[12]=u,t[13]=g,t[14]=s,t[15]=_,t[16]=v,t[17]=r,t[18]=h,t[19]=x,t[20]=b,t[21]=E):E=t[21];let D;return t[22]!==p||t[23]!==m||t[24]!==w||t[25]!==T||t[26]!==E||t[27]!==h||t[28]!==A0?(D=(0,$.jsx)(Bu,{action:w,actionTooltipContent:m,actionTooltipDisabled:p,indicator:T,isMenuOpen:h,menu:E,isRowHovered:A0}),t[22]=p,t[23]=m,t[24]=w,t[25]=T,t[26]=E,t[27]=h,t[28]=A0,t[29]=D):D=t[29],D}',
};

const RULES = [
  {
    id: "remove_project_section_new_chat_item",
    filePattern: APP_MAIN,
    from: "children:[Le,Re,Me,ze]",
    to: "children:[Le,Re,Me,null]",
  },
  {
    id: "remove_top_new_chat_item",
    filePattern: APP_MAIN,
    from: "let j;return t[45]!==O||t[46]!==A?(j=(0,mz.jsxs)(KO,{children:[O,A]}),t[45]=O,t[46]=A,t[47]=j):j=t[47],j}",
    to: "let j;return t[45]!==O||t[46]!==A?(j=(0,mz.jsxs)(KO,{children:[null,A]}),t[45]=O,t[46]=A,t[47]=j):j=t[47],j}",
  },
  {
    id: "remove_top_new_chat_icon_item",
    filePattern: APP_MAIN,
    from: "let s;return t[30]!==o||t[31]!==r?(s=(0,mz.jsxs)(`div`,{className:`ml-auto flex items-center gap-1`,children:[r,o]}),t[30]=o,t[31]=r,t[32]=s):s=t[32],s}",
    to: "let s;return t[30]!==o||t[31]!==r?(s=(0,mz.jsxs)(`div`,{className:`ml-auto flex items-center gap-1`,children:[null,o]}),t[30]=o,t[31]=r,t[32]=s):s=t[32],s}",
  },
  {
    id: "simplify_fixed_nav_container",
    filePattern: APP_MAIN,
    from: "let h=`codex`,g=(0,_V.jsxs)(`div`,{className:`flex shrink-0 flex-col gap-2`,children:[(0,_V.jsx)(oz,{chatGptProjectCrudStatus:void 0,desktopNavItemsEnabled:e,sidebarMode:h,onCreateChatGptProject:void 0}),null]});return",
    to: "let h=`codex`,g=(0,_V.jsx)(oz,{chatGptProjectCrudStatus:void 0,desktopNavItemsEnabled:e,sidebarMode:h,onCreateChatGptProject:void 0});return",
  },
  {
    id: "remove_fixed_nav_inner_padding",
    filePattern: APP_MAIN,
    from: "className:`shrink-0 px-row-x`,children:(0,mz.jsxs)(KO,{children:[",
    to: "className:`shrink-0`,children:(0,mz.jsxs)(KO,{children:[",
  },
  {
    id: "put_fixed_nav_items_inside_search_block",
    filePattern: APP_MAIN,
    from: "children:[null,(0,_V.jsx)(sz,{sidebarMode:h})",
    to: "children:[null,(0,_V.jsx)(sz,{sidebarMode:h}),g",
  },
  {
    id: "drop_fixed_nav_scroll_top_content",
    filePattern: APP_MAIN,
    from: "(0,_V.jsx)(PB,{sidebarMode:h,topContent:g})",
    to: "(0,_V.jsx)(PB,{sidebarMode:h,topContent:null})",
  },
  {
    id: "sidebar_scroll_padding_top_zero",
    filePattern: APP_MAIN,
    from: "d==null?`-mt-2 pt-6`:`-mt-[var(--sidebar-scroll-header-spacing,8px)] pt-[var(--sidebar-scroll-header-spacing,8px)]`",
    to: "d==null?`-mt-2 pt-0`:`-mt-[var(--sidebar-scroll-header-spacing,8px)] pt-0`",
  },
  {
    id: "replace_plugins_nav_icon",
    filePattern: APP_MAIN,
    from: PLUGINS_NAV,
    to: PLUGINS_NAV.replace("icon:jp", `icon:${PLUGINS_ICON}`),
  },
  {
    id: "hide_profile_footer_settings",
    filePattern: APP_MAIN,
    from: "className:`flex flex-col gap-2 px-[var(--padding-row-cell-x,var(--padding-row-x))] py-[var(--padding-row-x)] focus-within:bg-token-list-hover-background hover:bg-token-list-hover-background`,children:[ve,ye]",
    to: "className:`hidden flex-col gap-2 px-[var(--padding-row-cell-x,var(--padding-row-x))] py-[var(--padding-row-x)] focus-within:bg-token-list-hover-background hover:bg-token-list-hover-background`,children:[ve,ye]",
  },
  {
    id: "project_group_row_memo_cache_size",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: "function pd(e){let t=(0,zd.c)(120),",
    to: "function pd(e){let t=(0,zd.c)(125),",
  },
  {
    id: "project_group_row_track_hover_state",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: "let de=ce,[fe,pe]=(0,Bd.useState)(!1),me=n.projectKind===`remote`&&n.hostId==null,he;",
    to: "let de=ce,[fe,pe]=(0,Bd.useState)(!1),[__projectRowHovered,__setProjectRowHovered]=(0,Bd.useState)(!1),me=n.projectKind===`remote`&&n.hostId==null,he;",
  },
  {
    id: "project_group_row_pass_hover_to_actions",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: "let Re=L?null:R?H:null,ze=n.repositoryData!=null,Be=!U&&(!me||n.cloudEnvironment!=null),Ve=me?ve:ge,He;t[37]!==n||t[38]!==fe||t[39]!==de||t[40]!==G||t[41]!==K||t[42]!==q||t[43]!==pe||t[44]!==be||t[45]!==p||t[46]!==g||t[47]!==ye||t[48]!==Re||t[49]!==ze||t[50]!==Be||t[51]!==Ve?(He=(0,$.jsx)(Sd,{group:n,threadKeys:n.threadKeys,collapsedStatusState:Re,connectionHostId:K,remoteHostLabel:q,projectHeaderMenuKind:G,canCreateStableWorktree:ze,onStartNewThread:ye,onShowProjectHome:be,newThreadLabel:de,canStartNewThread:Be,newThreadDisabledLabel:Ve,workspaceDropdownOpen:fe,onWorkspaceDropdownOpenChange:pe,showProjectEditAction:p,showProjectPinAction:g}),t[37]=n,t[38]=fe,t[39]=de,t[40]=G,t[41]=K,t[42]=q,t[43]=pe,t[44]=be,t[45]=p,t[46]=g,t[47]=ye,t[48]=Re,t[49]=ze,t[50]=Be,t[51]=Ve,t[52]=He):He=t[52];",
    to: "let Re=L?null:R?H:null,ze=n.repositoryData!=null,Be=!U&&(!me||n.cloudEnvironment!=null),Ve=me?ve:ge,He;t[37]!==n||t[38]!==fe||t[39]!==de||t[40]!==G||t[41]!==K||t[42]!==q||t[43]!==pe||t[44]!==be||t[45]!==p||t[46]!==g||t[47]!==ye||t[48]!==Re||t[49]!==ze||t[50]!==Be||t[51]!==Ve||t[120]!==__projectRowHovered?(He=(0,$.jsx)(Sd,{group:n,threadKeys:n.threadKeys,collapsedStatusState:Re,connectionHostId:K,remoteHostLabel:q,projectHeaderMenuKind:G,canCreateStableWorktree:ze,onStartNewThread:ye,onShowProjectHome:be,newThreadLabel:de,canStartNewThread:Be,newThreadDisabledLabel:Ve,workspaceDropdownOpen:fe,onWorkspaceDropdownOpenChange:pe,showProjectEditAction:p,showProjectPinAction:g,isRowHovered:__projectRowHovered}),t[37]=n,t[38]=fe,t[39]=de,t[40]=G,t[41]=K,t[42]=q,t[43]=pe,t[44]=be,t[45]=p,t[46]=g,t[47]=ye,t[48]=Re,t[49]=ze,t[50]=Be,t[51]=Ve,t[120]=__projectRowHovered,t[121]=He):He=t[121];",
  },
  {
    id: "project_group_row_pass_tooltip_and_hover_handlers",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: "let Ke;t[61]!==Oe||t[62]!==j||t[63]!==A||t[64]!==Se||t[65]!==B||t[66]!==R||t[67]!==ke||t[68]!==Ae||t[69]!==je||t[70]!==Me||t[71]!==Ne||t[72]!==Pe||t[73]!==Fe||t[74]!==Le||t[75]!==He||t[76]!==Ue||t[77]!==We||t[78]!==Ge?(Ke=(0,$.jsx)(Oe,{rowAttributes:ke,className:Ae,collapsed:R,contentClassName:je,dragHandleListeners:Me,dragHandleRef:Ne,icon:Pe,isActive:B,ariaLabel:Fe,label:j,onPress:Se,onContextMenu:Le,projectId:A,actions:He,selectAction:Ue,toggle:We,trailingContent:Ge}),t[61]=Oe,t[62]=j,t[63]=A,t[64]=Se,t[65]=B,t[66]=R,t[67]=ke,t[68]=Ae,t[69]=je,t[70]=Me,t[71]=Ne,t[72]=Pe,t[73]=Fe,t[74]=Le,t[75]=He,t[76]=Ue,t[77]=We,t[78]=Ge,t[79]=Ke):Ke=t[79];",
    to: "let Ke;t[61]!==Oe||t[62]!==j||t[63]!==A||t[64]!==Se||t[65]!==B||t[66]!==R||t[67]!==ke||t[68]!==Ae||t[69]!==je||t[70]!==Me||t[71]!==Ne||t[72]!==Pe||t[73]!==Fe||t[74]!==Le||t[75]!==He||t[76]!==Ue||t[77]!==We||t[78]!==Ge||t[122]!==k||t[123]!==__setProjectRowHovered?(Ke=(0,$.jsx)(Oe,{rowAttributes:ke,className:Ae,collapsed:R,contentClassName:je,dragHandleListeners:Me,dragHandleRef:Ne,icon:Pe,isActive:B,ariaLabel:Fe,label:j,onPress:Se,onContextMenu:Le,projectId:A,actions:He,selectAction:Ue,toggle:We,trailingContent:Ge,labelTooltipContent:k??null,onMouseEnter:()=>{__setProjectRowHovered(!0)},onMouseLeave:()=>{__setProjectRowHovered(!1)}}),t[61]=Oe,t[62]=j,t[63]=A,t[64]=Se,t[65]=B,t[66]=R,t[67]=ke,t[68]=Ae,t[69]=je,t[70]=Me,t[71]=Ne,t[72]=Pe,t[73]=Fe,t[74]=Le,t[75]=He,t[76]=Ue,t[77]=We,t[78]=Ge,t[122]=k,t[123]=__setProjectRowHovered,t[124]=Ke):Ke=t[124];",
  },
  {
    id: "project_row_restore_path_tooltip_and_hover_handlers",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: PROJECT_ROW.from,
    to: PROJECT_ROW.to,
  },
  {
    id: "project_actions_use_row_hover_state",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: PROJECT_ACTIONS.from,
    to: PROJECT_ACTIONS.to,
  },
  {
    id: "project_action_wrapper_pass_row_hover_state",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: PROJECT_ACTION_WRAPPER.from,
    to: PROJECT_ACTION_WRAPPER.to,
  },
  {
    id: "project_expand_toggle_always_hidden",
    filePattern: SIDEBAR_FLAT_SECTIONS,
    from: "className:`-ml-1 flex h-5 w-5 shrink-0 cursor-interaction items-center justify-center rounded-sm text-token-foreground opacity-0 group-hover/folder-row:opacity-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`",
    to: "className:`hidden h-5 w-0 min-w-0 shrink-0 cursor-interaction items-center justify-center overflow-hidden rounded-sm text-token-foreground opacity-0 pointer-events-none`",
  },
];

function assetsDir(platform) {
  return path.join(SRC_DIR, platform, "_asar", "webview", "assets");
}

function locateTargets(platform) {
  const platforms = platform
    ? [platform]
    : ["mac-arm64", "mac-x64", "win"].filter((p) => fs.existsSync(assetsDir(p)));

  const targets = [];
  const missing = [];

  for (const plat of platforms) {
    const dir = assetsDir(plat);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const target of TARGETS) {
      const matches = files.filter((file) => target.pattern.test(file));
      if (matches.length === 0) {
        missing.push({ platform: plat, kind: target.kind, dir });
        continue;
      }
      for (const file of matches) {
        targets.push({
          platform: plat,
          kind: target.kind,
          path: path.join(dir, file),
          rules: RULES.filter((rule) => rule.filePattern.test(file)),
        });
      }
    }
  }

  return { targets, missing };
}

function collectPatches(source, rules) {
  const patches = [];
  for (const rule of rules) {
    if (source.includes(rule.to)) continue;
    const start = source.indexOf(rule.from);
    if (start === -1) continue;
    patches.push({
      id: rule.id,
      start,
      end: start + rule.from.length,
      replacement: rule.to,
      original: rule.from,
    });
  }
  return patches;
}

function missingRules(source, rules) {
  return rules.filter((rule) => !source.includes(rule.from) && !source.includes(rule.to));
}

function hasExpectedFootprint(kind, source) {
  if (kind === "app-main") {
    return source.includes("sidebarElectron.skillsAppsRouteNavLink");
  }
  if (kind === "sidebar-flat-sections") {
    return source.includes("function Nu(e)")
      && source.includes("function Bu(e)")
      && source.includes("function Sd(e)");
  }
  return false;
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const { targets, missing } = locateTargets(platform);
  if (targets.length === 0 && missing.length === 0) {
    console.log("  [skip] No sidebar bundle targets found under src/*/_asar/webview/assets");
    return;
  }

  let patchedCount = 0;
  let unresolved = 0;

  for (const miss of missing) {
    console.log(`  [${miss.platform}] [!] missing ${miss.kind} bundle under ${relPath(miss.dir)}`);
    unresolved += 1;
  }

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const patches = collectPatches(source, target.rules);
    const missed = missingRules(source, target.rules);

    if (missed.length > 0 && hasExpectedFootprint(target.kind, source)) {
      console.log(`  [${target.platform}] [!] ${target.kind} patch targets changed: ${relPath(target.path)}`);
      for (const rule of missed) {
        console.log(`    [missing] ${rule.id}`);
      }
      unresolved += 1;
      continue;
    }

    if (patches.length === 0) {
      console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)} => ${patches.length} patch(es)`);

    if (isCheck) {
      for (const patch of patches) {
        const preview = patch.original.slice(0, 160);
        console.log(`    [?] ${patch.id}: ${preview}${patch.original.length > 160 ? "..." : ""}`);
      }
      continue;
    }

    patches.sort((a, b) => b.start - a.start);
    let code = source;
    for (const patch of patches) {
      code = code.slice(0, patch.start) + patch.replacement + code.slice(patch.end);
      patchedCount += 1;
      console.log(`    * ${patch.id}`);
    }
    fs.writeFileSync(target.path, code, "utf-8");
  }

  if (unresolved > 0) {
    console.log(`  [x] unresolved sidebar layout targets: ${unresolved}`);
    process.exit(1);
  }

  if (!isCheck) {
    if (patchedCount === 0) {
      console.log("  [ok] sidebar layout already patched");
    } else {
      console.log(`  [ok] applied ${patchedCount} sidebar layout patch(es)`);
    }
  }
}

main();
