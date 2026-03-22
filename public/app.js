/**
 * =============================================================================
 * UI LOGIC — Controller antarmuka pengguna
 * Menggunakan FACT_QUESTIONS (dari fact_evaluator.js) untuk render form dinamis.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const hadithInput = document.getElementById('hadithInput');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  const resultsSection = document.getElementById('resultsSection');
  const expertSummary = document.getElementById('expertSummary');
  const factGatheringSection = document.getElementById('factGatheringSection');
  const factGatheringForm = document.getElementById('factGatheringForm');

  let currentExpertData = null;

  // ── Render form penelusuran fakta dari FACT_QUESTIONS (data-driven) ──
  function renderFactGatheringForm() {
    if (!factGatheringForm || typeof FACT_QUESTIONS === 'undefined') return;
    factGatheringForm.innerHTML = FACT_QUESTIONS.map(q => `
      <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p class="text-sm font-semibold text-gray-800 mb-2">${q.text}</p>
        <div class="flex space-x-6">
          <label class="flex items-center cursor-pointer">
            <input type="radio" name="${q.id}" value="true" class="mr-2 text-teal-600 focus:ring-teal-500 w-4 h-4"> Ya
          </label>
          <label class="flex items-center cursor-pointer">
            <input type="radio" name="${q.id}" value="false" class="mr-2 text-teal-600 focus:ring-teal-500 w-4 h-4" checked> Tidak
          </label>
        </div>
      </div>
    `).join('') + `
      <div class="mt-5 flex justify-end">
        <button type="submit" id="submitFactGatheringBtn"
          class="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all flex items-center shadow-md">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Evaluasi Pakar Sekarang
        </button>
      </div>
    `;
  }
  renderFactGatheringForm();

  // ── Listener tombol contoh ───────────────────────────────────────────
  document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      hadithInput.value = e.target.textContent;
      hadithInput.focus();
    });
  });

  // ── Form Submit: Evaluasi Otomatis ───────────────────────────────────
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = hadithInput.value.trim();
    if (!text) return;

    errorMessage.classList.add('hidden');
    resultsSection.classList.add('hidden');
    expertSummary.innerHTML = '';
    expertSummary.classList.add('hidden');
    if (factGatheringSection) factGatheringSection.classList.add('hidden');

    const result = evaluateExpertLayer(text);

    currentExpertData = {
      status: result.expertStatus,
      label: result.expertLabel,
      reasons: result.reasons,
      rulesFired: result.rulesFired,
      factsGathered: result.factsGathered,
      requiresFactGathering: result.requiresFactGathering,
      certaintyFactor: result.certaintyFactor,
      manualStatus: null, manualLabel: null, manualReason: null, manualRulesFired: null, manualCertaintyFactor: null,
    };

    renderExpertSummary();
    resultsSection.classList.remove('hidden');

    if (result.requiresFactGathering && factGatheringSection) {
      factGatheringSection.classList.remove('hidden');
    }
  });

  // ── Penelusuran Fakta (M1-M5) ────────────────────────────────────────
  if (factGatheringForm) {
    factGatheringForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(factGatheringForm);

      // Kumpulkan jawaban secara dinamis dari FACT_QUESTIONS
      const answers = {};
      FACT_QUESTIONS.forEach(q => {
        answers[q.id] = formData.get(q.id) === 'true';
      });

      const result = evaluateFactGathering(answers);

      currentExpertData.manualStatus = result.expertStatus;
      currentExpertData.manualLabel = result.expertLabel;
      currentExpertData.manualReason = result.reason;
      currentExpertData.manualRulesFired = result.rulesFired;
      currentExpertData.manualCertaintyFactor = result.certaintyFactor;

      renderExpertSummary();
      factGatheringSection.classList.add('hidden');
    });
  }

  // ── Render: Panel Analisis Pakar ─────────────────────────────────────
  function renderExpertSummary() {
    if (!expertSummary || !currentExpertData) return;

    const isManual = !!currentExpertData.manualStatus;
    const finalStatus = isManual ? currentExpertData.manualStatus : currentExpertData.status;

    const isAlert = ['KUAT_INDIKASI_MAUDHU', 'LA_ASLA_LAHU', 'HOAKS_BUKAN_HADIS',
      'INDIKASI_MAUDHU_POLITIS', 'LEMAH_CENDERUNG_TIDAK_SHOHIH'].includes(finalStatus);
    const isNeutral = ['REQUIRES_FACT_GATHERING', 'STATUS_TIDAK_DIKENALI'].includes(finalStatus);

    let bgClass, headerClass, textClass;
    if (isAlert) {
      bgClass = 'bg-red-50 border-red-400'; headerClass = 'text-red-800'; textClass = 'text-red-900';
    } else if (isNeutral) {
      bgClass = 'bg-amber-50 border-amber-300'; headerClass = 'text-amber-800'; textClass = 'text-amber-900';
    } else {
      bgClass = 'bg-green-50 border-green-300'; headerClass = 'text-green-800'; textClass = 'text-green-900';
    }

    let statusBadge = '';
    if (isAlert) {
      statusBadge = `<div class="mb-3 text-sm font-bold text-white bg-red-600 px-4 py-1.5 rounded-full inline-flex items-center shadow-md border border-red-700">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        PERINGATAN: INDIKASI BERMASALAH</div>`;
    } else if (isNeutral && !isManual) {
      statusBadge = `<div class="mb-3 text-sm font-bold text-white bg-amber-500 px-4 py-1.5 rounded-full inline-flex items-center shadow-md">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        EVALUASI MANUAL DIPERLUKAN</div>`;
    }

    const mainLabel = isManual ? currentExpertData.manualLabel : currentExpertData.label;

    // Hitung persentase Certainty Factor keseluruhan dari apa yang terpilih
    const autoCF = currentExpertData.certaintyFactor || 0;
    const manualCF = currentExpertData.manualCertaintyFactor || 0;
    // Jika ada manual dan auto, kita combine CF (parallel)
    let combinedCF = autoCF;
    if (isManual && manualCF > 0) {
      combinedCF = autoCF + manualCF * (1 - autoCF);
    }
    const cfPercentage = (combinedCF * 100).toFixed(1);
    const barColor = isAlert ? 'bg-red-600' : (isNeutral ? 'bg-amber-500' : 'bg-green-600');
    const cfHtml = combinedCF > 0 
      ? `<div class="mt-2 mb-4">
           <div class="text-sm font-bold ${textClass} mb-1">Tingkat Keyakinan Sistem (Certainty Factor): <span class="text-lg">${cfPercentage}%</span></div>
           <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-300 overflow-hidden">
             <div class="${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${cfPercentage}%"></div>
           </div>
         </div>`
      : '';

    const autoRulesFired = currentExpertData.rulesFired || [];
    const rulesHtml = autoRulesFired.length > 0
      ? `<div class="mt-3">
          <div class="text-xs font-bold ${headerClass} tracking-wider mb-1 uppercase">Aturan Terpicu (Forward Chaining)</div>
          <div class="flex flex-wrap gap-1.5">${autoRulesFired.map(r => `<span class="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-white font-mono">${r}</span>`).join('')}</div>
        </div>` : '';

    const facts = currentExpertData.factsGathered || {};
    const factLabels = {
      hasExaggeratedReward: '🔴 Janji Pahala Sangat Berlebihan (Mubalaghah Fasidah)',
      hasFabricatedThreat: '🔴 Ancaman Dibuat-buat / Pesan Berantai (Tahwil al-Kadzib)',
      hasQuranContradiction: "🔴 Bertentangan dengan Nash Al-Quran (Mukhalafah lil-Qur'an)",
      hasModernLanguage: '🔴 Lafaz Anakronistik / Era Modern (Tarikhiyyah al-Lafz)',
      hasBidahPractice: '🟡 Amalan Khusus Tanpa Asal (Ma Laa Asla Lahu fil Ibadah)',
      hasPopularQuotes: "🟡 Slogan Populer / Nasihat Tabib (Masyhur 'ala Alsinatun-Naas)",
      hasRegexRedFlag: '🔴 Redaksi Teks Sangat Mungkar (Shorih al-Kadzib)',
    };
    const detectedFacts = Object.entries(factLabels)
      .filter(([key]) => facts[key] === true)
      .map(([, label]) => label);

    let factsHtml = '';
    if (detectedFacts.length > 0) {
      factsHtml = `<div class="mt-3 pt-3 border-t border-opacity-30 border-gray-400">
        <div class="text-xs font-bold ${headerClass} tracking-wider mb-1 uppercase">Qarinah (Fakta) yang Ditemukan</div>
        <ul class="text-sm ${textClass} list-disc list-inside space-y-1 ml-1">${detectedFacts.map(f => `<li>${f}</li>`).join('')}</ul>
      </div>`;
    } else if (!isManual) {
      factsHtml = `<div class="mt-3 pt-3 border-t border-opacity-30 border-gray-400">
        <div class="text-xs font-bold ${headerClass} tracking-wider mb-1 uppercase">Qarinah (Fakta) yang Ditemukan</div>
        <p class="text-sm ${textClass} opacity-80">Tidak ada qarinah (red-flag) yang terdeteksi secara otomatis oleh sistem.</p>
      </div>`;
    }

    const reasons = currentExpertData.reasons || [];
    const reasonsHtml = reasons.length > 0
      ? `<ul class="text-sm ${textClass} list-disc list-inside space-y-1.5 ml-1 mb-3 opacity-90">${reasons.map(r => `<li>${r}</li>`).join('')}</ul>`
      : '';

    let manualHtml = '';
    if (isManual) {
      const manualRules = currentExpertData.manualRulesFired || [];
      manualHtml = `<div class="mt-4 pt-4 border-t border-opacity-30 border-gray-400 animate-fade-in">
        <div class="text-xs font-bold ${headerClass} tracking-wider mb-2 uppercase flex items-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Hasil Penelusuran Fakta Pakar (Manual)
        </div>
        <div class="text-base font-extrabold ${textClass} mb-2">${currentExpertData.manualLabel}</div>
        <p class="text-sm font-semibold ${textClass} mb-2">${currentExpertData.manualReason}</p>
        ${manualRules.length > 0 ? `<div class="flex flex-wrap gap-1.5 mt-2">${manualRules.map(r => `<span class="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-white font-mono">${r}</span>`).join('')}</div>` : ''}
      </div>`;
    }

    expertSummary.innerHTML = `
      <div class="p-5 rounded-xl border-2 ${bgClass} shadow-sm transition-all duration-300">
        ${statusBadge}
        <div class="text-xs font-bold ${headerClass} tracking-wider mb-2 uppercase flex items-center opacity-80">
          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
          Analisis Sistem Pakar (Forward Chaining & Certainty Factor)
        </div>
        <div class="text-lg font-extrabold ${textClass} mb-3">${mainLabel}</div>
        ${cfHtml}
        ${reasonsHtml}${rulesHtml}${factsHtml}${manualHtml}
        <div class="mt-3 pt-3 border-t border-opacity-30 border-gray-400">
          <p class="text-xs ${isAlert ? 'text-red-700' : (isNeutral ? 'text-amber-700' : 'text-green-700')} flex items-start opacity-90">
            <svg class="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>
            Sistem ini adalah Sistem Pakar berbasis aturan (Rule-Based Expert System) dengan metode Forward Chaining. Harap jadikan sebagai rujukan sekunder dan konsultasikan pada pakar/Syaikh untuk keputusan akhir.
          </p>
        </div>
      </div>`;
    expertSummary.classList.remove('hidden');
  }
});
