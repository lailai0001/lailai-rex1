// 多聚短剧 · 2048 for REX (lai_duoju_md2048 v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_md2048（只读蓝图）：纯 HTTPS JSON API，无签名无加密，
// 4 个域名轮换重试（2048ai.vip / mdcmai4.xyz / 2048ai.xyz / mdcmai5.xyz）。
// 播放地址为站方 m3u8 代理接口（/api/v1/m3u8/proxy?path=...），直接返回给 App 播放。

WidgetMetadata = {
  id: "lai_duoju_md2048",
  title: "多聚短剧 · 2048",
  description: "多聚短剧 · 2048：AI短剧/麻豆原创/探花等，纯 JSON 接口",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://2048ai.vip",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "AI短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-29" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "麻豆原创AI", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-6" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "麻豆传媒", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-9" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "清纯少女", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-13" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AV中文字幕", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-2" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "国产自拍", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-1" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "探花大神", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-4" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "91大神", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-7" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "重口调教", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-14" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "白虎嫩妹", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-22" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "家庭乱伦", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-23" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "黑料吃瓜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat-19" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "吃瓜图文", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "posts" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "全部视频", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var DOMAINS = ["https://2048ai.vip", "https://mdcmai4.xyz", "https://2048ai.xyz", "https://mdcmai5.xyz"];
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
var CURRENT = DOMAINS[0];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function absUrl(v) {
  if (!v) return "";
  if (v.indexOf("http") === 0) return v;
  if (v.indexOf("//") === 0) return "https:" + v;
  if (v.indexOf("/") === 0) return CURRENT + v;
  return CURRENT + "/" + v;
}

async function parseRes(res) {
  if (!res || res.data == null) return null;
  if (typeof res.data === "object") return res.data;
  var s = String(res.data).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function api(path) {
  var failure = null;
  var order = [CURRENT];
  for (var i = 0; i < DOMAINS.length; i++) {
    if (DOMAINS[i] !== CURRENT) order.push(DOMAINS[i]);
  }
  for (var di = 0; di < order.length; di++) {
    var domain = order[di];
    try {
      var res = await Widget.http.get(domain + "/api/v1" + path, { headers: { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Origin": domain, "Referer": domain + "/" } });
      var j = await parseRes(res);
      if (!j || j.code !== 200) throw new Error("2048 接口错误 " + (j && j.code));
      CURRENT = domain;
      return j.data || {};
    } catch (e) { failure = e; }
  }
  throw failure || new Error("2048 所有入口不可用");
}

function toCard(kind, row) {
  if (!/^\d+$/.test(String(row.id || "")) || !row.title) return null;
  var seconds = Number(row.durationSec) || 0;
  var views = Number(row.viewCount) || 0;
  var remarks = [];
  if (seconds > 0) remarks.push(Math.floor(seconds / 60) + "分" + (seconds % 60) + "秒");
  if (views > 0) remarks.push(views + "次播放");
  if (row.authorName) remarks.push(row.authorName);
  var pic = absUrl(row.coverUrl || row.cover);
  return {
    id: kind + "-" + row.id,
    type: "url",
    title: String(row.title),
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: kind + "-" + row.id,
    description: remarks.join(" · "),
    mediaType: "movie"
  };
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  var path;
  var kind;
  if (cat === "posts") {
    path = "/posts?page=" + page + "&size=24";
    kind = "posts";
  } else {
    path = "/videos?" + ((cat && cat.indexOf("cat-") === 0) ? ("categoryId=" + cat.slice(4) + "&") : "") + "page=" + page + "&size=24";
    kind = "videos";
  }
  var data = await api(path);
  var out = [];
  var items = data.items || [];
  for (var i = 0; i < items.length; i++) {
    var c = toCard(kind, items[i]);
    if (c) out.push(c);
  }
  return out;
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "cat-29");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var list = await listing(cat, page);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "载入失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var low = wd.toLowerCase();
  var seen = {};
  var matches = [];
  var cats = ["cat-29", "all"];
  var pages = Math.min(5, Math.max(3, page * 2));
  for (var ci = 0; ci < cats.length; ci++) {
    for (var p = 1; p <= pages; p++) {
      var rows = [];
      try { rows = await listing(cats[ci], p); } catch (e) { rows = []; }
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].title.toLowerCase().indexOf(low) >= 0 && !seen[rows[i].id]) {
          seen[rows[i].id] = 1;
          matches.push(rows[i]);
        }
      }
    }
  }
  var sliced = matches.slice((page - 1) * 24, page * 24);
  return sliced.length ? sliced : emptyItem();
}

async function loadDetail(link) {
  try {
    var id = t(link);
    var m = /^(videos|posts)-(\d+)$/.exec(id);
    if (!m) return { id: "err", type: "url", title: "解析失败", description: "2048 影片 ID 无效" };
    var row = await api("/" + m[1] + "/" + m[2]);
    var vod = toCard(m[1], row);
    if (!vod) return { id: id, type: "url", title: "详情获取失败", description: "接口无返回" };
    vod.description = (vod.description ? vod.description + "\n" : "") + clean(row.description || row.content);
        var episodes = [{ name: "播放", id: "md2048://" + id + "/1", link: "md2048://" + id + "/1" }];
    var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < episodes.length; pi++) {
      var playCand = await resolvePlayUrl(episodes[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = vod.description + "\n共" + episodes.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: id,
      type: "detail",
      title: vod.title,
      name: vod.title,
      link: id,
      posterPath: vod.posterPath,
      coverUrl: vod.coverUrl,
      backdropPath: vod.backdropPath,
      description: descText,
      playerType: "app",
      customHeaders: {"User-Agent": UA, "Referer": CURRENT + "/"},
    };
    if (playUrl) result.videoUrl = playUrl;
    return result;
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

async function resolvePlayUrl(raw) {
  raw = t(raw || "");
  if (raw.indexOf("http") === 0) {
    return raw;
  }
  var m = /^md2048:\/\/(videos|posts)-(\d+)\/1$/.exec(raw);
  if (!m) return "";
  try {
    var row = await api("/" + m[1] + "/" + m[2]);
    var source = row.videoUrl || row.playUrl || row.url || "";
    if (!source) return "";
    var url = CURRENT + "/api/v1/m3u8/proxy?path=" + encodeURIComponent(source);
    return url;
  } catch (e) { return ""; }
}
