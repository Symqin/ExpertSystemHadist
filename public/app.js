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

        // Reset UI states
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

            if (data.isFake) {
                renderFakeResult(data);
                return;
            }

            if (!data.topMatches || data.topMatches.length === 0) {
                showError('Database kosong atau tidak ditemukan kemiripan di Matan Shahih.');
                return;
            }

            renderResults(data);

        } catch (error) {
            showError('Koneksi ke server gagal. Pastikan backend server node berjalan pada port.');
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

    function renderFakeResult(data) {
        bestScoreBadge.textContent = 'STATUS: MAUDHU / DHAIF';
        bestScoreBadge.className = 'px-3 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full text-sm font-bold shadow-sm animate-pulse';

        const card = document.createElement('div');
        card.className = `p-6 rounded-xl border border-red-300 bg-red-50 shadow-sm`;

        let html = `
            <div class="flex items-center mb-4 border-b border-red-200 pb-3 gap-2">
                <span class="px-3 py-1 bg-red-700 text-white text-xs font-bold rounded flex items-center shadow-sm">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                    TERDETEKSI PALSU (MAUDHU)
                </span>
                <span class="px-3 py-1 bg-white text-red-800 border border-red-200 text-xs font-bold rounded shadow-sm">
                    ${data.status}
                </span>
            </div>
            
            <div class="bg-white p-5 rounded-lg border border-red-100 text-gray-800 text-[15px] leading-relaxed relative">
                <div class="absolute top-0 left-0 w-1 h-full bg-red-600 rounded-l-lg"></div>
                <h4 class="font-bold text-red-800 mb-2">Penjelasan Sanad & Ulama:</h4>
                <p>${data.reasoning.replace(/\n\n/g, '</p><p class="mt-2">')}</p>
            </div>
            <p class="text-sm text-red-600 mt-4 italic">*Peringatan: Berdusta atas nama Nabi adalah dosa besar. Jangan disebarkan.</p>
        `;
        
        card.innerHTML = html;
        resultsList.appendChild(card);
        resultsSection.classList.remove('hidden');
    }

    function renderResults(data) {
        bestScoreBadge.textContent = 'Top Confidence Score: ' + data.confidenceScore;
        bestScoreBadge.className = 'px-3 py-1 bg-green-100 text-green-800 border border-green-200 rounded-full text-sm font-bold shadow-sm';
        
        data.topMatches.forEach((match, index) => {
            const isBestMatch = index === 0;
            const bgClass = isBestMatch ? 'bg-teal-50 border-teal-300' : 'bg-white border-gray-200';
            
            // Jaro-Winkler Interpretation
            let badgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
            if (match.interpretation === 'Sangat Mirip') badgeClass = 'bg-green-100 text-green-800 border-green-200';
            else if (match.interpretation === 'Mirip') badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
            else if (match.interpretation === 'Kurang Mirip') badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            else badgeClass = 'bg-red-100 text-red-800 border-red-200';

            const card = document.createElement('div');
            card.className = `p-6 rounded-xl border ${bgClass} shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md duration-200`;
            
            let html = `
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 border-b border-gray-200 pb-3 gap-3">
                    <div class="flex items-center flex-wrap gap-2">
                        <span class="px-3 py-1 bg-gray-800 text-white text-xs font-bold rounded shadow-sm tracking-wider">
                            ${match.book_id.toUpperCase()}
                        </span>
                        <span class="px-3 py-1 bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold rounded shadow-sm">
                            NOMOR ${match.number}
                        </span>
                        ${isBestMatch ? '<span class="px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded shadow-sm flex items-center">✨ BEST MATCH</span>' : ''}
                    </div>
                    <div class="flex flex-col items-start sm:items-end">
                        <div class="text-2xl font-black text-gray-900 tracking-tight">${match.score}</div>
                        <div class="mt-1"><span class="text-[11px] px-2.5 py-1 rounded-full font-bold border ${badgeClass} uppercase tracking-wide">${match.interpretation}</span></div>
                    </div>
                </div>
            `;

            if (match.arab) {
                html += `<div class="mb-5 text-right mt-2">
                            <p class="text-3xl font-arabic leading-loose text-gray-900" dir="rtl">${match.arab}</p>
                         </div>`;
            }

            html += `<div class="bg-white p-4 justify-between rounded-lg border border-gray-100 text-gray-700 text-[15px] leading-relaxed relative">
                        <div class="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-lg"></div>
                        ${match.translation}
                     </div>`;
            
            card.innerHTML = html;
            resultsList.appendChild(card);
        });

        resultsSection.classList.remove('hidden');
    }
});
