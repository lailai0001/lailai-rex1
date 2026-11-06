// 多聚短剧 · 91短剧 for REX (lai_duoju_dj91 v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_dj91（只读蓝图）：纯 HTTPS HTML 抓取，无签名无加密，
// 3 个域名轮换重试（91crdjai.com 为现行主域，2026-11-06 实测 91crdj.com 301 跳至此域；
// 另两个 lwbcbync.cc 镜像）。
// 列表解析 a.card；详情取 data-total 或“第 N 集”标题；播放取 playInitialData 脚本 JSON 的 src。

WidgetMetadata = {
  id: "lai_duoju_dj91",
  title: "多聚短剧 · 91短剧",
  description: "多聚短剧 · 91短剧：短剧/漫剧/真人剧/视频/排行，纯 HTML 抓取",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://91crdjai.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "duanju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "manju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "真人剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhenrenju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "视频", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shipin" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "排行", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "paihang" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AI短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "biaoqian:aiduanju" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var DOMAINS = ["https://91crdjai.com", "https://91crdj.com", "https://0303.lwbcbync.cc", "https://j6bmio.lwbcbync.cc"];
var UA = "Mozilla/5.0 (Linux; Android 13)";
var CURRENT = DOMAINS[0];
var CATS = [
  ["duanju", "短剧"], ["manju", "漫剧"], ["zhenrenju", "真人剧"],
  ["shipin", "视频"], ["paihang", "排行"], ["biaoqian:aiduanju", "AI短剧"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function absUrl(s) {
  if (!s) return "";
  if (s.indexOf("http") === 0) return s;
  if (s.indexOf("//") === 0) return "https:" + s;
  if (s.indexOf("/") === 0) return CURRENT + s;
  return CURRENT + "/" + s;
}

async function getText(path) {
  var failure = null;
  var order = [CURRENT];
  for (var i = 0; i < DOMAINS.length; i++) {
    if (DOMAINS[i] !== CURRENT) order.push(DOMAINS[i]);
  }
  for (var di = 0; di < order.length; di++) {
    var domain = order[di];
    try {
      var res = await Widget.http.get(domain + path, { headers: { "User-Agent": UA, "Referer": domain + "/" } });
      if (!res || res.data == null) throw new Error("91 无返回");
      var s = (typeof res.data === "object") ? JSON.stringify(res.data) : String(res.data);
      if (!s) throw new Error("91 空响应");
      if (s.length < 1000) throw new Error("91 响应过短（可能是跳转页）");
      CURRENT = domain;
      return s;
    } catch (e) { failure = e; }
  }
  throw failure || new Error("91 所有入口不可用");
}

function catOf(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i];
  }
  return CATS[0];
}

function cards(html, cat) {
  var out = [];
  var re = /<a\s+class="[^"]*\bcard\b[^"]*"/gi;
  var starts = [];
  var m;
  while ((m = re.exec(html)) !== null) starts.push(m.index);
  var seen = {};
  for (var si = 0; si < starts.length; si++) {
    var block = html.slice(starts[si], (si + 1 < starts.length) ? starts[si + 1] : html.length);
    var link = /href="(?:https?:\/\/[^/"]+)?(\/(?:duanju|manju|zhenrenju|shipin|paihang)\/\d+-[^"/]+\/)"/i.exec(block);
    if (!link) continue;
    var id = link[1].replace(/^\/|\/$/g, "");
    if (seen[id]) continue;
    var trackM = /data-track-item-name="([^"]+)"/i.exec(block);
    var altM = /\balt="([^"]+)"/i.exec(block);
    var hM = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i.exec(block);
    var rawName = (trackM && trackM[1]) || (altM && altM[1]) || (hM && hM[1]) || "";
    var name = clean(rawName).replace(/^《|》$|封面$/g, "");
    if (!name) continue;
    seen[id] = 1;
    var picM = /\b(?:data-src|data-original|data-lazy-src|src)="([^" ]+)"/i.exec(block);
    var pic = (picM && picM[1]) || "";
    var markM = /class="eps-flag"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    var mark = clean((markM && markM[1]) || "");
    out.push({
      id: id,
      type: "url",
      title: name,
      posterPath: /^(data:|.*placeholder)/i.test(pic) ? "" : absUrl(pic),
      coverUrl: /^(data:|.*placeholder)/i.test(pic) ? "" : absUrl(pic),
      backdropPath: /^(data:|.*placeholder)/i.test(pic) ? "" : absUrl(pic),
      link: id,
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
  var entry = catOf(cat);
  var root;
  if (entry[0].indexOf("biaoqian:") === 0) root = "/biaoqian/" + encodeURIComponent(entry[0].slice(9)) + "/";
  else root = "/" + entry[0] + "/";
  var path = page === 1 ? root : root.replace(/\/$/, "") + "/page/" + page + "/";
  return cards(await getText(path), entry[1]);
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "duanju");
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
  try {
    var list = cards(await getText("/search/?q=" + encodeURIComponent(wd) + (page > 1 ? "&page=" + page : "")), "");
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!/^(duanju|manju|zhenrenju|shipin|paihang)\/\d+-[^/]+$/.test(id)) {
      return { id: "err", type: "url", title: "解析失败", description: "91 剧集 ID 无效" };
    }
    var html = await getText("/" + id + "/");
    var totalM = /data-total="(\d+)"/i.exec(html);
    var total = Number((totalM && totalM[1]) || 0);
    var episodes = [];
    if (total > 0 && total <= 2000) {
      for (var ni = 0; ni < total; ni++) episodes.push(ni + 1);
    } else {
      var seen = {};
      var re = /title="第\s*(\d+)\s*集"/gi;
      var mm;
      while ((mm = re.exec(html)) !== null) {
        var n = Number(mm[1]);
        if (!seen[n]) { seen[n] = 1; episodes.push(n); }
      }
    }
    if (!episodes.length) {
      var seen2 = {};
      var re2 = new RegExp("href=\"(?:https?:\\/\\/[^/\" ]+)?\\/" + id + "\\/(\\d+)\\/\"", "gi");
      var mm2;
      while ((mm2 = re2.exec(html)) !== null) {
        var n2 = Number(mm2[1]);
        if (!seen2[n2]) { seen2[n2] = 1; episodes.push(n2); }
      }
    }
    if (!episodes.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    episodes.sort(function (a, b) { return a - b; });
    var h1M = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    var title = clean((h1M && h1M[1]) || "") || id;
    var descM = /<meta[^>]*name="description"[^>]*content="([^"]*)"/i.exec(html);
    var desc = clean((descM && descM[1]) || "");
    var eps = [];
    for (var ei = 0; ei < episodes.length; ei++) {
      eps.push({ name: "第" + episodes[ei] + "集", id: "dj91://" + id + "/" + episodes[ei], link: "dj91://" + id + "/" + episodes[ei] });
    }
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < eps.length; pi++) {
      var playCand = await resolvePlayUrl(eps[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = desc + "\n共" + eps.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: id,
      type: "detail",
      title: title,
      name: title,
      link: id,
      posterPath: "",
      coverUrl: "",
      backdropPath: "",
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
  var m = /^dj91:\/\/((?:duanju|manju|zhenrenju|shipin|paihang)\/\d+-[^/]+)\/(\d+)$/.exec(raw);
  if (!m) return "";
  try {
    var html = await getText("/" + m[1] + "/" + m[2] + "/");
    var rawM = /<script[^>]*id="playInitialData"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (!rawM) return "";
    var data = JSON.parse(rawM[1]);
    var ep = (data && (data.current || data.episode)) || {};
    var url = ep.src || ep.videoUrl || ep.playUrl || ep.url || (String(ep.srcHevc || "").indexOf(".m3u8") >= 0 ? ep.srcHevc : "");
    if (/^https?:\/\//.test(url)) {
      return url;
    }
  } catch (e) { /* fall through */ }
  return "";
}
