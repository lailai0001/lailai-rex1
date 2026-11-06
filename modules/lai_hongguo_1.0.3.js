// 红果短剧 for REX (lai_hongguo v1.0.2)
// v1.0.3（seasons + episodeItems）：loadDetail 同时返回 REX episodes 与参考文件那套 seasons/episodeItems；
//   seasons 直接用后端返回的，episodeItems 的 videoUrl 就是后端 streamUrl（完整集）；
//   type 改为 "link"（与参考文件一致）。loadResource 原样保留（透传）。
// （~/workspace/user/files/upload-3.js）重写，数据源改走 Capy Backend
// http://52share.fun:8788，后端直接给集数与每集 streamUrl。
// v1.0.1 是 xnxx 式（单 videoUrl、无集数）；本版恢复集数选集。
// 后端实测（2026-11-06 VM）：browse/search/detail 全通；详情返回
// seasons[]→episodes[]，每集有 streamUrl（http://52share.fun:8788/api/v1/stream/<token>，
// 后端代理出流，实测 HEAD content-length 8186326、video/mp4，是完整集、不是 10 秒预告）。
// loadResource 只做透传：episode 的 link 本身就是可直接播的 streamUrl，
// loadResource 不发任何请求，直接返回该地址。
// 注意：streamUrl 是 http（非 https），iOS ATS 是否拦它待真机验证；
// token 带有 exp（过期时间），详情取到后尽快点播，过期需重进详情。

WidgetMetadata = {
  id: "lai_hongguo",
  title: "红果短剧",
  description: "红果短剧：短剧/漫剧/6大榜单，走 Capy Backend，集数齐全、点集即播",
  author: "lai",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  site: "http://52share.fun:8788",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "short" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "comic" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "漫剧·新剧榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank:comic-new" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "漫剧·热播榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank:comic-hot" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "短剧·新剧榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank:short-new" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "短剧·热播榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank:short-hot" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "短剧·热搜榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank:short-hot-search" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "短剧·年度榜", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "rank:short-yearly" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BACKEND = "http://52share.fun:8788";
var UA = "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function pick() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim()) return v;
  }
  return "";
}

async function getJson(url) {
  var res = await Widget.http.get(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" }
  });
  if (!res || res.data == null) throw new Error("后端无返回");
  var j = res.data;
  if (typeof j === "string") {
    try { j = JSON.parse(j); } catch (e) { throw new Error("后端返回异常"); }
  }
  if (j && j.data !== undefined && typeof j.data === "object") j = j.data;
  return j;
}

function toCard(item) {
  if (!item || typeof item !== "object") return null;
  var id = t(pick(item.id, ""));
  if (!id) return null;
  var name = clean(pick(item.title, item.name, "未命名"));
  var pic = t(pick(item.posterUrl, item.poster, item.cover, ""));
  var remark = clean(pick(item.remark, ""));
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: BACKEND + "/api/v1/providers/hongguo/items/" + encodeURIComponent(id),
    description: remark,
    mediaType: "tv"
  };
}

function toList(rows) {
  var out = [];
  if (!rows) return out;
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
  var cat = t(params.cat || "short");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var q = "";
    if (cat.indexOf("rank:") === 0) {
      q = "/api/v1/providers/hongguo/browse?category=rank&rank=" + encodeURIComponent(cat.slice(5)) + "&page=" + page;
    } else {
      q = "/api/v1/providers/hongguo/browse?category=" + encodeURIComponent(cat) + "&page=" + page;
    }
    var j = await getJson(BACKEND + q);
    var list = toList(j.items);
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
    var j = await getJson(BACKEND + "/api/v1/providers/hongguo/search?q=" + encodeURIComponent(wd) + "&page=" + page);
    var list = toList(j.items);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function loadDetail(link) {
  try {
    var url = t(link);
    if (typeof link === "object" && link) url = t(link.link || link.detailUrl || link.url || link.id || "");
    if (!url) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    if (url.indexOf("http") !== 0) url = BACKEND + "/api/v1/providers/hongguo/items/" + encodeURIComponent(url);
    var d = await getJson(url);
    var title = clean(pick(d.title, d.name, "红果短剧"));
    var pic = t(pick(d.posterUrl, d.poster, d.cover, ""));
    var desc = clean(pick(d.description, ""));
    // seasons / episodeItems：照参考文件 upload-3.js 的做法，seasons 直接用后端返回的，
    // 每集 streamUrl 就是完整集可播地址，episodeItems 的 videoUrl 就是 streamUrl；
    // 没有 streamUrl 的集跳过，不填空地址。
    var episodeItems = [];
    var seasons = [];
    var rawSeasons = d.seasons || [];
    for (var si = 0; si < rawSeasons.length; si++) {
      var season = rawSeasons[si];
      var sn = season.seasonNumber || (si + 1);
      var sEps = [];
      var eps = season.episodes || [];
      for (var ei = 0; ei < eps.length; ei++) {
        var ep = eps[ei];
        var stream = t(pick(ep.streamUrl, ep.videoUrl, ""));
        if (!stream) continue;
        var num = ep.episodeNumber || (ei + 1);
        var epTitle = ep.title || ("第" + num + "集");
        sEps.push({ title: epTitle, videoUrl: stream, episodeNumber: num, customHeaders: ep.customHeaders || {} });
        episodeItems.push({
          id: stream,
          type: "url",
          title: epTitle,
          mediaType: d.mediaType || "tv",
          posterPath: d.posterUrl || "",
          videoUrl: stream,
          link: stream,
          episode: num,
          episodeNumber: num,
          seasonIndex: sn,
          seasonNumber: sn,
          customHeaders: ep.customHeaders || {},
          playerType: "system"
        });
      }
      if (sEps.length) {
        seasons.push({ seasonNumber: sn, title: season.title || season.name || ("第" + sn + "季"), name: season.title || season.name || ("第" + sn + "季"), episodes: sEps });
      }
    }
    var total = parseInt(d.episodeCount, 10) || episodeItems.length;
    var descText = "共" + total + "集";
    if (desc) descText += "\n" + desc;
    // REX 兼容：episodes 保留 1.0.2 的形状（与 episodeItems 一一对应）。
    var episodes = [];
    for (var i = 0; i < episodeItems.length; i++) {
      episodes.push({ name: episodeItems[i].title, id: episodeItems[i].videoUrl, link: episodeItems[i].videoUrl });
    }
    return {
      id: String(d.id || ""),
      type: "link",
      title: title,
      name: title,
      link: url,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descText,
      mediaType: d.mediaType || "tv",
      episodes: episodes,
      seasons: seasons,
      episodeItems: episodeItems
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

// 播放：episode 的 link 本身就是后端给的、可直接播的 streamUrl，
// 这里只做透传，不发任何请求。
async function loadResource(params) {
  var url = "";
  var name = "";
  if (params) {
    if (typeof params === "string") url = params;
    else {
      url = t(pick(params.link, params.url, params.videoUrl, params.streamUrl, ""));
      if (!url && typeof params.id === "string" && params.id.indexOf("http") === 0) url = params.id;
      name = t(pick(params.name, params.title, ""));
    }
  }
  if (!url) return [];
  return [{ name: name || "播放", url: url, playerType: "app", customHeaders: { "User-Agent": UA, "Referer": BACKEND + "/" } }];
}
