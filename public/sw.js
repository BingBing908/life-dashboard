/* 极简 service worker——存在的理由有两个，别往里加花样：
 *
 * ① **安卓 Chrome 的「安装应用」要求站点有一个带 fetch 处理器的 SW**，没有就只能
 *    「添加到主屏幕」做成快捷方式，不是独立 app（iOS 不看这个，它只认 apple-mobile-web-app-capable）。
 *    Rosie 说「安卓适配度比较低」，这是其中一条实打实的缺口。
 * ② 顺带给了离线可用：她的数据本来就在本地 SQLite/sql.js 里，缺的只是外壳。
 *
 * ⚠️⚠️ **缓存策略必须是「HTML 走网络优先、hashed 资源才走缓存优先」**，别图省事全缓存：
 * Vite 产出的 assets/xxx-<hash>.js 文件名带内容哈希、改了就换名，缓存它们永远不会给出旧代码；
 * 而 index.html 名字不变，一旦缓存优先，她就会**一直打开旧版本的 app**——
 * 这对一个每天都在改的工具是最糟的 bug，而且极难察觉（她会以为我没发版）。
 */
const CACHE = "pwt-shell-v1";

self.addEventListener("install", (e) => {
  // 新版本立刻接管，不要等所有标签页关掉——否则她刷新了还是旧的
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 只管自己这个源；Supabase 的请求一律放行，绝不缓存（缓存了会读到过期数据）
  if (url.origin !== self.location.origin) return;

  const isHashedAsset = /\/assets\/.+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?)$/.test(url.pathname);

  if (isHashedAsset) {
    // 文件名带哈希＝内容不可变，缓存优先最划算
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 其余（index.html / manifest / 图标）＝网络优先，断网才回落到缓存
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match(self.registration.scope))),
  );
});
