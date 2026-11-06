// 多聚短剧 · 黄豆2 for REX (lai_duoju_huangdou2 v1.0.0)
// 移植自 LeeCatPaw 的 lee_duoju_huangdou2（只读蓝图）：纯 HTTPS HTML 抓取，无签名无加密。
// 列表解析 drama-card/rank-runner/rank-row 块；详情取 data-total 或“第 N 集”标题；
// 播放取 /video/{id}/{seq}/ 页内 ninePlayData 脚本 JSON 的 src。

WidgetMetadata = {
  id: "lai_duoju_huangdou2",
  title: "多聚短剧 · 黄豆2",
  description: "多聚短剧 · 黄豆2：AI短剧/AI漫剧/榜单，纯 HTML 抓取",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://aihuangdou.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "首页", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AI短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "ai-duanju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AI漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "ai-manju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "榜单", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rankings" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://aihuangdou.com";
var UA = "Mozilla/5.0 (Linux; Android 13)";
var CATS = [
  ["home", "首页"], ["ai-duanju", "AI短剧"], ["ai-manju", "AI漫剧"], ["rankings", "榜单"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
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
    var res = await Widget.http.get(BASE + path, { headers: { "User-Agent": UA, "Referer": BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
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

function cards(html, cat) {
  var out = [];
  var re = /<(?:article|li|div)\s+class="[^"]*(?:drama-card|rank-runner|rank-row)(?:"|\s)/gi;
  var starts = [];
  var m;
  while ((m = re.exec(html)) !== null) starts.push(m.index);
  var seen = {};
  for (var si = 0; si < starts.length; si++) {
    var block = html.slice(starts[si], (si + 1 < starts.length) ? starts[si + 1] : html.length);
    var link = /href="(?:https?:\/\/[^/"]+)?(\/drama\/\d+\/)"/i.exec(block);
    if (!link) continue;
    var id = link[1].replace(/^\/|\/$/g, "");
    if (seen[id]) continue;
    var trackM = /data-track-item-name="([^"]+)"/i.exec(block);
    var hM = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i.exec(block);
    var altM = /\balt="([^"]+)"/i.exec(block);
    var title = clean((trackM && trackM[1]) || (hM && hM[1]) || (altM && altM[1]) || "");
    if (!title) continue;
    seen[id] = 1;
    var imgM = /\b(?:data-src|data-original|data-lazy-src|src)="([^" ]+)"/i.exec(block);
    var image = (imgM && imgM[1]) || "";
    var cover = /^(data:|.*placeholder|.*loading)/i.test(image) ? "" : absUrl(image);
    var epsM = /class="eps-flag"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    var scoreM = /class="card-score"[^>]*>([\s\S]*?)<\/em>/i.exec(block);
    var remark = clean((epsM && epsM[1]) || "");
    var score = clean((scoreM && scoreM[1]) || "");
    var desc = "";
    if (score) desc = "评分" + score;
    if (remark) desc = desc ? (desc + " · " + remark) : remark;
    out.push({
      id: id,
      type: "url",
      title: title,
      posterPath: cover,
      coverUrl: cover,
      backdropPath: cover,
      link: id,
      description: desc,
      mediaType: "movie"
    });
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  var root = cat === "home" ? "/" : "/" + (cat || "home") + "/";
  var path = page === 1 ? root : root.replace(/\/$/, "") + "/" + page + "/";
  return cards(await getText(path), catName(cat));
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "home");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await listing(cat, page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = cards(await getText("/search/?q=" + encodeURIComponent(wd) + (page > 1 ? "&page=" + page : "")), "");
  return list.length ? list : emptyItem();
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!/^drama\/\d+$/.test(id)) return { id: "err", type: "url", title: "解析失败", description: "剧集 ID 无效" };
    var html = await getText("/" + id + "/");
    var h1M = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    var title = clean((h1M && h1M[1]) || "") || id;
    var totalM = /data-total="(\d+)"/i.exec(html);
    var total = Number((totalM && totalM[1]) || 0);
    var numbered = [];
    if (total > 0 && total <= 2000) {
      for (var ni = 0; ni < total; ni++) numbered.push(ni + 1);
    } else {
      var seen = {};
      var re = /title="第\s*(\d+)\s*集"/gi;
      var mm;
      while ((mm = re.exec(html)) !== null) {
        var n = Number(mm[1]);
        if (!seen[n]) { seen[n] = 1; numbered.push(n); }
      }
    }
    if (!numbered.length && /href="[^"]*\/video\/\d+\//i.test(html)) numbered.push(1);
    if (!numbered.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    numbered.sort(function (a, b) { return a - b; });
    var descM = /<meta[^>]*name="description"[^>]*content="([^"]*)"/i.exec(html);
    var desc = clean((descM && descM[1]) || "");
    var picM = /\b(?:data-src|data-original|src)="(https?:\/\/pic\.[^"]+)"/i.exec(html);
    var pic = (picM && picM[1]) || "";
    var episodes = [];
    for (var ei = 0; ei < numbered.length; ei++) {
      episodes.push({ name: "第" + numbered[ei] + "集", id: "huangdou2://" + id + "/" + numbered[ei], link: "huangdou2://" + id + "/" + numbered[ei] });
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
  var m = /^huangdou2:\/\/(drama\/\d+)\/(\d+)$/.exec(raw);
  if (!m) return [];
  var leaf = m[1].split("/").pop();
  var seq = Number(m[2]);
  var html = await getText("/video/" + leaf + "/" + (seq > 1 ? seq + "/" : ""));
  var rawM = /<script[^>]*id="ninePlayData"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!rawM) return [];
  var data = null;
  try { data = JSON.parse(rawM[1]); } catch (e) { return []; }
  var ep = (data && (data.current || data.episode)) || {};
  var url = ep.src || ep.videoUrl || ep.playUrl || ep.url || (String(ep.srcHevc || "").indexOf(".m3u8") >= 0 ? ep.srcHevc : "");
  if (/^https?:\/\//.test(url)) {
    return [{ name: "播放", url: url, playerType: "app" }];
  }
  return [];
}
