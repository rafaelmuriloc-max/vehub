import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DriveBrowser, type DriveFile } from './DriveBrowser';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  multiple?: boolean;
  onPick: (files: DriveFile[]) => void;
}

export function DrivePickerDialog({ open, onOpenChange, multiple = true, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] h-[80vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Anexar do Google Drive</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <DriveBrowser mode="picker" multiple={multiple} onPick={onPick} onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}