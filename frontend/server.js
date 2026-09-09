import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const port = Number(process.env.PORT || 8080);
const apiUrl = process.env.BACKEND_URL || 'http://backend:8080';
app.use('/api', createProxyMiddleware({ target: apiUrl, changeOrigin: true }));
app.use('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.use(express.static('public'));
app.listen(port, () => console.log(`Employee UI listening on ${port}`));
