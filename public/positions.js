const PERIODS = ['1D', '1W', '1M', 'YTD', '1Y'];
const selectedPeriods = new Map();
const histories = new Map();
let lastSignature = '';

const money = value => Number.isFinite(Number(value))
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
  : '—';
const date = value => value
  ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  : '—';
const signedMoney = value => `${Number(value) >= 0 ? '+' : '−'}${money(Math.abs(Number(value) || 0))}`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function sparkline(points, positive) {
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 220;
  const height = 72;
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index / (values.length - 1) * width;
    const y = height - 5 - (value - min) / range * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const colour = positive ? '#16834b' : '#c53b36';
  return `<svg class="position-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Price history chart"><polyline points="${coords}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" /></svg>`;
}

async function loadHistory(instrumentId, period, chart) {
  const key = `${instrumentId}:${period}`;
  chart.innerHTML = '<p class="chart-loading">Loading market history…</p>';
  try {
    if (!histories.has(key)) {
      const response = await fetch(`/api/market-history?instrumentId=${encodeURIComponent(instrumentId)}&period=${period}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Price history unavailable.');
      histories.set(key, data);
    }
    const data = histories.get(key);
    const positive = Number(data.change) >= 0;
    const percent = Number.isFinite(Number(data.changePercent)) ? `${positive ? '+' : '−'}${Math.abs(Number(data.changePercent)).toFixed(2)}%` : '—';
    chart.innerHTML = `${sparkline(data.points, positive)}<div class="chart-caption ${positive ? 'positive' : 'negative'}"><strong>${percent}</strong><span>${signedMoney(data.change)} · ${period}</span></div>`;
  } catch (error) {
    chart.innerHTML = `<p class="chart-error">${escapeHtml(error.message)}</p>`;
  }
}

function positionCard(position) {
  const instrumentId = String(position.instrumentId);
  const period = selectedPeriods.get(instrumentId) || '1M';
  const pnl = Number(position.unrealizedPnl || 0);
  const positive = pnl >= 0;
  const card = document.createElement('article');
  card.className = `position-market-card ${positive ? 'gain' : 'loss'}`;
  card.dataset.instrumentId = instrumentId;
  const symbol = escapeHtml(position.symbol || `Instrument ${instrumentId}`);
  const company = escapeHtml(position.name && position.name !== position.symbol ? position.name : 'Company name unavailable');
  const pnlPercent = position.initialAmount ? pnl / Number(position.initialAmount) * 100 : null;
  card.innerHTML = `
    <div class="position-card-head">
      <div class="position-identity"><strong>${symbol}</strong><span>${company}</span></div>
      <div class="position-pnl ${positive ? 'positive' : 'negative'}"><strong>${positive ? 'GAIN' : 'LOSS'} ${signedMoney(pnl)}</strong><span>${pnlPercent === null ? '—' : `${pnlPercent >= 0 ? '+' : '−'}${Math.abs(pnlPercent).toFixed(2)}%`}</span></div>
    </div>
    <div class="position-values">
      <span>Initial <strong>${money(position.initialAmount ?? position.amount)}</strong></span>
      <span>Current <strong>${money(position.currentValue)}</strong></span>
      <span>Last price <strong>${position.closeRate ?? '—'}</strong></span>
    </div>
    <div class="position-chart" aria-live="polite"></div>
    <div class="chart-periods" role="group" aria-label="Chart period">
      ${PERIODS.map(item => `<button type="button" data-period="${item}" aria-pressed="${item === period}">${item}</button>`).join('')}
    </div>
    <small>${position.isBuy === false ? 'Short (CLOSE / SELL)' : 'Long (BUY / TRADE)'} · Opened ${date(position.openedAt)} · Valued ${date(position.valuationAt)}</small>`;
  const chart = card.querySelector('.position-chart');
  card.querySelector('.chart-periods').addEventListener('click', event => {
    const button = event.target.closest('button[data-period]');
    if (!button) return;
    const next = button.dataset.period;
    selectedPeriods.set(instrumentId, next);
    card.querySelectorAll('.chart-periods button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    loadHistory(instrumentId, next, chart);
  });
  loadHistory(instrumentId, period, chart);
  return card;
}

async function renderPositions(force = false) {
  const dashboard = document.getElementById('positions-dashboard');
  const summary = document.getElementById('positions-summary');
  if (!dashboard || !summary) return;
  try {
    const response = await fetch('/api/state');
    if (!response.ok) return;
    const state = await response.json();
    const positions = state.portfolio?.positions || [];
    const signature = JSON.stringify(positions.map(position => [position.positionId, position.symbol, position.name, position.currentValue, position.unrealizedPnl, position.valuationAt]));
    if (!force && signature === lastSignature && dashboard.dataset.microcharts === 'true') return;
    lastSignature = signature;
    const initial = positions.reduce((sum, position) => sum + Number(position.initialAmount ?? position.amount ?? 0), 0);
    const current = positions.reduce((sum, position) => sum + Number(position.currentValue ?? position.initialAmount ?? position.amount ?? 0), 0);
    const pnl = positions.reduce((sum, position) => sum + Number(position.unrealizedPnl ?? 0), 0);
    summary.textContent = positions.length ? `Initial ${money(initial)} · Current ${money(current)} · Unrealised ${signedMoney(pnl)} · ${initial ? `${pnl >= 0 ? '+' : '−'}${Math.abs(pnl / initial * 100).toFixed(2)}%` : '—'}` : 'No open direct positions reported by eToro.';
    dashboard.replaceChildren(...positions.map(positionCard));
    dashboard.dataset.microcharts = 'true';
  } catch {}
}

const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = '/positions.css';
document.head.append(stylesheet);
document.addEventListener('click', event => {
  if (event.target.closest('#positions-tab')) setTimeout(() => renderPositions(true), 50);
  if (event.target.closest('#refresh')) setTimeout(() => renderPositions(true), 800);
});
setTimeout(() => renderPositions(true), 1200);
setInterval(() => renderPositions(), 10000);

function watchDashboard() {
  const dashboard = document.getElementById('positions-dashboard');
  if (!dashboard) {
    setTimeout(watchDashboard, 250);
    return;
  }
  new MutationObserver(() => {
    if (dashboard.children.length && !dashboard.querySelector('.position-market-card')) {
      setTimeout(() => renderPositions(true), 30);
    }
  }).observe(dashboard, { childList: true });
}

watchDashboard();
