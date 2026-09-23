let journalState = null;

const journalMoney = value => Number.isFinite(Number(value))
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: Number(value) ? 'always' : 'auto' }).format(Number(value))
  : '—';
const journalDate = value => value
  ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  : '—';
const make = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const badge = (text, tone = 'neutral') => make('span', text, `learning-badge ${tone}`);

function latestAssessment(symbol) {
  for (const review of journalState?.reviews || []) {
    const assessment = (review.holdingAssessments || []).find(item => item.symbol === symbol);
    if (assessment) return { ...assessment, createdAt: review.createdAt };
  }
  return null;
}

async function journalPost(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-microsaver-token': journalState.token },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Journal update failed.');
  await loadJournal(true);
}

function holdingEntry(review, assessment) {
  const row = make('article', undefined, 'research-journal-entry holding-finding');
  const head = make('div', undefined, 'journal-entry-head');
  const identity = make('div');
  identity.append(make('strong', assessment.symbol), make('span', assessment.name || 'Company name unavailable'));
  const actionTone = assessment.action === 'STAY' ? 'positive' : assessment.action === 'SELL' ? 'negative' : 'warning';
  head.append(identity, badge(assessment.action, actionTone));
  row.append(head, make('p', assessment.summary, 'journal-rationale'), make('small', `Research finding · ${journalDate(review.createdAt)}`));
  return row;
}

function tradeEntry(trade) {
  const row = make('article', undefined, 'research-journal-entry trade-learning');
  const head = make('div', undefined, 'journal-entry-head');
  const identity = make('div');
  identity.append(make('strong', `${trade.symbol} · ${String(trade.transaction || '').toUpperCase()}`), make('span', `${String(trade.mode || '').toUpperCase()} · ${journalDate(trade.submittedAt)}`));
  const outcome = trade.recommendationOutcome || { label: 'Pending evidence', tone: 'neutral', reason: 'No result available.' };
  head.append(identity, badge(outcome.label, outcome.tone));
  row.append(head);

  const review = (journalState.reviews || []).find(item => item.id === trade.reviewId);
  const candidate = review?.candidates?.find(item => item.id === trade.candidateId);
  const rationale = trade.recommendation?.summary || candidate?.summary;
  if (rationale) row.append(make('p', `Why it was recommended: ${rationale}`, 'journal-rationale'));
  row.append(make('p', `Finding: ${outcome.reason}`, 'journal-finding'));

  const assessment = latestAssessment(trade.symbol);
  if (assessment) row.append(make('p', `Latest holding review — ${assessment.action}: ${assessment.summary}`, 'journal-latest'));
  if (trade.notes) row.append(make('p', `Learning recorded: ${trade.notes}`, 'journal-notes'));
  if (trade.status === 'closed') {
    row.append(make('small', `Closed ${journalDate(trade.closedAt)} · Realised ${journalMoney(trade.realizedPnl)}`));
  } else {
    const form = make('form', undefined, 'journal-outcome-form');
    const pnl = document.createElement('input');
    pnl.type = 'number'; pnl.step = '0.01'; pnl.required = true; pnl.placeholder = 'Realised P&L';
    const notes = document.createElement('input');
    notes.maxLength = 1000; notes.placeholder = 'What did the thesis, timing or catalyst teach us?';
    const button = make('button', 'Record closed outcome');
    form.append(pnl, notes, button);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      button.disabled = true;
      try { await journalPost('/api/trades/outcome', { tradeId: trade.id, realizedPnl: Number(pnl.value), notes: notes.value }); }
      catch (error) { button.disabled = false; row.append(make('p', error.message, 'journal-error')); }
    });
    row.append(form);
  }
  return row;
}

function renderJournal() {
  const root = document.getElementById('research-journal');
  if (!root || !journalState) return;
  const learning = journalState.learning || {};
  const summary = make('section', undefined, 'journal-metrics');
  for (const [label, value, tone] of [
    ['Submitted', learning.submitted || 0, 'neutral'],
    ['Good so far', learning.goodSoFar || 0, 'positive'],
    ['Needs review', learning.needsReview || 0, 'negative'],
    ['Closed wins', learning.wins || 0, 'positive'],
    ['Realised P&L', journalMoney(learning.realizedPnl || 0), Number(learning.realizedPnl) >= 0 ? 'positive' : 'negative'],
  ]) {
    const metric = make('div', undefined, `journal-metric ${tone}`);
    metric.append(make('span', label), make('strong', String(value)));
    summary.append(metric);
  }

  const explanation = make('p', 'Badges use matching eToro position performance: above +0.5% is Good so far, below −0.5% is Needs review, and results inside that band are Too early. Closed trades use recorded realised P&L.', 'journal-method');
  const holdingsHeading = make('h3', 'Current holding research');
  const holdings = make('div', undefined, 'journal-list');
  let assessmentCount = 0;
  for (const review of journalState.reviews || []) {
    for (const assessment of review.holdingAssessments || []) {
      holdings.append(holdingEntry(review, assessment));
      assessmentCount++;
      if (assessmentCount >= 20) break;
    }
    if (assessmentCount >= 20) break;
  }
  if (!assessmentCount) holdings.append(make('p', 'The next daily review will add a Stay, Trade, or Sell finding for every current holding.'));

  const tradesHeading = make('h3', 'Recommendations and outcomes');
  const trades = make('div', undefined, 'journal-list');
  for (const trade of [...(journalState.trades || [])].reverse()) trades.append(tradeEntry(trade));
  if (!journalState.trades?.length) trades.append(make('p', 'Submitted orders will appear here with their original rationale and later findings.'));
  root.replaceChildren(summary, explanation, holdingsHeading, holdings, tradesHeading, trades);
}

async function loadJournal(force = false) {
  const root = document.getElementById('research-journal');
  if (!root) return;
  try {
    const response = await fetch('/api/state');
    if (!response.ok) return;
    const next = await response.json();
    if (!force && journalState && JSON.stringify([next.reviews, next.trades, next.learning]) === JSON.stringify([journalState.reviews, journalState.trades, journalState.learning])) return;
    journalState = next;
    renderJournal();
  } catch {}
}

function initializeJournal() {
  const legacy = document.getElementById('journal');
  if (!legacy) { setTimeout(initializeJournal, 250); return; }
  const heading = legacy.closest('article')?.querySelector('h2');
  if (heading) heading.textContent = 'Trade journal & learning';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet'; stylesheet.href = '/journal.css'; document.head.append(stylesheet);
  const oldSummary = document.getElementById('learning-summary');
  legacy.hidden = true; legacy.style.display = 'none';
  if (oldSummary) { oldSummary.hidden = true; oldSummary.style.display = 'none'; }
  const dashboard = make('div');
  dashboard.id = 'research-journal';
  legacy.before(dashboard);
  document.addEventListener('click', event => {
    if (event.target.closest('#journal-tab')) setTimeout(() => loadJournal(true), 50);
  });
  loadJournal(true);
  setInterval(() => loadJournal(), 10000);
}

initializeJournal();
