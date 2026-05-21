const state = {
  currentStep: 1,
  profile: null,
  selectedRoute: null,
  costTimer: null,
  approved: false
};

const steps = Array.from(document.querySelectorAll('.workflow-step'));
const stepMarkers = Array.from(document.querySelectorAll('.step-marker'));

const configForm = document.getElementById('config-form');
const dynamicTags = document.getElementById('dynamicTags');
const routeCards = document.getElementById('routeCards');
const routeRecommendation = document.getElementById('routeRecommendation');
const costKpis = document.getElementById('costKpis');
const costWarnings = document.getElementById('costWarnings');
const documentsPanel = document.getElementById('documentsPanel');
const auditTimeline = document.getElementById('auditTimeline');
const approvalStatus = document.getElementById('approvalStatus');

const prevStepBtn = document.getElementById('prevStep');
const nextStepBtn = document.getElementById('nextStep');
const stepStatus = document.getElementById('stepStatus');
const approveButton = document.getElementById('approveButton');

const profileOutputs = {
  priority: document.getElementById('priorityOutput'),
  sla: document.getElementById('slaOutput'),
  risk: document.getElementById('riskOutput'),
  routeMode: document.getElementById('routeModeOutput')
};

function updateStepUI() {
  steps.forEach((step, index) => {
    step.classList.toggle('active', index + 1 === state.currentStep);
  });

  stepMarkers.forEach((marker, index) => {
    const stepNumber = index + 1;
    marker.classList.toggle('active', stepNumber === state.currentStep);
    marker.classList.toggle('complete', stepNumber < state.currentStep);
  });

  prevStepBtn.disabled = state.currentStep === 1;
  nextStepBtn.disabled = state.currentStep === 5;
  stepStatus.textContent = `Step ${state.currentStep} of 5`;
}

function parseForm() {
  const fields = Array.from(configForm.querySelectorAll('select, input, textarea'));
  let valid = true;

  fields.forEach((field) => {
    if (field.required && !field.value) {
      field.classList.add('invalid');
      valid = false;
    } else {
      field.classList.remove('invalid');
    }
  });

  if (!valid) return null;

  const volume = Number(document.getElementById('deliveryVolume').value || 0);
  const urgency = document.getElementById('urgencyLevel').value;
  const region = document.getElementById('deliveryRegion').value;
  const merchandise = document.getElementById('merchandiseType').value;
  const restrictions = document.getElementById('specialRestrictions').value;

  const urgencyScore = urgency === 'Critical' ? 3 : urgency === 'High' ? 2 : 1;
  const riskSeed = volume > 45 ? 2 : 1;
  const riskMod = /temperature|secure|customs/i.test(restrictions) ? 1 : 0;
  const riskLevel = Math.min(3, urgencyScore + riskSeed + riskMod - 1);

  return {
    volume,
    urgency,
    region,
    merchandise,
    restrictions,
    priority: urgencyScore >= 3 ? 'P1 - Command' : urgencyScore === 2 ? 'P2 - Accelerated' : 'P3 - Planned',
    sla: urgencyScore === 3 ? '6-10h' : urgencyScore === 2 ? '12-18h' : '24-30h',
    risk: ['Low', 'Moderate', 'Elevated'][riskLevel - 1],
    routeMode: volume > 35 ? 'Hybrid Long-Haul' : riskLevel >= 3 ? 'Secure Express' : 'Standard Fleet'
  };
}

function renderProfile(profile) {
  profileOutputs.priority.textContent = profile.priority;
  profileOutputs.sla.textContent = profile.sla;
  profileOutputs.risk.textContent = profile.risk;
  profileOutputs.routeMode.textContent = profile.routeMode;

  const tags = [
    profile.region,
    profile.urgency,
    `${profile.volume}t volume`,
    profile.routeMode,
    `${profile.risk} risk`
  ];

  dynamicTags.innerHTML = tags.map((tag) => `<span class="tag">${tag}</span>`).join('');
}

