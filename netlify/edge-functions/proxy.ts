TYPESCRIPT
import { Context } from "@netlify/edge-functions";

const pickHeaders = (headers: Headers, keys: (string | RegExp)[]): Headers => {
  // ... (pickHeaders 函数保持不变) ...
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

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }

  const { pathname, searchParams } = new URL(request.url);
  if(pathname === "/") {
    // ... (根路径的 HTML 响应保持不变) ...
    let blank_html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Google PaLM API proxy on Netlify Edge</title>
</head>
<body>
  <h1 id="google-palm-api-proxy-on-netlify-edge">Google PaLM API proxy on Netlify Edge</h1>
  <p>Tips: This project uses a reverse proxy to solve problems such as location restrictions in Google APIs. </p>
  <p>If you have any of the following requirements, you may need the support of this project.</p>
  <ol>
  <li>When you see the error message &quot;User location is not supported for the API use&quot; when calling the Google PaLM API</li>
  <li>You want to customize the Google PaLM API</li>
  </ol>
  <p>For technical discussions, please visit <a href="https://simonmy.com/posts/google-palm-api-proxy-on-netlify-edge.html">https://simonmy.com/posts/google-palm-api-proxy-on-netlify-edge.html</a></p>
</body>
</html>
    `
    return new Response(blank_html, {
      headers: {
        ...CORS_HEADERS,
        "content-type": "text/html"
      },
    });
  }

  const url = new URL(pathname, "https://generativelanguage.googleapis.com");
  searchParams.delete("_path");

  searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = pickHeaders(request.headers, ["content-type", "authorization", "x-goog-api-client", "x-goog-api-key", "accept-encoding"]);

  // --- 修改开始 ---
  // 构建 fetch 选项
  const fetchOptions: RequestInit = {
    method: request.method,
    headers: headers,
    // 只有当请求方法不是 GET 或 HEAD 时才传递 body 和 duplex
    // (理论上 Gemini API 主要是 POST，但这样写更健壮)
    body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : undefined,
  };

  // 如果有 body，则添加 duplex 选项
  if (fetchOptions.body) {
    // @ts-ignore // 某些旧的 TS 定义可能不认识 duplex，忽略类型检查
    fetchOptions.duplex = 'half';
  }

  // 使用构建好的选项进行 fetch
  const response = await fetch(url, fetchOptions);
  // --- 修改结束 ---


  const responseHeaders = {
    ...CORS_HEADERS,
    // 需要从 response.headers 迭代创建对象，而不是直接扩展
    // 因为 response.headers 不是一个简单的 JS 对象
  };
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });


  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status
  });
};

// 确保你的 pickHeaders 函数定义在这里或在上面
