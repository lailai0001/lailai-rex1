// 多聚短剧 · 大芒 for REX (lai_duoju_damang v1.0.0)
// v1.0.1（xnxx 式）：loadDetail 直接出 videoUrl，不返 episodes、不走 loadResource；多集只播第 1 个能解析出的集（顺延试到成功为止），其余集暂不可选。
// 移植自 LeeCatPaw 的 lee_duoju_damang（只读蓝图）：纯 HTTPS JSON，固定 did，无签名无加密。
// 列表 GET damang.api.mgtv.com；详情取 anthologies 的 vid；播放 GET mobile.api.mgtv.com
// getSource 取 videoSources 首个可用地址（接口偶发 code 10008 无源，连续重试 5 次，
// REX 无 setTimeout 故不等待直接重试）。

WidgetMetadata = {
  id: "lai_duoju_damang",
  title: "多聚短剧 · 大芒",
  description: "多聚短剧 · 大芒：爱情/都市/古装/言情等短剧，纯 HTTPS 接口",
  author: "lai",
  version: "1.0.1",
  requiredVersion: "0.0.1",
  site: "https://damang.api.mgtv.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "爱情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "aiqing" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "都市", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "dushi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "古装", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "guzhuang" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "言情", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "yanqing" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "奇幻", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "qihuan" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "真人秀", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "zhenrenxiu" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "悬疑", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "xuanyi" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "网剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "wangju" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "青春", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "qingchun" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var API = "https://damang.api.mgtv.com";
var DID = "2ebfeec0a5ad5c0357bae448b8658cc3";
var CATS = [
  ["aiqing", "爱情", "1273154"],
  ["dushi", "都市", "1279863"],
  ["guzhuang", "古装", "1273153"],
  ["yanqing", "言情", "1273190"],
  ["qihuan", "奇幻", "2924543"],
  ["zhenrenxiu", "真人秀", "1657120"],
  ["xuanyi", "悬疑", "1310272"],
  ["wangju", "网剧", "2844459"],
  ["qingchun", "青春", "2836677"]
];

function t(v) {
  return String(v == null ? "" : v).trim();
}

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson(url) {
  try {
    var res = await Widget.http.get(url, { headers: { "Accept": "application/json, text/plain, */*", "Referer": API + "/" } });
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

function toCard(item, category) {
  var id = clean(item.albumId);
  var name = clean(item.albumTitle || item.title);
  if (!id || !name) return null;
  var pic = clean(item.verticalImg);
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: clean(item.albumUpdateSerialNoDesc),
    mediaType: "movie"
  };
}

function toList(j, category) {
  var out = [];
  var rows = (j && j.data && j.data.list) || [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var c = toCard(rows[i], category);
    if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
  }
  return out;
}

function emptyItem(msg) {
  return [{ id: "empty", type: "url", title: msg || "没有找到相关内容" }];
}

async function loadList(params) {
  params = params || {};
  var cat = catOf(t(params.cat || "aiqing"));
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var url = API + "/newbee/manage/page/film/library/v3?did=" + DID + "&pageSize=12&pageNum=" + page + "&tagName=" + encodeURIComponent(cat[1]) + "&tagId=" + cat[2];
  var list = toList(await getJson(url), cat[1]);
  return list.length ? list : emptyItem();
}

async function search(params) {
  params = params || {};
  var wd = t(params.keyword || params.q || "");
  if (!wd) return [{ id: "tip", type: "url", title: "输入关键词后搜索" }];
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  var url = API + "/newbee/search/key/words?keyWords=" + encodeURIComponent(wd) + "&screenType=1&pageNum=" + page + "&pageSize=12";
  var j = await getJson(url);
  var list = toList({ data: { list: (j && j.data && j.data.videos) || [] } }, "");
  return list.length ? list : emptyItem();
}

async function loadDetail(link) {
  try {
    var id = t(link);
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var j = await getJson(API + "/newbee/play/page/detail?did=" + DID + "&albumId=" + encodeURIComponent(id) + "&vid=");
    var album = (j && j.data && j.data.album) || {};
    var eps = [];
    var seen = {};
    var rows = album.anthologies || [];
    for (var i = 0; i < rows.length; i++) {
      var vid = clean(rows[i].vid);
      var n = Number(rows[i].serialno) || (i + 1);
      if (!vid || seen[n]) continue;
      seen[n] = 1;
      eps.push({ name: "第" + n + "集", id: "damang://" + vid, link: "damang://" + vid });
    }
    if (!eps.length) return { id: id, type: "url", title: "无可播分集", description: "详情无分集" };
    var pic = clean(album.verticalImg);
    var tags = [];
    var tagList = album.tagList || [];
    for (var ti = 0; ti < tagList.length; ti++) {
      if (tagList[ti].tagName) tags.push(clean(tagList[ti].tagName));
    }
        var playUrl = "";
    var playEp = 0;
    for (var pi = 0; pi < eps.length; pi++) {
      var playCand = await resolvePlayUrl(eps[pi].link);
      if (playCand) { playUrl = playCand; playEp = pi + 1; break; }
    }
    var descText = clean(album.albumBrief) + (tags.length ? "\n" + tags.join(" · ") : "") + "\n共" + eps.length + "集" + (playUrl ? "（当前播：第" + playEp + "集）" : "\n未找到可播放地址");
    var result = {
      id: id,
      type: "detail",
      title: clean(album.albumTitle) || "大芒短剧",
      name: clean(album.albumTitle) || "大芒短剧",
      link: id,
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descText,
      playerType: "app",
      customHeaders: {"User-Agent": "Mozilla/5.0", "Referer": API + "/"},
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
  if (raw.indexOf("damang://") !== 0) return "";
  var vid = raw.slice(9);
  var url = "http://mobile.api.mgtv.com/v8/video/getSource?playType=28&fileSourceType=2&seekSourceType=2&definition=3&_support=10100001&osVersion=10&videoId=" + encodeURIComponent(vid);
  // 该接口偶发 code 10008（无源），猫源重试 5 次；REX 无 setTimeout，改为不等待连续重试 5 次。
  for (var attempt = 0; attempt < 5; attempt++) {
    var j = await getJson(url);
    var sources = (j && j.data && j.data.videoSources) || [];
    for (var i = 0; i < sources.length; i++) {
      var media = clean(sources[i].disp && sources[i].disp.info);
      if (/^https?:\/\//.test(media)) {
        return media;
      }
    }
  }
  return "";
}
