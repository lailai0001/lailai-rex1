// 河豚4K for REX (lai_hetun4k v1.0.0)
// 移植自 LeeCatPaw 的 lee_hetun4k（只读蓝图）：RSA-1024 握手 + AES-256-ECB
// 签名 + AES-128-CBC 设备参数 + protobuf，REX 沙箱没有加密库，加密全部放在
// Railway 的 javsb-relay（/ht 接口）上做，模块只调 Railway 的 HTTP 接口。
// 上游域名动态取自腾讯 COS az1.txt；握手换 dynamicKey，失败时回退内置公钥。
// 接口全是文字请求，播放直链由 App 直接播，不走 Railway 播放额度。
// 分类（7 个真实分类，站方 getCategory 返回）：电影 21、剧集 22、动漫 25、
// 综艺 26、短剧 27、漫剧 28、直播 29。
// 详情按清晰度/来源分线（蓝光4k 置顶）；集 token 为直链或 base64 JSON，
// 点集后由 Relay /play 调 videoUsableUrl 解出直链。

// v1.0.3（seasons + episodeItems）：loadDetail 同时返回 REX episodes 与参考文件那套 seasons/episodeItems；
//   videoUrl 为 loadResource 解析后能直接播的地址（先调 /play 解出并带回鉴权头，8 路并行、逐线探活、死线整线跳过）；
//   平台页线路（优酷/B站等）整线跳过；type 改为 "link"（与参考文件一致）。loadResource 原样保留。
WidgetMetadata = {
  id: "lai_hetun4k",
  title: "河豚4K",
  description: "河豚4K：电影/剧集/动漫/综艺/短剧/漫剧/直播，走 Railway 中转 RSA/AES/protobuf 接口",
  author: "lai",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  site: "https://javsb-relay-production.up.railway.app/ht",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "🆕推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎬电影", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "21" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📺剧集", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎌动漫", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "25" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎤综艺", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "26" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎭短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "27" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📖漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "28" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📡直播", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "29" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var WORKER = "https://javsb-relay-production.up.railway.app/ht";
var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson(path) {
  try {
    var res = await Widget.http.get(WORKER + path, {
      headers: { "User-Agent": UA, "Accept": "application/json" }
    });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

function toCard(it) {
  var id = t(it.vod_id);
  if (!id) return null;
  var pic = t(it.vod_pic);
  var name = clean(it.vod_name) || "河豚4K";
  var remarks = clean(it.vod_remarks);
  if (it.vod_year) remarks = (remarks ? remarks + " · " : "") + t(it.vod_year);
  if (it.vod_area) remarks = (remarks ? remarks + " · " : "") + clean(it.vod_area);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: remarks,
    mediaType: "movie"
  };
}

function toList(j) {
  var out = [];
  if (!j || !j.list) return out;
  for (var i = 0; i < j.list.length; i++) {
    var c = toCard(j.list[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var j = null;
    if (!cat || cat === "home") {
      j = await getJson("/home");
    } else {
      j = await getJson("/category?id=" + encodeURIComponent(cat) + "&page=" + page);
    }
    var list = toList(j);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "载入失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

function pickKeyword(params) {
  if (params == null) return "";
  if (typeof params === "string" || typeof params === "number") return String(params).trim();
  var keys = ["keyword", "q", "search", "text", "query", "wd", "key"];
  for (var i = 0; i < keys.length; i++) {
    if (params[keys[i]]) return String(params[keys[i]]).trim();
  }
  return "";
}

async function search(params) {
  params = params || {};
  var wd = pickKeyword(params);
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var j = await getJson("/search?wd=" + encodeURIComponent(wd) + "&page=" + page);
    var list = toList(j);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function resolvePlay(cand) {
  try {
    var j = await getJson("/play?id=" + encodeURIComponent(cand.url));
    if (j && j.url) return j;
  } catch (e) { /* fall through */ }
  return null;
}


// ---------- v1.0.3 新增：seasons / episodeItems（照参考文件 upload-3.js 的结构） ----------
// 参考文件返回的 detail 含 seasons[]（每季 {seasonNumber, episodes: [{videoUrl, title, episodeNumber, customHeaders}]}）
// 与 episodeItems[]（每项 {id: videoUrl, type: "url", title, mediaType, posterPath, videoUrl, link: videoUrl,
// episode, episodeNumber, seasonIndex, seasonNumber, customHeaders, playerType: "system"}），
// App 渲染的正是这套；REX 的 episodes 数组不被渲染，故两套同时返回。
// videoUrl 必须是 loadResource 解析后能直接播的地址：先调 /play 解出（与 loadResource 同款逻辑，
// /play 给的鉴权头一并带回），解不出且 token 本身是视频格式才透传；平台页地址（优酷/腾讯/爱奇艺/B站）
// 不是视频流，一律跳过；解不出的集跳过，不填空地址、不编假地址。
function isPlayableUrl(url) {
  var u = String(url || "");
  if (u.indexOf("http") !== 0) return false;
  var low = u.toLowerCase();
  if (/\.html?([?#]|$)/.test(low)) return false;
  if (low.indexOf("/v_show/") >= 0) return false;
  if (low.indexOf("iqiyi.com/v_") >= 0) return false;
  if (low.indexOf("v.qq.com/") >= 0) return false;
  if (low.indexOf("bilibili.com/bangumi") >= 0) return false;
  return true;
}

function epNumOf(name, fallback) {
  var m = String(name || "").match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return fallback;
}

// 单集解析：先调 /play（与 loadResource 同款），解不出且 token 本身是视频格式才透传。返回 {url, headers} 或 null。
async function resolveOne(tk) {
  var pj = await resolvePlay({ url: tk.epUrl });
  if (pj && pj.url && isPlayableUrl(pj.url)) {
    var h = { "User-Agent": UA, "Referer": WORKER + "/" };
    if (pj.headers) {
      for (var k in pj.headers) { h[k] = pj.headers[k]; }
    }
    return { url: String(pj.url), headers: h };
  }
  if (isVideoFormat(tk.epUrl)) {
    return { url: tk.epUrl, headers: { "User-Agent": UA, "Referer": WORKER + "/" } };
  }
  return null;
}

async function loadDetail(link) {
  try {
    var id = t(link);
    // link 可能是纯数字 id，也可能是 Worker 详情地址
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson("/detail?id=" + encodeURIComponent(id));
    if (!j || !j.list || !j.list.length) {
      return { id: id, type: "url", title: "详情获取失败", description: "Relay 无返回" };
    }
    var v = j.list[0];
    var title = clean(v.vod_name) || "河豚4K";
    var pic = t(v.vod_pic);
    var descParts = [];
    if (v.vod_remarks) descParts.push(clean(v.vod_remarks));
    if (v.type_name) descParts.push("类型：" + clean(v.type_name));
    if (v.vod_area) descParts.push("地区：" + clean(v.vod_area));
    if (v.vod_year) descParts.push("年份：" + clean(v.vod_year));
    if (v.vod_director) descParts.push("导演：" + clean(v.vod_director));
    if (v.vod_actor) descParts.push("演员：" + clean(v.vod_actor));
    if (v.vod_content) descParts.push(clean(v.vod_content));
    // 原始分集（取数逻辑与 1.0.2 相同）：vod_play_from / vod_play_url 用 $$$ 分线、# 分集。
    var rawLines = [];
    var fromArr = String(v.vod_play_from || "").split("$$$");
    var urlArr = String(v.vod_play_url || "").split("$$$");
    for (var li = 0; li < fromArr.length; li++) {
      var lineName = clean(fromArr[li]);
      if (!lineName) continue;
      var eps = [];
      var parts = String(urlArr[li] || "").split("#");
      for (var ei = 0; ei < parts.length; ei++) {
        var ep = String(parts[ei] || "");
        var dollar = ep.indexOf("$");
        if (dollar < 0) continue;
        var epName = clean(ep.slice(0, dollar));
        var epUrl = t(ep.slice(dollar + 1));
        if (!epName || !epUrl) continue;
        eps.push({ name: lineName + "·" + epName, epName: epName, epUrl: epUrl, lineName: lineName, token: lineName + "@@" + epUrl, epNum: epNumOf(epName, ei + 1) });
      }
      if (eps.length) rawLines.push({ lineName: lineName, eps: eps });
    }
    // 带缓存的并行解析：同一集只解一次；8 路并发（单集 /play 约 1-2 秒，
    // 串行解 147/320 集要几分钟，并行是唯一可行的办法；探活已解出的集直接用缓存，不重复请求）。
    var cache = {};
    async function cached(tk) {
      var k = tk.lineName + "@@" + tk.epUrl;
      if (cache[k] !== undefined) return cache[k];
      var r = null;
      try { r = await resolveOne(tk); } catch (e) { r = null; }
      cache[k] = r;
      return r;
    }
    async function pool(tasks, limit) {
      var out = [];
      var next = 0;
      var n = tasks.length;
      for (var i = 0; i < n; i++) out.push(null);
      async function worker() {
        while (next < n) {
          var idx = next;
          next = next + 1;
          out[idx] = await cached(tasks[idx]);
        }
      }
      var workers = [];
      var wc = Math.min(limit, n);
      if (wc < 1) wc = 1;
      for (var w = 0; w < wc; w++) workers.push(worker());
      await Promise.all(workers);
      return out;
    }
    // 逐线探活：先解每线第 1 集（直链线无需探活）；解不出再试第 2 集；
    // 两集都解不出（或都解成平台页）整线跳过，不再为它发请求。
    var liveLines = [];
    var probeTasks = [];
    var probeIdx = [];
    for (var pi = 0; pi < rawLines.length; pi++) {
      if (isVideoFormat(rawLines[pi].eps[0].epUrl)) { liveLines.push(rawLines[pi]); continue; }
      probeTasks.push(rawLines[pi].eps[0]);
      probeIdx.push(pi);
    }
    var probeRes = await pool(probeTasks, 8);
    var deadIdx = [];
    for (var qi = 0; qi < probeTasks.length; qi++) {
      if (probeRes[qi]) liveLines.push(rawLines[probeIdx[qi]]);
      else deadIdx.push(probeIdx[qi]);
    }
    var retryTasks = [];
    var retryIdx = [];
    for (var di = 0; di < deadIdx.length; di++) {
      var dl = rawLines[deadIdx[di]];
      if (dl.eps.length > 1) { retryTasks.push(dl.eps[1]); retryIdx.push(deadIdx[di]); }
    }
    var retryRes = await pool(retryTasks, 8);
    for (var si = 0; si < retryTasks.length; si++) {
      if (retryRes[si]) liveLines.push(rawLines[retryIdx[si]]);
    }
    liveLines.sort(function (a, b) { return rawLines.indexOf(a) - rawLines.indexOf(b); });
    // 全量解析存活线路的集
    var flat = [];
    for (var fi = 0; fi < liveLines.length; fi++) {
      for (var fj = 0; fj < liveLines[fi].eps.length; fj++) flat.push(liveLines[fi].eps[fj]);
    }
    var flatRes = await pool(flat, 8);
    // 组装两套字段：REX episodes（原样兼容）+ 参考文件那套 seasons / episodeItems。
    var episodes = [];
    var seasons = [];
    var episodeItems = [];
    var ptr = 0;
    for (var gi = 0; gi < liveLines.length; gi++) {
      var gl = liveLines[gi];
      var sn = seasons.length + 1;
      var sEps = [];
      for (var gj = 0; gj < gl.eps.length; gj++) {
        var tk = gl.eps[gj];
        var r = flatRes[ptr];
        ptr = ptr + 1;
        if (!r) continue;
        var hdrs = r.headers || {};
        sEps.push({ title: tk.name, videoUrl: r.url, episodeNumber: tk.epNum, customHeaders: hdrs });
        episodeItems.push({
          id: r.url,
          type: "url",
          title: tk.name,
          mediaType: "movie",
          posterPath: pic,
          videoUrl: r.url,
          link: r.url,
          episode: tk.epNum,
          episodeNumber: tk.epNum,
          seasonIndex: sn,
          seasonNumber: sn,
          customHeaders: hdrs,
          playerType: "system"
        });
        episodes.push({ name: tk.name, id: tk.epUrl, link: tk.epUrl });
      }
      if (sEps.length) {
        seasons.push({ seasonNumber: sn, title: gl.lineName, name: gl.lineName, episodes: sEps });
      }
    }
    var desc = descParts.join("\n");
    if (episodes.length) {
      desc += "\n共" + episodes.length + "集 · " + seasons.length + "条线路";
    } else {
      desc += "\n未找到可播放地址";
    }
    return {
      id: String(v.vod_id || id),
      type: "link",
      title: title,
      name: title,
      link: WORKER + "/detail?id=" + encodeURIComponent(id),
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: desc.replace(/^\n+/, ""),
      mediaType: "movie",
      episodes: episodes,
      seasons: seasons,
      episodeItems: episodeItems
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

function pickLink(params) {
  if (!params) return "";
  if (typeof params === "string") return params;
  var keys = ["link", "url", "videoUrl", "streamUrl", "id"];
  for (var i = 0; i < keys.length; i++) {
    var v = t(params[keys[i]]);
    if (v) return v;
  }
  return "";
}

function pickName(params) {
  if (!params || typeof params !== "object") return "";
  return t(params.name || params.title || "");
}

// 播放：集 token（直链或 base64 JSON）调一次 /play 解出直链，/play 给的 headers 一并返回
// （直链曾回 401 需鉴权头）；/play 解不出时，若 token 本身就是视频格式直链则透传兜底，否则返回空数组，不编假地址。
async function loadResource(params) {
  var raw = pickLink(params);
  if (!raw) return [];
  var name = pickName(params);
  var headers = { "User-Agent": UA, "Referer": WORKER + "/" };
  var pj = await resolvePlay({ url: raw });
  if (pj && pj.url) {
    var h2 = { "User-Agent": UA, "Referer": WORKER + "/" };
    if (pj.headers) {
      for (var hk in pj.headers) { h2[hk] = pj.headers[hk]; }
    }
    return [{ name: name || "播放", url: String(pj.url), playerType: "app", customHeaders: h2 }];
  }
  if (isVideoFormat(raw)) {
    return [{ name: name || "播放", url: raw, playerType: "app", customHeaders: headers }];
  }
  return [];
}

function isVideoFormat(url) {
  var low = String(url || "").toLowerCase();
  return low.indexOf(".m3u8") >= 0 || low.indexOf(".mp4") >= 0 || low.indexOf(".ts") >= 0 || low.indexOf(".flv") >= 0 || low.indexOf(".mkv") >= 0;
}

