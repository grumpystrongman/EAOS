import { createAppServer } from "../../dist/services/tool-registry/src/index.js";

const port = Number(process.env.PORT ?? 4301);
const server = createAppServer();
server.listen(port, () => {
  console.log(`tool-registry on ${port}`);
});
