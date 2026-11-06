// 多聚短剧 · 好看 for REX (lai_duoju_haokan v1.0.3)
// v1.0.3（seasons/episodeItems）：loadDetail 预解析每集直链，同时返回 REX episodes 与参考文件那套 seasons/episodeItems；loadResource 原样保留；取数逻辑与 1.0.2 一致。
// v1.0.2（episodes + loadResource）：从 1.0.0 的 episodes 写法恢复集数选集（1.0.1 为 xnxx 式单 videoUrl、无集数）；loadDetail 只返回全部 episodes 不再预解析，点集时 loadResource 单次解析；分类/搜索/参数与 1.0.1 完全一致。
// 移植自 LeeCatPaw 的 lee_duoju_haokan（只读蓝图）：纯 HTTPS POST 表单，无签名无加密。
// 列表/详情/播放均走 sv.baidu.com 的 POST 接口；播放取 clarityUrl 里 video_quality
// 最高的一条直链（站方真实档位只取最高，不编多档选单）。

// v1.0.4（批量解析）：loadDetail 逐集解析改为一次 POST /dj/<源>/batch（见下方 batchResolveLinks）；
//   失败集保留在 episodes[]、不进 seasons/episodeItems；loadResource 与站方解析函数原样保留。
WidgetMetadata = {
  id: "lai_duoju_haokan",
  title: "多聚短剧 · 好看",
  description: "多聚短剧 · 好看：热播剧/新剧/战神/神豪等短剧，纯 HTTPS 接口",
  author: "lai",
  version: "1.0.4",
  requiredVersion: "0.0.1",
  site: "https://sv.baidu.com",
  detailCacheDuration: 180,
  modules: [
    { title: "热播剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "reboduanju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "新剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xinju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "战神", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhanshen" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "神豪", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shenhao" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "神医", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shenyi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "甜宠", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "tianchong" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "赘婿", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhuixu" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "穿越重生", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "chuanyue" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "异能", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "yineng" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "虐恋", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "nuelian" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "宫斗宅斗", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "gongdou" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "玄幻", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xuanhuan" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://sv.baidu.com";
var QUERY = "log=vhk&tn=1020970b&ctn=1008350n&blur=1";
var UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36";
var CATS = [
  ["reboduanju", "热播剧", "1"],
  ["xinju", "新剧", "2"],
  ["zhanshen", "战神", "1001"],
  ["shenhao", "神豪", "2001"],
  ["shenyi", "神医", "1002"],
  ["tianchong", "甜宠", "1007"],
  ["zhuixu", "赘婿", "1003"],
  ["chuanyue", "穿越重生", "2004"],
  ["yineng", "异能", "2005"],
  ["nuelian", "虐恋", "1006"],
  ["gongdou", "宫斗宅斗", "2006"],
  ["xuanhuan", "玄幻", "2009"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function formBody(fields) {
  var parts = [];
  for (var k in fields) {
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(fields[k]));
  }
  return parts.join("&");
}

async function postForm(path, fields) {
  try {
    var res = await Widget.http.post(BASE + path, formBody(fields), { headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

function catOf(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i];
  }
  return CATS[0];
}

function toCard(row, category) {
  var id = clean(row.playlet_id);
  var name = clean(row.playlet_title);
  if (!id || !name) return null;
  var pic = clean(row.playlet_poster);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: row.episodes_num ? ("更新" + row.episodes_num + "集") : "",
    mediaType: "movie"
  };
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = catOf(t(params.cat || "reboduanju"));
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var j = await postForm("/haokan/ui-feed/playletTagsFeed?" + QUERY, { tag_id: cat[2], pn: String(page), rn: "12" });
  var out = [];
  var rows = (j && j.data && j.data.list) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i], cat[1]);
    if (c) out.push(c);
  }
  return out.length ? out : emptyItem();
}

// v1.0.3：把 loadResource 的单集解析抽成内部函数，供 loadDetail 预解析与 loadResource 共用。
async function resolveHaokanVid(vid) {
  var j = await postForm("/appui/api?cmd=video/relate&" + QUERY, { method: "post", vid: vid });
  var rows = (j && j["video/relate"] && j["video/relate"].data && j["video/relate"].data.cur_video && j["video/relate"].data.cur_video.clarityUrl) || [];
  var best = null;
  var bestQ = -1;
  for (var i = 0; i < rows.length; i++) {
    var u = clean(rows[i].url);
    if (!/^https?:\/\//.test(u)) continue;
    var q = Number(rows[i].video_quality || 0);
    if (q > bestQ) { bestQ = q; best = u; }
  }
  return best || "";
}


var RELAY = "https://javsb-relay-production.up.railway.app";
var BATCH_PATH = "/dj/haokan/batch";
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
    var at = id.indexOf("@");
    if (at >= 0) id = id.slice(0, at);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await postForm("/haokan/ui-video/playlet/rec/detail?" + QUERY, { playlet_id: id, vid: "undefined" });
    var data = (j && j.data) || {};
    var vids = data.vid_list || [];
    var episodes = [];
    for (var i = 0; i < vids.length; i++) {
      if (clean(vids[i])) {
        episodes.push({ name: "第" + (i + 1) + "集", id: "haokan://" + clean(vids[i]), link: "haokan://" + clean(vids[i]) });
      }
    }
    if (!episodes.length) return { id: raw, type: "url", title: "无可播分集", description: "详情无分集" };
    var pic = clean(data.playlet_poster);
    // v1.0.3：逐集预解析直链，补 seasons/episodeItems（App 渲染集数网格用）；
    // 解不出的集只跳过预解析，仍保留在 episodes 里，点集时 loadResource 再解。
    var resolved = [];
    var blink = [];
    for (var bi = 0; bi < episodes.length; bi++) blink.push(episodes[bi].link);
    var bmap = await batchResolveLinks(blink, 100);
    for (var ri = 0; ri < episodes.length; ri++) {
      var rurl = bmap[episodes[ri].link] || "";
      if (rurl) resolved.push({ name: episodes[ri].name, n: ri + 1, videoUrl: rurl });
    }
    var built = buildSeasonItems(resolved, pic);
    return {
      id: raw,
      type: "detail",
      title: clean(data.playlet_title) || "好看短剧",
      name: clean(data.playlet_title) || "好看短剧",
      link: raw,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: clean(data.description) + "\n共" + episodes.length + "集",
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
  if (raw.indexOf("haokan://") !== 0) return [];
  var url = await resolveHaokanVid(raw.slice(9));
  if (url) {
    return [{ name: "播放", url: url, playerType: "app" }];
  }
  return [];
}
