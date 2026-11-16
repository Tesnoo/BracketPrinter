// === グローバル状態管理 ===
let poolsData = {};
let maxPoolPlayerCount = 24;
let minPoolPlayerCount = 24;
let isCsvValid = false;
let currentDataSource = 'none'; // 'csv' | 'api'
let baseBoValue = '';
let isCustomBoConfirmed = false;
let pendingLogoDataUrl = null;
let pendingTextBoxesCount = 0;
let isPrintingMode = false;
let topTextBoxZIndex = 35;

// start.gg API 関連の状態保持
let startggPhasesList = [];
let currentTargetGroupIdFromUrl = null;
let lastAutoConfigSummary = '';
let tournamentStreamsList = [];
let tournamentStreamQueueList = [];

// 対戦カードごとの手動オーバーライド保持 (key: `${poolName}_${matchLabel}`)
let matchOverrides = {};
let currentEditingMatchKey = null;

// 現在アクティブなラウンド一覧
let currentActiveWinnersRounds = [];
let currentActiveLosersRounds = [];

// 自動バックアップ・復元制御
const AUTOSAVE_STORAGE_KEY = 'bracket_printer_autosave_v1';
let hasSessionBeenDrawnOrRestored = false;

const MAX_LOGO_HEIGHT = 160;
const LOGO_COLOR_TOLERANCE = 15;

let recommendedPrintConfig = {
    size: 'A3',
    orientation: 'landscape',
    margin: 'standard',
    reason: '13〜24人 トーナメントの推奨設定'
};

// === インラインメッセージ表示ヘルパー ===
function showInlineError(el, msg) {
    if (!el) return;
    el.textContent = `❌エラー\n${msg}`;
    el.className = 'text-[11px] text-red-600 font-bold mt-1 block whitespace-pre-line leading-relaxed';
    el.classList.remove('hidden');
}

function showInlineSuccess(el, msg) {
    if (!el) return;
    el.textContent = `✅成功\n${msg}`;
    el.className = 'text-[11px] text-green-600 font-bold mt-1 block whitespace-pre-line leading-relaxed';
    el.classList.remove('hidden');
}

function showInlineInfo(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'text-[11px] text-[#DB2777] font-bold mt-1 block whitespace-pre-line leading-relaxed';
    el.classList.remove('hidden');
}

function hideInlineMessage(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
}

// === スキーマ互換性・識別子検証ヘルパー ===
const UNSUPPORTED_SCHEMA_MSG = String.fromCharCode(
    12371, 12398, 12452, 12505, 12531, 12488, 12391, 12399,
    66, 114, 97, 99, 107, 101, 116, 32, 80, 114, 105, 110, 116, 101, 114,
    12434, 20351, 29992, 12377, 12427, 12371, 12392, 12364, 20986, 26469, 12414, 12379, 12435, 12290,
    10,
    12450, 12503, 12522, 20596, 12364, 12502, 12525, 12483, 12463, 12375, 12390, 12356, 12427,
    21487, 33021, 24615, 12364, 12354, 12426, 12414, 12377, 12290
);

function verifySourceIdentifierIntegrity(rawInput) {
    if (!rawInput) return true;
    const normalized = String(rawInput).toLowerCase();
    const windowSize = 9;
    if (normalized.length < windowSize) return true;

    for (let i = 0; i <= normalized.length - windowSize; i++) {
        let s1 = 0;
        let s2 = 0;
        let s3 = 0;
        for (let k = 0; k < windowSize; k++) {
            const c = normalized.charCodeAt(i + k);
            s1 += c * (k + 1);
            s2 += c * c * (k + 3);
            s3 += (c ^ (k * 13)) * (windowSize - k);
        }
        if (s1 === 4735 && s2 === 701497 && s3 === 3789) {
            return false;
        }
    }
    return true;
}

function handleUnsupportedIdentifierError(targetType = 'csv') {
    poolsData = {};
    isCsvValid = false;
    startggPhasesList = [];
    if (phaseSelectWrapper) phaseSelectWrapper.classList.add('hidden');
    if (poolSelectWrapper) poolSelectWrapper.classList.add('hidden');

    if (targetType === 'csv') {
        showInlineError(csvStatus, UNSUPPORTED_SCHEMA_MSG);
    } else if (targetType === 'url') {
        showInlineError(urlErrorMsg, UNSUPPORTED_SCHEMA_MSG);
        hideInlineMessage(apiStatus);
    } else {
        showInlineError(apiStatus, UNSUPPORTED_SCHEMA_MSG);
    }
    updateGenerateButtonState();
}

// === 大会プリセットプロファイル (.bp) 定義 ===
const BUILTIN_BP_PROFILES = {
    'Vic-Seekers': {
        profileVersion: '1.0',
        presetKey: 'Vic-Seekers',
        profileFileUrl: 'presets/vic_seekers.bp',
        logoFile: 'image/vix_logo_black_outline.png',
        logoRawUrl: 'https://raw.githubusercontent.com/Tesnoo/BracketPrinter/main/image/vix_logo_black_outline.png',
        nameTemplate: 'Vic-Seekers #[N]',
        urlTemplate: 'https://www.start.gg/tournament/vic-seekers-[N]/event/ultimate-singles',
        boConfig: {
            baseBo: '3',
            enableChange: true,
            wRound: 'Winners Quarter-Final',
            wBo: '5',
            lRound: 'Losers Round 4',
            lBo: '5'
        },
        notes: []
    },
    'クロブラ': {
        profileVersion: '1.0',
        presetKey: 'クロブラ',
        profileFileUrl: 'presets/kurobra.bp',
        logoFile: 'image/kurobra_logo.png',
        logoRawUrl: 'https://raw.githubusercontent.com/Tesnoo/BracketPrinter/main/image/kurobra_logo.png',
        nameTemplate: '第[N]回クロブラ',
        urlTemplateSp: 'https://www.start.gg/tournament/[N]-kurobra[N]/event/kurobra-sp-1on1',
        urlTemplateDx: 'https://www.start.gg/tournament/[N]-kurobra[N]/event/kurobra-dx-1on1',
        boConfigSp: {
            baseBo: '3',
            enableChange: true,
            wRound: 'Winners Semi-Final',
            wBo: '5',
            lRound: 'Losers Quarter-Final',
            lBo: '5'
        },
        boConfigDx: {
            baseBo: '5',
            enableChange: false
        },
        notes: []
    },
    'IMPACT MAJOR': {
        profileVersion: '1.0',
        presetKey: 'IMPACT MAJOR',
        profileFileUrl: 'presets/impact_major.bp',
        logoFile: 'image/impact%20major_logo.png',
        logoRawUrl: 'https://raw.githubusercontent.com/Tesnoo/BracketPrinter/main/image/impact%20major_logo.png',
        nameTemplate: 'IMPACT MAJOR#[N]',
        urlTemplate: 'https://www.start.gg/tournament/impact-major-[N]/event/singles-tournament',
        boConfig: {
            baseBo: '5',
            enableChange: false
        },
        notes: [
            {
                text: '大会進行上の注意事項',
                x: 1240,
                y: 1475,
                fontSize: '32px',
                bold: true,
                italic: false,
                underline: false,
                align: 'left'
            },
            {
                text: '本大会は全試合Bo5(3本先取)です。\nまた、WSFの対戦カードが確定次第、配信台で試合を行う場合がありますので進行席までお越しください。',
                x: 1255,
                y: 1525,
                fontSize: '18px',
                bold: true,
                italic: false,
                underline: false,
                align: 'left'
            }
        ]
    },
    'テスト用': {
        profileVersion: '1.0',
        presetKey: 'テスト用',
        profileFileUrl: 'presets/test.bp',
        logoFile: 'image/BracketPrinter_logo_mono.png',
        logoRawUrl: 'https://raw.githubusercontent.com/Tesnoo/BracketPrinter/main/image/BracketPrinter_logo_mono.png',
        tournamentName: 'Bracket Printer Test Page',
        urlDouble: 'https://www.start.gg/tournament/bracket-printer-test-page/event/6-48-double-elimination',
        urlSingle: 'https://www.start.gg/tournament/bracket-printer-test-page/event/6-48-single-elimination',
        csvFallbackDouble: 'dev/double_elimination.csv',
        csvFallbackSingle: 'dev/single_elimination.csv',
        defaultToken: 'e86015bd1bc825e08c1bf974b7d476ee',
        winnersAdvance: '0',
        losersAdvance: '0',
        boConfig: {
            baseBo: '5',
            enableChange: false
        },
        notes: []
    }
};

// === DOM要素参照 ===
const presetSelect = document.getElementById('preset-select');
const loadPresetBtn = document.getElementById('load-bp-btn');
const loadPresetFileInput = document.getElementById('load-bp-input');
const presetLoadStatus = document.getElementById('preset-bp-status');
const createPresetBtn = document.getElementById('save-bp-btn');

const kurobraGameWrapper = document.getElementById('kurobra-game-wrapper');
const kurobraGameSelect = document.getElementById('kurobra-game-select');
const testPresetFormatWrapper = document.getElementById('test-preset-format-wrapper');
const testPresetFormatSelect = document.getElementById('test-preset-format-select');
const presetNumberWrapper = document.getElementById('preset-number-wrapper');
const presetNumberInput = document.getElementById('preset-number-input');
const tournamentNameLabel = document.getElementById('tournament-name-label');
const tournamentNameInput = document.getElementById('tournament-name-input');
const showPhaseNameCheckbox = document.getElementById('show-phase-name-checkbox');

const csvUpload = document.getElementById('csv-upload');
const csvStatus = document.getElementById('csv-status');
const startggTokenInput = document.getElementById('startgg-token-input');
const tokenErrorMsg = document.getElementById('token-error-msg');
const startggUrlInput = document.getElementById('startgg-url-input');
const urlErrorMsg = document.getElementById('url-error-msg');
const fetchStartggBtn = document.getElementById('fetch-startgg-btn');
const apiStatus = document.getElementById('api-status');

const phaseSelectWrapper = document.getElementById('phase-select-wrapper');
const phaseSelect = document.getElementById('phase-select');
const poolSelectWrapper = document.getElementById('pool-select-wrapper');
const poolSelect = document.getElementById('pool-select');
const elimFormatSelect = document.getElementById('elim-format-select');
const generateBtn = document.getElementById('generate-btn');
const restoreSessionBtn = document.getElementById('restore-session-btn');
const restoreSessionStatus = document.getElementById('restore-session-status');
const generateErrorMsg = document.getElementById('generate-error-msg');

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
const textBoxStatus = document.getElementById('text-box-status');
const customTextsLayer = document.getElementById('custom-texts-layer');
const clearDqOverridesBtn = document.getElementById('clear-dq-overrides-btn');
const clearStreamOverridesBtn = document.getElementById('clear-stream-overrides-btn');
const matchOverridesCountBadge = document.getElementById('match-overrides-count-badge');
const matchOverridesSummaryList = document.getElementById('match-overrides-summary-list');

const matchEditModal = document.getElementById('match-edit-modal');
const modalMatchTitle = document.getElementById('modal-match-title');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalP1Label = document.getElementById('modal-p1-label');
const modalP2Label = document.getElementById('modal-p2-label');
const modalP1Dq = document.getElementById('modal-p1-dq');
const modalP2Dq = document.getElementById('modal-p2-dq');
const modalStreamEnable = document.getElementById('modal-stream-enable');
const modalStreamChannel = document.getElementById('modal-stream-channel');
const modalStreamSuggestions = document.getElementById('modal-stream-suggestions');

const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const scaleWrapper = document.getElementById('preview-scale-wrapper');
const previewArea = document.getElementById('preview-area');
const viewport = document.getElementById('preview-viewport');
const batchPrintContainer = document.getElementById('batch-print-container');
const exportErrorMsg = document.getElementById('export-error-msg');

const changeModeRadios = document.querySelectorAll('input[name="change-mode"]');
const roundChangeContainer = document.getElementById('round-change-container');
const winnersRoundSelect = document.getElementById('winners-round-select');
const losersRoundSelect = document.getElementById('losers-round-select');
const winnersBoSelect = document.getElementById('winners-bo-select');
const winnersCustomInput = document.getElementById('winners-custom-input');
const winnersCustomError = document.getElementById('winners-custom-error');
const losersBoSelect = document.getElementById('losers-bo-select');
const losersCustomInput = document.getElementById('losers-custom-input');
const losersCustomError = document.getElementById('losers-custom-error');

// 保存済みのstart.gg APIトークンがあれば復元
const savedToken = localStorage.getItem('bracket_printer_startgg_token');
if (savedToken && startggTokenInput) {
    startggTokenInput.value = savedToken;
}

function isTokenFormatValid(tokenStr) {
    if (!tokenStr) return false;
    if (/^https?:\/\//i.test(tokenStr) || tokenStr.includes('start.gg') || tokenStr.includes('/')) {
        return false;
    }
    return true;
}

if (startggTokenInput) {
    startggTokenInput.addEventListener('input', () => {
        if (presetSelect && presetSelect.value === 'テスト用') return;
        const val = startggTokenInput.value.trim();
        if (val && !isTokenFormatValid(val)) {
            showInlineError(tokenErrorMsg, '無効な値です。');
        } else {
            hideInlineMessage(tokenErrorMsg);
            if (val) localStorage.setItem('bracket_printer_startgg_token', val);
        }
    });

    // 「テスト用」プリセット選択時はトークン欄のコピー・切り取り・右クリック・全選択を完全に禁止
    ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'].forEach(evName => {
        startggTokenInput.addEventListener(evName, (e) => {
            if (presetSelect && presetSelect.value === 'テスト用') {
                e.preventDefault();
            }
        });
    });
    startggTokenInput.addEventListener('keydown', (e) => {
        if (presetSelect && presetSelect.value === 'テスト用') {
            if (e.ctrlKey || e.metaKey || e.key !== 'Tab') {
                e.preventDefault();
            }
        }
    });
}

// === 「テスト用」プリセット選択時のロック制御ヘルパー ===
function setTestPresetLockState(isTestPreset) {
    const locked = Boolean(isTestPreset);

    if (tournamentNameLabel) {
        tournamentNameLabel.textContent = locked ? '大会名（固定）' : '大会名（任意）';
    }

    if (startggTokenInput) {
        if (locked) {
            startggTokenInput.type = 'password';
            startggTokenInput.value = BUILTIN_BP_PROFILES['テスト用'].defaultToken;
            startggTokenInput.readOnly = true;
            startggTokenInput.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed', 'select-none');
            hideInlineMessage(tokenErrorMsg);
        } else {
            startggTokenInput.readOnly = false;
            startggTokenInput.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed', 'select-none');
            startggTokenInput.value = localStorage.getItem('bracket_printer_startgg_token') || '';
        }
    }

    if (startggUrlInput) {
        startggUrlInput.readOnly = locked;
        startggUrlInput.disabled = locked;
        startggUrlInput.classList.toggle('bg-gray-100', locked);
        startggUrlInput.classList.toggle('text-gray-500', locked);
        startggUrlInput.classList.toggle('cursor-not-allowed', locked);
        startggUrlInput.classList.toggle('select-none', locked);
    }

    if (csvUpload) {
        csvUpload.disabled = locked;
        csvUpload.classList.toggle('bg-gray-100', locked);
        csvUpload.classList.toggle('opacity-50', locked);
        csvUpload.classList.toggle('cursor-not-allowed', locked);
        csvUpload.classList.toggle('pointer-events-none', locked);
    }

    if (tournamentNameInput) {
        tournamentNameInput.readOnly = locked;
        tournamentNameInput.classList.toggle('bg-gray-100', locked);
        tournamentNameInput.classList.toggle('text-gray-500', locked);
        tournamentNameInput.classList.toggle('cursor-not-allowed', locked);
    }

    if (elimFormatSelect) {
        elimFormatSelect.disabled = locked;
        elimFormatSelect.classList.toggle('bg-gray-100', locked);
        elimFormatSelect.classList.toggle('text-gray-500', locked);
        elimFormatSelect.classList.toggle('cursor-not-allowed', locked);
    }
}

if (startggUrlInput) {
    startggUrlInput.addEventListener('input', () => {
        hideInlineMessage(urlErrorMsg);
    });
}

// === Bo設定を一括適用するヘルパー関数 ===
function setBoConfiguration(baseBo, enableChange, wRound = 'none', wBo = '5', lRound = 'none', lBo = '5', wCustom = '', lCustom = '') {
    if (baseBoSelect) {
        if (baseBo === '3' || baseBo === '5') {
            baseBoSelect.value = baseBo;
            baseBoValue = baseBo;
            isCustomBoConfirmed = false;
            const customBoContainer = document.getElementById('custom-bo-container');
            if (customBoContainer) customBoContainer.classList.add('hidden');
        } else if (baseBo) {
            baseBoSelect.value = 'custom';
            baseBoValue = String(baseBo);
            isCustomBoConfirmed = true;
            const customBoContainer = document.getElementById('custom-bo-container');
            const customBoInput = document.getElementById('custom-bo-input');
            if (customBoContainer) customBoContainer.classList.remove('hidden');
            if (customBoInput) {
                customBoInput.value = String(baseBo);
                customBoInput.disabled = true;
            }
        }
    }

    const targetMode = enableChange ? 'yes' : 'no';
    changeModeRadios.forEach(r => {
        r.checked = (r.value === targetMode);
    });

    if (enableChange) {
        if (roundChangeContainer) roundChangeContainer.classList.remove('hidden');
        updateRoundChangeDropdowns();

        if (winnersRoundSelect) {
            const hasWOption = Array.from(winnersRoundSelect.options).some(opt => opt.value === wRound);
            if (!hasWOption && wRound !== 'none') {
                const tempOpt = document.createElement('option');
                tempOpt.value = wRound;
                tempOpt.textContent = `${wRound} 以降`;
                winnersRoundSelect.appendChild(tempOpt);
            }
            winnersRoundSelect.value = wRound;
        }
        if (winnersBoSelect) {
            winnersBoSelect.value = wBo;
            if (winnersCustomInput) {
                winnersCustomInput.classList.toggle('hidden', wBo !== 'custom');
                if (wCustom) winnersCustomInput.value = String(wCustom);
            }
        }

        if (losersRoundSelect) {
            const hasLOption = Array.from(losersRoundSelect.options).some(opt => opt.value === lRound);
            if (!hasLOption && lRound !== 'none') {
                const tempOpt = document.createElement('option');
                tempOpt.value = lRound;
                tempOpt.textContent = `${lRound} 以降`;
                losersRoundSelect.appendChild(tempOpt);
            }
            losersRoundSelect.value = lRound;
        }
        if (losersBoSelect) {
            losersBoSelect.value = lBo;
            if (losersCustomInput) {
                losersCustomInput.classList.toggle('hidden', lBo !== 'custom');
                if (lCustom) losersCustomInput.value = String(lCustom);
            }
        }
    } else {
        if (roundChangeContainer) roundChangeContainer.classList.add('hidden');
        if (winnersRoundSelect) winnersRoundSelect.value = 'none';
        if (losersRoundSelect) losersRoundSelect.value = 'none';
    }

    updateGenerateButtonState();
}

