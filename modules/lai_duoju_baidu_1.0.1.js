// 多聚短剧 · 百度 for REX (lai_duoju_baidu v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_baidu（只读蓝图）：列表走 mbd.baidu.com POST 表单，
// version = MD5(秒级时间戳 + "v2")，纯 JS 实现 MD5（REX 无 crypto、无 Buffer）。
// 详情/播放复用好看接口（猫源即如此：detail/play 调 leeHaokanHandlers），分集号 haokan:// 转 baidu://。

WidgetMetadata = {
  id: "lai_duoju_baidu",
  title: "多聚短剧 · 百度",
  description: "多聚短剧 · 百度：神医/都市/言情/总裁等短剧，MD5 签名列表 + 好看详情播放",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://mbd.baidu.com",
  detailCacheDuration: 180,
  modules: [
    { title: "全部", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "quanbu" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "神医", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shenyi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "都市", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "dushi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "现代言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xiandaiyanqing" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "异能", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "yineng" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "逆袭", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "nixi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "甜宠", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "tianchong" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "总裁", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zongcai" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "萌宝", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "mengbao" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "战神", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhanshen" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "宫斗宅斗", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "gongdouzhaidou" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "神豪", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shenhao" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "虐恋", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "nuelian" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "闪婚", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shanhun" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "玄幻", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xuanhuan" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "穿越重生", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "chuanyuechongsheng" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "年代", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "niandai" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "家庭伦理", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "jiatinglunli" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "古代言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "gudaiyanqing" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "武侠武打", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "wuxiawuda" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "赘婿", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhuixu" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "青春校园", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "qingchunxiaoyuan" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var MBD = "https://mbd.baidu.com";
var HK = "https://sv.baidu.com";
var HKQUERY = "log=vhk&tn=1020970b&ctn=1008350n&blur=1";
var UA = "Dalvik/2.1.0 (Linux; U; Android 9; 22081212C Build/PQ3B.190801.002) Talos/1.8.13 SP-engine/3.47.0 bd_dvt/1 baiduboxapp/15.21.0.10 (Baidu; P1 9)";
var HKUA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36";
var COOKIE = "BAIDUCUID=0Ovgu0uAvu0_828wj8Hma_8i28joaSuIlOvOigiAH88ikS8f0k35aD6mA";
var CATS = [
  ["quanbu", "全部"], ["shenyi", "神医"], ["dushi", "都市"],
  ["xiandaiyanqing", "现代言情"], ["yineng", "异能"], ["nixi", "逆袭"],
  ["tianchong", "甜宠"], ["zongcai", "总裁"], ["mengbao", "萌宝"],
  ["zhanshen", "战神"], ["gongdouzhaidou", "宫斗宅斗"], ["shenhao", "神豪"],
  ["nuelian", "虐恋"], ["shanhun", "闪婚"], ["xuanhuan", "玄幻"],
  ["chuanyuechongsheng", "穿越重生"], ["niandai", "年代"],
  ["jiatinglunli", "家庭伦理"], ["gudaiyanqing", "古代言情"],
  ["wuxiawuda", "武侠武打"], ["zhuixu", "赘婿"], ["qingchunxiaoyuan", "青春校园"]
];

// 纯 JS MD5（RFC 1321），输入按 UTF-8 编码；已在 VM 侧对照 node crypto 校验。
function md5Hex(input) {
  var s = unescape(encodeURIComponent(input));
  var bytes = [];
  for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
  var bitLen = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (var k = 0; k < 8; k++) bytes.push(Math.floor(bitLen / Math.pow(2, k * 8)) & 255);
  function add(x, y) {
    var l = (x & 65535) + (y & 65535);
    var m = (x >> 16) + (y >> 16) + (l >> 16);
    return (m << 16) | (l & 65535);
  }
  function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
  function ff(a, b, c, d, x, sh, ac) { return add(rol(add(add(a, ((b & c) | ((~b) & d))), add(x, ac)), sh), b); }
  function gg(a, b, c, d, x, sh, ac) { return add(rol(add(add(a, ((b & d) | (c & (~d)))), add(x, ac)), sh), b); }
  function hh(a, b, c, d, x, sh, ac) { return add(rol(add(add(a, (b ^ c ^ d)), add(x, ac)), sh), b); }
  function ii(a, b, c, d, x, sh, ac) { return add(rol(add(add(a, (c ^ (b | (~d)))), add(x, ac)), sh), b); }
  var K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
  var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var off = 0; off < bytes.length; off += 64) {
    var M = [];
    for (var mi = 0; mi < 16; mi++) {
      M.push(bytes[off + mi * 4] | (bytes[off + mi * 4 + 1] << 8) | (bytes[off + mi * 4 + 2] << 16) | (bytes[off + mi * 4 + 3] << 24));
    }
    var a = a0, b = b0, c = c0, d = d0;
    for (var ri = 0; ri < 64; ri++) {
      var f, gIdx;
      if (ri < 16) { f = ff; gIdx = ri; }
      else if (ri < 32) { f = gg; gIdx = (5 * ri + 1) % 16; }
      else if (ri < 48) { f = hh; gIdx = (3 * ri + 5) % 16; }
      else { f = ii; gIdx = (7 * ri) % 16; }
      var nb = f(a, b, c, d, M[gIdx], S[ri], K[ri]);
      var tmp = d; d = c; c = b; b = nb;
      a = tmp;
    }
    a0 = add(a0, a); b0 = add(b0, b); c0 = add(c0, c); d0 = add(d0, d);
  }
  function hexWord(n) {
    var out = "";
    for (var bi = 0; bi < 4; bi++) {
      var byte = (n >>> (bi * 8)) & 255;
      out += "0123456789abcdef".charAt(byte >>> 4) + "0123456789abcdef".charAt(byte & 15);
    }
    return out;
  }
  return hexWord(a0) + hexWord(b0) + hexWord(c0) + hexWord(d0);
}

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function formBody(fields) {
  var parts = [];
  for (var k in fields) {
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(fields[k]));
  }
  return parts.join("&");
}

async function postFormUrl(url, fields, ua, cookie) {
  try {
    var headers = { "User-Agent": ua, "Content-Type": "application/x-www-form-urlencoded" };
    if (cookie) headers.Cookie = cookie;
    var res = await Widget.http.post(url, formBody(fields), { headers: headers });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

function catName(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i][1];
  }
  return "全部";
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "quanbu");
  var name = catName(cat);
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var stamp = Math.floor(Date.now() / 1000);
  var version = md5Hex(String(stamp) + "v2");
  var data = { data: { refreshIndex: page, timestamp: stamp, version: version, themes: [{ kind: "综合", names: ["新剧"] }, { kind: "题材", names: [name === "全部" ? "" : name] }], extRequest: { flow_tabid: "13" }, from: "feed", page: "channel_video_landing", pd: "feed", theme: "" } };
  var j = await postFormUrl(MBD + "/feedapi/v1/videoserver/playlets/list?service=bdbox", { data: JSON.stringify(data) }, UA, COOKIE);
  var out = [];
  var rows = (j && j.data && j.data.items) || [];
  for (var i = 0; i < rows.length; i++) {
    var vid = String(rows[i].collId || "").trim();
    var title = String(rows[i].title || "").trim();
    if (!vid || !title) continue;
    var pic = String(rows[i].img || "");
    out.push({
      id: vid,
      type: "url",
      title: title,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      link: vid,
      description: String(rows[i].updateStatus || "全集"),
      mediaType: "movie"
    });
  }
  return out.length ? out : emptyItem();
}

