import { createAppServer } from "../../backend/services/api-gateway/src/index.ts";

const port = Number(process.env.PORT ?? 4300);
const server = createAppServer();
server.listen(port, () => {
  console.log(`gateway on ${port}`);
});