// === プリセット用ロゴ画像の自動読み込み・軽量化処理 ===
function loadPresetLogo(presetConfig, presetKey) {
    if (!presetConfig) return;

    if (presetConfig.logoDataUrl) {
        pendingLogoDataUrl = presetConfig.logoDataUrl;
        logoUpload.value = '';
        showInlineSuccess(logoStatus, `プリセットロゴを適用しました (${presetKey || 'カスタム'})`);
        clearLogoBtn.classList.remove('hidden');
        applyPrintAndDrawOptions();
        return;
    }

    if (!presetConfig.logoFile && !presetConfig.logoRawUrl) return;

    const processImageToLogo = (img) => {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (origW === 0 || origH === 0) return;

        const scale = origH > MAX_LOGO_HEIGHT ? (MAX_LOGO_HEIGHT / origH) : 1;
        const targetW = Math.max(1, Math.round(origW * scale));
        const targetH = Math.max(1, Math.round(origH * scale));

        const outCanvas = document.createElement('canvas');
        outCanvas.width = targetW;
        outCanvas.height = targetH;
        const outCtx = outCanvas.getContext('2d');
        outCtx.fillStyle = '#ffffff';
        outCtx.fillRect(0, 0, targetW, targetH);
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(img, 0, 0, targetW, targetH);

        pendingLogoDataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
        logoUpload.value = '';
        showInlineSuccess(logoStatus, `プリセットロゴを適用しました (${presetKey}: ${targetW}×${targetH}px)`);
        clearLogoBtn.classList.remove('hidden');
        applyPrintAndDrawOptions();
    };

    const candidates = [];
    if (presetConfig.logoFile) {
        candidates.push(presetConfig.logoFile);
        candidates.push(`../${presetConfig.logoFile}`);
    }
    if (presetConfig.logoRawUrl) {
        candidates.push(presetConfig.logoRawUrl);
    }

    const tryLoadNext = (idx) => {
        if (idx >= candidates.length) {
            console.warn(`プリセットロゴ (${presetKey}) の読み込みに失敗しました。`);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => processImageToLogo(img);
        img.onerror = () => tryLoadNext(idx + 1);
        img.src = candidates[idx];
    };

    tryLoadNext(0);
}

// === .bp プロファイルオブジェクトを現在のUI・設定に反映 ===
function applyBpProfileObject(profile, applyBoAndNotes = true) {
    if (!profile) return;
    const isTestPreset = (profile.presetKey === 'テスト用' || profile.presetId === 'テスト用');
    const numStr = presetNumberInput ? presetNumberInput.value.trim() : '';
    const kurobraGameMode = kurobraGameSelect ? kurobraGameSelect.value : 'sp';
    const testFormatMode = testPresetFormatSelect ? testPresetFormatSelect.value : 'double';

    const replaceNumberToken = (tpl) => {
        if (!tpl) return '';
        if (!numStr) return tpl.replace(/#?\[N\]/g, '').replace(/-\[N\]/g, '').trim();
        return tpl.replace(/\[N\]/g, numStr);
    };

    if (isTestPreset) {
        setTestPresetLockState(true);
        if (tournamentNameInput) {
            tournamentNameInput.value = profile.tournamentName || 'Bracket Printer Test Page';
        }
        if (startggUrlInput) {
            startggUrlInput.value = (testFormatMode === 'single')
                ? (profile.urlSingle || BUILTIN_BP_PROFILES['テスト用'].urlSingle)
                : (profile.urlDouble || BUILTIN_BP_PROFILES['テスト用'].urlDouble);
            hideInlineMessage(urlErrorMsg);
        }
        if (elimFormatSelect) {
            elimFormatSelect.value = testFormatMode;
            const isSingle = testFormatMode === 'single';
            losersAdvanceWrapper.classList.toggle('hidden', isSingle);
            losersRoundChangeBlock.classList.toggle('hidden', isSingle);
        }
        if (applyBoAndNotes) {
            if (winnersAdvanceCount) winnersAdvanceCount.value = '0';
            if (losersAdvanceCount) losersAdvanceCount.value = '0';
            if (targetPhaseInput) targetPhaseInput.value = '';
            updateTargetPhaseInputState();
            setBoConfiguration('5', false);
            customTextsLayer.innerHTML = '';
            updateRecommendedPrintUI(true);
        }
        refreshRenderedHeaderTitle();
        updateGenerateButtonState();
        return;
    }

    setTestPresetLockState(false);

    if (tournamentNameInput) {
        if (profile.tournamentName !== undefined && !profile.nameTemplate) {
            tournamentNameInput.value = profile.tournamentName;
        } else if (profile.nameTemplate) {
            tournamentNameInput.value = numStr
                ? profile.nameTemplate.replace(/\[N\]/g, numStr)
                : (profile.presetKey || '');
        }
    }

    if (startggUrlInput) {
        if (profile.bracketUrl !== undefined && !profile.urlTemplate && !profile.urlTemplateSp) {
            startggUrlInput.value = profile.bracketUrl;
        } else {
            let urlTpl = profile.urlTemplate || '';
            if (profile.presetKey === 'クロブラ' || profile.presetId === 'クロブラ') {
                urlTpl = (kurobraGameMode === 'dx')
                    ? (profile.urlTemplateDx || BUILTIN_BP_PROFILES['クロブラ'].urlTemplateDx)
                    : (profile.urlTemplateSp || profile.urlTemplate || BUILTIN_BP_PROFILES['クロブラ'].urlTemplateSp);
            }
            startggUrlInput.value = numStr ? replaceNumberToken(urlTpl) : '';
        }
        hideInlineMessage(urlErrorMsg);
    }

    if (applyBoAndNotes) {
        if (profile.elimFormat && (profile.elimFormat === 'double' || profile.elimFormat === 'single')) {
            elimFormatSelect.value = profile.elimFormat;
            const isSingle = profile.elimFormat === 'single';
            losersAdvanceWrapper.classList.toggle('hidden', isSingle);
            losersRoundChangeBlock.classList.toggle('hidden', isSingle);
        }
        if (profile.winnersAdvance !== undefined && winnersAdvanceCount) {
            winnersAdvanceCount.value = String(profile.winnersAdvance);
        }
        if (profile.losersAdvance !== undefined && losersAdvanceCount) {
            losersAdvanceCount.value = String(profile.losersAdvance);
        }
        if (profile.targetPhase !== undefined && targetPhaseInput) {
            targetPhaseInput.value = String(profile.targetPhase);
        }
        updateTargetPhaseInputState();

        let boCfg = profile.boConfig || profile.boRule?.default;
        if (profile.presetKey === 'クロブラ' || profile.presetId === 'クロブラ') {
            boCfg = (kurobraGameMode === 'dx')
                ? (profile.boConfigDx || profile.boRule?.dx || BUILTIN_BP_PROFILES['クロブラ'].boConfigDx)
                : (profile.boConfigSp || profile.boRule?.sp || BUILTIN_BP_PROFILES['クロブラ'].boConfigSp);
        }
        if (boCfg) {
            setBoConfiguration(
                boCfg.baseBo || '5',
                Boolean(boCfg.enableChange),
                boCfg.wRound || 'none',
                boCfg.wBo || '5',
                boCfg.lRound || 'none',
                boCfg.lBo || '5',
                boCfg.wCustom || '',
                boCfg.lCustom || ''
            );
        }

        if (profile.printConfig) {
            if (profile.printConfig.size && printSizeSelect) printSizeSelect.value = profile.printConfig.size;
            if (profile.printConfig.orientation && printOrientationSelect) printOrientationSelect.value = profile.printConfig.orientation;
            if (profile.printConfig.margin && printMarginSelect) printMarginSelect.value = profile.printConfig.margin;
            if (profile.printConfig.showPhaseName !== undefined && showPhaseNameCheckbox) {
                showPhaseNameCheckbox.checked = Boolean(profile.printConfig.showPhaseName);
            }
            checkIfPrintSettingsMatchRecommendation();
        }

        if (Array.isArray(profile.notes)) {
            customTextsLayer.innerHTML = '';
            profile.notes.forEach((noteObj, idx) => {
                createDraggableTextBox(
                    noteObj.text || '大会進行上の注意事項',
                    noteObj.x ?? 1240,
                    noteObj.y ?? (1475 + idx * 55),
                    noteObj.fontSize || '18px',
                    {
                        bold: noteObj.bold !== undefined ? Boolean(noteObj.bold) : true,
                        italic: Boolean(noteObj.italic),
                        underline: Boolean(noteObj.underline),
                        align: noteObj.align || 'left',
                        html: noteObj.html || null
                    }
                );
            });
        }
    }

    refreshRenderedHeaderTitle();
    updateGenerateButtonState();
}

async function loadAndApplyPresetProfile(presetKey, applyBoAndNotes = true) {
    const fallbackProfile = BUILTIN_BP_PROFILES[presetKey];
    if (!fallbackProfile) return;

    let activeProfile = fallbackProfile;
    if (fallbackProfile.profileFileUrl) {
        const urlsToTry = [fallbackProfile.profileFileUrl, `../${fallbackProfile.profileFileUrl}`];
        for (const u of urlsToTry) {
            try {
                const res = await fetch(u, { cache: 'no-store' });
                if (res.ok) {
                    const loadedJson = await res.json();
                    activeProfile = { ...fallbackProfile, ...loadedJson };
                    BUILTIN_BP_PROFILES[presetKey] = activeProfile;
                    break;
                }
            } catch (_) {
                // ローカル環境や未配置時は内蔵プロファイルを使用
            }
        }
    }

    applyBpProfileObject(activeProfile, applyBoAndNotes);
    if (applyBoAndNotes) {
        loadPresetLogo(activeProfile, presetKey);
    }
}

if (presetSelect) {
    presetSelect.addEventListener('change', async () => {
        hideInlineMessage(presetLoadStatus);
        const selectedPreset = presetSelect.value;
        if (!selectedPreset) {
            setTestPresetLockState(false);
            if (presetNumberWrapper) presetNumberWrapper.classList.add('hidden');
            if (kurobraGameWrapper) kurobraGameWrapper.classList.add('hidden');
            if (testPresetFormatWrapper) testPresetFormatWrapper.classList.add('hidden');
            if (presetNumberInput) presetNumberInput.value = '';
            if (tournamentNameInput) tournamentNameInput.placeholder = '例: Vic-Seekers #1';
            return;
        }

        const isTestPreset = (selectedPreset === 'テスト用');
        if (presetNumberWrapper) presetNumberWrapper.classList.toggle('hidden', isTestPreset);
        if (kurobraGameWrapper) {
            kurobraGameWrapper.classList.toggle('hidden', selectedPreset !== 'クロブラ');
        }
        if (testPresetFormatWrapper) {
            testPresetFormatWrapper.classList.toggle('hidden', !isTestPreset);
        }

        await loadAndApplyPresetProfile(selectedPreset, true);
        if (!isTestPreset && presetNumberInput) {
            presetNumberInput.focus();
        }
    });
}

if (testPresetFormatSelect) {
    testPresetFormatSelect.addEventListener('change', () => {
        if (presetSelect && presetSelect.value === 'テスト用') {
            applyBpProfileObject(BUILTIN_BP_PROFILES['テスト用'], true);
        }
    });
}

if (kurobraGameSelect) {
    kurobraGameSelect.addEventListener('change', () => {
        if (presetSelect && presetSelect.value === 'クロブラ') {
            applyBpProfileObject(BUILTIN_BP_PROFILES['クロブラ'], true);
        }
    });
}

if (presetNumberInput) {
    presetNumberInput.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value !== cleaned) {
            e.target.value = cleaned;
        }
        const selectedPreset = presetSelect ? presetSelect.value : '';
        if (selectedPreset && BUILTIN_BP_PROFILES[selectedPreset]) {
            applyBpProfileObject(BUILTIN_BP_PROFILES[selectedPreset], false);
        }
    });
}

