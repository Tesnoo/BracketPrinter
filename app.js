// === グローバル状態管理 ===
let poolsData = {};
let maxPoolPlayerCount = 24;
let isCsvValid = false;
let baseBoValue = '';
let isCustomBoConfirmed = false;
let pendingLogoDataUrl = null;
let pendingTextBoxesCount = 0;
let isPrintingMode = false;

// start.gg API 関連の状態保持
let startggPhasesList = [];
let currentTargetGroupIdFromUrl = null;
let lastAutoConfigSummary = '';

// 現在アクティブなラウンド一覧（手順5の動的プルダウン＆Bo判定用）
let currentActiveWinnersRounds = [];
let currentActiveLosersRounds = [];

// 印刷計算パラメータ保持（一括印刷用）
let lastComputedPrintMetrics = {
    canvasWidth: 2362,
    canvasHeight: 1670,
    printScale: 0.65,
    scaledBoxWidth: 1500,
    scaledBoxHeight: 1060
};

// ロゴ画像の縦ピクセル上限（横幅は無制限）と白黒判定の許容誤差
const MAX_LOGO_HEIGHT = 160;
const LOGO_COLOR_TOLERANCE = 15;

// 6〜24人用のスロット高（48pxボックス + 余白34px = 82px）
const SLOT_HEIGHT_24 = 82;
// 25〜32人用のスロット高（勝者側は68px、敗者側は74px）
const WINNERS_SLOT_HEIGHT_32 = 68;
const LOSERS_SLOT_HEIGHT_32 = 74;
const ROUND_HEADER_TOTAL_HEIGHT = 34;

let recommendedPrintConfig = {
    size: 'A3',
    orientation: 'landscape',
    margin: 'standard',
    reason: '17〜32人 ダブルエリミの推奨設定'
};

// 大会名入力・フェーズ名表示チェックボックス要素
const tournamentNameInput = document.getElementById('tournament-name-input');
const showPhaseNameCheckbox = document.getElementById('show-phase-name-checkbox');

const csvUpload = document.getElementById('csv-upload');
const startggTokenInput = document.getElementById('startgg-token-input');
const startggUrlInput = document.getElementById('startgg-url-input');
const fetchStartggBtn = document.getElementById('fetch-startgg-btn');
const phaseSelectWrapper = document.getElementById('phase-select-wrapper');
const phaseSelect = document.getElementById('phase-select');
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
const logoStatus = document.getElementById('logo-status');
const clearLogoBtn = document.getElementById('clear-logo-btn');
const logoDisplayContainer = document.getElementById('logo-display-container');
const addTextBtn = document.getElementById('add-text-btn');
const customTextsLayer = document.getElementById('custom-texts-layer');

const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const scaleWrapper = document.getElementById('preview-scale-wrapper');
const previewArea = document.getElementById('preview-area');
const viewport = document.getElementById('preview-viewport');
const batchPrintContainer = document.getElementById('batch-print-container');

const changeModeRadios = document.querySelectorAll('input[name="change-mode"]');
const roundChangeContainer = document.getElementById('round-change-container');
const winnersRoundSelect = document.getElementById('winners-round-select');
const losersRoundSelect = document.getElementById('losers-round-select');
const winnersBoSelect = document.getElementById('winners-bo-select');
const winnersCustomInput = document.getElementById('winners-custom-input');
const losersBoSelect = document.getElementById('losers-bo-select');
const losersCustomInput = document.getElementById('losers-custom-input');

// 保存済みのstart.gg APIトークンがあれば復元
const savedToken = localStorage.getItem('bracket_printer_startgg_token');
if (savedToken) {
    startggTokenInput.value = savedToken;
}
startggTokenInput.addEventListener('change', () => {
    localStorage.setItem('bracket_printer_startgg_token', startggTokenInput.value.trim());
});

// === 左上タイトル文字列を生成するヘルパー ===
// 形式: 「{大会名} {フェーズ名} Pool {Pool名} - {Elimination} ({人数} players)」
function buildPoolHeaderTitle(poolName, elimTitle, playerCount) {
    const tName = tournamentNameInput ? tournamentNameInput.value.trim() : '';
    const showPhase = showPhaseNameCheckbox ? showPhaseNameCheckbox.checked : true;
    const rawPhaseName = poolsData[poolName]?.phaseName ? poolsData[poolName].phaseName.trim() : '';

    const prefixParts = [];
    if (tName) prefixParts.push(tName);
    if (showPhase && rawPhaseName) prefixParts.push(rawPhaseName);

    const basePoolStr = `Pool ${poolName} - ${elimTitle} (${playerCount} players)`;
    return prefixParts.length > 0 ? `${prefixParts.join(' ')} ${basePoolStr}` : basePoolStr;
}

function refreshRenderedHeaderTitle() {
    const isSheetDrawn = !document.getElementById('main-sheet-body').classList.contains('hidden');
    if (!isSheetDrawn) return;

    const selectedPoolName = poolSelect.value;
    const currentPool = poolsData[selectedPoolName];
    if (!currentPool) return;

    const isSingle = elimFormatSelect.value === 'single';
    const elimTitle = isSingle ? 'Single Elimination' : 'Double Elimination';
    document.getElementById('pool-title').textContent = buildPoolHeaderTitle(selectedPoolName, elimTitle, currentPool.count);
}

if (tournamentNameInput) {
    tournamentNameInput.addEventListener('input', refreshRenderedHeaderTitle);
}
if (showPhaseNameCheckbox) {
    showPhaseNameCheckbox.addEventListener('change', refreshRenderedHeaderTitle);
}

// === 現在のPool人数を取得するヘルパー ===
function getCurrentPoolPlayerCount() {
    const selectedPool = poolSelect.value;
    if (selectedPool && poolsData[selectedPool]) {
        return poolsData[selectedPool].count;
    }
    return maxPoolPlayerCount || 24;
}

// === 人数規模に応じた通過人数プルダウンの有効範囲制御 ===
function updateAdvanceCountConstraints() {
    const n = getCurrentPoolPlayerCount();

    Array.from(winnersAdvanceCount.options).forEach(opt => {
        if (opt.value === '4') {
            opt.disabled = (n <= 8);
            opt.textContent = (n <= 8) ? '4人 (9人以上〜)' : '4人';
        }
    });
    if (n <= 8 && winnersAdvanceCount.value === '4') {
        winnersAdvanceCount.value = '2';
    }

    Array.from(losersAdvanceCount.options).forEach(opt => {
        if (opt.value === '8') {
            opt.disabled = (n <= 16);
            opt.textContent = (n <= 16) ? '8人 (17人以上〜)' : '8人';
        }
    });
    if (n <= 16 && losersAdvanceCount.value === '8') {
        losersAdvanceCount.value = '4';
    }
}

// === フェーズ通過までに実際に存在するラウンド一覧を算出する関数 ===
function computeActiveRounds(playerCount, isSingle, wCountNum, lCountNum) {
    let winnersRounds = [];
    if (playerCount >= 17) {
        if (wCountNum === 4) {
            winnersRounds = ['Winners Round 1', 'Winners Round 2', 'Winners Quarter-Final'];
        } else if (wCountNum === 2) {
            winnersRounds = ['Winners Round 1', 'Winners Round 2', 'Winners Quarter-Final', 'Winners Semi-Final'];
        } else {
            winnersRounds = ['Winners Round 1', 'Winners Round 2', 'Winners Quarter-Final', 'Winners Semi-Final', 'Winners Final'];
        }
    } else if (playerCount >= 9) {
        if (wCountNum === 4) {
            winnersRounds = ['Winners Round 1', 'Winners Quarter-Final'];
        } else if (wCountNum === 2) {
            winnersRounds = ['Winners Round 1', 'Winners Quarter-Final', 'Winners Semi-Final'];
        } else {
            winnersRounds = ['Winners Round 1', 'Winners Quarter-Final', 'Winners Semi-Final', 'Winners Final'];
        }
    } else {
        if (wCountNum >= 2) {
            winnersRounds = ['Winners Round 1', 'Winners Semi-Final'];
        } else {
            winnersRounds = ['Winners Round 1', 'Winners Semi-Final', 'Winners Final'];
        }
    }

    if (isSingle || lCountNum <= 0) {
        return { winnersRounds, losersRounds: [] };
    }

    const isFinalWLoserDirectQual = (lCountNum >= 2 * wCountNum);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, lCountNum - wCountNum) : lCountNum;
    let losersRounds = [];

    if (playerCount >= 17) {
        losersRounds = (playerCount >= 25)
            ? ['Losers Round 1', 'Losers Round 2', 'Losers Round 3']
            : ['Losers Round 1', 'Losers Round 2'];

        const rNames = (playerCount >= 25)
            ? {
                wqfDrop: 'Losers Round 4',
                consolidate2: 'Losers Round 5',
                wsfDrop: 'Losers Quarter-Final',
                consolidate1: 'Losers Semi-Final',
                wfDrop: 'Losers Final'
            }
            : {
                wqfDrop: 'Losers Round 3',
                consolidate2: 'Losers Round 4',
                wsfDrop: 'Losers Quarter-Final',
                consolidate1: 'Losers Semi-Final',
                wfDrop: 'Losers Final'
            };

        if (wCountNum === 4 && isFinalWLoserDirectQual) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wqfDrop);
        if (targetLosersBracketQuals >= 4) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate2);
        if ((wCountNum === 2 && isFinalWLoserDirectQual) || (wCountNum === 4 && targetLosersBracketQuals === 2)) {
            return { winnersRounds, losersRounds };
        }
        if (wCountNum === 4 && targetLosersBracketQuals === 1) {
            losersRounds.push(rNames.wsfDrop);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (targetLosersBracketQuals === 2) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if ((wCountNum === 1 && isFinalWLoserDirectQual) || wCountNum === 2) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wfDrop);
        return { winnersRounds, losersRounds };

    } else if (playerCount >= 9) {
        losersRounds = (playerCount >= 13)
            ? ['Losers Round 1', 'Losers Round 2', 'Losers Round 3']
            : ['Losers Round 1', 'Losers Round 2'];

        const rNames = {
            wsfDrop: 'Losers Quarter-Final',
            consolidate1: 'Losers Semi-Final',
            wfDrop: 'Losers Final'
        };

        if ((wCountNum === 2 && isFinalWLoserDirectQual) || (wCountNum === 4 && targetLosersBracketQuals >= 2)) {
            return { winnersRounds, losersRounds };
        }
        if (wCountNum === 4 && targetLosersBracketQuals === 1) {
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (targetLosersBracketQuals >= 2) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if ((wCountNum === 1 && isFinalWLoserDirectQual) || wCountNum === 2) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wfDrop);
        return { winnersRounds, losersRounds };

    } else {
        losersRounds = (playerCount >= 7)
            ? ['Losers Round 1', 'Losers Round 2']
            : ['Losers Round 1'];

        if (targetLosersBracketQuals >= 2) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push('Losers Semi-Final');
        if ((wCountNum === 1 && isFinalWLoserDirectQual) || wCountNum === 2) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push('Losers Final');
        return { winnersRounds, losersRounds };
    }
}

