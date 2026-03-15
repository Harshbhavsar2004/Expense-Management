import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "Expify Agent — Intelligent Expense Management",
  description: "AI-powered expense management platform by Fristine Infotech",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          agent="chatbot_agent"
          publicApiKey="ck_pub_5ac7c0884dd7ef9667459b5233319710"
        >
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
