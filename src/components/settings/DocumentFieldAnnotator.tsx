import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, Trash2, MousePointer2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface FieldRegion {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegionExtractionConfig {
  cnpj_region?: FieldRegion | null;
  company_name_region?: FieldRegion | null;
  reference_month_region?: FieldRegion | null;
  obligation_type_region?: FieldRegion | null;
}

const FIELDS = [
  { key: 'cnpj_region' as const, label: 'CNPJ', color: 'hsl(210, 80%, 55%)' },
  { key: 'company_name_region' as const, label: 'Nome da Empresa', color: 'hsl(145, 65%, 42%)' },
  { key: 'reference_month_region' as const, label: 'Competência', color: 'hsl(30, 90%, 55%)' },
  { key: 'obligation_type_region' as const, label: 'Tipo de Obrigação', color: 'hsl(280, 65%, 55%)' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | string;
  extractionConfig: RegionExtractionConfig;
  onSave: (config: RegionExtractionConfig) => void;
}

export function DocumentFieldAnnotator({ open, onOpenChange, file, extractionConfig, onSave }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeField, setActiveField] = useState<keyof RegionExtractionConfig | null>(null);
  const [regions, setRegions] = useState<RegionExtractionConfig>({});
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pdfSource, setPdfSource] = useState<string | File | null>(null);
  const [pageWidth, setPageWidth] = useState(700);

  useEffect(() => {
    if (open) {
      setRegions(extractionConfig || {});
      setCurrentPage(1);
      setActiveField(null);
      if (typeof file === 'string') {
        setPdfSource(file);
      } else {
        setPdfSource(file);
      }
    }
  }, [open, file, extractionConfig]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  function getRelativePos(e: React.MouseEvent) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!activeField) return;
    const pos = getRelativePos(e);
    if (!pos) return;
    setDrawing(true);
    setStartPos(pos);
    setCurrentRect(null);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!drawing || !startPos) return;
    const pos = getRelativePos(e);
    if (!pos) return;
    const x = Math.min(startPos.x, pos.x);
    const y = Math.min(startPos.y, pos.y);
    const w = Math.abs(pos.x - startPos.x);
    const h = Math.abs(pos.y - startPos.y);
    setCurrentRect({ x, y, w, h });
  }

  function handleMouseUp() {
    if (!drawing || !startPos || !currentRect || !activeField) {
      setDrawing(false);
      setStartPos(null);
      return;
    }
    if (currentRect.w > 0.5 && currentRect.h > 0.5) {
      setRegions(prev => ({
        ...prev,
        [activeField]: {
          page: currentPage,
          x: currentRect.x,
          y: currentRect.y,
          width: currentRect.w,
          height: currentRect.h,
        },
      }));
    }
    setDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  }

  function clearField(key: keyof RegionExtractionConfig) {
    setRegions(prev => ({ ...prev, [key]: null }));
  }

  function handleSave() {
    onSave(regions);
    onOpenChange(false);
  }

  function renderRegionBoxes() {
    return FIELDS.map(f => {
      const region = regions[f.key];
      if (!region || region.page !== currentPage) return null;
      return (
        <div
          key={f.key}
          className="absolute border-2 pointer-events-none"
          style={{
            borderColor: f.color,
            backgroundColor: f.color.replace(')', ', 0.15)').replace('hsl(', 'hsla('),
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.width}%`,
            height: `${region.height}%`,
          }}
        >
          <span
            className="absolute -top-5 left-0 text-[10px] font-bold px-1 rounded text-white whitespace-nowrap"
            style={{ backgroundColor: f.color }}
          >
            {f.label}
          </span>
        </div>
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
        <div className="flex flex-1 min-h-0">
          {/* PDF area */}
          <div className="flex-1 flex flex-col min-w-0 bg-muted/30">
            {/* Page nav */}
            <div className="flex items-center justify-center gap-3 py-2 border-b bg-background">
              <Button size="icon" variant="ghost" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {numPages || '...'}
              </span>
              <Button size="icon" variant="ghost" disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* PDF + overlay */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-4">
              <div className="relative inline-block" style={{ cursor: activeField ? 'crosshair' : 'default' }}>
                {pdfSource && (
                  <Document file={pdfSource} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="p-8 text-muted-foreground">Carregando PDF...</div>}>
                    <Page
                      pageNumber={currentPage}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                )}
                {/* Drawing overlay */}
                <div
                  ref={overlayRef}
                  className="absolute inset-0"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { if (drawing) handleMouseUp(); }}
                >
                  {renderRegionBoxes()}
                  {currentRect && activeField && (
                    <div
                      className="absolute border-2 border-dashed pointer-events-none"
                      style={{
                        borderColor: FIELDS.find(f => f.key === activeField)?.color || '#888',
                        left: `${currentRect.x}%`,
                        top: `${currentRect.y}%`,
                        width: `${currentRect.w}%`,
                        height: `${currentRect.h}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="w-72 border-l bg-background flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Campos de Extração</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um campo e desenhe um retângulo sobre a área correspondente no documento.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2">
              {FIELDS.map(f => {
                const isActive = activeField === f.key;
                const hasRegion = !!regions[f.key];
                return (
                  <div key={f.key} className="rounded-md border p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <button
                        className={`flex items-center gap-2 text-sm font-medium transition-colors rounded px-2 py-1 ${isActive ? 'ring-2 ring-offset-1' : 'hover:bg-muted'}`}
                        style={{
                          color: f.color,
                          boxShadow: isActive ? `0 0 0 2px ${f.color}` : undefined,
                        }}
                        onClick={() => setActiveField(isActive ? null : f.key)}
                      >
                        <MousePointer2 className="h-3.5 w-3.5" />
                        {f.label}
                      </button>
                      {hasRegion && (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => clearField(f.key)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-2">
                      {hasRegion ? (
                        <span className="text-primary">✓ Área marcada (pág. {regions[f.key]!.page})</span>
                      ) : (
                        <span>Não configurado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t">
              <Button className="w-full" onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" />
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
