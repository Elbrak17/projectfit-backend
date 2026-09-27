import { buildApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildApp();
app.listen({ port, host }).then(() => {
  console.log(`ProjectFit backend listening on http://${host}:${port}`);
});
