document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    const hadithInput = document.getElementById('hadithInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const bestScoreBadge = document.getElementById('bestScoreBadge');

    const questionnaireSection = document.getElementById('questionnaireSection');
    const questionnaireForm = document.getElementById('questionnaireForm');
    const submitQuestionnaireBtn = document.getElementById('submitQuestionnaireBtn');

    let currentExpertData = null;

    // Add listener for example buttons
    document.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.target.textContent;
            hadithInput.value = text;
            hadithInput.focus();
        });
    });

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const text = hadithInput.value.trim();
        if (!text) return;

        // Reset UI
        searchBtn.disabled = true;
        searchBtn.classList.add('opacity-70', 'cursor-not-allowed');
        loadingIndicator.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        resultsSection.classList.add('hidden');
        resultsList.innerHTML = '';
        
        if (questionnaireSection) {
            questionnaireSection.classList.add('hidden');
        }

        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (!data.success) {
                showError(data.error || 'Terjadi kesalahan pada server');
                return;
            }

            if (!data.topMatches || data.topMatches.length === 0) {
                showError('Teks tidak ditemukan dalam database. Mohon waspada jika hadits ini tidak memiliki sanad yang jelas.');
                return;
            }

            renderResults(data);

        } catch (error) {
            showError('Koneksi sistem bermasalah. Pastikan perangkat Anda terhubung ke internet.');
            console.error(error);
        } finally {
            searchBtn.disabled = false;
            searchBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            loadingIndicator.classList.add('hidden');
        }
    });

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    // ── Kuesioner Interaktif Logic (M1-M5) ──────────────
    if (questionnaireForm) {
        questionnaireForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitQuestionnaireBtn.disabled = true;
            const originalText = submitQuestionnaireBtn.innerText;
            submitQuestionnaireBtn.innerText = 'Mengevaluasi...';

            const formData = new FormData(questionnaireForm);
            const bodyData = {
                m1: formData.get('m1') === 'true',
                m2: formData.get('m2') === 'true',
                m3: formData.get('m3') === 'true',
                m4: formData.get('m4') === 'true',
                m5: formData.get('m5') === 'true'
            };

            try {
                const res = await fetch('/search/evaluate-questionnaire', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData)
                });
                const data = await res.json();
                
                if (data.success) {
                    currentExpertData.manualStatus = data.expertStatus;
                    currentExpertData.manualLabel = data.expertLabel;
                    currentExpertData.manualReason = data.expertReason;
                    
                    renderExpertSummary();
                    // Sembunyikan kuesioner seketika setelah terjawab agar UI sangat rapih
                    questionnaireSection.classList.add('hidden');
                    
                } else {
                    alert('Gagal memproses evaluasi: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan koneksi saat evaluasi');
            } finally {
                submitQuestionnaireBtn.disabled = false;
                submitQuestionnaireBtn.innerText = originalText;
            }
        });
    }

    // ── Render: Hybrid NLP Results (TF-IDF + Cosine Similarity) ──────────────
    function renderResults(data) {
        const tier = data.overallTier;
        const score = data.confidenceScore;

        // Badge utama — warna sesuai tier (NLP layer)
        if (tier === 'found') {
            bestScoreBadge.innerHTML = `<span class="mr-1">✅</span> DAFTAR SHAHIH — Tingkat kesamaan: ${score}`;
            bestScoreBadge.className = 'px-4 py-1.5 bg-green-100 text-green-800 border-2 border-green-300 rounded-full text-sm font-bold shadow-sm inline-flex items-center';
        } else if (tier === 'review') {
            bestScoreBadge.innerHTML = `<span class="mr-1">⚠️</span> PERLU TINJAUAN — Tingkat kesamaan: ${score}`;
            bestScoreBadge.className = 'px-4 py-1.5 bg-amber-100 text-amber-800 border-2 border-amber-300 rounded-full text-sm font-bold shadow-sm inline-flex items-center';
        } else {
            bestScoreBadge.innerHTML = `<span class="mr-1">❌</span> TIDAK DITEMUKAN — Tingkat kesamaan: ${score}`;
            bestScoreBadge.className = 'px-4 py-1.5 bg-red-100 text-red-800 border-2 border-red-300 rounded-full text-sm font-bold shadow-sm inline-flex items-center';
        }

        // Tambahan: ringkasan sistem pakar (rule-based)
        if (data.expertStatus && data.expertLabel) {
            currentExpertData = {
                status: data.expertStatus,
                label: data.expertLabel,
                band: data.expertConfidenceBand,
                reasons: data.expertReasons,
                manualStatus: null,
                manualLabel: null,
                manualReason: null
            };
            renderExpertSummary();
        }

        data.topMatches.forEach((match, index) => {
            const isBestMatch = index === 0;
            const matchTier = match.tier;

            // Palet warna kartu berdasarkan tier
            let cardBg, borderColor, accentColor, badgeClass;
            if (matchTier === 'found') {
                cardBg = 'bg-green-50';
                borderColor = 'border-green-300';
                accentColor = 'bg-green-600';
                badgeClass = 'bg-green-100 text-green-800 border-green-300';
            } else if (matchTier === 'review') {
                cardBg = 'bg-amber-50';
                borderColor = 'border-amber-300';
                accentColor = 'bg-amber-500';
                badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
            } else {
                cardBg = 'bg-red-50';
                borderColor = 'border-red-300';
                accentColor = 'bg-red-500';
                badgeClass = 'bg-red-100 text-red-800 border-red-300';
            }

            const card = document.createElement('div');
            card.className = `p-6 rounded-xl border ${borderColor} ${isBestMatch ? cardBg : 'bg-white'} shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md duration-200`;

            let html = `
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 border-b border-gray-200 pb-3 gap-3">
                    <div class="flex items-center flex-wrap gap-2">
                        <span class="px-3 py-1 bg-gray-800 text-white text-xs font-bold rounded shadow-sm tracking-wider">
                            ${match.book_id.toUpperCase()}
                        </span>
                        <span class="px-3 py-1 bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold rounded shadow-sm">
                            NOMOR ${match.number}
                        </span>
                        ${isBestMatch ? '<span class="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded shadow-sm">BEST MATCH</span>' : ''}
                    </div>
                    <div class="flex flex-col items-start sm:items-end">
                        <div class="text-2xl font-black text-gray-900 tracking-tight">${match.score}</div>
                        <div class="mt-1">
                            <span class="text-[11px] px-2.5 py-1 rounded-full font-bold border ${badgeClass} uppercase tracking-wide">
                                ${match.interpretation}
                            </span>
                        </div>
                    </div>
                </div>
            `;

            if (match.arab) {
                html += `
                    <div class="mb-5 text-right mt-2">
                        <p class="text-3xl font-arabic leading-loose text-gray-900" dir="rtl">${match.arab}</p>
                    </div>
                `;
            }

            html += `
                <div class="bg-white p-4 rounded-lg border border-gray-100 text-gray-700 text-[15px] leading-relaxed relative">
                    <div class="absolute top-0 left-0 w-1 h-full ${accentColor} rounded-l-lg"></div>
                    ${match.translation}
                </div>
            `;

            // Notifikasi khusus per tier pada best match
            if (isBestMatch) {
                if (matchTier === 'found') {
                    html += `
                        <p class="text-sm text-green-700 mt-3 font-medium">
                            Hadits ini ditemukan dalam database dengan referensi: <strong>${match.book_id.toUpperCase()} No. ${match.number}</strong>.
                        </p>
                    `;
                } else if (matchTier === 'review') {
                    html += `
                        <p class="text-sm text-amber-700 mt-3">
                            Kemiripan sedang terdeteksi. Kemungkinan hadits dengan redaksi berbeda. Lakukan verifikasi lebih lanjut ke sumber primer.
                        </p>
                    `;
                } else {
                    html += `
                        <p class="text-sm text-red-700 mt-3">
                            Tidak ditemukan kemiripan signifikan dalam database hadits shahih. Waspadai kemungkinan hadits palsu atau tidak tercatat.
                        </p>
                    `;
                }
            }

            card.innerHTML = html;
            resultsList.appendChild(card);
        });

        resultsSection.classList.remove('hidden');

        // Tampilkan Kuesioner Interaktif jika skor < 0.60 DAN tidak ada alert dari NLP
        if (score < 0.60 && questionnaireSection) {
            const hasRedFlag = data.expertStatus === 'KUAT_INDIKASI_MAUDHU' || 
                               data.expertStatus === 'LA_ASLA_LAHU' ||
                               data.expertStatus === 'HOAKS_BUKAN_HADIS' ||
                               data.expertStatus === 'INDIKASI_MAUDHU_POLITIS' ||
                               data.expertStatus === 'LEMAH_CENDERUNG_TIDAK_SHOHIH';
            
            if (!hasRedFlag) {
                questionnaireSection.classList.remove('hidden');
            }
        }
    }

    // ── Ekstraksi Pembangunan UI Analisis Pakar ──────────────
    function renderExpertSummary() {
        const expertSummary = document.getElementById('expertSummary');
        if (!expertSummary || !currentExpertData) return;

        const isManual = !!currentExpertData.manualStatus;
        const finalStatus = isManual ? currentExpertData.manualStatus : currentExpertData.status;
        
        // Mempersiapkan Tampilan Label dan Tingkat Keyakinan Automatis
        let autoLabelHtml = currentExpertData.label;
        if (!isManual) {
            if (currentExpertData.band === 'strong') autoLabelHtml += ' (Keyakinan: kuat)';
            else if (currentExpertData.band === 'medium') autoLabelHtml += ' (Keyakinan: sedang)';
            else if (currentExpertData.band === 'weak') autoLabelHtml += ' (Keyakinan: lemah)';
        }

        const isAlert = finalStatus === 'KUAT_INDIKASI_MAUDHU' || 
                        finalStatus === 'LA_ASLA_LAHU' ||
                        finalStatus === 'HOAKS_BUKAN_HADIS' ||
                        finalStatus === 'INDIKASI_MAUDHU_POLITIS' ||
                        finalStatus === 'LEMAH_CENDERUNG_TIDAK_SHOHIH';

        const bgClass = isAlert ? 'bg-red-50 border-red-400' : (isManual ? 'bg-indigo-50 border-indigo-300' : 'bg-indigo-50 border-indigo-200');
        const headerClass = isAlert ? 'text-red-800' : 'text-indigo-800';
        const textClass = isAlert ? 'text-red-900' : 'text-indigo-900';
        
        // Menampilkan Banner Waspada jika Alert
        const warningBadge = isAlert 
            ? `<div class="mb-3 text-sm font-bold text-white bg-red-600 px-4 py-1.5 rounded-full inline-flex items-center shadow-md border border-red-700"><svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> PERINGATAN: INDIKASI BERMASALAH</div>` 
            : '';

        let manualHtml = '';
        if (isManual) {
            manualHtml = `
                <div class="mt-4 pt-4 border-t border-opacity-30 border-gray-400 animate-fade-in">
                    <div class="text-xs font-bold ${headerClass} tracking-wider mb-2 uppercase flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Hasil Kuesioner Interaktif Pakar (Manual)
                    </div>
                    <div class="text-base font-extrabold ${textClass} mb-2">${currentExpertData.manualLabel}</div>
                    <p class="text-sm font-semibold ${textClass} mb-2">${currentExpertData.manualReason}</p>
                </div>
            `;
        }

        expertSummary.innerHTML = `
            <div class="mt-4 p-5 rounded-xl border-2 ${bgClass} shadow-sm transition-all duration-300">
                ${warningBadge}
                
                <div class="text-xs font-bold ${headerClass} tracking-wider mb-2 uppercase flex items-center opacity-80">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
                    Analisis Teks NLP (Otomatis)
                </div>
                <div class="text-base font-bold ${textClass} mb-2">${autoLabelHtml}</div>
                ${Array.isArray(currentExpertData.reasons) && currentExpertData.reasons.length > 0
                    ? `<ul class="text-sm ${textClass} list-disc list-inside space-y-1.5 ml-1 mb-3 opacity-90">${currentExpertData.reasons.map(r => `<li>${r}</li>`).join('')}</ul>`
                    : `<p class="mt-1 text-sm ${textClass} mb-3 opacity-90">Tidak ditemukan alasan spesifik dari kata kunci awal.</p>`}
                
                ${manualHtml}

                <div class="mt-3 pt-3 border-t border-opacity-30 border-gray-400">
                    <p class="text-xs ${isAlert ? 'text-red-700' : 'text-indigo-700'} flex items-start opacity-90">
                        <svg class="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>
                        Sistem ini memberikan evaluasi komprehensif berjenjang. Harap jadikan sebagai rujukan sekunder sebelum bertanya pada pakar/Syaikh.
                    </p>
                </div>
            </div>
        `;
        expertSummary.classList.remove('hidden');
    }
});
