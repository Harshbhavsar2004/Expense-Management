import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";
 
// 1. You can use any service adapter here for multi-agent support. We use
//    the empty adapter since we're only using one agent.
const serviceAdapter = new ExperimentalEmptyAdapter();
 
// 2. Create the CopilotRuntime instance and utilize the AG-UI client
//    to setup the connection with the ADK agent.
const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

const agents: Record<string, any> = {
    "refiner_agent":  new HttpAgent({url: `${agentUrl}/refine/`}),
    // audit_agent points to local Python /audit/
    "audit_agent":    new HttpAgent({url: `${agentUrl}/audit/`}),
    // vision_agent maps to /vision-agent/ for image extraction
    "vision_agent":    new HttpAgent({url: `${agentUrl}/vision-agent/`}),
    // chatbot_agent for WhatsApp style interactions
    "chatbot_agent":     new HttpAgent({url: `${agentUrl}/chatbot_agent/`}),
    // enterprise_agent provides generalized knowledge & actions across Frestine
    "enterprise_agent":  new HttpAgent({url: `${agentUrl}/enterprise_agent/`}),
};

const runtime = new CopilotRuntime({
  agents: agents
});
 
// 3. Build a Next.js API route that handles the CopilotKit runtime requests.
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime, 
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
 
  return handleRequest(req);
};