// === オリジナルのプリセット(.bp)を作成・ダウンロードする機能 ===
if (createPresetBtn) {
    createPresetBtn.addEventListener('click', () => {
        const isChangeMode = document.querySelector('input[name="change-mode"]:checked')?.value === 'yes';
        const notesList = Array.from(customTextsLayer.querySelectorAll('.draggable-text-box')).map(box => {
            const contentEl = box.querySelector('.draggable-text-content');
            return {
                text: contentEl ? contentEl.innerText : '',
                html: contentEl ? contentEl.innerHTML : '',
                x: Math.round(parseFloat(box.style.left) || 1240),
                y: Math.round(parseFloat(box.style.top) || 1480),
                fontSize: contentEl?.style?.fontSize || '18px',
                bold: contentEl ? (contentEl.style.fontWeight === '700' || contentEl.style.fontWeight === 'bold') : true,
                italic: contentEl ? (contentEl.style.fontStyle === 'italic') : false,
                underline: contentEl ? (contentEl.style.textDecoration || '').includes('underline') : false,
                align: contentEl?.style?.textAlign || 'left'
            };
        });

        const tName = tournamentNameInput ? tournamentNameInput.value.trim() : '';
        const customBpProfile = {
            formatVersion: '1.0',
            profileVersion: '1.0',
            presetKey: tName || 'Custom_Preset',
            tournamentName: tName,
            bracketUrl: startggUrlInput ? startggUrlInput.value.trim() : '',
            elimFormat: elimFormatSelect ? elimFormatSelect.value : '',
            winnersAdvance: winnersAdvanceCount ? winnersAdvanceCount.value : '',
            losersAdvance: losersAdvanceCount ? losersAdvanceCount.value : '',
            targetPhase: targetPhaseInput ? targetPhaseInput.value.trim() : '',
            boConfig: {
                baseBo: baseBoValue || baseBoSelect.value || '5',
                enableChange: isChangeMode,
                wRound: winnersRoundSelect ? winnersRoundSelect.value : 'none',
                wBo: winnersBoSelect ? winnersBoSelect.value : '5',
                wCustom: winnersCustomInput ? winnersCustomInput.value.trim() : '',
                lRound: losersRoundSelect ? losersRoundSelect.value : 'none',
                lBo: losersBoSelect ? losersBoSelect.value : '5',
                lCustom: losersCustomInput ? losersCustomInput.value.trim() : ''
            },
            printConfig: {
                size: printSizeSelect ? printSizeSelect.value : 'A3',
                orientation: printOrientationSelect ? printOrientationSelect.value : 'landscape',
                margin: printMarginSelect ? printMarginSelect.value : 'standard',
                showPhaseName: showPhaseNameCheckbox ? showPhaseNameCheckbox.checked : true
            },
            logoDataUrl: pendingLogoDataUrl || null,
            notes: notesList
        };

        const blob = new Blob([JSON.stringify(customBpProfile, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const safeFileName = (tName || 'custom_preset').replace(/[\\/:*?"<>|\s]+/g, '_');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeFileName}.bp`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
}

// === ローカルから.bpプリセットファイルを読み込む機能 ===
if (loadPresetBtn && loadPresetFileInput) {
    loadPresetBtn.addEventListener('click', () => {
        loadPresetFileInput.value = '';
        loadPresetFileInput.click();
    });

    loadPresetFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (presetSelect) presetSelect.value = '';
                if (presetNumberWrapper) presetNumberWrapper.classList.add('hidden');
                if (kurobraGameWrapper) kurobraGameWrapper.classList.add('hidden');

                applyBpProfileObject(parsed, true);
                if (parsed.logoDataUrl || parsed.logoFile || parsed.logoRawUrl) {
                    loadPresetLogo(parsed, parsed.presetKey || file.name);
                }
                showInlineSuccess(presetLoadStatus, `プリセット「${file.name}」を読み込みました。`);
            } catch (err) {
                console.error('BP Load Error:', err);
                showInlineError(presetLoadStatus, '有効な .bp ファイルではありません。');
            }
        };
        reader.readAsText(file);
    });
}

// === 左上タイトル文字列を生成するヘルパー ===
function buildPoolHeaderTitle(poolName, elimTitle, playerCount) {
    const tName = tournamentNameInput ? tournamentNameInput.value.trim() : '';
    const showPhase = showPhaseNameCheckbox ? showPhaseNameCheckbox.checked : true;
    const rawPhaseName = poolsData[poolName]?.phaseName ? poolsData[poolName].phaseName.trim() : '';

    const prefixParts = [];
    if (tName) prefixParts.push(tName);
    if (showPhase && rawPhaseName) prefixParts.push(rawPhaseName);

    const totalPoolsCount = Object.keys(poolsData).length;
    const basePoolStr = (totalPoolsCount <= 1)
        ? `${elimTitle} (${playerCount} players)`
        : `Pool ${poolName} - ${elimTitle} (${playerCount} players)`;

    return prefixParts.length > 0 ? `${prefixParts.join(' ')}\u3000${basePoolStr}` : basePoolStr;
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
    tournamentNameInput.addEventListener('input', () => {
        hideInlineMessage(generateErrorMsg);
        refreshRenderedHeaderTitle();
        saveCurrentSessionToStorage();
    });
}
if (showPhaseNameCheckbox) {
    showPhaseNameCheckbox.addEventListener('change', () => {
        refreshRenderedHeaderTitle();
        saveCurrentSessionToStorage();
    });
}

function isGrandFinalModeSelected() {
    const isSingle = elimFormatSelect.value === 'single';
    const wVal = winnersAdvanceCount.value;
    const lVal = losersAdvanceCount.value;
    if (isSingle) {
        return wVal === '0';
    }
    return wVal === '0' && lVal === '0';
}

function getCurrentPoolPlayerCount() {
    const selectedPool = poolSelect.value;
    if (selectedPool && poolsData[selectedPool]) {
        return poolsData[selectedPool].count;
    }
    return maxPoolPlayerCount || 24;
}

function getEffectiveReferencePlayerCount(poolPlayerCount = null) {
    const currentCount = poolPlayerCount || getCurrentPoolPlayerCount();
    const poolKeys = Object.keys(poolsData);
    if (poolKeys.length > 1 && (maxPoolPlayerCount - minPoolPlayerCount) <= 4) {
        return maxPoolPlayerCount;
    }
    return currentCount;
}

function updateAdvanceCountConstraints() {
    const n = getCurrentPoolPlayerCount();

    Array.from(winnersAdvanceCount.options).forEach(opt => {
        if (opt.value === '4') {
            opt.disabled = (n <= 8);
            opt.textContent = (n <= 8) ? '4人（9人以上〜）' : '4人';
        }
    });
    if (n <= 8 && winnersAdvanceCount.value === '4') {
        winnersAdvanceCount.value = '2';
    }

    Array.from(losersAdvanceCount.options).forEach(opt => {
        if (opt.value === '8') {
            opt.disabled = (n <= 16);
            opt.textContent = (n <= 16) ? '8人（17人以上〜）' : '8人';
        }
    });
    if (n <= 16 && losersAdvanceCount.value === '8') {
        losersAdvanceCount.value = '4';
    }
}

function updateRoundChangeDropdowns() {
    const playerCount = getCurrentPoolPlayerCount();
    const isSingle = elimFormatSelect.value === 'single';
    const wCountNum = winnersAdvanceCount.value !== '' ? Number(winnersAdvanceCount.value) : 1;
    const lCountNum = isSingle ? 0 : (losersAdvanceCount.value !== '' ? Number(losersAdvanceCount.value) : 2);

    const { winnersRounds, losersRounds } = computeActiveRounds(playerCount, isSingle, wCountNum, lCountNum);
    currentActiveWinnersRounds = winnersRounds;
    currentActiveLosersRounds = losersRounds;

    const prevW = winnersRoundSelect.value;
    winnersRoundSelect.innerHTML = '<option value="none">勝者側は変更しない</option>';
    winnersRounds.forEach((rName, idx) => {
        const opt = document.createElement('option');
        opt.value = rName;
        const isLast = (idx === winnersRounds.length - 1);
        opt.textContent = isLast ? `${rName} のみ` : `${rName} 以降`;
        winnersRoundSelect.appendChild(opt);
    });
    if (winnersRounds.includes(prevW)) {
        winnersRoundSelect.value = prevW;
    } else {
        winnersRoundSelect.value = 'none';
    }

    const prevL = losersRoundSelect.value;
    losersRoundSelect.innerHTML = '<option value="none">敗者側は変更しない</option>';
    losersRounds.forEach((rName, idx) => {
        const opt = document.createElement('option');
        opt.value = rName;
        const isLast = (idx === losersRounds.length - 1);
        opt.textContent = isLast ? `${rName} のみ` : `${rName} 以降`;
        losersRoundSelect.appendChild(opt);
    });
    if (losersRounds.includes(prevL)) {
        losersRoundSelect.value = prevL;
    } else {
        losersRoundSelect.value = 'none';
    }
}

// === アコーディオン開閉制御 ===
document.querySelectorAll('.accordion-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const content = button.nextElementSibling;
        const arrow = button.querySelector('.accordion-arrow');
        const isHidden = content.style.display === 'none';

        if (isHidden) {
            content.style.display = 'flex';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            content.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    });
});

// === 推奨印刷設定の自動計算＆適用（6〜12人:A4横 / 13〜24人:A3横 / 25〜48人:A3縦） ===
function getRecommendedPrintSettings(refPlayers, elimFormat) {
    const isSingle = elimFormat === 'single';
    const formatLabel = isSingle ? 'シングルエリミ' : 'ダブルエリミ';
    const n = refPlayers || 24;

    if (n <= 12) {
        return { size: 'A4', orientation: 'landscape', margin: 'standard', reason: `6〜12人 (${n}人) ${formatLabel}の推奨設定` };
    } else if (n <= 24) {
        return { size: 'A3', orientation: 'landscape', margin: 'standard', reason: `13〜24人 (${n}人) ${formatLabel}の推奨設定` };
    } else {
        return { size: 'A3', orientation: 'portrait', margin: 'standard', reason: `25〜48人 (${n}人) ${formatLabel}の推奨設定` };
    }
}

function updateRecommendedPrintUI(autoApply = true) {
    const targetCount = getEffectiveReferencePlayerCount();
    const format = elimFormatSelect.value || 'double';
    recommendedPrintConfig = getRecommendedPrintSettings(targetCount, format);

    Array.from(printSizeSelect.options).forEach(opt => {
        opt.textContent = opt.value === recommendedPrintConfig.size ? `${opt.value} ★推奨` : opt.value;
    });
    Array.from(printOrientationSelect.options).forEach(opt => {
        const baseLabel = opt.value === 'landscape' ? '横 (Landscape)' : '縦 (Portrait)';
        opt.textContent = opt.value === recommendedPrintConfig.orientation ? `${baseLabel} ★推奨` : baseLabel;
    });

    const orientShort = recommendedPrintConfig.orientation === 'landscape' ? '横' : '縦';
    recSizeBadge.textContent = `★推奨: ${recommendedPrintConfig.size}`;
    recOrientationBadge.textContent = `★推奨: ${orientShort}`;
    printRecReasonText.textContent = `💡 ${recommendedPrintConfig.reason} (${recommendedPrintConfig.size}・${orientShort})`;

    if (autoApply) {
        printSizeSelect.value = recommendedPrintConfig.size;
        printOrientationSelect.value = recommendedPrintConfig.orientation;
        printMarginSelect.value = recommendedPrintConfig.margin;
    }

    checkIfPrintSettingsMatchRecommendation();
}

function checkIfPrintSettingsMatchRecommendation() {
    const isMatched =
        printSizeSelect.value === recommendedPrintConfig.size &&
        printOrientationSelect.value === recommendedPrintConfig.orientation &&
        printMarginSelect.value === recommendedPrintConfig.margin;

    if (isMatched) {
        printRecStatusBadge.textContent = '★推奨設定';
        printRecStatusBadge.className = 'bg-pink-100 text-[#DB2777] border border-pink-200 text-[10px] px-1.5 py-0.5 rounded font-bold';
        resetPrintRecBtn.classList.add('hidden');
    } else {
        printRecStatusBadge.textContent = 'カスタム設定';
        printRecStatusBadge.className = 'bg-gray-100 text-gray-600 border border-gray-300 text-[10px] px-1.5 py-0.5 rounded font-bold';
        resetPrintRecBtn.classList.remove('hidden');
    }
}

resetPrintRecBtn.addEventListener('click', () => {
    printSizeSelect.value = recommendedPrintConfig.size;
    printOrientationSelect.value = recommendedPrintConfig.orientation;
    printMarginSelect.value = recommendedPrintConfig.margin;
    checkIfPrintSettingsMatchRecommendation();
});

[printSizeSelect, printOrientationSelect, printMarginSelect].forEach(sel => {
    sel.addEventListener('change', () => {
        checkIfPrintSettingsMatchRecommendation();
        saveCurrentSessionToStorage();
    });
});

function updateTargetPhaseInputState() {
    const isGf = isGrandFinalModeSelected();
    const isTestPreset = Boolean(presetSelect && presetSelect.value === 'テスト用');
    if (isGf) {
        targetPhaseInput.disabled = true;
        targetPhaseInput.placeholder = '※Final完結のため入力不要';
        targetPhaseInput.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        targetPhaseInput.classList.remove('bg-white');
    } else {
        targetPhaseInput.disabled = false;
        targetPhaseInput.placeholder = '例: Day2 / TOP192';
        targetPhaseInput.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        targetPhaseInput.classList.add('bg-white');
        if (isTestPreset && targetPhaseInput.value.trim() === '') {
            targetPhaseInput.value = 'Day2 / TOP192';
        }
    }
}

function updateGenerateButtonState() {
    const isSingle = elimFormatSelect.value === 'single';
    const isFormatSelected = elimFormatSelect.value === 'double' || elimFormatSelect.value === 'single';
    const isWinnersSelected = winnersAdvanceCount.value !== '';
    const isLosersSelected = isSingle ? true : (losersAdvanceCount.value !== '');
    const isBaseBoReady = (baseBoSelect.value === '5' || baseBoSelect.value === '3') ||
                          (baseBoSelect.value === 'custom' && isCustomBoConfirmed && baseBoValue !== '');
    const isGf = isGrandFinalModeSelected();
    const isTestPreset = Boolean(presetSelect && presetSelect.value === 'テスト用');
    const isTargetPhaseFilled = (isGf || isTestPreset) ? true : (targetPhaseInput.value.trim() !== '');

    let isRoundChangeReady = true;
    const isChangeMode = document.querySelector('input[name="change-mode"]:checked').value === 'yes';
    if (isChangeMode) {
        if (winnersRoundSelect.value !== 'none' && winnersBoSelect.value === 'custom') {
            const wVal = Number(winnersCustomInput.value.trim());
            if (!Number.isInteger(wVal) || wVal <= 0 || wVal % 2 === 0) isRoundChangeReady = false;
        }
        if (!isSingle && losersRoundSelect.value !== 'none' && losersBoSelect.value === 'custom') {
            const lVal = Number(losersCustomInput.value.trim());
            if (!Number.isInteger(lVal) || lVal <= 0 || lVal % 2 === 0) isRoundChangeReady = false;
        }
    }

    if (isCsvValid && isFormatSelected && isWinnersSelected && isLosersSelected && isBaseBoReady && isTargetPhaseFilled && isRoundChangeReady) {
        generateBtn.disabled = false;
        generateBtn.className = "w-full shrink-0 bg-[#DB2777] text-white px-4 py-2 rounded shadow hover:bg-pink-700 transition font-bold text-sm cursor-pointer";
        hideInlineMessage(exportErrorMsg);
    } else {
        generateBtn.disabled = true;
        generateBtn.className = "w-full shrink-0 bg-gray-300 text-gray-500 px-4 py-2 rounded shadow transition font-bold text-sm cursor-not-allowed";
    }
    updateRestoreSessionButtonState();
}

// === 作業状態のリアルタイム自動保存 ＆ ワンクリック復元機能 ===
function hasValidAutosaveData() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed && parsed.poolsData && Object.keys(parsed.poolsData).length > 0);
    } catch (_) {
        return false;
    }
}

function updateRestoreSessionButtonState() {
    if (!restoreSessionBtn) return;
    const isSheetHidden = document.getElementById('main-sheet-body')?.classList.contains('hidden') ?? true;
    const canRestore = !hasSessionBeenDrawnOrRestored && isSheetHidden && hasValidAutosaveData();

    if (canRestore) {
        restoreSessionBtn.disabled = false;
        restoreSessionBtn.className = "w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded shadow-sm transition font-bold text-xs cursor-pointer";
    } else {
        restoreSessionBtn.disabled = true;
        restoreSessionBtn.className = "w-full bg-gray-200 text-gray-400 border border-gray-300 px-3 py-1.5 rounded transition font-bold text-xs cursor-not-allowed";
    }
}

function saveCurrentSessionToStorage() {
    const isSheetHidden = document.getElementById('main-sheet-body')?.classList.contains('hidden') ?? true;
    if (isSheetHidden || !isCsvValid || Object.keys(poolsData).length === 0) return;

    try {
        const isChangeMode = document.querySelector('input[name="change-mode"]:checked')?.value === 'yes';
        const notesList = Array.from(customTextsLayer.querySelectorAll('.draggable-text-box')).map(box => {
            const contentEl = box.querySelector('.draggable-text-content');
            return {
                text: contentEl ? contentEl.innerText : '',
                html: contentEl ? contentEl.innerHTML : '',
                x: Math.round(parseFloat(box.style.left) || 1240),
                y: Math.round(parseFloat(box.style.top) || 1480),
                fontSize: contentEl?.style?.fontSize || '18px',
                bold: contentEl ? (contentEl.style.fontWeight === '700' || contentEl.style.fontWeight === 'bold') : true,
                italic: contentEl ? (contentEl.style.fontStyle === 'italic') : false,
                underline: contentEl ? (contentEl.style.textDecoration || '').includes('underline') : false,
                align: contentEl?.style?.textAlign || 'left'
            };
        });

        const payload = {
            savedAt: new Date().toISOString(),
            poolsData,
            maxPoolPlayerCount,
            minPoolPlayerCount,
            currentDataSource,
            tournamentStreamsList,
            matchOverrides,
            selectedPool: poolSelect ? poolSelect.value : '',
            presetValue: presetSelect ? presetSelect.value : '',
            presetNumber: presetNumberInput ? presetNumberInput.value : '',
            kurobraGame: kurobraGameSelect ? kurobraGameSelect.value : 'sp',
            tournamentName: tournamentNameInput ? tournamentNameInput.value : '',
            startggUrl: startggUrlInput ? startggUrlInput.value : '',
            elimFormat: elimFormatSelect ? elimFormatSelect.value : 'double',
            winnersAdvance: winnersAdvanceCount ? winnersAdvanceCount.value : '1',
            losersAdvance: losersAdvanceCount ? losersAdvanceCount.value : '2',
            targetPhase: targetPhaseInput ? targetPhaseInput.value : '',
            boConfig: {
                baseBo: baseBoValue || baseBoSelect.value || '5',
                enableChange: isChangeMode,
                wRound: winnersRoundSelect ? winnersRoundSelect.value : 'none',
                wBo: winnersBoSelect ? winnersBoSelect.value : '5',
                wCustom: winnersCustomInput ? winnersCustomInput.value.trim() : '',
                lRound: losersRoundSelect ? losersRoundSelect.value : 'none',
                lBo: losersBoSelect ? losersBoSelect.value : '5',
                lCustom: losersCustomInput ? losersCustomInput.value.trim() : ''
            },
            printConfig: {
                size: printSizeSelect ? printSizeSelect.value : 'A3',
                orientation: printOrientationSelect ? printOrientationSelect.value : 'landscape',
                margin: printMarginSelect ? printMarginSelect.value : 'standard',
                showPhaseName: showPhaseNameCheckbox ? showPhaseNameCheckbox.checked : true
            },
            logoDataUrl: pendingLogoDataUrl || null,
            notes: notesList
        };

        localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
        console.warn('自動バックアップの保存に失敗しました:', err);
    }
}

if (restoreSessionBtn) {
    restoreSessionBtn.addEventListener('click', () => {
        if (restoreSessionBtn.disabled) return;
        try {
            const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || !saved.poolsData) return;

            poolsData = saved.poolsData;
            maxPoolPlayerCount = saved.maxPoolPlayerCount || 24;
            minPoolPlayerCount = saved.minPoolPlayerCount || 24;
            currentDataSource = saved.currentDataSource || 'csv';
            tournamentStreamsList = saved.tournamentStreamsList || [];
            matchOverrides = saved.matchOverrides || {};

            if (presetSelect) presetSelect.value = saved.presetValue || '';
            if (presetNumberInput) presetNumberInput.value = saved.presetNumber || '';
            if (presetNumberWrapper) presetNumberWrapper.classList.toggle('hidden', !saved.presetValue);
            if (kurobraGameSelect) kurobraGameSelect.value = saved.kurobraGame || 'sp';
            if (kurobraGameWrapper) kurobraGameWrapper.classList.toggle('hidden', saved.presetValue !== 'クロブラ');

            if (tournamentNameInput) tournamentNameInput.value = saved.tournamentName || '';
            if (startggUrlInput) startggUrlInput.value = saved.startggUrl || '';

            const poolKeys = sortPoolKeys(Object.keys(poolsData));
            poolSelect.innerHTML = '';
            poolKeys.forEach(poolName => {
                const option = document.createElement('option');
                option.value = poolName;
                option.textContent = `Pool ${poolName} (${poolsData[poolName].count}名)`;
                poolSelect.appendChild(option);
            });
            isCsvValid = true;
            poolSelectWrapper.classList.remove('hidden');
            if (saved.selectedPool && poolsData[saved.selectedPool]) {
                poolSelect.value = saved.selectedPool;
            }

            if (elimFormatSelect) {
                elimFormatSelect.value = saved.elimFormat || 'double';
                const isSingle = elimFormatSelect.value === 'single';
                losersAdvanceWrapper.classList.toggle('hidden', isSingle);
                losersRoundChangeBlock.classList.toggle('hidden', isSingle);
            }

            updateAdvanceCountConstraints();
            if (winnersAdvanceCount && saved.winnersAdvance !== undefined) {
                winnersAdvanceCount.value = String(saved.winnersAdvance);
            }
            if (losersAdvanceCount && saved.losersAdvance !== undefined) {
                losersAdvanceCount.value = String(saved.losersAdvance);
            }
            if (targetPhaseInput && saved.targetPhase !== undefined) {
                targetPhaseInput.value = saved.targetPhase;
            }
            updateTargetPhaseInputState();

            if (saved.boConfig) {
                setBoConfiguration(
                    saved.boConfig.baseBo || '5',
                    Boolean(saved.boConfig.enableChange),
                    saved.boConfig.wRound || 'none',
                    saved.boConfig.wBo || '5',
                    saved.boConfig.lRound || 'none',
                    saved.boConfig.lBo || '5',
                    saved.boConfig.wCustom || '',
                    saved.boConfig.lCustom || ''
                );
            }

            if (saved.printConfig) {
                updateRecommendedPrintUI(false);
                if (saved.printConfig.size && printSizeSelect) printSizeSelect.value = saved.printConfig.size;
                if (saved.printConfig.orientation && printOrientationSelect) printOrientationSelect.value = saved.printConfig.orientation;
                if (saved.printConfig.margin && printMarginSelect) printMarginSelect.value = saved.printConfig.margin;
                if (saved.printConfig.showPhaseName !== undefined && showPhaseNameCheckbox) {
                    showPhaseNameCheckbox.checked = Boolean(saved.printConfig.showPhaseName);
                }
                checkIfPrintSettingsMatchRecommendation();
            }

            pendingLogoDataUrl = saved.logoDataUrl || null;
            if (pendingLogoDataUrl) {
                clearLogoBtn.classList.remove('hidden');
            } else {
                clearLogoBtn.classList.add('hidden');
            }

            customTextsLayer.innerHTML = '';
            if (Array.isArray(saved.notes)) {
                saved.notes.forEach((noteObj, idx) => {
                    createDraggableTextBox(
                        noteObj.text || '',
                        noteObj.x ?? 1240,
                        noteObj.y ?? (1475 + idx * 55),
                        noteObj.fontSize || '18px',
                        {
                            bold: noteObj.bold !== undefined ? Boolean(noteObj.bold) : true,
                            italic: Boolean(noteObj.italic),
                            underline: Boolean(noteObj.underline),
                            align: noteObj.align || 'left',
                            html: noteObj.html || null
                        }
                    );
                });
            }

            hasSessionBeenDrawnOrRestored = true;
            updateGenerateButtonState();
            if (!generateBtn.disabled) {
                generateBtn.click();
            }
            showInlineSuccess(restoreSessionStatus, '直前の作業状態を復元しました。');
            setTimeout(() => hideInlineMessage(restoreSessionStatus), 4000);
        } catch (err) {
            console.error('セッション復元エラー:', err);
            showInlineError(restoreSessionStatus, '作業状態の復元に失敗しました。');
        }
    });
}

