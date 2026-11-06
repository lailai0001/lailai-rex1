// 多聚短剧 · 搜剧AI for REX (lai_duoju_souju v1.0.3)
// v1.0.3（seasons/episodeItems）：loadDetail 预解析每集直链，同时返回 REX episodes 与参考文件那套 seasons/episodeItems；loadResource 原样保留；取数逻辑与 1.0.2 一致。
// v1.0.2（episodes + loadResource）：从 1.0.0 的 episodes 写法恢复集数选集（1.0.1 为 xnxx 式单 videoUrl、无集数）；loadDetail 只返回全部 episodes 不再预解析，点集时 loadResource 单次解析；分类/搜索/参数与 1.0.1 完全一致。
// 本源补充：episode link 带 token（souju://vid/n/token），loadResource 直解、不重取分集列表；无 token 的旧 link 仍走重取兜底。
// 移植自 LeeCatPaw 的 lee_duoju_souju（只读蓝图）：HMAC-SHA256 签名，
// sig = HMAC-SHA256(key, METHOD + "\n" + path + "\n" + 时间戳毫秒 + "\n" + 随机 nonce),
// 纯 JS 实现 SHA256 + HMAC（REX 无 crypto、无 Buffer、无 TextEncoder），
// 已在 VM 侧对照 node crypto 校验；key 为站方固定值（与猫源一致）。
// 播放需逐线路校验媒体头（#EXTM3U/ftyp/TS 同步字节），只返回校验通过的直链。

