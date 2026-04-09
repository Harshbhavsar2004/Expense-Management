"use client";

import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";

interface Toolkit {
  id: string;
  name: string;
  description: string;
  logo: string;
}

const AVAILABLE_TOOLKITS: Toolkit[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Read and send emails",
    logo: "https://cdn.simpleicons.org/gmail",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team communication",
    logo: "https://imgs.search.brave.com/pGdG8jEhf6aGVlN4KeLJdYGa6lYlmPzvssQfCbQUlY4/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWcu/aWNvbnM4LmNvbS9l/eHRlcm5hbC10aG9z/ZS1pY29ucy1mbGF0/LXRob3NlLWljb25z/LzEyMDAvZXh0ZXJu/YWwtU2xhY2stTG9n/by1zb2NpYWwtbWVk/aWEtdGhvc2UtaWNv/bnMtZmxhdC10aG9z/ZS1pY29ucy5qcGc",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Manage schedules",
    logo: "https://cdn.simpleicons.org/googlecalendar",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Code & repositories",
    logo: "https://cdn.simpleicons.org/github",
  },
  {
    id: "zoho_desk",
    name: "Zoho Desk",
    description: "Customer support",
    logo: "https://cdn.simpleicons.org/zoho",
  },
  {
    id: "zoho_invoice",
    name: "Zoho Invoice",
    description: "Billing & invoicing",
    logo: "https://cdn.simpleicons.org/zoho",
  },
];

export default function IntegrationsPage() {
  const [connectedToolkits, setConnectedToolkits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/connectors/status");
      const data = await res.json();
      if (data.connected_toolkits) {
        setConnectedToolkits(data.connected_toolkits);
      }
    } catch (err) {
      console.error("Failed to fetch integration status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async (toolkitId: string) => {
    setProcessing(toolkitId);
    try {
      const res = await fetch("/api/connectors/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit: toolkitId }),
      });
      const data = await res.json();

      if (data.connection_url) {
        const width = 600,
          height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          data.connection_url,
          "Connect Integration",
          `width=${width},height=${height},left=${left},top=${top}`
        );

        const timer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(timer);
            fetchStatus();
            setProcessing(null);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Connection failed:", err);
      setProcessing(null);
    }
  };

  const handleDisconnect = async (toolkitId: string) => {
    if (!confirm(`Disconnect ${toolkitId}?`)) return;
    setProcessing(toolkitId);

    try {
      await fetch("/api/connectors/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit: toolkitId }),
      });

      await fetchStatus();
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setProcessing(null);
    }
  };

  const filteredToolkits = AVAILABLE_TOOLKITS.filter((toolkit) =>
    toolkit.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Integrations
          </h1>
          <p className="text-sm text-slate-500">
            Connect tools to power your workflows
          </p>
        </div>

        {/* SEARCH */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
      </header>

      {/* LOADING */}
      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredToolkits.map((toolkit) => {
            const isConnected = connectedToolkits.some((t) =>
              t.toLowerCase().includes(toolkit.id.toLowerCase())
            );

            const isBusy = processing === toolkit.id;

            return (
              <div
                key={toolkit.id}
                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition"
              >
                {/* LEFT */}
                <div className="flex items-center gap-3">
                  <img
                    src={toolkit.logo}
                    alt={toolkit.name}
                    className="w-10 h-10 object-contain rounded-md"
                  />

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {toolkit.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {toolkit.description}
                    </p>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <span className="text-[10px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 font-semibold">
                        Connected
                      </span>

                      <button
                        disabled={isBusy}
                        onClick={() =>
                          handleDisconnect(toolkit.id)
                        }
                        className="px-3 py-1 text-xs font-medium text-rose-600 border border-rose-200 rounded-md hover:bg-rose-50"
                      >
                        {isBusy ? "..." : "Disconnect"}
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={isBusy}
                      onClick={() =>
                        handleConnect(toolkit.id)
                      }
                      className="px-3 py-1 text-xs font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700"
                    >
                      {isBusy ? "..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
