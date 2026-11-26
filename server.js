/**
 * AETHER 智能家居控制台 · Node + Express 本地静态服务器
 * 监听 0.0.0.0 以便同一局域网内的手机 / iPad 直接访问调试
 */
const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// 静态资源托管当前项目根目录，开发调试阶段关闭强缓存以便实时刷新生效
app.use(express.static(path.join(__dirname), {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

/** 获取本机所有可用的局域网 IPv4 地址 */
function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        list.push({ name, address: net.address });
      }
    }
  }
  return list;
}

app.listen(PORT, HOST, () => {
  console.log('\n========================================');
  console.log('AETHER 智能家居控制台静态服务器已启动');
  console.log(`本机访问:   http://localhost:${PORT}`);

  const lanList = getLanAddresses();
  if (lanList.length > 0) {
    lanList.forEach(({ name, address }) => {
      console.log(`局域网访问: http://${address}:${PORT}  (${name})`);
    });
  } else {
    console.log('未检测到局域网 IPv4 地址，请检查 Wi-Fi/网络连接');
  }
  console.log('========================================\n');
});
