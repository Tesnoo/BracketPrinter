// === グローバル状態管理 ===
let poolsData = {};
let maxPoolPlayerCount = 24;
let isCsvValid = false;
let baseBoValue = '';
let isCustomBoConfirmed = false;
let pendingLogoDataUrl = null;
let pendingTextBoxesCount = 0;
let isPrintingMode = false;

let recommendedPrintConfig = {
    size: 'A3',
    orientation: 'landscape',
    margin: 'standard',
    reason: '17〜32人 ダブルエリミの推奨設定'
};

const csvUpload = document.getElementById('csv-upload');
const csvStatus = document.getElementById('csv-status');
const poolSelectWrapper = document.getElementById('pool-select-wrapper');
const poolSelect = document.getElementById('pool-select');
const elimFormatSelect = document.getElementById('elim-format-select');
const generateBtn = document.getElementById('generate-btn');
const winnersAdvanceCount = document.getElementById('winners-advance-count');
const losersAdvanceCount = document.getElementById('losers-advance-count');
const losersAdvanceWrapper = document.getElementById('losers-advance-wrapper');
const losersRoundChangeBlock = document.getElementById('losers-round-change-block');
const baseBoSelect = document.getElementById('base-bo-select');
const targetPhaseInput = document.getElementById('target-phase-input');

const printSizeSelect = document.getElementById('print-size');
const printOrientationSelect = document.getElementById('print-orientation');
const printMarginSelect = document.getElementById('print-margin');
const printRecStatusBadge = document.getElementById('print-rec-status-badge');
const printRecReasonText = document.getElementById('print-rec-reason-text');
const resetPrintRecBtn = document.getElementById('reset-print-rec-btn');
const recSizeBadge = document.getElementById('rec-size-badge');
const recOrientationBadge = document.getElementById('rec-orientation-badge');
const dynamicPrintStyle = document.getElementById('dynamic-print-style');

const logoUpload = document.getElementById('logo-upload');
const clearLogoBtn = document.getElementById('clear-logo-btn');
const logoDisplayContainer = document.getElementById('logo-display-container');
const logoDisplayImg = document.getElementById('logo-display-img');
const addTextBtn = document.getElementById('add-text-btn');
const customTextsLayer = document.getElementById('custom-texts-layer');

const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const scaleWrapper = document.getElementById('preview-scale-wrapper');
const previewArea = document.getElementById('preview-area');
const viewport = document.getElementById('preview-viewport');

// === トーナメント形式（ダブル/シングル）切り替え時のUI連動 ===
elimFormatSelect.addEventListener('change', () => {
    const isSingle = elimFormatSelect.value === 'single';
    if (isSingle) {
        losersAdvanceCount.disabled = true;
        losersAdvanceCount.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        losersAdvanceWrapper.classList.add('opacity-50');
        losersRoundChangeBlock.classList.add('hidden');
    } else {
        losersAdvanceCount.disabled = false;
        losersAdvanceCount.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        losersAdvanceWrapper.classList.remove('opacity-50');
        losersRoundChangeBlock.classList.remove('hidden');
    }
    updateRecommendedPrintConfig(true);
    validateForm();
});

// === 推奨印刷設定の算出（ダブルエリミは横向きに統一して安定化） ===
function updateRecommendedPrintConfig(autoSelect = true) {
    const isSingleElim = elimFormatSelect.value === 'single';
    const n = maxPoolPlayerCount || 24;

    if (isSingleElim) {
        recommendedPrintConfig = {
            size: 'A4',
            orientation: 'portrait',
            margin: 'standard',
            reason: `8〜32人 シングルエリミの推奨設定 (最大${n}人)`
        };
    } else if (n <= 16) {
        recommendedPrintConfig = {
            size: 'A4',
            orientation: 'landscape',
            margin: 'standard',
            reason: `8〜16人 ダブルエリミの推奨設定 (最大${n}人)`
        };
    } else {
        recommendedPrintConfig = {
            size: 'A3',
            orientation: 'landscape',
            margin: 'standard',
            reason: `17〜32人 ダブルエリミの推奨設定 (最大${n}人)`
        };
    }

    if (autoSelect) {
        printSizeSelect.value = recommendedPrintConfig.size;
        printOrientationSelect.value = recommendedPrintConfig.orientation;
        printMarginSelect.value = recommendedPrintConfig.margin;
    }

    refreshPrintOptionDecorations();
}

function refreshPrintOptionDecorations() {
    Array.from(printSizeSelect.options).forEach(opt => {
        const baseLabel = opt.value;
        opt.textContent = (opt.value === recommendedPrintConfig.size) ? `${baseLabel} ★推奨` : baseLabel;
    });

    Array.from(printOrientationSelect.options).forEach(opt => {
        const baseLabel = opt.value === 'landscape' ? '横 (Landscape)' : '縦 (Portrait)';
        opt.textContent = (opt.value === recommendedPrintConfig.orientation) ? `${baseLabel} ★推奨` : baseLabel;
    });

    Array.from(printMarginSelect.options).forEach(opt => {
        const labelMap = { standard: '標準', wide: '広い', narrow: '狭い' };
        const baseLabel = labelMap[opt.value] || opt.value;
        opt.textContent = (opt.value === recommendedPrintConfig.margin) ? `${baseLabel} ★推奨` : baseLabel;
    });

    recSizeBadge.textContent = `★推奨: ${recommendedPrintConfig.size}`;
    recOrientationBadge.textContent = `★推奨: ${recommendedPrintConfig.orientation === 'landscape' ? '横 (Landscape)' : '縦 (Portrait)'}`;
    printRecReasonText.textContent = `💡 ${recommendedPrintConfig.reason}`;

    const isMatchingRec =
        printSizeSelect.value === recommendedPrintConfig.size &&
        printOrientationSelect.value === recommendedPrintConfig.orientation &&
        printMarginSelect.value === recommendedPrintConfig.margin;

    if (isMatchingRec) {
        printRecStatusBadge.textContent = '★推奨設定';
        printRecStatusBadge.className = 'bg-orange-100 text-[#FA8534] border border-orange-200 text-[10px] px-1.5 py-0.5 rounded font-bold';
        resetPrintRecBtn.classList.add('hidden');
    } else {
        printRecStatusBadge.textContent = 'カスタム設定';
        printRecStatusBadge.className = 'bg-gray-200 text-gray-600 border border-gray-300 text-[10px] px-1.5 py-0.5 rounded font-bold';
        resetPrintRecBtn.classList.remove('hidden');
    }
}

