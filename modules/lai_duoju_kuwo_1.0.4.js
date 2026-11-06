// 多聚短剧 · 酷我 for REX (lai_duoju_kuwo v1.0.3)
// v1.0.3（seasons/episodeItems）：loadDetail 预解析每集直链，同时返回 REX episodes 与参考文件那套 seasons/episodeItems；loadResource 原样保留；取数逻辑与 1.0.2 一致。
// v1.0.2（episodes + loadResource）：从 1.0.0 的 episodes 写法恢复集数选集（1.0.1 为 xnxx 式单 videoUrl、无集数）；loadDetail 只返回全部 episodes 不再预解析，点集时 loadResource 单次解析；分类/搜索/参数与 1.0.1 完全一致。
// 移植自 LeeCatPaw 的 lee_duoju_kuwo（只读蓝图）：纯 HTTP JSON，无签名无加密。
// 列表 GET wapi.kuwo.cn；详情 GET videoList 取 vid；播放 GET nmobi.kuwo.cn 解析 url= 行。
// 站方无搜索接口，搜索改为逐分类第 1 页标题包含匹配（与猫源逐分类翻找同理，页数收敛为 1 页）。

// v1.0.4（批量解析）：loadDetail 逐集解析改为一次 POST /dj/<源>/batch（见下方 batchResolveLinks）；
//   失败集保留在 episodes[]、不进 seasons/episodeItems；loadResource 与站方解析函数原样保留。
WidgetMetadata = {
  id: "lai_duoju_kuwo",
  title: "多聚短剧 · 酷我",
  description: "多聚短剧 · 酷我：猜你想看/土味爱情/霸道总裁等短剧，HTTPS 接口（2026-11-06 实测 https 可用，防 iOS ATS 拦截明文 HTTP）",
  author: "lai",
  version: "1.0.4",
  requiredVersion: "0.0.1",
  site: "https://wapi.kuwo.cn/openapi/v1/shortplay",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "猜你想看", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "10" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "土味爱情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "11" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "更多精彩", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "12" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "霸道总裁的人生", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "13" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "赘婿当道", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "14" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "漫漫追妻路", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "15" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "家庭情感", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "16" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var API = "https://wapi.kuwo.cn/openapi/v1/shortplay";
var UA = "okhttp/5.1.0";
var CATS = ["10", "11", "12", "13", "14", "15", "16"];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson(url) {
  try {
    var res = await Widget.http.get(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

async function getText(url) {
  try {
    var res = await Widget.http.get(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
    if (!res || res.data == null) return "";
    if (typeof res.data === "object") return JSON.stringify(res.data);
    return String(res.data);
  } catch (e) { return ""; }
}

function toCard(item) {
  var id = t(item.url);
  var name = clean(item.title || item.subTitle);
  if (!id || !name) return null;
  var pic = t(item.img);
  if (pic && pic.indexOf("http") !== 0) pic = API + "/" + pic;
  var remark = t(item.currrentDesc);
  if (!remark && item.songNum) remark = item.songNum + "集全";
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: remark,
    mediaType: "movie"
  };
}

async function listing(cat, page) {
  if (page > 60) return [];
  var j = await getJson(API + "/moduleMore?currentPage=" + page + "&moduleId=" + encodeURIComponent(cat) + "&rn=12");
  var out = [];
  var rows = (j && j.data && j.data.list) || [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i]);
    if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "10");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await listing(cat, page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var hits = [];
  var seen = {};
  for (var ci = 0; ci < CATS.length; ci++) {
    var rows = await listing(CATS[ci], 1);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].title.indexOf(wd) >= 0 && !seen[rows[i].id] && hits.length < 30) {
        seen[rows[i].id] = 1;
        hits.push(rows[i]);
      }
    }
  }
  var sliced = hits.slice((page - 1) * 12, page * 12);
  return sliced.length ? sliced : emptyItem();
}