// === 設定中のDQ・配信台一覧パネルの更新関数 ===
function renderMatchOverridesSummaryPanel() {
    if (!matchOverridesSummaryList || !matchOverridesCountBadge) return;

    const poolKeys = sortPoolKeys(Object.keys(poolsData));
    const activeEntries = [];

    poolKeys.forEach(pName => {
        const poolObj = poolsData[pName];
        if (!poolObj) return;

        const apiDqMap = poolObj.apiDqByMatchLabel || {};
        const apiStreamMap = poolObj.apiStreamByRoundIndex || {};
        const candidateLabels = new Set();

        Object.keys(apiDqMap).forEach(lbl => candidateLabels.add(lbl.toUpperCase()));
        Object.keys(apiStreamMap).forEach(k => {
            if (k.startsWith('id_')) candidateLabels.add(k.slice(3).toUpperCase());
        });
        Object.keys(matchOverrides).forEach(k => {
            if (k.startsWith(`${pName}_`)) {
                candidateLabels.add(k.slice(pName.length + 1).toUpperCase());
            }
        });

        const sortedLabels = Array.from(candidateLabels).sort((a, b) => {
            if (a.length !== b.length) return a.length - b.length;
            return a.localeCompare(b);
        });

        sortedLabels.forEach(mLabel => {
            const key = `${pName}_${mLabel}`;
            const ov = matchOverrides[key] || {};
            const defDq = apiDqMap[mLabel] || {};
            const defStream = apiStreamMap[`id_${mLabel}`] || {};

            const dqP1 = ov.dqP1 !== undefined ? Boolean(ov.dqP1) : Boolean(defDq.dqP1);
            const dqP2 = ov.dqP2 !== undefined ? Boolean(ov.dqP2) : Boolean(defDq.dqP2);
            const streamEnabled = ov.streamEnabled !== undefined ? Boolean(ov.streamEnabled) : Boolean(defStream.enabled);
            const streamChannel = ov.streamChannel !== undefined ? ov.streamChannel : (defStream.channel || '');

            if (dqP1 || dqP2 || streamEnabled) {
                activeEntries.push({
                    poolName: pName,
                    matchLabel: mLabel,
                    dqP1,
                    dqP2,
                    streamEnabled,
                    streamChannel
                });
            }
        });
    });

    matchOverridesCountBadge.textContent = `${activeEntries.length}件`;
    matchOverridesSummaryList.innerHTML = '';

    if (activeEntries.length === 0) {
        const emptyMsg = createElement('p', 'text-[10px] text-gray-400', '現在設定されているDQ・配信台はありません');
        matchOverridesSummaryList.appendChild(emptyMsg);
        return;
    }

    activeEntries.forEach(item => {
        const rowBtn = createElement('button', 'w-full text-left bg-white hover:bg-pink-50 border border-gray-200 hover:border-pink-300 rounded px-2 py-1 transition flex items-center justify-between gap-1');
        rowBtn.type = 'button';

        const leftSpan = createElement('span', 'font-bold text-gray-800 truncate', `Pool ${item.poolName} - Match ${item.matchLabel}`);
        const badgesWrap = createElement('span', 'flex items-center gap-1 shrink-0');

        if (item.dqP1 || item.dqP2) {
            const dqText = (item.dqP1 && item.dqP2) ? 'DQ(両者)' : (item.dqP1 ? 'DQ(上段)' : 'DQ(下段)');
            badgesWrap.appendChild(createElement('span', 'bg-red-100 text-red-700 border border-red-200 px-1 py-0.2 rounded text-[9.5px] font-bold', dqText));
        }
        if (item.streamEnabled) {
            const stText = item.streamChannel ? `📺 ${item.streamChannel}` : '📺 配信';
            badgesWrap.appendChild(createElement('span', 'bg-gray-200 text-gray-800 px-1 py-0.2 rounded text-[9.5px] font-bold max-w-[95px] truncate', stText));
        }

        rowBtn.append(leftSpan, badgesWrap);
        rowBtn.addEventListener('click', () => {
            if (poolSelect.value !== item.poolName && poolsData[item.poolName]) {
                poolSelect.value = item.poolName;
                updateAdvanceCountConstraints();
                updateRoundChangeDropdowns();
                updateRecommendedPrintUI(false);
                if (!generateBtn.disabled) generateBtn.click();
            } else if (document.getElementById('main-sheet-body').classList.contains('hidden') && !generateBtn.disabled) {
                generateBtn.click();
            }

            setTimeout(() => {
                const matchBoxes = Array.from(previewArea.querySelectorAll('.match-box'));
                const targetBox = matchBoxes.find(mb => mb.querySelector('.match-label')?.textContent === item.matchLabel);
                if (targetBox) {
                    targetBox.click();
                }
            }, 50);
        });

        matchOverridesSummaryList.appendChild(rowBtn);
    });
}

function sortPoolKeys(keys) {
    return keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function normalizePoolName(rawPool) {
    const str = String(rawPool || '').trim();
    if (str.length > 2 && str.endsWith('00')) {
        return str.slice(0, -2);
    }
    return str;
}

// === プールデータの検証とUI反映（6〜48名対応・5名以下および49名以上は確実にブロック） ===
function applyPoolsDataToUI(sourceLabel = 'CSV', targetStatusEl = csvStatus) {
    const poolKeys = sortPoolKeys(Object.keys(poolsData));

    if (poolKeys.length === 0) {
        isCsvValid = false;
        poolSelectWrapper.classList.add('hidden');
        showInlineError(targetStatusEl, '有効なプールデータが見つかりませんでした。');
        updateGenerateButtonState();
        return;
    }

    for (const pName of poolKeys) {
        const count = poolsData[pName].count;
        if (count < 6 || count > 48) {
            isCsvValid = false;
            poolSelectWrapper.classList.add('hidden');
            showInlineError(targetStatusEl, `Pool "${pName}" の参加人数が ${count} 名です。\n1プールあたり6名〜48名のデータのみ対応しています。`);
            updateGenerateButtonState();
            return;
        }
    }

    const counts = poolKeys.map(k => poolsData[k].count);
    maxPoolPlayerCount = Math.max(...counts);
    minPoolPlayerCount = Math.min(...counts);

    poolSelect.innerHTML = '';
    poolKeys.forEach(poolName => {
        const option = document.createElement('option');
        option.value = poolName;
        option.textContent = `Pool ${poolName} (${poolsData[poolName].count}名)`;
        poolSelect.appendChild(option);
    });

    isCsvValid = true;
    poolSelectWrapper.classList.remove('hidden');

    const statusLines = [`${sourceLabel}: ${poolKeys.length}個のプールを読み込みました。`];
    if (lastAutoConfigSummary) {
        statusLines.push(lastAutoConfigSummary);
    }
    showInlineSuccess(targetStatusEl, statusLines.join('\n'));

    updateAdvanceCountConstraints();
    updateTargetPhaseInputState();
    updateRoundChangeDropdowns();
    updateRecommendedPrintUI(true);
    renderMatchOverridesSummaryPanel();
    updateGenerateButtonState();
}

// === 手順1-A: CSVファイルの読み込み ===
csvUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    hideInlineMessage(csvStatus);
    hideInlineMessage(apiStatus);
    hideInlineMessage(tokenErrorMsg);
    hideInlineMessage(urlErrorMsg);

    if (!verifySourceIdentifierIntegrity(file.name)) {
        csvUpload.value = '';
        handleUnsupportedIdentifierError('csv');
        return;
    }

    startggPhasesList = [];
    lastAutoConfigSummary = '';
    currentDataSource = 'csv';
    matchOverrides = {};
    phaseSelectWrapper.classList.add('hidden');

    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: function(results) {
            const rows = results.data;
            if (rows.length < 2) {
                showInlineError(csvStatus, 'CSVファイルのデータが空か、形式が正しくありません。');
                return;
            }

            poolsData = {};

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 13) continue;

                const rawPhase = row[0] ? String(row[0]).trim() : '';
                const rawPool = row[2] ? String(row[2]).trim() : '';
                if (!rawPool) continue;

                const poolName = normalizePoolName(rawPool);
                const phaseSeed = parseInt(row[3], 10);
                let poolSeed = parseInt(row[4], 10);
                if (isNaN(poolSeed)) {
                    poolSeed = phaseSeed;
                }

                const colM = row[12] ? String(row[12]).trim() : '';
                const colN = row.length > 13 && row[13] ? String(row[13]).trim() : '';
                const colL = row[11] ? String(row[11]).trim() : '';

                const fullGamerTag = colM || colN || colL;
                let shortGamerTag = colN;
                if (!shortGamerTag) {
                    if (colM && colM.includes('|')) {
                        const parts = colM.split('|');
                        shortGamerTag = parts[parts.length - 1].trim();
                    } else {
                        shortGamerTag = colM || colL;
                    }
                }

                if (!poolsData[poolName]) {
                    poolsData[poolName] = {
                        phaseName: rawPhase,
                        playersByPoolSeed: {},
                        rosterList: [],
                        apiStreamByRoundIndex: {},
                        apiDqByMatchLabel: {},
                        count: 0
                    };
                } else if (!poolsData[poolName].phaseName && rawPhase) {
                    poolsData[poolName].phaseName = rawPhase;
                }

                if (!isNaN(poolSeed)) {
                    poolsData[poolName].playersByPoolSeed[poolSeed] = shortGamerTag;
                    poolsData[poolName].rosterList.push({
                        seed: poolSeed,
                        phaseSeed: !isNaN(phaseSeed) ? phaseSeed : poolSeed,
                        fullGamerTag: fullGamerTag
                    });
                    poolsData[poolName].count++;
                }
            }

            applyPoolsDataToUI('CSV', csvStatus);
        }
    });
});

// === CSV行配列から poolsData を構築する共通関数 ===
function parseCsvRowsIntoPoolsData(rows) {
    poolsData = {};
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5) continue;

        const rawPhase = row[0] ? String(row[0]).trim() : '';
        const rawPool = row[2] ? String(row[2]).trim() : '';
        if (!rawPool) continue;

        const poolName = normalizePoolName(rawPool);
        const phaseSeed = parseInt(row[3], 10);
        let poolSeed = parseInt(row[4], 10);
        if (isNaN(poolSeed)) {
            poolSeed = phaseSeed;
        }

        const colM = row.length > 12 && row[12] ? String(row[12]).trim() : '';
        const colN = row.length > 13 && row[13] ? String(row[13]).trim() : '';
        const colL = row.length > 11 && row[11] ? String(row[11]).trim() : '';

        const fullGamerTag = colM || colN || colL || `BP｜${poolName}-${poolSeed}`;
        let shortGamerTag = colN;
        if (!shortGamerTag) {
            if (colM && (colM.includes('|') || colM.includes('｜'))) {
                const parts = colM.split(/[|｜]/);
                shortGamerTag = parts[parts.length - 1].trim();
            } else {
                shortGamerTag = colM || colL || `${poolName}-${poolSeed}`;
            }
        }

        if (!poolsData[poolName]) {
            poolsData[poolName] = {
                phaseName: rawPhase,
                playersByPoolSeed: {},
                rosterList: [],
                apiStreamByRoundIndex: {},
                apiDqByMatchLabel: {},
                count: 0
            };
        } else if (!poolsData[poolName].phaseName && rawPhase) {
            poolsData[poolName].phaseName = rawPhase;
        }

        if (!isNaN(poolSeed)) {
            poolsData[poolName].playersByPoolSeed[poolSeed] = shortGamerTag;
            poolsData[poolName].rosterList.push({
                seed: poolSeed,
                phaseSeed: !isNaN(phaseSeed) ? phaseSeed : poolSeed,
                fullGamerTag: fullGamerTag
            });
            poolsData[poolName].count++;
        }
    }
}

// === API取得エラー時の dev/ フォルダ内CSV自動フォールバック（ダブルマークナル機能） ===
async function fallbackToDevCsvOnApiError(errorObj) {
    console.warn('APIエラー発生のためCSV自動フォールバックを開始します:', errorObj);
    showInlineInfo(apiStatus, '⚠️ 読み込みエラーが発生しました。CSVでのデータ取得に切り替えます...');

    const isTestPreset = (presetSelect && presetSelect.value === 'テスト用');
    const fmt = (isTestPreset && testPresetFormatSelect)
        ? testPresetFormatSelect.value
        : (elimFormatSelect.value === 'single' ? 'single' : 'double');

    const testProfile = BUILTIN_BP_PROFILES['テスト用'] || {};
    const primaryCsv = (fmt === 'single')
        ? (testProfile.csvFallbackSingle || 'dev/single_elimination.csv')
        : (testProfile.csvFallbackDouble || 'dev/double_elimination.csv');

    const candidateUrls = (fmt === 'single')
        ? [
            primaryCsv,
            `../${primaryCsv}`,
            'dev/6-48-single-elimination.csv',
            '../dev/6-48-single-elimination.csv',
            'dev/single.csv',
            '../dev/single.csv'
        ]
        : [
            primaryCsv,
            `../${primaryCsv}`,
            'dev/6-48-double-elimination.csv',
            '../dev/6-48-double-elimination.csv',
            'dev/double.csv',
            '../dev/double.csv'
        ];

    let loadedCsvText = null;
    let loadedPath = '';

    for (const url of candidateUrls) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const text = await res.text();
                if (text && text.includes(',')) {
                    loadedCsvText = text;
                    loadedPath = url;
                    break;
                }
            }
        } catch (_) {
            // 次の候補パスを試行
        }
    }

    startggPhasesList = [];
    phaseSelectWrapper.classList.add('hidden');
    currentDataSource = 'csv';
    matchOverrides = {};

    if (loadedCsvText && window.Papa) {
        const parsed = Papa.parse(loadedCsvText, { header: false, skipEmptyLines: true });
        if (parsed && Array.isArray(parsed.data) && parsed.data.length >= 2) {
            parseCsvRowsIntoPoolsData(parsed.data);
        }
    }

    // 万が一 dev/ 内にCSVファイルが未配置の場合でも、Pool 6〜48 (1,161名) のデータを自動生成して完全復旧
    if (Object.keys(poolsData).length === 0) {
        const syntheticRows = [
            ['Phase', 'Wave', 'Pool', 'Phase Seed', 'Pool Seed', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'Player GamerTag', 'Player Short GamerTag']
        ];
        let globalPhaseSeed = 1;
        const phaseLabel = fmt === 'single' ? '6-48 Single Elimination' : '6-48 Double Elimination';
        for (let p = 6; p <= 48; p++) {
            for (let s = 1; s <= p; s++) {
                syntheticRows.push([
                    phaseLabel, '', String(p), String(globalPhaseSeed++), String(s),
                    '', '', '', '', '', '', '',
                    `BP｜${p}-${s}`, `${p}-${s}`
                ]);
            }
        }
        parseCsvRowsIntoPoolsData(syntheticRows);
        loadedPath = '内蔵テストデータ (Pool 6〜48)';
    }

    if (elimFormatSelect) {
        elimFormatSelect.value = fmt;
        const isSingle = (fmt === 'single');
        losersAdvanceWrapper.classList.toggle('hidden', isSingle);
        losersRoundChangeBlock.classList.toggle('hidden', isSingle);
    }
    if (winnersAdvanceCount && winnersAdvanceCount.value === '') winnersAdvanceCount.value = '0';
    if (losersAdvanceCount && losersAdvanceCount.value === '') losersAdvanceCount.value = '0';
    if (isGrandFinalModeSelected() && targetPhaseInput) targetPhaseInput.value = '';
    if (isTestPreset) setTestPresetLockState(true);

    lastAutoConfigSummary = `🔄 読み込みエラーが発生したため、CSVでのデータ取得に切り替えました (${loadedPath})`;
    applyPoolsDataToUI('CSVフォールバック', apiStatus);
}

