(function (root) {
  'use strict';

  const TASKS = {
    calls: { rate: 0.65, recommendation: 'Routine calls and questions — use AI to answer common questions, gather details, and route conversations around the clock.' },
    scheduling: { rate: 0.75, recommendation: 'Scheduling and rescheduling — connect AI to calendars for booking, changes, confirmations, and fewer manual handoffs.' },
    followup: { rate: 0.70, recommendation: 'Lead and customer follow-up — use consistent automated responses so opportunities do not quietly disappear.' },
    email: { rate: 0.55, recommendation: 'Routine email work — let AI sort, summarize, and draft common replies while people retain review and judgment.' },
    data: { rate: 0.60, recommendation: 'Calendar, spreadsheet, and CRM entry — connect systems so information moves forward without repeated typing.' },
    reminders: { rate: 0.80, recommendation: 'Reminders, review requests, and routine updates — automate predictable messages while keeping exceptions human-controlled.' }
  };

  function clampNumber(value, maximum) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, maximum);
  }

  function calculate(values, hourlyValue) {
    const ranked = Object.keys(TASKS).map(function (key) {
      const entered = clampNumber(values[key], 168);
      return { key: key, entered: entered, recoverable: entered * TASKS[key].rate, recommendation: TASKS[key].recommendation };
    }).sort(function (a, b) { return b.recoverable - a.recoverable; });

    const totalEntered = ranked.reduce(function (sum, item) { return sum + item.entered; }, 0);
    const weekly = ranked.reduce(function (sum, item) { return sum + item.recoverable; }, 0);
    const hourly = clampNumber(hourlyValue, 10000);
    const byTask = {};
    ranked.forEach(function (item) { byTask[item.key] = item; });

    return {
      totalEntered: totalEntered,
      weekly: weekly,
      days: weekly / 8,
      monthly: weekly * 4.33,
      annual: weekly * 52,
      annualValue: hourly > 0 ? weekly * 52 * hourly : null,
      byTask: byTask,
      recommendations: ranked.filter(function (item) { return item.entered > 0; }).slice(0, 3)
    };
  }

  function formatHours(value) {
    if (value === 0) return '0';
    return value < 10 ? value.toFixed(1).replace(/\.0$/, '') : Math.round(value).toLocaleString('en-US');
  }

  function formatMoney(value) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  function formatWeeklyHours(value) {
    return formatHours(value) + (value === 1 ? ' hr/week' : ' hrs/week');
  }

  function init() {
    const form = document.getElementById('timeCalculator');
    if (!form) return;

    const taskInputs = Array.from(form.querySelectorAll('[data-time-task]'));
    const hourlyInput = document.getElementById('timeHourlyValue');
    const results = document.getElementById('timeResults');
    const weeklyOutput = document.getElementById('recoverableWeekly');
    const summaryOutput = document.getElementById('recoverableSummary');
    const daysOutput = document.getElementById('recoverableDays');
    const monthlyOutput = document.getElementById('recoverableMonthly');
    const annualOutput = document.getElementById('recoverableAnnual');
    const valueOutput = document.getElementById('recoverableValue');
    const recommendationsOutput = document.getElementById('timeRecommendations');
    const taskReturnOutputs = Array.from(form.querySelectorAll('[data-time-return]'));
    const totalEnteredOutput = document.getElementById('totalEnteredWeekly');
    const totalRecoverableOutput = document.getElementById('totalRecoverableWeekly');

    function update() {
      const values = {};
      taskInputs.forEach(function (input) { values[input.dataset.timeTask] = input.value; });
      const calculation = calculate(values, hourlyInput.value);

      taskReturnOutputs.forEach(function (output) {
        output.textContent = formatWeeklyHours(calculation.byTask[output.dataset.timeReturn].recoverable);
      });
      totalEnteredOutput.textContent = formatWeeklyHours(calculation.totalEntered);
      totalRecoverableOutput.textContent = formatWeeklyHours(calculation.weekly);
      weeklyOutput.textContent = formatHours(calculation.weekly) + (calculation.weekly === 1 ? ' hour every week' : ' hours every week');
      daysOutput.textContent = formatHours(calculation.days);
      monthlyOutput.textContent = formatHours(calculation.monthly);
      annualOutput.textContent = formatHours(calculation.annual);
      valueOutput.textContent = calculation.annualValue === null ? 'Add hourly value' : formatMoney(calculation.annualValue);

      if (calculation.weekly > 0) {
        summaryOutput.textContent = 'That is about ' + formatHours(calculation.days) + ' working days returned to your business each week.';
        recommendationsOutput.innerHTML = calculation.recommendations.map(function (item) { return '<li>' + item.recommendation + '</li>'; }).join('');
      } else {
        summaryOutput.textContent = 'Enter your weekly task time to reveal where AI may help most.';
        recommendationsOutput.innerHTML = '<li>Enter time above to generate your three strongest opportunities.</li>';
      }
    }

    form.addEventListener('input', update);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      update();
      results.focus({ preventScroll: true });
      results.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });

    update();
  }

  root.AIWTimeCalculator = { calculate: calculate, tasks: TASKS };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
}(typeof window !== 'undefined' ? window : globalThis));
