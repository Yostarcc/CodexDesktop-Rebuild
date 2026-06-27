#!/usr/bin/env node
/**
 * Post-build patch:
 * - remove the top "New chat" action item from sidebar nav
 * - restore project-row path tooltip
 * - keep project hover actions working after tooltip injection
 *
 * This script intentionally targets the current upstream bundle with exact
 * string replacements instead of carrying forward stale compatibility logic.
 */
const fs = require("fs");
const path = require("path");
const { SRC_DIR, relPath } = require("./patch-util");

const RULES = [
  {
    id: "remove_new_chat_item_2616",
    from: "children:[(0,Z.jsx)(AD,{canStartProjectlessChat:u,newChatMessage:E,onStartChat:O}),(0,Z.jsx)(jD,{onOpen:D}),",
    to: "children:[null,(0,Z.jsx)(jD,{onOpen:D}),",
  },
  {
    id: "project_row_track_hover_state_2616",
    from: "let fe=de,[pe,me]=(0,$.useState)(!1),he=n.projectKind===`remote`&&n.hostId==null,ge;",
    to: "let fe=de,[pe,me]=(0,$.useState)(!1),[__projectRowHovered,__setProjectRowHovered]=(0,$.useState)(!1),he=n.projectKind===`remote`&&n.hostId==null,ge;",
  },
  {
    id: "project_row_pass_hover_state_to_actions_2616",
    from: "t[37]!==n||t[38]!==pe||t[39]!==fe||t[40]!==ee||t[41]!==U||t[42]!==W||t[43]!==me||t[44]!==xe||t[45]!==u||t[46]!==d||t[47]!==be||t[48]!==Le||t[49]!==Re||t[50]!==ze||t[51]!==Be||t[52]!==Ve?(He=(0,Z.jsx)(Rk,{group:n,threadKeys:n.threadKeys,collapsedStatusState:Le,attentionCounts:Re,connectionHostId:U,remoteHostLabel:W,projectHeaderMenuKind:ee,canCreateStableWorktree:ze,onStartNewThread:be,onShowProjectHome:xe,newThreadLabel:fe,canStartNewThread:Be,newThreadDisabledLabel:Ve,workspaceDropdownOpen:pe,onWorkspaceDropdownOpenChange:me,showProjectEditAction:u,showProjectPinAction:d}),t[37]=n,t[38]=pe,t[39]=fe,t[40]=ee,t[41]=U,t[42]=W,t[43]=me,t[44]=xe,t[45]=u,t[46]=d,t[47]=be,t[48]=Le,t[49]=Re,t[50]=ze,t[51]=Be,t[52]=Ve,t[53]=He):He=t[53];",
    to: "t[37]!==n||t[38]!==pe||t[39]!==fe||t[40]!==ee||t[41]!==U||t[42]!==W||t[43]!==me||t[44]!==xe||t[45]!==u||t[46]!==d||t[47]!==be||t[48]!==Le||t[49]!==Re||t[50]!==ze||t[51]!==Be||t[52]!==Ve||t[120]!==__projectRowHovered?(He=(0,Z.jsx)(Rk,{group:n,threadKeys:n.threadKeys,collapsedStatusState:Le,attentionCounts:Re,connectionHostId:U,remoteHostLabel:W,projectHeaderMenuKind:ee,canCreateStableWorktree:ze,onStartNewThread:be,onShowProjectHome:xe,newThreadLabel:fe,canStartNewThread:Be,newThreadDisabledLabel:Ve,workspaceDropdownOpen:pe,onWorkspaceDropdownOpenChange:me,showProjectEditAction:u,showProjectPinAction:d,isRowHovered:__projectRowHovered}),t[37]=n,t[38]=pe,t[39]=fe,t[40]=ee,t[41]=U,t[42]=W,t[43]=me,t[44]=xe,t[45]=u,t[46]=d,t[47]=be,t[48]=Le,t[49]=Re,t[50]=ze,t[51]=Be,t[52]=Ve,t[120]=__projectRowHovered,t[121]=He):He=t[121];",
  },
  {
    id: "project_row_bind_hover_handlers_2616",
    from: "Ke=(0,Z.jsx)(Oe,{rowAttributes:ke,className:Ae,collapsed:L,contentClassName:je,dragHandleListeners:Me,dragHandleRef:Ne,icon:Pe,isActive:R,ariaLabel:Fe,label:A,onPress:Ce,onContextMenu:Ie,projectId:k,actions:He,selectAction:Ue,toggle:We,trailingContent:Ge,children:n.label})",
    to: "Ke=(0,Z.jsx)(Oe,{rowAttributes:ke,className:Ae,collapsed:L,contentClassName:je,dragHandleListeners:Me,dragHandleRef:Ne,icon:Pe,isActive:R,ariaLabel:Fe,label:A,onPress:Ce,onContextMenu:Ie,projectId:k,actions:He,selectAction:Ue,toggle:We,trailingContent:Ge,labelTooltipContent:n.path??null,onMouseEnter:()=>{__setProjectRowHovered(!0)},onMouseLeave:()=>{__setProjectRowHovered(!1)},children:n.label})",
  },
  {
    id: "project_row_accept_hover_and_tooltip_2616",
    from: "function OO(e){let t=(0,Q.c)(57),{ref:n,className:r,actions:i,children:a,collapsed:o,contentClassName:s,dragHandleListeners:c,dragHandleRef:l,icon:u,isActive:d,isDisabled:f,ariaLabel:p,label:m,labelEnd:h,onContextMenu:g,onPress:_,projectId:v,rowAttributes:y,selectAction:b,toggle:x,trailingContent:S}=e,",
    to: "function OO(e){let t=(0,Q.c)(57),{ref:n,className:r,actions:i,children:a,collapsed:o,contentClassName:s,dragHandleListeners:c,dragHandleRef:l,icon:u,isActive:d,isDisabled:f,ariaLabel:p,label:m,labelEnd:h,labelTooltipContent:S0,onContextMenu:g,onMouseEnter:A0,onMouseLeave:j0,onPress:_,projectId:v,rowAttributes:y,selectAction:b,toggle:x,trailingContent:S}=e,",
  },
  {
    id: "project_row_render_label_tooltip_2616",
    from: "let H;t[20]===a?H=t[21]:(H=(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a}),t[20]=a,t[21]=H);let ee;t[22]===x?ee=t[23]:(ee=x==null?null:(0,Z.jsx)(kO,{...x}),t[22]=x,t[23]=ee);let U;t[24]!==h||t[25]!==H||t[26]!==ee?(U=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-0.5`,children:[H,h,ee]}),t[24]=h,t[25]=H,t[26]=ee,t[27]=U):U=t[27];let W;t[28]!==U||t[29]!==S?(W=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:[U,S]}),t[28]=U,t[29]=S,t[30]=W):W=t[30];let te;t[31]!==c||t[32]!==l||t[33]!==V||t[34]!==W?(te=(0,Z.jsx)(`div`,{ref:l,className:V,...c,children:W}),t[31]=c,t[32]=l,t[33]=V,t[34]=W,t[35]=te):te=t[35];let G;t[36]!==R||t[37]!==te?(G=(0,Z.jsxs)(`div`,{className:`flex min-w-0 flex-1 items-center gap-1 pl-1`,children:[R,te]}),t[36]=R,t[37]=te,t[38]=G):G=t[38];let K;t[39]===b?K=t[40]:(K=b==null?null:(0,Z.jsx)(`button`,{type:`button`,\"aria-hidden\":`true`,tabIndex:-1,className:`sr-only`,...Ha.sidebarProjectSelect,onClick:e=>{e.stopPropagation(),b.onSelect()}}),t[39]=b,t[40]=K);let q;return t[41]!==i||t[42]!==E||t[43]!==O||t[44]!==g||t[45]!==n||t[46]!==y||t[47]!==P||t[48]!==F||t[49]!==I||t[50]!==L||t[51]!==G||t[52]!==K||t[53]!==k||t[54]!==M||t[55]!==N?(q=(0,Z.jsxs)(`div`,{...y,...k,ref:n,className:M,role:`button`,tabIndex:N,onClick:E,onKeyDown:O,onContextMenu:g,\"aria-label\":P,\"aria-current\":F,\"aria-expanded\":I,\"aria-disabled\":L,children:[G,i,K]}),t[41]=i,t[42]=E,t[43]=O,t[44]=g,t[45]=n,t[46]=y,t[47]=P,t[48]=F,t[49]=I,t[50]=L,t[51]=G,t[52]=K,t[53]=k,t[54]=M,t[55]=N,t[56]=q):q=t[56],q}",
    to: "let H;t[20]!==a||t[21]!==S0?(H=S0==null?(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a}):(0,Z.jsx)(xa,{delayOpen:!0,tooltipContent:S0,children:(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a})}),t[20]=a,t[21]=S0,t[22]=H):H=t[22];let ee;t[23]===x?ee=t[24]:(ee=x==null?null:(0,Z.jsx)(kO,{...x}),t[23]=x,t[24]=ee);let U;t[25]!==h||t[26]!==H||t[27]!==ee?(U=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-0.5`,children:[H,h,ee]}),t[25]=h,t[26]=H,t[27]=ee,t[28]=U):U=t[28];let W;t[29]!==U||t[30]!==S?(W=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:[U,S]}),t[29]=U,t[30]=S,t[31]=W):W=t[31];let te;t[32]!==c||t[33]!==l||t[34]!==V||t[35]!==W?(te=(0,Z.jsx)(`div`,{ref:l,className:V,...c,children:W}),t[32]=c,t[33]=l,t[34]=V,t[35]=W,t[36]=te):te=t[36];let G;t[37]!==R||t[38]!==te?(G=(0,Z.jsxs)(`div`,{className:`flex min-w-0 flex-1 items-center gap-1 pl-1`,children:[R,te]}),t[37]=R,t[38]=te,t[39]=G):G=t[39];let K;t[40]===b?K=t[41]:(K=b==null?null:(0,Z.jsx)(`button`,{type:`button`,\"aria-hidden\":`true`,tabIndex:-1,className:`sr-only`,...Ha.sidebarProjectSelect,onClick:e=>{e.stopPropagation(),b.onSelect()}}),t[40]=b,t[41]=K);let q;return t[42]!==i||t[43]!==E||t[44]!==O||t[45]!==g||t[46]!==A0||t[47]!==j0||t[48]!==n||t[49]!==y||t[50]!==P||t[51]!==F||t[52]!==I||t[53]!==L||t[54]!==G||t[55]!==K||t[56]!==k||t[57]!==M||t[58]!==N?(q=(0,Z.jsxs)(`div`,{...y,...k,ref:n,className:M,role:`button`,tabIndex:N,onClick:E,onKeyDown:O,onContextMenu:g,onMouseEnter:A0,onMouseLeave:j0,\"aria-label\":P,\"aria-current\":F,\"aria-expanded\":I,\"aria-disabled\":L,children:[G,i,K]}),t[42]=i,t[43]=E,t[44]=O,t[45]=g,t[46]=A0,t[47]=j0,t[48]=n,t[49]=y,t[50]=P,t[51]=F,t[52]=I,t[53]=L,t[54]=G,t[55]=K,t[56]=k,t[57]=M,t[58]=N,t[59]=q):q=t[59],q}",
  },
  {
    id: "project_row_apply_hover_handlers_2616",
    from: "let H;t[20]!==a||t[21]!==S0?(H=(0,Z.jsx)(xa,{tooltipContent:S0,disabled:S0==null,children:(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a})}),t[20]=a,t[21]=S0,t[22]=H):H=t[22];let ee;t[23]===x?ee=t[24]:(ee=x==null?null:(0,Z.jsx)(kO,{...x}),t[23]=x,t[24]=ee);let U;t[24]!==h||t[25]!==H||t[26]!==ee?(U=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-0.5`,children:[H,h,ee]}),t[24]=h,t[25]=H,t[26]=ee,t[27]=U):U=t[27];let W;t[28]!==U||t[29]!==S?(W=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:[U,S]}),t[28]=U,t[29]=S,t[30]=W):W=t[30];let te;t[31]!==c||t[32]!==l||t[33]!==V||t[34]!==W?(te=(0,Z.jsx)(`div`,{ref:l,className:V,...c,children:W}),t[31]=c,t[32]=l,t[33]=V,t[34]=W,t[35]=te):te=t[35];let G;t[36]!==R||t[37]!==te?(G=(0,Z.jsxs)(`div`,{className:`flex min-w-0 flex-1 items-center gap-1 pl-1`,children:[R,te]}),t[36]=R,t[37]=te,t[38]=G):G=t[38];let K;t[39]===b?K=t[40]:(K=b==null?null:(0,Z.jsx)(`button`,{type:`button`,\"aria-hidden\":`true`,tabIndex:-1,className:`sr-only`,...Ha.sidebarProjectSelect,onClick:e=>{e.stopPropagation(),b.onSelect()}}),t[39]=b,t[40]=K);let q;return t[41]!==i||t[42]!==E||t[43]!==O||t[44]!==g||t[45]!==n||t[46]!==y||t[47]!==P||t[48]!==F||t[49]!==I||t[50]!==L||t[51]!==G||t[52]!==K||t[53]!==k||t[54]!==M||t[55]!==N?(q=(0,Z.jsxs)(`div`,{...y,...k,ref:n,className:M,role:`button`,tabIndex:N,onClick:E,onKeyDown:O,onContextMenu:g,\"aria-label\":P,\"aria-current\":F,\"aria-expanded\":I,\"aria-disabled\":L,children:[G,i,K]}),t[41]=i,t[42]=E,t[43]=O,t[44]=g,t[45]=n,t[46]=y,t[47]=P,t[48]=F,t[49]=I,t[50]=L,t[51]=G,t[52]=K,t[53]=k,t[54]=M,t[55]=N,t[56]=q):q=t[56],q}",
    to: "let H;t[20]!==a||t[21]!==S0?(H=S0==null?(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a}):(0,Z.jsx)(xa,{delayOpen:!0,tooltipContent:S0,children:(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a})}),t[20]=a,t[21]=S0,t[22]=H):H=t[22];let ee;t[23]===x?ee=t[24]:(ee=x==null?null:(0,Z.jsx)(kO,{...x}),t[23]=x,t[24]=ee);let U;t[25]!==h||t[26]!==H||t[27]!==ee?(U=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-0.5`,children:[H,h,ee]}),t[25]=h,t[26]=H,t[27]=ee,t[28]=U):U=t[28];let W;t[29]!==U||t[30]!==S?(W=(0,Z.jsxs)(`span`,{className:`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap`,children:[U,S]}),t[29]=U,t[30]=S,t[31]=W):W=t[31];let te;t[32]!==c||t[33]!==l||t[34]!==V||t[35]!==W?(te=(0,Z.jsx)(`div`,{ref:l,className:V,...c,children:W}),t[32]=c,t[33]=l,t[34]=V,t[35]=W,t[36]=te):te=t[36];let G;t[37]!==R||t[38]!==te?(G=(0,Z.jsxs)(`div`,{className:`flex min-w-0 flex-1 items-center gap-1 pl-1`,children:[R,te]}),t[37]=R,t[38]=te,t[39]=G):G=t[39];let K;t[40]===b?K=t[41]:(K=b==null?null:(0,Z.jsx)(`button`,{type:`button`,\"aria-hidden\":`true`,tabIndex:-1,className:`sr-only`,...Ha.sidebarProjectSelect,onClick:e=>{e.stopPropagation(),b.onSelect()}}),t[40]=b,t[41]=K);let q;return t[42]!==i||t[43]!==E||t[44]!==O||t[45]!==g||t[46]!==A0||t[47]!==j0||t[48]!==n||t[49]!==y||t[50]!==P||t[51]!==F||t[52]!==I||t[53]!==L||t[54]!==G||t[55]!==K||t[56]!==k||t[57]!==M||t[58]!==N?(q=(0,Z.jsxs)(`div`,{...y,...k,ref:n,className:M,role:`button`,tabIndex:N,onClick:E,onKeyDown:O,onContextMenu:g,onMouseEnter:A0,onMouseLeave:j0,\"aria-label\":P,\"aria-current\":F,\"aria-expanded\":I,\"aria-disabled\":L,children:[G,i,K]}),t[42]=i,t[43]=E,t[44]=O,t[45]=g,t[46]=A0,t[47]=j0,t[48]=n,t[49]=y,t[50]=P,t[51]=F,t[52]=I,t[53]=L,t[54]=G,t[55]=K,t[56]=k,t[57]=M,t[58]=N,t[59]=q):q=t[59],q}",
  },
  {
    id: "project_actions_accept_hover_state_2616",
    from: "function Rk(e){let t=(0,Q.c)(30),{group:n,threadKeys:r,collapsedStatusState:i,attentionCounts:a,connectionHostId:o,remoteHostLabel:s,projectHeaderMenuKind:c,canCreateStableWorktree:l,onStartNewThread:u,onShowProjectHome:d,newThreadLabel:f,canStartNewThread:p,newThreadDisabledLabel:h,workspaceDropdownOpen:g,onWorkspaceDropdownOpenChange:_,showProjectEditAction:v,showProjectPinAction:y}=e,",
    to: "function Rk(e){let t=(0,Q.c)(30),{group:n,threadKeys:r,collapsedStatusState:i,attentionCounts:a,connectionHostId:o,remoteHostLabel:s,projectHeaderMenuKind:c,canCreateStableWorktree:l,onStartNewThread:u,onShowProjectHome:d,newThreadLabel:f,canStartNewThread:p,newThreadDisabledLabel:h,workspaceDropdownOpen:g,onWorkspaceDropdownOpenChange:_,showProjectEditAction:v,showProjectPinAction:y,isRowHovered:__projectRowHovered}=e,",
  },
  {
    id: "project_actions_pass_hover_state_2616",
    from: "t[23]!==p||t[24]!==h||t[25]!==T||t[26]!==E||t[27]!==D||t[28]!==g?(O=(0,Z.jsx)(MO,{action:T,actionTooltipContent:h,actionTooltipDisabled:p,indicator:E,isMenuOpen:g,menu:D}),t[23]=p,t[24]=h,t[25]=T,t[26]=E,t[27]=D,t[28]=g,t[29]=O):O=t[29]",
    to: "t[23]!==p||t[24]!==h||t[25]!==T||t[26]!==E||t[27]!==D||t[28]!==g||t[30]!==__projectRowHovered?(O=(0,Z.jsx)(MO,{action:T,actionTooltipContent:h,actionTooltipDisabled:p,indicator:E,isMenuOpen:g,menu:D,isRowHovered:__projectRowHovered}),t[23]=p,t[24]=h,t[25]=T,t[26]=E,t[27]=D,t[28]=g,t[30]=__projectRowHovered,t[31]=O):O=t[31]",
  },
  {
    id: "project_actions_restore_native_hover_2616",
    from: "function MO(e){let t=(0,Q.c)(21),{action:n,actionTooltipContent:r,actionTooltipDisabled:i,indicator:a,isMenuOpen:o,menu:s}=e,c=o?`opacity-100`:`opacity-0 group-hover/folder-row:opacity-100`,l;t[0]!==c||t[1]!==s?(l=s==null?null:(0,Z.jsx)(`div`,{className:c,children:s}),t[0]=c,t[1]=s,t[2]=l):l=t[2];let u;t[3]!==a||t[4]!==o?(u=a==null?null:(0,Z.jsx)(`div`,{className:Pi(`absolute inset-y-0 right-0 flex items-center justify-end group-hover/folder-row:hidden`,o&&`hidden`),children:a}),t[3]=a,t[4]=o,t[5]=u):u=t[5];let d=i??r==null,f;t[6]===c?f=t[7]:(f=Pi(`inline-flex`,c),t[6]=c,t[7]=f);let p;t[8]!==n||t[9]!==f?(p=(0,Z.jsx)(`span`,{className:f,children:n}),t[8]=n,t[9]=f,t[10]=p):p=t[10];let m;t[11]!==r||t[12]!==d||t[13]!==p?(m=(0,Z.jsx)(xa,{tooltipContent:r,delayOpen:!0,disabled:d,children:p}),t[11]=r,t[12]=d,t[13]=p,t[14]=m):m=t[14];let h;t[15]!==u||t[16]!==m?(h=(0,Z.jsxs)(`div`,{className:`relative mr-0.5 h-6 min-w-6 shrink-0`,children:[u,m]}),t[15]=u,t[16]=m,t[17]=h):h=t[17];let g;return t[18]!==l||t[19]!==h?(g=(0,Z.jsxs)(`div`,{className:`flex gap-1`,onClick:FO,onKeyDown:PO,onPointerDown:NO,children:[l,h]}),t[18]=l,t[19]=h,t[20]=g):g=t[20],g}",
    to: "function MO(e){let t=(0,Q.c)(25),{action:n,actionTooltipContent:r,actionTooltipDisabled:i,indicator:a,isMenuOpen:o,menu:s,isRowHovered:_}=e,v=!!_||o,y=!v&&a==null,b=y?{width:0,minWidth:0,overflow:`hidden`,pointerEvents:`none`}:void 0,c=v?`opacity-100`:`opacity-0 group-hover/folder-row:opacity-100`,l;t[0]!==c||t[1]!==s||t[2]!==b?(l=s==null?null:(0,Z.jsx)(`div`,{style:b,className:c,children:s}),t[0]=c,t[1]=s,t[2]=b,t[3]=l):l=t[3];let u;t[4]!==a||t[5]!==o?(u=a==null?null:(0,Z.jsx)(`div`,{className:Pi(`absolute inset-y-0 right-0 flex items-center justify-end group-hover/folder-row:hidden`,o&&`hidden`),children:a}),t[4]=a,t[5]=o,t[6]=u):u=t[6];let d=i??r==null,f;t[7]===c?f=t[8]:(f=Pi(`inline-flex`,c),t[7]=c,t[8]=f);let p;t[9]!==n||t[10]!==f?(p=(0,Z.jsx)(`span`,{className:f,children:n}),t[9]=n,t[10]=f,t[11]=p):p=t[11];let m;t[12]!==r||t[13]!==d||t[14]!==p?(m=(0,Z.jsx)(xa,{tooltipContent:r,delayOpen:!0,disabled:d,children:p}),t[12]=r,t[13]=d,t[14]=p,t[15]=m):m=t[15];let h;t[16]!==u||t[17]!==m||t[18]!==b?(h=(0,Z.jsxs)(`div`,{style:b,className:`relative mr-0.5 h-6 min-w-6 shrink-0`,children:[u,m]}),t[16]=u,t[17]=m,t[18]=b,t[19]=h):h=t[19];let g;return t[20]!==l||t[21]!==h||t[22]!==b?(g=(0,Z.jsxs)(`div`,{style:b,className:`flex gap-1`,onClick:FO,onKeyDown:PO,onPointerDown:NO,children:[l,h]}),t[20]=l,t[21]=h,t[22]=b,t[23]=g):g=t[23],g}",
  },
  {
    id: "project_expand_toggle_zero_width_when_hidden_2616",
    from: "className:`-ml-1 flex h-5 w-5 shrink-0 cursor-interaction items-center justify-center rounded-sm text-token-foreground opacity-0 group-hover/folder-row:opacity-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`",
    to: "className:`flex h-5 w-0 min-w-0 shrink-0 cursor-interaction items-center justify-center overflow-hidden rounded-sm text-token-foreground opacity-0 pointer-events-none group-hover/folder-row:-ml-1 group-hover/folder-row:w-5 group-hover/folder-row:pointer-events-auto group-hover/folder-row:opacity-100 focus-visible:-ml-1 focus-visible:w-5 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`",
  },
  {
    id: "replace_plugins_nav_icon",
    from: "t?(0,Z.jsx)(zh,{icon:Al,onClick:()=>{AT(i,s)},isActive:c.pathname.startsWith(`/skills`),label:l?(0,Z.jsxs)(`span`,{className:`inline-flex items-center gap-1`,children:[(0,Z.jsx)(X,{id:`sidebarElectron.skillsAppsRouteNavLink`,defaultMessage:`Plugins`,description:`Nav link that opens the skills and apps page`}),(0,Z.jsx)(cE,{chipConfig:XT})]}):(0,Z.jsx)(X,{id:`sidebarElectron.skillsRouteNavLink`,defaultMessage:`Skills`,description:`Nav link that opens the skills page`})})",
    to: "t?(0,Z.jsx)(zh,{icon:e=>(0,Z.jsx)(`svg`,{width:20,height:20,viewBox:`0 0 20 20`,fill:`none`,xmlns:`http://www.w3.org/2000/svg`,...e,children:(0,Z.jsx)(`path`,{d:`M7.94562 14.0277C7.94556 12.9376 7.0621 12.054 5.97198 12.054C4.88197 12.0542 3.99841 12.9377 3.99835 14.0277C3.99835 15.1178 4.88194 16.0012 5.97198 16.0013C7.06213 16.0013 7.94562 15.1178 7.94562 14.0277ZM16.0013 14.0277C16.0012 12.9376 15.1178 12.054 14.0276 12.054C12.9376 12.0541 12.0541 12.9376 12.054 14.0277C12.054 15.1178 12.9376 16.0013 14.0276 16.0013C15.1178 16.0013 16.0013 15.1178 16.0013 14.0277ZM7.94562 5.97202C7.9455 4.88197 7.06206 3.99838 5.97198 3.99838C4.88201 3.9985 3.99847 4.88204 3.99835 5.97202C3.99835 7.06209 4.88194 7.94553 5.97198 7.94565C7.06213 7.94565 7.94562 7.06216 7.94562 5.97202ZM16.0013 5.97202C16.0012 4.88197 15.1177 3.99838 14.0276 3.99838C12.9376 3.99844 12.0541 4.882 12.054 5.97202C12.054 7.06213 12.9375 7.94559 14.0276 7.94565C15.1178 7.94565 16.0013 7.06216 16.0013 5.97202ZM9.2757 14.0277C9.2757 15.8524 7.79667 17.3314 5.97198 17.3314C4.1474 17.3313 2.66827 15.8523 2.66827 14.0277C2.66833 12.2031 4.14743 10.7241 5.97198 10.724C7.79664 10.724 9.27564 12.203 9.2757 14.0277ZM17.3314 14.0277C17.3314 15.8524 15.8523 17.3314 14.0276 17.3314C12.203 17.3313 10.7239 15.8523 10.7239 14.0277C10.724 12.2031 12.203 10.724 14.0276 10.724C15.8523 10.724 17.3313 12.203 17.3314 14.0277ZM9.2757 5.97202C9.2757 7.7967 7.79667 9.27573 5.97198 9.27573C4.1474 9.27561 2.66827 7.79663 2.66827 5.97202C2.66839 4.1475 4.14747 2.66842 5.97198 2.6683C7.7966 2.6683 9.27558 4.14743 9.2757 5.97202ZM17.3314 5.97202C17.3314 7.7967 15.8523 9.27573 14.0276 9.27573C12.203 9.27567 10.7239 7.79667 10.7239 5.97202C10.7241 4.14746 12.2031 2.66836 14.0276 2.6683C15.8523 2.6683 17.3312 4.14743 17.3314 5.97202Z`,fill:`currentColor`})}),onClick:()=>{AT(i,s)},isActive:c.pathname.startsWith(`/skills`),label:l?(0,Z.jsxs)(`span`,{className:`inline-flex items-center gap-1`,children:[(0,Z.jsx)(X,{id:`sidebarElectron.skillsAppsRouteNavLink`,defaultMessage:`Plugins`,description:`Nav link that opens the skills and apps page`}),(0,Z.jsx)(cE,{chipConfig:XT})]}):(0,Z.jsx)(X,{id:`sidebarElectron.skillsRouteNavLink`,defaultMessage:`Skills`,description:`Nav link that opens the skills page`})})",
  },
  {
    id: "remove_new_chat_item",
    from: "children:[(0,Z.jsx)(fE,{canStartProjectlessChat:d,newChatMessage:T,onStartChat:D}),(0,Z.jsx)(pE,{onOpen:E}),",
    to: "children:[null,(0,Z.jsx)(pE,{onOpen:E}),",
  },
  {
    id: "project_row_track_hover_state",
    from: "let ce=se,[le,ue]=(0,$.useState)(!1),de=n.projectKind===`remote`&&n.hostId==null,fe;",
    to: "let ce=se,[le,ue]=(0,$.useState)(!1),[__projectRowHovered,__setProjectRowHovered]=(0,$.useState)(!1),de=n.projectKind===`remote`&&n.hostId==null,fe;",
  },
  {
    id: "project_row_pass_hover_state_to_actions",
    from: "Le=(0,Z.jsx)(mk,{group:n,threadKeys:n.threadKeys,collapsedStatusState:Me,attentionCounts:Ne,projectHeaderMenuKind:V,canCreateStableWorktree:Pe,onStartNewThread:ge,onShowProjectHome:_e,newThreadLabel:ce,canStartNewThread:Fe,newThreadDisabledLabel:Ie,workspaceDropdownOpen:le,onWorkspaceDropdownOpenChange:ue,showProjectPinAction:u})",
    to: "Le=(0,Z.jsx)(mk,{group:n,threadKeys:n.threadKeys,collapsedStatusState:Me,attentionCounts:Ne,projectHeaderMenuKind:V,canCreateStableWorktree:Pe,onStartNewThread:ge,onShowProjectHome:_e,newThreadLabel:ce,canStartNewThread:Fe,newThreadDisabledLabel:Ie,workspaceDropdownOpen:le,onWorkspaceDropdownOpenChange:ue,showProjectPinAction:u,isRowHovered:__projectRowHovered})",
  },
  {
    id: "project_row_pass_hover_state",
    from: "Ve=(0,Z.jsx)(we,{rowAttributes:Te,className:Ee,collapsed:F,contentClassName:De,dragHandleListeners:Oe,dragHandleRef:ke,icon:Ae,isActive:I,label:O,labelEnd:U,onPress:ye,onContextMenu:je,projectId:D,actions:Le,selectAction:Re,toggle:ze,trailingContent:Be,children:n.label})",
    to: "Ve=(0,Z.jsx)(we,{rowAttributes:Te,className:Ee,collapsed:F,contentClassName:De,dragHandleListeners:Oe,dragHandleRef:ke,icon:Ae,isActive:I,label:O,labelEnd:U,onPress:ye,onContextMenu:je,projectId:D,actions:Le,selectAction:Re,toggle:ze,trailingContent:Be,labelTooltipContent:n.path??null,children:n.label,onMouseEnter:()=>{__setProjectRowHovered(!0)},onMouseLeave:()=>{__setProjectRowHovered(!1)}})",
  },
  {
    id: "project_actions_use_hover_state",
    from: "function mk(e){let t=(0,Q.c)(50),{group:n,threadKeys:r,collapsedStatusState:i,attentionCounts:a,projectHeaderMenuKind:o,canCreateStableWorktree:s,onStartNewThread:c,onShowProjectHome:l,newThreadLabel:u,canStartNewThread:d,newThreadDisabledLabel:f,workspaceDropdownOpen:p,onWorkspaceDropdownOpenChange:m,showProjectPinAction:g}=e,_=h(Es),v=h(_f),y=h(sf),b=p?`opacity-100`:`opacity-0 group-hover/folder-row:opacity-100`,x;",
    to: "function mk(e){let t=(0,Q.c)(50),{group:n,threadKeys:r,collapsedStatusState:i,attentionCounts:a,projectHeaderMenuKind:o,canCreateStableWorktree:s,onStartNewThread:c,onShowProjectHome:l,newThreadLabel:u,canStartNewThread:d,newThreadDisabledLabel:f,workspaceDropdownOpen:p,onWorkspaceDropdownOpenChange:m,showProjectPinAction:g,isRowHovered:h0}=e,_=h(Es),v=h(_f),y=h(sf),b=h0||p?`opacity-100`:`opacity-0`,x;",
  },
  {
    id: "project_local_menu_zero_width_when_hidden",
    from: "x=o===`local`&&(0,Z.jsx)(`div`,{className:b,children:(0,Z.jsx)(xk,{project:n,threadKeys:r,currentThreadKey:_,canCreateStableWorktree:s,workspaceRootOptions:v,workspaceRootLabels:y,onArchivedCurrentThread:l,open:p,onOpenChange:m,showProjectPinAction:g})})",
    to: "x=o===`local`&&(0,Z.jsx)(`div`,{style:h0||p?void 0:{width:0,overflow:`hidden`,pointerEvents:`none`},className:b,children:(0,Z.jsx)(xk,{project:n,threadKeys:r,currentThreadKey:_,canCreateStableWorktree:s,workspaceRootOptions:v,workspaceRootLabels:y,onArchivedCurrentThread:l,open:p,onOpenChange:m,showProjectPinAction:g})})",
  },
  {
    id: "project_remote_menu_zero_width_when_hidden",
    from: "S=o===`remote`&&n.path!=null&&(0,Z.jsx)(`div`,{className:b,children:(0,Z.jsx)(wk,{hostId:n.hostId,projectId:n.projectId,remotePath:n.path,groupLabel:n.label,threadKeys:r,currentThreadKey:_,onArchivedCurrentThread:l,open:p,onOpenChange:m,showProjectPinAction:g})})",
    to: "S=o===`remote`&&n.path!=null&&(0,Z.jsx)(`div`,{style:h0||p?void 0:{width:0,overflow:`hidden`,pointerEvents:`none`},className:b,children:(0,Z.jsx)(wk,{hostId:n.hostId,projectId:n.projectId,remotePath:n.path,groupLabel:n.label,threadKeys:r,currentThreadKey:_,onArchivedCurrentThread:l,open:p,onOpenChange:m,showProjectPinAction:g})})",
  },
  {
    id: "project_new_thread_zero_width_when_hidden",
    from: "let k;t[36]!==w||t[37]!==O?(k=(0,Z.jsx)(`span`,{className:w,children:O}),t[36]=w,t[37]=O,t[38]=k):k=t[38];",
    to: "let k;t[36]!==h0||t[37]!==p||t[38]!==w||t[39]!==O?(k=(0,Z.jsx)(`span`,{style:h0||p?void 0:{width:0,overflow:`hidden`,pointerEvents:`none`},className:w,children:O}),t[36]=h0,t[37]=p,t[38]=w,t[39]=O,t[40]=k):k=t[40];",
  },
  {
    id: "project_status_slot_zero_width_without_status_or_hover",
    from: "let j;t[43]!==A||t[44]!==C?(j=(0,Z.jsxs)(`div`,{className:`relative mr-0.5 h-6 min-w-6 shrink-0`,children:[C,A]}),t[43]=A,t[44]=C,t[45]=j):j=t[45];",
    to: "let j;t[43]!==h0||t[44]!==p||t[45]!==i||t[46]!==A||t[47]!==C?(j=h0||p||i!=null?(0,Z.jsxs)(`div`,{className:`relative mr-0.5 h-6 min-w-6 shrink-0`,children:[C,A]}):(0,Z.jsx)(`div`,{style:{width:0,overflow:`hidden`}}),t[43]=h0,t[44]=p,t[45]=i,t[46]=A,t[47]=C,t[48]=j):j=t[48];",
  },
  {
    id: "project_row_accept_label_tooltip_and_hover_handlers",
    from: "function TO(e){let t=(0,Q.c)(57),{ref:n,className:r,actions:i,children:a,collapsed:o,contentClassName:s,dragHandleListeners:c,dragHandleRef:l,icon:u,isActive:d,isDisabled:f,label:p,labelEnd:m,onContextMenu:h,onPress:g,projectId:_,rowAttributes:v,selectAction:y,toggle:b,trailingContent:x}=e,",
    to: "function TO(e){let t=(0,Q.c)(57),{ref:n,className:r,actions:i,children:a,collapsed:o,contentClassName:s,dragHandleListeners:c,dragHandleRef:l,icon:u,isActive:d,isDisabled:f,label:p,labelEnd:m,onContextMenu:h,onMouseEnter:A0,onMouseLeave:j0,onPress:g,projectId:_,rowAttributes:v,selectAction:y,toggle:b,trailingContent:x,labelTooltipContent:S0}=e,",
  },
  {
    id: "project_row_bind_tooltip_wrapper",
    from: "let B;t[20]===a?B=t[21]:(B=(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a}),t[20]=a,t[21]=B);let V;t[22]===b?V=t[23]:(V=b==null?null:(0,Z.jsx)(EO,{...b}),t[22]=b,t[23]=V);",
    to: "let B;t[20]!==a||t[21]!==S0?(B=(0,Z.jsx)(qa,{delayOpen:0,tooltipContent:S0,disabled:S0==null,children:(0,Z.jsx)(`span`,{className:`min-w-0 truncate pr-1`,children:a})}),t[20]=a,t[21]=S0,t[22]=B):B=t[22];let V;t[23]===b?V=t[24]:(V=b==null?null:(0,Z.jsx)(EO,{...b}),t[23]=b,t[24]=V);",
  },
  {
    id: "project_row_bind_hover_handlers",
    from: "onClick:T,onKeyDown:D,onContextMenu:h,\"aria-label\":p,\"aria-current\":N,\"aria-expanded\":P,\"aria-disabled\":F,children:[G,i,K]}),t[41]=i,t[42]=T,t[43]=D,t[44]=p,t[45]=h,t[46]=n,t[47]=v,t[48]=N,t[49]=P,t[50]=F,t[51]=G,t[52]=K,t[53]=O,t[54]=j,t[55]=M,t[56]=q):q=t[56],q}",
    to: "onClick:T,onKeyDown:D,onContextMenu:h,onMouseEnter:A0,onMouseLeave:j0,\"aria-label\":p,\"aria-current\":N,\"aria-expanded\":P,\"aria-disabled\":F,children:[G,i,K]}),t[41]=i,t[42]=T,t[43]=D,t[44]=p,t[45]=h,t[46]=A0,t[47]=j0,t[48]=n,t[49]=v,t[50]=N,t[51]=P,t[52]=F,t[53]=G,t[54]=K,t[55]=O,t[56]=j,t[57]=M,t[58]=q):q=t[58],q}",
  },
];

