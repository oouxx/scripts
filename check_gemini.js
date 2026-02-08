/**
 * 检查节点是否能正常访问 Gemini（gemini.google.com）
 * 返回 true = 可用，false = 不可用
 *
 * 使用方式：在 Sub-Store 脚本操作 → 后置脚本 或 过滤器中使用
 */

async function operator(proxies) {
  // 如果你只想检测第一个节点，可以直接用 proxies[0]
  // 如果想检测所有节点并标记，这里循环处理
  const results = [];

  for (const proxy of proxies) {
    try {
      const isAvailable = await checkGemini(proxy);
      // 给节点增加一个 _gemini_ok 的自定义字段（方便后续过滤或显示）
      proxy._gemini_ok = isAvailable;

      // 可选：如果不可用，直接移除该节点（视需求）
      // if (!isAvailable) continue;

      results.push(proxy);
    } catch (e) {
      proxy._gemini_ok = false;
      proxy._gemini_error = String(e);
      results.push(proxy);
    }
  }

  return results; // 返回处理后的节点数组
}

// 核心检测函数
async function checkGemini(proxy) {
  const url = "https://gemini.google.com/";

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    // 如果你的代理环境需要，可以在这里加其他 header
  };

  // Sub-Store 内置的 http 客户端（推荐使用 $httpClient）
  const response = await $httpClient.get({
    url: url,
    headers: headers,
    proxy: proxy, // 关键：走该节点代理
    timeout: 10000, // 建议设置超时，单位 ms
  });

  if (
    response.status !== 200 &&
    response.status !== 302 &&
    response.status !== 301
  ) {
    return false;
  }

  const body = response.body || "";

  // 经典特征字符串（截至 2025-2026 年初仍有效，但可能随时变动）
  if (body.includes("45631641,null,true")) {
    return true;
  }

  // 备选判断方式（更稳健一些，可选）
  // if (body.includes("gemini") && body.includes("google.com") && body.length > 5000) {
  //   return true;
  // }

  return false;
}
