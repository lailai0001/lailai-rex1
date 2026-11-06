// 多聚短剧 · 黄瓜 for REX (lai_duoju_huanggua v1.0.0)
// 移植自 LeeCatPaw 的 lee_duoju_huanggua（只读蓝图，与橙果共用 Nuxt HTML 抓取逻辑）：
// 纯 HTTPS HTML 抓取，无签名无加密。列表解析 article[data-xpch="card-drama"]；
// 详情取 /drama/{id} 内 href="/play/{id}/{n}" 为分集；播放取 /play/{id}/{n} 页内 m3u8。

WidgetMetadata = {
  id: "lai_duoju_huanggua",
  title: "多聚短剧 · 黄瓜",
  description: "多聚短剧 · 黄瓜：推荐/原创/魔改/AI漫剧/真人短剧/AI短剧，纯 HTML 抓取（自动发现可用镜像）",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://hgdju4.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "recommend" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "原创", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "yuanchuang" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "魔改", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "mogai" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AI漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "manju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "真人短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhenren" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AI短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "aiduanju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "browse" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "最新", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "browse-new" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://hgdju4.com";
var SCHEME = "huanggua://";
var UA = "Mozilla/5.0";
var CATS = [
  ["recommend", "推荐", "/"],
  ["yuanchuang", "原创", "/yuanchuang"],
  ["mogai", "魔改", "/mogai"],
  ["manju", "AI漫剧", "/manju"],
  ["zhenren", "真人短剧", "/zhenren"],
  ["aiduanju", "AI短剧", "/aiduanju"],
  ["browse", "全部", "/browse"],
  ["browse-new", "最新", "/browse?sort=new"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function absUrl(s) {
  if (!s) return "";
  if (s.indexOf("http") === 0) return s;
  if (s.indexOf("//") === 0) return "https:" + s;
  var b = HOST || BASE;
  if (s.indexOf("/") === 0) return b + s;
  return b + "/" + s;
}

var HOST = "";
// 黄瓜主站常换镜像：先取 BASE 首页提取 .cc 候选域名，逐个探测含 card-drama 标记的为可用镜像。
async function rawText(url) {
  try {
    var res = await Widget.http.get(url, { headers: { "User-Agent": UA, "Referer": url } });
    if (!res || res.data == null) return "";
    if (typeof res.data === "object") return JSON.stringify(res.data);
    return String(res.data);
  } catch (e) { return ""; }
}

async function discover() {
  if (HOST) return HOST;
  var landing = await rawText(BASE + "/");
  var found = {};
  var re = /https?:\/\/[a-z0-9-]{2,24}\.[a-z0-9]{5,20}\.cc/gi;
  var mm;
  while ((mm = re.exec(landing)) !== null) {
    if (mm[0].indexOf("hgdju") < 0) found[mm[0]] = 1;
  }
  var cands = [];
  for (var k in found) cands.push(k);
  for (var i = 0; i < cands.length; i++) {
    var html = await rawText(cands[i] + "/");
    if (html.indexOf('data-xpch="card-drama"') >= 0) { HOST = cands[i]; return HOST; }
  }
  throw new Error("黄瓜没有可用镜像");
}

async function getText(path) {
  try {
    var base = await discover();
    var html = await rawText(base + path);
    if (html) return html;
    HOST = "";
    var next = await discover();
    return rawText(next + path);
  } catch (e) { return ""; }
}

function catOf(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i];
  }
  return CATS[0];
}

function cards(html, category) {
  var out = [];
  var re = /<article\b[^>]*data-xpch="card-drama"[^>]*>[\s\S]*?<\/article>/gi;
  var seen = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    var block = m[0];
    var link = /href="\/drama\/([A-Za-z0-9-]+)"/i.exec(block);
    var altM = /<img[^>]*\balt="([^"]+)"/i.exec(block);
    var name = clean((altM && altM[1]) || "");
    if (!link || !name || seen[link[1]]) continue;
    seen[link[1]] = 1;
    var picM = /<img[^>]*\b(?:z-image-loader-url|data-cover-fb|data-src|src)="([^"]+)"/i.exec(block);
    var pic = (picM && picM[1]) || "";
    var markM = /(?:更新至|共|全)\s*\d+\s*集/.exec(clean(block));
    out.push({
      id: link[1],
      type: "url",
      title: name,
      posterPath: absUrl(pic),
      coverUrl: absUrl(pic),
      backdropPath: absUrl(pic),
      link: link[1],
      description: (markM && markM[0]) || "",
      mediaType: "movie"
    });
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  var entry = catOf(cat);
  var path = entry[2] + (page > 1 ? ((entry[2].indexOf("?") >= 0 ? "&" : "?") + "page=" + page) : "");
  return cards(await getText(path), entry[1]);
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "recommend");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await listing(cat, page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var path = "/search?q=" + encodeURIComponent(wd) + (page > 1 ? "&page=" + page : "");
  var list = cards(await getText(path), "");
  return list.length ? list : emptyItem();
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return { id: "err", type: "url", title: "解析失败", description: "短剧 ID 无效" };
    var html = await getText("/drama/" + encodeURIComponent(id));
    var h1M = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    var title = clean((h1M && h1M[1]) || "") || id;
    var descM = /<meta[^>]*name="description"[^>]*content="([^"]*)"/i.exec(html);
    var desc = clean((descM && descM[1]) || "");
    var picM = /\b(?:z-image-loader-url|data-cover-fb|data-src|src)="([^"]+)"/i.exec(html);
    var pic = absUrl((picM && picM[1]) || "");
    var seen = {};
    var eps = [];
    var re = new RegExp("href=\"/play/" + id + "/(\\d+)\"", "gi");
    var mm;
    while ((mm = re.exec(html)) !== null) {
      var n = Number(mm[1]);
      if (!seen[n]) { seen[n] = 1; eps.push(n); }
    }
    eps.sort(function (a, b) { return a - b; });
    if (!eps.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var episodes = [];
    for (var i = 0; i < eps.length; i++) {
      episodes.push({ name: "第" + eps[i] + "集", id: SCHEME + id + "/" + eps[i], link: SCHEME + id + "/" + eps[i] });
    }
    return {
      id: id,
      type: "detail",
      title: title,
      name: title,
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: desc + "\n共" + episodes.length + "集",
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
  var m = /^huanggua:\/\/([A-Za-z0-9-]+)\/(\d+)$/.exec(raw);
  if (!m) return [];
  var html = (await getText("/play/" + m[1] + "/" + m[2])).replace(/\\u0026/g, "&").replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  var um = /https?:\/\/[^\s"'<>\\]{10,200}\.m3u8[^\s"'<>\\]{0,300}/i.exec(html);
  var url = um ? um[0].replace(/&amp;/g, "&") : "";
  if (/^https?:\/\//.test(url)) {
    return [{ name: "播放", url: url, playerType: "app" }];
  }
  return [];
}
