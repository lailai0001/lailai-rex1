// 多聚短剧 · 好看 for REX (lai_duoju_haokan v1.0.0)
// 移植自 LeeCatPaw 的 lee_duoju_haokan（只读蓝图）：纯 HTTPS POST 表单，无签名无加密。
// 列表/详情/播放均走 sv.baidu.com 的 POST 接口；播放取 clarityUrl 里 video_quality
// 最高的一条直链（站方真实档位只取最高，不编多档选单）。

WidgetMetadata = {
  id: "lai_duoju_haokan",
  title: "多聚短剧 · 好看",
  description: "多聚短剧 · 好看：热播剧/新剧/战神/神豪等短剧，纯 HTTPS 接口",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://sv.baidu.com",
  detailCacheDuration: 180,
  modules: [
    { title: "热播剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "reboduanju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "新剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xinju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "战神", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhanshen" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "神豪", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shenhao" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "神医", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "shenyi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "甜宠", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "tianchong" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "赘婿", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhuixu" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "穿越重生", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "chuanyue" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "异能", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "yineng" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "虐恋", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "nuelian" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "宫斗宅斗", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "gongdou" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "玄幻", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xuanhuan" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var BASE = "https://sv.baidu.com";
var QUERY = "log=vhk&tn=1020970b&ctn=1008350n&blur=1";
var UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36";
var CATS = [
  ["reboduanju", "热播剧", "1"],
  ["xinju", "新剧", "2"],
  ["zhanshen", "战神", "1001"],
  ["shenhao", "神豪", "2001"],
  ["shenyi", "神医", "1002"],
  ["tianchong", "甜宠", "1007"],
  ["zhuixu", "赘婿", "1003"],
  ["chuanyue", "穿越重生", "2004"],
  ["yineng", "异能", "2005"],
  ["nuelian", "虐恋", "1006"],
  ["gongdou", "宫斗宅斗", "2006"],
  ["xuanhuan", "玄幻", "2009"]
];

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

async function postForm(path, fields) {
  try {
    var res = await Widget.http.post(BASE + path, formBody(fields), { headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } });
    if (!res || res.data == null) return null;
    if (typeof res.data === "object") return res.data;
    var s = String(res.data).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  } catch (e) { return null; }
}

function catOf(id) {
  for (var i = 0; i < CATS.length; i++) {
    if (CATS[i][0] === id) return CATS[i];
  }
  return CATS[0];
}

function toCard(row, category) {
  var id = clean(row.playlet_id);
  var name = clean(row.playlet_title);
  if (!id || !name) return null;
  var pic = clean(row.playlet_poster);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: row.episodes_num ? ("更新" + row.episodes_num + "集") : "",
    mediaType: "movie"
  };
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = catOf(t(params.cat || "reboduanju"));
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var j = await postForm("/haokan/ui-feed/playletTagsFeed?" + QUERY, { tag_id: cat[2], pn: String(page), rn: "12" });
  var out = [];
  var rows = (j && j.data && j.data.list) || [];
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i], cat[1]);
    if (c) out.push(c);
  }
  return out.length ? out : emptyItem();
}

async function loadDetail(link) {
  try {
    var raw = t(link);
    var id = raw;
    var at = id.indexOf("@");
    if (at >= 0) id = id.slice(0, at);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await postForm("/haokan/ui-video/playlet/rec/detail?" + QUERY, { playlet_id: id, vid: "undefined" });
    var data = (j && j.data) || {};
    var vids = data.vid_list || [];
    var episodes = [];
    for (var i = 0; i < vids.length; i++) {
      if (clean(vids[i])) {
        episodes.push({ name: "第" + (i + 1) + "集", id: "haokan://" + clean(vids[i]), link: "haokan://" + clean(vids[i]) });
      }
    }
    if (!episodes.length) return { id: raw, type: "url", title: "无可播分集", description: "详情无分集" };
    var pic = clean(data.playlet_poster);
    return {
      id: raw,
      type: "detail",
      title: clean(data.playlet_title) || "好看短剧",
      name: clean(data.playlet_title) || "好看短剧",
      link: raw,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: clean(data.description) + "\n共" + episodes.length + "集",
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
  if (raw.indexOf("haokan://") !== 0) return [];
  var vid = raw.slice(9);
  var j = await postForm("/appui/api?cmd=video/relate&" + QUERY, { method: "post", vid: vid });
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
    return [{ name: "播放", url: best, playerType: "app" }];
  }
  return [];
}