function buildRoutes(profile) {
  const baseTraffic = profile.urgency === 'Critical' ? 67 : profile.urgency === 'High' ? 51 : 38;
  const baseEta = profile.urgency === 'Critical' ? 8 : profile.urgency === 'High' ? 15 : 24;

  return [
    {
      id: 'A',
      name: 'North Priority Corridor',
      traffic: `${baseTraffic}% dense`,
      restrictions: profile.volume > 40 ? 'Bridge axle limitation active' : 'Standard lane control',
      eta: `${baseEta}h`,
      alert: profile.risk === 'Elevated' ? 'Escort slot required' : 'No critical alerts',
      score: 92 - (profile.volume > 45 ? 8 : 0)
    },
    {
      id: 'B',
      name: 'Intermodal East Link',
      traffic: `${Math.max(20, baseTraffic - 12)}% moderate`,
      restrictions: 'Rail gate synchronization window',
      eta: `${baseEta + 3}h`,
      alert: 'Customs pre-clearance advised',
      score: 86 - (profile.urgency === 'Critical' ? 6 : 0)
    },
    {
      id: 'C',
      name: 'Southern Maritime Arterial',
      traffic: `${Math.max(18, baseTraffic - 18)}% fluid`,
      restrictions: 'Port slot availability monitoring',
      eta: `${baseEta + 5}h`,
      alert: 'Weather drift watch active',
      score: 80 + (profile.routeMode === 'Hybrid Long-Haul' ? 6 : 0)
    }
  ];
}

function renderRoutes(routes) {
  routeCards.innerHTML = routes
    .map(
      (route) => `
      <article class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <div class="flex justify-between items-start mb-3">
          <h4 class="font-medium">${route.name}</h4>
          <span class="status-badge">Score ${route.score}</span>
        </div>
        <ul class="space-y-2 text-sm text-slate-200">
          <li><strong>ETA:</strong> ${route.eta}</li>
          <li><strong>Traffic:</strong> ${route.traffic}</li>
          <li><strong>Load restrictions:</strong> ${route.restrictions}</li>
          <li><strong>Operational alert:</strong> ${route.alert}</li>
        </ul>
        <button class="secondary-btn mt-4 select-route" data-route="${route.id}">Set as active route</button>
      </article>
    `
    )
    .join('');

  routeCards.querySelectorAll('.select-route').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = routes.find((route) => route.id === button.dataset.route);
      state.selectedRoute = selected;
      routeRecommendation.textContent = `${selected.name} prioritized: best score (${selected.score}), aligned with ${state.profile.priority} and ${state.profile.risk.toLowerCase()} governance controls.`;
      renderCostPanel();
      renderDocuments();
    });
  });

  const top = [...routes].sort((a, b) => b.score - a.score)[0];
  state.selectedRoute = top;
  routeRecommendation.textContent = `${top.name} auto-prioritized by orchestration model with score ${top.score}.`;
}