printSizeSelect.addEventListener('change', refreshPrintOptionDecorations);
printOrientationSelect.addEventListener('change', refreshPrintOptionDecorations);
printMarginSelect.addEventListener('change', refreshPrintOptionDecorations);

resetPrintRecBtn.addEventListener('click', () => {
    printSizeSelect.value = recommendedPrintConfig.size;
    printOrientationSelect.value = recommendedPrintConfig.orientation;
    printMarginSelect.value = recommendedPrintConfig.margin;
    refreshPrintOptionDecorations();
});

// === 用紙サイズ・向き・余白の動的レイアウト計算 ===
const PAPER_DIMENSIONS_MM = {
    A3: { short: 297, long: 420 },
    B4: { short: 257, long: 364 },
    A4: { short: 210, long: 297 },
    B5: { short: 182, long: 257 },
    A5: { short: 148, long: 210 }
};

const MARGIN_PRESETS = {
    standard: { v: 28, h: 32 },
    wide: { v: 48, h: 52 },
    narrow: { v: 14, h: 16 }
};

function applyPrintAndDrawOptions() {
    const sizeKey = printSizeSelect.value || 'A3';
    const orientation = printOrientationSelect.value || 'landscape';
    const marginKey = printMarginSelect.value || 'standard';

    const margin = MARGIN_PRESETS[marginKey] || MARGIN_PRESETS.standard;
    previewArea.style.padding = `${margin.v}px ${margin.h}px`;

    logoDisplayContainer.style.bottom = `${margin.v}px`;
    logoDisplayContainer.style.right = `${margin.h}px`;

    const headerEl = document.getElementById('preview-header');
    const sheetBodyEl = document.getElementById('main-sheet-body');
    const bracketEl = document.getElementById('bracket-container');
    const rosterEl = document.getElementById('checkin-roster-container');
    const isSheetDrawn = !sheetBodyEl.classList.contains('hidden');

    let naturalHeight = 1600;
    let naturalWidth = 1900;

    if (isSheetDrawn) {
        // 計測時は固定高さを解除し、コンテンツ本来の高さを取得（上端見切れ防止）
        previewArea.style.height = 'auto';
        previewArea.style.minHeight = '0px';

        const wContainer = bracketEl.children[0];
        const lContainer = bracketEl.children[1];

        const wWidth = wContainer ? wContainer.offsetWidth : 0;
        const lWidth = lContainer ? lContainer.offsetWidth : 0;
        const rosterWidth = rosterEl ? rosterEl.offsetWidth : 0;
        const rosterHeight = rosterEl ? rosterEl.offsetHeight : 0;

        naturalWidth = Math.max(wWidth + 36 + rosterWidth, lWidth);
        const bracketTotalHeight = bracketEl.offsetHeight;
        naturalHeight = headerEl.offsetHeight + 16 + Math.max(bracketTotalHeight, rosterHeight);
    }

    const paperRatio = Math.SQRT2;
    let canvasWidth, canvasHeight;

    if (orientation === 'landscape') {
        canvasHeight = Math.max(naturalHeight + margin.v * 2, Math.round((naturalWidth + margin.h * 2) / paperRatio));
        canvasWidth = Math.round(canvasHeight * paperRatio);
    } else {
        canvasWidth = Math.max(naturalWidth + margin.h * 2, Math.round((naturalHeight + margin.v * 2) / paperRatio));
        canvasHeight = Math.round(canvasWidth * paperRatio);
    }

    previewArea.style.width = `${canvasWidth}px`;
    previewArea.style.minHeight = `${canvasHeight}px`;
    previewArea.style.height = `${canvasHeight}px`;

    const paperMm = PAPER_DIMENSIONS_MM[sizeKey] || PAPER_DIMENSIONS_MM.A3;
    const pageWidthMm = orientation === 'landscape' ? paperMm.long : paperMm.short;
    const pageHeightMm = orientation === 'landscape' ? paperMm.short : paperMm.long;

    const mmToPx = 96 / 25.4;
    const targetPrintHeightPx = pageHeightMm * mmToPx;
    const targetPrintWidthPx = pageWidthMm * mmToPx;

    const printScale = Math.min(targetPrintWidthPx / canvasWidth, targetPrintHeightPx / canvasHeight) * 0.995;

    dynamicPrintStyle.textContent = `
        @page {
            size: ${sizeKey} ${orientation};
            margin: 0mm;
        }
        @media print {
            #preview-area {
                width: ${canvasWidth}px !important;
                height: ${canvasHeight}px !important;
                min-height: ${canvasHeight}px !important;
                transform: scale(${printScale.toFixed(5)}) !important;
                transform-origin: top left !important;
            }
        }
    `;

    if (pendingLogoDataUrl) {
        logoDisplayImg.src = pendingLogoDataUrl;
        logoDisplayContainer.classList.remove('hidden');
    } else {
        logoDisplayImg.src = '';
        logoDisplayContainer.classList.add('hidden');
    }

    while (pendingTextBoxesCount > 0) {
        createDraggableTextBox();
        pendingTextBoxesCount--;
    }

    setZoom(Number(zoomSlider.value));
}

// === ロゴ・テキストボックス制御 ===
logoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        pendingLogoDataUrl = null;
        clearLogoBtn.classList.add('hidden');
        return;
    }
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
        alert('ロゴ画像はPNGファイル（.png）のみ対応しています。');
        logoUpload.value = '';
        pendingLogoDataUrl = null;
        clearLogoBtn.classList.add('hidden');
        return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
        pendingLogoDataUrl = ev.target.result;
        clearLogoBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
});

clearLogoBtn.addEventListener('click', () => {
    logoUpload.value = '';
    pendingLogoDataUrl = null;
    clearLogoBtn.classList.add('hidden');
});

