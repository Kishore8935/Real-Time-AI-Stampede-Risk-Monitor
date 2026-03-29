import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

function riskLevel(score) {
  if (score >= 75) return 'high'
  if (score >= 50) return 'mid'
  return 'low'
}

const NUM_COLOR = { low: 'var(--color-green)', mid: 'var(--color-orange)', high: 'var(--color-red)' }
const GAUGE_COLOR = {
  low: 'from-[#16a34a] to-[var(--color-green)]',
  mid: 'from-[#ea580c] to-[var(--color-orange)]',
  high: 'from-[#b91c1c] to-[var(--color-red)]',
}

export default function RiskScoreCard({ score, history }) {
  const level = riskLevel(score)
  const chartData = history.map((v, i) => ({ i, v }))

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-dim)] mb-2.5">
        Risk Score
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[2.6rem] font-semibold leading-none transition-colors"
          style={{ color: NUM_COLOR[level] }}>
          {score}
        </span>
        <span className="text-[0.74rem] text-[var(--color-text-dim)]">/ 100</span>
      </div>

      {/* Gauge bar */}
      <div className="h-2 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden mt-3">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-400 ${GAUGE_COLOR[level]}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Timeline chart */}
      {chartData.length > 1 && (
        <div className="mt-3.5 h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone" dataKey="v"
                stroke={NUM_COLOR[level]} strokeWidth={2} dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.70rem' }}
                formatter={v => [`${v}`, 'Risk']}
                labelFormatter={() => ''}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
