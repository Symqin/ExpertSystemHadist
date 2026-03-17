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
                showError('Database kosong atau tidak ditemukan kemiripan di Matan Shahih.');
                return;
            }

            renderResults(data);

        } catch (error) {
            showError('Koneksi ke server gagal. Pastikan backend server node berjalan.');
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

    // ── Render: Hybrid NLP Results (TF-IDF + Cosine Similarity) ──────────────
    function renderResults(data) {
        const tier = data.overallTier;
        const score = data.confidenceScore;

        // Badge utama — warna sesuai tier (NLP layer)
        if (tier === 'found') {
            bestScoreBadge.textContent = 'SHAHIH / DITEMUKAN — Skor NLP: ' + score;
            bestScoreBadge.className = 'px-3 py-1 bg-green-100 text-green-800 border border-green-300 rounded-full text-sm font-bold shadow-sm';
        } else if (tier === 'review') {
            bestScoreBadge.textContent = 'PERLU REVIEW — Skor NLP: ' + score;
            bestScoreBadge.className = 'px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-sm font-bold shadow-sm';
        } else {
            bestScoreBadge.textContent = 'TIDAK DITEMUKAN — Skor NLP: ' + score;
            bestScoreBadge.className = 'px-3 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full text-sm font-bold shadow-sm';
        }

        // Tambahan: ringkasan sistem pakar (rule-based)
        if (data.expertStatus && data.expertLabel) {
            const expertSummary = document.getElementById('expertSummary');
            if (expertSummary) {
                let bandLabel = '';
                if (data.expertConfidenceBand === 'strong') bandLabel = ' (Keyakinan: kuat)';
                else if (data.expertConfidenceBand === 'medium') bandLabel = ' (Keyakinan: sedang)';
                else if (data.expertConfidenceBand === 'weak') bandLabel = ' (Keyakinan: lemah)';

                expertSummary.innerHTML = `
                    <div class="mt-3 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
                        <div class="text-xs font-semibold text-indigo-800 tracking-wide mb-1 uppercase">Sistem Pakar</div>
                        <div class="text-sm font-bold text-indigo-900">${data.expertLabel}${bandLabel}</div>
                        ${Array.isArray(data.expertReasons) && data.expertReasons.length > 0
                            ? `<ul class="mt-2 text-xs text-indigo-900 list-disc list-inside space-y-1">${data.expertReasons.map(r => `<li>${r}</li>`).join('')}</ul>`
                            : '<p class="mt-1 text-xs text-indigo-900">Tidak ada alasan khusus yang diaktifkan selain hasil kemiripan NLP dasar.</p>'}
                        <p class="mt-2 text-[11px] text-indigo-700 italic">Catatan: ini adalah sistem pakar heuristik, bukan pengganti tahqiq ulama. Gunakan sebagai indikator awal, bukan fatwa.</p>
                    </div>
                `;
                expertSummary.classList.remove('hidden');
            }
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
    }
});