// === 手順5のラウンド選択プルダウンを動的に更新する関数 ===
function updateRoundSelectOptions() {
    updateAdvanceCountConstraints();

    const playerCount = getCurrentPoolPlayerCount();
    const isSingle = elimFormatSelect.value === 'single';
    const wCountNum = parseInt(winnersAdvanceCount.value, 10) || 1;
    const lCountNum = isSingle ? 0 : (parseInt(losersAdvanceCount.value, 10) || 2);

    const { winnersRounds, losersRounds } = computeActiveRounds(playerCount, isSingle, wCountNum, lCountNum);
    currentActiveWinnersRounds = winnersRounds;
    currentActiveLosersRounds = losersRounds;

    const prevWSelected = winnersRoundSelect.value;
    winnersRoundSelect.innerHTML = '';
    const wNoneOpt = document.createElement('option');
    wNoneOpt.value = 'none';
    wNoneOpt.textContent = '勝者側は変更しない';
    winnersRoundSelect.appendChild(wNoneOpt);

    winnersRounds.forEach((rName, idx) => {
        const opt = document.createElement('option');
        opt.value = rName;
        const suffix = (idx === winnersRounds.length - 1) ? 'のみ' : '以降';
        opt.textContent = `${rName} ${suffix}`;
        winnersRoundSelect.appendChild(opt);
    });

    if (winnersRounds.includes(prevWSelected)) {
        winnersRoundSelect.value = prevWSelected;
    } else {
        winnersRoundSelect.value = 'none';
    }

    const prevLSelected = losersRoundSelect.value;
    losersRoundSelect.innerHTML = '';
    const lNoneOpt = document.createElement('option');
    lNoneOpt.value = 'none';
    lNoneOpt.textContent = '敗者側は変更しない';
    losersRoundSelect.appendChild(lNoneOpt);

    losersRounds.forEach((rName, idx) => {
        const opt = document.createElement('option');
        opt.value = rName;
        const suffix = (idx === losersRounds.length - 1) ? 'のみ' : '以降';
        opt.textContent = `${rName} ${suffix}`;
        losersRoundSelect.appendChild(opt);
    });

    if (losersRounds.includes(prevLSelected)) {
        losersRoundSelect.value = prevLSelected;
    } else {
        losersRoundSelect.value = 'none';
    }
}

// === トーナメント形式（ダブル/シングル）切り替え時のUI連動 ===
function syncElimFormatUI() {
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
    updateRoundSelectOptions();
    validateForm();
}

elimFormatSelect.addEventListener('change', syncElimFormatUI);