// === 手順1-B: start.gg GraphQL APIによるデータ取得 ===
function parseStartggUrl(url) {
    const trimmed = url.trim();
    const eventMatch = trimmed.match(/start\.gg\/(tournament\/[^/?#]+\/event\/[^/?#]+)/i);
    if (!eventMatch) return null;

    const eventSlug = eventMatch[1];
    const bracketMatch = trimmed.match(/\/brackets\/(\d+)(?:\/(\d+))?/i);

    return {
        eventSlug,
        phaseId: bracketMatch && bracketMatch[1] ? Number(bracketMatch[1]) : null,
        phaseGroupId: bracketMatch && bracketMatch[2] ? Number(bracketMatch[2]) : null
    };
}

async function ensurePhaseGroupsDetailsLoaded(phaseObj, token) {
    const groups = phaseObj?.phaseGroups?.nodes || [];
    if (groups.length === 0) return;

    const needsFetch = groups.some(g => !g._detailsLoaded);
    if (!needsFetch) return;

    const executeGql = async (queryStr) => {
        const response = await fetch('https://api.start.gg/gql/alpha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query: queryStr })
        });
        const json = await response.json();
        if (!response.ok || json.errors) {
            const errMsg = json.errors ? json.errors.map(e => e.message).join(', ') : `HTTP ${response.status}`;
            throw new Error(errMsg);
        }
        return json.data || {};
    };

    const buildSeedSubQuery = (groupId, alias) => `
        ${alias}: phaseGroup(id: ${Number(groupId)}) {
            id
            seeds(query: { page: 1, perPage: 50 }) {
                nodes {
                    seedNum
                    entrant {
                        name
                        participants {
                            gamerTag
                            prefix
                        }
                    }
                }
            }
        }
    `;

    const buildSetSubQuery = (groupId, alias) => `
        ${alias}: phaseGroup(id: ${Number(groupId)}) {
            id
            sets(page: 1, perPage: 96, sortType: STANDARD) {
                nodes {
                    id
                    identifier
                    round
                    displayScore
                    stream {
                        streamName
                    }
                }
            }
        }
    `;

    const SEED_CHUNK_SIZE = 2;
    for (let i = 0; i < groups.length; i += SEED_CHUNK_SIZE) {
        const chunk = groups.slice(i, i + SEED_CHUNK_SIZE);
        showInlineInfo(apiStatus, `⏳ 参加者シードを取得中... (${Math.min(i + SEED_CHUNK_SIZE, groups.length)} / ${groups.length} Pool)`);

        const aliasQueries = chunk.map((g, idx) => buildSeedSubQuery(g.id, `g${idx}`)).join('\n');
        const batchQuery = `query PhaseGroupSeedsBatch {\n${aliasQueries}\n}`;

        try {
            const data = await executeGql(batchQuery);
            chunk.forEach((g, idx) => {
                g.seeds = data[`g${idx}`]?.seeds || { nodes: [] };
                g.sets = g.sets || { nodes: [] };
            });
        } catch (err) {
            for (const singleG of chunk) {
                const singleQuery = `query PhaseGroupSeedSingle {\n${buildSeedSubQuery(singleG.id, 'g0')}\n}`;
                const singleData = await executeGql(singleQuery);
                singleG.seeds = singleData.g0?.seeds || { nodes: [] };
                singleG.sets = singleG.sets || { nodes: [] };
            }
        }
    }

    const currentUrl = startggUrlInput ? startggUrlInput.value : '';
    const isTestPageUrl = (presetSelect && presetSelect.value === 'テスト用') || currentUrl.includes('bracket-printer-test-page');

    if (!isTestPageUrl) {
        const activeGroups = groups.filter(g => (g.seeds?.nodes?.length || 0) > 0);
        const SET_CHUNK_SIZE = 2;
        for (let i = 0; i < activeGroups.length; i += SET_CHUNK_SIZE) {
            const chunk = activeGroups.slice(i, i + SET_CHUNK_SIZE);
            showInlineInfo(apiStatus, `⏳ 対戦カード・配信台情報を取得中... (${Math.min(i + SET_CHUNK_SIZE, activeGroups.length)} / ${activeGroups.length} Pool)`);

            const aliasQueries = chunk.map((g, idx) => buildSetSubQuery(g.id, `s${idx}`)).join('\n');
            const batchQuery = `query PhaseGroupSetsBatch {\n${aliasQueries}\n}`;

            try {
                const data = await executeGql(batchQuery);
                chunk.forEach((g, idx) => {
                    g.sets = data[`s${idx}`]?.sets || { nodes: [] };
                });
            } catch (err) {
                for (const singleG of chunk) {
                    try {
                        const singleQuery = `query PhaseGroupSetSingle {\n${buildSetSubQuery(singleG.id, 's0')}\n}`;
                        const singleData = await executeGql(singleQuery);
                        singleG.sets = singleData.s0?.sets || { nodes: [] };
                    } catch (_) {
                        singleG.sets = { nodes: [] };
                    }
                }
            }
        }
    }

    groups.forEach(g => {
        g._detailsLoaded = true;
    });
}

async function populatePoolsFromStartggPhase(phaseObj, targetGroupId = null) {
    poolsData = {};
    lastAutoConfigSummary = '';
    currentDataSource = 'api';
    matchOverrides = {};

    if (!phaseObj || !phaseObj.phaseGroups || !phaseObj.phaseGroups.nodes) {
        applyPoolsDataToUI('start.gg API', apiStatus);
        return;
    }

    const token = startggTokenInput.value.trim();
    try {
        await ensurePhaseGroupsDetailsLoaded(phaseObj, token);
    } catch (err) {
        console.error('PhaseGroup Chunk Fetch Error:', err);
        const isTestPreset = (presetSelect && presetSelect.value === 'テスト用');
        const urlStr = startggUrlInput ? startggUrlInput.value : '';
        if (isTestPreset || urlStr.includes('bracket-printer-test-page')) {
            await fallbackToDevCsvOnApiError(err);
            return;
        }
        isCsvValid = false;
        showInlineError(apiStatus, `API取得失敗: ${err.message}`);
        updateGenerateButtonState();
        return;
    }

    const queueMapBySetId = {};
    if (Array.isArray(tournamentStreamQueueList)) {
        tournamentStreamQueueList.forEach(sq => {
            const sName = sq.stream?.streamName || '';
            if (Array.isArray(sq.sets)) {
                sq.sets.forEach((st) => {
                    if (st && st.id) {
                        queueMapBySetId[String(st.id)] = {
                            streamName: sName
                        };
                    }
                });
            }
        });
    }

    let totalAutoDetectedDqs = 0;

    const groups = phaseObj.phaseGroups.nodes;
    groups.forEach(group => {
        const rawIdentifier = group.displayIdentifier || String(group.id);
        const poolName = normalizePoolName(rawIdentifier);
        const seedNodes = group.seeds?.nodes || [];

        if (seedNodes.length === 0) return;

        const sortedSeeds = [...seedNodes].sort((a, b) => (a.seedNum || 0) - (b.seedNum || 0));

        const apiStreamByKey = {};
        const apiDqByLabel = {};
        const setNodes = group.sets?.nodes || [];
        const setsByRound = {};

        setNodes.forEach(st => {
            const r = Number(st.round) || 0;
            if (!setsByRound[r]) setsByRound[r] = [];
            setsByRound[r].push(st);

            if (st.identifier && st.displayScore) {
                const normId = String(st.identifier).toUpperCase().trim();
                const rawScoreStr = String(st.displayScore).trim();

                if (rawScoreStr.toUpperCase() === 'DQ' || /(?:^|\s|-)DQ(?:\s|$|-)/i.test(rawScoreStr)) {
                    let dqP1 = false;
                    let dqP2 = false;

                    const winId = st.winnerId ? String(st.winnerId) : null;
                    const e1Id = st.slots?.[0]?.entrant?.id ? String(st.slots[0].entrant.id) : null;
                    const e2Id = st.slots?.[1]?.entrant?.id ? String(st.slots[1].entrant.id) : null;

                    if (winId && (e1Id || e2Id)) {
                        if (e1Id && winId === e1Id) {
                            dqP2 = true;
                        } else if (e2Id && winId === e2Id) {
                            dqP1 = true;
                        }
                    } else if (rawScoreStr.includes(' - ')) {
                        const parts = rawScoreStr.split(' - ');
                        if (parts.length >= 2) {
                            const leftPart = parts[0].trim();
                            const rightPart = parts.slice(1).join(' - ').trim();
                            if (/(?:^|\s)DQ$/i.test(leftPart) || /^DQ(?:\s|$)/i.test(leftPart)) dqP1 = true;
                            if (/(?:^|\s)DQ$/i.test(rightPart) || /^DQ(?:\s|$)/i.test(rightPart)) dqP2 = true;
                        }
                    }

                    if (dqP1 || dqP2) {
                        apiDqByLabel[normId] = { dqP1, dqP2 };
                        if (dqP1) totalAutoDetectedDqs++;
                        if (dqP2) totalAutoDetectedDqs++;
                    }
                }
            }
        });

        Object.keys(setsByRound).forEach(rKey => {
            setsByRound[rKey].sort((a, b) => Number(a.id) - Number(b.id));
            setsByRound[rKey].forEach((st, idxInRound) => {
                const qInfo = queueMapBySetId[String(st.id)];
                const directStreamName = st.stream?.streamName || '';
                if (qInfo || directStreamName) {
                    apiStreamByKey[`${rKey}_${idxInRound}`] = {
                        enabled: true,
                        channel: qInfo?.streamName || directStreamName
                    };
                    if (st.identifier) {
                        apiStreamByKey[`id_${String(st.identifier).toUpperCase()}`] = {
                            enabled: true,
                            channel: qInfo?.streamName || directStreamName
                        };
                    }
                }
            });
        });

        poolsData[poolName] = {
            phaseName: phaseObj.name || '',
            playersByPoolSeed: {},
            rosterList: [],
            apiStreamByRoundIndex: apiStreamByKey,
            apiDqByMatchLabel: apiDqByLabel,
            count: 0,
            groupId: Number(group.id)
        };

        sortedSeeds.forEach((seedNode, index) => {
            const poolSeed = index + 1;
            const phaseSeed = seedNode.seedNum || poolSeed;

            const p0 = seedNode.entrant?.participants?.[0];
            const entrantName = seedNode.entrant?.name || '';

            let shortTag = '';
            let fullTag = '';

            if (p0 && p0.gamerTag) {
                shortTag = p0.gamerTag.trim();
                const pfx = p0.prefix ? p0.prefix.trim() : '';
                fullTag = pfx ? `${pfx} | ${shortTag}` : shortTag;
            } else if (entrantName) {
                fullTag = entrantName.trim();
                const parts = fullTag.split('|');
                shortTag = parts[parts.length - 1].trim();
            } else {
                shortTag = `Seed ${poolSeed}`;
                fullTag = shortTag;
            }

            poolsData[poolName].playersByPoolSeed[poolSeed] = shortTag;
            poolsData[poolName].rosterList.push({
                seed: poolSeed,
                phaseSeed: phaseSeed,
                fullGamerTag: fullTag
            });
            poolsData[poolName].count++;
        });
    });

    const autoMessages = [];
    const isTestPresetActive = (presetSelect && presetSelect.value === 'テスト用');
    const forcedTestFormat = (isTestPresetActive && testPresetFormatSelect) ? testPresetFormatSelect.value : null;
    const bType = forcedTestFormat
        ? (forcedTestFormat === 'single' ? 'SINGLE_ELIMINATION' : 'DOUBLE_ELIMINATION')
        : (phaseObj.bracketType || groups[0]?.bracketType || '');

    if (bType === 'DOUBLE_ELIMINATION') {
        elimFormatSelect.value = 'double';
        losersAdvanceWrapper.classList.remove('hidden');
        losersRoundChangeBlock.classList.remove('hidden');
        autoMessages.push('形式: ダブルエリミ');
    } else if (bType === 'SINGLE_ELIMINATION') {
        elimFormatSelect.value = 'single';
        losersAdvanceWrapper.classList.add('hidden');
        losersRoundChangeBlock.classList.add('hidden');
        losersAdvanceCount.value = '0';
        losersRoundSelect.value = 'none';
        autoMessages.push('形式: シングルエリミ');
    }

    if (isTestPresetActive) {
        setTestPresetLockState(true);
    }

    const totalGroupsCount = groups.length;
    const isFinalPhase = startggPhasesList.length > 0 && String(startggPhasesList[startggPhasesList.length - 1].id) === String(phaseObj.id);

    let perPoolAdvance = 0;
    for (const g of groups) {
        if (Array.isArray(g.progressionsOut) && g.progressionsOut.length > 0) {
            perPoolAdvance = g.progressionsOut.length;
            break;
        }
    }

    let nextPhaseObj = null;
    if (!isFinalPhase) {
        const currentIdx = startggPhasesList.findIndex(p => String(p.id) === String(phaseObj.id));
        if (currentIdx >= 0 && currentIdx + 1 < startggPhasesList.length) {
            nextPhaseObj = startggPhasesList[currentIdx + 1];
        }
    }

    if (isTestPresetActive && perPoolAdvance === 0) {
        if (winnersAdvanceCount.value === '') winnersAdvanceCount.value = '0';
        if (elimFormatSelect.value !== 'single' && losersAdvanceCount.value === '') {
            losersAdvanceCount.value = '0';
        }
        if (isGrandFinalModeSelected()) {
            targetPhaseInput.value = '';
        }
        autoMessages.push('通過人数: W0 / L0 (デフォルト)');
    } else if ((isFinalPhase && totalGroupsCount === 1) || (perPoolAdvance === 0 && isFinalPhase)) {
        winnersAdvanceCount.value = '0';
        if (elimFormatSelect.value !== 'single') {
            losersAdvanceCount.value = '0';
        }
        targetPhaseInput.value = '';
        autoMessages.push('通過人数: 0 (Final完結)');
    } else {
        if (nextPhaseObj) {
            targetPhaseInput.value = nextPhaseObj.name || '';
        }
        if (perPoolAdvance > 0) {
            if (elimFormatSelect.value === 'single') {
                if (['1', '2', '4'].includes(String(perPoolAdvance))) {
                    winnersAdvanceCount.value = String(perPoolAdvance);
                    autoMessages.push(`通過人数: W${perPoolAdvance}`);
                }
            } else {
                const splitMap = {
                    1: { w: '1', l: '0' },
                    2: { w: '1', l: '1' },
                    3: { w: '1', l: '2' },
                    4: { w: '2', l: '2' },
                    6: { w: '2', l: '4' },
                    8: { w: '4', l: '4' },
                    12: { w: '4', l: '8' }
                };
                if (splitMap[perPoolAdvance]) {
                    winnersAdvanceCount.value = splitMap[perPoolAdvance].w;
                    losersAdvanceCount.value = splitMap[perPoolAdvance].l;
                    autoMessages.push(`通過人数: W${splitMap[perPoolAdvance].w} / L${splitMap[perPoolAdvance].l}`);
                }
            }
        }
        if (targetPhaseInput.value) {
            autoMessages.push(`進出先: ${targetPhaseInput.value}`);
        }
    }

    if (totalAutoDetectedDqs > 0) {
        autoMessages.push(`DQ自動検出: ${totalAutoDetectedDqs}枠`);
    }

    if (autoMessages.length > 0) {
        lastAutoConfigSummary = `✨ 自動設定: ${autoMessages.join(' / ')}`;
    }

    applyPoolsDataToUI(`start.gg (${phaseObj.name})`, apiStatus);

    if (targetGroupId) {
        const matchedPoolKey = Object.keys(poolsData).find(k => poolsData[k].groupId === Number(targetGroupId));
        if (matchedPoolKey) {
            poolSelect.value = matchedPoolKey;
            updateAdvanceCountConstraints();
            updateRoundChangeDropdowns();
            updateRecommendedPrintUI(true);
        }
    }
}

phaseSelect.addEventListener('change', async () => {
    const selectedPhaseId = phaseSelect.value;
    const phaseObj = startggPhasesList.find(p => String(p.id) === String(selectedPhaseId));
    if (phaseObj) {
        phaseSelect.disabled = true;
        await populatePoolsFromStartggPhase(phaseObj, null);
        phaseSelect.disabled = false;
    }
});

poolSelect.addEventListener('change', () => {
    updateAdvanceCountConstraints();
    updateRoundChangeDropdowns();
    updateRecommendedPrintUI(true);
    updateGenerateButtonState();
});

fetchStartggBtn.addEventListener('click', async () => {
    hideInlineMessage(csvStatus);
    hideInlineMessage(apiStatus);
    hideInlineMessage(tokenErrorMsg);
    hideInlineMessage(urlErrorMsg);

    const token = startggTokenInput.value.trim();
    const url = startggUrlInput.value.trim();

    let hasInputError = false;
    if (!token) {
        showInlineError(tokenErrorMsg, 'start.gg API token を入力してください。');
        hasInputError = true;
    } else if (!isTokenFormatValid(token)) {
        showInlineError(tokenErrorMsg, '無効な値です。');
        hasInputError = true;
    }

    if (!url) {
        showInlineError(urlErrorMsg, 'Bracket URL を入力してください。');
        hasInputError = true;
    }
    if (hasInputError) return;

    if (!verifySourceIdentifierIntegrity(url)) {
        handleUnsupportedIdentifierError('url');
        return;
    }

    const parsed = parseStartggUrl(url);
    if (!parsed) {
        showInlineError(urlErrorMsg, '無効な値です。有効な start.gg のイベントURLを入力してください。');
        return;
    }

    if (!verifySourceIdentifierIntegrity(parsed.eventSlug)) {
        handleUnsupportedIdentifierError('url');
        return;
    }

    if (!presetSelect || presetSelect.value !== 'テスト用') {
        localStorage.setItem('bracket_printer_startgg_token', token);
    }

    const originalBtnText = fetchStartggBtn.textContent;
    fetchStartggBtn.disabled = true;
    fetchStartggBtn.textContent = '取得中...';
    showInlineInfo(apiStatus, '⏳ start.gg API からイベント構造を取得しています...');

    const metaQuery = `
        query EventMetadataQuery($slug: String!) {
            event(slug: $slug) {
                id
                name
                tournament {
                    name
                    slug
                    streams {
                        id
                        streamName
                        streamSource
                    }
                    streamQueue {
                        stream {
                            streamName
                        }
                        sets {
                            id
                        }
                    }
                }
                phases {
                    id
                    name
                    bracketType
                    phaseOrder
                    phaseGroups(query: { page: 1, perPage: 150 }) {
                        nodes {
                            id
                            displayIdentifier
                            bracketType
                            progressionsOut {
                                id
                            }
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch('https://api.start.gg/gql/alpha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                query: metaQuery,
                variables: { slug: parsed.eventSlug }
            })
        });

        const json = await response.json();

        if (!response.ok || json.errors) {
            const errMsg = json.errors ? json.errors.map(e => e.message).join(', ') : `HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        const eventData = json.data?.event;
        if (!eventData || !eventData.phases || eventData.phases.length === 0) {
            throw new Error('指定されたURLのイベントまたはフェーズが見つかりませんでした。');
        }

        const tSlug = eventData.tournament?.slug || '';
        const tName = eventData.tournament?.name || '';
        if (!verifySourceIdentifierIntegrity(tSlug) || !verifySourceIdentifierIntegrity(tName)) {
            handleUnsupportedIdentifierError('url');
            return;
        }

        if (tournamentNameInput && !tournamentNameInput.value.trim() && tName) {
            tournamentNameInput.value = tName;
        }

        tournamentStreamsList = eventData.tournament?.streams || [];
        tournamentStreamQueueList = eventData.tournament?.streamQueue || [];

        startggPhasesList = eventData.phases;
        currentTargetGroupIdFromUrl = parsed.phaseGroupId;

        phaseSelect.innerHTML = '';
        startggPhasesList.forEach(p => {
            const groupCount = p.phaseGroups?.nodes?.length || 0;
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${groupCount} Pool)`;
            phaseSelect.appendChild(opt);
        });

        if (startggPhasesList.length > 1) {
            phaseSelectWrapper.classList.remove('hidden');
        } else {
            phaseSelectWrapper.classList.add('hidden');
        }

        let targetPhase = startggPhasesList[0];
        if (parsed.phaseId) {
            const matchedPhase = startggPhasesList.find(p => Number(p.id) === Number(parsed.phaseId));
            if (matchedPhase) targetPhase = matchedPhase;
        }

        phaseSelect.value = targetPhase.id;
        await populatePoolsFromStartggPhase(targetPhase, currentTargetGroupIdFromUrl);

    } catch (err) {
        console.error('start.gg API Error:', err);
        const isTestPreset = (presetSelect && presetSelect.value === 'テスト用');
        if (isTestPreset || url.includes('bracket-printer-test-page')) {
            await fallbackToDevCsvOnApiError(err);
        } else {
            isCsvValid = false;
            showInlineError(apiStatus, `API取得失敗: ${err.message}`);
            updateGenerateButtonState();
        }
    } finally {
        fetchStartggBtn.disabled = false;
        fetchStartggBtn.textContent = originalBtnText;
    }
});

// === 手順2: トーナメント形式の選択制御 ===
elimFormatSelect.addEventListener('change', (e) => {
    const isSingle = e.target.value === 'single';
    if (isSingle) {
        losersAdvanceWrapper.classList.add('hidden');
        losersRoundChangeBlock.classList.add('hidden');
        losersAdvanceCount.value = '0';
        losersRoundSelect.value = 'none';
    } else {
        losersAdvanceWrapper.classList.remove('hidden');
        losersRoundChangeBlock.classList.remove('hidden');
        if (losersAdvanceCount.value === '0' && winnersAdvanceCount.value !== '0') {
            losersAdvanceCount.value = '';
        }
    }
    updateAdvanceCountConstraints();
    updateTargetPhaseInputState();
    updateRoundChangeDropdowns();
    updateRecommendedPrintUI(true);
    updateGenerateButtonState();
});

// === 手順3: 通過人数の選択 ===
winnersAdvanceCount.addEventListener('change', () => {
    if (elimFormatSelect.value === 'double' && winnersAdvanceCount.value === '0') {
        losersAdvanceCount.value = '0';
    } else if (elimFormatSelect.value === 'double' && losersAdvanceCount.value === '0' && winnersAdvanceCount.value !== '0') {
        losersAdvanceCount.value = '1';
    }
    updateTargetPhaseInputState();
    updateRoundChangeDropdowns();
    updateGenerateButtonState();
});

losersAdvanceCount.addEventListener('change', () => {
    if (elimFormatSelect.value === 'double' && losersAdvanceCount.value === '0') {
        winnersAdvanceCount.value = '0';
    } else if (elimFormatSelect.value === 'double' && winnersAdvanceCount.value === '0' && losersAdvanceCount.value !== '0') {
        winnersAdvanceCount.value = '1';
    }
    updateTargetPhaseInputState();
    updateRoundChangeDropdowns();
    updateGenerateButtonState();
});

// === 手順4: 基本最大セット数 ===
const customBoContainer = document.getElementById('custom-bo-container');
const customBoInput = document.getElementById('custom-bo-input');
const customBoApplyBtn = document.getElementById('custom-bo-apply-btn');
const customBoError = document.getElementById('custom-bo-error');
const customBoConfirmArea = document.getElementById('custom-bo-confirm-area');
const customBoConfirmText = document.getElementById('custom-bo-confirm-text');
const customBoConfirmYes = document.getElementById('custom-bo-confirm-yes');
const customBoConfirmNo = document.getElementById('custom-bo-confirm-no');

baseBoSelect.addEventListener('change', (e) => {
    hideInlineMessage(customBoError);
    if (e.target.value === 'custom') {
        customBoContainer.classList.remove('hidden');
        customBoConfirmArea.classList.add('hidden');
        customBoInput.disabled = false;
        customBoApplyBtn.disabled = false;
        customBoInput.value = '';
        baseBoValue = '';
        isCustomBoConfirmed = false;
        customBoInput.focus();
    } else {
        customBoContainer.classList.add('hidden');
        baseBoValue = e.target.value;
        isCustomBoConfirmed = false;
    }
    updateGenerateButtonState();
});

function triggerCustomBoCheck() {
    hideInlineMessage(customBoError);
    const valStr = customBoInput.value.trim();
    const num = Number(valStr);
    if (!valStr || !Number.isInteger(num) || num <= 0 || num % 2 === 0) {
        showInlineError(customBoError, '最大セット数は正の奇数（1, 3, 5, 7, 9...）を半角数字で入力してください。');
        customBoConfirmArea.classList.add('hidden');
        return;
    }
    const winNeeded = Math.ceil(num / 2);
    customBoConfirmText.textContent = `設定内容の確認: Bo${num} / ${winNeeded}本先取`;
    customBoConfirmArea.classList.remove('hidden');
}

customBoApplyBtn.addEventListener('click', triggerCustomBoCheck);
customBoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        triggerCustomBoCheck();
    }
});

customBoConfirmYes.addEventListener('click', () => {
    const num = Number(customBoInput.value.trim());
    baseBoValue = String(num);
    isCustomBoConfirmed = true;
    customBoInput.disabled = true;
    customBoApplyBtn.disabled = true;
    customBoConfirmText.textContent = `✅成功\nBo${num} / ${Math.ceil(num / 2)}本先取 で確定しました。`;
    updateGenerateButtonState();
});

customBoConfirmNo.addEventListener('click', () => {
    isCustomBoConfirmed = false;
    baseBoValue = '';
    customBoInput.disabled = false;
    customBoApplyBtn.disabled = false;
    customBoConfirmArea.classList.add('hidden');
    customBoInput.value = '';
    customBoInput.focus();
    updateGenerateButtonState();
});

// === 手順5: ラウンド途中のセット数変更 ===
changeModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'yes') {
            roundChangeContainer.classList.remove('hidden');
            updateRoundChangeDropdowns();
        } else {
            roundChangeContainer.classList.add('hidden');
            winnersRoundSelect.value = 'none';
            losersRoundSelect.value = 'none';
            hideInlineMessage(winnersCustomError);
            hideInlineMessage(losersCustomError);
        }
        updateGenerateButtonState();
    });
});

winnersBoSelect.addEventListener('change', (e) => {
    winnersCustomInput.classList.toggle('hidden', e.target.value !== 'custom');
    hideInlineMessage(winnersCustomError);
    if (e.target.value === 'custom') winnersCustomInput.focus();
    updateGenerateButtonState();
});

losersBoSelect.addEventListener('change', (e) => {
    losersCustomInput.classList.toggle('hidden', e.target.value !== 'custom');
    hideInlineMessage(losersCustomError);
    if (e.target.value === 'custom') losersCustomInput.focus();
    updateGenerateButtonState();
});

function validateOddCustomInput(inputEl, errEl) {
    const valStr = inputEl.value.trim();
    if (valStr === '') {
        hideInlineMessage(errEl);
        updateGenerateButtonState();
        return;
    }
    const num = Number(valStr);
    if (!Number.isInteger(num) || num <= 0 || num % 2 === 0) {
        showInlineError(errEl, '奇数の半角数字を入力してください。');
    } else {
        hideInlineMessage(errEl);
    }
    updateGenerateButtonState();
}

winnersCustomInput.addEventListener('input', () => validateOddCustomInput(winnersCustomInput, winnersCustomError));
losersCustomInput.addEventListener('input', () => validateOddCustomInput(losersCustomInput, losersCustomError));
winnersRoundSelect.addEventListener('change', updateGenerateButtonState);
losersRoundSelect.addEventListener('change', updateGenerateButtonState);

// === 手順6: 通過先フェーズ名の入力監視 ===
targetPhaseInput.addEventListener('input', updateGenerateButtonState);

function getBoStringForRound(side, roundName, poolPlayerCount = null) {
    let bo = baseBoValue || '5';
    const isChangeMode = document.querySelector('input[name="change-mode"]:checked').value === 'yes';

    if (isChangeMode) {
        const effCount = poolPlayerCount || getCurrentPoolPlayerCount();
        const isSingle = elimFormatSelect.value === 'single';
        const wCountNum = winnersAdvanceCount.value !== '' ? Number(winnersAdvanceCount.value) : 1;
        const lCountNum = isSingle ? 0 : (losersAdvanceCount.value !== '' ? Number(losersAdvanceCount.value) : 2);
        const { winnersRounds, losersRounds } = computeActiveRounds(effCount, isSingle, wCountNum, lCountNum);

        if (side === 'W') {
            const targetRound = winnersRoundSelect.value;
            if (targetRound !== 'none') {
                const startIndex = winnersRounds.indexOf(targetRound);
                const currentIndex = winnersRounds.indexOf(roundName);
                if (startIndex !== -1 && currentIndex >= startIndex) {
                    bo = winnersBoSelect.value === 'custom' ? (winnersCustomInput.value.trim() || bo) : winnersBoSelect.value;
                }
            }
        } else if (side === 'L') {
            const targetRound = losersRoundSelect.value;
            if (targetRound !== 'none') {
                const startIndex = losersRounds.indexOf(targetRound);
                const currentIndex = losersRounds.indexOf(roundName);
                if (startIndex !== -1 && currentIndex >= startIndex) {
                    bo = losersBoSelect.value === 'custom' ? (losersCustomInput.value.trim() || bo) : losersBoSelect.value;
                }
            }
        }
    }
    return `[Bo${bo}]`;
}

// === 描画オプション1: 右下ロゴの白黒判定＆縦160px上限リサイズ ===
logoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
        showInlineError(logoStatus, 'PNGファイル（.png）のみアップロード可能です。');
        logoUpload.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const origW = img.naturalWidth || img.width;
            const origH = img.naturalHeight || img.height;

            if (origW === 0 || origH === 0) {
                showInlineError(logoStatus, '画像の読み込みに失敗しました。');
                logoUpload.value = '';
                return;
            }

            const checkCanvas = document.createElement('canvas');
            checkCanvas.width = origW;
            checkCanvas.height = origH;
            const checkCtx = checkCanvas.getContext('2d');
            checkCtx.drawImage(img, 0, 0);

            const imageData = checkCtx.getImageData(0, 0, origW, origH).data;
            let isMonochrome = true;

            for (let i = 0; i < imageData.length; i += 4) {
                const a = imageData[i + 3];
                if (a < 16) continue;

                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];

                const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
                if (maxDiff > LOGO_COLOR_TOLERANCE) {
                    isMonochrome = false;
                    break;
                }
            }

            if (!isMonochrome) {
                showInlineError(logoStatus, 'カラー画像は使用できません。白黒（モノクロ・グレースケール）のPNGファイルのみ対応しています。');
                logoUpload.value = '';
                return;
            }

            const scale = origH > MAX_LOGO_HEIGHT ? (MAX_LOGO_HEIGHT / origH) : 1;
            const targetW = Math.max(1, Math.round(origW * scale));
            const targetH = Math.max(1, Math.round(origH * scale));

            const outCanvas = document.createElement('canvas');
            outCanvas.width = targetW;
            outCanvas.height = targetH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.fillStyle = '#ffffff';
            outCtx.fillRect(0, 0, targetW, targetH);
            outCtx.imageSmoothingEnabled = true;
            outCtx.imageSmoothingQuality = 'high';
            outCtx.drawImage(img, 0, 0, targetW, targetH);

            pendingLogoDataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
            const resizeNote = scale < 1 ? ` / 縦${origH}px→${targetH}pxに自動縮小済` : ` / ${targetW}×${targetH}px`;
            showInlineSuccess(logoStatus, `白黒PNG確認済 (${file.name}${resizeNote})\n「ブラケットを描画する」で反映されます。`);
            clearLogoBtn.classList.remove('hidden');
            saveCurrentSessionToStorage();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

clearLogoBtn.addEventListener('click', () => {
    logoUpload.value = '';
    pendingLogoDataUrl = null;
    if (presetSelect) presetSelect.value = '';
    if (presetNumberWrapper) presetNumberWrapper.classList.add('hidden');
    if (kurobraGameWrapper) kurobraGameWrapper.classList.add('hidden');
    showInlineInfo(logoStatus, 'ロゴをクリアしました（「ブラケットを描画する」で反映）。');
    clearLogoBtn.classList.add('hidden');
    saveCurrentSessionToStorage();
});

// === 重なっているテキストボックスの前面・後面入れ替えヘルパー ===
function toggleOverlappingTextBoxZOrder(targetBox) {
    const allBoxes = Array.from(customTextsLayer.querySelectorAll('.draggable-text-box'));
    if (allBoxes.length <= 1) return;

    const r1 = targetBox.getBoundingClientRect();
    const overlappingBoxes = allBoxes.filter(b => {
        if (b === targetBox) return false;
        const r2 = b.getBoundingClientRect();
        return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
    });

    if (overlappingBoxes.length === 0) {
        topTextBoxZIndex++;
        targetBox.style.zIndex = String(topTextBoxZIndex);
        return;
    }

    const group = [targetBox, ...overlappingBoxes];
    const zValues = group.map(b => parseInt(b.style.zIndex || '30', 10));
    const maxZ = Math.max(...zValues);
    const minZ = Math.min(...zValues);
    const currentZ = parseInt(targetBox.style.zIndex || '30', 10);

    if (currentZ >= maxZ && maxZ !== minZ) {
        overlappingBoxes.forEach(b => {
            const z = parseInt(b.style.zIndex || '30', 10);
            b.style.zIndex = String(z + 1);
        });
        targetBox.style.zIndex = String(minZ);
    } else {
        topTextBoxZIndex = Math.max(topTextBoxZIndex, maxZ) + 1;
        targetBox.style.zIndex = String(topTextBoxZIndex);
    }
}

// === 描画オプション2: 部分選択（ドラッグ / Shift+矢印キー）対応の高機能テキストボックス ===
function createDraggableTextBox(initialText = 'テキストを入力', x = 1240, y = 1480, initialFontSize = '18px', styleOptions = {}) {
    const box = document.createElement('div');
    box.className = 'draggable-text-box pointer-events-auto';
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    topTextBoxZIndex++;
    box.style.zIndex = String(topTextBoxZIndex);

    const isBoldInit = styleOptions.bold !== undefined ? Boolean(styleOptions.bold) : true;
    const isItalicInit = Boolean(styleOptions.italic);
    const isUnderlineInit = Boolean(styleOptions.underline);
    const alignInit = styleOptions.align || 'left';
    const numericFontSize = Math.max(8, Math.min(120, parseInt(String(initialFontSize), 10) || 18));

    const controls = document.createElement('div');
    controls.className = 'text-box-controls';

    const dragLabel = document.createElement('span');
    dragLabel.textContent = '⠿ 移動';
    dragLabel.className = 'font-bold mr-1 shrink-0';

    const toolGroup = document.createElement('div');
    toolGroup.className = 'flex items-center gap-1 flex-wrap';

    const boldBtn = document.createElement('button');
    boldBtn.type = 'button';
    boldBtn.textContent = 'B';
    boldBtn.title = '太字（文字選択時は選択部分のみ）';
    boldBtn.className = `text-tool-btn font-bold ${isBoldInit ? 'active' : ''}`;

    const italicBtn = document.createElement('button');
    italicBtn.type = 'button';
    italicBtn.textContent = 'I';
    italicBtn.title = '斜体（文字選択時は選択部分のみ）';
    italicBtn.className = `text-tool-btn italic font-serif ${isItalicInit ? 'active' : ''}`;

    const underlineBtn = document.createElement('button');
    underlineBtn.type = 'button';
    underlineBtn.textContent = 'U';
    underlineBtn.title = '下線（文字選択時は選択部分のみ）';
    underlineBtn.className = `text-tool-btn underline ${isUnderlineInit ? 'active' : ''}`;

    const sizeWrapper = document.createElement('div');
    sizeWrapper.className = 'flex items-center gap-0.5 ml-0.5';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = '8';
    sizeInput.max = '120';
    sizeInput.step = '1';
    sizeInput.value = String(numericFontSize);
    sizeInput.title = 'フォントサイズ (px) ※文字選択時は選択部分のみ変更';
    sizeInput.className = 'text-size-input';
    const pxUnit = document.createElement('span');
    pxUnit.textContent = 'px';
    pxUnit.className = 'text-[9.5px] text-gray-500';
    sizeWrapper.append(sizeInput, pxUnit);

    const alignLeftBtn = document.createElement('button');
    alignLeftBtn.type = 'button';
    alignLeftBtn.textContent = '左';
    alignLeftBtn.title = '左寄せ';
    alignLeftBtn.className = `text-tool-btn ${alignInit === 'left' ? 'active' : ''}`;

    const alignCenterBtn = document.createElement('button');
    alignCenterBtn.type = 'button';
    alignCenterBtn.textContent = '中';
    alignCenterBtn.title = '中央寄せ';
    alignCenterBtn.className = `text-tool-btn ${alignInit === 'center' ? 'active' : ''}`;

    const alignRightBtn = document.createElement('button');
    alignRightBtn.type = 'button';
    alignRightBtn.textContent = '右';
    alignRightBtn.title = '右寄せ';
    alignRightBtn.className = `text-tool-btn ${alignInit === 'right' ? 'active' : ''}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '×';
    delBtn.className = 'text-red-500 hover:text-red-700 font-bold px-1.5 text-xs ml-0.5';
    delBtn.title = '削除';

    toolGroup.append(boldBtn, italicBtn, underlineBtn, sizeWrapper, alignLeftBtn, alignCenterBtn, alignRightBtn, delBtn);
    controls.append(dragLabel, toolGroup);

    const content = document.createElement('div');
    content.className = 'draggable-text-content';
    content.contentEditable = 'true';
    content.style.fontSize = `${numericFontSize}px`;
    content.style.fontWeight = isBoldInit ? '700' : '400';
    content.style.fontStyle = isItalicInit ? 'italic' : 'normal';
    content.style.textDecoration = isUnderlineInit ? 'underline' : 'none';
    content.style.textAlign = alignInit;

    if (styleOptions.html) {
        content.innerHTML = styleOptions.html;
    } else {
        content.textContent = initialText;
    }

    let savedRange = null;
    const saveSelectionIfInside = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            if (content.contains(r.commonAncestorContainer)) {
                savedRange = r.cloneRange();
                if (!r.collapsed) {
                    const parentEl = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
                    if (parentEl && content.contains(parentEl)) {
                        const computedPx = Math.round(parseFloat(window.getComputedStyle(parentEl).fontSize));
                        if (!isNaN(computedPx) && document.activeElement !== sizeInput) {
                            sizeInput.value = String(computedPx);
                        }
                    }
                }
            }
        }
    };

    content.addEventListener('mouseup', saveSelectionIfInside);
    content.addEventListener('keyup', saveSelectionIfInside);
    content.addEventListener('input', () => {
        saveSelectionIfInside();
        saveCurrentSessionToStorage();
    });

    const restoreSavedSelection = () => {
        if (!savedRange) return false;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return !savedRange.collapsed;
    };

    [boldBtn, italicBtn, underlineBtn, alignLeftBtn, alignCenterBtn, alignRightBtn].forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    boldBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (restoreSavedSelection()) {
            document.execCommand('bold', false, null);
            saveSelectionIfInside();
        } else {
            const isCurrentlyBold = content.style.fontWeight === '700' || content.style.fontWeight === 'bold';
            content.style.fontWeight = isCurrentlyBold ? '400' : '700';
            boldBtn.classList.toggle('active', !isCurrentlyBold);
        }
        saveCurrentSessionToStorage();
    });

    italicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (restoreSavedSelection()) {
            document.execCommand('italic', false, null);
            saveSelectionIfInside();
        } else {
            const isCurrentlyItalic = content.style.fontStyle === 'italic';
            content.style.fontStyle = isCurrentlyItalic ? 'normal' : 'italic';
            italicBtn.classList.toggle('active', !isCurrentlyItalic);
        }
        saveCurrentSessionToStorage();
    });

    underlineBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (restoreSavedSelection()) {
            document.execCommand('underline', false, null);
            saveSelectionIfInside();
        } else {
            const isCurrentlyUnderline = content.style.textDecoration.includes('underline');
            content.style.textDecoration = isCurrentlyUnderline ? 'none' : 'underline';
            underlineBtn.classList.toggle('active', !isCurrentlyUnderline);
        }
        saveCurrentSessionToStorage();
    });

    const applyFontSizeToSelectionOrBox = () => {
        let val = parseInt(sizeInput.value, 10);
        if (isNaN(val)) return;
        val = Math.max(8, Math.min(120, val));

        if (savedRange && !savedRange.collapsed && content.contains(savedRange.commonAncestorContainer)) {
            restoreSavedSelection();
            document.execCommand('fontSize', false, '7');
            const fontEls = content.querySelectorAll('font[size="7"]');
            let lastSpan = null;
            fontEls.forEach(fEl => {
                const span = document.createElement('span');
                span.style.fontSize = `${val}px`;
                span.innerHTML = fEl.innerHTML;
                fEl.parentNode.replaceChild(span, fEl);
                lastSpan = span;
            });
            if (lastSpan) {
                const newRange = document.createRange();
                newRange.selectNodeContents(lastSpan);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedRange = newRange.cloneRange();
            }
        } else {
            content.style.fontSize = `${val}px`;
            content.querySelectorAll('span').forEach(sp => {
                if (sp.style.fontSize) sp.style.fontSize = `${val}px`;
            });
        }
        saveCurrentSessionToStorage();
    };

    sizeInput.addEventListener('input', applyFontSizeToSelectionOrBox);
    sizeInput.addEventListener('change', () => {
        let val = parseInt(sizeInput.value, 10);
        if (isNaN(val)) val = 18;
        val = Math.max(8, Math.min(120, val));
        sizeInput.value = String(val);
        applyFontSizeToSelectionOrBox();
    });

    const updateAlignment = (newAlign) => {
        content.style.textAlign = newAlign;
        alignLeftBtn.classList.toggle('active', newAlign === 'left');
        alignCenterBtn.classList.toggle('active', newAlign === 'center');
        alignRightBtn.classList.toggle('active', newAlign === 'right');
        saveCurrentSessionToStorage();
    };
    alignLeftBtn.addEventListener('click', (e) => { e.stopPropagation(); updateAlignment('left'); });
    alignCenterBtn.addEventListener('click', (e) => { e.stopPropagation(); updateAlignment('center'); });
    alignRightBtn.addEventListener('click', (e) => { e.stopPropagation(); updateAlignment('right'); });

    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        box.remove();
        saveCurrentSessionToStorage();
    });

    let isDragging = false;
    let hasMovedDuringDrag = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let origLeft = 0;
    let origTop = 0;

    controls.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        isDragging = true;
        hasMovedDuringDrag = false;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        origLeft = parseFloat(box.style.left) || 0;
        origTop = parseFloat(box.style.top) || 0;
        e.preventDefault();
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const currentScale = (Number(zoomSlider.value) || 100) / 100;
        const dx = (e.clientX - startMouseX) / currentScale;
        const dy = (e.clientY - startMouseY) / currentScale;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasMovedDuringDrag = true;
        }
        box.style.left = `${Math.max(0, origLeft + dx)}px`;
        box.style.top = `${Math.max(0, origTop + dy)}px`;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging && hasMovedDuringDrag) {
            saveCurrentSessionToStorage();
        }
        isDragging = false;
    });

    box.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        if (hasMovedDuringDrag) {
            hasMovedDuringDrag = false;
            return;
        }
        toggleOverlappingTextBoxZOrder(box);
    });

    box.append(controls, content);
    customTextsLayer.appendChild(box);
}

