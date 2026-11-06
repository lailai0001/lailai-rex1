// 橘汁4K for REX (lai_juzi4k v1.0.0)
// 移植自 LeeCatPaw 的 lee_juzi4k（只读蓝图）：橘汁与咕噜咕噜共用 v2 加密协议
// （ECDH 换密钥 + AES-256-CBC/GCM + zlib + protobuf），REX 沙箱没有加密库，
// 加密全部放在 Railway 的 javsb-relay（/juzi 接口）上做，模块只调 Railway 的 HTTP 接口。
// v2 服务器拦 Cloudflare（403）但不拦 Railway，故接口放 Railway；接口全是文字请求，
// 不走视频流量，播放直链由 App 直接播，不动 Railway 播放额度。
// 接口地址：https://javsb-relay-production.up.railway.app/juzi。
// 分类：推荐/电影/剧集/短剧/动漫/综艺；电影/剧集/动漫/综艺有榜单筛选。
// 详情：10 条线路（咕噜4K/鲸宝4K/玫瑰4K/蚂蚁资源/旋风VIP/优酷/电影天堂/暴风资源/
//   量子资源/非凡资源），每线多集；集名带线路名前缀，点集后由 Worker /play 解出直链播放。
// 播放直链是 m.php 形态（302/伪装），App 直接播；不走 Railway、不走 hls-relay。

// v1.0.2（episodes + loadResource）：恢复集数选集；loadDetail 只返 episodes，不预解播放地址；直链集透传，需解析的集由 loadResource 调一次 /play 解出，解不出返回空数组。
WidgetMetadata = {
  id: "lai_juzi4k",
  title: "橘汁4K",
  description: "橘汁4K：电影/剧集/短剧/动漫/综艺，走 Cloudflare Worker 中转 v2 加密接口",
  author: "lai",
  version: "1.0.2",
  requiredVersion: "0.0.1",
  site: "https://javsb-relay-production.up.railway.app/juzi",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "🆕推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎬电影", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "2" }, { name: "by", title: "榜单", type: "enumeration", value: "2", enumOptions: [{ title: "全部", value: "2" }, { title: "今日热门", value: "50" }, { title: "海外上升榜", value: "79" }, { title: "豆瓣Top250", value: "65" }] }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📺剧集", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "3" }, { name: "by", title: "榜单", type: "enumeration", value: "3", enumOptions: [{ title: "全部", value: "3" }, { title: "今日热门", value: "55" }, { title: "美剧人气榜", value: "67" }, { title: "韩剧热播榜", value: "68" }, { title: "日剧热度榜", value: "69" }] }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎭短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "5" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎌动漫", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "6" }, { name: "by", title: "榜单", type: "enumeration", value: "59", enumOptions: [{ title: "今日热门", value: "59" }, { title: "日漫人气榜", value: "72" }, { title: "少儿必看榜", value: "73" }] }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎤综艺", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "7" }, { name: "by", title: "榜单", type: "enumeration", value: "57", enumOptions: [{ title: "今日热门", value: "57" }, { title: "海外综艺榜", value: "75" }] }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var WORKER = "https://javsb-relay-production.up.railway.app/juzi";
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
  var name = clean(it.vod_name) || "橘汁4K";
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
  var by = t(params.by || "");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var j = null;
    if (!cat || cat === "home") {
      j = await getJson("/home");
    } else {
      var path = "/category?id=" + encodeURIComponent(cat) + "&page=" + page;
      if (by) path += "&by=" + encodeURIComponent(by);
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

async function resolvePlay(cand) {
  try {
    var j = await getJson("/play?id=" + encodeURIComponent(cand.url) + "&flag=" + encodeURIComponent(cand.line));
    if (j && j.url) return j;
  } catch (e) { /* fall through */ }
  return null;
}

async function loadDetail(link) {
  try {
    var id = t(link);
    // link 可能是纯数字 id，也可能是 Worker 详情地址
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson("/detail?id=" + encodeURIComponent(id));
    if (!j || !j.list || !j.list.length) {
      return { id: id, type: "url", title: "详情获取失败", description: "Worker 无返回" };
    }
    var v = j.list[0];
    var title = clean(v.vod_name) || "橘汁4K";
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
    // link：视频格式直放集地址，需解析的编码为 线路名@@集地址，loadResource 调一次 /play 解。
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
        var token = lineName + "@@" + epUrl;
        // 视频格式的集地址直接放 link（loadResource 透传）；需解析的放 token，loadResource 调一次 /play 解。
        var link = isVideoFormat(epUrl) ? epUrl : token;
        episodes.push({ name: lineName + "·" + epName, id: token, link: link });
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

// 播放：episode 的 link 是直链就透传，是“线路名@@集地址”token 就调一次 /play 解出直链；
// 解不出返回空数组，不编假地址。
async function loadResource(params) {
  var raw = pickLink(params);
  if (!raw) return [];
  var name = pickName(params);
  var headers = { "User-Agent": UA, "Referer": WORKER + "/" };
  if (raw.indexOf("@@") >= 0) {
    var cut = raw.indexOf("@@");
    var line = raw.slice(0, cut);
    var addr = raw.slice(cut + 2);
    if (!addr) return [];
    if (isVideoFormat(addr)) {
      return [{ name: name || "播放", url: addr, playerType: "app", customHeaders: headers }];
    }
    var pj = await resolvePlay({ line: line, url: addr });
    if (pj && pj.url) {
      var h2 = { "User-Agent": UA, "Referer": WORKER + "/" };
      if (pj.headers) {
        for (var hk in pj.headers) { h2[hk] = pj.headers[hk]; }
      }
      return [{ name: name || "播放", url: String(pj.url), playerType: "app", customHeaders: h2 }];
    }
    return [];
  }
  if (raw.indexOf("http") === 0) {
    return [{ name: name || "播放", url: raw, playerType: "app", customHeaders: headers }];
  }
  return [];
}

function isVideoFormat(url) {
  var low = String(url || "").toLowerCase();
  return low.indexOf(".m3u8") >= 0 || low.indexOf(".mp4") >= 0 || low.indexOf("m.php") >= 0 || low.indexOf(".ts") >= 0;
}