function createDraggableTextBox(initialX = 1280, initialY = 820) {
    const box = document.createElement('div');
    box.className = 'draggable-text-box pointer-events-auto';
    box.style.left = `${initialX}px`;
    box.style.top = `${initialY}px`;

    const controls = document.createElement('div');
    controls.className = 'text-box-controls';

    const dragLabel = document.createElement('span');
    dragLabel.textContent = '⠿ ドラッグ移動';

    const rightControls = document.createElement('div');
    rightControls.className = 'flex items-center gap-1';

    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'border border-gray-300 rounded text-[10px] bg-white px-1 py-0.5 cursor-pointer';
    [
        { label: '小', size: '14px' },
        { label: '中', size: '18px' },
        { label: '大', size: '24px' },
        { label: '特大', size: '32px' }
    ].forEach((opt, idx) => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.size;
        optionEl.textContent = opt.label;
        if (idx === 1) optionEl.selected = true;
        sizeSelect.appendChild(optionEl);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'text-gray-500 hover:text-red-600 font-bold px-1.5 leading-none';
    deleteBtn.title = '削除';

    rightControls.append(sizeSelect, deleteBtn);
    controls.append(dragLabel, rightControls);

    const content = document.createElement('div');
    content.className = 'draggable-text-content';
    content.contentEditable = 'true';
    content.style.fontSize = '18px';
    content.textContent = 'テキストを入力';

    sizeSelect.addEventListener('change', (e) => {
        content.style.fontSize = e.target.value;
    });

    deleteBtn.addEventListener('click', () => {
        box.remove();
    });

    let isDragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    controls.addEventListener('mousedown', (e) => {
        if (e.target === sizeSelect || e.target === deleteBtn) return;
        isDragging = true;
        startClientX = e.clientX;
        startClientY = e.clientY;
        initialLeft = parseFloat(box.style.left) || 0;
        initialTop = parseFloat(box.style.top) || 0;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const scale = Number(zoomSlider.value) / 100;
        const dx = (e.clientX - startClientX) / scale;
        const dy = (e.clientY - startClientY) / scale;
        box.style.left = `${Math.max(0, Math.round(initialLeft + dx))}px`;
        box.style.top = `${Math.max(0, Math.round(initialTop + dy))}px`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    box.append(controls, content);
    customTextsLayer.appendChild(box);
}

addTextBtn.addEventListener('click', () => {
    const isSheetDrawn = !document.getElementById('main-sheet-body').classList.contains('hidden');
    if (isSheetDrawn) {
        const offset = (customTextsLayer.children.length % 5) * 30;
        createDraggableTextBox(1280 + offset, 820 + offset);
    } else {
        pendingTextBoxesCount++;
        alert('テキストボックスを追加予約しました。「ブラケットを描画する」を押すとシート上に配置されます。');
    }
});

// === 入力バリデーション ===
function validateForm() {
    const formatVal = elimFormatSelect.value;
    const wVal = winnersAdvanceCount.value;
    const lVal = losersAdvanceCount.value;
    const isLReady = (formatVal === 'single') ? true : Boolean(lVal);
    const boVal = baseBoSelect.value;
    const isBoReady = (boVal === '5' || boVal === '3' || (boVal === 'custom' && isCustomBoConfirmed));
    const phaseVal = targetPhaseInput.value.trim();

    if (isCsvValid && formatVal && wVal && isLReady && isBoReady && phaseVal !== '') {
        generateBtn.disabled = false;
        generateBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        generateBtn.classList.add('bg-[#FA8534]', 'text-white', 'hover:bg-orange-600', 'shadow');
    } else {
        generateBtn.disabled = true;
        generateBtn.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
        generateBtn.classList.remove('bg-[#FA8534]', 'text-white', 'hover:bg-orange-600', 'shadow');
    }
}

winnersAdvanceCount.addEventListener('change', validateForm);
losersAdvanceCount.addEventListener('change', validateForm);
targetPhaseInput.addEventListener('input', validateForm);

// === 手順1: CSVファイルの読み込みと検証 ===
csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        resetCsvInput();
        return;
    }

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
            const rows = results.data;
            if (!rows || rows.length < 2) {
                alert('エラー: CSVファイルにデータが含まれていません。');
                resetCsvInput();
                return;
            }

            const header = rows[0].map(col => (col || '').trim());
            const c1 = header[2];
            const d1 = header[3];
            const m1 = header[12];
            const n1 = header[13];

            if (c1 !== 'Pool' || d1 !== 'Pool Seed' || m1 !== 'Player GamerTag' || n1 !== 'Player Short GamerTag') {
                alert(
                    'エラー: CSVの列ヘッダーが規定の形式と一致しません。\n\n' +
                    `C1: "${c1 || ''}" (期待値: "Pool")\n` +
                    `D1: "${d1 || ''}" (期待値: "Pool Seed")\n` +
                    `M1: "${m1 || ''}" (期待値: "Player GamerTag")\n` +
                    `N1: "${n1 || ''}" (期待値: "Player Short GamerTag")`
                );
                resetCsvInput();
                return;
            }

            const parsedPools = {};
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const rawPoolName = (row[2] || '').trim();
                const seedStr = (row[3] || '').trim();
                if (!rawPoolName || !seedStr) continue;

                const poolName = rawPoolName.replace(/00$/, '') || rawPoolName;
                const seed = parseInt(seedStr, 10);
                if (isNaN(seed)) continue;

                const gamerTag = (row[12] || '').trim();
                const shortGamerTag = (row[13] || '').trim();

                if (!parsedPools[poolName]) {
                    parsedPools[poolName] = { count: 0, playersBySeed: {} };
                }
                parsedPools[poolName].count += 1;
                parsedPools[poolName].playersBySeed[seed] = {
                    gamerTag: gamerTag,
                    shortGamerTag: shortGamerTag
                };
            }

            const poolNames = Object.keys(parsedPools);
            if (poolNames.length === 0) {
                alert('エラー: 有効なプール・プレイヤーデータが見つかりませんでした。');
                resetCsvInput();
                return;
            }

            poolsData = parsedPools;
            isCsvValid = true;

            maxPoolPlayerCount = Math.max(...poolNames.map(pName => parsedPools[pName].count));
            updateRecommendedPrintConfig(true);

            poolSelect.innerHTML = '';
            poolNames.forEach(pName => {
                const opt = document.createElement('option');
                opt.value = pName;
                opt.textContent = `Pool ${pName} (${parsedPools[pName].count}人)`;
                poolSelect.appendChild(opt);
            });

            if (poolNames.length > 1) {
                poolSelectWrapper.classList.remove('hidden');
            } else {
                poolSelectWrapper.classList.add('hidden');
            }

            const firstPool = poolNames[0];
            csvStatus.textContent = `✅ 読み込み完了: Pool ${firstPool} (${parsedPools[firstPool].count}人 / 最大${maxPoolPlayerCount}人基準)`;
            csvStatus.className = 'text-[11px] text-green-600 font-bold';
            csvStatus.classList.remove('hidden');

            validateForm();
        },
        error: (err) => {
            console.error(err);
            alert('CSVファイルの読み込み中にエラーが発生しました。');
            resetCsvInput();
        }
    });
});

