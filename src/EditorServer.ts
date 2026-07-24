import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as url from "url";

let lastRequestTime = Date.now();

/** 获取最后一次请求时间（供外部调用，避免值拷贝问题） */
function getLastRequestTime(): number {
  return lastRequestTime;
}

function createServer(webDir: string, workspaceFolder: string, port: number) {
  return http.createServer((req, res) => {
    const reqUrl = url.parse(req.url!, true);
    const pathname = reqUrl.pathname!;
    const origin = req.headers.origin ?? "*";

    // CORS（允许网页跨域请求）
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (pathname === "/ping") {
      // 心跳端点：前端每2秒发送一次，用于检测页面是否仍在开启
      lastRequestTime = Date.now();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/blocks" && req.method === "GET") {
      // 读取 CustomCommand.json
      const filePath = path.join(workspaceFolder, "CustomCommand.json");
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          // 文件不存在，返回空结构
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ blocks: [] }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(data);
        }
      });
    } else if (pathname === "/blocks" && req.method === "POST") {
      // 保存 CustomCommand.json
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const filePath = path.join(workspaceFolder, "CustomCommand.json");
        fs.writeFile(filePath, body, "utf8", (err) => {
          if (err) {
            console.error("Save failed:", err);
            res.writeHead(500);
            res.end("Save failed");
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          }
        });
      });
    } else {
      // 静态文件服务
      serveStaticFile(webDir, pathname, res);
    }
    lastRequestTime = Date.now();
  });
}

function serveStaticFile(
  root: string,
  pathname: string,
  res: http.ServerResponse,
) {
  let filePath =
    pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  filePath = path.join(root, filePath);

  // 安全检查
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime =
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
    }[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
    } else {
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    }
  });
}
// 导出类和函数以便在其他文件中使用
export { createServer, getLastRequestTime };
