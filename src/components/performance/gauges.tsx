import { BarChart3 } from 'lucide-react';

export function GaugeArc({
  value,
  gradientId,
  strokeWidth = 16,
  showValue = false,
  valueFontSize = 24,
  viewBoxWidth = 220,
  viewBoxHeight = 110,
  cx = 110,
  cy = 105,
  radius = 90,
  change,
  changeFontSize = 13,
  pivotOffset,
  needleScale = 0.5,
}: {
  value: number;
  gradientId: string;
  strokeWidth?: number;
  showValue?: boolean;
  valueFontSize?: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  change?: number;
  changeFontSize?: number;
  pivotOffset?: number;
  needleScale?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const innerRadius = radius - strokeWidth / 2;
  const angleRad = Math.PI - (clamped * 1.8 * Math.PI) / 180;
  const hasChange = typeof change === 'number';
  const changeGap = hasChange ? changeFontSize * 1.5 : 0;
  const valueBaseline = cy - changeGap;
  const pivotY = valueBaseline - (pivotOffset ?? valueFontSize * 1.05);
  const needleLen = innerRadius * needleScale;
  const tipX = cx + needleLen * Math.cos(angleRad);
  const tipY = pivotY - needleLen * Math.sin(angleRad);
  const hubRadius = strokeWidth / 2.8;
  const baseHalf = strokeWidth / 5;
  const ux = Math.cos(angleRad);
  const uy = -Math.sin(angleRad);
  const px = -uy * baseHalf;
  const py = ux * baseHalf;
  const base1X = cx + px;
  const base1Y = pivotY + py;
  const base2X = cx - px;
  const base2Y = pivotY - py;
  const endX = cx + radius * Math.cos(angleRad);
  const endY = cy - radius * Math.sin(angleRad);
  return (
    <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E23B2E" />
          <stop offset="22%" stopColor="#F0722A" />
          <stop offset="45%" stopColor="#F5C518" />
          <stop offset="70%" stopColor="#B9D336" />
          <stop offset="100%" stopColor="#4CAF50" />
        </linearGradient>
        <linearGradient id={`${gradientId}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gradientId}-track-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${gradientId}-needle`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0%" stopColor="#3B5A8F" />
          <stop offset="55%" stopColor="#102A56" />
          <stop offset="100%" stopColor="#0B1E3E" />
        </radialGradient>
        <filter id={`${gradientId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={strokeWidth / 2.2} />
        </filter>
      </defs>
      {/* glow difuso colorido sob o arco preenchido */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={`url(#${gradientId})`}
        filter={`url(#${gradientId}-glow)`}
        opacity="0.55"
      />
      {/* trilha de vidro cinza claro */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="stroke-muted-foreground/20"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        strokeWidth={strokeWidth * 0.45}
        strokeLinecap="round"
        stroke={`url(#${gradientId}-track-gloss)`}
        transform={`translate(0 ${-strokeWidth / 4.2})`}
        opacity="0.8"
      />
      {/* arco colorido preenchido */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={`url(#${gradientId})`}
      />
      {/* reflexo de vidro no arco colorido */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
        fill="none"
        strokeWidth={strokeWidth * 0.45}
        strokeLinecap="round"
        stroke={`url(#${gradientId}-gloss)`}
        transform={`translate(0 ${-strokeWidth / 4.2})`}
      />
      {/* agulha azul-marinho com profundidade */}
      <path
        d={`M ${base1X} ${base1Y} L ${tipX} ${tipY} L ${base2X} ${base2Y} Z`}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={strokeWidth / 8}
        fill={`url(#${gradientId}-needle)`}
        stroke="#102A56"
      />
      <circle cx={cx} cy={pivotY} r={hubRadius} fill={`url(#${gradientId}-needle)`} stroke="#102A56" strokeWidth={strokeWidth / 10} />
      <circle cx={cx - hubRadius / 3} cy={pivotY - hubRadius / 3} r={hubRadius / 2.6} fill="#FFFFFF" opacity="0.45" />
      {showValue && (
        <text x={cx} y={valueBaseline} textAnchor="middle" dominantBaseline="auto" className="fill-calendar-navy font-calendarHeading font-bold" style={{ fontSize: valueFontSize }}>
          {clamped}%
        </text>
      )}
      {hasChange && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="auto" style={{ fontSize: changeFontSize }} className="font-semibold">
          <tspan className={change >= 0 ? 'fill-calendar-green' : 'fill-calendar-red'}>
            {change >= 0 ? `▲ +${change}%` : `▼ ${change}%`}
          </tspan>
          <tspan className="fill-muted-foreground font-normal" dx="6">vs. mês anterior</tspan>
        </text>
      )}
    </svg>
  );
}

export function DepartmentGauge({ name, value, change }: { name: string; value: number; change: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const gradientId = `gauge-dep-${name.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className="flex min-w-[300px] flex-1 flex-col items-center gap-1 rounded-md border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start gap-2.5 self-start">
        <BarChart3 className="mt-0.5 h-5 w-5 text-calendar-orange" />
        <p className="max-w-[230px] truncate font-calendarHeading text-lg font-bold text-calendar-navy">{name}</p>
      </div>
      <div className="relative h-[130px] w-[290px]" role="img" aria-label={`${name}: ${clamped}%`}>
        <GaugeArc
          value={clamped}
          gradientId={gradientId}
          strokeWidth={26}
          showValue
          valueFontSize={40}
          changeFontSize={13}
          change={change}
          viewBoxWidth={310}
          viewBoxHeight={150}
          cx={155}
          cy={144}
          radius={128}
          pivotOffset={48}
          needleScale={0.42}
        />
      </div>
    </div>
  );
}

export function OfficeGauge({ value, change }: { value: number; change: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-[130px] w-[300px] md:h-[150px] md:w-[360px]" role="img" aria-label={`Desempenho geral da operação: ${clamped}%`}>
      <GaugeArc
        value={clamped}
        gradientId="gauge-office"
        strokeWidth={28}
        showValue
        valueFontSize={46}
        changeFontSize={15}
        change={change}
        viewBoxWidth={340}
        viewBoxHeight={165}
        cx={170}
        cy={158}
        radius={140}
        pivotOffset={54}
        needleScale={0.42}
      />
    </div>
  );
}
