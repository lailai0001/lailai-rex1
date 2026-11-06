// 咕噜咕噜 for REX (lai_gulu4k v1.0.0)
// 移植自 LeeCatPaw 的 lee_gulu4k（只读蓝图）：咕噜与橘汁共用 v2 加密协议
// （ECDH 换密钥 + AES-256-CBC/GCM + zlib + protobuf），REX 沙箱没有加密库，
// 加密全部放在 Railway 的 javsb-relay（/gulu 接口）上做，模块只调 Railway 的 HTTP 接口。
// v2 服务器拦 Cloudflare（403）但不拦 Railway，故接口放 Railway；接口全是文字请求，
// 不走视频流量，播放直链由 App 直接播，不动 Railway 播放额度。
// 接口地址：https://javsb-relay-production.up.railway.app/gulu。
// 分类（15 个真实分类）：电影/电视剧/综艺/动漫/短剧/纪录片/大陆剧/港剧/台剧/
//   美剧/韩剧/日剧/泰剧/英剧/俄剧。
//   注意：翻页只认 pv(2,page)（Lee 原代码的 pb(2,varint(page)) 会被服务端
//   忽略，第 2 页与第 1 页完全相同）；年份/排序字段实测对返回无任何影响，已去掉。
// 详情：多条线路，每线多集；集名带线路名前缀，点集后由 Relay /play 解出直链播放。
// 播放直链是 m.php 形态（302/伪装），App 直接播；不走 Railway、不走 hls-relay。

WidgetMetadata = {
  id: "lai_gulu4k",
  title: "咕噜咕噜",
  description: "咕噜咕噜：电影/电视剧/综艺/动漫/短剧/纪录片及各地区剧集，走 Railway 中转 v2 加密接口",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://javsb-relay-production.up.railway.app/gulu",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "🆕推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎬电影", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "movie" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📺电视剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "tv" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎤综艺", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "variety" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎌动漫", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "anime" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎭短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "short" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📽️纪录片", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "doc" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇨🇳大陆剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "cn" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇭🇰港剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "hk" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇹🇼台剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "tw" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇺🇸美剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "us" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇰🇷韩剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "kr" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇯🇵日剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "jp" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇹🇭泰剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "th" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇬🇧英剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "uk" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🇷🇺俄剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "ru" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var WORKER = "https://javsb-relay-production.up.railway.app/gulu";
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
  var name = clean(it.vod_name) || "咕噜咕噜";
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
    var j = null;
    if (!cat || cat === "home") {
      j = await getJson("/home");
    } else {
      var path = "/category?id=" + encodeURIComponent(cat) + "&page=" + page;
      j = await getJson(path);
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

async function loadDetail(link) {
  try {
    var id = t(link);
    // link 可能是纯数字 id，也可能是 Relay 详情地址
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson("/detail?id=" + encodeURIComponent(id));
    if (!j || !j.list || !j.list.length) {
      return { id: id, type: "url", title: "详情获取失败", description: "Relay 无返回" };
    }
    var v = j.list[0];
    var title = clean(v.vod_name) || "咕噜咕噜";
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
    // link 编码为 线路名@@集地址，loadResource 再调 Relay /play 解出直链。
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

// 点集后：link 为 线路名@@集地址，调 Relay /play 解出直链；直链本身是 m.php，
// App 直接播。解析不到时返回空，App 会提示解析失败。
async function loadResource(params) {
  params = params || {};
  var raw = t(params.link || params.url || params.id || "");
  if (!raw && params.item) raw = t(params.item.link || params.item.id || "");
  if (!raw) return [];
  // 直链（已是 m.php/m3u8）直接播
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
  try {
    var j = await getJson("/play?id=" + encodeURIComponent(epUrl) + "&flag=" + encodeURIComponent(flag));
    var playUrl = j && j.url ? String(j.url) : "";
    if (playUrl) {
      return [{ name: "播放", url: playUrl, playerType: "app" }];
    }
  } catch (e) { /* fall through */ }
  return [];
}
