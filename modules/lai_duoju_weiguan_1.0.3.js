// 多聚短剧 · 围观 for REX (lai_duoju_weiguan v1.0.3)
// v1.0.3（seasons/episodeItems）：loadDetail 预解析每集直链，同时返回 REX episodes 与参考文件那套 seasons/episodeItems；loadResource 原样保留；取数逻辑与 1.0.2 一致。
// v1.0.2（episodes + loadResource）：从 1.0.0 的 episodes 写法恢复集数选集（1.0.1 为 xnxx 式单 videoUrl、无集数）；loadDetail 只返回全部 episodes 不再预解析，点集时 loadResource 单次解析；分类/搜索/参数与 1.0.1 完全一致。
// 移植自 LeeCatPaw 的 lee_duoju_weiguan（只读蓝图）：纯 HTTPS，无签名无加密。
// 列表/搜索走 POST JSON（/drama/home/search），详情走 GET（/drama/home/shortVideoDetail）。
// 只有一个真实分类“全部”；分集播放地址需在 loadResource 里重新拉详情按集号取，
// 清晰度只取站方给的最高档（1080/超清优先），不编假选单。

WidgetMetadata = {
  id: "lai_duoju_weiguan",
  title: "多聚短剧 · 围观",
  description: "多聚短剧 · 围观：短剧聚合，纯 HTTPS 接口",
  author: "lai",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  site: "https://api.drama.9ddm.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://api.drama.9ddm.com";
var UA = "okhttp/4.10.0";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson(url) {
  try {
    var res = await Widget.http.get(url, { headers: { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Origin": BASE, "Referer": BASE + "/" } });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

async function postJson(url, body) {
  try {
    var res = await Widget.http.post(url, JSON.stringify(body), { headers: { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Origin": BASE, "Referer": BASE + "/", "Content-Type": "application/json; charset=utf-8" } });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

function toCard(row) {
  var id = t(row.oneId);
  var title = clean(row.title);
  if (!id || !title) return null;
  var pic = t(row.vertPoster || row.horizonPoster);
  return {
    id: id,
    type: "url",
    title: title,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: row.episodeCount ? ("共" + row.episodeCount + "集") : "",
    mediaType: "movie"
  };
}

function toList(j) {
  var out = [];
  var rows = (j && j.data) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function find(word, page) {
  var j = await postJson(BASE + "/drama/home/search?version_code=1500&os_type=1", { audience: "全部受众", page: page, pageSize: 30, searchWord: word, subject: "全部主题" });
  return toList(j);
}

async function loadList(params) {
  params = params || {};
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await find("", page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await find(wd, page);
  return list.length ? list : emptyItem();
}

function orderOf(row, index) {
  return Number(row.playOrder) || Number(row.episode) || (index + 1);
}

function mediaOf(row) {
  var value = row.playSetting != null ? row.playSetting : row.videoClarityList;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch (e) { return clean(row.playUrl); }
  }
  if (value && typeof value === "object" && value.length != null) {
    var best = null;
    for (var i = 0; i < value.length; i++) {
      if (/1080|超清/.test(clean(value[i] && value[i].clarity))) { best = value[i]; break; }
    }
    if (!best) best = value[0] || {};
    return clean(best.url || best.playUrl || row.playUrl);
  }
  if (value && typeof value === "object") {
    return clean(value.super || value.high || value.normal || value.url || value.playUrl || row.playUrl);
  }
  return clean(row.playUrl);
}

async function rowsOf(id) {
  var j = await getJson(BASE + "/drama/home/shortVideoDetail?version_code=1000&os_type=1&oneId=" + encodeURIComponent(id) + "&page=1&pageSize=1000");
  return (j && j.data) || [];
}

// v1.0.3：按参考文件（upload-3.js）格式组装 seasons/episodeItems。
// list: [{name, n, videoUrl}]，只收已解出直链的集；解不出的集不出现在这里。
function buildSeasonItems(list, pic) {
  var seasonEps = [];
  var episodeItems = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it.videoUrl) continue;
    seasonEps.push({ videoUrl: it.videoUrl, title: it.name, episodeNumber: it.n, customHeaders: {} });
    episodeItems.push({ id: it.videoUrl, type: "url", title: it.name, mediaType: "tv", posterPath: pic || "", videoUrl: it.videoUrl, link: it.videoUrl, episode: it.n, episodeNumber: it.n, seasonIndex: 1, seasonNumber: 1, customHeaders: {}, playerType: "system" });
  }
  return { seasons: [{ seasonNumber: 1, episodes: seasonEps }], episodeItems: episodeItems };
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var rows = await rowsOf(id);
    if (!rows.length) return { id: id, type: "url", title: "详情获取失败", description: "接口无返回" };
    var first = rows[0] || {};
    var episodes = [];
    var resolved = [];
    for (var i = 0; i < rows.length; i++) {
      var mu = mediaOf(rows[i]);
      if (/^https?:\/\//.test(mu)) {
        var n = orderOf(rows[i], i);
        episodes.push({ name: "第" + n + "集", id: "weiguan://" + id + "/" + n, link: "weiguan://" + id + "/" + n });
        resolved.push({ name: "第" + n + "集", n: n, videoUrl: mu });
      }
    }
    if (!episodes.length) return { id: id, type: "url", title: "无可播分集", description: "详情无播放地址" };
    var pic = t(first.vertPoster || first.horizonPoster);
    // v1.0.3：详情已含每集播放地址（mediaOf，最高档），直接取用补 seasons/episodeItems
    // （App 渲染集数网格用；与 loadResource 取同一字段，无额外请求）。
    // 注意：播放地址带 timestamp+sign，有过期窗口，详情缓存 180s 内有效。
    var built = buildSeasonItems(resolved, pic);
    return {
      id: id,
      type: "detail",
      title: clean(first.title) || "围观短剧",
      name: clean(first.title) || "围观短剧",
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: clean(first.description || first.desc) + "\n共" + episodes.length + "集",
      playerType: "app",
      episodes: episodes,
      seasons: built.seasons,
      episodeItems: built.episodeItems
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

async function loadResource(params) {
  params = params || {};
  var raw = t(params.link || params.url || params.id || "");
  if (!raw && params.item) raw = t(params.item.link || params.item.id || "");
  if (raw.indexOf("http") === 0) {
    return [{ name: "播放", url: raw, playerType: "app" }];
  }
  var m = /^weiguan:\/\/(.+)\/(\d+)$/.exec(raw);
  if (!m) return [];
  try {
    var rows = await rowsOf(m[1]);
    var want = Number(m[2]);
    var found = null;
    for (var i = 0; i < rows.length; i++) {
      if (orderOf(rows[i], i) === want) { found = rows[i]; break; }
    }
    var url = found ? mediaOf(found) : "";
    if (/^https?:\/\//.test(url)) {
      return [{ name: "播放", url: url, playerType: "app" }];
    }
  } catch (e) { /* fall through */ }
  return [];
}