WidgetMetadata = {
  id: "lai_duoju_souju",
  title: "多聚短剧 · 搜剧AI",
  description: "多聚短剧 · 搜剧AI：脑洞悬疑/古装仙侠/现代都市等短剧，HMAC-SHA256 签名接口",
  author: "lai",
  version: "1.0.3",
  requiredVersion: "0.0.1",
  site: "https://souju.ai",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "脑洞悬疑", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "脑洞悬疑" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "古装仙侠", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "古装仙侠" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "现代都市", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "现代都市" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "女频恋爱", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "女频恋爱" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "言情总裁", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "言情总裁" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "年代穿越", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "年代穿越" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "现代言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "现代言情" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "反转爽剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "反转爽剧" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "重生民国", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "重生民国" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://souju.ai";
var KEY = "f39d73aa7a6426203cdee1ef17b31d3b7ea8c23f4c59c62a3a8aa0f39ee5e79d";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// 纯 JS SHA-256（FIPS 180-4）+ HMAC-SHA256；已在 VM 侧对照 node crypto 校验。
var SHA256_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

function utf8Bytes(str) {
  var s = unescape(encodeURIComponent(str));
  var out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255);
  return out;
}

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(bytes) {
  var bitLen = bytes.length * 8;
  var data = bytes.slice();
  data.push(128);
  while (data.length % 64 !== 56) data.push(0);
  for (var i = 7; i >= 0; i--) data.push(Math.floor(bitLen / Math.pow(2, i * 8)) % 256);
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (var off = 0; off < data.length; off += 64) {
    var w = [];
    for (var ti = 0; ti < 16; ti++) {
      w.push((data[off + ti * 4] << 24) | (data[off + ti * 4 + 1] << 16) | (data[off + ti * 4 + 2] << 8) | data[off + ti * 4 + 3]);
    }
    for (var tj = 16; tj < 64; tj++) {
      var s0 = rotr(w[tj - 15], 7) ^ rotr(w[tj - 15], 18) ^ (w[tj - 15] >>> 3);
      var s1 = rotr(w[tj - 2], 17) ^ rotr(w[tj - 2], 19) ^ (w[tj - 2] >>> 10);
      w.push((w[tj - 16] + s0 + w[tj - 7] + s1) | 0);
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (var ri = 0; ri < 64; ri++) {
      var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var t1 = (hh + S1 + ch + SHA256_K[ri] + w[ri]) | 0;
      var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  var out = [];
  for (var hi = 0; hi < 8; hi++) {
    out.push((h[hi] >>> 24) & 255, (h[hi] >>> 16) & 255, (h[hi] >>> 8) & 255, h[hi] & 255);
  }
  return out;
}

function bytesToHex(bytes) {
  var hex = "0123456789abcdef";
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    out += hex.charAt((bytes[i] >>> 4) & 15) + hex.charAt(bytes[i] & 15);
  }
  return out;
}

function sha256Hex(str) {
  return bytesToHex(sha256Bytes(utf8Bytes(str)));
}

function hmacSha256Hex(key, msg) {
  var kb = utf8Bytes(key);
  if (kb.length > 64) kb = sha256Bytes(kb);
  while (kb.length < 64) kb.push(0);
  var ipad = [], opad = [];
  for (var i = 0; i < 64; i++) {
    ipad.push(kb[i] ^ 54);
    opad.push(kb[i] ^ 92);
  }
  var inner = sha256Bytes(ipad.concat(utf8Bytes(msg)));
  return bytesToHex(sha256Bytes(opad.concat(inner)));
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

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function signHeaders(method, path) {
  var ts = String(Date.now());
  var nonce = randomHex(16);
  var sig = hmacSha256Hex(KEY, method + "\n" + path + "\n" + ts + "\n" + nonce);
  return {
    "User-Agent": UA,
    "Accept": "application/json",
    "x-ai-movie-client-name": "movie-search-frontend",
    "x-ai-movie-client-version": "1.0.0",
    "x-ai-movie-build-version": "aimovie-v2026.09.28.4-f41bc3c82d76-web",
    "x-ai-movie-protocol-version": "2026-07-05.library-v2.playback-v1",
    "x-ai-movie-timestamp": ts,
    "x-ai-movie-nonce": nonce,
    "x-ai-movie-signature": sig
  };
}

async function parseRes(res) {
  if (!res || res.data == null) return null;
  if (typeof res.data === "object") return res.data;
  var s = String(res.data).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function api(path, body) {
  var method = body ? "POST" : "GET";
  var headers = signHeaders(method, path);
  var res;
  if (body) {
    headers["Content-Type"] = "application/json";
    res = await Widget.http.post(BASE + path, JSON.stringify(body), { headers: headers });
  } else {
    res = await Widget.http.get(BASE + path, { headers: headers });
  }
  return parseRes(res);
}

function absUrl(v) {
  if (!v) return "";
  if (v.indexOf("/") === 0) return BASE + v;
  return v;
}

function toCard(r) {
  if (!r || !r.id || !r.title) return null;
  if (r.availability && r.availability.disabled) return null;
  var remarks = [];
  if (r.year) remarks.push(r.year);
  if (r.remarks) remarks.push(r.remarks);
  return {
    id: String(r.id),
    type: "url",
    title: String(r.title),
    posterPath: absUrl(r.poster_url),
    coverUrl: absUrl(r.poster_url),
    backdropPath: absUrl(r.poster_url),
    link: String(r.id),
    description: remarks.join(" · "),
    mediaType: "movie"
  };
}

function toList(j) {
  var out = [];
  var rows = (j && j.cards) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i]);
    if (c) out.push(c);
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function browse(cat, wd, page) {
  if (page > 20) return [];
  var query = "kind=short_drama&intent=" + (wd ? "catalog_search" : "latest_catalog");
  if (wd) query += "&query=" + encodeURIComponent(wd);
  else if (cat && cat !== "all") query += "&genre=" + encodeURIComponent(cat);
  query += "&page=" + page + "&limit=24";
  return toList(await api("/v1/browse/catalog?" + query, null));
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "all");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await browse(cat, "", page);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var list = await browse("", wd, page);
  return list.length ? list : emptyItem();
}

async function episodesOf(vid) {
  var all = [];
  for (var offset = 0; offset < 2000; offset += 100) {
    var data = await api("/v1/catalog/" + encodeURIComponent(vid) + "/episodes?limit=100&offset=" + offset + "&order=asc", null);
    if (!data) break;
    var eps = data.episodes || [];
    for (var i = 0; i < eps.length; i++) {
      if (eps[i].token) all.push(eps[i]);
    }
    var hasMore = (data.episode_pagination && data.episode_pagination.has_more) || (data.pagination && data.pagination.has_more);
    if (!hasMore) break;
  }
  all.sort(function (a, b) {
    return (Number(a.number || a.key || 0) - Number(b.number || b.key || 0));
  });
  return all;
}

// v1.0.3：把 loadResource 的单集解析抽成内部函数，供 loadDetail 预解析与 loadResource 共用。
async function resolveSoujuToken(token) {
  try {
    var resolved = await api("/v1/playback/resolve/" + encodeURIComponent(token), null);
    var lines = (resolved && resolved.line_options) || [];
    lines = lines.filter(function (l) { return l.url; });
    lines.sort(function (a, b) {
      var sa = (b.url_kind === "mp4") ? 1 : 0;
      var sb = (a.url_kind === "mp4") ? 1 : 0;
      return sa - sb;
    });
    for (var i = 0; i < lines.length; i++) {
      var url = lines[i].url;
      if (url.indexOf("resolve://") === 0) {
        var data = await api("/v1/playback/resolve-line?view=compact", { ticket: url.slice(10), selection: { playback_source_id: lines[i].playback_source_id || "", provider_id: lines[i].provider_id || "" } });
        url = (data && data.line && data.line.url) || "";
      }
      if (/^https?:\/\//.test(url) && (await mediaWorks(url))) return url;
    }
  } catch (e) { /* fall through */ }
  return "";
}


// v1.0.3：按参考文件（upload-3.js）格式组装 seasons/episodeItems。
// list: [{name, n, videoUrl}]，只收已解出直链的集；解不出的集不出现在这里。
function buildSeasonItems(list, pic) {
  var seasonEps = [];
  var episodeItems = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it.videoUrl) continue;
    seasonEps.push({ videoUrl: it.videoUrl, title: it.name, episodeNumber: it.n, customHeaders: {} });
    episodeItems.push({ id: it.videoUrl, type: "url", title: it.name, mediaType: "tv", posterPath: pic || "", videoUrl: it.videoUrl, link: it.videoUrl, episode: it.n, episodeNumber: it.n, seasonIndex: 1, seasonNumber: 1, customHeaders: {}, playerType: "system" });
  }
  return { seasons: [{ seasonNumber: 1, episodes: seasonEps }], episodeItems: episodeItems };
}

async function loadDetail(link) {
  try {
    var vid = t(link);
    if (!vid) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var data = await api("/v1/catalog/" + encodeURIComponent(vid) + "?episodes=window&episode_limit=1", null);
    var eps = await episodesOf(vid);
    if (!eps.length) return { id: vid, type: "url", title: "无可播分集", description: "详情无分集" };
    var episodes = [];
    for (var i = 0; i < eps.length; i++) {
      var name = String(eps[i].title || ("第" + (eps[i].number || (i + 1)) + "集")).replace(/[$#]/g, "_");
      var tok = String(eps[i].token || "");
      var epLink = "souju://" + vid + "/" + (i + 1);
      // token 直接写进 link（站方 token 全是 [A-Za-z0-9_-]，VM 抽查 115 个全合规），
      // loadResource 用它直解播放，省掉重取分集列表那一步：站方 episodes 接口间歇报
      // "Invalid public variant id"，重取撞上坏窗口会把整部剧判空（1.0.1 注释已记）。
      if (/^[A-Za-z0-9_-]+$/.test(tok)) epLink += "/" + tok;
      episodes.push({ name: name, id: epLink, link: epLink });
    }
    var pic = absUrl(data ? data.poster_url : "");
    // v1.0.3：逐集用 link 里已嵌的 token 预解析直链，补 seasons/episodeItems
    // （App 渲染集数网格用；与 loadResource 同一套 resolve + 媒体校验逻辑）。
    // 无 token 的集跳过预解析，仍保留在 episodes 里，点集时 loadResource 走重取兜底。
    var resolved = [];
    for (var ri = 0; ri < episodes.length; ri++) {
      var parts = episodes[ri].link.split("/");
      var rtoken = parts[4] || "";
      if (!rtoken) continue;
      var rurl = await resolveSoujuToken(rtoken);
      if (rurl) resolved.push({ name: episodes[ri].name, n: ri + 1, videoUrl: rurl });
    }
    var built = buildSeasonItems(resolved, pic);
    return {
      id: vid,
      type: "detail",
      title: (data && (data.title || vid)) || vid,
      name: (data && (data.title || vid)) || vid,
      link: vid,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: (data ? clean(data.overview || data.description) : "") + "\n共" + episodes.length + "集",
      playerType: "app",
      episodes: episodes,
      seasons: built.seasons,
      episodeItems: built.episodeItems
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

async function mediaWorks(url) {
  // 注意：部分 CDN 对 .m3u8 的 Range 请求返回 zstd 压缩体（首字节 28 B5 2F FD），
  // REX 内无法解压，Range 探针会误判；故 .m3u8 直接 GET 全文校验（清单仅几 KB），
  // 其余（mp4 等二进制）仍用 Range 探针校验 ftyp/TS 同步字节。
  try {
    var isList = url.indexOf(".m3u8") >= 0;
    var headers = { "User-Agent": UA, "Referer": BASE + "/" };
    if (!isList) headers["Range"] = "bytes=0-63";
    var res = await Widget.http.get(url, { headers: headers });
    if (!res || res.data == null) return false;
    var s = String(res.data);
    if (s.indexOf("#EXTM3U") === 0) return true;
    if (s.indexOf("ftyp") >= 0) return true;
    if (s.length > 0 && s.charCodeAt(0) === 71) return true;
    return false;
  } catch (e) { return false; }
}

async function loadResource(params) {
  params = params || {};
  var raw = t(params.link || params.url || params.id || "");
  if (!raw && params.item) raw = t(params.item.link || params.item.id || "");
  if (raw.indexOf("http") === 0) {
    return [{ name: "播放", url: raw, playerType: "app" }];
  }
  var m = /^souju:\/\/([^/]+)\/(\d+)(?:\/([A-Za-z0-9_-]+))?$/.exec(raw);
  if (!m) return [];
  var token = m[3] || "";
  if (!token) {
    var eps = await episodesOf(m[1]);
    var ep = eps[Number(m[2]) - 1];
    if (!ep || !ep.token) return [];
    token = ep.token;
  }
  var url = await resolveSoujuToken(token);
  if (url) {
    return [{ name: "播放", url: url, playerType: "app" }];
  }
  return [];
}
