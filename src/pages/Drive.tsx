import { DriveBrowser } from '@/components/drive/DriveBrowser';

export default function Drive() {
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] -m-4 sm:-m-6">
      <DriveBrowser mode="manage" />
    </div>
  );
}
