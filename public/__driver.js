window.__res = window.__res || [];
window.__warn = [];
const ow = console.warn; console.warn = (...a) => { window.__warn.push(a.map(x => String(x?.message ?? x)).join(' ').slice(0, 300)); ow(...a); };
window.__sweep = async (maxWaitMs = 600000) => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const section = () => [...document.querySelectorAll('button')].filter(b => /浏览器权重|MB|runtime/.test(b.textContent) && b.textContent.includes('·')).slice(0, 12);
  const names = [...new Set(section().map(b => b.firstElementChild?.textContent?.trim() || b.textContent.slice(0, 30)))];
  const n = section().length;
  for (let i = 0; i < n; i++) {
    const btn = section()[i]; if (!btn) break;
    const name = btn.textContent.slice(0, 40);
    window.__warn.length = 0;
    btn.click(); await sleep(800);
    const run = [...document.querySelectorAll('button')].find(x => /运行推理|重新运行/.test(x.textContent));
    run?.click();
    const t0 = Date.now();
    await sleep(1500);
    let txt = '';
    while (Date.now() - t0 < maxWaitMs) {
      txt = document.body.innerText;
      const i0 = txt.lastIndexOf('输出\n');
      const out = txt.slice(i0, i0 + 900);
      if (/耗时|失败|错误|Error/.test(out) && !/下载权重 |准备权重|推理…|…/.test(out.slice(0, 120))) { txt = out; break; }
      await sleep(1500);
    }
    window.__res.push({ name, real: /真实权重/.test(txt), demo: /演示模式/.test(txt), ms: (txt.match(/耗时 (\d+)/) || [])[1], warn: [...window.__warn], head: txt.slice(0, 160).replace(/\n/g, ' | ') });
  }
  window.__done = true;
};
