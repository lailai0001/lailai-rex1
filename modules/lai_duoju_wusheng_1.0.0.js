// 多聚短剧 · 悟圣 for REX (lai_duoju_wusheng v1.0.0)
// 移植自 LeeCatPaw 的 lee_duoju_wusheng（只读蓝图）：纯 HTTP JSON，无签名无加密，
// 固定 productId/vestId/token 放在查询串里；列表/搜索/详情均为 GET。
// 详情直接给出每集短视频直链，loadResource 直接返回直链播放。

WidgetMetadata = {
  id: "lai_duoju_wusheng",
  title: "多聚短剧 · 悟圣",
  description: "多聚短剧 · 悟圣：甜宠/逆袭/热血/现代/古代短剧，纯 HTTP 接口",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "http://read.api.duodutek.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "甜宠", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1287" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "逆袭", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1288" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "热血", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1289" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "现代", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1290" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "古代", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1291" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "http://read.api.duodutek.com";
var UA = "okhttp/5.1.0";
var FIXED = "productId=2a8c14d1-72e7-498b-af23-381028eb47c0&vestId=2be070e0-c824-4d0e-a67a-8f688890cadb&channel=oppo19&osType=android&version=20&token=202509271001001446030204698626";

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

function toCard(row) {
  var id = t(row.id || row.bookId);
  var name = clean(row.name || row.title);
  if (!id || !name) return null;
  var pic = t(row.icon || row.cover);
  var remark = "";
  if (row.chapterCount) remark = "全" + row.chapterCount + "集";
  else if (row.heat) remark = t(row.heat) + "播放";
  return {
    id: id + "@" + name,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id + "@" + name,
    description: remark,
    mediaType: "movie"
  };
}

function toList(j) {
  var out = [];
  var rows = (j && j.data && j.data.datalist) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "1287");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var j = await getJson(BASE + "/novel-api/app/pageModel/getResourceById?" + FIXED + "&resourceId=" + encodeURIComponent(cat) + "&pageNum=" + page + "&pageSize=20");
  var list = toList(j);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var j = await getJson(BASE + "/novel-api/basedata/book/searchBook?" + FIXED + "&key=" + encodeURIComponent(wd) + "&pageNum=" + page + "&pageSize=20");
  var list = toList(j);
  return list.length ? list : emptyItem();
}

function mediaOf(chapter) {
  var groups = chapter.shortPlayList || [];
  for (var gi = 0; gi < groups.length; gi++) {
    var videos = groups[gi].chapterShortPlayVoList || [];
    for (var vi = 0; vi < videos.length; vi++) {
      var u = t(videos[vi].shortPlayUrl);
      if (u.indexOf("http") === 0) return u;
    }
  }
  return "";
}

async function loadDetail(link) {
  try {
    var raw = t(link);
    var at = raw.indexOf("@");
    var bookId = at >= 0 ? raw.slice(0, at) : raw;
    var title = at >= 0 ? raw.slice(at + 1) : "";
    if (!bookId) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson(BASE + "/novel-api/basedata/book/getChapterList?" + FIXED + "&bookId=" + encodeURIComponent(bookId));
    var chapters = (j && j.data) || [];
    if (!chapters.length) return { id: raw, type: "url", title: title || "悟圣短剧", description: "未找到分集" };
    var episodes = [];
    var pic = "";
    var intro = "";
    for (var i = 0; i < chapters.length; i++) {
      var ch = chapters[i];
      var url = mediaOf(ch);
      if (!url) continue;
      var n = ch.chapterIndex || (i + 1);
      var name = clean(ch.chapterName) || ("第" + n + "集");
      if (!pic) pic = t(ch.iconUrl || ch.icon);
      if (!intro) intro = clean(ch.introduction);
      episodes.push({ name: name.replace(/[$#]/g, "_"), id: url, link: url });
    }
    var first = chapters[0] || {};
    if (!title) title = clean(first.bookName) || "悟圣短剧";
    if (!pic) pic = t(first.iconUrl || first.icon);
    if (!intro) intro = clean(first.introduction);
    return {
      id: raw,
      type: "detail",
      title: title,
      name: title,
      link: raw,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: intro + (episodes.length ? "\n共" + episodes.length + "集" : ""),
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
  return [];
}