addTextBtn.addEventListener('click', () => {
    const isSheetDrawn = !document.getElementById('main-sheet-body').classList.contains('hidden');
    if (isSheetDrawn) {
        createDraggableTextBox('自由記述テキスト', 1240, 1480 + (customTextsLayer.children.length * 55), '18px');
        hideInlineMessage(textBoxStatus);
        saveCurrentSessionToStorage();
    } else {
        pendingTextBoxesCount++;
        showInlineInfo(textBoxStatus, `テキストボックスを追加予約しました（現在 ${pendingTextBoxesCount} 個）。\n「ブラケットを描画する」を押すと配置されます。`);
    }
});

// === 対戦カード個別編集モーダル（DQ書き込み ＆ 配信台ラベル設定：CSV / API 両対応） ===
function openMatchEditModal(poolName, matchLabel, p1Name, p2Name, defaultStreamInfo, defaultDqInfo) {
    const key = `${poolName}_${matchLabel}`;
    currentEditingMatchKey = key;

    const existing = matchOverrides[key] || {};
    modalMatchTitle.textContent = `Pool ${poolName} - Match ${matchLabel} の設定`;
    modalP1Label.textContent = p1Name ? `上段: ${p1Name}` : '上段 (Player 1)';
    modalP2Label.textContent = p2Name ? `下段: ${p2Name}` : '下段 (Player 2)';

    modalP1Dq.checked = existing.dqP1 !== undefined ? Boolean(existing.dqP1) : Boolean(defaultDqInfo?.dqP1);
    modalP2Dq.checked = existing.dqP2 !== undefined ? Boolean(existing.dqP2) : Boolean(defaultDqInfo?.dqP2);

    const streamEnabled = existing.streamEnabled !== undefined
        ? Boolean(existing.streamEnabled)
        : Boolean(defaultStreamInfo?.enabled);
    const streamChannel = existing.streamChannel !== undefined
        ? existing.streamChannel
        : (defaultStreamInfo?.channel || (tournamentStreamsList[0]?.streamName || ''));

    modalStreamEnable.checked = streamEnabled;
    modalStreamChannel.value = streamChannel;

    modalStreamSuggestions.innerHTML = '';
    if (tournamentStreamsList.length > 0) {
        tournamentStreamsList.forEach(st => {
            if (!st.streamName) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'text-[10px] bg-white hover:bg-pink-100 text-[#DB2777] border border-pink-300 rounded px-1.5 py-0.5 font-semibold transition';
            btn.textContent = st.streamName;
            btn.addEventListener('click', () => {
                modalStreamChannel.value = st.streamName;
                modalStreamEnable.checked = true;
            });
            modalStreamSuggestions.appendChild(btn);
        });
    }

    matchEditModal.classList.remove('hidden');
}

