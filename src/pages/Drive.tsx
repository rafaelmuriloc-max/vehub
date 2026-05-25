import { DriveBrowser } from '@/components/drive/DriveBrowser';

export default function Drive() {
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] -m-4 sm:-m-6">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
        <h1 className="text-xl sm:text-2xl font-bold">Google Drive</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Arquivos da conta do escritório</p>
      </div>
      <div className="flex-1 min-h-0">
        <DriveBrowser mode="manage" />
      </div>
    </div>
  );
}