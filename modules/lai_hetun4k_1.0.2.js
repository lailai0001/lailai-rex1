// 河豚4K for REX (lai_hetun4k v1.0.0)
// 移植自 LeeCatPaw 的 lee_hetun4k（只读蓝图）：RSA-1024 握手 + AES-256-ECB
// 签名 + AES-128-CBC 设备参数 + protobuf，REX 沙箱没有加密库，加密全部放在
// Railway 的 javsb-relay（/ht 接口）上做，模块只调 Railway 的 HTTP 接口。
// 上游域名动态取自腾讯 COS az1.txt；握手换 dynamicKey，失败时回退内置公钥。
// 接口全是文字请求，播放直链由 App 直接播，不走 Railway 播放额度。
// 分类（7 个真实分类，站方 getCategory 返回）：电影 21、剧集 22、动漫 25、
// 综艺 26、短剧 27、漫剧 28、直播 29。
// 详情按清晰度/来源分线（蓝光4k 置顶）；集 token 为直链或 base64 JSON，
// 点集后由 Relay /play 调 videoUsableUrl 解出直链。

// v1.0.2（episodes + loadResource）：恢复集数选集；loadDetail 只返 episodes，不预解播放地址；每集由 loadResource 调一次 /play 解出直链并带回鉴权头，解不出返回空数组。
WidgetMetadata = {
  id: "lai_hetun4k",
  title: "河豚4K",
  description: "河豚4K：电影/剧集/动漫/综艺/短剧/漫剧/直播，走 Railway 中转 RSA/AES/protobuf 接口",
  author: "lai",
  version: "1.0.2",
  requiredVersion: "0.0.1",
  site: "https://javsb-relay-production.up.railway.app/ht",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "🆕推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎬电影", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "21" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📺剧集", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎌动漫", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "25" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎤综艺", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "26" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎭短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "27" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📖漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "28" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📡直播", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "29" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var WORKER = "https://javsb-relay-production.up.railway.app/ht";
var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson(path) {
  try {
    var res = await Widget.http.get(WORKER + path, {
      headers: { "User-Agent": UA, "Accept": "application/json" }
    });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

function toCard(it) {
  var id = t(it.vod_id);
  if (!id) return null;
  var pic = t(it.vod_pic);
  var name = clean(it.vod_name) || "河豚4K";
  var remarks = clean(it.vod_remarks);
  if (it.vod_year) remarks = (remarks ? remarks + " · " : "") + t(it.vod_year);
  if (it.vod_area) remarks = (remarks ? remarks + " · " : "") + clean(it.vod_area);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: remarks,
    mediaType: "movie"
  };
}

function toList(j) {
  var out = [];
  if (!j || !j.list) return out;
  for (var i = 0; i < j.list.length; i++) {
    var c = toCard(j.list[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var j = null;
    if (!cat || cat === "home") {
      j = await getJson("/home");
    } else {
      j = await getJson("/category?id=" + encodeURIComponent(cat) + "&page=" + page);
    }
    var list = toList(j);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "载入失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

function pickKeyword(params) {
  if (params == null) return "";
  if (typeof params === "string" || typeof params === "number") return String(params).trim();
  var keys = ["keyword", "q", "search", "text", "query", "wd", "key"];
  for (var i = 0; i < keys.length; i++) {
    if (params[keys[i]]) return String(params[keys[i]]).trim();
  }
  return "";
}

async function search(params) {
  params = params || {};
  var wd = pickKeyword(params);
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var j = await getJson("/search?wd=" + encodeURIComponent(wd) + "&page=" + page);
    var list = toList(j);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function resolvePlay(cand) {
  try {
    var j = await getJson("/play?id=" + encodeURIComponent(cand.url));
    if (j && j.url) return j;
  } catch (e) { /* fall through */ }
  return null;
}

async function loadDetail(link) {
  try {
    var id = t(link);
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson("/detail?id=" + encodeURIComponent(id));
    if (!j || !j.list || !j.list.length) {
      return { id: id, type: "url", title: "详情获取失败", description: "Relay 无返回" };
    }
    var v = j.list[0];
    var title = clean(v.vod_name) || "河豚4K";
    var pic = t(v.vod_pic);
    var descParts = [];
    if (v.vod_remarks) descParts.push(clean(v.vod_remarks));
    if (v.type_name) descParts.push("类型：" + clean(v.type_name));
    if (v.vod_area) descParts.push("地区：" + clean(v.vod_area));
    if (v.vod_year) descParts.push("年份：" + clean(v.vod_year));
    if (v.vod_director) descParts.push("导演：" + clean(v.vod_director));
    if (v.vod_actor) descParts.push("演员：" + clean(v.vod_actor));
    if (v.vod_content) descParts.push(clean(v.vod_content));
    // 分集：vod_play_from / vod_play_url 用 $$$ 分线、# 分集；集名带线路名前缀，
    // link 为集 token（直链或 base64 JSON），loadResource 调 Relay /play 解出直链，/play 给的 headers 一并返回。
    var episodes = [];
    var lineCount = 0;
    var fromArr = String(v.vod_play_from || "").split("$$$");
    var urlArr = String(v.vod_play_url || "").split("$$$");
    for (var li = 0; li < fromArr.length; li++) {
      var lineName = clean(fromArr[li]);
      if (!lineName) continue;
      lineCount++;
      var eps = String(urlArr[li] || "").split("#");
      for (var ei = 0; ei < eps.length; ei++) {
        var ep = String(eps[ei] || "");
        var dollar = ep.indexOf("$");
        if (dollar < 0) continue;
        var epName = clean(ep.slice(0, dollar));
        var epUrl = t(ep.slice(dollar + 1));
        if (!epName || !epUrl) continue;
        episodes.push({ name: lineName + "·" + epName, id: epUrl, link: epUrl });
      }
    }
    var desc = descParts.join("\n");
    if (episodes.length) {
      desc += "\n共" + episodes.length + "集 · " + lineCount + "条线路";
    } else {
      desc += "\n未找到可播放地址";
    }
    return {
      id: String(v.vod_id || id),
      type: "detail",
      title: title,
      name: title,
      link: String(v.vod_id || id),
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: desc.replace(/^\n+/, ""),
      mediaType: "movie",
      episodes: episodes
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

function pickLink(params) {
  if (!params) return "";
  if (typeof params === "string") return params;
  var keys = ["link", "url", "videoUrl", "streamUrl", "id"];
  for (var i = 0; i < keys.length; i++) {
    var v = t(params[keys[i]]);
    if (v) return v;
  }
  return "";
}

function pickName(params) {
  if (!params || typeof params !== "object") return "";
  return t(params.name || params.title || "");
}

// 播放：集 token（直链或 base64 JSON）调一次 /play 解出直链，/play 给的 headers 一并返回
// （直链曾回 401 需鉴权头）；/play 解不出时，若 token 本身就是视频格式直链则透传兜底，否则返回空数组，不编假地址。
async function loadResource(params) {
  var raw = pickLink(params);
  if (!raw) return [];
  var name = pickName(params);
  var headers = { "User-Agent": UA, "Referer": WORKER + "/" };
  var pj = await resolvePlay({ url: raw });
  if (pj && pj.url) {
    var h2 = { "User-Agent": UA, "Referer": WORKER + "/" };
    if (pj.headers) {
      for (var hk in pj.headers) { h2[hk] = pj.headers[hk]; }
    }
    return [{ name: name || "播放", url: String(pj.url), playerType: "app", customHeaders: h2 }];
  }
  if (isVideoFormat(raw)) {
    return [{ name: name || "播放", url: raw, playerType: "app", customHeaders: headers }];
  }
  return [];
}

function isVideoFormat(url) {
  var low = String(url || "").toLowerCase();
  return low.indexOf(".m3u8") >= 0 || low.indexOf(".mp4") >= 0 || low.indexOf(".ts") >= 0 || low.indexOf(".flv") >= 0 || low.indexOf(".mkv") >= 0;
}