poolSelect.addEventListener('change', () => {
    const selected = poolSelect.value;
    if (poolsData[selected]) {
        csvStatus.textContent = `✅ 選択中: Pool ${selected} (${poolsData[selected].count}人 / 最大${maxPoolPlayerCount}人基準)`;
    }
});

function resetCsvInput() {
    csvUpload.value = '';
    isCsvValid = false;
    poolsData = {};
    csvStatus.classList.add('hidden');
    poolSelectWrapper.classList.add('hidden');
    validateForm();
}

// === 手順4: 基本Bo設定と奇数チェック ===
const customBoContainer = document.getElementById('custom-bo-container');
const customBoInput = document.getElementById('custom-bo-input');
const customBoApplyBtn = document.getElementById('custom-bo-apply-btn');
const customBoConfirmArea = document.getElementById('custom-bo-confirm-area');
const customBoConfirmText = document.getElementById('custom-bo-confirm-text');
const customBoConfirmYes = document.getElementById('custom-bo-confirm-yes');
const customBoConfirmNo = document.getElementById('custom-bo-confirm-no');

baseBoSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customBoContainer.classList.remove('hidden');
        isCustomBoConfirmed = false;
    } else {
        customBoContainer.classList.add('hidden');
        customBoConfirmArea.classList.add('hidden');
        customBoInput.value = '';
        baseBoValue = e.target.value;
        isCustomBoConfirmed = true;
    }
    validateForm();
});

customBoInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

customBoApplyBtn.addEventListener('click', () => {
    const val = parseInt(customBoInput.value.trim(), 10);
    if (!val || val <= 0) {
        alert('有効な数字を入力してください。');
        return;
    }
    if (val % 2 === 0) {
        alert('最大セット数は奇数でなければいけません（例: 3, 5, 7, 9...）。');
        customBoInput.focus();
        return;
    }
    const gamesToWin = Math.ceil(val / 2);
    customBoConfirmText.textContent = `Bo${val} / ${gamesToWin}本先取 でよろしいですか？`;
    customBoConfirmArea.classList.remove('hidden');
});

customBoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') customBoApplyBtn.click();
});

customBoConfirmYes.addEventListener('click', () => {
    baseBoValue = customBoInput.value.trim();
    isCustomBoConfirmed = true;
    customBoConfirmArea.classList.add('hidden');
    customBoContainer.classList.add('hidden');
    alert(`基本最大セット数を Bo${baseBoValue} に設定しました。`);
    validateForm();
});

customBoConfirmNo.addEventListener('click', () => {
    customBoConfirmArea.classList.add('hidden');
    customBoInput.value = '';
    isCustomBoConfirmed = false;
    customBoInput.focus();
    validateForm();
});

// === 手順5: 途中で最大セット数を変更 ===
const changeModeRadios = document.querySelectorAll('input[name="change-mode"]');
const roundChangeContainer = document.getElementById('round-change-container');
const winnersRoundSelect = document.getElementById('winners-round-select');
const losersRoundSelect = document.getElementById('losers-round-select');
const winnersBoSelect = document.getElementById('winners-bo-select');
const winnersCustomInput = document.getElementById('winners-custom-input');
const losersBoSelect = document.getElementById('losers-bo-select');
const losersCustomInput = document.getElementById('losers-custom-input');

changeModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'yes') {
            roundChangeContainer.classList.remove('hidden');
        } else {
            roundChangeContainer.classList.add('hidden');
            winnersRoundSelect.value = 'none';
            losersRoundSelect.value = 'none';
        }
    });
});

winnersBoSelect.addEventListener('change', (e) => {
    winnersCustomInput.classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value !== 'custom') winnersCustomInput.value = '';
});
winnersCustomInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

losersBoSelect.addEventListener('change', (e) => {
    losersCustomInput.classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value !== 'custom') losersCustomInput.value = '';
});
losersCustomInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

const winnersRoundOrder = [
    'Winners Round 1',
    'Winners Round 2',
    'Winners Quarter-Final',
    'Winners Semi-Final',
    'Winners Final'
];

const losersRoundOrder = [
    'Losers Round 1',
    'Losers Round 2',
    'Losers Round 3',
    'Losers Round 4',
    'Losers Round 5',
    'Losers Quarter-Final',
    'Losers Semi-Final',
    'Losers Final'
];

function getRoundBo(roundBaseName, bracketType) {
    const isChangeYes = document.querySelector('input[name="change-mode"]:checked').value === 'yes';
    if (!isChangeYes) return baseBoValue;

    if (bracketType === 'winners') {
        const selectedStart = winnersRoundSelect.value;
        if (selectedStart === 'none') return baseBoValue;
        if (winnersRoundOrder.indexOf(roundBaseName) >= winnersRoundOrder.indexOf(selectedStart)) {
            let bo = winnersBoSelect.value;
            if (bo === 'custom') {
                const customVal = parseInt(winnersCustomInput.value.trim(), 10);
                if (customVal && customVal > 0 && customVal % 2 !== 0) return customVal;
            } else {
                return bo;
            }
        }
    } else if (bracketType === 'losers') {
        const selectedStart = losersRoundSelect.value;
        if (selectedStart === 'none') return baseBoValue;
        if (losersRoundOrder.indexOf(roundBaseName) >= losersRoundOrder.indexOf(selectedStart)) {
            let bo = losersBoSelect.value;
            if (bo === 'custom') {
                const customVal = parseInt(losersCustomInput.value.trim(), 10);
                if (customVal && customVal > 0 && customVal % 2 !== 0) return customVal;
            } else {
                return bo;
            }
        }
    }
    return baseBoValue;
}

// === アコーディオン開閉 ===
document.querySelectorAll('.accordion-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const content = button.nextElementSibling;
        const arrow = button.querySelector('span:last-child');
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'flex';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            content.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        }
    });
});

// === 要素生成ヘルパー ===
function createElement(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function indexToMatchLabel(index) {
    let label = '';
    let n = index;
    while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    }
    return label;
}

function createSpacerNode() {
    const wrapper = createElement('div', 'match-wrapper');
    const dummyBox = createElement('div', '');
    dummyBox.style.height = '52px';
    wrapper.appendChild(dummyBox);
    return wrapper;
}

