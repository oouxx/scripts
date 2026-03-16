/**
 * Sub-Store 脚本：检测节点对 OpenAI/ChatGPT 的可用性
 *
 * 输出：
 *   - res.Openai     = true → 完整支持（App + Web）
 *   - res.OpenaiWeb  = true → 至少 Web 端可用
 *   - proxy.remarks  附加标记： "GPT⁺" / "GPT" / 无
 */

async function operator(proxies) {
  const results = [];

  for (const proxy of proxies) {
    try {
      const [cookiesOk, clientOk] = await Promise.all([
        checkCookies(proxy),
        checkClient(proxy),
      ]);

      // 附加自定义字段（方便后续过滤或显示）
      proxy._openai_cookies = cookiesOk;
      proxy._openai_client = clientOk;

      // 核心判断逻辑
      if (cookiesOk && clientOk) {
        proxy.remarks = (proxy.remarks || "") + " GPT⁺";
        proxy._openai = "plus"; // 或 'full'，看你后续怎么用
      } else if (cookiesOk || clientOk) {
        proxy.remarks = (proxy.remarks || "") + " GPT";
        proxy._openai = "web";
      } else {
        proxy._openai = "no";
        // 可选：proxy.remarks += ' ×';   // 如果想标记不可用
      }

      results.push(proxy);
    } catch (e) {
      proxy._openai = "error";
      proxy._openai_error = String(e).slice(0, 120);
      results.push(proxy);
    }
  }

  return results;
}

// ────────────────────────────────────────────────
// 检查 cookies 接口（Web 端主要依赖）
async function checkCookies(proxy) {
  const url = "https://api.openai.com/compliance/cookie_requirements";

  const res = await $httpClient.get({
    url,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    proxy,
    timeout: 10000,
  });

  if (res.statusCode !== 200) return false;

  const body = (res.body || "").toLowerCase();
  return !body.includes("unsupported_country");
}

// ────────────────────────────────────────────────
// 模拟 iOS ChatGPT 客户端请求（App 端检测）
async function checkClient(proxy) {
  const url = "https://ios.chat.openai.com";

  const res = await $httpClient.get({
    url,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_0 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Mobile/16G29 ChatGPT/3.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "com.openai.chatgpt",
      Referer: "https://chat.openai.com/",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://chat.openai.com",
      "Sec-Fetch-Site": "same-origin",
      "sec-ch-ua-mobile": "?1",
    },
    proxy,
    timeout: 12000,
  });

  if (res.statusCode < 200 || res.statusCode >= 400) return false;

  const body = (res.body || "").toLowerCase();
  return !body.includes("unsupported_country") && !body.includes("vpn");
}
