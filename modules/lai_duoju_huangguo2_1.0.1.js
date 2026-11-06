// 多聚短剧 · 黄果2 for REX (lai_duoju_huangguo2 v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_huangguo2（只读蓝图）：纯 HTTPS HTML 抓取，无签名无加密。
// 列表解析 article.video-card；详情取 /series|video/{id} 内的 /video/ 链接为分集；
// 播放取 /video/{vid} 页的 data-hls 属性（m3u8）。

WidgetMetadata = {
  id: "lai_duoju_huangguo2",
  title: "多聚短剧 · 黄果2",
  description: "多聚短剧 · 黄果2：连续剧/MV/短片/片段，纯 HTML 抓取",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://huangguo.video",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "连续剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "3" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "MV/音乐剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "短片", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "2" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "片段", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "4" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "最近更新", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "updates" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "排行榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "ranking" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://huangguo.video";
var UA = "Mozilla/5.0 (Linux; Android 13)";
var CATS = [
  ["all", "全部"], ["3", "连续剧"], ["1", "MV/音乐剧"], ["2", "短片"],
  ["4", "片段"], ["updates", "最近更新"], ["ranking", "排行榜"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function absUrl(s) {
  if (!s) return "";
  if (s.indexOf("http") === 0) return s;
  if (s.indexOf("//") === 0) return "https:" + s;
  if (s.indexOf("/") === 0) return BASE + s;
  return BASE + "/" + s;
}

async function getText(path) {
  try {
    var res = await Widget.http.get(BASE + path, { headers: { "User-Agent": UA, "Referer": BASE + "/" } });
    if (!res || res.data == null) return "";
    if (typeof res.data === "object") return JSON.stringify(res.data);
    return String(res.data);
  } catch (e) { return ""; }
}

function catName(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i][1];
  }
  return "";
}

function cards(html, cls) {
  var out = [];
  var re = /<article\s+class="[^"]*\bvideo-card\b[^"]*"[^>]*>/gi;
  var starts = [];
  var m;
  while ((m = re.exec(html)) !== null) starts.push(m.index);
  for (var si = 0; si < starts.length; si++) {
    var chunk = html.slice(starts[si], (si + 1 < starts.length) ? starts[si + 1] : html.length);
    var link = /href="(?:https?:\/\/[^/"]+)?\/(series|video)\/([0-9a-zA-Z]+)/i.exec(chunk);
    var altM = /<img[^>]*\balt="([^"]*)"/i.exec(chunk);
    var pM = /<p[^>]*class="[^"]*\bmt-2\.5\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(chunk);
    var name = clean((altM && altM[1]) || (pM && pM[1]) || "");
    if (!link || !name) continue;
    var imgM = /<img[^>]*\bsrc="([^"]+)"/i.exec(chunk);
    var markM = /bg-black\/(?:50|55)[^>]*>([^<]+)</i.exec(chunk);
    var mark = clean((markM && markM[1]) || "");
    out.push({
      id: link[1] + "-" + link[2],
      type: "url",
      title: name,
      posterPath: absUrl((imgM && imgM[1]) || ""),
      coverUrl: absUrl((imgM && imgM[1]) || ""),
      backdropPath: absUrl((imgM && imgM[1]) || ""),
      link: link[1] + "-" + link[2],
      description: mark,
      mediaType: "movie"
    });
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  var path;
  if (cat === "updates" || cat === "ranking") path = "/" + cat + "?page=" + page;
  else path = "/videos?category=" + encodeURIComponent(cat || "all") + "&page=" + page;
  return cards(await getText(path), catName(cat));
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "all");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await listing(cat, page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var found = cards(await getText("/search?q=" + encodeURIComponent(wd) + (page > 1 ? "&page=" + page : "")), "");
  if (found.length) return found;
  var seen = {};
  var matches = [];
  for (var p = 1; p <= 5 && matches.length < page * 24; p++) {
    var rows = await listing("all", p);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].title.indexOf(wd) >= 0 && !seen[rows[i].id]) {
        seen[rows[i].id] = 1;
        matches.push(rows[i]);
      }
    }
  }
  var sliced = matches.slice((page - 1) * 24, page * 24);
  return sliced.length ? sliced : emptyItem();
}

async function loadDetail(link) {
  try {
    var id = t(link);
    var m = /^(series|video)-([A-Za-z0-9]+)$/.exec(id);
    if (!m) return { id: "err", type: "url", title: "解析失败", description: "剧集 ID 无效" };
    var html = await getText("/" + m[1] + "/" + m[2]);
    var h1M = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    var name = clean((h1M && h1M[1]) || "") || id;
    var ogM = /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i.exec(html);
    var pic = absUrl((ogM && ogM[1]) || "");
    var descM = /<meta[^>]*name="description"[^>]*content="([^"]*)"/i.exec(html);
    var desc = clean((descM && descM[1]) || "");
    var videos;
    if (m[1] === "video") {
      videos = [m[2]];
    } else {
      videos = [];
      var seen = {};
      var vm = /href="(?:https?:\/\/[^/"]+)?\/video\/([0-9a-zA-Z]+)/gi.exec(html);
      var allM = [];
      var re2 = /href="(?:https?:\/\/[^/"]+)?\/video\/([0-9a-zA-Z]+)/gi;
      var mm;
      while ((mm = re2.exec(html)) !== null) allM.push(mm[1]);
      for (var vi = 0; vi < allM.length; vi++) {
        if (!seen[allM[vi]]) { seen[allM[vi]] = 1; videos.push(allM[vi]); }
      }
      if (vm && !videos.length) videos = [m[2]];
    }
    if (!videos.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var episodes = [];
    for (var ei = 0; ei < videos.length; ei++) {
      episodes.push({ name: "第" + (ei + 1) + "集", id: "huangguo2://video-" + videos[ei] + "/1", link: "huangguo2://video-" + videos[ei] + "/1" });
    }
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < episodes.length; pi++) {
      var playCand = await resolvePlayUrl(episodes[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = desc + "\n共" + episodes.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: id,
      type: "detail",
      title: name,
      name: name,
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descText,
      playerType: "app",
      customHeaders: {"User-Agent": UA, "Referer": BASE + "/"},
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
  var m = /^huangguo2:\/\/video-([A-Za-z0-9]+)\/\d+$/.exec(raw);
  if (!m) return "";
  var html = await getText("/video/" + m[1]);
  var srcM = /data-hls="([^"]+)"/i.exec(html);
  var url = absUrl(((srcM && srcM[1]) || "").replace(/&amp;/g, "&"));
  if (url.indexOf(".m3u8") >= 0) {
    return url;
  }
  return "";
}