function locateTargets(platform) {
  const platforms = platform
    ? [platform]
    : ["mac-arm64", "mac-x64", "win"].filter((p) =>
        fs.existsSync(path.join(SRC_DIR, p, "_asar", "webview", "assets")),
      );

  const targets = [];
  for (const plat of platforms) {
    const dir = path.join(SRC_DIR, plat, "_asar", "webview", "assets");
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!/^app-main-.*\.js$/.test(file)) continue;
      targets.push({ platform: plat, path: path.join(dir, file) });
    }
  }
  return targets;
}

function collectPatches(source) {
  const patches = [];
  for (const rule of RULES) {
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

function hasPendingSidebarTargets(source) {
  return source.includes(RULES[0].from) || source.includes(RULES[4].from) || source.includes(RULES[10].from);
}

function hasSidebarFootprint(source) {
  return source.includes("canStartProjectlessChat")
    && source.includes("group-hover/folder-row")
    && source.includes("function TO(e)");
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check");
  const platform = args.find((a) => ["mac-arm64", "mac-x64", "win"].includes(a));

  const targets = locateTargets(platform);
  if (targets.length === 0) {
    console.log("  [skip] No app-main-*.js found under src/*/_asar/webview/assets");
    return;
  }

  let patchedCount = 0;
  let unresolved = 0;

  for (const target of targets) {
    const source = fs.readFileSync(target.path, "utf-8");
    const patches = collectPatches(source);

    if (patches.length === 0) {
      if (hasSidebarFootprint(source) && hasPendingSidebarTargets(source)) {
        console.log(`  [${target.platform}] [!] sidebar patch targets changed: ${relPath(target.path)}`);
        unresolved += 1;
      } else {
        console.log(`  [${target.platform}] [ok] no changes needed: ${relPath(target.path)}`);
      }
      continue;
    }

    console.log(`  [${target.platform}] ${relPath(target.path)} => ${patches.length} patch(es)`);

    if (isCheck) {
      for (const patch of patches) {
        console.log(`    [?] ${patch.id}: ${patch.original.slice(0, 160)}${patch.original.length > 160 ? "..." : ""} -> ${patch.replacement}`);
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

  if (!isCheck) {
    if (unresolved > 0) {
      console.log(`  [x] unresolved sidebar layout targets: ${unresolved}`);
      process.exit(1);
    }
    if (patchedCount === 0) {
      console.log("  [ok] sidebar layout already patched");
    } else {
      console.log(`  [ok] applied ${patchedCount} sidebar layout patch(es)`);
    }
  }
}

main();