function createMatchNode(matchLabel, player1Name, player2Name, seed1 = '', seed2 = '', lineType = 'none', topLabel = '', bottomLabel = '') {
    const wrapper = createElement('div', 'match-wrapper');
    if (lineType === 'branch') wrapper.classList.add('branch-line');
    if (lineType === 'straight') wrapper.classList.add('straight-line');

    const matchBox = createElement('div', 'match-box');

    if (topLabel) matchBox.appendChild(createElement('span', 'drop-label-top', topLabel));
    if (bottomLabel) matchBox.appendChild(createElement('span', 'drop-label-bottom', bottomLabel));

    const labelEl = createElement('div', 'match-label', matchLabel);
    matchBox.appendChild(labelEl);

    const mainBoxArea = createElement('div', 'main-box-area');
    const checkboxContainer = createElement('div', 'checkbox-container');
    checkboxContainer.appendChild(createElement('div', 'checkbox-square'));
    mainBoxArea.appendChild(checkboxContainer);

    const playersArea = createElement('div', 'player-slots-area');
    
    const p1Slot = createElement('div', 'player-slot');
    p1Slot.appendChild(createElement('span', 'player-name-text', player1Name));
    if (seed1) p1Slot.appendChild(createElement('span', 'seed-label', String(seed1)));
    playersArea.appendChild(p1Slot);
    
    const p2Slot = createElement('div', 'player-slot');
    p2Slot.appendChild(createElement('span', 'player-name-text', player2Name));
    if (seed2) p2Slot.appendChild(createElement('span', 'seed-label', String(seed2)));
    playersArea.appendChild(p2Slot);
    
    mainBoxArea.appendChild(playersArea);

    const scoreArea = createElement('div', 'score-box-area');
    scoreArea.appendChild(createElement('div', 'score-box'));
    scoreArea.appendChild(createElement('div', 'score-box'));
    mainBoxArea.appendChild(scoreArea);

    matchBox.appendChild(mainBoxArea);
    wrapper.appendChild(matchBox);
    return wrapper;
}

function createQualifierNode(matchSourceLabel, targetPhase, targetType = 'W', includeLoserSlot = false, lineType = 'straight') {
    const wrapper = createElement('div', 'match-wrapper');
    if (lineType === 'straight') wrapper.classList.add('straight-line');

    const box = createElement('div', 'qualifier-box');
    box.appendChild(createElement('span', 'qual-drop-label-top', `Winner of ${matchSourceLabel}`));

    if (targetType === 'W' && includeLoserSlot) {
        box.style.height = '52px';
        const slot1 = createElement('div', 'qualifier-slot border-b border-black', `${targetPhase} [W]`);
        box.appendChild(slot1);
        const slot2 = createElement('div', 'qualifier-slot', `${targetPhase} [L]`);
        box.appendChild(slot2);
        box.appendChild(createElement('span', 'qual-drop-label-bottom', `Loser of ${matchSourceLabel}`));
    } else {
        box.style.height = '28px';
        box.appendChild(createElement('div', 'qualifier-slot', `${targetPhase} [${targetType}]`));
    }

    wrapper.appendChild(box);
    return wrapper;
}

function createRoundColumn(roundName, bracketType = 'winners', isQualifier = false) {
    const roundCol = createElement('div', isQualifier ? 'round-col qualifier-col' : 'round-col');
    let displayRoundName = roundName;
    if (roundName) {
        const baseNameClean = roundName.replace(/ \[Bo\d+\]$/, '');
        const boToUse = getRoundBo(baseNameClean, bracketType);
        displayRoundName = `${baseNameClean} [Bo${boToUse}]`;
    }
    const header = createElement('div', 'round-header', displayRoundName || '\u00A0');
    if (!roundName) header.style.visibility = 'hidden';
    roundCol.appendChild(header);
    return roundCol;
}

