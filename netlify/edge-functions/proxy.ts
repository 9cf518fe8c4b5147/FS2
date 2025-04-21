import { Context } from "@netlify/edge-functions";

// ... (pickHeaders 函数保持不变) ...
const pickHeaders = (headers: Headers, keys: (string | RegExp)[]): Headers => {
  const picked = new Headers();
  for (const key of headers.keys()) {
    if (keys.some((k) => (typeof k === "string" ? k === key : k.test(key)))) {
      const value = headers.get(key);
      if (typeof value === "string") {
        picked.set(key, value);
      }
    }
  }
  return picked;
};

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

export default async (request: Request, context: Context) => {
  // --- 添加强制日志 ---
  console.log("--- PROXY FUNCTION V4 (with direct duplex) EXECUTING ---");
  // --- 日志结束 ---

  if (request.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }

  const { pathname, searchParams } = new URL(request.url);
  console.log(`Handling ${request.method} request for path: ${pathname}`);

  if(pathname === "/") {
    // ... (根路径的 HTML 响应保持不变) ...
    console.log("Serving root HTML page");
    // ... (HTML content) ...
    return new Response(blank_html, { /* ... headers ... */ });
  }

  const url = new URL(pathname, "https://generativelanguage.googleapis.com");
  searchParams.delete("_path");

  searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = pickHeaders(request.headers, ["content-type", "authorization", "x-goog-api-client", "x-goog-api-key", "accept-encoding"]);
  console.log("Forwarding headers:", Object.fromEntries(headers.entries())); // Log forwarded headers

  try {
    // --- 修改 fetch 调用 ---
    console.log("Preparing fetch to Google API...");
    const response = await fetch(url, {
      method: request.method,
      headers: headers,
      body: request.body, // 直接传递 body
      // @ts-ignore
      duplex: 'half' // 直接强制添加 duplex
    });
    // --- 修改结束 ---

    console.log(`Received response from Google API with status: ${response.status}`);

    const responseHeaders = { ...CORS_HEADERS };
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    console.log("Forwarding response back to client.");
    return new Response(response.body, {
      headers: responseHeaders,
      status: response.status
    });

  } catch (error) {
    // --- 添加错误捕获日志 ---
    console.error("!!! Error during fetch to Google API or processing response:", error);
    // 返回一个更明确的错误给客户端，而不是依赖默认的 502
    return new Response(JSON.stringify({ error: "Proxy failed", details: error.message }), {
      status: 500, // 使用 500 Internal Server Error 可能更合适
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
    // --- 错误捕获结束 ---
  }
};

// 确保 pickHeaders 函数定义完整
