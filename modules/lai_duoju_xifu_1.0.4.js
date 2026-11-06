// 多聚短剧 · 喜福 for REX (lai_duoju_xifu v1.0.3)
// v1.0.3（seasons/episodeItems）：loadDetail 预解析每集直链，同时返回 REX episodes 与参考文件那套 seasons/episodeItems；loadResource 原样保留；取数逻辑与 1.0.2 一致。
// v1.0.2（episodes + loadResource）：从 1.0.0 的 episodes 写法恢复集数选集（1.0.1 为 xnxx 式单 videoUrl、无集数）；loadDetail 只返回全部 episodes 不再预解析，点集时 loadResource 单次解析；分类/搜索/参数与 1.0.1 完全一致。
// 移植自 LeeCatPaw 的 lee_duoju_xifu（只读蓝图）：列表/详情为纯 HTTPS GET JSON；
// 播放走阿里云 VOD：先取 play_auth（vid + playAuth），再按阿里云签名规范算 HMAC-SHA1
// 签名取 PlayInfo。SHA1/HMAC-SHA1/base64 编解码均为纯 JS 实现
// （REX 无 crypto、无 Buffer），已在 VM 侧对照 node crypto 校验。

// v1.0.4（批量解析）：loadDetail 逐集解析改为一次 POST /dj/<源>/batch（见下方 batchResolveLinks）；
//   失败集保留在 episodes[]、不进 seasons/episodeItems；loadResource 与站方解析函数原样保留。
WidgetMetadata = {
  id: "lai_duoju_xifu",
  title: "多聚短剧 · 喜福",
  description: "多聚短剧 · 喜福：爽剧/甜宠/逆袭/言情等短剧，阿里云 VOD 签名播放",
  author: "lai",
  version: "1.0.4",
  requiredVersion: "0.0.1",
  site: "https://minidrama-api.contentchina.com",
  detailCacheDuration: 180,
  modules: [
    { title: "爽剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "3" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "甜宠", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "6" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "逆袭", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "5" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "现代言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "1" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "都市", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "4" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "玄幻", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "23" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "古代言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "16" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var HOST = "https://minidrama-api.contentchina.com";
var ORIGIN = "https://minidrama.contentchina.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
var CATS = [
  ["3", "爽剧"], ["6", "甜宠"], ["5", "逆袭"], ["1", "现代言情"],
  ["4", "都市"], ["23", "玄幻"], ["16", "古代言情"]
];

// 纯 JS SHA-1（FIPS 180-1）+ HMAC-SHA1 + base64 编解码；已在 VM 侧对照 node crypto 校验。
function utf8Bytes(str) {
  var s = unescape(encodeURIComponent(str));
  var out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255);
  return out;
}

function utf8Decode(bytes) {
  var out = "";
  var i = 0;
  while (i < bytes.length) {
    var c = bytes[i];
    if (c < 128) { out += String.fromCharCode(c); i++; }
    else if (c >= 192 && c < 224 && i + 1 < bytes.length) {
      out += String.fromCharCode(((c & 31) << 6) | (bytes[i + 1] & 63)); i += 2;
    } else if (c >= 224 && c < 240 && i + 2 < bytes.length) {
      out += String.fromCharCode(((c & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3;
    } else if (c >= 240 && i + 3 < bytes.length) {
      var cp = ((c & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
      cp -= 65536;
      out += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023)); i += 4;
    } else { i++; }
  }
  return out;
}

function rol32(n, c) {
  return (n << c) | (n >>> (32 - c));
}

function sha1Bytes(bytes) {
  var bitLen = bytes.length * 8;
  var data = bytes.slice();
  data.push(128);
  while (data.length % 64 !== 56) data.push(0);
  for (var i = 7; i >= 0; i--) data.push(Math.floor(bitLen / Math.pow(2, i * 8)) % 256);
  var h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  for (var off = 0; off < data.length; off += 64) {
    var w = [];
    for (var ti = 0; ti < 16; ti++) {
      w.push((data[off + ti * 4] << 24) | (data[off + ti * 4 + 1] << 16) | (data[off + ti * 4 + 2] << 8) | data[off + ti * 4 + 3]);
    }
    for (var tj = 16; tj < 80; tj++) {
      w.push(rol32(w[tj - 3] ^ w[tj - 8] ^ w[tj - 14] ^ w[tj - 16], 1));
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (var ri = 0; ri < 80; ri++) {
      var f, k;
      if (ri < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
      else if (ri < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (ri < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      var tmp = (rol32(a, 5) + f + e + k + w[ri]) | 0;
      e = d; d = c; c = rol32(b, 30); b = a; a = tmp;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
  }
  var out = [];
  for (var hi = 0; hi < 5; hi++) {
    out.push((h[hi] >>> 24) & 255, (h[hi] >>> 16) & 255, (h[hi] >>> 8) & 255, h[hi] & 255);
  }
  return out;
}

var B64ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = (i + 1 < bytes.length) ? bytes[i + 1] : 0, b2 = (i + 2 < bytes.length) ? bytes[i + 2] : 0;
    out += B64ALPHA.charAt(b0 >>> 2);
    out += B64ALPHA.charAt(((b0 & 3) << 4) | (b1 >>> 4));
    out += (i + 1 < bytes.length) ? B64ALPHA.charAt(((b1 & 15) << 2) | (b2 >>> 6)) : "=";
    out += (i + 2 < bytes.length) ? B64ALPHA.charAt(b2 & 63) : "=";
  }
  return out;
}

function base64ToBytes(str) {
  var clean = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
  var out = [];
  for (var i = 0; i < clean.length; i += 4) {
    var v0 = B64ALPHA.indexOf(clean.charAt(i));
    var v1 = B64ALPHA.indexOf(clean.charAt(i + 1));
    var c2 = clean.charAt(i + 2), c3 = clean.charAt(i + 3);
    var v2 = c2 === "=" ? 0 : B64ALPHA.indexOf(c2);
    var v3 = c3 === "=" ? 0 : B64ALPHA.indexOf(c3);
    out.push((v0 << 2) | (v1 >>> 4));
    if (c2 !== "=") out.push(((v1 & 15) << 4) | (v2 >>> 2));
    if (c3 !== "=") out.push(((v2 & 3) << 6) | v3);
  }
  return out;
}

function hmacSha1Base64(key, msg) {
  var kb = utf8Bytes(key);
  if (kb.length > 64) kb = sha1Bytes(kb);
  while (kb.length < 64) kb.push(0);
  var ipad = [], opad = [];
  for (var i = 0; i < 64; i++) {
    ipad.push(kb[i] ^ 54);
    opad.push(kb[i] ^ 92);
  }
  var inner = sha1Bytes(ipad.concat(utf8Bytes(msg)));
  return bytesToBase64(sha1Bytes(opad.concat(inner)));
}

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

async function apiGet(path) {
  var res = await Widget.http.get(HOST + path, { headers: { "User-Agent": UA, "Origin": ORIGIN, "Referer": ORIGIN + "/", "Accept": "application/json, text/plain, */*" } });
  var j = await parseRes(res);
  if (!j || !j.data) return null;
  return j.data;
}

function toCard(item, category) {
  var id = clean(item.albumId);
  var name = clean(item.title);
  if (!id || !name) return null;
  var pic = clean(item.coverUrl);
  if (pic && pic.indexOf("http") !== 0) pic = HOST + (pic.indexOf("/") === 0 ? pic : "/" + pic);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: Number(item.total) > 0 ? ("共" + item.total + "集") : "",
    mediaType: "movie"
  };
}

function catName(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i][1];
  }
  return "全部";
}

async function listRaw(id, page) {
  var path = "/web/v1/drama/list?pageSize=24&currentPage=" + page;
  if (id) path += "&filterCategories[]=" + encodeURIComponent(id);
  var data = await apiGet(path);
  var items = (data && data.data) || [];
  return (items && items.length != null) ? items : [];
}

async function listing(id, page) {
  var rows = await listRaw(id, page);
  if (!rows.length && id) rows = await listRaw("", page);
  var out = [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i], catName(id));
    if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
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
  var list = await listing(cat, page);
  return list.length ? list : emptyItem();
}

// v1.0.3：把 loadResource 的单集解析抽成内部函数，供 loadDetail 预解析与 loadResource 共用。
async function resolveXifuEp(albumId, seq) {
  try {
    var auth = await apiGet("/web/v1/drama/play_auth?albumId=" + encodeURIComponent(albumId) + "&seq=" + seq);
    if (!auth || !auth.vid || !auth.playAuth) return "";
    var res = await Widget.http.get(vodUrl(auth.vid, auth.playAuth), { headers: { "User-Agent": UA, "Referer": ORIGIN + "/" } });
    var j = await parseRes(res);
    var rows = (j && j.PlayInfoList && j.PlayInfoList.PlayInfo) || (j && j.PlayInfo) || [];
    var infos = (rows && rows.length != null) ? rows : [rows];
    var best = null;
    for (var i = 0; i < infos.length; i++) {
      var u = clean(infos[i].PlayURL);
      if (!/^https?:\/\//.test(u)) continue;
      if (!best) best = u;
      if (infos[i].Status === "Normal") { best = u; break; }
    }
    return best || "";
  } catch (e) { return ""; }
}


var RELAY = "https://javsb-relay-production.up.railway.app";
var BATCH_PATH = "/dj/xifu/batch";
var BUA = (typeof UA !== "undefined" && UA) ? UA : "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

// v1.0.4：批量解析。loadDetail 不再逐集调站方解析函数，改为一次 POST RELAY + BATCH_PATH
// （体 {items:[{id: 集链接原样}]}，返回 {results:[{id, url, header, ok}]}），按 id 匹配回填；
// 超上限时分块顺序调；整批传输失败重试一次，仍失败则该块全跳过（不编假地址）。
// 失败集不填空地址，仍保留在 episodes[] 里，点集时 loadResource 单解兜底。模块内不做并发。
async function postBatch(items) {
  try {
    var res = await Widget.http.post(RELAY + BATCH_PATH, JSON.stringify({ items: items }), {
      headers: { "Content-Type": "application/json", "User-Agent": BUA, "Accept": "application/json" }
    });
    if (!res || res.data == null) return null;
    var d = res.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { return null; } }
    if (!d || !d.results) return null;
    return d.results;
  } catch (e) { return null; }
}

async function batchResolveLinks(links, chunk) {
  var out = {};
  if (!links.length) return out;
  var size = Math.max(1, chunk || 100);
  for (var s = 0; s < links.length; s += size) {
    var part = links.slice(s, s + size);
    var items = [];
    for (var i = 0; i < part.length; i++) items.push({ id: part[i] });
    var results = await postBatch(items);
    if (!results) results = await postBatch(items);
    if (!results) continue;
    for (var ri = 0; ri < results.length; ri++) {
      var r = results[ri];
      if (!r || !r.ok || !r.url || !/^https?:\/\//.test(String(r.url))) continue;
      out[String(r.id)] = String(r.url);
    }
  }
  return out;
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
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var match = null;
    var cats = [""];
    for (var ci = 0; ci < CATS.length; ci++) cats.push(CATS[ci][0]);
    for (var i = 0; i < cats.length; i++) {
      var rows = await listRaw(cats[i], 1);
      for (var j = 0; j < rows.length; j++) {
        if (clean(rows[j].albumId) === id) { match = rows[j]; break; }
      }
      if (match) break;
    }
    var total = Math.max(1, Number((match && match.total) || 0) || 1);
    var episodes = [];
    for (var n = 1; n <= total; n++) {
      episodes.push({ name: "第" + n + "集", id: "xifu://" + id + "/" + n, link: "xifu://" + id + "/" + n });
    }
    var pic = "";
    if (match && match.coverUrl) {
      pic = clean(match.coverUrl);
      if (pic.indexOf("http") !== 0) pic = HOST + (pic.indexOf("/") === 0 ? pic : "/" + pic);
    }
    // v1.0.3：逐集预解析直链（play_auth + 阿里云 VOD 签名），补 seasons/episodeItems
    // （App 渲染集数网格用）；解不出的集只跳过预解析，仍保留在 episodes 里，点集时 loadResource 再解。
    var resolved = [];
    var blink = [];
    for (var xi = 1; xi <= total; xi++) blink.push("xifu://" + id + "/" + xi);
    var bmap = await batchResolveLinks(blink, 30);
    for (var ri = 1; ri <= total; ri++) {
      var rurl = bmap["xifu://" + id + "/" + ri] || "";
      if (rurl) resolved.push({ name: "第" + ri + "集", n: ri, videoUrl: rurl });
    }
    var built = buildSeasonItems(resolved, pic);
    return {
      id: id,
      type: "detail",
      title: (match && clean(match.title)) || ("喜福短剧 " + id),
      name: (match && clean(match.title)) || ("喜福短剧 " + id),
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: "共" + total + "集",
      playerType: "app",
      episodes: episodes,
      seasons: built.seasons,
      episodeItems: built.episodeItems
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

function pct(v) {
  return encodeURIComponent(String(v)).replace(/[!'()*]/g, function (ch) {
    var h = ch.charCodeAt(0).toString(16).toUpperCase();
    return "%" + (h.length < 2 ? "0" + h : h);
  });
}

function isoNow() {
  var d = new Date();
  function p(n, w) {
    var s = String(n);
    while (s.length < w) s = "0" + s;
    return s;
  }
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1, 2) + "-" + p(d.getUTCDate(), 2) + "T" + p(d.getUTCHours(), 2) + ":" + p(d.getUTCMinutes(), 2) + ":" + p(d.getUTCSeconds(), 2) + "Z";
}

function vodUrl(vid, encodedAuth) {
  var credential = JSON.parse(utf8Decode(base64ToBytes(encodedAuth)));
  if (!credential.AccessKeyId) throw new Error("喜福凭证无效");
  var region = credential.Region || "cn-shanghai";
  var params = {
    Action: "GetPlayInfo", Version: "2017-03-21", Format: "JSON",
    AccessKeyId: credential.AccessKeyId, SecurityToken: credential.SecurityToken || "",
    VideoId: vid, AuthInfo: credential.AuthInfo || "",
    Timestamp: isoNow(), SignatureMethod: "HMAC-SHA1", SignatureVersion: "1.0",
    SignatureNonce: String(Date.now()) + String(Math.floor(Math.random() * 1000000))
  };
  if (credential.PlayConfig != null) params.PlayConfig = JSON.stringify(credential.PlayConfig);
  var keys = [];
  for (var k in params) keys.push(k);
  keys.sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(pct(keys[i]) + "=" + pct(params[keys[i]]));
  }
  var canonical = parts.join("&");
  var stringToSign = "GET&%2F&" + pct(canonical);
  var signature = hmacSha1Base64((credential.AccessKeySecret || "") + "&", stringToSign);
  return "https://vod." + region + ".aliyuncs.com/?" + canonical + "&Signature=" + pct(signature);
}

async function loadResource(params) {
  params = params || {};
  var raw = t(params.link || params.url || params.id || "");
  if (!raw && params.item) raw = t(params.item.link || params.item.id || "");
  if (raw.indexOf("http") === 0) {
    return [{ name: "播放", url: raw, playerType: "app" }];
  }
  var m = /^xifu:\/\/(.+)\/(\d+)$/.exec(raw);
  if (!m) return [];
  var url = await resolveXifuEp(m[1], Number(m[2]));
  if (url) {
    return [{ name: "播放", url: url, playerType: "app" }];
  }
  return [];
}
