import { describe, it, expect } from 'vitest';
import { maskCpf, trialStatus, vacationTone } from './portalPersonnel';

const today = new Date(2026, 9, 3); // 03/10/2026

describe('portal personnel', () => {
  it('masks CPF showing only last 3 digits', () => {
    expect(maskCpf('123.456.789-34')).toBe('***.***.*9-34');
    expect(maskCpf(null)).toBeNull();
  });
  it('trial in first period ending in 5 days is danger', () => {
    const s = trialStatus({ end1: '2026-10-08', days1: 45, end2: '2026-11-22', days2: 45 }, today);
    expect(s).toMatchObject({ kind: 'open', phase: 1, days: 5, tone: 'danger' });
  });
  it('trial after first period uses extension, 20 days is warning', () => {
    const s = trialStatus({ end1: '2026-09-01', days1: 45, end2: '2026-10-23', days2: 45 }, today);
    expect(s).toMatchObject({ kind: 'open', phase: 2, days: 20, tone: 'warning' });
  });
  it('trial ended 10 days ago is expired, 60 days ago is closed', () => {
    expect(trialStatus({ end1: '2026-09-23', days1: 90, end2: null, days2: null }, today).kind).toBe('expired');
    expect(trialStatus({ end1: '2026-08-04', days1: 90, end2: null, days2: null }, today).kind).toBe('closed');
  });
  it('vacation deadline within 60 days warns, past is danger', () => {
    expect(vacationTone('2026-11-20', false, today)).toBe('warning');
    expect(vacationTone('2026-09-01', false, today)).toBe('danger');
    expect(vacationTone('2026-09-01', true, today)).toBe('ok');
  });
});
