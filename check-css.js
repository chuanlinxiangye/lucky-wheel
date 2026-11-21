// 审计：HTML/JS 用到的 class/id 是否都有对应 CSS 定义（防再次漏样式）
'use strict';
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const cssClasses = new Set([...style.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
const cssIds = new Set([...style.matchAll(/#([a-zA-Z][\w-]*)/g)].map(m => m[1]));

// JS 动态创建/切换的 class（最容易漏的）
const usedClasses = new Set();
for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && usedClasses.add(c));
for (const m of script.matchAll(/classList\.(?:add|remove)\('([^']+)'/g)) usedClasses.add(m[1]);
for (const m of script.matchAll(/className = '([^']+)'/g)) m[1].split(/\s+/).forEach(c => c && usedClasses.add(c));

// JS 里 getElementById 引用的 id
const jsIds = new Set([...script.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));

const criticalClasses = ['modal', 'show', 'modal-card', 'toast', 'error', 'wheel-tab', 'active', 'panel-close', 'open', 'inline-edit', 'tab-name', 'item-name', 'btn-del', 'swatch', 'swatches'];
const missing = criticalClasses.filter(c => !cssClasses.has(c));
const missingIds = [...jsIds].filter(i => !cssIds.has(i) && !document_only(i));

function document_only(id) {
  // 这些 id 只在 HTML 静态使用、JS 绑定事件，不需要 CSS 样式
  return ['item-name', 'item-weight', 'btn-add', 'theme-name', 'btn-create-theme', 'btn-add-color', 'btn-remove-color', 'btn-close-modal', 'btn-again', 'btn-spin', 'wheel', 'panel', 'btn-open-panel', 'btn-close-panel', 'btn-install', 'install-banner', 'install-hint', 'remove-winner', 'theme-select', 'item-list', 'custom-themes', 'draft-colors', 'btn-close-panel'].includes(id);
}

console.log('JS 动态 class 缺失 CSS:', missing.length ? missing.join(', ') : '无 ✓');
console.log('JS 引用 id 缺失 CSS（应无碍的已排除）:', missingIds.length ? missingIds.join(', ') : '无 ✓');
console.log('modal 样式存在:', cssClasses.has('modal') && cssClasses.has('modal-card') ? '✓' : '✗ 仍缺失!');
console.log('toast 样式存在:', cssClasses.has('toast') ? '✓' : '✗ 仍缺失!');
