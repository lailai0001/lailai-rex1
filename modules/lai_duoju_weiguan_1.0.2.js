// 多聚短剧 · 围观 for REX (lai_duoju_weiguan v1.0.2)
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
  version: "1.0.2",
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

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var rows = await rowsOf(id);
    if (!rows.length) return { id: id, type: "url", title: "详情获取失败", description: "接口无返回" };
    var first = rows[0] || {};
    var episodes = [];
    for (var i = 0; i < rows.length; i++) {
      if (/^https?:\/\//.test(mediaOf(rows[i]))) {
        var n = orderOf(rows[i], i);
        episodes.push({ name: "第" + n + "集", id: "weiguan://" + id + "/" + n, link: "weiguan://" + id + "/" + n });
      }
    }
    if (!episodes.length) return { id: id, type: "url", title: "无可播分集", description: "详情无播放地址" };
    var pic = t(first.vertPoster || first.horizonPoster);
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
      episodes: episodes
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
