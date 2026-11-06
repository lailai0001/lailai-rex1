// 多聚短剧 · 香蕉 for REX (lai_duoju_xiangjiao v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_xiangjiao（只读蓝图）：纯 HTTPS，无签名无加密，
// 但每次调用需先 POST /api/guest-sessions 取访客 token（随机 deviceId，token 30 分钟有效，
// 模块内变量缓存，失效重取）。分类 cat:* 需先调 /api/categories 换真实分类 id。

WidgetMetadata = {
  id: "lai_duoju_xiangjiao",
  title: "多聚短剧 · 香蕉",
  description: "多聚短剧 · 香蕉：精选推荐/全部剧场/AI 短剧，访客 token 接口",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://xiangjiaoai.ai",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "精选推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "hot" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "全部剧场", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "theater" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "明星换脸", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:明星换脸" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "影视魔改", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:影视魔改" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "动漫游戏", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:动漫游戏" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "穿越重生", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:穿越重生" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "系统异能", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:系统异能" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "仙侠修真", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:仙侠修真" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "古装权谋", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cat:古装权谋" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://xiangjiaoai.ai";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
var DEVICE = "";
var TOKEN = "";
var TOKEN_AT = 0;
var CATIDS = null;
var CAT_AT = 0;

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function randomHex(n) {
  var out = "";
  var hex = "0123456789abcdef";
  for (var i = 0; i < n; i++) {
    var v = Math.floor(Math.random() * 256);
    out += hex.charAt((v >>> 4) & 15) + hex.charAt(v & 15);
  }
  return out;
}

async function parseRes(res) {
  if (!res || res.data == null) return null;
  if (typeof res.data === "object") return res.data;
  var s = String(res.data).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function apiRaw(method, path, body, auth) {
  var headers = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Origin": BASE,
    "Content-Type": "application/json"
  };
  if (auth) headers["Authorization"] = "Bearer " + auth;
  var res;
  if (method === "POST") {
    res = await Widget.http.post(BASE + path, body ? JSON.stringify(body) : "", { headers: headers });
  } else {
    res = await Widget.http.get(BASE + path, { headers: headers });
  }
  return parseRes(res);
}

async function guest() {
  if (TOKEN && Date.now() - TOKEN_AT < 30 * 60 * 1000) return TOKEN;
  if (!DEVICE) DEVICE = randomHex(16);
  var j = await apiRaw("POST", "/api/guest-sessions", { device_id: DEVICE }, "");
  TOKEN = (j && j.data && j.data.access_token) || (j && j.access_token) || "";
  if (!TOKEN) throw new Error("香蕉未返回访客令牌");
  TOKEN_AT = Date.now();
  return TOKEN;
}

async function api(method, path, body) {
  var token = await guest();
  return apiRaw(method, path, body, token);
}

async function categoryId(name) {
  if (Date.now() - CAT_AT > 10 * 60 * 1000 || !CATIDS) {
    var j = await api("GET", "/api/categories", null);
    CATIDS = {};
    var rows = (j && j.data) || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id && rows[i].name) CATIDS[rows[i].name] = String(rows[i].id);
    }
    CAT_AT = Date.now();
  }
  return CATIDS[name] || "";
}

function toCard(raw) {
  var r = raw.drama ? raw.drama : raw;
  if (r.image_url && !r.cover_url && raw.image_url) r.cover_url = raw.image_url;
  if (!r || !r.id || !r.title) return null;
  var count = Number(r.episode_count || r.latest_episode_number) || 0;
  var remark = "";
  if (count) remark = (r.serial_status === "finished" ? "全" : "更新至") + count + "集";
  else if (r.serial_status === "finished") remark = "已完结";
  var pic = r.cover_url || r.image_url || "";
  var tags = [];
  var tagList = r.tags || [];
  for (var i = 0; i < tagList.length && i < 4; i++) {
    if (tagList[i].name) tags.push(tagList[i].name);
  }
  return {
    id: String(r.id),
    type: "url",
    title: String(r.title),
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: String(r.id),
    description: remark,
    mediaType: "movie"
  };
}

function toList(j) {
  var out = [];
  var rows = (j && j.data && j.data.items) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  if (cat === "hot") {
    if (page !== 1) return [];
    return toList(await api("GET", "/api/home/hot", null));
  }
  var query = "limit=" + Math.min(300, page * 30);
  if (cat && cat.indexOf("cat:") === 0) {
    var id = await categoryId(cat.slice(4));
    if (!id) return [];
    query += "&category_id=" + encodeURIComponent(id);
  }
  var all = toList(await api("GET", "/api/theater?" + query, null));
  return all.slice((page - 1) * 30, page * 30);
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "hot");
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
    var list = toList(await api("GET", "/api/search?q=" + encodeURIComponent(wd) + "&page=" + page, null));
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var info = await api("GET", "/api/dramas/" + encodeURIComponent(id), null);
    var epsJ = await api("GET", "/api/dramas/" + encodeURIComponent(id) + "/episodes", null);
    var data = (info && info.data) || {};
    var rows = (epsJ && epsJ.data) || [];
    var seen = {};
    var list = [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].id) continue;
      // 站方 commerce.can_play=false 的集需付费（29 金币），播不了就不列出；
      // 无 commerce 字段的集保留（与猫源一致）。
      if (rows[i].commerce && rows[i].commerce.can_play === false) continue;
      var no = Number(rows[i].episode_number) || (i + 1);
      if (seen[no]) continue;
      seen[no] = 1;
      list.push({ no: no, id: rows[i].id, title: rows[i].title });
    }
    list.sort(function (a, b) { return a.no - b.no; });
    if (!list.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var episodes = [];
    for (var ei = 0; ei < list.length; ei++) {
      var name = String(list[ei].title || ("第" + list[ei].no + "集")).replace(/[$#]/g, "_");
      episodes.push({ name: name, id: "xiangjiao://" + id + "/" + list[ei].id, link: "xiangjiao://" + id + "/" + list[ei].id });
    }
    var pic = data.cover_url || "";
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < episodes.length; pi++) {
      var playCand = await resolvePlayUrl(episodes[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = clean(data.description) + "\n共" + episodes.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: id,
      type: "detail",
      title: data.title || id,
      name: data.title || id,
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
  var m = /^xiangjiao:\/\/([^/]+)\/([^/]+)$/.exec(raw);
  if (!m) return "";
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      var j = await api("POST", "/api/playback/sessions", { episode_id: m[2] });
      var url = (j && j.data && j.data.media && j.data.media.manifest_url) || "";
      if (/^https?:\/\//.test(url)) {
        return url;
      }
      return "";
    } catch (e) {
      TOKEN = "";
      if (attempt === 1) return "";
    }
  }
  return "";
}
