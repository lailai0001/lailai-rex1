// 多聚短剧 · 一直看 for REX (lai_duoju_yizk v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_yizk（只读蓝图）：纯 HTTPS JSON，无签名无加密。
// 主入口 1zk.top，失败切 1zk.me（猫源另有路由刷新，REX 内只做双域名重试）。
// 分类 token 取自 2026-11-06 实测 /api/v1/categories（猫源写死的旧 token 已失效，
// 站方会轮换 token，失效时需重新拉取该接口更新）。

WidgetMetadata = {
  id: "lai_duoju_yizk",
  title: "多聚短剧 · 一直看",
  description: "多聚短剧 · 一直看：华语/东瀛/欧美/三级/Ai短剧，纯 HTTPS 接口",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://1zk.top",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "华语", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "4geqxlxdd79d" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "东瀛", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "tmgzbyvh7sis" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "欧美", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1mhad2wz2ygk" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "三级", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "0c0u65imxo1a" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "Ai短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "fs7hmy32jqfm" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var HOSTS = ["https://1zk.top", "https://1zk.me"];
var UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
var CURRENT = HOSTS[0];

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

async function api(path, body) {
  var lastErr = null;
  for (var hi = 0; hi < HOSTS.length; hi++) {
    var host = HOSTS[hi];
    try {
      var headers = { "User-Agent": UA, "Accept": "application/json", "Referer": host + "/" };
      var res;
      if (body) {
        headers["Content-Type"] = "application/json";
        res = await Widget.http.post(host + path, JSON.stringify(body), { headers: headers });
      } else {
        res = await Widget.http.get(host + path, { headers: headers });
      }
      var j = await parseRes(res);
      if (!j || j.code !== 0) throw new Error("一直看错误 " + (j && j.code));
      CURRENT = host;
      return j.data;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("一直看所有入口不可用");
}

function toCard(r) {
  if (!r || !r.token || !r.title) return null;
  var pic = r.cover_url || "";
  return {
    id: String(r.token),
    type: "url",
    title: String(r.title),
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: String(r.token),
    description: Number(r.episode_count) > 1 ? ("共" + r.episode_count + "集") : "",
    mediaType: "movie"
  };
}

function toList(data) {
  var out = [];
  var rows = (data && data.list) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function listing(cat, page, wd) {
  if (page > 100) return [];
  var path;
  if (wd) path = "/api/v1/films?keyword=" + encodeURIComponent(wd) + "&page=" + page + "&pageSize=24";
  else if (cat && cat !== "all") path = "/api/v1/categories/" + encodeURIComponent(cat) + "/films?page=" + page + "&pageSize=24";
  else path = "/api/v1/films?page=" + page + "&pageSize=24";
  return toList(await api(path, null));
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "all");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var list = await listing(cat, page, "");
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
    var list = await listing("", page, wd);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var row = await api("/api/v1/films/" + encodeURIComponent(id), null);
    var count = Math.min(1000, Math.max(1, Number(row.episode_count) || 1));
    var episodes = [];
    for (var i = 0; i < count; i++) {
      episodes.push({ name: "第" + (i + 1) + "集", id: "yizk://" + id + "/" + (i + 1), link: "yizk://" + id + "/" + (i + 1) });
    }
    var pic = row.cover_url || "";
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < episodes.length; pi++) {
      var playCand = await resolvePlayUrl(episodes[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = clean(row.description) + "\n共" + count + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: row.token || id,
      type: "detail",
      title: row.title || id,
      name: row.title || id,
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descText,
      playerType: "app",
      customHeaders: {"User-Agent": UA, "Referer": CURRENT + "/"},
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
  var m = /^yizk:\/\/([^/]+)\/(\d+)$/.exec(raw);
  if (!m) return "";
  try {
    var data = await api("/api/v1/films/" + encodeURIComponent(m[1]) + "/play", { episode: Number(m[2]), source: "direct" });
    var url = (data && data.playUrl) || "";
    // 站方 playUrl 是相对地址（/api/v1/trial/playlist.m3u8?...，90 秒试看），
    // 1.0.0 只认绝对地址会直接丢掉；拼上当前可用入口域名再返回。
    if (url.indexOf("/") === 0) url = CURRENT + url;
    if (/^https?:\/\//.test(url)) {
      return url;
    }
  } catch (e) { /* fall through */ }
  return "";
}