// === 推奨印刷設定の算出 ===
function updateRecommendedPrintConfig(autoSelect = true) {
    const isSingleElim = elimFormatSelect.value === 'single';
    const n = maxPoolPlayerCount || 24;

    if (isSingleElim) {
        recommendedPrintConfig = {
            size: 'A4',
            orientation: 'portrait',
            margin: 'standard',
            reason: `6〜32人 シングルエリミの推奨設定 (最大${n}人)`
        };
    } else if (n <= 16) {
        recommendedPrintConfig = {
            size: 'A4',
            orientation: 'landscape',
            margin: 'standard',
            reason: `6〜16人 ダブルエリミの推奨設定 (最大${n}人)`
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
    printRecStatusBadge.style.transform = 'none';
}

printSizeSelect.addEventListener('change', () => {
    refreshPrintOptionDecorations();
    applyPrintAndDrawOptions();
    fitToViewport();
});
printOrientationSelect.addEventListener('change', () => {
    refreshPrintOptionDecorations();
    applyPrintAndDrawOptions();
    fitToViewport();
});
printMarginSelect.addEventListener('change', () => {
    refreshPrintOptionDecorations();
    applyPrintAndDrawOptions();
    fitToViewport();
});

resetPrintRecBtn.addEventListener('click', () => {
    printSizeSelect.value = recommendedPrintConfig.size;
    printOrientationSelect.value = recommendedPrintConfig.orientation;
    printMarginSelect.value = recommendedPrintConfig.margin;
    refreshPrintOptionDecorations();
    applyPrintAndDrawOptions();
    fitToViewport();
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
    standard: { v: 22, h: 28 },
    wide: { v: 40, h: 48 },
    narrow: { v: 12, h: 16 }
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

    let naturalHeight = 1540;
    let naturalWidth = 1900;

    if (isSheetDrawn) {
        previewArea.style.height = 'auto';
        previewArea.style.minHeight = '0px';

        const wContainer = bracketEl.children[0];
        const lContainer = bracketEl.children[1];

        const wWidth = wContainer ? wContainer.offsetWidth : 0;
        const lWidth = lContainer ? lContainer.offsetWidth : 0;
        const rosterWidth = rosterEl ? rosterEl.offsetWidth : 0;
        const rosterHeight = rosterEl ? rosterEl.offsetHeight : 0;

        naturalWidth = Math.max(wWidth + 32 + rosterWidth, lWidth);
        const bracketTotalHeight = bracketEl.offsetHeight;
        naturalHeight = headerEl.offsetHeight + 14 + Math.max(bracketTotalHeight, rosterHeight);
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
    const pageWidthMm = (orientation === 'landscape' ? paperMm.long : paperMm.short) - 16;
    const pageHeightMm = (orientation === 'landscape' ? paperMm.short : paperMm.long) - 16;

    const mmToPx = 96 / 25.4;
    const targetPrintWidthPx = pageWidthMm * mmToPx;
    const targetPrintHeightPx = pageHeightMm * mmToPx;

    const printScale = Math.min(targetPrintWidthPx / canvasWidth, targetPrintHeightPx / canvasHeight);
    const scaledBoxWidth = Math.floor(canvasWidth * printScale);
    const scaledBoxHeight = Math.floor(canvasHeight * printScale);

    lastComputedPrintMetrics = {
        canvasWidth,
        canvasHeight,
        printScale,
        scaledBoxWidth,
        scaledBoxHeight
    };

    dynamicPrintStyle.textContent = `
        @page {
            size: ${sizeKey} ${orientation};
            margin: 6mm;
        }
        @media print {
            #preview-scale-wrapper {
                position: relative !important;
                width: ${scaledBoxWidth}px !important;
                height: ${scaledBoxHeight}px !important;
                max-width: ${scaledBoxWidth}px !important;
                max-height: ${scaledBoxHeight}px !important;
                overflow: hidden !important;
                transform: none !important;
                margin: 0 auto !important;
                padding: 0 !important;
                display: block !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            #preview-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: ${canvasWidth}px !important;
                height: ${canvasHeight}px !important;
                min-height: ${canvasHeight}px !important;
                transform: scale(${printScale.toFixed(5)}) !important;
                transform-origin: top left !important;
                margin: 0 !important;
                box-shadow: none !important;
            }
        }
    `;

    logoDisplayContainer.innerHTML = '';
    if (pendingLogoDataUrl) {
        const img = document.createElement('img');
        img.src = pendingLogoDataUrl;
        img.alt = 'Tournament Logo';
        img.style.maxHeight = `${MAX_LOGO_HEIGHT}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.className = 'object-contain block';
        logoDisplayContainer.appendChild(img);
        logoDisplayContainer.classList.remove('hidden');
    } else {
        logoDisplayContainer.classList.add('hidden');
    }

    while (pendingTextBoxesCount > 0) {
        createDraggableTextBox();
        pendingTextBoxesCount--;
    }

    setZoom(Number(zoomSlider.value));
}

// === ロゴ画像の白黒判定・縦サイズ上限(160px)自動縮小処理 ===
function resetLogoInput() {
    logoUpload.value = '';
    pendingLogoDataUrl = null;
    clearLogoBtn.classList.add('hidden');
    logoStatus.classList.add('hidden');
    logoStatus.textContent = '';
}

logoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        resetLogoInput();
        return;
    }
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
        alert('エラー: ロゴ画像はPNGファイル（.png）のみ対応しています。');
        resetLogoInput();
        return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const origW = img.naturalWidth || img.width;
            const origH = img.naturalHeight || img.height;

            if (origW === 0 || origH === 0) {
                alert('エラー: 画像サイズの取得に失敗しました。');
                resetLogoInput();
                return;
            }

            const checkCanvas = document.createElement('canvas');
            checkCanvas.width = origW;
            checkCanvas.height = origH;
            const checkCtx = checkCanvas.getContext('2d');
            checkCtx.drawImage(img, 0, 0);

            const imageData = checkCtx.getImageData(0, 0, origW, origH).data;
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const a = imageData[i + 3];

                if (a >= 16) {
                    const maxChannel = Math.max(r, g, b);
                    const minChannel = Math.min(r, g, b);
                    if (maxChannel - minChannel > LOGO_COLOR_TOLERANCE) {
                        alert('エラー: ロゴ画像に白黒（グレースケール・透過）以外のカラーが含まれています。\n白黒のPNG画像を選択してください。');
                        resetLogoInput();
                        return;
                    }
                }
            }

            if (origH > MAX_LOGO_HEIGHT) {
                const scale = MAX_LOGO_HEIGHT / origH;
                const targetW = Math.max(1, Math.round(origW * scale));
                const targetH = MAX_LOGO_HEIGHT;

                const resizeCanvas = document.createElement('canvas');
                resizeCanvas.width = targetW;
                resizeCanvas.height = targetH;
                const resizeCtx = resizeCanvas.getContext('2d');
                resizeCtx.imageSmoothingEnabled = true;
                resizeCtx.imageSmoothingQuality = 'high';
                resizeCtx.drawImage(img, 0, 0, targetW, targetH);

                pendingLogoDataUrl = resizeCanvas.toDataURL('image/png');
                logoStatus.textContent = `✅ 自動縮小済: ${origW}×${origH}px → ${targetW}×${targetH}px`;
            } else {
                pendingLogoDataUrl = checkCanvas.toDataURL('image/png');
                logoStatus.textContent = `✅ 読み込み完了: ${origW}×${origH}px`;
            }

            logoStatus.classList.remove('hidden');
            clearLogoBtn.classList.remove('hidden');
        };

        img.onerror = () => {
            alert('エラー: 画像ファイルの読み込みに失敗しました。');
            resetLogoInput();
        };

        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

clearLogoBtn.addEventListener('click', () => {
    resetLogoInput();
});

// === テキストボックス制御 ===
function createDraggableTextBox(initialX = 1100, initialY = 520) {
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
        createDraggableTextBox(1100 + offset, 520 + offset);
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

winnersAdvanceCount.addEventListener('change', () => {
    updateRoundSelectOptions();
    validateForm();
});
losersAdvanceCount.addEventListener('change', () => {
    updateRoundSelectOptions();
    validateForm();
});
targetPhaseInput.addEventListener('input', validateForm);

// === 共通：構築された poolsData の人数検証 (6〜32人) とUI反映 ===
function applyParsedPoolsData(parsedPools, preferredPoolName = null, extraStatusLine = '') {
    const poolNames = Object.keys(parsedPools);
    if (poolNames.length === 0) {
        alert('エラー: 有効なプール・プレイヤーデータが見つかりませんでした。');
        return false;
    }

    const invalidPools = poolNames.filter(pName => {
        const c = parsedPools[pName].count;
        return c < 6 || c > 32;
    });

    if (invalidPools.length > 0) {
        const detailStr = invalidPools.map(p => `Pool ${p} (${parsedPools[p].count}人)`).join(', ');
        alert(
            `エラー: 1プールあたりの参加人数が6人未満、または33人以上のデータが含まれています。\n` +
            `対象: ${detailStr}\n\n` +
            `※本アプリは1プールあたり 6〜32人 のトーナメントに対応しています。`
        );
        return false;
    }

    poolsData = parsedPools;
    isCsvValid = true;
    lastAutoConfigSummary = extraStatusLine;

    maxPoolPlayerCount = Math.max(...poolNames.map(pName => parsedPools[pName].count));
    updateRecommendedPrintConfig(true);

    poolSelect.innerHTML = '';
    poolNames.forEach(pName => {
        const opt = document.createElement('option');
        opt.value = pName;
        opt.textContent = `Pool ${pName} (${parsedPools[pName].count}人)`;
        poolSelect.appendChild(opt);
    });

    if (preferredPoolName && parsedPools[preferredPoolName]) {
        poolSelect.value = preferredPoolName;
    }

    if (poolNames.length > 1) {
        poolSelectWrapper.classList.remove('hidden');
    } else {
        poolSelectWrapper.classList.add('hidden');
    }

    const exportAllPdfBtn = document.getElementById('export-all-pdf-btn');
    if (exportAllPdfBtn) {
        exportAllPdfBtn.textContent = `全Pool (${poolNames.length}個) をPDF一括出力`;
    }

    const activePool = poolSelect.value;
    const detectedPhaseName = parsedPools[activePool].phaseName || '';
    let statusMsg = `✅ 読み込み完了: Pool ${activePool} (${parsedPools[activePool].count}人 / 全${poolNames.length}プール)`;
    if (detectedPhaseName) {
        statusMsg += `\n📌 フェーズ名: ${detectedPhaseName}`;
    }
    if (extraStatusLine) {
        statusMsg += `\n${extraStatusLine}`;
    }
    csvStatus.textContent = statusMsg;
    csvStatus.className = 'text-[11px] text-green-600 font-bold whitespace-pre-line leading-relaxed';
    csvStatus.classList.remove('hidden');

    updateRoundSelectOptions();
    validateForm();
    return true;
}

// === 手順1-A: CSVファイルの読み込みと検証（A列からフェーズ名を自動取得） ===
csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        resetCsvInput();
        return;
    }

    phaseSelectWrapper.classList.add('hidden');

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
                const rawPhaseName = (row[0] || '').trim(); // A列：フェーズ名
                const rawPoolName = (row[2] || '').trim();  // C列：Pool名
                const seedStr = (row[3] || '').trim();      // D列：Pool Seed
                if (!rawPoolName || !seedStr) continue;

                const poolName = rawPoolName.replace(/00$/, '') || rawPoolName;
                const seed = parseInt(seedStr, 10);
                if (isNaN(seed)) continue;

                const gamerTag = (row[12] || '').trim();
                const shortGamerTag = (row[13] || '').trim();

                if (!parsedPools[poolName]) {
                    parsedPools[poolName] = { count: 0, phaseName: rawPhaseName, playersBySeed: {} };
                } else if (!parsedPools[poolName].phaseName && rawPhaseName) {
                    parsedPools[poolName].phaseName = rawPhaseName;
                }
                parsedPools[poolName].count += 1;
                parsedPools[poolName].playersBySeed[seed] = {
                    gamerTag: gamerTag,
                    shortGamerTag: shortGamerTag
                };
            }

            if (!applyParsedPoolsData(parsedPools)) {
                resetCsvInput();
            }
        },
        error: (err) => {
            console.error(err);
            alert('CSVファイルの読み込み中にエラーが発生しました。');
            resetCsvInput();
        }
    });
});

// === 手順1-B: start.gg GraphQL APIからのデータ＆トーナメント設定自動取得 ===
function parseStartggBracketUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    const match = trimmed.match(/tournament\/([^\/]+)\/event\/([^\/\?\#]+)/);
    if (!match) return null;

    const eventSlug = `tournament/${match[1]}/event/${match[2]}`;
    const bracketMatch = trimmed.match(/\/brackets\/(\d+)(?:\/(\d+))?/);

    return {
        eventSlug,
        phaseId: bracketMatch ? bracketMatch[1] : null,
        phaseGroupId: bracketMatch && bracketMatch[2] ? bracketMatch[2] : null
    };
}

async function callStartggGraphQL(token, query, variables) {
    const response = await fetch('https://api.start.gg/gql/alpha', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        throw new Error(`HTTPエラー (${response.status}): APIトークンが正しいか確認してください。`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0].message || 'GraphQLエラーが発生しました。');
    }
    return json.data;
}

function deduceAdvanceCountsFromGroup(setsNodes, progressionsCount, isSingleElim) {
    let wCount = null;
    let lCount = null;

    if (Array.isArray(setsNodes) && setsNodes.length > 0) {
        const validSets = setsNodes.filter(s => {
            const txt = (s.fullRoundText || '').toLowerCase();
            return !txt.includes('grand final') && !txt.includes('reset');
        });

        const wSets = validSets.filter(s => typeof s.round === 'number' && s.round > 0);
        const lSets = validSets.filter(s => typeof s.round === 'number' && s.round < 0);

        if (wSets.length > 0) {
            const maxWRound = Math.max(...wSets.map(s => s.round));
            const finalWMatches = wSets.filter(s => s.round === maxWRound).length;
            if ([1, 2, 4].includes(finalWMatches)) {
                wCount = finalWMatches;
            }
        }

        if (!isSingleElim && lSets.length > 0 && wCount !== null) {
            const minLRound = Math.min(...lSets.map(s => s.round));
            const finalLMatches = lSets.filter(s => s.round === minLRound).length;
            const prevLMatches = lSets.filter(s => s.round === minLRound + 1).length;

            let deducedL = (finalLMatches === prevLMatches) ? finalLMatches : (finalLMatches + wCount);
            if ([1, 2, 4, 8].includes(deducedL)) {
                lCount = deducedL;
            } else if ([1, 2, 4, 8].includes(finalLMatches)) {
                lCount = finalLMatches;
            }
        }
    }

    if ((wCount === null || (!isSingleElim && lCount === null)) && progressionsCount > 0) {
        if (isSingleElim) {
            if ([1, 2, 4].includes(progressionsCount)) wCount = progressionsCount;
        } else {
            const totalMap = {
                2: { w: 1, l: 1 },
                3: { w: 1, l: 2 },
                4: { w: 2, l: 2 },
                6: { w: 2, l: 4 },
                8: { w: 4, l: 4 },
                12: { w: 4, l: 8 }
            };
            if (totalMap[progressionsCount]) {
                if (wCount === null) wCount = totalMap[progressionsCount].w;
                if (lCount === null) lCount = totalMap[progressionsCount].l;
            }
        }
    }

    return { wCount, lCount };
}

async function autoDetectBracketConfig(token, phaseId, samplePhaseGroupId) {
    const currentPhaseObj = startggPhasesList.find(p => String(p.id) === String(phaseId));
    let bracketType = currentPhaseObj?.bracketType || null;
    let nextPhaseName = '';
    let wCount = null;
    let lCount = null;

    if (currentPhaseObj && startggPhasesList.length > 1) {
        const sortedPhases = [...startggPhasesList].sort((a, b) => (a.phaseOrder || 0) - (b.phaseOrder || 0));
        const idx = sortedPhases.findIndex(p => String(p.id) === String(phaseId));
        if (idx >= 0 && idx + 1 < sortedPhases.length) {
            nextPhaseName = sortedPhases[idx + 1].name || '';
        }
    }

    if (samplePhaseGroupId) {
        try {
            const pgQuery = `
                query GetPhaseGroupAutoConfig($pgId: ID!) {
                    phaseGroup(id: $pgId) {
                        id
                        bracketType
                        progressionsOut {
                            originPlacement
                        }
                        sets(page: 1, perPage: 90) {
                            nodes {
                                round
                                fullRoundText
                            }
                        }
                    }
                }
            `;
            const pgData = await callStartggGraphQL(token, pgQuery, { pgId: samplePhaseGroupId });
            const pg = pgData?.phaseGroup;
            if (pg) {
                if (!bracketType && pg.bracketType) bracketType = pg.bracketType;
                const isSingle = bracketType === 'SINGLE_ELIMINATION';
                const progCount = Array.isArray(pg.progressionsOut) ? pg.progressionsOut.length : 0;
                const setsNodes = pg.sets?.nodes || [];

                const deduced = deduceAdvanceCountsFromGroup(setsNodes, progCount, isSingle);
                wCount = deduced.wCount;
                lCount = deduced.lCount;
            }
        } catch (subErr) {
            console.warn('PhaseGroup詳細からの自動判定をスキップしました:', subErr);
        }
    }

    const summaryParts = [];

    if (bracketType === 'SINGLE_ELIMINATION') {
        elimFormatSelect.value = 'single';
        syncElimFormatUI();
        summaryParts.push('シングルエリミ');
    } else if (bracketType === 'DOUBLE_ELIMINATION') {
        elimFormatSelect.value = 'double';
        syncElimFormatUI();
        summaryParts.push('ダブルエリミ');
    }

    if (wCount !== null && [1, 2, 4].includes(wCount)) {
        winnersAdvanceCount.value = String(wCount);
    }
    if (elimFormatSelect.value !== 'single' && lCount !== null && [1, 2, 4, 8].includes(lCount)) {
        losersAdvanceCount.value = String(lCount);
    }

    if (winnersAdvanceCount.value) {
        if (elimFormatSelect.value === 'single') {
            summaryParts.push(`${winnersAdvanceCount.value}人抜け`);
        } else if (losersAdvanceCount.value) {
            summaryParts.push(`W${winnersAdvanceCount.value}L${losersAdvanceCount.value}`);
        }
    }

    if (nextPhaseName) {
        targetPhaseInput.value = nextPhaseName;
        summaryParts.push(`通過先: ${nextPhaseName}`);
    } else if (!targetPhaseInput.value.trim() && currentPhaseObj?.name) {
        targetPhaseInput.value = 'Final Stage';
    }

    updateRoundSelectOptions();
    validateForm();
    return summaryParts.length > 0 ? `⚡ 自動設定: ${summaryParts.join(' / ')}` : '';
}

async function loadPoolsFromStartggPhase(token, phaseId, targetPhaseGroupId = null) {
    csvStatus.textContent = '⏳ start.ggからシード・ブラケット設定を取得中...';
    csvStatus.className = 'text-[11px] text-blue-600 font-bold whitespace-pre-line leading-relaxed';
    csvStatus.classList.remove('hidden');

    const query = `
        query GetPhaseSeeds($phaseId: ID!, $page: Int!) {
            phase(id: $phaseId) {
                id
                name
                bracketType
                seeds(query: { page: $page, perPage: 100 }) {
                    pageInfo {
                        totalPages
                    }
                    nodes {
                        id
                        seedNum
                        phaseGroup {
                            id
                            displayIdentifier
                        }
                        entrant {
                            id
                            name
                            participants {
                                prefix
                                gamerTag
                            }
                        }
                    }
                }
            }
        }
    `;

    let page = 1;
    let totalPages = 1;
    let currentPhaseNameFromApi = '';
    const allSeeds = [];

    while (page <= totalPages) {
        const data = await callStartggGraphQL(token, query, { phaseId, page });
        if (data?.phase?.name) {
            currentPhaseNameFromApi = data.phase.name.trim();
        }
        const seedsObj = data?.phase?.seeds;
        if (!seedsObj || !seedsObj.nodes) break;

        totalPages = seedsObj.pageInfo?.totalPages || 1;
        allSeeds.push(...seedsObj.nodes);
        page++;
    }

    if (allSeeds.length === 0) {
        throw new Error('このフェーズにはシード（参加者）が登録されていません。');
    }

    if (!currentPhaseNameFromApi) {
        const foundPhase = startggPhasesList.find(p => String(p.id) === String(phaseId));
        if (foundPhase?.name) currentPhaseNameFromApi = foundPhase.name.trim();
    }

    const rawGroups = {};
    let preferredPoolName = null;
    let samplePhaseGroupId = targetPhaseGroupId || null;

    allSeeds.forEach(seedNode => {
        if (!seedNode.entrant) return;
        const pg = seedNode.phaseGroup;
        const rawIdentifier = pg?.displayIdentifier ? String(pg.displayIdentifier).trim() : '1';
        const poolName = rawIdentifier.replace(/00$/, '') || rawIdentifier;

        if (!samplePhaseGroupId && pg?.id) {
            samplePhaseGroupId = pg.id;
        }
        if (targetPhaseGroupId && pg && String(pg.id) === String(targetPhaseGroupId)) {
            preferredPoolName = poolName;
        }

        const p0 = seedNode.entrant.participants?.[0];
        let shortTag = '';
        let fullTag = '';

        if (p0 && p0.gamerTag) {
            shortTag = p0.gamerTag.trim();
            fullTag = p0.prefix ? `${p0.prefix.trim()} | ${shortTag}` : shortTag;
        } else {
            const entrantName = (seedNode.entrant.name || '').trim();
            fullTag = entrantName;
            const parts = entrantName.split(' | ');
            shortTag = parts[parts.length - 1].trim();
        }

        if (!rawGroups[poolName]) {
            rawGroups[poolName] = [];
        }
        rawGroups[poolName].push({
            phaseSeedNum: seedNode.seedNum || 999999,
            gamerTag: fullTag,
            shortGamerTag: shortTag
        });
    });

    const parsedPools = {};
    Object.keys(rawGroups)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .forEach(poolName => {
            const list = rawGroups[poolName];
            list.sort((a, b) => a.phaseSeedNum - b.phaseSeedNum);

            parsedPools[poolName] = {
                count: list.length,
                phaseName: currentPhaseNameFromApi,
                playersBySeed: {}
            };

            list.forEach((player, idx) => {
                const poolSeed = idx + 1;
                parsedPools[poolName].playersBySeed[poolSeed] = {
                    gamerTag: player.gamerTag,
                    shortGamerTag: player.shortGamerTag
                };
            });
        });

    const autoConfigSummary = await autoDetectBracketConfig(token, phaseId, samplePhaseGroupId);

    if (!applyParsedPoolsData(parsedPools, preferredPoolName, autoConfigSummary)) {
        resetCsvInput();
    }
}

fetchStartggBtn.addEventListener('click', async () => {
    const token = startggTokenInput.value.trim();
    const urlStr = startggUrlInput.value.trim();

    if (!token) {
        alert('start.gg API token を入力してください。');
        startggTokenInput.focus();
        return;
    }
    if (!urlStr) {
        alert('Bracket URL を入力してください。');
        startggUrlInput.focus();
        return;
    }

    const parsedUrl = parseStartggBracketUrl(urlStr);
    if (!parsedUrl) {
        alert('URLの形式が正しくありません。\n(例) https://www.start.gg/tournament/vic-seekers-1/event/ultimate-singles');
        startggUrlInput.focus();
        return;
    }

    localStorage.setItem('bracket_printer_startgg_token', token);
    csvUpload.value = '';
    currentTargetGroupIdFromUrl = parsedUrl.phaseGroupId;

    const origBtnText = fetchStartggBtn.textContent;
    fetchStartggBtn.textContent = '取得中...';
    fetchStartggBtn.disabled = true;

    try {
        const eventQuery = `
            query GetEventPhases($slug: String!) {
                event(slug: $slug) {
                    id
                    name
                    tournament {
                        name
                    }
                    phases {
                        id
                        name
                        bracketType
                        phaseOrder
                    }
                }
            }
        `;

        const data = await callStartggGraphQL(token, eventQuery, { slug: parsedUrl.eventSlug });
        const eventObj = data?.event;
        if (!eventObj) {
            throw new Error('指定されたURLのイベントが見つかりませんでした。');
        }

        if (!tournamentNameInput.value.trim() && eventObj.tournament?.name) {
            tournamentNameInput.value = eventObj.tournament.name;
        }

        const phases = eventObj.phases || [];
        if (phases.length === 0) {
            throw new Error('このイベントにはフェーズ（ブラケット）が作成されていません。');
        }

        startggPhasesList = phases;
        phaseSelect.innerHTML = '';
        phases.forEach(ph => {
            const opt = document.createElement('option');
            opt.value = ph.id;
            opt.textContent = ph.name || `Phase ${ph.id}`;
            phaseSelect.appendChild(opt);
        });

        if (parsedUrl.phaseId && phases.some(ph => String(ph.id) === String(parsedUrl.phaseId))) {
            phaseSelect.value = parsedUrl.phaseId;
        } else {
            phaseSelect.value = phases[0].id;
        }

        if (phases.length > 1) {
            phaseSelectWrapper.classList.remove('hidden');
        } else {
            phaseSelectWrapper.classList.add('hidden');
        }

        await loadPoolsFromStartggPhase(token, phaseSelect.value, currentTargetGroupIdFromUrl);
    } catch (err) {
        console.error(err);
        alert(`start.gg データ取得エラー:\n${err.message}`);
        resetCsvInput();
    } finally {
        fetchStartggBtn.textContent = origBtnText;
        fetchStartggBtn.disabled = false;
    }
});

phaseSelect.addEventListener('change', async () => {
    const token = startggTokenInput.value.trim();
    const selectedPhaseId = phaseSelect.value;
    if (!token || !selectedPhaseId) return;

    try {
        await loadPoolsFromStartggPhase(token, selectedPhaseId, null);
    } catch (err) {
        console.error(err);
        alert(`フェーズ切り替えエラー:\n${err.message}`);
    }
});

poolSelect.addEventListener('change', () => {
    const selected = poolSelect.value;
    const totalPools = Object.keys(poolsData).length;
    if (poolsData[selected]) {
        const detectedPhaseName = poolsData[selected].phaseName || '';
        let msg = `✅ 読み込み完了: Pool ${selected} (${poolsData[selected].count}人 / 全${totalPools}プール)`;
        if (detectedPhaseName) {
            msg += `\n📌 フェーズ名: ${detectedPhaseName}`;
        }
        if (lastAutoConfigSummary) {
            msg += `\n${lastAutoConfigSummary}`;
        }
        csvStatus.textContent = msg;
        updateRoundSelectOptions();
    }
});

function resetCsvInput() {
    csvUpload.value = '';
    isCsvValid = false;
    poolsData = {};
    lastAutoConfigSummary = '';
    csvStatus.classList.add('hidden');
    phaseSelectWrapper.classList.add('hidden');
    poolSelectWrapper.classList.add('hidden');
    const exportAllPdfBtn = document.getElementById('export-all-pdf-btn');
    if (exportAllPdfBtn) {
        exportAllPdfBtn.textContent = '全PoolをPDF一括出力 (印刷)';
    }
    updateRoundSelectOptions();
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
changeModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'yes') {
            updateRoundSelectOptions();
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

function getRoundBo(roundBaseName, bracketType) {
    const isChangeYes = document.querySelector('input[name="change-mode"]:checked').value === 'yes';
    if (!isChangeYes) return baseBoValue;

    if (bracketType === 'winners') {
        const selectedStart = winnersRoundSelect.value;
        if (selectedStart === 'none') return baseBoValue;
        const startIdx = currentActiveWinnersRounds.indexOf(selectedStart);
        const currIdx = currentActiveWinnersRounds.indexOf(roundBaseName);
        if (startIdx !== -1 && currIdx >= startIdx) {
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
        const startIdx = currentActiveLosersRounds.indexOf(selectedStart);
        const currIdx = currentActiveLosersRounds.indexOf(roundBaseName);
        if (startIdx !== -1 && currIdx >= startIdx) {
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

// === アコーディオン開閉（矢印アイコンのみを回転させ、★推奨設定バッジは絶対回転させない） ===
document.querySelectorAll('.accordion-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const content = button.nextElementSibling;
        const arrow = button.querySelector('.accordion-arrow') || button.lastElementChild;
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'flex';
            if (arrow && arrow.id !== 'print-rec-status-badge') {
                arrow.style.transform = 'rotate(180deg)';
            }
        } else {
            content.style.display = 'none';
            if (arrow && arrow.id !== 'print-rec-status-badge') {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
        if (printRecStatusBadge) {
            printRecStatusBadge.style.transform = 'none';
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
    const dummyBox = createElement('div', 'dummy-spacer-box');
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

function getQualifierFontSize(text) {
    let units = 0;
    for (const ch of text) {
        units += ch.charCodeAt(0) > 255 ? 2 : 1;
    }
    if (units > 28) return '11px';
    if (units > 20) return '12px';
    return '13px';
}

function createQualifierNode(matchSourceLabel, targetPhase, targetType = 'W', includeLoserSlot = false, lineType = 'straight') {
    const wrapper = createElement('div', 'match-wrapper');
    if (lineType === 'straight' || lineType === 'qualifier') {
        wrapper.classList.add('qualifier-line');
    }

    const box = createElement('div', 'qualifier-box');
    box.appendChild(createElement('span', 'qual-drop-label-top', `Winner of ${matchSourceLabel}`));

    const textW = `${targetPhase} [W]`;
    const textL = `${targetPhase} [L]`;
    const textSingle = `${targetPhase} [${targetType}]`;

    if (targetType === 'W' && includeLoserSlot) {
        box.style.height = '48px';
        const fontSize = getQualifierFontSize(textW.length >= textL.length ? textW : textL);
        const slot1 = createElement('div', 'qualifier-slot border-b border-black', textW);
        slot1.style.fontSize = fontSize;
        box.appendChild(slot1);

        const slot2 = createElement('div', 'qualifier-slot', textL);
        slot2.style.fontSize = fontSize;
        box.appendChild(slot2);

        box.appendChild(createElement('span', 'qual-drop-label-bottom', `Loser of ${matchSourceLabel}`));
    } else {
        box.style.height = '26px';
        const slot = createElement('div', 'qualifier-slot', textSingle);
        slot.style.fontSize = getQualifierFontSize(textSingle);
        box.appendChild(slot);
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
    if (!document.body.classList.contains('batch-printing')) {
        applyPrintAndDrawOptions();
    }
    savedZoomBeforePrint = Number(zoomSlider.value);
    isPrintingMode = true;
    scaleWrapper.style.transform = 'none';
});

window.addEventListener('afterprint', () => {
    isPrintingMode = false;
    document.body.classList.remove('batch-printing');
    batchPrintContainer.innerHTML = '';
    setZoom(savedZoomBeforePrint);
});

updateRecommendedPrintConfig(true);
updateRoundSelectOptions();
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
            wQual.appendChild(createQualifierNode(wqfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
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
            wQual.appendChild(createQualifierNode(wsfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
        }
        wContainer.append(wr3, wr4, wQual);
        for (let s = 0; s < 3; s++) nextLabel();
        return { wqfLabels, wsfLabels, wfLabel };
    }

    wfLabel = nextLabel();
    wr5.appendChild(createMatchNode(wfLabel, '', '', '', '', 'branch'));
    wQual.appendChild(createQualifierNode(wfLabel, targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
    wContainer.append(wr3, wr4, wr5, wQual);
    nextLabel();
    nextLabel();
    return { wqfLabels, wsfLabels, wfLabel };
}

// === 9〜16人用：勝者側 W1 / W2 / W4 終端構築ヘルパー ===
function appendWinnersEndingFromWQF(wContainer, wqfLabels, wCountNum, lCountNum, targetPhaseName, nextLabel) {
    const wsfCol = createRoundColumn('Winners Semi-Final', 'winners');
    const wfCol = createRoundColumn('Winners Final', 'winners');
    const wQual = createRoundColumn('', 'winners', true);

    const wsfLabels = [];
    let wfLabel = null;

    const includeLoserSlotOnFinalW = (lCountNum >= 2 * wCountNum && lCountNum > 0);

    if (wCountNum === 4) {
        for (let i = 0; i < 4; i++) {
            wQual.appendChild(createQualifierNode(wqfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
        }
        wContainer.append(wQual);
        for (let s = 0; s < 5; s++) nextLabel();
        return { wsfLabels, wfLabel };
    }

    for (let i = 0; i < 2; i++) {
        const lbl = nextLabel();
        wsfLabels.push(lbl);
        wsfCol.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    if (wCountNum === 2) {
        for (let i = 0; i < 2; i++) {
            wQual.appendChild(createQualifierNode(wsfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
        }
        wContainer.append(wsfCol, wQual);
        for (let s = 0; s < 3; s++) nextLabel();
        return { wsfLabels, wfLabel };
    }

    wfLabel = nextLabel();
    wfCol.appendChild(createMatchNode(wfLabel, '', '', '', '', 'branch'));
    wQual.appendChild(createQualifierNode(wfLabel, targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
    wContainer.append(wsfCol, wfCol, wQual);
    nextLabel();
    nextLabel();
    return { wsfLabels, wfLabel };
}

// === 17〜32人用：敗者側の後半進行ヘルパー ===
function appendLosersAfter4Matches(lContainer, fourMatchLabels, wqfLabels, wsfLabels, wfLabel, wCountNum, lCountNum, targetPhaseName, nextLabel, roundNames) {
    const lQual = createRoundColumn('', 'losers', true);

    const isFinalWLoserDirectQual = (lCountNum >= 2 * wCountNum);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, lCountNum - wCountNum) : lCountNum;

    if (wCountNum === 4 && isFinalWLoserDirectQual) {
        for (let k = 0; k < 4; k++) {
            lQual.appendChild(createQualifierNode(fourMatchLabels[k], targetPhaseName, 'L', false, 'qualifier'));
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
            lQual.appendChild(createQualifierNode(wqfDropRoundLabels[k], targetPhaseName, 'L', false, 'qualifier'));
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
            lQual.appendChild(createQualifierNode(consolidate2Labels[k], targetPhaseName, 'L', false, 'qualifier'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    if (wCountNum === 4 && targetLosersBracketQuals === 1) {
        const colFinal1 = createRoundColumn(roundNames.wsfDrop, 'losers');
        const finalLbl = nextLabel();
        colFinal1.appendChild(createMatchNode(finalLbl, '', '', '', '', 'branch'));
        lQual.appendChild(createQualifierNode(finalLbl, targetPhaseName, 'L', false, 'qualifier'));
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
            lQual.appendChild(createQualifierNode(wsfDropRoundLabels[k], targetPhaseName, 'L', false, 'qualifier'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    const colConsolidate1 = createRoundColumn(roundNames.consolidate1, 'losers');
    const consolidate1Label = nextLabel();
    colConsolidate1.appendChild(createMatchNode(consolidate1Label, '', '', '', '', 'branch'));
    lContainer.appendChild(colConsolidate1);

    if ((wCountNum === 1 && isFinalWLoserDirectQual) || wCountNum === 2) {
        lQual.appendChild(createQualifierNode(consolidate1Label, targetPhaseName, 'L', false, 'qualifier'));
        lContainer.appendChild(lQual);
        return;
    }

    const colWfDrop = createRoundColumn(roundNames.wfDrop, 'losers');
    const wfDropLabel = nextLabel();
    colWfDrop.appendChild(createMatchNode(wfDropLabel, '', '', '', '', 'straight', `Loser of ${wfLabel}`));
    lQual.appendChild(createQualifierNode(wfDropLabel, targetPhaseName, 'L', false, 'qualifier'));
    lContainer.append(colWfDrop, lQual);
}

// === 9〜16人用：敗者側の後半進行ヘルパー ===
function appendLosersAfter2Matches(lContainer, twoMatchLabels, wsfLabels, wfLabel, wCountNum, lCountNum, targetPhaseName, nextLabel, roundNames) {
    const lQual = createRoundColumn('', 'losers', true);

    const isFinalWLoserDirectQual = (lCountNum >= 2 * wCountNum);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, lCountNum - wCountNum) : lCountNum;

    if ((wCountNum === 2 && isFinalWLoserDirectQual) || (wCountNum === 4 && targetLosersBracketQuals >= 2)) {
        for (let k = 0; k < 2; k++) {
            lQual.appendChild(createQualifierNode(twoMatchLabels[k], targetPhaseName, 'L', false, 'qualifier'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    if (wCountNum === 4 && targetLosersBracketQuals === 1) {
        const colFinal1 = createRoundColumn(roundNames.consolidate1, 'losers');
        const finalLbl = nextLabel();
        colFinal1.appendChild(createMatchNode(finalLbl, '', '', '', '', 'branch'));
        lQual.appendChild(createQualifierNode(finalLbl, targetPhaseName, 'L', false, 'qualifier'));
        lContainer.append(colFinal1, lQual);
        return;
    }

    const colWsfDrop = createRoundColumn(roundNames.wsfDrop, 'losers');
    const wsfDropOrder = [wsfLabels[0], wsfLabels[1]];
    const wsfDropRoundLabels = [];
    for (let k = 0; k < 2; k++) {
        const lbl = nextLabel();
        wsfDropRoundLabels.push(lbl);
        colWsfDrop.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wsfDropOrder[k]}`));
    }
    lContainer.appendChild(colWsfDrop);

    if (targetLosersBracketQuals >= 2) {
        for (let k = 0; k < 2; k++) {
            lQual.appendChild(createQualifierNode(wsfDropRoundLabels[k], targetPhaseName, 'L', false, 'qualifier'));
        }
        lContainer.appendChild(lQual);
        return;
    }

    const colConsolidate1 = createRoundColumn(roundNames.consolidate1, 'losers');
    const consolidate1Label = nextLabel();
    colConsolidate1.appendChild(createMatchNode(consolidate1Label, '', '', '', '', 'branch'));
    lContainer.appendChild(colConsolidate1);

    if ((wCountNum === 1 && isFinalWLoserDirectQual) || wCountNum === 2) {
        lQual.appendChild(createQualifierNode(consolidate1Label, targetPhaseName, 'L', false, 'qualifier'));
        lContainer.appendChild(lQual);
        return;
    }

    const colWfDrop = createRoundColumn(roundNames.wfDrop, 'losers');
    const wfDropLabel = nextLabel();
    colWfDrop.appendChild(createMatchNode(wfDropLabel, '', '', '', '', 'straight', `Loser of ${wfLabel}`));
    lQual.appendChild(createQualifierNode(wfDropLabel, targetPhaseName, 'L', false, 'qualifier'));
    lContainer.append(colWfDrop, lQual);
}

// === 6〜8人ブラケット生成関数 ===
function render6To8Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum) {
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    const wsfTopSeeds = [1, 2];
    const effectiveWCount = Math.min(wCountNum, 2);
    const includeLoserSlotOnFinalW = (lCountNum >= 2 * effectiveWCount && lCountNum > 0);

    const wContainer = createElement('div', 'bracket-container');
    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wsfCol = createRoundColumn('Winners Semi-Final', 'winners');
    const wfCol = createRoundColumn('Winners Final', 'winners');
    const wQual = createRoundColumn('', 'winners', true);

    const wsfLabels = [];
    let wfLabel = null;
    const wr1BlockMatches = [];

    if (playerCount === 6) {
        wContainer.style.height = `${2 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
        const pairs6 = [[4, 5], [3, 6]];
        const wr1Labels6 = [];

        for (let i = 0; i < 2; i++) {
            const [s1, s2] = pairs6[i];
            const lbl = nextLabel();
            wr1Labels6.push(lbl);
            wr1.appendChild(createMatchNode(lbl, getPlayerName(s1), getPlayerName(s2), s1, s2, 'none'));
        }

        for (let i = 0; i < 2; i++) {
            const lbl = nextLabel();
            wsfLabels.push(lbl);
            const topSeed = wsfTopSeeds[i];
            wsfCol.appendChild(createMatchNode(lbl, getPlayerName(topSeed), '', topSeed, '', 'straight'));
        }

        wr1BlockMatches.push(
            { topLbl: null, botLbl: wr1Labels6[0], topSeed: 1, hasTopMatch: false },
            { topLbl: null, botLbl: wr1Labels6[1], topSeed: 2, hasTopMatch: false }
        );
    } else {
        wContainer.style.height = `${4 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
        for (let i = 0; i < 2; i++) {
            const s = wsfTopSeeds[i];
            const topOpp = 9 - s;
            const botSeed1 = 5 - s;
            const botSeed2 = 4 + s;

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

        for (let i = 0; i < 2; i++) {
            const lbl = nextLabel();
            wsfLabels.push(lbl);
            const block = wr1BlockMatches[i];
            if (block.hasTopMatch) {
                wsfCol.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
            } else {
                wsfCol.appendChild(createMatchNode(lbl, getPlayerName(block.topSeed), '', block.topSeed, '', 'straight'));
            }
        }
    }

    if (effectiveWCount === 2) {
        for (let i = 0; i < 2; i++) {
            wQual.appendChild(createQualifierNode(wsfLabels[i], targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
        }
        wContainer.append(wr1, wsfCol, wQual);
        for (let s = 0; s < 3; s++) nextLabel();
    } else {
        wfLabel = nextLabel();
        wfCol.appendChild(createMatchNode(wfLabel, '', '', '', '', 'branch'));
        wQual.appendChild(createQualifierNode(wfLabel, targetPhaseName, 'W', includeLoserSlotOnFinalW, 'qualifier'));
        wContainer.append(wr1, wsfCol, wfCol, wQual);
        nextLabel();
        nextLabel();
    }

    container.appendChild(wContainer);

    if (lCountNum === 0) return;

    const lContainer = createElement('div', 'bracket-container');
    lContainer.style.height = `${2 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
    const lQual = createRoundColumn('', 'losers', true);

    let twoMatchLabels = [];

    if (playerCount === 6) {
        const lr1 = createRoundColumn('Losers Round 1', 'losers');
        for (let k = 0; k < 2; k++) {
            const lbl = nextLabel();
            twoMatchLabels.push(lbl);
            const wsfDrop = wsfLabels[1 - k];
            const wr1Drop = wr1BlockMatches[k].botLbl;
            lr1.appendChild(createMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wsfDrop}`, `Loser of ${wr1Drop}`));
        }
        lContainer.appendChild(lr1);
    } else {
        const lr1 = createRoundColumn('Losers Round 1', 'losers');
        const lr2 = createRoundColumn('Losers Round 2', 'losers');
        const lr1Labels = [];

        for (let k = 0; k < 2; k++) {
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

        for (let k = 0; k < 2; k++) {
            const lbl = nextLabel();
            twoMatchLabels.push(lbl);
            const wsfDrop = wsfLabels[1 - k];
            const block = wr1BlockMatches[k];

            if (lr1Labels[k] !== null) {
                lr2.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wsfDrop}`));
            } else {
                lr2.appendChild(createMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wsfDrop}`, `Loser of ${block.botLbl}`));
            }
        }
        lContainer.append(lr1, lr2);
    }

    const isFinalWLoserDirectQual = (lCountNum >= 2 * effectiveWCount);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, lCountNum - effectiveWCount) : lCountNum;

    if (targetLosersBracketQuals >= 2) {
        for (let k = 0; k < 2; k++) {
            lQual.appendChild(createQualifierNode(twoMatchLabels[k], targetPhaseName, 'L', false, 'qualifier'));
        }
        lContainer.appendChild(lQual);
    } else {
        const lsfCol = createRoundColumn('Losers Semi-Final', 'losers');
        const lsfLabel = nextLabel();
        lsfCol.appendChild(createMatchNode(lsfLabel, '', '', '', '', 'branch'));
        lContainer.appendChild(lsfCol);

        if ((effectiveWCount === 1 && isFinalWLoserDirectQual) || effectiveWCount === 2) {
            lQual.appendChild(createQualifierNode(lsfLabel, targetPhaseName, 'L', false, 'qualifier'));
            lContainer.appendChild(lQual);
        } else {
            const lfCol = createRoundColumn('Losers Final', 'losers');
            const lfLabel = nextLabel();
            lfCol.appendChild(createMatchNode(lfLabel, '', '', '', '', 'straight', `Loser of ${wfLabel}`));
            lQual.appendChild(createQualifierNode(lfLabel, targetPhaseName, 'L', false, 'qualifier'));
            lContainer.append(lfCol, lQual);
        }
    }

    container.appendChild(lContainer);
}

