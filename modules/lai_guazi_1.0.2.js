// 瓜子影视 for REX (lai_guazi v1.0.0)
// 按瓜子站本身重写（gz360.tv + haiwaiapi.1fc8ab0.com/H5）：全部接口只接受
// POST，body 只有 params=<hex>（AES-128-CBC 加密 JSON，key='181cc88340ae5b2b'、
// iv='4423d1e2773476ce'），响应 data 同样 AES hex 加密。REX 沙箱无 AES，
// 加解密放在 Railway 的 javsb-relay（/gz/call 通用透传，ct=json 发 JSON 体）
// 上做，模块只调 Railway 的 HTTP 接口。接口全是文字请求，播放直链（m3u8，
// 无 EXT-X-KEY、分片实拉 200）由 App 直接播，不走 Railway、不走 hls-relay。
// 分类（9 个真实视频分类，按 ModuleInfo 的 parent_id=pid）：热门 1、动漫 5、
// 漫剧 62344、电影 3、国产剧 4、短剧 16、综艺 6、海外剧 23656、儿童 26916。
// 注意：子分类 id（如动漫下的 冒险 50）不能当 parent_id 用（回空）；
// 搜索接口 /Search/GetList 在 /H5 下报“不存在的路由”、/Pc 下挂起超时，
// 故本模块不含搜索；上游偶发 HTTP 500，relay 侧已加一次重试。

// v1.0.2（episodes + loadResource）：恢复集数选集；loadDetail 只返 episodes（每集 link 即直链 m3u8），loadResource 只做透传。
WidgetMetadata = {
  id: "lai_guazi",
  title: "瓜子影视",
  description: "瓜子影视：热门/动漫/漫剧/电影/国产剧/短剧/综艺/海外剧/儿童，走 Railway 中转 AES 加解密接口",
  author: "lai",
  version: "1.0.2",
  requiredVersion: "0.0.1",
  site: "https://javsb-relay-production.up.railway.app/gz/call",
  detailCacheDuration: 180,
  modules: [
    { title: "🆕推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🔥热门", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎬电影", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "3" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📺国产剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "4" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎌动漫", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "5" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎭短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "16" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🎤综艺", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "6" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🌏海外剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "23656" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "🧒儿童", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "26916" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "📖漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "62344" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var WORKER = "https://javsb-relay-production.up.railway.app/gz/call";
var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function toJson(x) {
  if (x == null) return null;
  if (typeof x === "object") return x;
  var s = String(x).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function callApi(path, payload) {
  var url = WORKER + "?path=" + encodeURIComponent(path) + "&payload=" + encodeURIComponent(JSON.stringify(payload)) + "&ct=json";
  try {
    var res = await Widget.http.get(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" }
    });
    return toJson(res && res.data);
  } catch (e) { return null; }
}

function toCard(it) {
  var id = t(it.vod_id);
  if (!id) return null;
  var pic = t(it.c_pic || it.vod_pic || it.pic);
  var name = clean(it.c_name || it.vod_name) || "瓜子影视";
  var remarks = clean(it.vod_continu || it.vod_remarks);
  var score = t(it.vod_douban_score || it.vod_scroe);
  if (score) remarks = (remarks ? remarks + " · " : "") + "评分 " + score;
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

function sectionsToList(j) {
  var out = [];
  if (!j || !j.data || !j.data.list) return out;
  var seen = {};
  for (var si = 0; si < j.data.list.length; si++) {
    var sec = j.data.list[si] || {};
    var items = sec.list || [];
    for (var i = 0; i < items.length; i++) {
      var c = toCard(items[i]);
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
  var cat = t(params.cat || "");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var j = null;
    if (!cat || cat === "home") {
      j = await callApi("/Resource/IndexShow/ShowOnes", { parent_id: 1, page: page, pageSize: 2, phone_type: 4 });
    } else {
      j = await callApi("/Resource/ModuleInfo/ShowOnes", { parent_id: Number(cat), page: page, pageSize: 2, phone_type: 4 });
    }
    var list = sectionsToList(j);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "载入失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function loadDetail(link) {
  try {
    var id = t(link);
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var info = await callApi("/Resource/GetVodInfo", { vod_id: Number(id), phone_type: 4 });
    var v = info && info.data && info.data.vodInfo ? info.data.vodInfo : null;
    if (!v) return { id: id, type: "url", title: "详情获取失败", description: "Relay 无返回" };
    var title = clean(v.vod_name) || "瓜子影视";
    var pic = t(v.pic);
    var descParts = [];
    if (v.vod_continu) descParts.push(clean(v.vod_continu));
    if (v.vod_area) descParts.push("地区：" + clean(v.vod_area));
    if (v.vod_year) descParts.push("年份：" + clean(v.vod_year));
    if (v.vod_director) descParts.push("导演：" + clean(v.vod_director));
    if (v.vod_actor) descParts.push("演员：" + clean(v.vod_actor));
    if (v.vod_use_content) descParts.push(clean(v.vod_use_content));
    // 分集：GetOnePlayList 的 urls[]，每集直链 m3u8，集名带清晰度；
    // v1.0.2：loadDetail 只返 episodes，不预解播放地址；每集 link 就是直链，loadResource 只做透传。
    // 播放列表为空时用详情默认 play_url 兜底。
    var episodes = [];
    var pl = await callApi("/Resource/GetOnePlayList", { vod_id: Number(id), phone_type: 4 });
    var urls = pl && pl.data && pl.data.urls ? pl.data.urls : [];
    for (var i = 0; i < urls.length; i++) {
      var u = urls[i] || {};
      var url = t(u.url);
      if (!url) continue;
      var epName = clean(u.name) || ("第" + (i + 1) + "集");
      if (u.resolution) epName += " · " + t(u.resolution) + "p";
      episodes.push({ name: epName, id: url, link: url });
    }
    if (!episodes.length && v.play_url) {
      var dn = clean(v.default_play_name) || "播放";
      episodes.push({ name: dn, id: t(v.play_url), link: t(v.play_url) });
    }
    var desc = descParts.join("\n");
    if (episodes.length) {
      desc += "\n共" + episodes.length + "集 · 1条线路";
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

// 播放：episode 的 link 本身就是直链 m3u8，这里只做透传，不发任何请求。
async function loadResource(params) {
  var url = pickLink(params);
  if (!url) return [];
  var name = pickName(params);
  return [{ name: name || "播放", url: url, playerType: "app", customHeaders: { "User-Agent": UA, "Referer": WORKER + "/" } }];
}

function isVideoFormat(url) {
  var low = String(url || "").toLowerCase();
  return low.indexOf(".m3u8") >= 0 || low.indexOf(".mp4") >= 0 || low.indexOf(".ts") >= 0;
}