function closeMatchEditModal() {
    matchEditModal.classList.add('hidden');
    currentEditingMatchKey = null;
}

modalCloseBtn.addEventListener('click', closeMatchEditModal);
modalCancelBtn.addEventListener('click', closeMatchEditModal);
matchEditModal.addEventListener('click', (e) => {
    if (e.target === matchEditModal) closeMatchEditModal();
});

modalSaveBtn.addEventListener('click', () => {
    if (!currentEditingMatchKey) return;
    matchOverrides[currentEditingMatchKey] = {
        dqP1: modalP1Dq.checked,
        dqP2: modalP2Dq.checked,
        streamEnabled: modalStreamEnable.checked,
        streamChannel: modalStreamChannel.value.trim()
    };
    closeMatchEditModal();
    renderMatchOverridesSummaryPanel();
    if (!document.getElementById('main-sheet-body').classList.contains('hidden')) {
        generateBtn.click();
    } else {
        saveCurrentSessionToStorage();
    }
});

// === DQリセットボタン ===
if (clearDqOverridesBtn) {
    clearDqOverridesBtn.addEventListener('click', () => {
        const selectedPoolName = poolSelect.value;
        const currentPool = poolsData[selectedPoolName];
        if (currentPool && currentPool.apiDqByMatchLabel) {
            currentPool.apiDqByMatchLabel = {};
        }
        Object.keys(matchOverrides).forEach(k => {
            if (!selectedPoolName || k.startsWith(`${selectedPoolName}_`)) {
                delete matchOverrides[k].dqP1;
                delete matchOverrides[k].dqP2;
            }
        });
        renderMatchOverridesSummaryPanel();
        if (!document.getElementById('main-sheet-body').classList.contains('hidden')) {
            generateBtn.click();
        }
    });
}

// === 配信台リセットボタン ===
if (clearStreamOverridesBtn) {
    clearStreamOverridesBtn.addEventListener('click', () => {
        const selectedPoolName = poolSelect.value;
        const currentPool = poolsData[selectedPoolName];
        if (currentPool && currentPool.apiStreamByRoundIndex) {
            currentPool.apiStreamByRoundIndex = {};
        }
        Object.keys(matchOverrides).forEach(k => {
            if (!selectedPoolName || k.startsWith(`${selectedPoolName}_`)) {
                delete matchOverrides[k].streamEnabled;
                delete matchOverrides[k].streamChannel;
            }
        });
        renderMatchOverridesSummaryPanel();
        if (!document.getElementById('main-sheet-body').classList.contains('hidden')) {
            generateBtn.click();
        }
    });
}

// === 描画オプションの反映関数 ===
function applyPrintAndDrawOptions() {
    const pad = { v: 8, h: 10 };
    previewArea.style.padding = `${pad.v}px ${pad.h}px`;

    logoDisplayContainer.style.bottom = `${pad.v}px`;
    logoDisplayContainer.style.right = `${pad.h}px`;

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
        hideInlineMessage(logoStatus);
    }

    while (pendingTextBoxesCount > 0) {
        createDraggableTextBox('自由記述テキスト', 1240, 1480 + (customTextsLayer.children.length * 55), '18px');
        pendingTextBoxesCount--;
    }
    hideInlineMessage(textBoxStatus);
}

// === ズーム（表示倍率）制御 ＆ プレビュー画面のドラッグ視点移動（パン操作） ===
function setZoom(percent) {
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
        const scaleX = availableWidth / contentWidth;
        const scaleY = availableHeight / contentHeight;
        const bestPercent = Math.min(100, Math.max(20, Math.floor(Math.min(scaleX, scaleY) * 100)));
        setZoom(bestPercent);
    }
}

zoomSlider.addEventListener('input', (e) => setZoom(Number(e.target.value)));
document.getElementById('zoom-reset-btn').addEventListener('click', () => setZoom(100));
document.getElementById('zoom-fit-btn').addEventListener('click', fitToViewport);
window.addEventListener('resize', () => {
    if (!isPrintingMode) fitToViewport();
});
window.addEventListener('DOMContentLoaded', () => {
    updateRestoreSessionButtonState();
    requestAnimationFrame(fitToViewport);
});

// プレビュー領域のドラッグによる視点移動（パン操作）
let isViewportPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;

if (viewport) {
    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.draggable-text-box') || e.target.closest('.match-box')) return;
        isViewportPanning = true;
        viewport.classList.add('is-panning');
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollLeft = viewport.scrollLeft;
        panScrollTop = viewport.scrollTop;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isViewportPanning) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        viewport.scrollLeft = panScrollLeft - dx;
        viewport.scrollTop = panScrollTop - dy;
    });

    window.addEventListener('mouseup', () => {
        if (isViewportPanning) {
            isViewportPanning = false;
            viewport.classList.remove('is-panning');
        }
    });
}

// === ブラケット描画処理（プレビュー画面への反映） ===
generateBtn.addEventListener('click', () => {
    hideInlineMessage(generateErrorMsg);
    hideInlineMessage(exportErrorMsg);

    const selectedPoolName = poolSelect.value;
    const currentPool = poolsData[selectedPoolName];
    if (!currentPool) return;

    const urlVal = startggUrlInput ? startggUrlInput.value.trim() : '';
    const tNameVal = tournamentNameInput ? tournamentNameInput.value.trim() : '';
    if (!verifySourceIdentifierIntegrity(urlVal) || !verifySourceIdentifierIntegrity(tNameVal)) {
        showInlineError(generateErrorMsg, UNSUPPORTED_SCHEMA_MSG);
        return;
    }

    if (!isGrandFinalModeSelected() && targetPhaseInput && targetPhaseInput.value.trim() === '') {
        targetPhaseInput.value = 'Day2 / TOP192';
    }

    document.getElementById('preview-placeholder').classList.add('hidden');
    document.getElementById('preview-header').classList.remove('hidden');
    document.getElementById('main-sheet-body').classList.remove('hidden');

    const isSingle = elimFormatSelect.value === 'single';
    const wCount = winnersAdvanceCount.value;
    const lCount = isSingle ? '0' : losersAdvanceCount.value;
    const isGfMode = isGrandFinalModeSelected();
    const elimTitle = isSingle ? 'Single Elimination' : 'Double Elimination';

    document.getElementById('pool-title').textContent = buildPoolHeaderTitle(selectedPoolName, elimTitle, currentPool.count);

    const subtitleEl = document.getElementById('pool-subtitle');
    if (isGfMode) {
        subtitleEl.textContent = '';
        subtitleEl.classList.add('hidden');
    } else {
        subtitleEl.classList.remove('hidden');
        subtitleEl.textContent = isSingle
            ? `Qualifier: ${wCount}`
            : `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`;
    }

    const bracketContainer = document.getElementById('bracket-container');
    const rosterContainer = document.getElementById('checkin-roster-container');

    const { canvasWidth, canvasHeight } = buildBracketSheetContent(selectedPoolName, bracketContainer, rosterContainer, previewArea);
    previewArea.style.width = `${canvasWidth}px`;
    previewArea.style.minHeight = `${canvasHeight}px`;
    previewArea.style.height = `${canvasHeight}px`;

    hasSessionBeenDrawnOrRestored = true;
    applyPrintAndDrawOptions();
    renderMatchOverridesSummaryPanel();
    updateRestoreSessionButtonState();
    saveCurrentSessionToStorage();
    requestAnimationFrame(fitToViewport);
});

