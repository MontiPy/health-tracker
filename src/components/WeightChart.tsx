import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartOptions, Plugin } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { toDisplayWeight } from '../models/hallModel';
import type { ModelResult, DayLog } from '../models/hallModel';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface WeightChartProps {
  results:   ModelResult[];
  logs:      DayLog[];
  units:     'metric' | 'imperial';
  startDate?: Date;
  goalDay?:  number;
}

function dayLabel(day: number, start?: Date): string {
  if (!start) return `D${day}`;
  const d = new Date(start);
  d.setDate(d.getDate() + day);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ── inline plugin: vertical dashed line at goalDay ──────────────────────── */
const goalLinePlugin: Plugin<'line'> = {
  id: 'goalLine',
  afterDraw(chart, _args, opts: Record<string, unknown>) {
    const xIndex = opts.xIndex as number | undefined;
    if (xIndex == null || xIndex < 0) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(xIndex);
    if (x < chartArea.left || x > chartArea.right) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth   = 1.5;
    ctx.strokeStyle = 'rgba(13, 148, 136, 0.45)';
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    // Label at top
    ctx.setLineDash([]);
    ctx.font      = '700 10px "Space Mono", monospace';
    ctx.fillStyle = 'rgb(13, 148, 136)';
    ctx.textAlign = 'center';
    ctx.fillText('Goal', x, chartArea.top + 11);
    ctx.restore();
  },
};

const TEAL    = 'rgb(13, 148, 136)';
const TEAL_0  = 'rgba(13, 148, 136, 0)';
const TEAL_08 = 'rgba(13, 148, 136, 0.09)';
const RED     = 'rgb(239, 68, 68)';

const WeightChart: React.FC<WeightChartProps> = ({ results, logs, units, startDate, goalDay }) => {
  const unitLabel = units === 'metric' ? 'kg' : 'lbs';
  const labels    = results.map(r => dayLabel(r.day, startDate));

  const data = {
    labels,
    datasets: [
      {
        label:           'High Estimate',
        data:            results.map(r => toDisplayWeight(r.highEstWeightKg, units)),
        borderColor:     TEAL_0,
        backgroundColor: TEAL_08,
        pointRadius:     0,
        fill:            '+1',
        tension:         0.4,
        borderWidth:     0,
      },
      {
        label:           `Predicted (${unitLabel})`,
        data:            results.map(r => toDisplayWeight(r.predictedWeightKg, units)),
        borderColor:     TEAL,
        backgroundColor: 'transparent',
        tension:         0.4,
        fill:            false,
        pointRadius:     0,
        borderWidth:     2.5,
      },
      {
        label:           'Low Estimate',
        data:            results.map(r => toDisplayWeight(r.lowEstWeightKg, units)),
        borderColor:     TEAL_0,
        backgroundColor: TEAL_08,
        pointRadius:     0,
        fill:            '-1',
        tension:         0.4,
        borderWidth:     0,
      },
      {
        label:           `Actual (${unitLabel})`,
        data:            results.map(r => {
          const log = logs.find(l => l.day === r.day);
          return log ? toDisplayWeight(log.weightKg, units) : null;
        }),
        borderColor:     RED,
        backgroundColor: RED,
        pointRadius:     5,
        pointHoverRadius: 7,
        showLine:        false,
        borderWidth:     0,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend:   { display: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(({ goalLine: { xIndex: goalDay ?? -1 } }) as any),
      tooltip:  {
        mode:      'index',
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        titleColor:      '#94a3b8',
        bodyColor:       '#f1f5f9',
        titleFont:       { size: 10, family: 'Space Mono' },
        bodyFont:        { size: 11, family: 'Space Mono' },
        padding:         10,
        cornerRadius:    10,
        callbacks: {
          title: items => items[0]?.label ?? '',
          label: ctx => {
            if (ctx.parsed.y === null) return '';
            const lbl = ctx.dataset.label ?? '';
            if (lbl.startsWith('High') || lbl.startsWith('Low')) return '';
            return `  ${lbl}: ${Number(ctx.parsed.y).toFixed(1)} ${unitLabel}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid:   { color: 'rgba(15, 23, 42, 0.04)' },
        border: { display: false },
        ticks:  { font: { size: 10, family: 'Space Mono' }, color: '#94a3b8', callback: v => `${Number(v).toFixed(0)}` },
      },
      x: {
        grid:   { display: false },
        border: { display: false },
        ticks:  { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { size: 10, family: 'Space Mono' }, color: '#94a3b8' },
      },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  return (
    <div className="w-full h-52">
      <Line plugins={[goalLinePlugin]} options={options} data={data} />
    </div>
  );
};

export default WeightChart;
