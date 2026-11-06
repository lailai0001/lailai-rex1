// 红果短剧 for REX (lai_hongguo v1.0.0)
// 移植自 LeeCatPaw 的 lee_hongguo_drama（只读蓝图）：站 https://hongguoduanju.com，
// 列表/搜索/详情直接解析网页 window._ROUTER_DATA，不走中转。
// 分类（站方真实 7 个）：短剧 all / 漫剧 comic / AI漫剧 ai_comic / 最新 latest /
//   最热 hot / 男频 male / 女频 female；另有首页推荐（homeSections）。
// 播放限制（2026-11-06 VM 实测，须如实告知用户）：
//   - App 接口 video_model 返回的 5 档（1080/720/540/480/360）是 CENC AES-128-CTR
//     加密 MP4，猫源在服务器端解密后经本地 /media 代理出流；REX 沙箱无 Buffer、
//     无加密库、拿不到二进制，无法直接解密播放，故本模块不列 5 档选单（不编假选单）。
//   - 唯一能直接播的是站方公开的 360p 预告：/video/public/<vid>/360p.mp4，实测
//     仅 10.08 秒（整集 2 分 54 秒，JSON-LD duration PT2M54S），且只有免费集
//     （accessible_episode_cnt）才有，付费集回 404。本模块每集只给这一个
//     “试看10秒 · 360p”入口，名字如实标注；整集直放须另建 CENC 解密中转，
//     不在本模块做。
// 搜索走站方 JSON 接口（2026-11-06 实测）：GET /api/search/result/?query=<关键词>，
//   须带 Referer: https://hongguoduanju.com/search/<关键词>；返回 {searchList, totalCount,
//   pageNum, totalPages, hasMore}，条目为 {keyword: series_id, video_data: {...}}。
//   注意：该接口对同一 IP 短时间内多次调用会回 403 {"code":"search_rejected",
//   "message":"Search is temporarily unavailable."}（VM 侧实测：前 2 次 200，
//   之后连续 403，属站方限流，非接口不存在；手机端 IP 不同，需真机验证）。
//   AI漫剧分类没有分类页路由（tab=ai_comic 会回落到真人剧），只能走搜索接口。
// randomId：猫源用 node:crypto 生成 18 位数字 id，REX 里用 Math.random 替代
// （本模块列表/详情/播放均不调 App 接口，用不到 randomId，此处只记沿革）。

WidgetMetadata = {
  id: "lai_hongguo",
  title: "红果短剧",
  description: "红果短剧：短剧/漫剧/AI漫剧/最新/最热/男频/女频，直接解析站方网页；每集仅提供10秒360p试看，整集播放须解密中转",
  author: "lai",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://hongguoduanju.com",
  detailCacheDuration: 180,
  modules: [
    { title: "搜索", functionName: "search", cacheDuration: 60, params: [{ name: "keyword", title: "关键词", type: "input" }, { name: "page", title: "页码", type: "page" }] },
    { title: "推荐", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "home" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "短剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "all" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "comic" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "AI漫剧", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "ai_comic" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "最新", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "latest" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "最热", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "hot" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "男频", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "male" }, { name: "page", title: "页码", type: "page", value: "1" }] },
    { title: "女频", functionName: "loadList", cacheDuration: 180, params: [{ name: "cat", title: "分类", type: "constant", value: "female" }, { name: "page", title: "页码", type: "page", value: "1" }] }
  ]
};

var SITE = "https://hongguoduanju.com";
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

// 与猫源 parseRouter 同款：从 HTML 里抠出 window._ROUTER_DATA 的 JSON 对象。
function parseRouter(html) {
  var match = /(?:window\.)?_ROUTER_DATA\s*=\s*/.exec(html);
  if (!match) throw new Error("红果页面缺少路由数据");
  var begin = match.index + match[0].length;
  while (html[begin] !== "{" && begin < html.length) begin++;
  var depth = 0, quoted = false, escaped = false;
  for (var i = begin; i < html.length; i++) {
    var c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return JSON.parse(html.slice(begin, i + 1));
  }
  throw new Error("红果路由数据不完整");
}

async function getPage(path) {
  var res = await Widget.http.get(SITE + path, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "Accept-Language": "zh-CN,zh;q=0.9" }
  });
  if (!res || res.data == null) throw new Error("红果页面无返回");
  var html = String(res.data);
  var data = parseRouter(html);
  return data.loaderData || {};
}