function renderCostPanel() {
  if (!state.selectedRoute || !state.profile) {
    costKpis.innerHTML = '<p class="text-slate-300 text-sm">Select a route to activate live cost control.</p>';
    return;
  }

  let margin = 39 + (state.selectedRoute.score - 80) / 10;
  const volumeFactor = state.profile.volume / 20;

  const draw = () => {
    const fuel = (1.2 + volumeFactor * 0.6 + Math.random() * 0.35).toFixed(2);
    const toll = (150 + volumeFactor * 55 + Math.random() * 40).toFixed(0);
    const costKm = (2.1 + volumeFactor * 0.33 + Math.random() * 0.2).toFixed(2);
    margin = Math.max(33, Math.min(48, margin + (Math.random() - 0.5) * 1.2));
    const profit = (margin * 1.42).toFixed(1);

    const marginStatus = margin >= 42 ? 'On target' : 'Below target';
    const marginClass = margin >= 42 ? 'text-emerald-300' : 'text-amber-300';

    costKpis.innerHTML = `
      <div class="kpi"><span>Cost / Km</span><strong>$${costKm}</strong></div>
      <div class="kpi"><span>Fuel Impact</span><strong>$${fuel}/km</strong></div>
      <div class="kpi"><span>Toll Cost</span><strong>$${toll}</strong></div>
      <div class="kpi"><span>Operational Margin</span><strong class="${marginClass}">${margin.toFixed(1)}%</strong></div>
      <div class="kpi"><span>Profitability Est.</span><strong>${profit}%</strong></div>
    `;

    costWarnings.innerHTML = `
      <li class="${margin >= 42 ? 'text-emerald-300' : 'text-amber-300'}">Margin indicator: ${marginStatus} (target 42%).</li>
      <li class="text-slate-300">Traffic sensitivity index: ${(100 - state.selectedRoute.score) / 10 + 1.8}%.</li>
      <li class="text-slate-300">Recommended action: ${margin >= 42 ? 'Keep current dispatch plan' : 'Rebalance loading and toll schedule'}.</li>
    `;
  };

  clearInterval(state.costTimer);
  draw();
  state.costTimer = setInterval(draw, 2600);
}

function renderDocuments() {
  if (!state.selectedRoute || !state.profile) {
    documentsPanel.innerHTML = '<p class="text-sm text-slate-300">Document generation available after route selection.</p>';
    auditTimeline.innerHTML = '';
    return;
  }

  const reference = `DL-${Date.now().toString().slice(-6)}`;
  documentsPanel.innerHTML = [
    { name: 'Digital Delivery Note', status: 'Validated', trace: reference },
    { name: 'Pre-Invoice', status: 'Ready for Dispatch', trace: `${reference}-INV` },
    { name: 'Operational Summary', status: 'Governance Checked', trace: `${reference}-OPS` }
  ]
    .map(
      (doc) => `
      <article class="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-slate-400">${doc.name}</p>
        <p class="text-sm mt-2">Customer reference: DLink Industrial Network</p>
        <p class="text-sm">Shipment traceability: ${doc.trace}</p>
        <span class="status-badge mt-3 inline-block">${doc.status}</span>
      </article>
    `
    )
    .join('');

  auditTimeline.innerHTML = [
    'Routing decision logged',
    'Cost controls reconciled',
    'Delivery note drafted',
    'Pre-invoice validation complete',
    'Governance gate pending approval'
  ]
    .map((entry, index) => `<li><span class="text-slate-400">T+${index * 2}m</span> — ${entry}</li>`)
    .join('');
}

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = parseForm();
  if (!profile) return;

  state.profile = profile;
  renderProfile(profile);

  const routes = buildRoutes(profile);
  renderRoutes(routes);
  renderCostPanel();
  renderDocuments();

  if (state.currentStep < 2) {
    state.currentStep = 2;
    updateStepUI();
  }
});

prevStepBtn.addEventListener('click', () => {
  if (state.currentStep > 1) {
    state.currentStep -= 1;
    updateStepUI();
  }
});

nextStepBtn.addEventListener('click', () => {
  if (state.currentStep < 5) {
    state.currentStep += 1;
    updateStepUI();
  }
});

stepMarkers.forEach((marker) => {
  marker.addEventListener('click', () => {
    state.currentStep = Number(marker.dataset.step);
    updateStepUI();
  });
});

approveButton.addEventListener('click', () => {
  state.approved = true;
  approvalStatus.innerHTML = [
    'Operation approved',
    'Documentation generated',
    'Invoice sent',
    'Operational traceability completed',
    'Governance validation successful'
  ]
    .map((item) => `<li class="text-emerald-300">✓ ${item}</li>`)
    .join('');
});

updateStepUI();
renderCostPanel();
renderDocuments();
