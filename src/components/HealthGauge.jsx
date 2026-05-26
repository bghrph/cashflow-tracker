import React from 'react';

function scoreColor(score) {
  if (score >= 80) return 'var(--positive)';
  if (score >= 60) return 'var(--accent-2)';
  if (score >= 40) return '#F97316';
  return 'var(--negative)';
}

function scoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}

export default function HealthGauge({ score = 0 }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="health-gauge">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle
            className="track"
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            strokeWidth="10"
          />
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <div className="health-gauge-center">
          <div className="health-gauge-value" style={{ color }}>
            {score}
          </div>
          <div className="health-gauge-label">{scoreLabel(score)}</div>
        </div>
      </div>
    </div>
  );
}
