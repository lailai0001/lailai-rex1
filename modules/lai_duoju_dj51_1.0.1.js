// 多聚短剧 · 51短剧 for REX (lai_duoju_dj51 v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_dj51（只读蓝图）：纯 HTTPS HTML 抓取，无签名无加密。
// 列表解析 /play/{id}/1/ 链接；详情/播放解析页内 __NUXT_DATA__ JSON（含数字引用与
// Reactive/Ref 包装，纯 JS 递归解引用，与猫源 resolve 逻辑一致）。
// 只有一个真实分类“总榜”。

WidgetMetadata = {
  id: "lai_duoju_dj51",
  title: "多聚短剧 · 51短剧",
  description: "多聚短剧 · 51短剧：总榜短剧，纯 HTML 抓取",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://arab.bqdikpcrx.cc",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "总榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://arab.bqdikpcrx.cc";
var UA = "Mozilla/5.0 (Linux; Android 13)";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

async function getText(path) {
  try {
    var res = await Widget.http.get(BASE + path, { headers: { "User-Agent": UA, "Referer": BASE + "/" } });
    if (!res || res.data == null) return "";
    if (typeof res.data === "object") return JSON.stringify(res.data);
    return String(res.data);
  } catch (e) { return ""; }
}

function rows(html) {
  var m = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return [];
  try {
    var v = JSON.parse(m[1]);
    return (v && v.length != null) ? v : [];
  } catch (e) { return []; }
}

// __NUXT_DATA__ 解引用（devalue 格式）：对象/数组槽位里的整数是表下标，
// 但下标指向的条目本身就是值（数字即数字，不再当作下标继续追——否则会串到
// 表里其他条目）。包装数组 [Reactive|Ref|...， 下标] 再解一层。
var WRAPS = ["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef"];
function deref(table, v, depth) {
  depth = depth || 0;
  if (depth > 24) return null;
  if (typeof v === "number" && v >= 0 && v < table.length) {
    return materialize(table, table[v], depth + 1);
  }
  return v;
}
function materialize(table, e, depth) {
  depth = depth || 0;
  if (e && typeof e === "object" && e.length === 2 &&
    (e[0] === "Reactive" || e[0] === "ShallowReactive" || e[0] === "Ref" ||
     e[0] === "ShallowRef" || e[0] === "EmptyRef" || e[0] === "EmptyShallowRef")) {
    return deref(table, e[1], depth + 1);
  }
  if (Array.isArray(e)) {
    var arr = [];
    for (var i = 0; i < e.length; i++) arr.push(deref(table, e[i], depth + 1));
    return arr;
  }
  if (e && typeof e === "object") {
    var o = {};
    for (var k in e) { if (e.hasOwnProperty(k)) o[k] = deref(table, e[k], depth + 1); }
    return o;
  }
  return e;
}
function resolve(table, value, depth) {
  return deref(table, value, depth || 0);
}

function field(table, obj, keys) {
  if (!obj) return "";
  for (var i = 0; i < keys.length; i++) {
    var v = resolve(table, obj[keys[i]]);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

function cards(html, cls) {
  var out = [];
  var re = /<a\b[^>]*href="\/play\/(\d+)\/1\/"[^>]*>/gi;
  var seen = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    var id = m[1];
    if (seen[id]) continue;
    var near = html.slice(Math.max(0, m.index - 1200), m.index + 1200);
    var labelM = /aria-label="([^"]+)"/i.exec(m[0]);
    var altM = /\balt="([^"]+)"/i.exec(near);
    var label = clean((labelM && labelM[1]) || "");
    var alt = clean((altM && altM[1]) || "");
    var title = (label && label.indexOf("播放") < 0) ? label : alt;
    if (!title || title === "logo") continue;
    seen[id] = 1;
    var imgM = /(?:data-src|src)="(\/_img\/[^" ]+|https?:\/\/[^" ]*pic[^" ]*)"/i.exec(near);
    var image = (imgM && imgM[1]) || "";
    var pic = "";
    if (image) {
      if (image.indexOf("http") === 0) pic = image;
      else if (image.indexOf("/") === 0) pic = BASE + image;
      else pic = BASE + "/" + image;
    }
    out.push({
      id: id,
      type: "url",
      title: title,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      link: id,
      description: "",
      mediaType: "movie"
    });
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  var path = page > 1 ? ("/rank/page/" + page + "/") : "/rank/";
  return cards(await getText(path), "总榜");
}

