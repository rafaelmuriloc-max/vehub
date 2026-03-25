import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Fiscal() {
  const monitorUrl = "https://app.monitorcontabil.com.br/";

  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-end px-4 py-2 shrink-0">
        <Button variant="outline" size="sm" asChild>
          <a href={monitorUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir em nova aba
          </a>
        </Button>
      </div>
      <iframe
        src={monitorUrl}
        className="w-full flex-1 border-0 rounded-lg"
        allow="clipboard-write"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer-when-downgrade"
        title="Monitor Contábil"
      />
    </div>
  );
}