// === 9〜12人ブラケット生成関数 ===
function render9To12Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum) {
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    const wqfTopSeeds = [1, 4, 2, 3];
    const wr1SeedPairs = wqfTopSeeds.map(s => [9 - s, 17 - (9 - s)]);

    const wContainer = createElement('div', 'bracket-container');
    wContainer.style.height = `${4 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wqfCol = createRoundColumn('Winners Quarter-Final', 'winners');

    const wr1Labels = [];
    for (let i = 0; i < 4; i++) {
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

    const wqfLabels = [];
    for (let i = 0; i < 4; i++) {
        const lbl = nextLabel();
        wqfLabels.push(lbl);
        const topSeed = wqfTopSeeds[i];
        const [wr1TopSeed] = wr1SeedPairs[i];

        if (wr1Labels[i] !== null) {
            wqfCol.appendChild(createMatchNode(lbl, getPlayerName(topSeed), '', topSeed, '', 'straight'));
        } else {
            wqfCol.appendChild(createMatchNode(lbl, getPlayerName(topSeed), getPlayerName(wr1TopSeed), topSeed, wr1TopSeed, 'none'));
        }
    }

    wContainer.append(wr1, wqfCol);
    const { wsfLabels, wfLabel } = appendWinnersEndingFromWQF(wContainer, wqfLabels, wCountNum, lCountNum, targetPhaseName, nextLabel);
    container.appendChild(wContainer);

    if (lCountNum === 0) return;

    const hasAnyDoubleLr1Pair = playerCount >= 11;
    const losersUnitSlots = hasAnyDoubleLr1Pair ? 4 : 2;

    const lContainer = createElement('div', 'bracket-container');
    lContainer.style.height = `${losersUnitSlots * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
    const lr1 = createRoundColumn('Losers Round 1', 'losers');
    const lr2 = createRoundColumn('Losers Round 2', 'losers');

    const lr1Labels = [];
    for (let j = 0; j < 4; j++) {
        lr1Labels.push(wr1Labels[j] !== null ? nextLabel() : null);
    }

    const lr2Labels = [];
    for (let k = 0; k < 2; k++) {
        lr2Labels.push(nextLabel());
    }

    for (let k = 0; k < 2; k++) {
        const jTop = 2 * k;
        const jBot = 2 * k + 1;
        const wqfDropTop = wqfLabels[3 - jTop];
        const wqfDropBot = wqfLabels[3 - jBot];
        const hasTopLr1 = lr1Labels[jTop] !== null;
        const hasBotLr1 = lr1Labels[jBot] !== null;

        const pairGroup = createElement('div', 'pair-group');

        if (hasTopLr1 && hasBotLr1) {
            pairGroup.appendChild(createMatchNode(lr1Labels[jTop], '', '', '', '', 'none', `Loser of ${wqfDropTop}`, `Loser of ${wr1Labels[jTop]}`));
            pairGroup.appendChild(createMatchNode(lr1Labels[jBot], '', '', '', '', 'none', `Loser of ${wqfDropBot}`, `Loser of ${wr1Labels[jBot]}`));
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'branch'));
        } else if (hasTopLr1 && !hasBotLr1) {
            pairGroup.appendChild(createMatchNode(lr1Labels[jTop], '', '', '', '', 'none', `Loser of ${wqfDropTop}`, `Loser of ${wr1Labels[jTop]}`));
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'straight', '', `Loser of ${wqfDropBot}`));
        } else {
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'none', `Loser of ${wqfDropTop}`, `Loser of ${wqfDropBot}`));
        }
    }

    lContainer.append(lr1, lr2);

    appendLosersAfter2Matches(
        lContainer,
        lr2Labels,
        wsfLabels,
        wfLabel,
        wCountNum,
        lCountNum,
        targetPhaseName,
        nextLabel,
        {
            wsfDrop: 'Losers Quarter-Final',
            consolidate1: 'Losers Semi-Final',
            wfDrop: 'Losers Final'
        }
    );

    container.appendChild(lContainer);
}

