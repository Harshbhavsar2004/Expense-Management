import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import { Toaster } from "sonner";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Expify Agent — Intelligent Expense Management",
  description: "AI-powered expense management platform by Fristine Infotech",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", poppins.variable)}>
      <body className="antialiased font-sans">
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