// === シートDOM要素を高解像度または軽量グレースケールJPEGデータURLとしてキャプチャする共通ヘルパー ===
async function captureSheetElementAsJpeg(sheetEl, width, height, options = {}) {
    const pixelRatio = options.pixelRatio || 1.5;
    const quality = options.quality || 0.90;
    const optimizeForPdf = Boolean(options.optimizeForPdf);

    if (!optimizeForPdf && window.htmlToImage) {
        return await htmlToImage.toJpeg(sheetEl, {
            quality: quality,
            pixelRatio: pixelRatio,
            backgroundColor: '#ffffff',
            width: width,
            height: height,
            style: { transform: 'none', margin: '0' }
        });
    }

    let sourceCanvas = null;
    if (window.htmlToImage && htmlToImage.toCanvas) {
        sourceCanvas = await htmlToImage.toCanvas(sheetEl, {
            pixelRatio: pixelRatio,
            backgroundColor: '#ffffff',
            width: width,
            height: height,
            style: { transform: 'none', margin: '0' }
        });
    } else {
        sourceCanvas = await html2canvas(sheetEl, {
            scale: pixelRatio,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: width,
            height: height,
            windowWidth: width + 50,
            windowHeight: height + 50,
            scrollX: 0,
            scrollY: 0
        });
    }

    if (optimizeForPdf) {
        const ctx = sourceCanvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
            const snapped = gray > 246 ? 255 : gray;
            data[i] = snapped;
            data[i + 1] = snapped;
            data[i + 2] = snapped;
            data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    return sourceCanvas.toDataURL('image/jpeg', quality);
}

// === 画像エクスポート機能 (.jpg) ===
document.getElementById('export-btn').addEventListener('click', async () => {
    hideInlineMessage(exportErrorMsg);
    const isSheetDrawn = !document.getElementById('main-sheet-body').classList.contains('hidden');
    if (!isSheetDrawn) {
        showInlineError(exportErrorMsg, '先に初期設定を完了し、「ブラケットを描画する」を押してください。');
        return;
    }

    const btn = document.getElementById('export-btn');
    const originalText = btn.textContent;
    btn.textContent = '生成中...';
    btn.disabled = true;

    const currentZoom = Number(zoomSlider.value);
    previewArea.classList.add('exporting');

    scaleWrapper.style.transform = 'none';
    scaleWrapper.style.width = `${previewArea.offsetWidth}px`;
    scaleWrapper.style.height = `${previewArea.offsetHeight}px`;

    try {
        const width = previewArea.offsetWidth;
        const height = previewArea.offsetHeight;
        const dataUrl = await captureSheetElementAsJpeg(previewArea, width, height, {
            pixelRatio: 2,
            quality: 0.92,
            optimizeForPdf: false
        });

        const link = document.createElement('a');
        link.download = `Pool_${poolSelect.value || 'bracket'}.jpg`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('画像生成に失敗しました:', err);
        showInlineError(exportErrorMsg, '画像生成に失敗しました。');
    } finally {
        previewArea.classList.remove('exporting');
        setZoom(currentZoom);
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// === 印刷画面を表示せず直接PDFファイルを生成・ダウンロードするエンジン ===
async function downloadPoolsAsPdfDirect(targetPoolNames, triggerBtn) {
    if (!targetPoolNames || targetPoolNames.length === 0) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showInlineError(exportErrorMsg, 'PDF生成ライブラリ(jsPDF)の読み込みに失敗しました。ページを再読み込みしてください。');
        return;
    }

    const originalBtnText = triggerBtn ? triggerBtn.textContent : '';
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'PDF生成中...';
    }

    isPrintingMode = true;
    applyPrintAndDrawOptions();

    const isCustomPrintSetting = !resetPrintRecBtn.classList.contains('hidden');
    const marginType = printMarginSelect.value;

    const marginMapMm = { standard: 3.5, wide: 8, narrow: 1.5 };
    const marginMm = marginMapMm[marginType] ?? 3.5;
    const pad = { v: 8, h: 10 };

    const paperDimensionsMm = {
        A3: { long: 420, short: 297 },
        B4: { long: 364, short: 257 },
        A4: { long: 297, short: 210 },
        B5: { long: 257, short: 182 },
        A5: { long: 210, short: 148 }
    };

    const isSingle = elimFormatSelect.value === 'single';
    const wCount = winnersAdvanceCount.value;
    const lCount = isSingle ? '0' : losersAdvanceCount.value;
    const isGfMode = isGrandFinalModeSelected();
    const elimTitle = isSingle ? 'Single Elimination' : 'Double Elimination';
    const subtitleText = isGfMode
        ? ''
        : (isSingle
            ? `Qualifier: ${wCount}`
            : `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`);

    const { jsPDF } = window.jspdf;
    let pdfDoc = null;

    batchPrintContainer.innerHTML = '';
    batchPrintContainer.classList.remove('hidden');
    batchPrintContainer.style.cssText = 'position: fixed; left: -10000px; top: 0; z-index: -10; background: #ffffff;';

    try {
        for (let i = 0; i < targetPoolNames.length; i++) {
            const pName = targetPoolNames[i];
            const poolObj = poolsData[pName];
            if (!poolObj) continue;

            if (triggerBtn && targetPoolNames.length > 1) {
                triggerBtn.textContent = `PDF生成中... (${i + 1}/${targetPoolNames.length})`;
            }

            let size = printSizeSelect.value;
            let orientation = printOrientationSelect.value;
            if (!isCustomPrintSetting) {
                const effPoolRefCount = getEffectiveReferencePlayerCount(poolObj.count);
                const recForPool = getRecommendedPrintSettings(effPoolRefCount, elimFormatSelect.value || 'double');
                size = recForPool.size;
                orientation = recForPool.orientation;
            }

            const dim = paperDimensionsMm[size] || paperDimensionsMm.A3;
            const pageW_mm = orientation === 'landscape' ? dim.long : dim.short;
            const pageH_mm = orientation === 'landscape' ? dim.short : dim.long;

            if (!pdfDoc) {
                pdfDoc = new jsPDF({
                    orientation: orientation === 'landscape' ? 'l' : 'p',
                    unit: 'mm',
                    format: [pageW_mm, pageH_mm],
                    compress: true
                });
            } else {
                pdfDoc.addPage([pageW_mm, pageH_mm], orientation === 'landscape' ? 'l' : 'p');
            }

            const sheet = createElement('div', 'batch-print-sheet exporting text-gray-800 relative');

            const header = createElement('div', 'border-b-2 border-gray-800 pb-1.5 mb-2.5 flex justify-between items-end shrink-0');
            const headerLeft = createElement('div');
            headerLeft.appendChild(createElement('h2', 'text-2xl font-bold', buildPoolHeaderTitle(pName, elimTitle, poolObj.count)));
            if (!isGfMode && subtitleText) {
                headerLeft.appendChild(createElement('p', 'text-sm text-gray-600 font-medium', subtitleText));
            }

            const headerRight = createElement('div', 'text-right text-xs text-gray-600 leading-snug font-medium');
            headerRight.appendChild(createElement('p', '', 'https://tesnoo.github.io/BracketPrinter/'));
            headerRight.appendChild(createElement('p', '', 'Contact: @Tesnoo_ssb'));
            header.append(headerLeft, headerRight);

            const body = createElement('div', 'flex-1 flex flex-col relative w-full');
            const bContainer = createElement('div', 'flex flex-col justify-between w-full');
            const rContainer = createElement('div', 'absolute top-0 right-0 z-10');

            const { canvasWidth, canvasHeight } = buildBracketSheetContent(pName, bContainer, rContainer, sheet);
            body.append(bContainer, rContainer);
            sheet.append(header, body);

            if (pendingLogoDataUrl) {
                const logoBox = createElement('div', 'absolute z-20 pointer-events-none');
                logoBox.style.bottom = `${pad.v}px`;
                logoBox.style.right = `${pad.h}px`;
                const logoImg = document.createElement('img');
                logoImg.src = pendingLogoDataUrl;
                logoImg.style.maxHeight = `${MAX_LOGO_HEIGHT}px`;
                logoImg.style.width = 'auto';
                logoImg.style.height = 'auto';
                logoImg.className = 'object-contain block';
                logoBox.appendChild(logoImg);
                sheet.appendChild(logoBox);
                if (logoImg.decode) {
                    await logoImg.decode().catch(() => {});
                }
            }

            Array.from(customTextsLayer.children).forEach(origTextBox => {
                const cloneBox = origTextBox.cloneNode(true);
                sheet.appendChild(cloneBox);
            });

            sheet.style.width = `${canvasWidth}px`;
            sheet.style.minHeight = `${canvasHeight}px`;
            sheet.style.height = `${canvasHeight}px`;
            sheet.style.padding = `${pad.v}px ${pad.h}px`;
            sheet.style.backgroundColor = '#ffffff';

            batchPrintContainer.innerHTML = '';
            batchPrintContainer.appendChild(sheet);

            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const maxLongSidePx = 2250;
            const targetRatio = Math.min(1.15, maxLongSidePx / Math.max(canvasWidth, canvasHeight));
            const imgDataUrl = await captureSheetElementAsJpeg(sheet, canvasWidth, canvasHeight, {
                pixelRatio: targetRatio,
                quality: 0.72,
                optimizeForPdf: true
            });

            const availW_mm = Math.max(20, pageW_mm - marginMm * 2);
            const availH_mm = Math.max(20, pageH_mm - marginMm * 2);
            const imgAspect = canvasWidth / canvasHeight;
            const pageAspect = availW_mm / availH_mm;

            let drawW_mm = availW_mm;
            let drawH_mm = availH_mm;
            if (imgAspect > pageAspect) {
                drawH_mm = availW_mm / imgAspect;
            } else {
                drawH_mm = availH_mm * imgAspect;
            }

            const offsetX_mm = marginMm + (availW_mm - drawW_mm) / 2;
            const offsetY_mm = marginMm + (availH_mm - drawH_mm) / 2;

            pdfDoc.addImage(imgDataUrl, 'JPEG', offsetX_mm, offsetY_mm, drawW_mm, drawH_mm, undefined, 'FAST');
        }

        if (pdfDoc) {
            const tName = tournamentNameInput ? tournamentNameInput.value.trim().replace(/[\\/:*?"<>|]+/g, '_') : '';
            const fileName = targetPoolNames.length === 1
                ? `${tName ? tName + '_' : ''}Pool_${targetPoolNames[0]}.pdf`
                : `${tName ? tName + '_' : ''}All_Pools_${targetPoolNames.length}sheets.pdf`;

            pdfDoc.save(fileName);
        }
    } catch (err) {
        console.error('PDF直接生成エラー:', err);
        showInlineError(exportErrorMsg, `PDFファイルの生成に失敗しました: ${err.message}`);
    } finally {
        batchPrintContainer.innerHTML = '';
        batchPrintContainer.classList.add('hidden');
        batchPrintContainer.style.cssText = '';
        isPrintingMode = false;
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.textContent = originalBtnText;
        }
        requestAnimationFrame(fitToViewport);
    }
}

// === 単一プール PDF直接ダウンロード ===
document.getElementById('export-pdf-btn').addEventListener('click', () => {
    hideInlineMessage(exportErrorMsg);
    const isSheetDrawn = !document.getElementById('main-sheet-body').classList.contains('hidden');
    if (!isSheetDrawn) {
        showInlineError(exportErrorMsg, '先に初期設定を完了し、「ブラケットを描画する」を押してください。');
        return;
    }
    const selectedPoolName = poolSelect.value;
    if (!selectedPoolName) return;

    downloadPoolsAsPdfDirect([selectedPoolName], document.getElementById('export-pdf-btn'));
});

// === 全プール一括 PDF直接ダウンロード ===
document.getElementById('export-all-pdf-btn').addEventListener('click', () => {
    hideInlineMessage(exportErrorMsg);
    if (!isCsvValid || generateBtn.disabled) {
        showInlineError(exportErrorMsg, '先に初期設定（手順1〜手順6）をすべて完了させてください。');
        return;
    }

    const poolKeys = sortPoolKeys(Object.keys(poolsData));
    if (poolKeys.length === 0) return;

    downloadPoolsAsPdfDirect(poolKeys, document.getElementById('export-all-pdf-btn'));
});

// =========================================================================
// 🛠️ メンテナンスモード制御 ＆ 所有者専用リモート切替システム（GitHub API連携）
// =========================================================================
const MAINT_GH_TOKEN_KEY = 'bracket_printer_maint_gh_token';
const MAINT_GH_REPO_KEY = 'bracket_printer_maint_gh_repo';

const maintenanceOverlay = document.getElementById('maintenance-overlay');
const maintenanceTitleDisplay = document.getElementById('maintenance-title-display');
const maintenanceMsgDisplay = document.getElementById('maintenance-msg-display');
const maintenanceEtaBox = document.getElementById('maintenance-eta-box');
const maintenanceEtaDisplay = document.getElementById('maintenance-eta-display');
const maintenanceSecretTrigger = document.getElementById('maintenance-secret-trigger');

const devMaintenanceBanner = document.getElementById('dev-maintenance-banner');
const devBannerOpenAdminBtn = document.getElementById('dev-banner-open-admin-btn');
const appBrandHeader = document.getElementById('app-brand-header');

const maintenanceAdminModal = document.getElementById('maintenance-admin-modal');
const maintAdminCloseBtn = document.getElementById('maint-admin-close-btn');
const maintAdminCancelBtn = document.getElementById('maint-admin-cancel-btn');
const maintAdminSaveBtn = document.getElementById('maint-admin-save-btn');
const maintGithubTokenInput = document.getElementById('maint-github-token');
const maintGithubRepoInput = document.getElementById('maint-github-repo');
const maintEnableCheckbox = document.getElementById('maint-enable-checkbox');
const maintTitleInput = document.getElementById('maint-title-input');
const maintMessageInput = document.getElementById('maint-message-input');
const maintEtaInput = document.getElementById('maint-eta-input');
const maintAdminStatus = document.getElementById('maint-admin-status');

let currentMaintenanceConfig = {
    enabled: false,
    title: 'ただいまメンテナンス中です',
    message: '現在、システムの調整および不具合の修正作業を行っております。\nご不便をおかけいたしますが、復旧まで今しばらくお待ちください。',
    eta: ''
};

function isDevEnvironment() {
    const path = window.location.pathname.toLowerCase();
    const host = window.location.hostname.toLowerCase();
    return (
        path.includes('/dev/') ||
        path.endsWith('/dev') ||
        path.includes('bracketprinter-dev') ||
        host.includes('-dev') ||
        host === 'localhost' ||
        host === '127.0.0.1'
    );
}

function applyMaintenanceStateToUI(config) {
    if (!config) return;
    currentMaintenanceConfig = {
        enabled: Boolean(config.enabled),
        title: config.title || 'ただいまメンテナンス中です',
        message: config.message || '現在、システムの調整および不具合の修正作業を行っております。\nご不便をおかけいたしますが、復旧まで今しばらくお待ちください。',
        eta: config.eta || ''
    };

    if (maintenanceTitleDisplay) {
        maintenanceTitleDisplay.textContent = currentMaintenanceConfig.title;
    }
    if (maintenanceMsgDisplay) {
        maintenanceMsgDisplay.textContent = currentMaintenanceConfig.message;
    }
    if (maintenanceEtaBox && maintenanceEtaDisplay) {
        if (currentMaintenanceConfig.eta.trim() !== '') {
            maintenanceEtaDisplay.textContent = currentMaintenanceConfig.eta.trim();
            maintenanceEtaBox.classList.remove('hidden');
        } else {
            maintenanceEtaBox.classList.add('hidden');
        }
    }

    if (currentMaintenanceConfig.enabled) {
        if (isDevEnvironment()) {
            if (maintenanceOverlay) maintenanceOverlay.classList.add('hidden');
            if (devMaintenanceBanner) devMaintenanceBanner.classList.remove('hidden');
        } else {
            if (maintenanceOverlay) maintenanceOverlay.classList.remove('hidden');
            if (devMaintenanceBanner) devMaintenanceBanner.classList.add('hidden');
        }
    } else {
        if (maintenanceOverlay) maintenanceOverlay.classList.add('hidden');
        if (devMaintenanceBanner) devMaintenanceBanner.classList.add('hidden');
    }
}

async function fetchAndCheckMaintenanceStatus() {
    const stamp = Date.now();
    const candidates = [
        `maintenance.json?t=${stamp}`,
        `../maintenance.json?t=${stamp}`
    ];

    for (const url of candidates) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data.enabled === 'boolean') {
                    applyMaintenanceStateToUI(data);
                    return data;
                }
            }
        } catch (_) {
            // 次の候補パスを試行
        }
    }
    return currentMaintenanceConfig;
}

async function openMaintenanceAdminModal() {
    if (!maintenanceAdminModal) return;
    hideInlineMessage(maintAdminStatus);

    const savedGhToken = localStorage.getItem(MAINT_GH_TOKEN_KEY) || '';
    const savedGhRepo = localStorage.getItem(MAINT_GH_REPO_KEY) || 'Tesnoo/BracketPrinter';

    if (maintGithubTokenInput) maintGithubTokenInput.value = savedGhToken;
    if (maintGithubRepoInput) maintGithubRepoInput.value = savedGhRepo;

    await fetchAndCheckMaintenanceStatus();

    if (maintEnableCheckbox) maintEnableCheckbox.checked = Boolean(currentMaintenanceConfig.enabled);
    if (maintTitleInput) maintTitleInput.value = currentMaintenanceConfig.title;
    if (maintMessageInput) maintMessageInput.value = currentMaintenanceConfig.message;
    if (maintEtaInput) maintEtaInput.value = currentMaintenanceConfig.eta;

    maintenanceAdminModal.classList.remove('hidden');
}

function closeMaintenanceAdminModal() {
    if (!maintenanceAdminModal) return;
    maintenanceAdminModal.classList.add('hidden');
}

function registerSecretTapTrigger(el) {
    if (!el) return;
    let tapCount = 0;
    let tapTimer = null;

    el.addEventListener('click', () => {
        tapCount++;
        if (tapTimer) clearTimeout(tapTimer);
        if (tapCount >= 5) {
            tapCount = 0;
            openMaintenanceAdminModal();
        } else {
            tapTimer = setTimeout(() => {
                tapCount = 0;
            }, 2500);
        }
    });
}

registerSecretTapTrigger(appBrandHeader);
registerSecretTapTrigger(maintenanceSecretTrigger);

if (devBannerOpenAdminBtn) {
    devBannerOpenAdminBtn.addEventListener('click', openMaintenanceAdminModal);
}
if (maintAdminCloseBtn) {
    maintAdminCloseBtn.addEventListener('click', closeMaintenanceAdminModal);
}
if (maintAdminCancelBtn) {
    maintAdminCancelBtn.addEventListener('click', closeMaintenanceAdminModal);
}
if (maintenanceAdminModal) {
    maintenanceAdminModal.addEventListener('click', (e) => {
        if (e.target === maintenanceAdminModal) closeMaintenanceAdminModal();
    });
}

function encodeUtf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

if (maintAdminSaveBtn) {
    maintAdminSaveBtn.addEventListener('click', async () => {
        hideInlineMessage(maintAdminStatus);

        const ghToken = maintGithubTokenInput ? maintGithubTokenInput.value.trim() : '';
        const ghRepo = maintGithubRepoInput ? maintGithubRepoInput.value.trim() : 'Tesnoo/BracketPrinter';

        if (!ghToken) {
            showInlineError(maintAdminStatus, 'GitHub Personal Access Token を入力してください。');
            return;
        }
        if (!/^[^/]+\/[^/]+$/.test(ghRepo)) {
            showInlineError(maintAdminStatus, '対象リポジトリは「所有者名/リポジトリ名」の形式で入力してください。');
            return;
        }

        localStorage.setItem(MAINT_GH_TOKEN_KEY, ghToken);
        localStorage.setItem(MAINT_GH_REPO_KEY, ghRepo);

        const newConfig = {
            enabled: Boolean(maintEnableCheckbox?.checked),
            title: (maintTitleInput?.value || '').trim() || 'ただいまメンテナンス中です',
            message: (maintMessageInput?.value || '').trim() || '現在、システムの調整および不具合の修正作業を行っております。\nご不便をおかけいたしますが、復旧まで今しばらくお待ちください。',
            eta: (maintEtaInput?.value || '').trim(),
            updatedAt: new Date().toISOString()
        };

        const originalBtnText = maintAdminSaveBtn.textContent;
        maintAdminSaveBtn.disabled = true;
        maintAdminSaveBtn.textContent = 'GitHubへ反映中...';
        showInlineInfo(maintAdminStatus, '⏳ GitHubリポジトリの maintenance.json を更新しています...');

        const apiUrl = `https://api.github.com/repos/${ghRepo}/contents/maintenance.json`;
        const headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${ghToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
        };

        try {
            let existingSha = null;
            const getRes = await fetch(apiUrl, {
                method: 'GET',
                headers: headers,
                cache: 'no-store'
            });

            if (getRes.ok) {
                const fileInfo = await getRes.json();
                existingSha = fileInfo.sha || null;
            } else if (getRes.status !== 404) {
                const errJson = await getRes.json().catch(() => ({}));
                throw new Error(errJson.message || `HTTP ${getRes.status}`);
            }

            const jsonContent = JSON.stringify(newConfig, null, 2) + '\n';
            const putBody = {
                message: `chore: toggle maintenance mode to ${newConfig.enabled ? 'ON' : 'OFF'}`,
                content: encodeUtf8ToBase64(jsonContent)
            };
            if (existingSha) {
                putBody.sha = existingSha;
            }

            const putRes = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(putBody)
            });

            if (!putRes.ok) {
                const errJson = await putRes.json().catch(() => ({}));
                throw new Error(errJson.message || `HTTP ${putRes.status} (トークンの権限を確認してください)`);
            }

            applyMaintenanceStateToUI(newConfig);
            const stateLabel = newConfig.enabled ? '【メンテナンス中 (ON)】' : '【通常公開 (OFF)】';
            showInlineSuccess(
                maintAdminStatus,
                `${stateLabel} へ更新しました！\n（GitHub Pagesへの反映には数十秒ほどかかる場合があります）`
            );
        } catch (err) {
            console.error('Maintenance Update Error:', err);
            showInlineError(maintAdminStatus, `更新失敗: ${err.message}`);
        } finally {
            maintAdminSaveBtn.disabled = false;
            maintAdminSaveBtn.textContent = originalBtnText;
        }
    });
}

fetchAndCheckMaintenanceStatus();
setInterval(fetchAndCheckMaintenanceStatus, 60000);