// === 13〜16人ブラケット生成関数 ===
function render13To16Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum) {
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    const wqfTopSeeds = [1, 4, 2, 3];

    const wContainer = createElement('div', 'bracket-container');
    wContainer.style.height = `${8 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wqfCol = createRoundColumn('Winners Quarter-Final', 'winners');

    const wr1BlockMatches = [];
    for (let i = 0; i < 4; i++) {
        const s = wqfTopSeeds[i];
        const topOpp = 17 - s;
        const botSeed1 = 9 - s;
        const botSeed2 = 8 + s;

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

    const wqfLabels = [];
    for (let i = 0; i < 4; i++) {
        const lbl = nextLabel();
        wqfLabels.push(lbl);
        const block = wr1BlockMatches[i];

        if (block.hasTopMatch) {
            wqfCol.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
        } else {
            wqfCol.appendChild(createMatchNode(lbl, getPlayerName(block.topSeed), '', block.topSeed, '', 'straight'));
        }
    }

    wContainer.append(wr1, wqfCol);
    const { wsfLabels, wfLabel } = appendWinnersEndingFromWQF(wContainer, wqfLabels, wCountNum, lCountNum, targetPhaseName, nextLabel);
    container.appendChild(wContainer);

    if (lCountNum === 0) return;

    const lContainer = createElement('div', 'bracket-container');
    lContainer.style.height = `${4 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
    const lr1 = createRoundColumn('Losers Round 1', 'losers');
    const lr2 = createRoundColumn('Losers Round 2', 'losers');
    const lr3 = createRoundColumn('Losers Round 3', 'losers');

    const lr1Labels = [];
    for (let k = 0; k < 4; k++) {
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
    for (let k = 0; k < 4; k++) {
        const lbl = nextLabel();
        lr2Labels.push(lbl);
        const wqfDrop = wqfLabels[3 - k];
        const block = wr1BlockMatches[k];

        if (lr1Labels[k] !== null) {
            lr2.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wqfDrop}`));
        } else {
            lr2.appendChild(createMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wqfDrop}`, `Loser of ${block.botLbl}`));
        }
    }

    const lr3Labels = [];
    for (let k = 0; k < 2; k++) {
        const lbl = nextLabel();
        lr3Labels.push(lbl);
        lr3.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    lContainer.append(lr1, lr2, lr3);

    appendLosersAfter2Matches(
        lContainer,
        lr3Labels,
        wsfLabels,
        wfLabel,
        wCountNum,
        lCountNum,
        targetPhaseName,
        nextLabel,
        {
            wsfDrop: 'Losers Quarter-Final',
            consolidate1: 'Losers Semi-Final',
            wfDrop: 'Losers Final'
        }
    );

    container.appendChild(lContainer);
}

