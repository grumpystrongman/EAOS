import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ServiceDescriptor } from "@eaos/contracts";

export const descriptor: ServiceDescriptor = {
  serviceName: "secrets-broker",
  listeningPort: 3014,
  purpose: "Short-lived credential leasing and rotation events",
  securityTier: "regulated",
  requiresMTLS: true,
  requiresTenantContext: true,
  defaultDeny: true
};

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: descriptor.serviceName }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found", service: descriptor.serviceName }));
});

server.listen(descriptor.listeningPort, () => {
  console.log(descriptor.serviceName + " listening on :" + descriptor.listeningPort);
});