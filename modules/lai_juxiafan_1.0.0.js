// 剧下饭4K for REX (lai_juxiafan v1.0.0)
// 移植自 LeeCatPaw 的 lee_juxiafan4k（只读蓝图）：请求要 datasign 签名
// （AES-256-ECB，密钥 kZ6fT8oF6oM8eX6lF7eH2rJ3pW7gW0kC），REX 沙箱没有加密库，
// 签名全部放在 Railway 的 javsb-relay（/jxf 接口）上做，模块只调 Railway 的 HTTP 接口。
// 接口地址：https://javsb-relay-production.up.railway.app/jxf。
// 接口只做文字请求（分类/详情/搜索/解析），视频流由 App 直接播，不走 Railway。
// 分类（2026-11-06 站方 /api/v1/video/classifies 实测返回，22023 直播为蜘蛛逻辑补入）：
//   22016 电视剧、22017 电影、22018 动漫、22019 综艺、22020 短剧、
//   22021 少儿、22022 纪录片、22023 直播、22024 AI漫剧；站方无筛选、无清晰度档位。
// 详情：多条线路（成都超清专线/剧下饭极速专线/山东蓝光主线/量子直连/360直连/
//   暴风直连/魔都直连/腾讯/爱奇艺/B站等，线路名原样保留），每线多集；
//   集名带线路名前缀，点集后由 Railway /play 解析出直链播放。
// 播放：直链多为 .m3u8 或 .mp4；腾讯/爱奇艺/B站等源给的是平台页地址，
//   App 播不了是站方给的就是平台页，非模块问题。

WidgetMetadata = {
  id: "lai_juxiafan",
  title: "剧下饭",
  description: "剧下饭4K：电视剧/电影/动漫/综艺/短剧/少儿/纪录片/直播/AI漫剧，走 Railway 中转 datasign 签名接口",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://javsb-relay-production.up.railway.app/jxf",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "📺电视剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22016" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎬电影", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22017" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎌动漫", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22018" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎤综艺", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22019" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎭短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22020" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🧒少儿", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22021" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎥纪录片", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22022" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📡直播", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22023" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🤖AI漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "22024" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var WORKER = "https://javsb-relay-production.up.railway.app/jxf";
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
  var name = clean(it.vod_name) || "剧下饭";
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: clean(it.vod_remarks),
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
    if (!cat) return emptyItem();
    var j = await getJson("/category?id=" + encodeURIComponent(cat) + "&page=" + page);
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

async function loadDetail(link) {
  try {
    var id = t(link);
    // link 可能是纯数字 id，也可能是详情地址
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson("/detail?id=" + encodeURIComponent(id));
    if (!j || !j.list || !j.list.length) {
      return { id: id, type: "url", title: "详情获取失败", description: "Worker 无返回" };
    }
    var v = j.list[0];
    var title = clean(v.vod_name) || "剧下饭";
    var pic = t(v.vod_pic);
    var descParts = [];
    if (v.vod_remarks) descParts.push(clean(v.vod_remarks));
    if (v.vod_area) descParts.push("地区：" + clean(v.vod_area));
    if (v.vod_year) descParts.push("年份：" + clean(v.vod_year));
    if (v.vod_director) descParts.push("导演：" + clean(v.vod_director));
    if (v.vod_actor) descParts.push("演员：" + clean(v.vod_actor));
    if (v.vod_content) descParts.push(clean(v.vod_content));
    // 分集：vod_play_from / vod_play_url 用 $$$ 分线、# 分集；集名带线路名前缀，
    // link 编码为 线路名@@集地址（集地址形如 <vodId>@@<源序号>_<集序号>），
    // loadResource 再调 Railway /play 解析出直链。
    var episodes = [];
    var fromArr = String(v.vod_play_from || "").split("$$$");
    var urlArr = String(v.vod_play_url || "").split("$$$");
    for (var li = 0; li < fromArr.length; li++) {
      var lineName = clean(fromArr[li]);
      if (!lineName) continue;
      var eps = String(urlArr[li] || "").split("#");
      for (var ei = 0; ei < eps.length; ei++) {
        var ep = String(eps[ei] || "");
        var dollar = ep.indexOf("$");
        if (dollar < 0) continue;
        var epName = clean(ep.slice(0, dollar));
        var epUrl = t(ep.slice(dollar + 1));
        if (!epName || !epUrl) continue;
        var token = lineName + "@@" + epUrl;
        episodes.push({ name: lineName + "·" + epName, id: token, link: token });
      }
    }
    var result = {
      id: String(v.vod_id || id),
      type: "detail",
      title: title,
      name: title,
      link: String(v.vod_id || id),
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descParts.join("\n"),
      playerType: "app",
      episodes: episodes
    };
    if (!episodes.length) {
      result.description = (descParts.join("\n") + "\n未找到播放地址").replace(/^\n+/, "");
    }
    return result;
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

function isVideoFormat(url) {
  var low = String(url || "").toLowerCase();
  return low.indexOf(".m3u8") >= 0 || low.indexOf(".mp4") >= 0 || low.indexOf("m.php") >= 0 || low.indexOf(".ts") >= 0;
}

// 点集后：link 为 线路名@@集地址，调 Railway /play 解析出直链；直链本身是
// m3u8/mp4 形态，App 直接播。解析不到时返回空，App 会提示解析失败。
async function loadResource(params) {
  params = params || {};
  var raw = t(params.link || params.url || params.id || "");
  if (!raw && params.item) raw = t(params.item.link || params.item.id || "");
  if (!raw) return [];
  // 直链（已是 m3u8/mp4）直接播
  if (isVideoFormat(raw) && raw.indexOf("@@") < 0) {
    return [{ name: "播放", url: raw, playerType: "app" }];
  }
  var flag = "";
  var epUrl = raw;
  var at = raw.indexOf("@@");
  if (at >= 0) {
    flag = raw.slice(0, at);
    epUrl = raw.slice(at + 2);
  }
  if (!epUrl) return [];
  // 集地址本身就是直链（量子/360/暴风/魔都等直连线给的 .m3u8），不必再调 /play
  if (isVideoFormat(epUrl) && epUrl.indexOf("@@") < 0) {
    return [{ name: "播放", url: epUrl, playerType: "app" }];
  }
  try {
    var j = await getJson("/play?id=" + encodeURIComponent(epUrl) + "&flag=" + encodeURIComponent(flag));
    var playUrl = j && j.url ? String(j.url) : "";
    if (playUrl) {
      return [{ name: "播放", url: playUrl, playerType: "app" }];
    }
  } catch (e) { /* fall through */ }
  return [];
}