async function loadList(params) {
  params = params || {};
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await listing("rank", page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var html = await getText("/search/?keyword=" + encodeURIComponent(wd) + (page > 1 ? "&page=" + page : ""));
  var low = wd.toLowerCase();
  var hits = cards(html, "51短剧").filter(function (v) { return v.title.toLowerCase().indexOf(low) >= 0; });
  if (hits.length) return hits;
  var lists = await listing("rank", 1);
  var seen = {};
  var out = [];
  for (var i = 0; i < lists.length; i++) {
    if (lists[i].title.toLowerCase().indexOf(low) >= 0 && !seen[lists[i].id]) {
      seen[lists[i].id] = 1;
      out.push(lists[i]);
    }
  }
  return out.length ? out : emptyItem();
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!/^\d+$/.test(id)) return { id: "err", type: "url", title: "解析失败", description: "51短剧 ID 无效" };
    var html = "";
    try { html = await getText("/play/" + id + "/1/"); } catch (e) { return { id: id, type: "url", title: "详情获取失败", description: "接口无返回" }; }
    var table = rows(html);
    var info = {};
    for (var i = 0; i < table.length; i++) {
      var r = table[i];
      if (r && typeof r === "object" && r.length == null && ("drama_name" in r)) { info = r; break; }
    }
    var episodes = {};
    var epNames = {};
    for (var j = 0; j < table.length; j++) {
      var entry = table[j];
      if (!entry || typeof entry !== "object" || entry.length != null || !("episode_title" in entry)) continue;
      var no = Number(field(table, entry, ["sort"]));
      if (no > 0 && !episodes[no]) {
        episodes[no] = 1;
        epNames[no] = String(field(table, entry, ["episode_title"]) || ("第" + no + "集"));
      }
    }
    var nums = [];
    for (var k in episodes) nums.push(Number(k));
    nums.sort(function (a, b) { return a - b; });
    if (!nums.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var eps = [];
    for (var ni = 0; ni < nums.length; ni++) {
      eps.push({ name: String(epNames[nums[ni]]).replace(/[$#]/g, "_"), id: "dj51://" + id + "/" + nums[ni], link: "dj51://" + id + "/" + nums[ni] });
    }
    var pic = String(field(table, info, ["cover_img", "cover"]) || "");
    if (pic && pic.indexOf("http") !== 0) pic = BASE + (pic.indexOf("/") === 0 ? pic : "/" + pic);
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < eps.length; pi++) {
      var playCand = await resolvePlayUrl(eps[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = String(field(table, info, ["description"]) || "") + "\n共" + eps.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: id,
      type: "detail",
      title: String(field(table, info, ["drama_name", "video_title"]) || id),
      name: String(field(table, info, ["drama_name", "video_title"]) || id),
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
  var m = /^dj51:\/\/(\d+)\/(\d+)$/.exec(raw);
  if (!m) return "";
  var html = (await getText("/play/" + m[1] + "/" + m[2] + "/")).replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  var media = "";
  var table = rows(html);
  for (var i = 0; i < table.length; i++) {
    var entry = table[i];
    if (!entry || typeof entry !== "object" || entry.length != null || !("episode_title" in entry)) continue;
    if (Number(field(table, entry, ["sort"])) === Number(m[2])) {
      var cand = String(field(table, entry, ["video_url"]) || "");
      if (cand.indexOf(".m3u8") >= 0) { media = cand; break; }
    }
  }
  if (!media) {
    var um = /https?:\/\/[^\s"'<>\\]{10,200}\.m3u8[^\s"'<>\\]{0,200}/i.exec(html);
    media = um ? um[0] : "";
  }
  if (/^https?:\/\//.test(media)) {
    return media;
  }
  return "";
}