function toCard(raw) {
  if (!raw || typeof raw !== "object") return null;
  var row = (raw.video_data && typeof raw.video_data === "object") ? raw.video_data : raw;
  var id = t(pick(row.series_id, raw.series_id, raw.keyword, ""));
  if (!id) return null;
  var name = clean(pick(row.series_title, row.series_name, raw.series_name, raw.name, "未命名"));
  var pic = t(pick(row.series_cover, raw.series_cover, ""));
  var cnt = pick(row.episode_cnt, raw.episode_cnt, "");
  var intro = clean(pick(row.series_intro, raw.series_intro, ""));
  return {
    id: id,
    type: "url",
    title: name,
    posterPath: pic,
    coverUrl: pic,
    backdropPath: pic,
    link: id,
    description: cnt ? ("全" + cnt + "集") : intro,
    mediaType: "movie"
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

async function getSearchJson(keyword, page) {
  var q = "/api/search/result/?query=" + encodeURIComponent(keyword);
  if (page > 1) q += "&pageNum=" + page;
  var res = await Widget.http.get(SITE + q, {
    headers: { "User-Agent": UA, "Accept": "application/json", "Referer": SITE + "/search/" + encodeURIComponent(keyword) }
  });
  if (!res || res.data == null) throw new Error("搜索接口无返回");
  var j = res.data;
  if (typeof j === "string") {
    try { j = JSON.parse(j); } catch (e) { throw new Error("搜索接口返回异常"); }
  }
  if (!j || !j.searchList) throw new Error("搜索暂不可用");
  return j;
}

async function searchList(keyword, page) {
  var j = await getSearchJson(keyword, page || 1);
  return toList(j.searchList);
}

async function loadList(params) {
  params = params || {};
  var cat = t(params.cat || "all");
  var page = Math.max(1, parseInt(params.page, 10) || 1);
  try {
    var list = [];
    if (cat === "home") {
      var home = await getPage("/");
      var pg = home.page || {};
      var seen = {};
      var sections = pg.homeSections || [];
      for (var si = 0; si < sections.length; si++) {
        var vl = sections[si].video_list || [];
        for (var vi = 0; vi < vl.length; vi++) {
          var item = toCard(vl[vi]);
          if (!item || seen[item.id]) continue;
          seen[item.id] = 1;
          list.push(item);
        }
      }
      list = list.slice(0, 40);
    } else if (cat === "ai_comic") {
      list = await searchList("AI漫剧", page);
    } else {
      var q = "tab=" + (cat === "comic" ? "2" : "1") + "&sort_type=" + (cat === "latest" ? "2" : "1");
      if (cat === "male") q += "&gender=1";
      if (cat === "female") q += "&gender=2";
      if (page > 1) q += "&page=" + page;
      var data = await getPage("/category?" + q);
      var payload = data["category_$"] || data.category_page || {};
      list = toList(payload.recommendList);
    }
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
    var list = await searchList(wd, page);
    return list.length ? list : emptyItem();
  } catch (e) {
    return [{ id: "err", type: "url", title: "搜索失败: " + String((e && e.message) || e).slice(0, 50) }];
  }
}

async function loadDetail(link) {
  try {
    var id = t(link);
    var m = id.match(/(\d+)\s*$/);
    if (m) id = m[1];
    if (!id) return { id: "err", type: "url", title: "解析失败", description: "链接为空" };
    var data = await getPage("/detail?series_id=" + encodeURIComponent(id));
    var value = (data.detail_page && data.detail_page.seriesDetail) || {};
    var vids = value.vid_list || [];
    if (!vids.length) {
      return { id: id, type: "url", title: clean(value.series_name) || "红果短剧", description: "未找到分集" };
    }
    var total = parseInt(value.episode_cnt, 10) || vids.length;
    var accessible = parseInt(value.accessible_episode_cnt, 10);
    if (!(accessible > 0)) accessible = vids.length;
    if (accessible > vids.length) accessible = vids.length;
    var title = clean(value.series_name) || "红果短剧";
    var pic = t(value.series_cover || "");
    var descParts = [];
    if (value.episode_right_text) descParts.push(clean(value.episode_right_text));
    else descParts.push("全" + total + "集");
    descParts.push("本模块每集仅提供10秒360p试看（站方公开预告）；整集播放须另建解密中转。");
    if (value.series_intro) descParts.push(clean(value.series_intro));
    // 只列免费集：付费集的公开预告回 404，列出来点开也是死链。
    var episodes = [];
    for (var i = 0; i < accessible; i++) {
      var vid = String(vids[i]);
      if (!vid) continue;
      episodes.push({ name: "第" + (i + 1) + "集", id: vid, link: vid });
    }
    return {
      id: String(value.series_id || id),
      type: "detail",
      title: title,
      name: title,
      link: String(value.series_id || id),
      posterPath: pic,
      coverUrl: pic,
      backdropPath: pic,
      description: descParts.join("\n"),
      playerType: "app",
      episodes: episodes
    };
  } catch (e) {
    return { id: String(link || "err"), type: "url", title: "请求错误", description: String((e && e.message) || e) };
  }
}

// 播放：只返回站方公开的 360p 预告直链（实测 10.08 秒、video/mp4、未加密）。
// App 接口的 5 档全是 CENC 加密 MP4，REX 无法解密，故不列档位、不编假选单。
async function loadResource(params) {
  params = params || {};
  var raw = t(params.link || params.url || params.id || "");
  if (!raw && params.item) raw = t(params.item.link || params.item.id || "");
  if (!raw) return [];
  var m = raw.match(/(\d{10,})\s*$/);
  if (!m) return [];
  var url = SITE + "/video/public/" + m[1] + "/360p.mp4";
  return [{ name: "试看10秒 · 360p", url: url, playerType: "app" }];
}
