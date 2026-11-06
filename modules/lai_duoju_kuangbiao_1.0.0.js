// 多聚短剧 · 狂飙 for REX (lai_duoju_kuangbiao v1.0.0)
// 移植自 LeeCatPaw 的 lee_duoju_kuangbiao（只读蓝图）：纯 HTTPS tRPC GET JSON，无签名无加密。
// 列表走 feed.browse（cursor 翻页，REX 内按页号顺序取 cursor）；
// 详情走 episode.watch 只取免费分集（locked/付费集不列出）；
// 播放地址为拼接的 raw.shorttv.online 直链 mp4（站方规则）。

WidgetMetadata = {
  id: "lai_duoju_kuangbiao",
  title: "多聚短剧 · 狂飙",
  description: "多聚短剧 · 狂飙：短剧/正规短剧/成人短剧，纯 tRPC 接口",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://ai.dramarush.tv",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "t-5jxcit" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "正规短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "normal_short" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "成人短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "adult_short" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://ai.dramarush.tv";
var UA = "Mozilla/5.0 (Linux; Android 12; Mobile)";
var CATS = [
  ["t-5jxcit", "短剧"],
  ["normal_short", "正规短剧"],
  ["adult_short", "成人短剧"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function parseRes(res) {
  if (!res || res.data == null) return null;
  if (typeof res.data === "object") return res.data;
  var s = String(res.data).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function trpc(name, data) {
  var url = BASE + "/api/trpc/" + name + "?input=" + encodeURIComponent(JSON.stringify({ json: data }));
  var res = await Widget.http.get(url, { headers: { "User-Agent": UA, "Referer": BASE + "/zh/", "Accept": "application/json, text/plain, */*" } });
  var j = await parseRes(res);
  if (!j) throw new Error("狂飙接口无返回");
  return (j.result && j.result.data && j.result.data.json) || {};
}

function catName(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i][1];
  }
  return CATS[0][1];
}

function specOf(cat) {
  if (cat === "normal_short") return { contentKind: "SHORT_DRAMA" };
  if (cat === "adult_short") return { tagSlug: "adult" };
  return { categorySlug: "t-5jxcit" };
}

function toCard(item, cat) {
  var d = (item && item.drama) || item || {};
  var id = String(d.id || "");
  var title = String(d.title || "").trim();
  if (!id || !title) return null;
  var pic = String(d.cover || d.poster || "").replace("cdn.shorttv.online/lsj/", "raw.shorttv.online/lsj/");
  return {
    id: id,
    type: "url",
    title: title,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: d.totalEpisodes ? (d.totalEpisodes + "集") : "",
    mediaType: "movie"
  };
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page) {
  var cursor = "";
  var data = {};
  var spec = specOf(cat);
  for (var i = 1; i <= page; i++) {
    var req = { limit: 12 };
    for (var k in spec) req[k] = spec[k];
    if (cursor) req.cursor = cursor;
    data = await trpc("feed.browse", req);
    cursor = String(data.nextCursor || "");
    if (!cursor && i < page) return [];
  }
  var out = [];
  var items = data.items || [];
  for (var j = 0; j < items.length; j++) {
    var c = toCard(items[j], cat);
    if (c) out.push(c);
  }
  return out;
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "t-5jxcit");
  var page = Math.min(6, Math.max(1, parseInt(params.page, 10) || 1));
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
  var page = Math.min(6, Math.max(1, parseInt(params.page, 10) || 1));
  try {
    var rows = await listing("t-5jxcit", page);
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].title.indexOf(wd) >= 0) out.push(rows[i]);
    }
    return out.length ? out : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

function freeEpisodes(body) {
  var out = [];
  var rows = body.episodes || [];
  for (var i = 0; i < rows.length; i++) {
    var ep = rows[i];
    if (ep && Number(ep.index) > 0 && ep.id && !ep.locked && !ep.unavailable && (ep.isFree || ep.accessState === "FREE")) {
      out.push(ep);
    }
  }
  return out;
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!/^[a-z0-9-]{8,80}$/i.test(id)) return { id: "err", type: "url", title: "解析失败", description: "狂飙剧集 ID 无效" };
    var body = await trpc("episode.watch", { dramaId: id, episodeNumber: 1 });
    var d = body.drama || {};
    var eps = freeEpisodes(body);
    if (!eps.length) return { id: id, type: "url", title: "无可播分集", description: "仅免费分集可播，本剧无免费集" };
    var total = Math.min(80, Math.max(Number(d.totalEpisodes) || 0, eps.length));
    var episodes = [];
    for (var i = 0; i < eps.length; i++) {
      if (Number(eps[i].index) > 80) continue;
      episodes.push({ name: "第" + eps[i].index + "集", id: "kuangbiao://" + id + "/" + eps[i].index, link: "kuangbiao://" + id + "/" + eps[i].index });
    }
    var pic = d.cover || d.poster || "";
    return {
      id: id,
      type: "detail",
      title: d.title || id,
      name: d.title || id,
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: clean(d.description) + "\n可播" + eps.length + "集/共" + total + "集",
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
  var m = /^kuangbiao:\/\/([a-z0-9-]{8,80})\/(\d+)$/i.exec(raw);
  if (!m) return [];
  try {
    var no = Number(m[2]);
    var body = await trpc("episode.watch", { dramaId: m[1], episodeNumber: no });
    var eps = freeEpisodes(body);
    var epId = "";
    for (var i = 0; i < eps.length; i++) {
      if (Number(eps[i].index) === no && eps[i].id) { epId = eps[i].id; break; }
    }
    if (!epId) return [];
    var url = "https://raw.shorttv.online/uploads/direct/" + epId + "/video.mp4";
    return [{ name: "播放", url: url, playerType: "app" }];
  } catch (e) { return []; }
}