// 详情/播放复用好看接口（与猫源一致）
async function loadDetail(link) {
  try {
    var raw = t(link);
    var id = raw;
    var at = id.indexOf("@");
    if (at >= 0) id = id.slice(0, at);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await postFormUrl(HK + "/haokan/ui-video/playlet/rec/detail?" + HKQUERY, { playlet_id: id, vid: "undefined" }, HKUA, "");
    var data = (j && j.data) || {};
    var vids = data.vid_list || [];
    var episodes = [];
    for (var i = 0; i < vids.length; i++) {
      if (clean(vids[i])) {
        episodes.push({ name: "第" + (i + 1) + "集", id: "baidu://" + clean(vids[i]), link: "baidu://" + clean(vids[i]) });
      }
    }
    if (!episodes.length) return { id: raw, type: "url", title: "无可播分集", description: "详情无分集" };
    var pic = clean(data.playlet_poster);
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < episodes.length; pi++) {
      var playCand = await resolvePlayUrl(episodes[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = clean(data.description) + "\n共" + episodes.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: raw,
      type: "detail",
      title: clean(data.playlet_title) || "百度短剧",
      name: clean(data.playlet_title) || "百度短剧",
      link: raw,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descText,
      playerType: "app",
      customHeaders: {"User-Agent": HKUA, "Referer": HK + "/"},
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
  if (raw.indexOf("baidu://") !== 0) return "";
  var vid = raw.slice(8);
  var j = await postFormUrl(HK + "/appui/api?cmd=video/relate&" + HKQUERY, { method: "post", vid: vid }, HKUA, "");
  var rows = (j && j["video/relate"] && j["video/relate"].data && j["video/relate"].data.cur_video && j["video/relate"].data.cur_video.clarityUrl) || [];
  var best = null;
  var bestQ = -1;
  for (var i = 0; i < rows.length; i++) {
    var u = clean(rows[i].url);
    if (!/^https?:\/\//.test(u)) continue;
    var q = Number(rows[i].video_quality || 0);
    if (q > bestQ) { bestQ = q; best = u; }
  }
  if (best) {
    return best;
  }
  return "";
}
