function initializeNavigation() {
  const main = document.querySelector('main');
  const toolbar = document.querySelector('.workspace-toolbar');
  const tabs = document.querySelector('.review-tabs');
  const today = document.getElementById('today-view');
  const history = document.getElementById('history-view');
  const positions = document.getElementById('positions-view');
  const orders = document.getElementById('orders-view');
  const journal = document.getElementById('journal')?.closest('article');
  const activity = document.getElementById('audit')?.closest('article');
  const oldPortfolio = document.getElementById('holdings')?.closest('article');

  if (!main || !toolbar || !tabs || !today || !history || !positions || !orders || !journal || !activity) {
    setTimeout(initializeNavigation, 250);
    return;
  }

  if (document.getElementById('app-layout')) return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/navigation.css';
  document.head.append(stylesheet);

  const layout = document.createElement('div');
  layout.id = 'app-layout';
  layout.className = 'app-layout';
  const menu = document.createElement('aside');
  menu.className = 'side-menu';
  menu.setAttribute('aria-label', 'Microsaver sections');
  const pages = document.createElement('div');
  pages.className = 'app-pages';
  layout.append(menu, pages);
  toolbar.after(layout);
  menu.append(tabs);

  const makeMenuButton = (id, label) => {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement('button');
      button.id = id;
      button.textContent = label;
    }
    return button;
  };

  const buttons = {
    today: makeMenuButton('today-tab', 'Today'),
    positions: makeMenuButton('positions-tab', 'Positions'),
    orders: makeMenuButton('orders-tab', 'Orders'),
    history: makeMenuButton('history-tab', 'History'),
    journal: makeMenuButton('journal-tab', 'Journal'),
    activity: makeMenuButton('activity-tab', 'Activity'),
  };

  tabs.replaceChildren(
    buttons.today,
    buttons.positions,
    buttons.orders,
    buttons.history,
    buttons.journal,
    buttons.activity,
  );

  journal.id = 'journal-view';
  activity.id = 'activity-view';
  if (oldPortfolio) oldPortfolio.hidden = true;
  pages.append(today, positions, orders, history, journal, activity);

  const views = { today, positions, orders, history, journal, activity };
  const hero = main.querySelector(':scope > .eyebrow');
  const title = main.querySelector(':scope > h1');
  const summary = main.querySelector(':scope > section.grid');
  const refreshButton = document.getElementById('refresh');
  const researchButton = document.getElementById('research');
  const activityCounter = document.getElementById('activity');
  let current = 'today';

  const applyRoute = () => {
    for (const [name, view] of Object.entries(views)) {
      const selected = name === current;
      view.hidden = !selected;
      view.style.display = selected ? '' : 'none';
    }
    for (const [name, button] of Object.entries(buttons)) {
      if (name === current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const showOverview = current === 'today' || current === 'positions';
    if (hero) hero.style.display = current === 'today' ? '' : 'none';
    if (title) title.style.display = current === 'today' ? '' : 'none';
    if (summary) summary.style.display = showOverview ? '' : 'none';
    if (refreshButton) refreshButton.style.display = showOverview ? '' : 'none';
    if (researchButton) researchButton.style.display = current === 'today' ? '' : 'none';
    if (activityCounter) activityCounter.style.display = current === 'today' ? '' : 'none';
    if (oldPortfolio) oldPortfolio.style.display = 'none';
  };

  for (const [name, button] of Object.entries(buttons)) {
    button.addEventListener('click', () => {
      current = name;
      applyRoute();
      layout.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  applyRoute();
  setInterval(applyRoute, 200);
}

setTimeout(initializeNavigation, 900);