function createCheckinRosterTable(currentPool, playerCount) {
    const table = createElement('table', 'checkin-table');

    const thead = createElement('thead');
    const headerRow = createElement('tr');
    headerRow.appendChild(createElement('th', '', 'Check-in'));
    headerRow.appendChild(createElement('th', '', 'Gamer Tag'));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createElement('tbody');
    const seeds = Object.keys(currentPool.playersBySeed).map(Number).sort((a, b) => a - b);
    const rowCount = Math.max(playerCount, seeds.length);

    for (let i = 1; i <= rowCount; i++) {
        const player = currentPool.playersBySeed[i];
        const fullGamerTag = player ? (player.gamerTag || player.shortGamerTag || '') : '';

        const tr = createElement('tr');
        const tdCheck = createElement('td');
        const checkInner = createElement('div', 'checkin-cell-inner');
        checkInner.appendChild(createElement('div', 'checkbox-square'));
        tdCheck.appendChild(checkInner);

        const tdTag = createElement('td');
        tdTag.appendChild(createElement('span', 'gamertag-cell-text', fullGamerTag));

        tr.append(tdCheck, tdTag);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    return table;
}

// === ズームコントロール ===
function setZoom(percent) {
    if (isPrintingMode) return;
    const scale = percent / 100;
    zoomSlider.value = percent;
    zoomValue.textContent = `${percent}%`;
    scaleWrapper.style.transform = `scale(${scale})`;
    scaleWrapper.style.width = `${previewArea.offsetWidth * scale}px`;
    scaleWrapper.style.height = `${previewArea.offsetHeight * scale}px`;
}

function fitToViewport() {
    if (isPrintingMode) return;
    const availableWidth = viewport.clientWidth - 48;
    const availableHeight = viewport.clientHeight - 48;
    const contentWidth = previewArea.offsetWidth;
    const contentHeight = previewArea.offsetHeight;

    if (contentWidth > 0 && contentHeight > 0) {
        const scaleW = availableWidth / contentWidth;
        const scaleH = availableHeight / contentHeight;
        const bestScale = Math.min(scaleW, scaleH);
        const bestPercent = Math.min(100, Math.max(20, Math.floor(bestScale * 100)));
        setZoom(bestPercent);
    }
}

zoomSlider.addEventListener('input', (e) => setZoom(Number(e.target.value)));
document.getElementById('zoom-reset-btn').addEventListener('click', () => setZoom(100));
document.getElementById('zoom-fit-btn').addEventListener('click', fitToViewport);
window.addEventListener('resize', fitToViewport);

let savedZoomBeforePrint = 100;
window.addEventListener('beforeprint', () => {
    savedZoomBeforePrint = Number(zoomSlider.value);
    isPrintingMode = true;
    scaleWrapper.style.transform = 'none';
    scaleWrapper.style.width = 'auto';
    scaleWrapper.style.height = 'auto';
});

window.addEventListener('afterprint', () => {
    isPrintingMode = false;
    setZoom(savedZoomBeforePrint);
});

updateRecommendedPrintConfig(true);
applyPrintAndDrawOptions();
fitToViewport();

// === 勝者側 W1 / W2 / W4 終端構築ヘルパー ===
function appendWinnersEndingByCount(wContainer, wCountNum, lCountNum, targetPhaseName, nextLabel) {
    const wr3 = createRoundColumn('Winners Quarter-Final', 'winners');
    const wr4 = createRoundColumn('Winners Semi-Final', 'winners');
    const wr5 = createRoundColumn('Winners Final', 'winners');
    const wQual = createRoundColumn('', 'winners', true);

    const wqfLabels = [];
    const wsfLabels = [];
    let wfLabel = null;

    for (let i = 0; i < 4; i++) {
        const lbl = nextLabel();
        wqfLabels.push(lbl);
        wr3.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    const includeLoserSlotOnFinalW = (lCountNum >= 2 * wCountNum && lCountNum > 0);

    if (wCountNum === 4) {
        for (let i = 0; i < 4; i++) {
            wQual.appendChild(createQualifierNode(wqfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'straight'));
        }
        wContainer.append(wr3, wQual);
        for (let s = 0; s < 5; s++) nextLabel();
        return { wqfLabels, wsfLabels, wfLabel };
    }

    for (let i = 0; i < 2; i++) {
        const lbl = nextLabel();
        wsfLabels.push(lbl);
        wr4.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    if (wCountNum === 2) {
        for (let i = 0; i < 2; i++) {
            wQual.appendChild(createQualifierNode(wsfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'straight'));
        }
        wContainer.append(wr3, wr4, wQual);
        for (let s = 0; s < 3; s++) nextLabel();
        return { wqfLabels, wsfLabels, wfLabel };
    }

    wfLabel = nextLabel();
    wr5.appendChild(createMatchNode(wfLabel, '', '', '', '', 'branch'));
    wQual.appendChild(createQualifierNode(wfLabel, targetPhaseName, 'W', includeLoserSlotOnFinalW, 'straight'));
    wContainer.append(wr3, wr4, wr5, wQual);
    nextLabel();
    nextLabel();
    return { wqfLabels, wsfLabels, wfLabel };
}

// === 敗者側の共通後半進行ヘルパー ===
function appendLosersAfter4Matches(lContainer, fourMatchLabels, wqfLabels, wsfLabels, wfLabel, wCountNum, lCountNum, targetPhaseName, nextLabel, roundNames) {
    const lQual = createRoundColumn('', 'losers', true);

    const isFinalWLoserDirectQual = (lCountNum >= 2 * wCountNum);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, lCountNum - wCountNum) : lCountNum;

    if (wCountNum === 4 && isFinalWLoserDirectQual) {
        for (let k = 0; k < 4; k++) {
            lQual.appendChild(createQualifierNode(fourMatchLabels[k], targetPhaseName, 'L', false, 'straight'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    const colWqfDrop = createRoundColumn(roundNames.wqfDrop, 'losers');
    const wqfDropOrder = [wqfLabels[1], wqfLabels[0], wqfLabels[3], wqfLabels[2]];
    const wqfDropRoundLabels = [];
    for (let k = 0; k < 4; k++) {
        const lbl = nextLabel();
        wqfDropRoundLabels.push(lbl);
        colWqfDrop.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wqfDropOrder[k]}`));
    }
    lContainer.appendChild(colWqfDrop);

    if (targetLosersBracketQuals >= 4) {
        for (let k = 0; k < 4; k++) {
            lQual.appendChild(createQualifierNode(wqfDropRoundLabels[k], targetPhaseName, 'L', false, 'straight'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    const colConsolidate2 = createRoundColumn(roundNames.consolidate2, 'losers');
    const consolidate2Labels = [];
    for (let k = 0; k < 2; k++) {
        const lbl = nextLabel();
        consolidate2Labels.push(lbl);
        colConsolidate2.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }
    lContainer.appendChild(colConsolidate2);

    if ((wCountNum === 2 && isFinalWLoserDirectQual) || (wCountNum === 4 && targetLosersBracketQuals === 2)) {
        for (let k = 0; k < 2; k++) {
            lQual.appendChild(createQualifierNode(consolidate2Labels[k], targetPhaseName, 'L', false, 'straight'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    if (wCountNum === 4 && targetLosersBracketQuals === 1) {
        const colFinal1 = createRoundColumn(roundNames.wsfDrop, 'losers');
        const finalLbl = nextLabel();
        colFinal1.appendChild(createMatchNode(finalLbl, '', '', '', '', 'branch'));
        lQual.appendChild(createQualifierNode(finalLbl, targetPhaseName, 'L', false, 'straight'));
        lContainer.append(colFinal1, lQual);
        return;
    }

    const colWsfDrop = createRoundColumn(roundNames.wsfDrop, 'losers');
    const wsfDropOrder = [wsfLabels[1], wsfLabels[0]];
    const wsfDropRoundLabels = [];
    for (let k = 0; k < 2; k++) {
        const lbl = nextLabel();
        wsfDropRoundLabels.push(lbl);
        colWsfDrop.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wsfDropOrder[k]}`));
    }
    lContainer.appendChild(colWsfDrop);

    if (targetLosersBracketQuals === 2) {
        for (let k = 0; k < 2; k++) {
            lQual.appendChild(createQualifierNode(wsfDropRoundLabels[k], targetPhaseName, 'L', false, 'straight'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    const colConsolidate1 = createRoundColumn(roundNames.consolidate1, 'losers');
    const consolidate1Label = nextLabel();
    colConsolidate1.appendChild(createMatchNode(consolidate1Label, '', '', '', '', 'branch'));
    lContainer.appendChild(colConsolidate1);

    if ((wCountNum === 1 && isFinalWLoserDirectQual) || wCountNum === 2) {
        lQual.appendChild(createQualifierNode(consolidate1Label, targetPhaseName, 'L', false, 'straight'));
        lContainer.appendChild(lQual);
        return;
    }

    const colWfDrop = createRoundColumn(roundNames.wfDrop, 'losers');
    const wfDropLabel = nextLabel();
    colWfDrop.appendChild(createMatchNode(wfDropLabel, '', '', '', '', 'straight', `Loser of ${wfLabel}`));
    lQual.appendChild(createQualifierNode(wfDropLabel, targetPhaseName, 'L', false, 'straight'));
    lContainer.append(colWfDrop, lQual);
}

// === 17〜24人ブラケット生成関数 ===
function render17To24Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum) {
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    const wr2TopSeeds = [1, 8, 4, 5, 2, 7, 3, 6];
    const wr1SeedPairs = wr2TopSeeds.map(s => [17 - s, 33 - (17 - s)]);

    const wContainer = createElement('div', 'bracket-container');
    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wr2 = createRoundColumn('Winners Round 2', 'winners');

    const wr1Labels = [];
    for (let i = 0; i < 8; i++) {
        const [s1, s2] = wr1SeedPairs[i];
        if (s2 <= playerCount) {
            const lbl = nextLabel();
            wr1Labels.push(lbl);
            wr1.appendChild(createMatchNode(lbl, getPlayerName(s1), getPlayerName(s2), s1, s2, 'none'));
        } else {
            wr1Labels.push(null);
            wr1.appendChild(createSpacerNode());
        }
    }

    const wr2Labels = [];
    for (let i = 0; i < 8; i++) {
        const lbl = nextLabel();
        wr2Labels.push(lbl);
        const topSeed = wr2TopSeeds[i];
        const [wr1TopSeed] = wr1SeedPairs[i];

        if (wr1Labels[i] !== null) {
            wr2.appendChild(createMatchNode(lbl, getPlayerName(topSeed), '', topSeed, '', 'straight'));
        } else {
            wr2.appendChild(createMatchNode(lbl, getPlayerName(topSeed), getPlayerName(wr1TopSeed), topSeed, wr1TopSeed, 'none'));
        }
    }

    wContainer.append(wr1, wr2);
    const { wqfLabels, wsfLabels, wfLabel } = appendWinnersEndingByCount(wContainer, wCountNum, lCountNum, targetPhaseName, nextLabel);
    container.appendChild(wContainer);

    if (lCountNum === 0) return;

    const lContainer = createElement('div', 'bracket-container');
    const lr1 = createRoundColumn('Losers Round 1', 'losers');
    const lr2 = createRoundColumn('Losers Round 2', 'losers');

    const lr1Labels = [];
    for (let j = 0; j < 8; j++) {
        lr1Labels.push(wr1Labels[j] !== null ? nextLabel() : null);
    }

    const lr2Labels = [];
    for (let k = 0; k < 4; k++) {
        lr2Labels.push(nextLabel());
    }

    for (let k = 0; k < 4; k++) {
        const jTop = 2 * k;
        const jBot = 2 * k + 1;
        const wr2DropTop = wr2Labels[7 - jTop];
        const wr2DropBot = wr2Labels[7 - jBot];
        const hasTopLr1 = lr1Labels[jTop] !== null;
        const hasBotLr1 = lr1Labels[jBot] !== null;

        const pairGroup = createElement('div', 'pair-group');

        if (hasTopLr1 && hasBotLr1) {
            pairGroup.appendChild(createMatchNode(lr1Labels[jTop], '', '', '', '', 'none', `Loser of ${wr2DropTop}`, `Loser of ${wr1Labels[jTop]}`));
            pairGroup.appendChild(createMatchNode(lr1Labels[jBot], '', '', '', '', 'none', `Loser of ${wr2DropBot}`, `Loser of ${wr1Labels[jBot]}`));
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'branch'));
        } else if (hasTopLr1 && !hasBotLr1) {
            pairGroup.appendChild(createMatchNode(lr1Labels[jTop], '', '', '', '', 'none', `Loser of ${wr2DropTop}`, `Loser of ${wr1Labels[jTop]}`));
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'straight', '', `Loser of ${wr2DropBot}`));
        } else {
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'none', `Loser of ${wr2DropTop}`, `Loser of ${wr2DropBot}`));
        }
    }

    lContainer.append(lr1, lr2);

    appendLosersAfter4Matches(
        lContainer,
        lr2Labels,
        wqfLabels,
        wsfLabels,
        wfLabel,
        wCountNum,
        lCountNum,
        targetPhaseName,
        nextLabel,
        {
            wqfDrop: 'Losers Round 3',
            consolidate2: 'Losers Round 4',
            wsfDrop: 'Losers Quarter-Final',
            consolidate1: 'Losers Semi-Final',
            wfDrop: 'Losers Final'
        }
    );

    container.appendChild(lContainer);
}

