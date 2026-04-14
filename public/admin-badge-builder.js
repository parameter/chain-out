(function () {
  const API = {
    templates: '/admin/api/badge-builder/templates',
    badges: '/admin/api/badge-builder/badges',
    badge: (id) => `/admin/api/badge-builder/badge/${encodeURIComponent(id)}`,
    save: '/admin/api/badge-builder/save',
    emit: '/admin/api/badge-builder/emit',
    test: '/admin/api/badges/test'
  };

  let templates = [];
  let badges = [];
  let selectedBadgeId = null;
  let isNew = false;

  const el = (id) => document.getElementById(id);

  function showToast(msg) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  function toggleTierSections() {
    const type = el('editorForm').elements.type.value;
    const uniqueCard = el('uniqueCard');
    const tieredCard = el('tieredCard');
    uniqueCard.classList.toggle('hidden', type !== 'unique');
    tieredCard.classList.toggle('hidden', type !== 'tiered' && type !== 'unique');
  }

  function getTemplatesForMode(mode) {
    return templates.filter((t) => t.mode === mode);
  }

  function fillTemplateSelect() {
    const mode = el('conditionMode').value;
    const sel = el('templateSelect');
    const list = getTemplatesForMode(mode);
    sel.innerHTML = '';
    list.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      sel.appendChild(opt);
    });
    if (list.length) renderParamFields(list[0]);
    else el('paramFields').innerHTML = '';
  }

  function renderParamFields(template) {
    const wrap = el('paramFields');
    wrap.innerHTML = '';
    if (!template || !template.paramSchema || template.paramSchema.length === 0) {
      return;
    }
    template.paramSchema.forEach((p) => {
      const label = document.createElement('label');
      label.className = 'field';
      const span = document.createElement('span');
      span.textContent = p.label + (p.description ? ` — ${p.description}` : '');
      let input;
      if (p.type === 'boolean') {
        const wrapChk = document.createElement('label');
        wrapChk.className = 'chk';
        input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.paramKey = p.key;
        input.checked = !!p.default;
        wrapChk.appendChild(input);
        wrapChk.appendChild(document.createTextNode(' ' + p.label));
        label.appendChild(span);
        label.appendChild(wrapChk);
      } else {
        input = document.createElement('input');
        input.dataset.paramKey = p.key;
        if (p.type === 'integer' || p.type === 'number') {
          input.type = 'number';
          if (p.min != null) input.min = p.min;
          if (p.max != null) input.max = p.max;
          input.value =
            p.default != null ? String(p.default) : p.type === 'integer' ? '0' : '0';
        } else {
          input.type = 'text';
          input.value = p.default != null ? String(p.default) : '';
        }
        label.appendChild(span);
        label.appendChild(input);
      }
      wrap.appendChild(label);
    });
  }

  function collectParamsFromDom(template) {
    const params = {};
    if (!template || !template.paramSchema) return params;
    template.paramSchema.forEach((p) => {
      const node = el('paramFields').querySelector(`[data-param-key="${p.key}"]`);
      if (!node) return;
      if (p.type === 'boolean') {
        params[p.key] = node.checked;
      } else if (p.type === 'integer') {
        params[p.key] = parseInt(node.value, 10) || 0;
      } else if (p.type === 'number') {
        params[p.key] = parseFloat(node.value) || 0;
      } else {
        params[p.key] = node.value;
      }
    });
    return params;
  }

  function applyParamsToDom(template, params) {
    if (!template || !template.paramSchema) return;
    template.paramSchema.forEach((p) => {
      const node = el('paramFields').querySelector(`[data-param-key="${p.key}"]`);
      if (!node || params[p.key] === undefined) return;
      if (p.type === 'boolean') node.checked = !!params[p.key];
      else node.value = String(params[p.key]);
    });
  }

  function collectBadgeMetadata() {
    const f = el('editorForm').elements;
    const tierThresholds = f.tierThresholds.value
      ? f.tierThresholds.value.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n))
      : [];
    const tierPoints = f.tierPoints.value
      ? f.tierPoints.value.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n))
      : [];
    const tierNames = f.tierNames.value
      ? f.tierNames.value.split('\n').map((x) => x.trim()).filter(Boolean)
      : [];

    const meta = {
      id: f.id.value.trim(),
      name: f.name.value.trim(),
      type: f.type.value,
      animation: f.animation.value,
      quote: f.quote.value,
      description: f.description.value,
      functionalDescription: f.functionalDescription.value,
      icon: f.icon.value.trim(),
      category: f.category.value.trim(),
      tier: f.tier.value,
      difficulty: f.difficulty.value,
      points: parseInt(f.points.value, 10) || 0,
      isUnique: f.isUnique.checked,
      asProgress: f.asProgress.checked,
      trackUniqueCourses: f.trackUniqueCourses.checked,
      trackTierThresholdZync: f.trackTierThresholdZync.checked,
      doubles: f.doubles.checked,
      requiresWeatherAPI: f.requiresWeatherAPI.checked,
      requiresDate: f.requiresDate.checked,
      done: f.done.checked,
      tierDescriptionPrefix: f.tierDescriptionPrefix.value,
      tierDescriptionSuffix: f.tierDescriptionSuffix.value,
      tierThresholds,
      tierPoints,
      tierNames
    };

    if (!isNew && selectedBadgeId) {
      meta._id = selectedBadgeId;
    }
    return meta;
  }

  function populateForm(badge, inferStatus, conditionBuilder) {
    const f = el('editorForm').elements;
    f.id.value = badge.id || '';
    f.name.value = badge.name || '';
    f.type.value = badge.type || 'tiered';
    f.animation.value = badge.animation || 'pulse';
    f.quote.value = badge.quote || '';
    f.description.value = badge.description || '';
    f.functionalDescription.value = badge.functionalDescription || '';
    f.icon.value = badge.icon || '';
    f.category.value = badge.category || '';
    f.tier.value = badge.tier || 'bronze';
    f.difficulty.value = badge.difficulty || 'easy';
    f.points.value = badge.points != null ? String(badge.points) : '0';
    f.isUnique.checked = !!badge.isUnique;
    f.asProgress.checked = !!badge.asProgress;
    f.trackUniqueCourses.checked = !!badge.trackUniqueCourses;
    f.trackTierThresholdZync.checked = !!badge.trackTierThresholdZync;
    f.doubles.checked = !!badge.doubles;
    f.requiresWeatherAPI.checked = !!badge.requiresWeatherAPI;
    f.requiresDate.checked = !!badge.requiresDate;
    f.done.checked = !!badge.done;
    f.tierDescriptionPrefix.value = badge.tierDescriptionPrefix || '';
    f.tierDescriptionSuffix.value = badge.tierDescriptionSuffix || '';
    f.tierThresholds.value = Array.isArray(badge.tierThresholds) ? badge.tierThresholds.join(',') : '';
    f.tierPoints.value = Array.isArray(badge.tierPoints) ? badge.tierPoints.join(',') : '';
    f.tierNames.value = Array.isArray(badge.tierNames) ? badge.tierNames.join('\n') : '';

    const mode = badge.requiresHistoricalData ? 'historical' : 'round';
    el('conditionMode').value = mode;
    fillTemplateSelect();

    const builder = conditionBuilder || {};
    const tid = builder.templateId || el('templateSelect').value;
    el('templateSelect').value = tid;
    const t = getTemplatesForMode(mode).find((x) => x.id === tid);
    renderParamFields(t || getTemplatesForMode(mode)[0]);
    if (builder.params) applyParamsToDom(t || getTemplatesForMode(mode)[0], builder.params);

    const banner = el('inferBanner');
    banner.classList.remove('hidden', 'ok');
    if (inferStatus === 'unknown') {
      banner.classList.add('banner');
      banner.textContent =
        'This badge’s condition is not mapped to a template. Choose a template and parameters to replace it on save.';
    } else if (inferStatus === 'known') {
      banner.classList.add('banner', 'ok');
      banner.textContent = 'Condition matches a template — safe to edit.';
    } else {
      banner.classList.add('hidden');
    }

    toggleTierSections();
    updateTestUi();
  }

  function updateTestUi() {
    const mode = el('conditionMode').value;
    const testHint = el('testHint');
    const btn = el('btnTestRound');
    if (mode === 'historical') {
      btn.disabled = true;
      testHint.textContent =
        'Round-only test is disabled for historical templates. Conditions are validated on the server when you save.';
    } else {
      btn.disabled = false;
      testHint.textContent =
        'Uses sample results/layout against /admin/api/badges/test.';
    }
  }

  async function loadTemplatesAndBadges() {
    const [tr, br] = await Promise.all([fetch(API.templates), fetch(API.badges)]);
    const tj = await tr.json();
    const bj = await br.json();
    templates = tj.templates || [];
    badges = Array.isArray(bj) ? bj : [];
    renderList();
  }

  function renderList(filter) {
    const q = (filter || '').toLowerCase().trim();
    const ul = el('badgeList');
    ul.innerHTML = '';
    badges
      .filter((b) => {
        if (!q) return true;
        return (
          (b.name && b.name.toLowerCase().includes(q)) ||
          (b.id && b.id.toLowerCase().includes(q))
        );
      })
      .forEach((b) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = `<strong>${escapeHtml(b.name || b.id)}</strong><span class="meta">${escapeHtml(
          b.id || ''
        )}${b.requiresHistoricalData ? ' · historical' : ''}</span>`;
        btn.addEventListener('click', () => openBadge(b._id));
        if (String(selectedBadgeId) === String(b._id)) btn.classList.add('active');
        li.appendChild(btn);
        ul.appendChild(li);
      });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function openBadge(_id) {
    selectedBadgeId = _id;
    isNew = false;
    const res = await fetch(API.badge(_id));
    if (!res.ok) {
      showToast('Failed to load badge');
      return;
    }
    const data = await res.json();
    el('emptyState').classList.add('hidden');
    el('editorForm').classList.remove('hidden');
    populateForm(data.badge, data.inferStatus, data.conditionBuilder);
    renderList(el('searchInput').value);
  }

  function startNew() {
    isNew = true;
    selectedBadgeId = null;
    el('emptyState').classList.add('hidden');
    el('editorForm').classList.remove('hidden');
    el('inferBanner').classList.add('hidden');
    const blank = {
      id: '',
      name: '',
      type: 'tiered',
      animation: 'pulse',
      quote: '',
      description: '',
      functionalDescription: '',
      icon: '',
      category: 'allRounds',
      tier: 'bronze',
      difficulty: 'easy',
      points: 0,
      isUnique: false,
      asProgress: false,
      trackUniqueCourses: false,
      trackTierThresholdZync: false,
      doubles: false,
      requiresWeatherAPI: false,
      requiresDate: false,
      done: false,
      tierDescriptionPrefix: 'Make',
      tierDescriptionSuffix: 'progress',
      tierThresholds: [1, 5, 10],
      tierPoints: [100, 250, 500],
      tierNames: ['Tier 1', 'Tier 2', 'Tier 3'],
      requiresHistoricalData: false
    };
    populateForm(blank, null, {
      templateId: 'round_birdie_hunter',
      mode: 'round',
      params: {}
    });
    el('conditionMode').value = 'round';
    fillTemplateSelect();
    el('templateSelect').value = 'round_birdie_hunter';
    renderParamFields(getTemplatesForMode('round').find((x) => x.id === 'round_birdie_hunter'));
    renderList(el('searchInput').value);
  }

  el('editorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = el('conditionMode').value;
    const templateId = el('templateSelect').value;
    const template = getTemplatesForMode(mode).find((t) => t.id === templateId);
    const params = collectParamsFromDom(template);
    const conditionBuilder = { mode, templateId, params };

    const badgeMetadata = collectBadgeMetadata();
    const action = isNew ? 'create' : 'update';

    try {
      const res = await fetch(API.save, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, badgeMetadata, conditionBuilder })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      showToast(action === 'create' ? 'Badge created' : 'Badge saved');
      await loadTemplatesAndBadges();
      if (data.insertedId) {
        await openBadge(data.insertedId);
      } else if (badgeMetadata._id) {
        await openBadge(badgeMetadata._id);
      }
    } catch (err) {
      showToast(err.message || 'Save failed');
    }
  });

  el('btnCancel').addEventListener('click', () => {
    el('editorForm').classList.add('hidden');
    el('emptyState').classList.remove('hidden');
    selectedBadgeId = null;
    isNew = false;
    renderList(el('searchInput').value);
  });

  el('btnRefresh').addEventListener('click', () => loadTemplatesAndBadges());
  el('btnNew').addEventListener('click', () => startNew());

  el('searchInput').addEventListener('input', (e) => renderList(e.target.value));

  el('conditionMode').addEventListener('change', () => {
    fillTemplateSelect();
    updateTestUi();
  });

  el('templateSelect').addEventListener('change', () => {
    const mode = el('conditionMode').value;
    const tid = el('templateSelect').value;
    const t = getTemplatesForMode(mode).find((x) => x.id === tid);
    renderParamFields(t);
  });

  el('editorForm').elements.type.addEventListener('change', toggleTierSections);

  el('btnTestRound').addEventListener('click', async () => {
    const mode = el('conditionMode').value;
    const outEl = el('testOut');
    if (mode === 'historical') {
      outEl.textContent = 'Use save to validate historical conditions.';
      outEl.classList.remove('hidden');
      return;
    }
    const templateId = el('templateSelect').value;
    const template = getTemplatesForMode(mode).find((t) => t.id === templateId);
    const params = collectParamsFromDom(template);
    try {
      const em = await fetch(API.emit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, templateId, params })
      });
      const ej = await em.json();
      if (!em.ok) throw new Error(ej.error);

      const testData = [
        {
          holeNumber: 1,
          score: 2,
          courseId: 'sample-course',
          putt: 'inside',
          isAce: false
        },
        { holeNumber: 2, score: 4, courseId: 'sample-course', putt: 'outside', isAce: false }
      ];
      const layout = {
        holes: [
          { number: 1, par: 3 },
          { number: 2, par: 4 }
        ]
      };

      const tr = await fetch(API.test, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          badge: { condition: ej.condition },
          testData,
          layout
        })
      });
      const tj = await tr.json();
      outEl.textContent = JSON.stringify(tj, null, 2);
      outEl.classList.remove('hidden');
    } catch (err) {
      outEl.textContent = String(err.message || err);
      outEl.classList.remove('hidden');
    }
  });

  loadTemplatesAndBadges().catch((e) => showToast(e.message));
})();
