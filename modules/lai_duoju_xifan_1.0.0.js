// 多聚短剧 · 西饭 for REX (lai_duoju_xifan v1.0.0)
// 移植自 LeeCatPaw 的 lee_duoju_xifan（只读蓝图）：纯 HTTPS GET JSON，无签名无加密。
// 列表/搜索/详情/播放均为 xifan-api-cn.youlishipin.com 的 GET 接口；
// 搜索 requestId 为时间戳 + 固定后缀（无签名作用）。

WidgetMetadata = {
  id: "lai_duoju_xifan",
  title: "多聚短剧 · 西饭",
  description: "多聚短剧 · 西饭：都市/青春/言情/豪门等短剧，纯 HTTPS 接口",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://xifan-api-cn.youlishipin.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "都市", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "dushi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "青春", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "qingchun" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "现代言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xiandaiyanqing" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "豪门", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "haomen" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "大女主", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "danvzhu" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "逆袭", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "nixi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "打脸虐渣", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "dalianuecha" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "穿越", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "chuanyue" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var HOST = "https://xifan-api-cn.youlishipin.com";
var CATS = [
  ["all", "全部", "68", "都市"],
  ["dushi", "都市", "68", "都市"],
  ["qingchun", "青春", "68", "青春"],
  ["xiandaiyanqing", "现代言情", "81", "现代言情"],
  ["haomen", "豪门", "81", "豪门"],
  ["danvzhu", "大女主", "80", "大女主"],
  ["nixi", "逆袭", "79", "逆袭"],
  ["dalianuecha", "打脸虐渣", "79", "打脸虐渣"],
  ["chuanyue", "穿越", "81", "穿越"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function getResult(path) {
  try {
    var res = await Widget.http.get(HOST + path, { headers: { "Accept": "application/json, text/plain, */*", "User-Agent": "okhttp/4.10.0" } });
    if (!res || res.data == null) return null;
    var j = null;
    if (typeof res.data === "object") j = res.data;
    else {
      try { j = JSON.parse(String(res.data)); } catch (e) { return null; }
    }
    if (!j || !j.result) return null;
    return j.result;
  } catch (e) { return null; }
}

function catOf(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i];
  }
  return CATS[0];
}

function toCard(item, category) {
  var id = clean(item.duanjuId || item.duanjuID);
  var name = clean(item.title);
  if (!id || !name) return null;
  var vodId = item.source ? (id + "@" + item.source) : id;
  var pic = clean(item.coverImageUrl);
  return {
    id: vodId,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: vodId,
    description: item.total ? ("共" + item.total + "集") : "",
    mediaType: "movie"
  };
}

function cardsOf(data, category) {
  var out = [];
  var els = (data && data.elements) || [];
  var seen = {};
  for (var ei = 0; ei < els.length; ei++) {
    var contents = els[ei].contents || [];
    for (var ci = 0; ci < contents.length; ci++) {
      var c = toCard(contents[ci].duanjuVo || {}, category);
      if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
    }
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = catOf(t(params.cat || "all"));
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var path = "/xifan/drama/portalPage?reqType=aggregationPage&offset=" + ((page - 1) * 30) + "&categoryId=" + cat[2] + "&categoryNames=" + encodeURIComponent(cat[3]) + "&pageID=page_theater&appId=drama";
  var list = cardsOf(await getResult(path), cat[1]);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var requestId = String(Date.now()) + "aa498144140ef297";
  var path = "/xifan/search/getSearchList?reqType=search&offset=" + ((page - 1) * 30) + "&keyword=" + encodeURIComponent(wd) + "&requestId=" + requestId + "&appId=drama";
  var list = cardsOf(await getResult(path), "西饭");
  return list.length ? list : emptyItem();
}

function splitId(id) {
  var at = id.indexOf("@");
  if (at < 0) return [id, ""];
  return [id.slice(0, at), id.slice(at + 1)];
}

async function detailData(id) {
  var parts = splitId(id);
  return getResult("/xifan/drama/getDuanjuInfo?duanjuId=" + encodeURIComponent(parts[0]) + "&source=" + encodeURIComponent(parts[1]) + "&appId=drama");
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var data = await detailData(id);
    if (!data) return { id: id, type: "url", title: "详情获取失败", description: "接口无返回" };
    var eps = [];
    var seen = {};
    var rows = data.episodeList || [];
    for (var i = 0; i < rows.length; i++) {
      var n = Number(rows[i].index) || (i + 1);
      if (seen[n]) continue;
      seen[n] = 1;
      eps.push({ n: n, name: "第" + n + "集", id: "xifan://" + id + "/" + n, link: "xifan://" + id + "/" + n });
    }
    eps.sort(function (a, b) { return a.n - b.n; });
    if (!eps.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var pic = clean(data.coverImageUrl);
    var out = [];
    for (var ei = 0; ei < eps.length; ei++) {
      out.push({ name: eps[ei].name, id: eps[ei].id, link: eps[ei].link });
    }
    return {
      id: id,
      type: "detail",
      title: clean(data.title) || "西饭短剧",
      name: clean(data.title) || "西饭短剧",
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: clean(data.desc || data.description) + "\n共" + out.length + "集",
      playerType: "app",
      episodes: out
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
  var m = /^xifan:\/\/(.+)\/(\d+)$/.exec(raw);
  if (!m) return [];
  try {
    var data = await detailData(m[1]);
    var rows = (data && data.episodeList) || [];
    var want = Number(m[2]);
    var url = "";
    for (var i = 0; i < rows.length; i++) {
      var n = Number(rows[i].index) || (i + 1);
      if (n === want) { url = clean(rows[i].playUrl); break; }
    }
    if (/^https?:\/\//.test(url)) {
      return [{ name: "播放", url: url, playerType: "app" }];
    }
  } catch (e) { /* fall through */ }
  return [];
}
