import { describe, it, expect } from 'vitest';

describe('Analytics Calculations & Metrics Accuracy', () => {
  it('correctly calculates average uploads per active contributor using the active contributor denominator', () => {
    const totalSuccessfulUploads = 45;
    const activeContributorsCount = 15;
    const totalRegisteredUsers = 120;

    // Must divide by qualifying active contributors during the period, NOT silently by all registered accounts!
    const avgPerActiveContributor = totalSuccessfulUploads / activeContributorsCount;
    expect(avgPerActiveContributor).toBe(3.0);

    const avgPerRegisteredUser = totalSuccessfulUploads / totalRegisteredUsers;
    expect(avgPerRegisteredUser).toBe(0.375);

    expect(avgPerActiveContributor).not.toBe(avgPerRegisteredUser);
  });

  it('ranks monthly traffic to accurately identify the month with the highest recorded traffic', () => {
    const monthlyData = [
      { month: '2026-08', events: 1200, downloads: 400 },
      { month: '2026-09', events: 4500, downloads: 1800 }, // Peak (exam season)
      { month: '2026-10', events: 3100, downloads: 1100 },
    ];

    const sortedByTraffic = [...monthlyData].sort((a, b) => b.events - a.events);
    const peakMonth = sortedByTraffic[0].month;

    expect(peakMonth).toBe('2026-09');
    expect(sortedByTraffic[0].events).toBe(4500);
  });
});