// === 17〜24人ブラケット生成関数 ===
function render17To24Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum) {
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    const wr2TopSeeds = [1, 8, 4, 5, 2, 7, 3, 6];
    const wr1SeedPairs = wr2TopSeeds.map(s => [17 - s, 33 - (17 - s)]);

    const wContainer = createElement('div', 'bracket-container');
    wContainer.style.height = `${8 * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
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

    const hasAnyDoubleLr1Pair = playerCount >= 21;
    const losersUnitSlots = hasAnyDoubleLr1Pair ? 8 : 4;

    const lContainer = createElement('div', 'bracket-container');
    lContainer.style.height = `${losersUnitSlots * SLOT_HEIGHT_24 + ROUND_HEADER_TOTAL_HEIGHT}px`;
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
    wContainer.style.height = `${16 * WINNERS_SLOT_HEIGHT_32 + ROUND_HEADER_TOTAL_HEIGHT}px`;
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
    lContainer.style.height = `${8 * LOSERS_SLOT_HEIGHT_32 + ROUND_HEADER_TOTAL_HEIGHT}px`;
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
            consolidate2: 'Losers Round 5',
            wsfDrop: 'Losers Quarter-Final',
            consolidate1: 'Losers Semi-Final',
            wfDrop: 'Losers Final'
        }
    );

    container.appendChild(lContainer);
}

// === 指定されたPool名でプレビュー領域を描画する共通関数 ===
function renderPoolSheet(poolName) {
    const currentPool = poolsData[poolName];
    if (!currentPool) return false;

    const playerCount = currentPool.count;
    if (playerCount < 6 || playerCount > 32) {
        alert(`エラー: Pool ${poolName} の人数は ${playerCount}人 です。\n本アプリは1プールあたり 6〜32人 のトーナメントに対応しています。`);
        return false;
    }

    poolSelect.value = poolName;
    updateRoundSelectOptions();

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
    document.getElementById('pool-title').textContent = buildPoolHeaderTitle(poolName, elimTitle, playerCount);
    document.getElementById('pool-subtitle').textContent = isSingle
        ? `Qualifier: ${wCount}`
        : `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`;

    const container = document.getElementById('bracket-container');
    container.innerHTML = ''; 
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '24px';

    if (playerCount >= 25) {
        render25To32Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    } else if (playerCount >= 17) {
        render17To24Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    } else if (playerCount >= 13) {
        render13To16Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    } else if (playerCount >= 9) {
        render9To12Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    } else {
        render6To8Bracket(container, playerCount, getPlayerName, targetPhaseName, wCountNum, lCountNum);
    }

    const rosterContainer = document.getElementById('checkin-roster-container');
    rosterContainer.innerHTML = '';
    rosterContainer.appendChild(createCheckinRosterTable(currentPool, playerCount));

    applyPrintAndDrawOptions();
    return true;
}

// === ブラケット＆名簿生成ボタンのイベント ===
generateBtn.addEventListener('click', () => {
    const selectedPoolName = poolSelect.value;
    if (!poolsData[selectedPoolName]) {
        alert('プールデータが見つかりません。CSVまたはstart.gg APIからデータを読み込んでください。');
        return;
    }

    if (renderPoolSheet(selectedPoolName)) {
        requestAnimationFrame(fitToViewport);
    }
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
        let dataUrl = null;
        const width = previewArea.offsetWidth;
        const height = previewArea.offsetHeight;

        const filterNode = (node) => {
            if (node.classList && (node.classList.contains('hidden') || node.classList.contains('text-box-controls'))) {
                return false;
            }
            return true;
        };

        if (window.htmlToImage) {
            try {
                dataUrl = await htmlToImage.toJpeg(previewArea, {
                    quality: 0.95,
                    pixelRatio: 2,
                    backgroundColor: '#ffffff',
                    width: width,
                    height: height,
                    filter: filterNode,
                    style: { transform: 'none', margin: '0' }
                });
            } catch (primaryErr) {
                console.warn('html-to-image での変換に失敗したため、html2canvas にフォールバックします:', primaryErr);
            }
        }

        if (!dataUrl) {
            const canvas = await html2canvas(previewArea, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: width,
                height: height,
                windowWidth: width + 100,
                windowHeight: height + 100,
                scrollX: 0,
                scrollY: 0,
                ignoreElements: (el) => el.classList && (el.classList.contains('hidden') || el.classList.contains('text-box-controls'))
            });
            dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        }

        const link = document.createElement('a');
        link.download = `bracket-pool-${poolSelect.value || 'preview'}.jpg`;
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

// === 単一プール PDF出力機能 ===
document.getElementById('export-pdf-btn').addEventListener('click', () => {
    const isSheetDrawn = !document.getElementById('main-sheet-body').classList.contains('hidden');
    if (!isSheetDrawn && !generateBtn.disabled) {
        renderPoolSheet(poolSelect.value);
    }
    applyPrintAndDrawOptions();
    savedZoomBeforePrint = Number(zoomSlider.value);
    isPrintingMode = true;
    scaleWrapper.style.transform = 'none';

    setTimeout(() => {
        window.print();
        isPrintingMode = false;
        setZoom(savedZoomBeforePrint);
    }, 50);
});

// === 複数プール PDF一括出力機能 ===
document.getElementById('export-all-pdf-btn').addEventListener('click', () => {
    const poolNames = Object.keys(poolsData);
    if (poolNames.length === 0) {
        alert('プールデータが読み込まれていません。手順1でCSVまたはstart.ggからデータを読み込んでください。');
        return;
    }
    if (generateBtn.disabled) {
        alert('初期設定（手順1〜6）をすべて完了させてから実行してください。');
        return;
    }

    const originalPoolName = poolSelect.value || poolNames[0];
    savedZoomBeforePrint = Number(zoomSlider.value);
    isPrintingMode = true;
    scaleWrapper.style.transform = 'none';
    batchPrintContainer.innerHTML = '';

    poolNames.forEach((pName, idx) => {
        renderPoolSheet(pName);
        const { canvasWidth, canvasHeight, printScale, scaledBoxWidth, scaledBoxHeight } = lastComputedPrintMetrics;

        const pageWrapper = document.createElement('div');
        pageWrapper.style.position = 'relative';
        pageWrapper.style.width = `${scaledBoxWidth}px`;
        pageWrapper.style.height = `${scaledBoxHeight}px`;
        pageWrapper.style.maxWidth = `${scaledBoxWidth}px`;
        pageWrapper.style.maxHeight = `${scaledBoxHeight}px`;
        pageWrapper.style.overflow = 'hidden';
        pageWrapper.style.margin = '0 auto';
        pageWrapper.style.padding = '0';
        pageWrapper.style.pageBreakInside = 'avoid';
        pageWrapper.style.breakInside = 'avoid';

        if (idx < poolNames.length - 1) {
            pageWrapper.style.pageBreakAfter = 'always';
            pageWrapper.style.breakAfter = 'page';
        } else {
            pageWrapper.style.pageBreakAfter = 'auto';
            pageWrapper.style.breakAfter = 'auto';
        }

        const clonedSheet = previewArea.cloneNode(true);
        clonedSheet.removeAttribute('id');
        clonedSheet.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        clonedSheet.className = 'batch-print-sheet text-gray-800 relative';
        clonedSheet.style.position = 'absolute';
        clonedSheet.style.left = '0';
        clonedSheet.style.top = '0';
        clonedSheet.style.width = `${canvasWidth}px`;
        clonedSheet.style.height = `${canvasHeight}px`;
        clonedSheet.style.minHeight = `${canvasHeight}px`;
        clonedSheet.style.transform = `scale(${printScale.toFixed(5)})`;
        clonedSheet.style.transformOrigin = 'top left';
        clonedSheet.style.margin = '0';
        clonedSheet.style.boxShadow = 'none';

        pageWrapper.appendChild(clonedSheet);
        batchPrintContainer.appendChild(pageWrapper);
    });

    renderPoolSheet(originalPoolName);
    scaleWrapper.style.transform = 'none';

    document.body.classList.add('batch-printing');

    setTimeout(() => {
        window.print();
        document.body.classList.remove('batch-printing');
        batchPrintContainer.innerHTML = '';
        isPrintingMode = false;
        setZoom(savedZoomBeforePrint);
    }, 80);
});
