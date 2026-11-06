// 多聚短剧 · 星芽 for REX (lai_duoju_xingya v1.0.2)
// v1.0.2（episodes + loadResource）：从 1.0.0 的 episodes 写法恢复集数选集（1.0.1 为 xnxx 式单 videoUrl、无集数）；loadDetail 只返回全部 episodes 不再预解析，点集时 loadResource 单次解析；分类/搜索/参数与 1.0.1 完全一致。
// 移植自 LeeCatPaw 的 lee_duoju_xingya（只读蓝图；七星共用同一 register）：纯 HTTPS，
// 无签名无加密，但每次调用需先 POST 登录取 token（固定 device/devToken，token 不持久化，
// 每个 REX 函数入口先登录再调接口）。列表/详情/播放均为 app.whjzjx.cn 接口。

WidgetMetadata = {
  id: "lai_duoju_xingya",
  title: "多聚短剧 · 星芽",
  description: "多聚短剧 · 星芽：剧场/热播剧/会员专享等短剧，登录取 token 后调接口",
  author: "lai",
  version: "1.0.2",
  requiredVersion: "0.0.1",
  site: "https://app.whjzjx.cn",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "剧场", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "juchang" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "热播剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "reboduanju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "会员专享", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "huiyuan" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "星选好剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xingxuan" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "新剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xinju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "阳光剧场", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "yangguang" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var HOST = "https://app.whjzjx.cn";
var LOGIN = "https://u.shytkjgs.com/user/v1/account/login";
var DEVICE = "24250683a3bdb3f118dff25ba4b1cba1a";
var DEVTOKEN = "Bnf9uRPIcKTIOZasAUgUJAUDXhIOlB4lpDKsyLD4yvKm708G4J8PN1Z-gMaFgPwkRvqJrEje81VRxh41IaSj0lNWuoRLUg1r08Z1f0IqSv2q1lvfxrYckKavmnAPYLdkT9P1fPFNRt0RuN3DLLFZqApRDdPD3mM2jB6d79CF2LtM*";
var APPUA = "Mozilla/5.0 (Linux; Android 9; RMX1931 Build/PQ3A.190605.05081124; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36";
var BASEH = { "User-Agent": "okhttp/4.10.0", "x-app-id": "7", "platform": "1", "version_name": "3.3.1", "app_version": "3.3.1", "device_platform": "android", "device_id": DEVICE, "device_type": "RMX1931", "device_brand": "realme", "os_version": "9", "channel": "default", "uuid": "randomUUID_914e7a9b-deac-4f80-9247-db56669187df" };
var CATS = [
  ["juchang", "剧场", "1"],
  ["reboduanju", "热播剧", "2"],
  ["huiyuan", "会员专享", "8"],
  ["xingxuan", "星选好剧", "7"],
  ["xinju", "新剧", "3"],
  ["yangguang", "阳光剧场", "5"]
];
var TOKEN = "";

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function mergeHeaders(extra) {
  var h = {};
  for (var k in BASEH) h[k] = BASEH[k];
  if (extra) for (var k2 in extra) h[k2] = extra[k2];
  return h;
}

async function parseRes(res) {
  if (!res || res.data == null) return null;
  if (typeof res.data === "object") return res.data;
  var s = String(res.data).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

async function login() {
  if (TOKEN) return TOKEN;
  var body = "device=" + DEVICE + "&install_first_open=false&first_install_time=1723214205125&last_update_time=1723214205125&report_link_url=";
  var res = await Widget.http.post(LOGIN, body, { headers: mergeHeaders({ "Content-Type": "application/x-www-form-urlencoded" }) });
  var j = await parseRes(res);
  TOKEN = clean(j && j.data && j.data.token);
  if (!TOKEN) throw new Error("星芽登录未返回 token");
  return TOKEN;
}

async function callApi(path, method, payload) {
  var token = await login();
  var headers = mergeHeaders({ "authorization": token, "dev_token": DEVTOKEN, "user_agent": APPUA, "support_h265": "1" });
  var body = null;
  if (payload !== undefined && payload !== null) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }
  var res;
  if (method === "POST") {
    res = await Widget.http.post(HOST + path, body || "", { headers: headers });
  } else {
    res = await Widget.http.get(HOST + path, { headers: headers });
  }
  var j = await parseRes(res);
  if (!j || !j.data) throw new Error("星芽接口无数据");
  return j.data;
}

function catOf(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i];
  }
  return CATS[0];
}

function toCard(item, category) {
  var id = clean(item.id);
  var name = clean(item.title);
  if (!id || !name) return null;
  var pic = clean(item.cover_url);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: item.total ? ("共" + item.total + "集") : "",
    mediaType: "movie"
  };
}

function toList(data, category) {
  var out = [];
  var rows = (data && data.list) || [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i].theater || rows[i], category);
    if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = catOf(t(params.cat || "juchang"));
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var data = await callApi("/cloud/v2/theater/home_page?theater_class_id=" + cat[2] + "&type=1&class2_ids=0&page_num=" + page + "&page_size=24", "GET", null);
    var list = toList(data, cat[1]);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "载入失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  try {
    var data = await callApi("/v3/search", "POST", { text: wd });
    var rows = (data.theater && data.theater.search_data) || [];
    var list = toList({ list: rows }, "搜索");
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function detailData(id) {
  return callApi("/v2/theater_parent/detail?theater_parent_id=" + encodeURIComponent(id), "GET", null);
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var data = await detailData(id);
    var eps = [];
    var seen = {};
    var rows = data.theaters || [];
    for (var i = 0; i < rows.length; i++) {
      var n = Number(rows[i].num) || (i + 1);
      if (seen[n]) continue;
      seen[n] = 1;
      var son = clean(rows[i].son_title);
      var title = clean(data.title);
      var name = (son && son !== title) ? ("第" + n + "集 " + son) : ("第" + n + "集");
      eps.push({ name: name.replace(/[$#]/g, "_"), id: "xingya://" + id + "/" + n, link: "xingya://" + id + "/" + n });
    }
    eps.sort(function (a, b) {
      var na = Number(a.name.replace(/[^0-9]/g, "")) || 0;
      var nb = Number(b.name.replace(/[^0-9]/g, "")) || 0;
      return na - nb;
    });
    if (!eps.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var pic = clean(data.cover_url);
    return {
      id: id,
      type: "detail",
      title: clean(data.title) || "星芽短剧",
      name: clean(data.title) || "星芽短剧",
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: clean(data.introduction) + "\n共" + eps.length + "集",
      playerType: "app",
      episodes: eps
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
  var m = /^xingya:\/\/([^/]+)\/(\d+)$/.exec(raw);
  if (!m) return [];
  try {
    var data = await detailData(m[1]);
    var rows = data.theaters || [];
    var want = Number(m[2]);
    var url = "";
    for (var i = 0; i < rows.length; i++) {
      if (Number(rows[i].num) === want) { url = clean(rows[i].son_video_url); break; }
    }
    if (/^https?:\/\//.test(url)) {
      return [{ name: "播放", url: url, playerType: "app" }];
    }
  } catch (e) { /* fall through */ }
  return [];
}