// === 25〜32人ブラケット生成関数 ===
function render25To32Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum) {
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    const wr2TopSeeds = [1, 8, 4, 5, 2, 7, 3, 6];

    const wContainer = createElement('div', 'bracket-container');
    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wr2 = createRoundColumn('Winners Round 2', 'winners');

    const wr1BlockMatches = [];
    for (let i = 0; i < 8; i++) {
        const s = wr2TopSeeds[i];
        const topOpp = 33 - s;
        const botSeed1 = 17 - s;
        const botSeed2 = 16 + s;

        const hasTopMatch = (topOpp <= playerCount);
        const pairGroup = createElement('div', 'pair-group');

        let topLbl = null;
        if (hasTopMatch) {
            topLbl = nextLabel();
            pairGroup.appendChild(createMatchNode(topLbl, getPlayerName(s), getPlayerName(topOpp), s, topOpp, 'none'));
        }

        const botLbl = nextLabel();
        pairGroup.appendChild(createMatchNode(botLbl, getPlayerName(botSeed1), getPlayerName(botSeed2), botSeed1, botSeed2, 'none'));

        wr1.appendChild(pairGroup);
        wr1BlockMatches.push({ topLbl, botLbl, topSeed: s, hasTopMatch });
    }

    const wr2Labels = [];
    for (let i = 0; i < 8; i++) {
        const lbl = nextLabel();
        wr2Labels.push(lbl);
        const block = wr1BlockMatches[i];

        if (block.hasTopMatch) {
            wr2.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
        } else {
            wr2.appendChild(createMatchNode(lbl, getPlayerName(block.topSeed), '', block.topSeed, '', 'straight'));
        }
    }

    wContainer.append(wr1, wr2);
    const { wqfLabels, wsfLabels, wfLabel } = appendWinnersEndingByCount(wContainer, wCountNum, lCountNum, targetPhaseName, nextLabel);
    container.appendChild(wContainer);

    if (lCountNum === 0) return;

    const lContainer = createElement('div', 'bracket-container');
    const lr1 = createRoundColumn('Losers Round 1', 'losers');
    const lr2 = createRoundColumn('Losers Round 2', 'losers');
    const lr3 = createRoundColumn('Losers Round 3', 'losers');

    const lr1Labels = [];
    for (let k = 0; k < 8; k++) {
        const block = wr1BlockMatches[k];
        if (block.hasTopMatch) {
            const lbl = nextLabel();
            lr1Labels.push(lbl);
            lr1.appendChild(createMatchNode(lbl, '', '', '', '', 'none', `Loser of ${block.topLbl}`, `Loser of ${block.botLbl}`));
        } else {
            lr1Labels.push(null);
            lr1.appendChild(createSpacerNode());
        }
    }

    const lr2Labels = [];
    for (let k = 0; k < 8; k++) {
        const lbl = nextLabel();
        lr2Labels.push(lbl);
        const wr2Drop = wr2Labels[7 - k];
        const block = wr1BlockMatches[k];

        if (lr1Labels[k] !== null) {
            lr2.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wr2Drop}`));
        } else {
            lr2.appendChild(createMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2Drop}`, `Loser of ${block.botLbl}`));
        }
    }

    const lr3Labels = [];
    for (let k = 0; k < 4; k++) {
        const lbl = nextLabel();
        lr3Labels.push(lbl);
        lr3.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    lContainer.append(lr1, lr2, lr3);

    const isW1L1 = (wCountNum === 1 && lCountNum === 1);
    appendLosersAfter4Matches(
        lContainer,
        lr3Labels,
        wqfLabels,
        wsfLabels,
        wfLabel,
        wCountNum,
        lCountNum,
        targetPhaseName,
        nextLabel,
        {
            wqfDrop: 'Losers Round 4',
            consolidate2: isW1L1 ? 'Losers Round 5' : 'Losers Quarter-Final',
            wsfDrop: isW1L1 ? 'Losers Quarter-Final' : 'Losers Semi-Final',
            consolidate1: isW1L1 ? 'Losers Semi-Final' : 'Losers Final',
            wfDrop: 'Losers Final'
        }
    );

    container.appendChild(lContainer);
}