// v1.0.3：把 loadResource 的单集解析抽成内部函数，供 loadDetail 预解析与 loadResource 共用。
async function resolveKuwoVid(vid) {
  var text = await getText("https://nmobi.kuwo.cn/mobi.s?f=web&type=get_url_by_vid&vid=" + vid);
  var m = /^\s*url=(\S+)/m.exec(text);
  var url = m ? m[1] : "";
  if (/^https?:\/\//.test(url)) return url;
  return "";
}


var RELAY = "https://javsb-relay-production.up.railway.app";
var BATCH_PATH = "/dj/kuwo/batch";
var BUA = (typeof UA !== "undefined" && UA) ? UA : "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

// v1.0.4：批量解析。loadDetail 不再逐集调站方解析函数，改为一次 POST RELAY + BATCH_PATH
// （体 {items:[{id: 集链接原样}]}，返回 {results:[{id, url, header, ok}]}），按 id 匹配回填；
// 超上限时分块顺序调；整批传输失败重试一次，仍失败则该块全跳过（不编假地址）。
// 失败集不填空地址，仍保留在 episodes[] 里，点集时 loadResource 单解兜底。模块内不做并发。
async function postBatch(items) {
  try {
    var res = await Widget.http.post(RELAY + BATCH_PATH, JSON.stringify({ items: items }), {
      headers: { "Content-Type": "application/json", "User-Agent": BUA, "Accept": "application/json" }
    });
    if (!res || res.data == null) return null;
    var d = res.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { return null; } }
    if (!d || !d.results) return null;
    return d.results;
  } catch (e) { return null; }
}

async function batchResolveLinks(links, chunk) {
  var out = {};
  if (!links.length) return out;
  var size = Math.max(1, chunk || 100);
  for (var s = 0; s < links.length; s += size) {
    var part = links.slice(s, s + size);
    var items = [];
    for (var i = 0; i < part.length; i++) items.push({ id: part[i] });
    var results = await postBatch(items);
    if (!results) results = await postBatch(items);
    if (!results) continue;
    for (var ri = 0; ri < results.length; ri++) {
      var r = results[ri];
      if (!r || !r.ok || !r.url || !/^https?:\/\//.test(String(r.url))) continue;
      out[String(r.id)] = String(r.url);
    }
  }
  return out;
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
    var raw = t(link);
    var id = raw;
    var colon = id.indexOf(":");
    if (colon >= 0) id = id.slice(colon + 1);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson(API + "/videoList?albumId=" + encodeURIComponent(id));
    var data = (j && j.data) || {};
    var rows = data.list || [];
    var episodes = [];
    var epVids = [];
    for (var i = 0; i < rows.length; i++) {
      var vid = Number((rows[i].mvpayinfo && rows[i].mvpayinfo.vid) || 0);
      if (!vid || vid <= 0) continue;
      var name = String(rows[i].name || ("第" + (i + 1) + "集")).replace(/[$#]/g, "_");
      episodes.push({ name: name, id: "kuwo://" + id + "/" + vid, link: "kuwo://" + id + "/" + vid });
      epVids.push(String(vid));
    }
    if (!episodes.length) return { id: raw, type: "url", title: "无可播分集", description: "详情无分集" };
    var info = data.shortinfo || {};
    var pic = t(info.cover);
    var title = clean(info.title) || ("酷我短剧 " + id);
    // v1.0.3：逐集预解析直链，补 seasons/episodeItems（App 渲染集数网格用）；
    // 解不出的集只跳过预解析，仍保留在 episodes 里，点集时 loadResource 再解。
    // 注意：播放直链本身仍是站方给的 http（站方原样，照实填）。
    var resolved = [];
    var blink = [];
    for (var bi = 0; bi < episodes.length; bi++) blink.push(episodes[bi].link);
    var bmap = await batchResolveLinks(blink, 40);
    for (var ri = 0; ri < episodes.length; ri++) {
      var rurl = bmap[episodes[ri].link] || "";
      if (rurl) resolved.push({ name: episodes[ri].name, n: ri + 1, videoUrl: rurl });
    }
    var built = buildSeasonItems(resolved, pic);
    return {
      id: raw,
      type: "detail",
      title: title,
      name: title,
      link: raw,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: "共" + episodes.length + "集",
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
  var vid = raw.slice(raw.lastIndexOf("/") + 1);
  if (!/^\d+$/.test(vid)) return [];
  var url = await resolveKuwoVid(vid);
  if (url) {
    return [{ name: "播放", url: url, playerType: "app" }];
  }
  return [];
}
