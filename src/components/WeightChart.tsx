import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { toDisplayWeight } from '../models/hallModel';
import type { ModelResult, DayLog } from '../models/hallModel';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface WeightChartProps {
  results: ModelResult[];
  logs: DayLog[];
  units: 'metric' | 'imperial';
}

const WeightChart: React.FC<WeightChartProps> = ({ results, logs, units }) => {
  const labels = results.map(r => `Day ${r.day}`);
  const unitLabel = units === 'metric' ? 'kg' : 'lbs';
  
  const data = {
    labels,
    datasets: [
      {
        label: `Predicted Weight (${unitLabel})`,
        data: results.map(r => toDisplayWeight(r.predictedWeightKg, units)),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
        fill: false,
        pointRadius: 0,
      },
      {
        label: 'High Estimate',
        data: results.map(r => toDisplayWeight(r.highEstWeightKg, units)),
        borderColor: 'rgba(59, 130, 246, 0.1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointRadius: 0,
        fill: '+1',
        tension: 0.1,
      },
      {
        label: 'Low Estimate',
        data: results.map(r => toDisplayWeight(r.lowEstWeightKg, units)),
        borderColor: 'rgba(59, 130, 246, 0.1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointRadius: 0,
        fill: false,
        tension: 0.1,
      },
      {
        label: `Actual Weight (${unitLabel})`,
        data: results.map(r => {
          const log = logs.find(l => l.day === r.day);
          return log ? toDisplayWeight(log.weightKg, units) : null;
        }),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        pointRadius: 4,
        showLine: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(1)} ${unitLabel}`
        }
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: unitLabel,
          font: { size: 10, weight: 'bold' }
        },
        ticks: {
          font: { size: 10 }
        }
      },
      x: {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          font: { size: 10 }
        }
      }
    },
  };

  return (
    <div className="w-full h-48 md:h-64">
      <Line options={options} data={data} />
    </div>
  );
};

export default WeightChart;
