import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import { Toaster } from "sonner";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { Geist, Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Expify Agent — Intelligent Expense Management",
  description: "AI-powered expense management platform by Fristine Infotech",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable, interHeading.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <CopilotKit
          runtimeUrl="/api/copilotkit"
          agent="chatbot_agent"
          publicApiKey="ck_pub_5ac7c0884dd7ef9667459b5233319710"
          showDevConsole={false}
        >
          {children}
        </CopilotKit>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