// === ブラケット＆名簿生成メイン処理 ===
generateBtn.addEventListener('click', () => {
    const selectedPoolName = poolSelect.value;
    const currentPool = poolsData[selectedPoolName];
    if (!currentPool) {
        alert('プールデータが見つかりません。CSVを再読み込みしてください。');
        return;
    }

    const playerCount = currentPool.count;
    if (playerCount < 17 || playerCount > 32) {
        alert(`現在のPool ${selectedPoolName} の人数は ${playerCount}人 です。（現在17〜32人トナメに対応しています）`);
        return;
    }

    const getPlayerName = (seed) => {
        const p = currentPool.playersBySeed[seed];
        return p ? p.shortGamerTag : '';
    };

    const isSingle = elimFormatSelect.value === 'single';
    const targetPhaseName = targetPhaseInput.value.trim();
    const wCount = winnersAdvanceCount.value;
    const lCount = isSingle ? '0' : losersAdvanceCount.value;
    const wCountNum = parseInt(wCount, 10);
    const lCountNum = parseInt(lCount, 10);

    document.getElementById('preview-placeholder').classList.add('hidden');
    document.getElementById('preview-header').classList.remove('hidden');
    document.getElementById('main-sheet-body').classList.remove('hidden');

    const elimTitle = isSingle ? 'Single Elimination' : 'Double Elimination';
    document.getElementById('pool-title').textContent = `Pool ${selectedPoolName} - ${elimTitle} (${playerCount} players)`;
    document.getElementById('pool-subtitle').textContent = isSingle
        ? `Qualifier: ${wCount}`
        : `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`;

    const container = document.getElementById('bracket-container');
    container.innerHTML = ''; 
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '32px';

    if (playerCount >= 25) {
        render25To32Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    } else {
        render17To24Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    }

    const rosterContainer = document.getElementById('checkin-roster-container');
    rosterContainer.innerHTML = '';
    rosterContainer.appendChild(createCheckinRosterTable(currentPool, playerCount));

    applyPrintAndDrawOptions();
    requestAnimationFrame(fitToViewport);
});

// === JPG出力機能 ===
document.getElementById('export-btn').addEventListener('click', async () => {
    const btn = document.getElementById('export-btn');
    const originalText = btn.textContent;
    btn.textContent = '生成中...';
    btn.disabled = true;

    const currentZoom = Number(zoomSlider.value);
    scaleWrapper.style.transform = 'none';
    scaleWrapper.style.width = `${previewArea.offsetWidth}px`;
    scaleWrapper.style.height = `${previewArea.offsetHeight}px`;
    previewArea.classList.add('exporting');

    try {
        let dataUrl;
        const width = previewArea.offsetWidth;
        const height = previewArea.offsetHeight;

        if (window.htmlToImage) {
            dataUrl = await htmlToImage.toJpeg(previewArea, {
                quality: 0.95,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: width,
                height: height,
                style: { transform: 'none', margin: '0' }
            });
        } else {
            const canvas = await html2canvas(previewArea, {
                scale: 2, useCORS: true, backgroundColor: '#ffffff',
                width: width, height: height,
                windowWidth: width + 100, windowHeight: height + 100,
                scrollX: 0, scrollY: 0
            });
            dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        }

        const link = document.createElement('a');
        link.download = 'bracket-preview.jpg';
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('画像生成に失敗しました:', err);
        alert('画像生成に失敗しました。');
    } finally {
        previewArea.classList.remove('exporting');
        setZoom(currentZoom);
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// === PDF出力機能 ===
document.getElementById('export-pdf-btn').addEventListener('click', () => {
    applyPrintAndDrawOptions();
    savedZoomBeforePrint = Number(zoomSlider.value);
    isPrintingMode = true;
    scaleWrapper.style.transform = 'none';
    scaleWrapper.style.width = 'auto';
    scaleWrapper.style.height = 'auto';

    setTimeout(() => {
        window.print();
        isPrintingMode = false;
        setZoom(savedZoomBeforePrint);
    }, 50);
});
