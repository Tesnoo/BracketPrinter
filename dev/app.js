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

// 印刷計算パラメータ保持
let lastComputedPrintMetrics = {
    canvasWidth: 2362,
    canvasHeight: 1670,
    printScale: 0.65,
    scaledBoxWidth: 1500,
    scaledBoxHeight: 1060
};

const MAX_LOGO_HEIGHT = 160;
const LOGO_COLOR_TOLERANCE = 15;

const SLOT_HEIGHT_24 = 80;
const WINNERS_SLOT_HEIGHT_32 = 88;
const LOSERS_SLOT_HEIGHT_32 = 90;
const ROUND_HEADER_TOTAL_HEIGHT = 34;

let recommendedPrintConfig = {
    size: 'A3',
    orientation: 'landscape',
    margin: 'standard',
    reason: '13〜24人 ダブルエリミの推奨設定'
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
    }
};

// === DOM要素参照 ===
const presetSelect = document.getElementById('preset-select');
const loadPresetBtn = document.getElementById('load-preset-btn');
const loadPresetFileInput = document.getElementById('load-preset-file-input');
const presetLoadStatus = document.getElementById('preset-load-status');
const createPresetBtn = document.getElementById('create-preset-btn');

const kurobraGameWrapper = document.getElementById('kurobra-game-wrapper');
const kurobraGameSelect = document.getElementById('kurobra-game-select');
const presetNumberWrapper = document.getElementById('preset-number-wrapper');
const presetNumberInput = document.getElementById('preset-number-input');
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
        const val = startggTokenInput.value.trim();
        if (val && !isTokenFormatValid(val)) {
            showInlineError(tokenErrorMsg, '無効な値です。');
        } else {
            hideInlineMessage(tokenErrorMsg);
            if (val) localStorage.setItem('bracket_printer_startgg_token', val);
        }
    });
}

if (startggUrlInput) {
    startggUrlInput.addEventListener('input', () => {
        hideInlineMessage(urlErrorMsg);
    });
}

// === Bo設定を一括適用するヘルパー関数 ===
function setBoConfiguration(baseBo, enableChange, wRound = 'none', wBo = '5', lRound = 'none', lBo = '5', wCustom = '', lCustom = '') {
    const customBoContainer = document.getElementById('custom-bo-container');
    const customBoInput = document.getElementById('custom-bo-input');
    const customBoConfirmArea = document.getElementById('custom-bo-confirm-area');
    const customBoConfirmText = document.getElementById('custom-bo-confirm-text');

    if (baseBoSelect) {
        if (baseBo === '3' || baseBo === '5') {
            baseBoSelect.value = baseBo;
            baseBoValue = baseBo;
            isCustomBoConfirmed = false;
            if (customBoContainer) customBoContainer.classList.add('hidden');
        } else if (baseBo) {
            baseBoSelect.value = 'custom';
            baseBoValue = String(baseBo);
            isCustomBoConfirmed = true;
            if (customBoContainer) customBoContainer.classList.remove('hidden');
            if (customBoInput) {
                customBoInput.value = String(baseBo);
                customBoInput.disabled = true;
            }
            if (customBoConfirmArea) customBoConfirmArea.classList.remove('hidden');
            if (customBoConfirmText) {
                const n = Number(baseBo);
                customBoConfirmText.textContent = `✅成功\nBo${n} / ${Math.ceil(n / 2)}本先取 で確定しました。`;
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
            if (wBo === '3' || wBo === '5') {
                winnersBoSelect.value = wBo;
                if (winnersCustomInput) winnersCustomInput.classList.add('hidden');
            } else {
                winnersBoSelect.value = 'custom';
                if (winnersCustomInput) {
                    winnersCustomInput.classList.remove('hidden');
                    winnersCustomInput.value = wCustom || String(wBo);
                }
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
            if (lBo === '3' || lBo === '5') {
                losersBoSelect.value = lBo;
                if (losersCustomInput) losersCustomInput.classList.add('hidden');
            } else {
                losersBoSelect.value = 'custom';
                if (losersCustomInput) {
                    losersCustomInput.classList.remove('hidden');
                    losersCustomInput.value = lCustom || String(lBo);
                }
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

    // カスタム作成された .bp に Base64 ロゴデータ (logoDataUrl) が埋め込まれている場合
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
    const numStr = presetNumberInput ? presetNumberInput.value.trim() : '';
    const kurobraGameMode = kurobraGameSelect ? kurobraGameSelect.value : 'sp';

    const replaceNumberToken = (tpl) => {
        if (!tpl) return '';
        if (!numStr) return tpl.replace(/#?\[N\]/g, '').replace(/-\[N\]/g, '').trim();
        return tpl.replace(/\[N\]/g, numStr);
    };

    if (tournamentNameInput) {
        if (profile.nameTemplate && profile.nameTemplate.includes('[N]')) {
            tournamentNameInput.value = numStr
                ? profile.nameTemplate.replace(/\[N\]/g, numStr)
                : (profile.presetKey || profile.presetId || '');
        } else if (profile.tournamentName !== undefined) {
            tournamentNameInput.value = profile.tournamentName;
        } else if (profile.nameTemplate) {
            tournamentNameInput.value = profile.nameTemplate;
        }
    }

    if (startggUrlInput) {
        let urlTpl = profile.urlTemplate || '';
        if ((profile.presetKey || profile.presetId) === 'クロブラ') {
            urlTpl = (kurobraGameMode === 'dx')
                ? (profile.urlTemplateDx || profile.urlTemplate)
                : (profile.urlTemplateSp || profile.urlTemplate);
        }
        if (urlTpl.includes('[N]')) {
            startggUrlInput.value = numStr ? replaceNumberToken(urlTpl) : '';
        } else if (urlTpl) {
            startggUrlInput.value = urlTpl;
        }
        hideInlineMessage(urlErrorMsg);
    }

    if (applyBoAndNotes) {
        if (profile.elimFormat && elimFormatSelect) {
            elimFormatSelect.value = profile.elimFormat;
            const isSingle = profile.elimFormat === 'single';
            losersAdvanceWrapper.classList.toggle('hidden', isSingle);
            losersRoundChangeBlock.classList.toggle('hidden', isSingle);
        }
        if (profile.winnersAdvanceCount !== undefined && winnersAdvanceCount) {
            winnersAdvanceCount.value = String(profile.winnersAdvanceCount);
        }
        if (profile.losersAdvanceCount !== undefined && losersAdvanceCount) {
            losersAdvanceCount.value = String(profile.losersAdvanceCount);
        }
        if (profile.targetPhaseName !== undefined && targetPhaseInput) {
            targetPhaseInput.value = profile.targetPhaseName;
        }
        updateTargetPhaseInputState();

        let boCfg = profile.boConfig || (profile.boRule && (profile.boRule.default || profile.boRule));
        if ((profile.presetKey || profile.presetId) === 'クロブラ') {
            if (kurobraGameMode === 'dx') {
                boCfg = profile.boConfigDx || (profile.boRule && profile.boRule.dx);
            } else {
                boCfg = profile.boConfigSp || (profile.boRule && profile.boRule.sp);
            }
        }
        if (boCfg && boCfg.baseBo) {
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
                    activeProfile = {
                        ...fallbackProfile,
                        ...loadedJson,
                        boConfig: loadedJson.boConfig || (loadedJson.boRule && (loadedJson.boRule.default || loadedJson.boRule)) || fallbackProfile.boConfig
                    };
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
            if (presetNumberWrapper) presetNumberWrapper.classList.add('hidden');
            if (kurobraGameWrapper) kurobraGameWrapper.classList.add('hidden');
            if (presetNumberInput) presetNumberInput.value = '';
            if (tournamentNameInput) tournamentNameInput.placeholder = '例: Vic-Seekers #1';
            return;
        }

        if (presetNumberWrapper) presetNumberWrapper.classList.remove('hidden');
        if (kurobraGameWrapper) {
            kurobraGameWrapper.classList.toggle('hidden', selectedPreset !== 'クロブラ');
        }

        await loadAndApplyPresetProfile(selectedPreset, true);
        if (presetNumberInput) {
            presetNumberInput.focus();
        }
    });
}

// === オリジナルプリセットの作成（.bpファイルのダウンロード） ===
if (createPresetBtn) {
    createPresetBtn.addEventListener('click', () => {
        hideInlineMessage(exportErrorMsg);

        const tName = tournamentNameInput ? tournamentNameInput.value.trim() : '';
        const urlVal = startggUrlInput ? startggUrlInput.value.trim() : '';
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

        const bpObject = {
            formatVersion: '1.0',
            presetId: tName || 'Custom_Preset',
            presetKey: tName || 'Custom_Preset',
            tournamentName: tName,
            nameTemplate: tName,
            urlTemplate: urlVal,
            elimFormat: elimFormatSelect.value || 'double',
            winnersAdvanceCount: winnersAdvanceCount.value || '',
            losersAdvanceCount: losersAdvanceCount.value || '',
            targetPhaseName: targetPhaseInput.value.trim(),
            boConfig: {
                baseBo: baseBoValue || baseBoSelect.value || '5',
                enableChange: isChangeMode,
                wRound: winnersRoundSelect.value || 'none',
                wBo: winnersBoSelect.value || '5',
                wCustom: winnersCustomInput ? winnersCustomInput.value.trim() : '',
                lRound: losersRoundSelect.value || 'none',
                lBo: losersBoSelect.value || '5',
                lCustom: losersCustomInput ? losersCustomInput.value.trim() : ''
            },
            printConfig: {
                size: printSizeSelect.value || 'A3',
                orientation: printOrientationSelect.value || 'landscape',
                margin: printMarginSelect.value || 'standard',
                showPhaseName: showPhaseNameCheckbox ? showPhaseNameCheckbox.checked : true
            },
            logoDataUrl: pendingLogoDataUrl || null,
            notes: notesList
        };

        const blob = new Blob([JSON.stringify(bpObject, null, 2)], { type: 'application/json' });
        const safeName = (tName || 'custom_preset').replace(/[\\/:*?"<>|\s]+/g, '_');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${safeName}.bp`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
}

// === ローカルから作成したプリセット (.bp) を読み込む ===
if (loadPresetBtn && loadPresetFileInput) {
    loadPresetBtn.addEventListener('click', () => {
        loadPresetFileInput.value = '';
        loadPresetFileInput.click();
    });

    loadPresetFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        hideInlineMessage(presetLoadStatus);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(String(ev.target.result || ''));
                if (!parsed || typeof parsed !== 'object') {
                    throw new Error('無効なファイル形式です。');
                }

                if (presetSelect) presetSelect.value = '';
                const hasNumberToken = (parsed.nameTemplate && parsed.nameTemplate.includes('[N]')) ||
                                       (parsed.urlTemplate && parsed.urlTemplate.includes('[N]'));
                if (presetNumberWrapper) {
                    presetNumberWrapper.classList.toggle('hidden', !hasNumberToken);
                }
                if (kurobraGameWrapper) {
                    kurobraGameWrapper.classList.add('hidden');
                }

                BUILTIN_BP_PROFILES['__CUSTOM_LOADED__'] = parsed;
                applyBpProfileObject(parsed, true);
                if (parsed.logoDataUrl || parsed.logoFile || parsed.logoRawUrl) {
                    loadPresetLogo(parsed, parsed.presetKey || parsed.presetId || file.name);
                }

                showInlineSuccess(presetLoadStatus, `プリセット「${file.name}」を読み込みました。`);
                if (!document.getElementById('main-sheet-body').classList.contains('hidden') && !generateBtn.disabled) {
                    generateBtn.click();
                }
            } catch (err) {
                console.error('Preset Load Error:', err);
                showInlineError(presetLoadStatus, 'プリセットファイル (.bp) の読み込みに失敗しました。');
            }
        };
        reader.readAsText(file);
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
        const targetProfile = selectedPreset ? BUILTIN_BP_PROFILES[selectedPreset] : BUILTIN_BP_PROFILES['__CUSTOM_LOADED__'];
        if (targetProfile) {
            applyBpProfileObject(targetProfile, false);
        }
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
    });
}
if (showPhaseNameCheckbox) {
    showPhaseNameCheckbox.addEventListener('change', refreshRenderedHeaderTitle);
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

// === プール人数判定：通常大会で12-13人や24-25人のように境界をまたぐ場合（最大と最小の差が4人以内）は大きい方に統一 ===
function getEffectivePlayerCountForPool(poolName = null) {
    const poolKeys = Object.keys(poolsData);
    if (poolKeys.length === 0) return maxPoolPlayerCount || 24;

    const counts = poolKeys.map(k => poolsData[k].count);
    const maxC = Math.max(...counts);
    const minC = Math.min(...counts);

    // 通常の大会フェーズ（プール間の人数差が4人以下：例 12〜13人、24〜25人など）は大きい方の設定に統一
    if (maxC - minC <= 4) {
        return maxC;
    }

    // 6〜40人検証用トーナメントのように幅広い人数が混在する場合は、各プールの人数に応じた推奨設定を適用
    const targetKey = poolName || poolSelect.value;
    if (targetKey && poolsData[targetKey]) {
        return poolsData[targetKey].count;
    }
    return maxC;
}

function updateAdvanceCountConstraints() {
    const n = getEffectivePlayerCountForPool();

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

// === フェーズ通過までに実際に存在するラウンド一覧を算出する関数（6〜40人対応） ===
function computeActiveRounds(playerCount, isSingle, wCountNum, lCountNum) {
    const isGfMode = (!isSingle && wCountNum === 0 && lCountNum === 0) || (isSingle && wCountNum === 0);

    let winnersRounds = [];
    if (playerCount >= 33) {
        if (wCountNum === 4) {
            winnersRounds = ['Winners Round 1', 'Winners Round 2', 'Winners Round 3', 'Winners Quarter-Final'];
        } else if (wCountNum === 2) {
            winnersRounds = ['Winners Round 1', 'Winners Round 2', 'Winners Round 3', 'Winners Quarter-Final', 'Winners Semi-Final'];
        } else {
            winnersRounds = ['Winners Round 1', 'Winners Round 2', 'Winners Round 3', 'Winners Quarter-Final', 'Winners Semi-Final', 'Winners Final'];
        }
    } else if (playerCount >= 17) {
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

    if (isGfMode && !isSingle) {
        winnersRounds.push('Grand Final', 'Grand Final Reset');
    }

    if (isSingle || (!isGfMode && lCountNum <= 0)) {
        return { winnersRounds, losersRounds: [] };
    }

    const effW = isGfMode ? 1 : Math.max(1, wCountNum);
    const effL = isGfMode ? 1 : Math.max(1, lCountNum);

    const isFinalWLoserDirectQual = (effL >= 2 * effW);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, effL - effW) : effL;
    let losersRounds = [];

    if (playerCount >= 33) {
        losersRounds = ['Losers Round 1', 'Losers Round 2', 'Losers Round 3', 'Losers Round 4'];
        const rNames = {
            wqfDrop: 'Losers Round 5',
            consolidate2: 'Losers Round 6',
            wsfDrop: 'Losers Quarter-Final',
            consolidate1: 'Losers Semi-Final',
            wfDrop: 'Losers Final'
        };

        if (effW === 4 && isFinalWLoserDirectQual) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wqfDrop);
        if (targetLosersBracketQuals >= 4) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate2);
        if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) {
            return { winnersRounds, losersRounds };
        }
        if (effW === 4 && targetLosersBracketQuals === 1) {
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (effW === 2 && targetLosersBracketQuals === 2) {
            return { winnersRounds, losersRounds };
        }
        if (effW === 1 && isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) {
                return { winnersRounds, losersRounds };
            }
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if (effW === 2 && targetLosersBracketQuals === 1) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wfDrop);
        return { winnersRounds, losersRounds };
    } else if (playerCount >= 17) {
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

        if (effW === 4 && isFinalWLoserDirectQual) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wqfDrop);
        if (targetLosersBracketQuals >= 4) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate2);
        if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) {
            return { winnersRounds, losersRounds };
        }
        if (effW === 4 && targetLosersBracketQuals === 1) {
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (effW === 2 && targetLosersBracketQuals === 2) {
            return { winnersRounds, losersRounds };
        }
        if (effW === 1 && isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) {
                return { winnersRounds, losersRounds };
            }
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if (effW === 2 && targetLosersBracketQuals === 1) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wfDrop);
        return { winnersRounds, losersRounds };
    } else if (playerCount >= 9) {
        losersRounds = (playerCount >= 13)
            ? ['Losers Round 1', 'Losers Round 2']
            : ['Losers Round 1'];

        const rNames = (playerCount >= 13)
            ? {
                wsfDrop: 'Losers Quarter-Final',
                consolidate1: 'Losers Semi-Final',
                wfDrop: 'Losers Final'
            }
            : {
                wsfDrop: 'Losers Round 2',
                consolidate1: 'Losers Semi-Final',
                wfDrop: 'Losers Final'
            };

        if (effW === 4 && isFinalWLoserDirectQual) {
            return { winnersRounds, losersRounds };
        }
        if (effW === 4) {
            if (targetLosersBracketQuals === 2) return { winnersRounds, losersRounds };
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        if (effW === 2 && isFinalWLoserDirectQual) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (effW === 2 && targetLosersBracketQuals === 2) {
            return { winnersRounds, losersRounds };
        }
        if (effW === 1 && isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) {
                return { winnersRounds, losersRounds };
            }
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if (effW === 2 && targetLosersBracketQuals === 1) {
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wfDrop);
        return { winnersRounds, losersRounds };
    } else {
        losersRounds = ['Losers Round 1'];
        if (effW >= 2 && isFinalWLoserDirectQual) {
            return { winnersRounds, losersRounds };
        }
        if (effW >= 2) {
            losersRounds.push('Losers Semi-Final');
            return { winnersRounds, losersRounds };
        }
        if (isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) {
                return { winnersRounds, losersRounds };
            }
            losersRounds.push('Losers Semi-Final');
            return { winnersRounds, losersRounds };
        }
        losersRounds.push('Losers Semi-Final', 'Losers Final');
        return { winnersRounds, losersRounds };
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

// === 推奨印刷設定の厳密ルール（6〜12人：A4横向き / 13〜24人：A3横向き / 25〜40人：A3縦向き） ===
function getRecommendedPrintSettings(playerCount, elimFormat) {
    const isSingle = elimFormat === 'single';
    const formatLabel = isSingle ? 'シングルエリミ' : 'ダブルエリミ';
    const n = playerCount || 24;

    if (n <= 12) {
        return { size: 'A4', orientation: 'landscape', margin: 'standard', reason: `${n}人 ${formatLabel}の推奨設定` };
    } else if (n <= 24) {
        return { size: 'A3', orientation: 'landscape', margin: 'standard', reason: `${n}人 ${formatLabel}の推奨設定` };
    } else {
        return { size: 'A3', orientation: 'portrait', margin: 'standard', reason: `${n}人 ${formatLabel}の推奨設定` };
    }
}

function updateRecommendedPrintUI(autoApply = true) {
    const targetCount = getEffectivePlayerCountForPool();
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
    sel.addEventListener('change', checkIfPrintSettingsMatchRecommendation);
});

function updateTargetPhaseInputState() {
    const isGf = isGrandFinalModeSelected();
    if (isGf) {
        targetPhaseInput.disabled = true;
        targetPhaseInput.placeholder = '※Grand Final完結のため入力不要';
        targetPhaseInput.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        targetPhaseInput.classList.remove('bg-white');
    } else {
        targetPhaseInput.disabled = false;
        targetPhaseInput.placeholder = '例: Day2 / TOP192';
        targetPhaseInput.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        targetPhaseInput.classList.add('bg-white');
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
    const isTargetPhaseFilled = isGf ? true : (targetPhaseInput.value.trim() !== '');

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
        generateBtn.className = "shrink-0 bg-[#DB2777] text-white px-4 py-2 rounded shadow hover:bg-pink-700 transition font-bold text-sm cursor-pointer";
        hideInlineMessage(exportErrorMsg);
    } else {
        generateBtn.disabled = true;
        generateBtn.className = "shrink-0 bg-gray-300 text-gray-500 px-4 py-2 rounded shadow transition font-bold text-sm cursor-not-allowed";
    }
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

// === プールデータの検証とUI反映（6〜40名対応・5名以下および41名以上は確実にブロック） ===
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
        if (count < 6 || count > 40) {
            isCsvValid = false;
            poolSelectWrapper.classList.add('hidden');
            showInlineError(targetStatusEl, `Pool "${pName}" の参加人数が ${count} 名です。\n1プールあたり6名〜40名のデータのみ対応しています。`);
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
    updateGenerateButtonState();
}

// === 手順1-A: CSVファイルの読み込み（M列: 名簿用GamerTag / N列: ブラケット用Short GamerTag） ===
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
        },
        error: function() {
            showInlineError(csvStatus, 'CSVファイルの読み込みに失敗しました。');
        }
    });
});

// === 手順1-B: start.gg GraphQL APIによるデータ取得（40名対応・1000オブジェクト制限回避） ===
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

    const CHUNK_SIZE = 2;
    for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
        const chunk = groups.slice(i, i + CHUNK_SIZE);
        showInlineInfo(apiStatus, `⏳ プールデータを取得しています... (${Math.min(i + CHUNK_SIZE, groups.length)} / ${groups.length} Pool)`);

        const aliasQueries = chunk.map((g, idx) => `
            g${idx}: phaseGroup(id: ${Number(g.id)}) {
                id
                sets(page: 1, perPage: 84, sortType: STANDARD) {
                    nodes {
                        id
                        identifier
                        round
                        displayScore
                        winnerId
                        stream {
                            streamName
                        }
                        slots {
                            entrant {
                                id
                            }
                        }
                    }
                }
                seeds(query: { page: 1, perPage: 48 }) {
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
        `).join('\n');

        const batchQuery = `query PhaseGroupBatchQuery {\n${aliasQueries}\n}`;

        const response = await fetch('https://api.start.gg/gql/alpha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query: batchQuery })
        });

        const json = await response.json();
        if (!response.ok || json.errors) {
            const errMsg = json.errors ? json.errors.map(e => e.message).join(', ') : `HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        chunk.forEach((g, idx) => {
            const detailData = json.data?.[`g${idx}`];
            if (detailData) {
                g.sets = detailData.sets || { nodes: [] };
                g.seeds = detailData.seeds || { nodes: [] };
            } else {
                g.sets = { nodes: [] };
                g.seeds = { nodes: [] };
            }
            g._detailsLoaded = true;
        });
    }
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
    const bType = phaseObj.bracketType || groups[0]?.bracketType || '';
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

    if ((isFinalPhase && totalGroupsCount === 1) || (perPoolAdvance === 0 && isFinalPhase)) {
        winnersAdvanceCount.value = '0';
        if (elimFormatSelect.value !== 'single') {
            losersAdvanceCount.value = '0';
        }
        targetPhaseInput.value = '';
        autoMessages.push('通過人数: W0 / L0 (Grand Final完結)');
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

    if (presetSelect && presetSelect.value && BUILTIN_BP_PROFILES[presetSelect.value]) {
        applyBpProfileObject(BUILTIN_BP_PROFILES[presetSelect.value], true);
    }

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

    localStorage.setItem('bracket_printer_startgg_token', token);

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
        isCsvValid = false;
        showInlineError(apiStatus, `API取得失敗: ${err.message}`);
        updateGenerateButtonState();
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

function getBoStringForRound(side, roundName, playerCountForPool = null) {
    let bo = baseBoValue || '5';
    const isChangeMode = document.querySelector('input[name="change-mode"]:checked').value === 'yes';

    if (isChangeMode) {
        const pCount = playerCountForPool || getCurrentPoolPlayerCount();
        const isSingle = elimFormatSelect.value === 'single';
        const wCountNum = winnersAdvanceCount.value !== '' ? Number(winnersAdvanceCount.value) : 1;
        const lCountNum = isSingle ? 0 : (losersAdvanceCount.value !== '' ? Number(losersAdvanceCount.value) : 2);
        const { winnersRounds, losersRounds } = computeActiveRounds(pCount, isSingle, wCountNum, lCountNum);

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
            let targetRound = losersRoundSelect.value;
            if (targetRound !== 'none') {
                let startIndex = losersRounds.indexOf(targetRound);
                if (startIndex === -1 && targetRound === 'Losers Round 5' && losersRounds.includes('Losers Round 4')) {
                    startIndex = losersRounds.indexOf('Losers Round 4');
                }
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

// === テキストボックス内の部分選択範囲のフォントサイズを変更するヘルパー ===
function applyFontSizeToSelectionRange(contentEl, savedRange, pxSize) {
    if (!savedRange || savedRange.collapsed || !contentEl.contains(savedRange.commonAncestorContainer)) {
        return false;
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    const span = document.createElement('span');
    span.style.fontSize = `${pxSize}px`;

    const fragment = savedRange.extractContents();
    // 選択範囲内部の既存fontSize指定を解除して新しいサイズに統一
    fragment.querySelectorAll('*').forEach(el => {
        if (el.style && el.style.fontSize) {
            el.style.fontSize = '';
        }
    });
    span.appendChild(fragment);
    savedRange.insertNode(span);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return newRange.cloneRange();
}

// === 描画オプション2: 高機能ドラッグ可能テキストボックス（ドラッグやShift+矢印での部分選択装飾・サイズ変更対応） ===
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
    boldBtn.title = '太字（部分選択時は選択文字のみ）';
    boldBtn.className = `text-tool-btn font-bold ${isBoldInit ? 'active' : ''}`;

    const italicBtn = document.createElement('button');
    italicBtn.type = 'button';
    italicBtn.textContent = 'I';
    italicBtn.title = '斜体（部分選択時は選択文字のみ）';
    italicBtn.className = `text-tool-btn italic font-serif ${isItalicInit ? 'active' : ''}`;

    const underlineBtn = document.createElement('button');
    underlineBtn.type = 'button';
    underlineBtn.textContent = 'U';
    underlineBtn.title = '下線（部分選択時は選択文字のみ）';
    underlineBtn.className = `text-tool-btn underline ${isUnderlineInit ? 'active' : ''}`;

    const sizeWrapper = document.createElement('div');
    sizeWrapper.className = 'flex items-center gap-0.5 ml-0.5';
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.min = '8';
    sizeInput.max = '120';
    sizeInput.step = '1';
    sizeInput.value = String(numericFontSize);
    sizeInput.title = 'フォントサイズ (px) ※文字を選択して変更すると選択部分のみ変わります';
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

    // テキストボックス内の選択範囲（ドラッグ選択 / Shift+矢印キー選択）を常に記憶
    let savedSelectionRange = null;

    const saveCurrentSelectionIfInside = () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0);
        if (content.contains(r.commonAncestorContainer)) {
            savedSelectionRange = r.cloneRange();
            // 選択箇所のフォントサイズ・装飾状態をツールバーに同期
            const anchorEl = r.startContainer.nodeType === Node.TEXT_NODE
                ? r.startContainer.parentElement
                : r.startContainer;
            if (anchorEl && content.contains(anchorEl) && document.activeElement !== sizeInput) {
                const comp = window.getComputedStyle(anchorEl);
                const px = Math.round(parseFloat(comp.fontSize) || numericFontSize);
                sizeInput.value = String(px);
                const weightNum = parseInt(comp.fontWeight, 10) || 400;
                boldBtn.classList.toggle('active', weightNum >= 600 || comp.fontWeight === 'bold');
                italicBtn.classList.toggle('active', comp.fontStyle === 'italic');
                underlineBtn.classList.toggle('active', (comp.textDecorationLine || comp.textDecoration || '').includes('underline'));
            }
        }
    };

    content.addEventListener('mouseup', saveCurrentSelectionIfInside);
    content.addEventListener('keyup', saveCurrentSelectionIfInside);
    content.addEventListener('focus', saveCurrentSelectionIfInside);

    const hasActiveNonCollapsedRange = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            if (!r.collapsed && content.contains(r.commonAncestorContainer)) {
                savedSelectionRange = r.cloneRange();
                return true;
            }
        }
        return Boolean(savedSelectionRange && !savedSelectionRange.collapsed && content.contains(savedSelectionRange.commonAncestorContainer));
    };

    // ボタンを押した瞬間に選択範囲が消えないよう mousedown で preventDefault
    [boldBtn, italicBtn, underlineBtn, alignLeftBtn, alignCenterBtn, alignRightBtn].forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    boldBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasActiveNonCollapsedRange()) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
            // ボックス全体が太字設定の場合は一旦解除して部分切り替え可能にする
            if (content.style.fontWeight === '700' || content.style.fontWeight === 'bold') {
                const fullRange = document.createRange();
                fullRange.selectNodeContents(content);
                content.style.fontWeight = '400';
                const bWrap = document.createElement('b');
                bWrap.appendChild(fullRange.extractContents());
                content.appendChild(bWrap);
            }
            document.execCommand('bold', false, null);
            saveCurrentSelectionIfInside();
        } else {
            const isCurrentlyBold = content.style.fontWeight === '700' || content.style.fontWeight === 'bold';
            content.style.fontWeight = isCurrentlyBold ? '400' : '700';
            content.querySelectorAll('b, strong').forEach(el => {
                el.style.fontWeight = isCurrentlyBold ? '400' : '700';
            });
            boldBtn.classList.toggle('active', !isCurrentlyBold);
        }
    });

    italicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasActiveNonCollapsedRange()) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
            document.execCommand('italic', false, null);
            saveCurrentSelectionIfInside();
        } else {
            const isCurrentlyItalic = content.style.fontStyle === 'italic';
            content.style.fontStyle = isCurrentlyItalic ? 'normal' : 'italic';
            italicBtn.classList.toggle('active', !isCurrentlyItalic);
        }
    });

    underlineBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hasActiveNonCollapsedRange()) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
            document.execCommand('underline', false, null);
            saveCurrentSelectionIfInside();
        } else {
            const isCurrentlyUnderline = (content.style.textDecoration || '').includes('underline');
            content.style.textDecoration = isCurrentlyUnderline ? 'none' : 'underline';
            underlineBtn.classList.toggle('active', !isCurrentlyUnderline);
        }
    });

    // フォントサイズ入力（部分選択がある場合は選択文字のみ、未選択時はボックス全体に適用）
    sizeInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        saveCurrentSelectionIfInside();
    });

    const applyFontSize = () => {
        let val = parseInt(sizeInput.value, 10);
        if (isNaN(val)) return;
        val = Math.max(8, Math.min(120, val));

        if (savedSelectionRange && !savedSelectionRange.collapsed && content.contains(savedSelectionRange.commonAncestorContainer)) {
            const updatedRange = applyFontSizeToSelectionRange(content, savedSelectionRange, val);
            if (updatedRange) {
                savedSelectionRange = updatedRange;
            }
        } else {
            content.style.fontSize = `${val}px`;
            content.querySelectorAll('span').forEach(sp => {
                if (sp.style && sp.style.fontSize) sp.style.fontSize = `${val}px`;
            });
        }
    };

    sizeInput.addEventListener('input', applyFontSize);
    sizeInput.addEventListener('change', () => {
        let val = parseInt(sizeInput.value, 10);
        if (isNaN(val)) val = 18;
        val = Math.max(8, Math.min(120, val));
        sizeInput.value = String(val);
        applyFontSize();
    });

    const updateAlignment = (newAlign) => {
        content.style.textAlign = newAlign;
        alignLeftBtn.classList.toggle('active', newAlign === 'left');
        alignCenterBtn.classList.toggle('active', newAlign === 'center');
        alignRightBtn.classList.toggle('active', newAlign === 'right');
    };
    alignLeftBtn.addEventListener('click', (e) => { e.stopPropagation(); updateAlignment('left'); });
    alignCenterBtn.addEventListener('click', (e) => { e.stopPropagation(); updateAlignment('center'); });
    alignRightBtn.addEventListener('click', (e) => { e.stopPropagation(); updateAlignment('right'); });

    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        box.remove();
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
        isDragging = false;
    });

    box.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        if (hasMovedDuringDrag) {
            hasMovedDuringDrag = false;
            return;
        }
        // 文字を範囲選択した直後のクリックでは前後入れ替えを発火させない
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
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
    } else {
        pendingTextBoxesCount++;
        showInlineInfo(textBoxStatus, `テキストボックスを追加予約しました（現在 ${pendingTextBoxesCount} 個）。\n「ブラケットを描画する」を押すと配置されます。`);
    }
});

// === プレビュー画面のドラッグによる視点移動（パン操作） ===
if (viewport) {
    let isPanningViewport = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartScrollLeft = 0;
    let panStartScrollTop = 0;

    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        // 対戦カードやテキストボックス、入力要素の上ではパン操作を開始しない
        if (e.target.closest('.match-box') || e.target.closest('.draggable-text-box') || e.target.closest('button') || e.target.closest('input')) {
            return;
        }
        isPanningViewport = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartScrollLeft = viewport.scrollLeft;
        panStartScrollTop = viewport.scrollTop;
        viewport.classList.add('is-panning');
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanningViewport) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        viewport.scrollLeft = panStartScrollLeft - dx;
        viewport.scrollTop = panStartScrollTop - dy;
    });

    window.addEventListener('mouseup', () => {
        if (isPanningViewport) {
            isPanningViewport = false;
            viewport.classList.remove('is-panning');
        }
    });
}

// === 対戦カード個別編集モーダル（DQ書き込み ＆ 配信台チャンネル名設定） ===
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
    if (!document.getElementById('main-sheet-body').classList.contains('hidden')) {
        generateBtn.click();
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
        if (!document.getElementById('main-sheet-body').classList.contains('hidden')) {
            generateBtn.click();
        }
    });
}

// === 印刷オプション＆描画オプションの反映関数 ===
function applyPrintAndDrawOptions() {
    const size = printSizeSelect.value;
    const orientation = printOrientationSelect.value;
    const marginType = printMarginSelect.value;

    const marginMapMm = { standard: 8, wide: 14, narrow: 4 };
    const marginMm = marginMapMm[marginType] ?? 8;

    const pad = { v: 8, h: 10 };
    previewArea.style.padding = `${pad.v}px ${pad.h}px`;

    logoDisplayContainer.style.bottom = `${pad.v}px`;
    logoDisplayContainer.style.right = `${pad.h}px`;

    const paperDimensionsMm = {
        A3: { long: 420, short: 297 },
        B4: { long: 364, short: 257 },
        A4: { long: 297, short: 210 },
        B5: { long: 257, short: 182 },
        A5: { long: 210, short: 148 }
    };
    const dim = paperDimensionsMm[size] || paperDimensionsMm.A3;
    const pageW_mm = orientation === 'landscape' ? dim.long : dim.short;
    const pageH_mm = orientation === 'landscape' ? dim.short : dim.long;

    const printableW_px = Math.max(100, (pageW_mm - marginMm * 2) * (96 / 25.4) - 2);
    const printableH_px = Math.max(100, (pageH_mm - marginMm * 2) * (96 / 25.4) - 2);

    const prevTransform = scaleWrapper.style.transform;
    scaleWrapper.style.transform = 'none';

    const actualCanvasW = previewArea.offsetWidth || 2362;
    const actualCanvasH = previewArea.offsetHeight || 1670;

    scaleWrapper.style.transform = prevTransform;

    const scaleX = printableW_px / actualCanvasW;
    const scaleY = printableH_px / actualCanvasH;
    const printScale = Math.min(scaleX, scaleY) * 0.996;

    const scaledBoxWidth = Math.floor(actualCanvasW * printScale);
    const scaledBoxHeight = Math.floor(actualCanvasH * printScale);

    lastComputedPrintMetrics = {
        canvasWidth: actualCanvasW,
        canvasHeight: actualCanvasH,
        printScale,
        scaledBoxWidth,
        scaledBoxHeight
    };

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

// === HTML要素生成ヘルパー ===
function createElement(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

// === 予選抜け（進出先フェーズ）専用ノード生成 ===
function createSingleQualifierBox(topLabelText, bottomPhaseText) {
    const box = createElement('div', 'qualifier-box');
    box.appendChild(createElement('span', 'qual-drop-label-top', topLabelText));
    const slot = createElement('div', 'qualifier-slot', '');
    box.appendChild(slot);

    const len = bottomPhaseText.length;
    let fontSizePx = 11.5;
    if (len > 26) fontSizePx = 9.5;
    else if (len > 20) fontSizePx = 10.5;

    const bottomLbl = createElement('span', 'qual-drop-label-bottom', bottomPhaseText);
    bottomLbl.style.fontSize = `${fontSizePx}px`;
    box.appendChild(bottomLbl);
    return box;
}

function createQualifierNode(matchSourceLabel, targetPhase, targetType = 'W') {
    const fullTextW = `${targetPhase} [W]`;
    const fullTextL = `${targetPhase} [L]`;

    if (targetType === 'W') {
        const wrapper = createElement('div', 'match-wrapper qualifier-branch-group');
        const topBox = createSingleQualifierBox(`Winner of ${matchSourceLabel}`, fullTextW);
        const botBox = createSingleQualifierBox(`Loser of ${matchSourceLabel}`, fullTextL);
        wrapper.append(topBox, botBox);
        return wrapper;
    } else if (targetType === 'W_ONLY') {
        const wrapper = createElement('div', 'match-wrapper qualifier-line');
        wrapper.appendChild(createSingleQualifierBox(`Winner of ${matchSourceLabel}`, fullTextW));
        return wrapper;
    } else {
        const wrapper = createElement('div', 'match-wrapper qualifier-line');
        wrapper.appendChild(createSingleQualifierBox(`Winner of ${matchSourceLabel}`, fullTextL));
        return wrapper;
    }
}

function createRoundColumn(roundName, isQualifier = false) {
    const roundCol = createElement('div', isQualifier ? 'round-col qualifier-col' : 'round-col');
    const header = createElement('div', 'round-header', roundName || '\u00A0');
    if (!roundName) header.style.visibility = 'hidden';
    roundCol.appendChild(header);
    return roundCol;
}

// === Check-in / Gamer Tag 名簿テーブル生成 ===
function renderCheckinRosterToContainer(rosterList, targetContainer) {
    targetContainer.innerHTML = '';
    if (!rosterList || rosterList.length === 0) return;

    const sortedRoster = [...rosterList].sort((a, b) => a.seed - b.seed);

    const table = createElement('table', 'checkin-table');
    const thead = createElement('thead');
    const headerRow = createElement('tr');
    headerRow.appendChild(createElement('th', '', 'Check-in'));
    headerRow.appendChild(createElement('th', '', 'Gamer Tag'));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createElement('tbody');
    sortedRoster.forEach(item => {
        const tr = createElement('tr');
        const tdCheck = createElement('td');
        const checkInner = createElement('div', 'checkin-cell-inner');
        checkInner.appendChild(createElement('div', 'checkbox-square'));
        tdCheck.appendChild(checkInner);

        const tdTag = createElement('td');
        const tagSpan = createElement('span', 'gamertag-cell-text', item.fullGamerTag);
        tdTag.appendChild(tagSpan);

        tr.appendChild(tdCheck);
        tr.appendChild(tdTag);
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    targetContainer.appendChild(table);
}

// === ズーム（表示倍率）制御ロジック ===
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
    requestAnimationFrame(fitToViewport);
});

function indexToMatchLabel(idx) {
    let n = idx;
    let label = '';
    while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    }
    return label;
}

// === 特定のPoolのブラケットDOM一式を構築するコア関数（6〜40名 ダブル＆シングル完全対応） ===
function buildBracketSheetContent(poolName, bracketContainerEl, rosterContainerEl, targetSheetEl = previewArea, overrideOrientation = null) {
    const currentPool = poolsData[poolName];
    if (!currentPool) return { canvasWidth: 2362, canvasHeight: 1670, boxHeightPx: 48 };

    const pMap = currentPool.playersByPoolSeed;
    const playerCount = currentPool.count;
    const targetPhaseName = targetPhaseInput.value.trim();

    const isSingle = elimFormatSelect.value === 'single';
    const wCountNum = Number(winnersAdvanceCount.value);
    const lCountNum = isSingle ? 0 : Number(losersAdvanceCount.value);
    const isGfMode = (!isSingle && wCountNum === 0 && lCountNum === 0) || (isSingle && wCountNum === 0);

    const effW = isGfMode ? 1 : Math.max(1, wCountNum);
    const effL = isGfMode ? 1 : Math.max(1, lCountNum);

    let currentMatchIdx = 0;
    const nextMatchLabel = () => indexToMatchLabel(currentMatchIdx++);

    const wContainer = createElement('div', 'bracket-container');
    const lContainer = createElement('div', 'bracket-container');

    const matchRecordsByLabel = {};

    const createInteractiveMatchNode = (matchLabel, player1Name, player2Name, seed1 = '', seed2 = '', lineType = 'none', topLabel = '', bottomLabel = '', side = 'W') => {
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
        const p1NameSpan = createElement('span', 'player-name-text', player1Name);
        p1Slot.appendChild(p1NameSpan);
        if (seed1) p1Slot.appendChild(createElement('span', 'seed-label', seed1));
        playersArea.appendChild(p1Slot);
        
        const p2Slot = createElement('div', 'player-slot');
        const p2NameSpan = createElement('span', 'player-name-text', player2Name);
        p2Slot.appendChild(p2NameSpan);
        if (seed2) p2Slot.appendChild(createElement('span', 'seed-label', seed2));
        playersArea.appendChild(p2Slot);

        mainBoxArea.appendChild(playersArea);

        const scoreArea = createElement('div', 'score-box-area');
        const score1El = createElement('div', 'score-box');
        const score2El = createElement('div', 'score-box');
        scoreArea.appendChild(score1El);
        scoreArea.appendChild(score2El);
        mainBoxArea.appendChild(scoreArea);

        matchBox.appendChild(mainBoxArea);
        wrapper.appendChild(matchBox);

        matchRecordsByLabel[matchLabel] = {
            matchLabel,
            side,
            wrapper,
            matchBox,
            p1NameSpan,
            p2NameSpan,
            score1El,
            score2El,
            topLabel,
            bottomLabel,
            seed1Num: seed1 ? Number(seed1) : null,
            seed2Num: seed2 ? Number(seed2) : null
        };

        return wrapper;
    };

    let winnersSlots = 8;
    let losersSlots = 4;
    let wSlotUnit = SLOT_HEIGHT_24;
    let lSlotUnit = SLOT_HEIGHT_24;

    if (playerCount >= 25) {
        winnersSlots = 16;
        losersSlots = 8;
        wSlotUnit = WINNERS_SLOT_HEIGHT_32;
        lSlotUnit = LOSERS_SLOT_HEIGHT_32;
    } else if (playerCount >= 17) {
        winnersSlots = 8;
        losersSlots = 8;
    } else if (playerCount >= 9) {
        winnersSlots = 4;
        losersSlots = 4;
    } else {
        winnersSlots = 2;
        losersSlots = 2;
    }

    const isFinalWLoserDirectQual = (!isSingle && effL >= 2 * effW);
    const targetLosersBracketQuals = isFinalWLoserDirectQual ? Math.max(1, effL - effW) : effL;

    const appendLosersQualifiersColumn = (sourceLabels) => {
        const lQual = createRoundColumn('', true);
        sourceLabels.forEach(src => {
            lQual.appendChild(createQualifierNode(src, targetPhaseName, 'L'));
        });
        lContainer.appendChild(lQual);
    };

    const appendWinnersStopQualifiers = (matchLabels) => {
        const wQualType = isSingle ? 'W_ONLY' : (isFinalWLoserDirectQual ? 'W' : 'W_ONLY');
        const wQual = createRoundColumn('', true);
        matchLabels.forEach(lbl => {
            wQual.appendChild(createQualifierNode(lbl, targetPhaseName, wQualType));
        });
        wContainer.appendChild(wQual);
    };

    let wfMatchLabelForGf = '';
    let lfMatchLabelForGf = '';

    // =========================================================
    // パターンS: 33〜40人規模（Winners Round 1〜3 / Losers Round 1〜6）
    // =========================================================
    if (playerCount >= 33) {
        const wr1_40Slots = [
            { s1: 32, s2: 33 }, { s1: 25, s2: 40 }, { s1: 29, s2: 36 }, { s1: 28, s2: 37 },
            { s1: 31, s2: 34 }, { s1: 26, s2: 39 }, { s1: 30, s2: 35 }, { s1: 27, s2: 38 }
        ];
        const wr2_40TopSeeds = [1, 8, 4, 5, 2, 7, 3, 6];
        const wr2_40BotPairs = [
            { s1: 16, s2: 17 }, { s1: 9,  s2: 24 }, { s1: 13, s2: 20 }, { s1: 12, s2: 21 },
            { s1: 15, s2: 18 }, { s1: 10, s2: 23 }, { s1: 14, s2: 19 }, { s1: 11, s2: 22 }
        ];

        const wr1 = createRoundColumn(`Winners Round 1 ${getBoStringForRound('W', 'Winners Round 1', playerCount)}`);
        const wr1ActiveLabels = new Array(8).fill(null);

        wr1_40Slots.forEach((slot, i) => {
            const pairGroup = createElement('div', 'pair-group');
            if (playerCount >= slot.s2) {
                const lbl = nextMatchLabel();
                wr1ActiveLabels[i] = lbl;
                pairGroup.appendChild(createInteractiveMatchNode(lbl, pMap[slot.s1] || '', pMap[slot.s2] || '', String(slot.s1), String(slot.s2), 'none', '', '', 'W'));
            } else {
                const topSpacer = createElement('div', 'match-wrapper');
                topSpacer.appendChild(createElement('div', 'dummy-spacer-box'));
                pairGroup.appendChild(topSpacer);
            }
            const botSpacer = createElement('div', 'match-wrapper');
            botSpacer.appendChild(createElement('div', 'dummy-spacer-box'));
            pairGroup.appendChild(botSpacer);
            wr1.appendChild(pairGroup);
        });

        const wr2 = createRoundColumn(`Winners Round 2 ${getBoStringForRound('W', 'Winners Round 2', playerCount)}`);
        const wr2TopLabels = new Array(8).fill(null);
        const wr2BotLabels = new Array(8).fill(null);

        for (let i = 0; i < 8; i++) {
            const pairGroup = createElement('div', 'pair-group');
            const topSeed = wr2_40TopSeeds[i];
            const wr1Slot = wr1_40Slots[i];
            const botPair = wr2_40BotPairs[i];

            const lblTop = nextMatchLabel();
            wr2TopLabels[i] = lblTop;
            if (wr1ActiveLabels[i] !== null) {
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblTop, pMap[topSeed] || '', '', String(topSeed), '', 'straight', '', '', 'W')
                );
            } else {
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblTop, pMap[topSeed] || '', pMap[wr1Slot.s1] || '', String(topSeed), String(wr1Slot.s1), 'none', '', '', 'W')
                );
            }

            const lblBot = nextMatchLabel();
            wr2BotLabels[i] = lblBot;
            pairGroup.appendChild(
                createInteractiveMatchNode(lblBot, pMap[botPair.s1] || '', pMap[botPair.s2] || '', String(botPair.s1), String(botPair.s2), 'none', '', '', 'W')
            );

            wr2.appendChild(pairGroup);
        }

        const wr3 = createRoundColumn(`Winners Round 3 ${getBoStringForRound('W', 'Winners Round 3', playerCount)}`);
        const wr3Labels = [0, 1, 2, 3, 4, 5, 6, 7].map(() => nextMatchLabel());
        wr3Labels.forEach(l => wr3.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));

        const wqf = createRoundColumn(`Winners Quarter-Final ${getBoStringForRound('W', 'Winners Quarter-Final', playerCount)}`);
        const wqfLabels = [0, 1, 2, 3].map(() => nextMatchLabel());
        wqfLabels.forEach(l => wqf.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));

        wContainer.append(wr1, wr2, wr3, wqf);

        let wsfLabels = [];
        let wfLabel = '';

        if (effW === 4) {
            appendWinnersStopQualifiers(wqfLabels);
            currentMatchIdx += 5;
        } else {
            const wsf = createRoundColumn(`Winners Semi-Final ${getBoStringForRound('W', 'Winners Semi-Final', playerCount)}`);
            wsfLabels = [0, 1].map(() => nextMatchLabel());
            wsfLabels.forEach(l => wsf.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));
            wContainer.appendChild(wsf);

            if (effW === 2) {
                appendWinnersStopQualifiers(wsfLabels);
                currentMatchIdx += 3;
            } else {
                const wf = createRoundColumn(`Winners Final ${getBoStringForRound('W', 'Winners Final', playerCount)}`);
                wfLabel = nextMatchLabel();
                wfMatchLabelForGf = wfLabel;
                wf.appendChild(createInteractiveMatchNode(wfLabel, '', '', '', '', 'branch', '', '', 'W'));
                wContainer.appendChild(wf);

                if (!isGfMode) {
                    appendWinnersStopQualifiers([wfLabel]);
                }
                currentMatchIdx += 2;
            }
        }

        // 33〜40人規模 Losers Bracket
        if (!isSingle && (isGfMode || lCountNum > 0)) {
            const lr1 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
            const lr2 = createRoundColumn(`Losers Round 2 ${getBoStringForRound('L', 'Losers Round 2', playerCount)}`);
            const lr3 = createRoundColumn(`Losers Round 3 ${getBoStringForRound('L', 'Losers Round 3', playerCount)}`);
            const lr4 = createRoundColumn(`Losers Round 4 ${getBoStringForRound('L', 'Losers Round 4', playerCount)}`);

            const lr1Active40 = new Array(8).fill(null);
            for (let i = 0; i < 8; i++) {
                if (wr1ActiveLabels[i] !== null) {
                    const lbl = nextMatchLabel();
                    lr1Active40[i] = lbl;
                    const wr2BotLoser = wr2BotLabels[7 - i];
                    const wr1Loser = wr1ActiveLabels[i];
                    lr1.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2BotLoser}`, `Loser of ${wr1Loser}`, 'L'));
                } else {
                    const wrapper = createElement('div', 'match-wrapper');
                    wrapper.appendChild(createElement('div', 'dummy-spacer-box'));
                    lr1.appendChild(wrapper);
                }
            }

            const lr2Labels = [];
            for (let i = 0; i < 8; i++) {
                const lbl = nextMatchLabel();
                lr2Labels.push(lbl);
                const wr2TopLoser = wr2TopLabels[7 - i];
                const wr2BotLoser = wr2BotLabels[7 - i];
                if (lr1Active40[i] !== null) {
                    lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'straight', '', `Loser of ${wr2TopLoser}`, 'L'));
                } else {
                    lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2BotLoser}`, `Loser of ${wr2TopLoser}`, 'L'));
                }
            }

            const wr3DropOrder = [
                wr3Labels[3], wr3Labels[2], wr3Labels[1], wr3Labels[0],
                wr3Labels[7], wr3Labels[6], wr3Labels[5], wr3Labels[4]
            ];
            const lr3Labels = [0, 1, 2, 3, 4, 5, 6, 7].map(() => nextMatchLabel());
            lr3Labels.forEach((l, i) => {
                lr3.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wr3DropOrder[i]}`, '', 'L'));
            });

            const lr4Labels = [0, 1, 2, 3].map(() => nextMatchLabel());
            lr4Labels.forEach(l => lr4.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'L')));

            lContainer.append(lr1, lr2, lr3, lr4);

            const wqfDropCol = () => createRoundColumn(`Losers Round 5 ${getBoStringForRound('L', 'Losers Round 5', playerCount)}`);
            const consolidate2Col = () => createRoundColumn(`Losers Round 6 ${getBoStringForRound('L', 'Losers Round 6', playerCount)}`);
            const wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
            const consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
            const wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);

            if (effW === 4 && isFinalWLoserDirectQual) {
                appendLosersQualifiersColumn(lr4Labels);
            } else {
                const colWqfDrop = wqfDropCol();
                const wqfDropOrder40 = [wqfLabels[2], wqfLabels[3], wqfLabels[0], wqfLabels[1]];
                const afterWqfDropLabels = [0, 1, 2, 3].map(() => nextMatchLabel());
                afterWqfDropLabels.forEach((l, i) => {
                    colWqfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wqfDropOrder40[i]}`, '', 'L'));
                });
                lContainer.appendChild(colWqfDrop);

                if (targetLosersBracketQuals >= 4) {
                    appendLosersQualifiersColumn(afterWqfDropLabels);
                } else {
                    const colCons2 = consolidate2Col();
                    const cons2Labels = [0, 1].map(() => nextMatchLabel());
                    cons2Labels.forEach(l => colCons2.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'L')));
                    lContainer.appendChild(colCons2);

                    if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) {
                        appendLosersQualifiersColumn(cons2Labels);
                    } else if (effW === 4 && targetLosersBracketQuals === 1) {
                        const colCons1 = consolidate1Col();
                        const cons1Lbl = nextMatchLabel();
                        colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                        lContainer.appendChild(colCons1);
                        appendLosersQualifiersColumn([cons1Lbl]);
                    } else {
                        const colWsfDrop = wsfDropCol();
                        const wsfDropOrder40 = [wsfLabels[0], wsfLabels[1]];
                        const afterWsfDropLabels = [0, 1].map(() => nextMatchLabel());
                        afterWsfDropLabels.forEach((l, i) => {
                            colWsfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wsfDropOrder40[i]}`, '', 'L'));
                        });
                        lContainer.appendChild(colWsfDrop);

                        if (effW === 2 && targetLosersBracketQuals === 2) {
                            appendLosersQualifiersColumn(afterWsfDropLabels);
                        } else if (effW === 1 && isFinalWLoserDirectQual) {
                            if (targetLosersBracketQuals >= 2) {
                                appendLosersQualifiersColumn(afterWsfDropLabels);
                            } else {
                                const colCons1 = consolidate1Col();
                                const cons1Lbl = nextMatchLabel();
                                colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                                lContainer.appendChild(colCons1);
                                appendLosersQualifiersColumn([cons1Lbl]);
                            }
                        } else {
                            const colCons1 = consolidate1Col();
                            const cons1Lbl = nextMatchLabel();
                            colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                            lContainer.appendChild(colCons1);

                            if (effW === 2 && targetLosersBracketQuals === 1) {
                                appendLosersQualifiersColumn([cons1Lbl]);
                            } else {
                                const colWfDrop = wfDropCol();
                                const lfLbl = nextMatchLabel();
                                lfMatchLabelForGf = lfLbl;
                                colWfDrop.appendChild(createInteractiveMatchNode(lfLbl, '', '', '', '', 'straight', `Loser of ${wfLabel}`, '', 'L'));
                                lContainer.appendChild(colWfDrop);
                                if (!isGfMode) {
                                    appendLosersQualifiersColumn([lfLbl]);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // =========================================================
    // パターンA: 17〜32人規模
    // =========================================================
    else if (playerCount >= 17) {
        const wr1Slots = [
            { s1: 16, s2: 17 }, { s1: 9,  s2: 24 }, { s1: 13, s2: 20 }, { s1: 12, s2: 21 },
            { s1: 15, s2: 18 }, { s1: 10, s2: 23 }, { s1: 14, s2: 19 }, { s1: 11, s2: 22 }
        ];
        const wr2Slots = [
            { topSeed: 1,  pair: [16, 17] },
            { topSeed: 8,  pair: [9,  24] },
            { topSeed: 4,  pair: [13, 20] },
            { topSeed: 5,  pair: [12, 21] },
            { topSeed: 2,  pair: [15, 18] },
            { topSeed: 7,  pair: [10, 23] },
            { topSeed: 3,  pair: [14, 19] },
            { topSeed: 6,  pair: [11, 22] }
        ];

        const wr1 = createRoundColumn(`Winners Round 1 ${getBoStringForRound('W', 'Winners Round 1', playerCount)}`);
        const wr1ActiveLabels = new Array(8).fill(null);

        wr1Slots.forEach((slot, i) => {
            if (playerCount >= slot.s2) {
                const lbl = nextMatchLabel();
                wr1ActiveLabels[i] = lbl;
                wr1.appendChild(createInteractiveMatchNode(lbl, pMap[slot.s1] || '', pMap[slot.s2] || '', String(slot.s1), String(slot.s2), 'none', '', '', 'W'));
            } else {
                const wrapper = createElement('div', 'match-wrapper');
                wrapper.appendChild(createElement('div', 'dummy-spacer-box'));
                wr1.appendChild(wrapper);
            }
        });

        const wr2 = createRoundColumn(`Winners Round 2 ${getBoStringForRound('W', 'Winners Round 2', playerCount)}`);
        const wr2Labels = [];
        wr2Slots.forEach((slot, i) => {
            const lbl = nextMatchLabel();
            wr2Labels.push(lbl);

            const hasWr1Match = wr1ActiveLabels[i] !== null;
            const p1Name = pMap[slot.topSeed] || '';
            const s1 = String(slot.topSeed);

            let p2Name = '';
            let s2 = '';
            let lineType = 'straight';

            if (!hasWr1Match) {
                if (slot.pair) {
                    const directSeed = slot.pair[0];
                    p2Name = pMap[directSeed] || '';
                    s2 = String(directSeed);
                }
                lineType = 'none';
            }

            wr2.appendChild(createInteractiveMatchNode(lbl, p1Name, p2Name, s1, s2, lineType, '', '', 'W'));
        });

        const wr3 = createRoundColumn(`Winners Quarter-Final ${getBoStringForRound('W', 'Winners Quarter-Final', playerCount)}`);
        const wqfLabels = [0, 1, 2, 3].map(() => nextMatchLabel());
        wqfLabels.forEach(l => wr3.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));

        wContainer.append(wr1, wr2, wr3);

        let wsfLabels = [];
        let wfLabel = '';

        if (effW === 4) {
            appendWinnersStopQualifiers(wqfLabels);
            currentMatchIdx += 5;
        } else {
            const wr4 = createRoundColumn(`Winners Semi-Final ${getBoStringForRound('W', 'Winners Semi-Final', playerCount)}`);
            wsfLabels = [0, 1].map(() => nextMatchLabel());
            wsfLabels.forEach(l => wr4.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));
            wContainer.appendChild(wr4);

            if (effW === 2) {
                appendWinnersStopQualifiers(wsfLabels);
                currentMatchIdx += 3;
            } else {
                const wr5 = createRoundColumn(`Winners Final ${getBoStringForRound('W', 'Winners Final', playerCount)}`);
                wfLabel = nextMatchLabel();
                wfMatchLabelForGf = wfLabel;
                wr5.appendChild(createInteractiveMatchNode(wfLabel, '', '', '', '', 'branch', '', '', 'W'));
                wContainer.appendChild(wr5);

                if (!isGfMode) {
                    appendWinnersStopQualifiers([wfLabel]);
                }
                currentMatchIdx += 2;
            }
        }

        if (playerCount >= 25) {
            const wr1_32Slots = [
                { s1: 16, s2: 17 }, { s1: 9,  s2: 24 }, { s1: 13, s2: 20 }, { s1: 12, s2: 21 },
                { s1: 15, s2: 18 }, { s1: 10, s2: 23 }, { s1: 14, s2: 19 }, { s1: 11, s2: 22 }
            ];
            const wr1_top8Pairs = [
                [1, 32], [8, 25], [4, 29], [5, 28],
                [2, 31], [7, 26], [3, 30], [6, 27]
            ];

            wContainer.innerHTML = '';
            Object.keys(matchRecordsByLabel).forEach(k => delete matchRecordsByLabel[k]);
            currentMatchIdx = 0;

            const wr1_32 = createRoundColumn(`Winners Round 1 ${getBoStringForRound('W', 'Winners Round 1', playerCount)}`);
            const wr2_32 = createRoundColumn(`Winners Round 2 ${getBoStringForRound('W', 'Winners Round 2', playerCount)}`);
            const wr1TopLabels = new Array(8).fill(null);
            const wr1BotLabels = new Array(8).fill(null);

            for (let i = 0; i < 8; i++) {
                const pairGroup = createElement('div', 'pair-group');
                const topPair = wr1_top8Pairs[i];
                const botPair = wr1_32Slots[i];

                if (playerCount >= topPair[1]) {
                    const lblTop = nextMatchLabel();
                    wr1TopLabels[i] = lblTop;
                    pairGroup.appendChild(
                        createInteractiveMatchNode(lblTop, pMap[topPair[0]] || '', pMap[topPair[1]] || '', String(topPair[0]), String(topPair[1]), 'none', '', '', 'W')
                    );
                }

                const lblBot = nextMatchLabel();
                wr1BotLabels[i] = lblBot;
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblBot, pMap[botPair.s1] || '', pMap[botPair.s2] || '', String(botPair.s1), String(botPair.s2), 'none', '', '', 'W')
                );

                wr1_32.appendChild(pairGroup);
            }

            const wr2_32Labels = [];
            for (let i = 0; i < 8; i++) {
                const lbl = nextMatchLabel();
                wr2_32Labels.push(lbl);
                const topPair = wr1_top8Pairs[i];
                const hasTopWr1 = wr1TopLabels[i] !== null;

                if (hasTopWr1) {
                    wr2_32.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'branch', '', '', 'W'));
                } else {
                    wr2_32.appendChild(createInteractiveMatchNode(lbl, pMap[topPair[0]] || '', '', String(topPair[0]), '', 'straight', '', '', 'W'));
                }
            }

            const wr3_32 = createRoundColumn(`Winners Quarter-Final ${getBoStringForRound('W', 'Winners Quarter-Final', playerCount)}`);
            const wqf32Labels = [0, 1, 2, 3].map(() => nextMatchLabel());
            wqf32Labels.forEach(l => wr3_32.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));
            wqfLabels.splice(0, 4, ...wqf32Labels);

            wContainer.append(wr1_32, wr2_32, wr3_32);

            if (effW === 4) {
                appendWinnersStopQualifiers(wqfLabels);
                currentMatchIdx += 5;
            } else {
                const wr4_32 = createRoundColumn(`Winners Semi-Final ${getBoStringForRound('W', 'Winners Semi-Final', playerCount)}`);
                wsfLabels = [0, 1].map(() => nextMatchLabel());
                wsfLabels.forEach(l => wr4_32.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));
                wContainer.appendChild(wr4_32);

                if (effW === 2) {
                    appendWinnersStopQualifiers(wsfLabels);
                    currentMatchIdx += 3;
                } else {
                    const wr5_32 = createRoundColumn(`Winners Final ${getBoStringForRound('W', 'Winners Final', playerCount)}`);
                    wfLabel = nextMatchLabel();
                    wfMatchLabelForGf = wfLabel;
                    wr5_32.appendChild(createInteractiveMatchNode(wfLabel, '', '', '', '', 'branch', '', '', 'W'));
                    wContainer.appendChild(wr5_32);

                    if (!isGfMode) {
                        appendWinnersStopQualifiers([wfLabel]);
                    }
                    currentMatchIdx += 2;
                }
            }

            if (!isSingle && (isGfMode || lCountNum > 0)) {
                const lr1_32 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
                const lr2_32 = createRoundColumn(`Losers Round 2 ${getBoStringForRound('L', 'Losers Round 2', playerCount)}`);
                const lr3_32 = createRoundColumn(`Losers Round 3 ${getBoStringForRound('L', 'Losers Round 3', playerCount)}`);

                const lr1Active32 = new Array(8).fill(null);
                for (let i = 0; i < 8; i++) {
                    if (wr1TopLabels[i] !== null) {
                        const lbl = nextMatchLabel();
                        lr1Active32[i] = lbl;
                        lr1_32.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr1TopLabels[i]}`, `Loser of ${wr1BotLabels[i]}`, 'L'));
                    } else {
                        const wrapper = createElement('div', 'match-wrapper');
                        wrapper.appendChild(createElement('div', 'dummy-spacer-box'));
                        lr1_32.appendChild(wrapper);
                    }
                }

                const lr2Labels32 = [];
                for (let i = 0; i < 8; i++) {
                    const lbl = nextMatchLabel();
                    lr2Labels32.push(lbl);
                    const wr2Loser = wr2_32Labels[7 - i];
                    if (lr1Active32[i] !== null) {
                        lr2_32.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${wr2Loser}`, '', 'L'));
                    } else {
                        lr2_32.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2Loser}`, `Loser of ${wr1BotLabels[i]}`, 'L'));
                    }
                }

                const lr3Labels32 = [0, 1, 2, 3].map(() => nextMatchLabel());
                lr3Labels32.forEach(l => lr3_32.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'L')));

                lContainer.append(lr1_32, lr2_32, lr3_32);
                const current4Labels = lr3Labels32;

                const wqfDropCol = () => createRoundColumn(`Losers Round 4 ${getBoStringForRound('L', 'Losers Round 4', playerCount)}`);
                const consolidate2Col = () => createRoundColumn(`Losers Round 5 ${getBoStringForRound('L', 'Losers Round 5', playerCount)}`);
                const wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
                const consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
                const wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);

                if (effW === 4 && isFinalWLoserDirectQual) {
                    appendLosersQualifiersColumn(current4Labels);
                } else {
                    const colWqfDrop = wqfDropCol();
                    const wqfDropOrder = [wqfLabels[1], wqfLabels[0], wqfLabels[3], wqfLabels[2]];
                    const afterWqfDropLabels = [0, 1, 2, 3].map(() => nextMatchLabel());
                    afterWqfDropLabels.forEach((l, i) => {
                        colWqfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wqfDropOrder[i]}`, '', 'L'));
                    });
                    lContainer.appendChild(colWqfDrop);

                    if (targetLosersBracketQuals >= 4) {
                        appendLosersQualifiersColumn(afterWqfDropLabels);
                    } else {
                        const colCons2 = consolidate2Col();
                        const cons2Labels = [0, 1].map(() => nextMatchLabel());
                        cons2Labels.forEach(l => colCons2.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'L')));
                        lContainer.appendChild(colCons2);

                        if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) {
                            appendLosersQualifiersColumn(cons2Labels);
                        } else if (effW === 4 && targetLosersBracketQuals === 1) {
                            const colCons1 = consolidate1Col();
                            const cons1Lbl = nextMatchLabel();
                            colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                            lContainer.appendChild(colCons1);
                            appendLosersQualifiersColumn([cons1Lbl]);
                        } else {
                            const colWsfDrop = wsfDropCol();
                            const wsfDropOrder = [wsfLabels[1], wsfLabels[0]];
                            const afterWsfDropLabels = [0, 1].map(() => nextMatchLabel());
                            afterWsfDropLabels.forEach((l, i) => {
                                colWsfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wsfDropOrder[i]}`, '', 'L'));
                            });
                            lContainer.appendChild(colWsfDrop);

                            if (effW === 2 && targetLosersBracketQuals === 2) {
                                appendLosersQualifiersColumn(afterWsfDropLabels);
                            } else if (effW === 1 && isFinalWLoserDirectQual) {
                                if (targetLosersBracketQuals >= 2) {
                                    appendLosersQualifiersColumn(afterWsfDropLabels);
                                } else {
                                    const colCons1 = consolidate1Col();
                                    const cons1Lbl = nextMatchLabel();
                                    colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                                    lContainer.appendChild(colCons1);
                                    appendLosersQualifiersColumn([cons1Lbl]);
                                }
                            } else {
                                const colCons1 = consolidate1Col();
                                const cons1Lbl = nextMatchLabel();
                                colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                                lContainer.appendChild(colCons1);

                                if (effW === 2 && targetLosersBracketQuals === 1) {
                                    appendLosersQualifiersColumn([cons1Lbl]);
                                } else {
                                    const colWfDrop = wfDropCol();
                                    const lfLbl = nextMatchLabel();
                                    lfMatchLabelForGf = lfLbl;
                                    colWfDrop.appendChild(createInteractiveMatchNode(lfLbl, '', '', '', '', 'straight', `Loser of ${wfLabel}`, '', 'L'));
                                    lContainer.appendChild(colWfDrop);
                                    if (!isGfMode) {
                                        appendLosersQualifiersColumn([lfLbl]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (!isSingle && (isGfMode || lCountNum > 0)) {
            const lr1 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
            const lr2 = createRoundColumn(`Losers Round 2 ${getBoStringForRound('L', 'Losers Round 2', playerCount)}`);

            for (let p = 0; p < 4; p++) {
                const pairGroup = createElement('div', 'pair-group');
                const i0 = 2 * p;
                const i1 = 2 * p + 1;
                const activeIndices = [i0, i1].filter(idx => wr1ActiveLabels[idx] !== null);

                if (activeIndices.length === 2) {
                    activeIndices.forEach(idx => {
                        const lbl = nextMatchLabel();
                        const wr2Loser = wr2Labels[7 - idx];
                        const wr1Loser = wr1ActiveLabels[idx];
                        pairGroup.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2Loser}`, `Loser of ${wr1Loser}`, 'L'));
                    });
                } else if (activeIndices.length === 1) {
                    const idx = activeIndices[0];
                    const lbl = nextMatchLabel();
                    const wr2Loser = wr2Labels[7 - idx];
                    const wr1Loser = wr1ActiveLabels[idx];
                    pairGroup.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2Loser}`, `Loser of ${wr1Loser}`, 'L'));
                } else {
                    const wrapper = createElement('div', 'match-wrapper');
                    wrapper.appendChild(createElement('div', 'dummy-spacer-box'));
                    pairGroup.appendChild(wrapper);
                }
                lr1.appendChild(pairGroup);
            }

            const lr2Labels = [];
            for (let p = 0; p < 4; p++) {
                const lbl = nextMatchLabel();
                lr2Labels.push(lbl);
                const i0 = 2 * p;
                const i1 = 2 * p + 1;
                const activeIndices = [i0, i1].filter(idx => wr1ActiveLabels[idx] !== null);

                if (activeIndices.length === 2) {
                    lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'branch', '', '', 'L'));
                } else if (activeIndices.length === 1) {
                    const emptyIdx = (activeIndices[0] === i0) ? i1 : i0;
                    const byeWr2Loser = wr2Labels[7 - emptyIdx];
                    if (emptyIdx === i0) {
                        lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${byeWr2Loser}`, '', 'L'));
                    } else {
                        lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'straight', '', `Loser of ${byeWr2Loser}`, 'L'));
                    }
                } else {
                    const topLoser = wr2Labels[7 - i0];
                    const botLoser = wr2Labels[7 - i1];
                    lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${topLoser}`, `Loser of ${botLoser}`, 'L'));
                }
            }

            lContainer.append(lr1, lr2);
            const current4Labels = lr2Labels;
            const wqfDropCol = () => createRoundColumn(`Losers Round 3 ${getBoStringForRound('L', 'Losers Round 3', playerCount)}`);
            const consolidate2Col = () => createRoundColumn(`Losers Round 4 ${getBoStringForRound('L', 'Losers Round 4', playerCount)}`);
            const wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
            const consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
            const wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);

            if (effW === 4 && isFinalWLoserDirectQual) {
                appendLosersQualifiersColumn(current4Labels);
            } else {
                const colWqfDrop = wqfDropCol();
                const wqfDropOrder = [wqfLabels[1], wqfLabels[0], wqfLabels[3], wqfLabels[2]];
                const afterWqfDropLabels = [0, 1, 2, 3].map(() => nextMatchLabel());
                afterWqfDropLabels.forEach((l, i) => {
                    colWqfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wqfDropOrder[i]}`, '', 'L'));
                });
                lContainer.appendChild(colWqfDrop);

                if (targetLosersBracketQuals >= 4) {
                    appendLosersQualifiersColumn(afterWqfDropLabels);
                } else {
                    const colCons2 = consolidate2Col();
                    const cons2Labels = [0, 1].map(() => nextMatchLabel());
                    cons2Labels.forEach(l => colCons2.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'L')));
                    lContainer.appendChild(colCons2);

                    if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) {
                        appendLosersQualifiersColumn(cons2Labels);
                    } else if (effW === 4 && targetLosersBracketQuals === 1) {
                        const colCons1 = consolidate1Col();
                        const cons1Lbl = nextMatchLabel();
                        colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                        lContainer.appendChild(colCons1);
                        appendLosersQualifiersColumn([cons1Lbl]);
                    } else {
                        const colWsfDrop = wsfDropCol();
                        const wsfDropOrder = [wsfLabels[1], wsfLabels[0]];
                        const afterWsfDropLabels = [0, 1].map(() => nextMatchLabel());
                        afterWsfDropLabels.forEach((l, i) => {
                            colWsfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wsfDropOrder[i]}`, '', 'L'));
                        });
                        lContainer.appendChild(colWsfDrop);

                        if (effW === 2 && targetLosersBracketQuals === 2) {
                            appendLosersQualifiersColumn(afterWsfDropLabels);
                        } else if (effW === 1 && isFinalWLoserDirectQual) {
                            if (targetLosersBracketQuals >= 2) {
                                appendLosersQualifiersColumn(afterWsfDropLabels);
                            } else {
                                const colCons1 = consolidate1Col();
                                const cons1Lbl = nextMatchLabel();
                                colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                                lContainer.appendChild(colCons1);
                                appendLosersQualifiersColumn([cons1Lbl]);
                            }
                        } else {
                            const colCons1 = consolidate1Col();
                            const cons1Lbl = nextMatchLabel();
                            colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                            lContainer.appendChild(colCons1);

                            if (effW === 2 && targetLosersBracketQuals === 1) {
                                appendLosersQualifiersColumn([cons1Lbl]);
                            } else {
                                const colWfDrop = wfDropCol();
                                const lfLbl = nextMatchLabel();
                                lfMatchLabelForGf = lfLbl;
                                colWfDrop.appendChild(createInteractiveMatchNode(lfLbl, '', '', '', '', 'straight', `Loser of ${wfLabel}`, '', 'L'));
                                lContainer.appendChild(colWfDrop);
                                if (!isGfMode) {
                                    appendLosersQualifiersColumn([lfLbl]);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // =========================================================
    // パターンB: 9〜16人規模
    // =========================================================
    else if (playerCount >= 9) {
        const wr1Slots16 = [
            { s1: 8, s2: 9 },  { s1: 5, s2: 12 }, { s1: 7, s2: 10 }, { s1: 6, s2: 11 }
        ];
        const wqfSlots16 = [
            { topSeed: 1, pair: [16, 1], botSeedPair: [8, 9] },
            { topSeed: 4, pair: [13, 4], botSeedPair: [5, 12] },
            { topSeed: 2, pair: [15, 2], botSeedPair: [7, 10] },
            { topSeed: 3, pair: [14, 3], botSeedPair: [6, 11] }
        ];

        const wr1 = createRoundColumn(`Winners Round 1 ${getBoStringForRound('W', 'Winners Round 1', playerCount)}`);
        const wqf = createRoundColumn(`Winners Quarter-Final ${getBoStringForRound('W', 'Winners Quarter-Final', playerCount)}`);

        const wr1TopLabels = new Array(4).fill(null);
        const wr1BotLabels = new Array(4).fill(null);

        if (playerCount <= 12) {
            wr1Slots16.forEach((slot, i) => {
                if (playerCount >= slot.s2) {
                    const lbl = nextMatchLabel();
                    wr1BotLabels[i] = lbl;
                    wr1.appendChild(createInteractiveMatchNode(lbl, pMap[slot.s1] || '', pMap[slot.s2] || '', String(slot.s1), String(slot.s2), 'none', '', '', 'W'));
                } else {
                    const wrapper = createElement('div', 'match-wrapper');
                    wrapper.appendChild(createElement('div', 'dummy-spacer-box'));
                    wr1.appendChild(wrapper);
                }
            });
        } else {
            const topPairs = [[1, 16], [4, 13], [2, 15], [3, 14]];
            for (let i = 0; i < 4; i++) {
                const pairGroup = createElement('div', 'pair-group');
                if (playerCount >= topPairs[i][1]) {
                    const lblTop = nextMatchLabel();
                    wr1TopLabels[i] = lblTop;
                    pairGroup.appendChild(
                        createInteractiveMatchNode(lblTop, pMap[topPairs[i][0]] || '', pMap[topPairs[i][1]] || '', String(topPairs[i][0]), String(topPairs[i][1]), 'none', '', '', 'W')
                    );
                }
                const lblBot = nextMatchLabel();
                wr1BotLabels[i] = lblBot;
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblBot, pMap[wr1Slots16[i].s1] || '', pMap[wr1Slots16[i].s2] || '', String(wr1Slots16[i].s1), String(wr1Slots16[i].s2), 'none', '', '', 'W')
                );
                wr1.appendChild(pairGroup);
            }
        }

        const wqfLabels = [];
        wqfSlots16.forEach((slot, i) => {
            const lbl = nextMatchLabel();
            wqfLabels.push(lbl);
            const hasTopMatch = wr1TopLabels[i] !== null;
            const hasBotMatch = wr1BotLabels[i] !== null;

            if (hasTopMatch) {
                wqf.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'branch', '', '', 'W'));
            } else if (hasBotMatch) {
                wqf.appendChild(createInteractiveMatchNode(lbl, pMap[slot.topSeed] || '', '', String(slot.topSeed), '', 'straight', '', '', 'W'));
            } else {
                const directSeed = slot.botSeedPair[0];
                wqf.appendChild(createInteractiveMatchNode(lbl, pMap[slot.topSeed] || '', pMap[directSeed] || '', String(slot.topSeed), String(directSeed), 'none', '', '', 'W'));
            }
        });

        wContainer.append(wr1, wqf);

        let wsfLabels = [];
        let wfLabel = '';

        if (effW === 4) {
            appendWinnersStopQualifiers(wqfLabels);
            currentMatchIdx += 5;
        } else {
            const wsf = createRoundColumn(`Winners Semi-Final ${getBoStringForRound('W', 'Winners Semi-Final', playerCount)}`);
            wsfLabels = [0, 1].map(() => nextMatchLabel());
            wsfLabels.forEach(l => wsf.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'W')));
            wContainer.appendChild(wsf);

            if (effW === 2) {
                appendWinnersStopQualifiers(wsfLabels);
                currentMatchIdx += 3;
            } else {
                const wf = createRoundColumn(`Winners Final ${getBoStringForRound('W', 'Winners Final', playerCount)}`);
                wfLabel = nextMatchLabel();
                wfMatchLabelForGf = wfLabel;
                wf.appendChild(createInteractiveMatchNode(wfLabel, '', '', '', '', 'branch', '', '', 'W'));
                wContainer.appendChild(wf);

                if (!isGfMode) {
                    appendWinnersStopQualifiers([wfLabel]);
                }
                currentMatchIdx += 2;
            }
        }

        if (!isSingle && (isGfMode || lCountNum > 0)) {
            let current2Labels = [];
            let wsfDropCol, consolidate1Col, wfDropCol;

            if (playerCount <= 12) {
                const lr1 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
                const lr1Labels = [];

                for (let p = 0; p < 2; p++) {
                    const lbl = nextMatchLabel();
                    lr1Labels.push(lbl);
                    const i0 = 2 * p;
                    const i1 = 2 * p + 1;
                    const activeIndices = [i0, i1].filter(idx => wr1BotLabels[idx] !== null);

                    if (activeIndices.length === 2) {
                        const pairGroup = createElement('div', 'pair-group');
                        pairGroup.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wqfLabels[3 - i0]}`, `Loser of ${wr1BotLabels[i0]}`, 'L'));
                        const lbl2 = nextMatchLabel();
                        lr1Labels.push(lbl2);
                        pairGroup.appendChild(createInteractiveMatchNode(lbl2, '', '', '', '', 'none', `Loser of ${wqfLabels[3 - i1]}`, `Loser of ${wr1BotLabels[i1]}`, 'L'));
                        lr1.appendChild(pairGroup);
                    } else if (activeIndices.length === 1) {
                        const idx = activeIndices[0];
                        lr1.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wqfLabels[3 - idx]}`, `Loser of ${wr1BotLabels[idx]}`, 'L'));
                    } else {
                        lr1.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wqfLabels[3 - i0]}`, `Loser of ${wqfLabels[3 - i1]}`, 'L'));
                    }
                }
                lContainer.appendChild(lr1);
                current2Labels = lr1Labels;

                wsfDropCol = () => createRoundColumn(`Losers Round 2 ${getBoStringForRound('L', 'Losers Round 2', playerCount)}`);
                consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
                wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);
            } else {
                const lr1 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
                const lr2 = createRoundColumn(`Losers Round 2 ${getBoStringForRound('L', 'Losers Round 2', playerCount)}`);
                const lr1Labels = [];
                for (let i = 0; i < 4; i++) {
                    const lbl = nextMatchLabel();
                    lr1Labels.push(lbl);
                    const wqfLoser = wqfLabels[3 - i];
                    const topOrBotLoser = wr1TopLabels[i] ? `Loser of ${wr1TopLabels[i]}` : `Loser of ${wqfLoser}`;
                    lr1.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', topOrBotLoser, `Loser of ${wr1BotLabels[i]}`, 'L'));
                }
                const lr2Labels = [0, 1].map(() => nextMatchLabel());
                lr2Labels.forEach(l => lr2.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'branch', '', '', 'L')));
                lContainer.append(lr1, lr2);
                current2Labels = lr2Labels;

                wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
                consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
                wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);
            }

            if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals >= 2)) {
                appendLosersQualifiersColumn(current2Labels);
            } else if (effW === 4 && targetLosersBracketQuals === 1) {
                const colCons1 = consolidate1Col();
                const cons1Lbl = nextMatchLabel();
                colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                lContainer.appendChild(colCons1);
                appendLosersQualifiersColumn([cons1Lbl]);
            } else {
                const colWsfDrop = wsfDropCol();
                const wsfDropOrder = [wsfLabels[1], wsfLabels[0]];
                const afterWsfDropLabels = [0, 1].map(() => nextMatchLabel());
                afterWsfDropLabels.forEach((l, i) => {
                    colWsfDrop.appendChild(createInteractiveMatchNode(l, '', '', '', '', 'straight', `Loser of ${wsfDropOrder[i]}`, '', 'L'));
                });
                lContainer.appendChild(colWsfDrop);

                if (effW === 2 && targetLosersBracketQuals === 2) {
                    appendLosersQualifiersColumn(afterWsfDropLabels);
                } else if (effW === 1 && isFinalWLoserDirectQual) {
                    if (targetLosersBracketQuals >= 2) {
                        appendLosersQualifiersColumn(afterWsfDropLabels);
                    } else {
                        const colCons1 = consolidate1Col();
                        const cons1Lbl = nextMatchLabel();
                        colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                        lContainer.appendChild(colCons1);
                        appendLosersQualifiersColumn([cons1Lbl]);
                    }
                } else {
                    const colCons1 = consolidate1Col();
                    const cons1Lbl = nextMatchLabel();
                    colCons1.appendChild(createInteractiveMatchNode(cons1Lbl, '', '', '', '', 'branch', '', '', 'L'));
                    lContainer.appendChild(colCons1);

                    if (effW === 2 && targetLosersBracketQuals === 1) {
                        appendLosersQualifiersColumn([cons1Lbl]);
                    } else {
                        const colWfDrop = wfDropCol();
                        const lfLbl = nextMatchLabel();
                        lfMatchLabelForGf = lfLbl;
                        colWfDrop.appendChild(createInteractiveMatchNode(lfLbl, '', '', '', '', 'straight', `Loser of ${wfLabel}`, '', 'L'));
                        lContainer.appendChild(colWfDrop);
                        if (!isGfMode) {
                            appendLosersQualifiersColumn([lfLbl]);
                        }
                    }
                }
            }
        }
    }

    // =========================================================
    // パターンC: 6〜8人規模
    // =========================================================
    else {
        const wr1Slots8 = [
            { s1: 4, s2: 5 }, { s1: 3, s2: 6 }
        ];
        const wsfSlots8 = [
            { topSeed: 1, botPair: [4, 5] },
            { topSeed: 2, botPair: [3, 6] }
        ];

        const wr1 = createRoundColumn(`Winners Round 1 ${getBoStringForRound('W', 'Winners Round 1', playerCount)}`);
        const wsf = createRoundColumn(`Winners Semi-Final ${getBoStringForRound('W', 'Winners Semi-Final', playerCount)}`);

        const wr1Labels = [];
        wr1Slots8.forEach(slot => {
            const lbl = nextMatchLabel();
            wr1Labels.push(lbl);
            wr1.appendChild(createInteractiveMatchNode(lbl, pMap[slot.s1] || '', pMap[slot.s2] || '', String(slot.s1), String(slot.s2), 'none', '', '', 'W'));
        });

        const wsfLabels = [];
        wsfSlots8.forEach(slot => {
            const lbl = nextMatchLabel();
            wsfLabels.push(lbl);
            wsf.appendChild(createInteractiveMatchNode(lbl, pMap[slot.topSeed] || '', '', String(slot.topSeed), '', 'straight', '', '', 'W'));
        });

        wContainer.append(wr1, wsf);

        let wfLabel = '';
        if (effW >= 2) {
            appendWinnersStopQualifiers(wsfLabels);
            currentMatchIdx += 3;
        } else {
            const wf = createRoundColumn(`Winners Final ${getBoStringForRound('W', 'Winners Final', playerCount)}`);
            wfLabel = nextMatchLabel();
            wfMatchLabelForGf = wfLabel;
            wf.appendChild(createInteractiveMatchNode(wfLabel, '', '', '', '', 'branch', '', '', 'W'));
            wContainer.appendChild(wf);

            if (!isGfMode) {
                appendWinnersStopQualifiers([wfLabel]);
            }
            currentMatchIdx += 2;
        }

        if (!isSingle && (isGfMode || lCountNum > 0)) {
            const lr1 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
            const lr1Labels = [0, 1].map(() => nextMatchLabel());
            lr1.appendChild(createInteractiveMatchNode(lr1Labels[0], '', '', '', '', 'none', `Loser of ${wsfLabels[1]}`, `Loser of ${wr1Labels[0]}`, 'L'));
            lr1.appendChild(createInteractiveMatchNode(lr1Labels[1], '', '', '', '', 'none', `Loser of ${wsfLabels[0]}`, `Loser of ${wr1Labels[1]}`, 'L'));
            lContainer.appendChild(lr1);

            if ((effW >= 2 && isFinalWLoserDirectQual) || (effW === 1 && isFinalWLoserDirectQual && targetLosersBracketQuals >= 2)) {
                appendLosersQualifiersColumn(lr1Labels);
            } else {
                const lsf = createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
                const lsfLbl = nextMatchLabel();
                lsf.appendChild(createInteractiveMatchNode(lsfLbl, '', '', '', '', 'branch', '', '', 'L'));
                lContainer.appendChild(lsf);

                if (effW >= 2 || (effW === 1 && isFinalWLoserDirectQual && targetLosersBracketQuals === 1)) {
                    appendLosersQualifiersColumn([lsfLbl]);
                } else {
                    const lf = createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);
                    const lfLbl = nextMatchLabel();
                    lfMatchLabelForGf = lfLbl;
                    lf.appendChild(createInteractiveMatchNode(lfLbl, '', '', '', '', 'straight', `Loser of ${wfLabel}`, '', 'L'));
                    lContainer.appendChild(lf);
                    if (!isGfMode) {
                        appendLosersQualifiersColumn([lfLbl]);
                    }
                }
            }
        }
    }

    // === Grand Final & Grand Final Reset の追加（W0L0時・ダブルエリミのみ） ===
    if (isGfMode && !isSingle && wfMatchLabelForGf) {
        const findLabelIndex = (lbl) => {
            let idx = 0;
            for (let i = 0; i < lbl.length; i++) {
                idx = idx * 26 + (lbl.charCodeAt(i) - 64);
            }
            return idx - 1;
        };
        const wfIdx = findLabelIndex(wfMatchLabelForGf);
        const gfLabel = indexToMatchLabel(wfIdx + 1);
        const gfResetLabel = indexToMatchLabel(wfIdx + 2);

        const gfCol = createRoundColumn(`Grand Final ${getBoStringForRound('W', 'Grand Final', playerCount)}`);
        const bottomLabelText = lfMatchLabelForGf ? `Winner of ${lfMatchLabelForGf}` : '';
        gfCol.appendChild(createInteractiveMatchNode(gfLabel, '', '', '', '', 'straight', '', bottomLabelText, 'W'));
        wContainer.appendChild(gfCol);

        const gfResetCol = createRoundColumn(`Grand Final Reset ${getBoStringForRound('W', 'Grand Final Reset', playerCount)}`);
        gfResetCol.appendChild(createInteractiveMatchNode(gfResetLabel, '', '', '', '', 'straight', `Winner of ${gfLabel}`, `Loser of ${gfLabel}`, 'W'));
        wContainer.appendChild(gfResetCol);
    }

    // =========================================================
    // トーナメント全体の接続グラフ構築（6〜40人 pair-group完全対応）
    // =========================================================
    const winnerTargetByMatch = {};
    const loserTargetByMatch = {};

    const parseSourceMatchLabel = (labelStr, prefix) => {
        if (!labelStr || !labelStr.startsWith(prefix)) return null;
        return labelStr.slice(prefix.length).trim();
    };

    const getMatchesInSlotUnit = (unitEl) => {
        if (!unitEl) return [];
        if (unitEl.classList.contains('match-wrapper')) {
            const lblEl = unitEl.querySelector('.match-label');
            return (lblEl && matchRecordsByLabel[lblEl.textContent]) ? [matchRecordsByLabel[lblEl.textContent]] : [];
        }
        if (unitEl.classList.contains('pair-group')) {
            const wrappers = Array.from(unitEl.querySelectorAll(':scope > .match-wrapper'));
            const list = [];
            wrappers.forEach(w => {
                const lblEl = w.querySelector('.match-label');
                if (lblEl && matchRecordsByLabel[lblEl.textContent]) {
                    list.push(matchRecordsByLabel[lblEl.textContent]);
                }
            });
            return list;
        }
        return [];
    };

    const registerRoundProgression = (containerEl) => {
        const cols = Array.from(containerEl.children).filter(col => !col.classList.contains('qualifier-col'));
        for (let c = 0; c < cols.length; c++) {
            const col = cols[c];
            const currUnits = Array.from(col.children).filter(el => !el.classList.contains('round-header'));

            currUnits.forEach(unit => {
                const matches = getMatchesInSlotUnit(unit);
                matches.forEach(rec => {
                    const wTop = parseSourceMatchLabel(rec.topLabel, 'Winner of ');
                    if (wTop) winnerTargetByMatch[wTop] = { targetLabel: rec.matchLabel, slot: 1 };
                    const wBot = parseSourceMatchLabel(rec.bottomLabel, 'Winner of ');
                    if (wBot) winnerTargetByMatch[wBot] = { targetLabel: rec.matchLabel, slot: 2 };

                    const lTop = parseSourceMatchLabel(rec.topLabel, 'Loser of ');
                    if (lTop) loserTargetByMatch[lTop] = { targetLabel: rec.matchLabel, slot: 1 };
                    const lBot = parseSourceMatchLabel(rec.bottomLabel, 'Loser of ');
                    if (lBot) loserTargetByMatch[lBot] = { targetLabel: rec.matchLabel, slot: 2 };
                });
            });

            if (c === 0) continue;
            const prevCol = cols[c - 1];
            const prevUnits = Array.from(prevCol.children).filter(el => !el.classList.contains('round-header'));

            if (prevUnits.length === currUnits.length) {
                currUnits.forEach((currUnit, idx) => {
                    const currMatches = getMatchesInSlotUnit(currUnit);
                    const prevMatches = getMatchesInSlotUnit(prevUnits[idx]);

                    if (currMatches.length === 1) {
                        const currRec = currMatches[0];
                        if (prevMatches.length === 2) {
                            if (!winnerTargetByMatch[prevMatches[0].matchLabel]) {
                                winnerTargetByMatch[prevMatches[0].matchLabel] = { targetLabel: currRec.matchLabel, slot: 1 };
                            }
                            if (!winnerTargetByMatch[prevMatches[1].matchLabel]) {
                                winnerTargetByMatch[prevMatches[1].matchLabel] = { targetLabel: currRec.matchLabel, slot: 2 };
                            }
                        } else if (prevMatches.length === 1) {
                            const prevRec = prevMatches[0];
                            if (!winnerTargetByMatch[prevRec.matchLabel]) {
                                const slot1Occupied = currRec.p1NameSpan.textContent.trim() !== '' || currRec.topLabel !== '';
                                const slot2Occupied = currRec.p2NameSpan.textContent.trim() !== '' || currRec.bottomLabel !== '';
                                let targetSlot = 2;
                                if (!slot1Occupied && slot2Occupied) {
                                    targetSlot = 1;
                                } else if (!slot1Occupied && !slot2Occupied) {
                                    targetSlot = 1;
                                }
                                winnerTargetByMatch[prevRec.matchLabel] = { targetLabel: currRec.matchLabel, slot: targetSlot };
                            }
                        }
                    } else if (currMatches.length === 2 && prevMatches.length === 1) {
                        const prevRec = prevMatches[0];
                        const topTargetRec = currMatches[0];
                        if (prevRec && topTargetRec && !winnerTargetByMatch[prevRec.matchLabel]) {
                            const slot1Occupied = topTargetRec.p1NameSpan.textContent.trim() !== '' || topTargetRec.topLabel !== '';
                            const targetSlot = slot1Occupied ? 2 : 1;
                            winnerTargetByMatch[prevRec.matchLabel] = { targetLabel: topTargetRec.matchLabel, slot: targetSlot };
                        }
                    }
                });
            } else if (prevUnits.length === currUnits.length * 2) {
                currUnits.forEach((currUnit, idx) => {
                    const currMatches = getMatchesInSlotUnit(currUnit);
                    if (currMatches.length !== 1) return;
                    const currRec = currMatches[0];
                    const prevTopMatches = getMatchesInSlotUnit(prevUnits[2 * idx]);
                    const prevBotMatches = getMatchesInSlotUnit(prevUnits[2 * idx + 1]);

                    const isBranch = currRec.wrapper.classList.contains('branch-line');
                    const isStraight = currRec.wrapper.classList.contains('straight-line');

                    if (isBranch) {
                        if (prevTopMatches.length === 1 && !winnerTargetByMatch[prevTopMatches[0].matchLabel]) {
                            winnerTargetByMatch[prevTopMatches[0].matchLabel] = { targetLabel: currRec.matchLabel, slot: 1 };
                        }
                        if (prevBotMatches.length === 1 && !winnerTargetByMatch[prevBotMatches[0].matchLabel]) {
                            winnerTargetByMatch[prevBotMatches[0].matchLabel] = { targetLabel: currRec.matchLabel, slot: 2 };
                        }
                    } else if (isStraight) {
                        const activePrev = prevTopMatches[0] || prevBotMatches[0];
                        if (activePrev && !winnerTargetByMatch[activePrev.matchLabel]) {
                            const slot1Occupied = currRec.p1NameSpan.textContent.trim() !== '' || currRec.topLabel !== '';
                            const slot2Occupied = currRec.p2NameSpan.textContent.trim() !== '' || currRec.bottomLabel !== '';
                            const targetSlot = (slot1Occupied && !slot2Occupied) ? 2 : 1;
                            winnerTargetByMatch[activePrev.matchLabel] = { targetLabel: currRec.matchLabel, slot: targetSlot };
                        }
                    }
                });
            }
        }
    };

    registerRoundProgression(wContainer);
    registerRoundProgression(lContainer);

    const autoDqSlots = {};
    const ensureAutoDqEntry = (lbl) => {
        if (!autoDqSlots[lbl]) autoDqSlots[lbl] = { p1: false, p2: false };
        return autoDqSlots[lbl];
    };

    const allMatchLabelsSorted = Object.keys(matchRecordsByLabel).sort((a, b) => {
        if (a.length !== b.length) return a.length - b.length;
        return a.localeCompare(b);
    });

    const placePlayerIntoTarget = (targetInfo, playerName, playerSeedNum, isPlayerAlreadyDq = false) => {
        if (!targetInfo || !targetInfo.targetLabel) return;
        const targetRec = matchRecordsByLabel[targetInfo.targetLabel];
        if (!targetRec) return;

        if (targetInfo.slot === 1) {
            if (playerName && !targetRec.p1NameSpan.textContent.trim()) {
                targetRec.p1NameSpan.textContent = playerName;
            }
            if (playerSeedNum !== null && targetRec.seed1Num === null) {
                targetRec.seed1Num = playerSeedNum;
            }
            if (isPlayerAlreadyDq) {
                ensureAutoDqEntry(targetRec.matchLabel).p1 = true;
            }
        } else {
            if (playerName && !targetRec.p2NameSpan.textContent.trim()) {
                targetRec.p2NameSpan.textContent = playerName;
            }
            if (playerSeedNum !== null && targetRec.seed2Num === null) {
                targetRec.seed2Num = playerSeedNum;
            }
            if (isPlayerAlreadyDq) {
                ensureAutoDqEntry(targetRec.matchLabel).p2 = true;
            }
        }
    };

    const apiDqMap = currentPool.apiDqByMatchLabel || {};

    allMatchLabelsSorted.forEach(mLabel => {
        const rec = matchRecordsByLabel[mLabel];
        if (!rec) return;

        const key = `${poolName}_${mLabel}`;
        const ov = matchOverrides[key] || {};
        const apiDq = apiDqMap[mLabel.toUpperCase()] || { dqP1: false, dqP2: false };
        const autoDq = autoDqSlots[mLabel] || { p1: false, p2: false };

        const p1Name = rec.p1NameSpan.textContent.trim();
        const p2Name = rec.p2NameSpan.textContent.trim();
        const s1Num = rec.seed1Num;
        const s2Num = rec.seed2Num;

        const apiP1Dq = Boolean(apiDq.dqP1 && p1Name !== '');
        const apiP2Dq = Boolean(apiDq.dqP2 && p2Name !== '');

        const baseP1Dq = ov.dqP1 !== undefined ? Boolean(ov.dqP1) : apiP1Dq;
        const baseP2Dq = ov.dqP2 !== undefined ? Boolean(ov.dqP2) : apiP2Dq;

        const isP1Dq = Boolean(baseP1Dq || autoDq.p1);
        const isP2Dq = Boolean(baseP2Dq || autoDq.p2);

        if (isP1Dq && !isP2Dq) {
            rec.score1El.textContent = 'DQ';
            rec.score2El.textContent = '✔';
            if (p2Name) {
                placePlayerIntoTarget(winnerTargetByMatch[mLabel], p2Name, s2Num, false);
            }
            if (rec.side === 'W' && p1Name) {
                placePlayerIntoTarget(loserTargetByMatch[mLabel], p1Name, s1Num, true);
            }
        } else if (!isP1Dq && isP2Dq) {
            rec.score1El.textContent = '✔';
            rec.score2El.textContent = 'DQ';
            if (p1Name) {
                placePlayerIntoTarget(winnerTargetByMatch[mLabel], p1Name, s1Num, false);
            }
            if (rec.side === 'W' && p2Name) {
                placePlayerIntoTarget(loserTargetByMatch[mLabel], p2Name, s2Num, true);
            }
        } else if (isP1Dq && isP2Dq) {
            const effS1 = s1Num !== null ? s1Num : 9999;
            const effS2 = s2Num !== null ? s2Num : 9999;
            const p1IsHigherSeed = effS1 <= effS2;

            const advName = p1IsHigherSeed ? p1Name : p2Name;
            const advSeed = p1IsHigherSeed ? s1Num : s2Num;
            const dropName = p1IsHigherSeed ? p2Name : p1Name;
            const dropSeed = p1IsHigherSeed ? s2Num : s1Num;

            if (p1IsHigherSeed) {
                rec.score1El.textContent = '✔';
                rec.score2El.textContent = 'DQ';
            } else {
                rec.score1El.textContent = 'DQ';
                rec.score2El.textContent = '✔';
            }

            if (advName) {
                placePlayerIntoTarget(winnerTargetByMatch[mLabel], advName, advSeed, true);
            }
            if (rec.side === 'W' && dropName) {
                placePlayerIntoTarget(loserTargetByMatch[mLabel], dropName, dropSeed, true);
            }
        } else {
            rec.score1El.textContent = '';
            rec.score2El.textContent = '';
        }
    });

    // === 配信台ラベル反映（ストリームキュー番号なし・チャンネル名のみ表示）＆ クリックイベント登録 ===
    const apiStreamMap = currentPool.apiStreamByRoundIndex || {};

    allMatchLabelsSorted.forEach(mLabel => {
        const rec = matchRecordsByLabel[mLabel];
        if (!rec) return;

        const key = `${poolName}_${mLabel}`;
        const ov = matchOverrides[key] || {};
        const defaultStream = apiStreamMap[`id_${mLabel.toUpperCase()}`] || null;
        const rawApiDq = apiDqMap[mLabel.toUpperCase()] || null;
        const autoDq = autoDqSlots[mLabel] || { p1: false, p2: false };
        const p1Now = rec.p1NameSpan.textContent.trim();
        const p2Now = rec.p2NameSpan.textContent.trim();
        const effectiveDefaultDq = {
            dqP1: Boolean((rawApiDq?.dqP1 && p1Now !== '') || autoDq.p1),
            dqP2: Boolean((rawApiDq?.dqP2 && p2Now !== '') || autoDq.p2)
        };

        const isStreamEnabled = ov.streamEnabled !== undefined
            ? Boolean(ov.streamEnabled)
            : Boolean(defaultStream?.enabled);
        const streamChannel = ov.streamChannel !== undefined
            ? ov.streamChannel
            : (defaultStream?.channel || '');

        if (isStreamEnabled) {
            rec.matchBox.classList.add('stream-highlight');
            const badge = createElement('div', 'stream-badge-tag');
            const prefixSpan = createElement('span', 'stream-badge-prefix', '配信');
            badge.appendChild(prefixSpan);
            if (streamChannel) {
                const nameSpan = createElement('span', 'stream-badge-name', streamChannel);
                badge.appendChild(nameSpan);
            }
            rec.matchBox.appendChild(badge);
        }

        rec.matchBox.addEventListener('click', (e) => {
            e.stopPropagation();
            openMatchEditModal(
                poolName,
                mLabel,
                p1Now,
                p2Now,
                defaultStream,
                effectiveDefaultDq
            );
        });
    });

    // === 用紙サイズ・向きの計算（6〜12人：A4横 / 13〜24人：A3横 / 25〜40人：A3縦） ===
    const effectiveCountForPool = getEffectivePlayerCountForPool(poolName);
    const activeOrientation = overrideOrientation || printOrientationSelect.value || (effectiveCountForPool >= 25 ? 'portrait' : 'landscape');
    const isPortraitLayout = (activeOrientation === 'portrait');

    let boxHeightPx = 48;
    let colWidthPx = 244;
    let colGapPx = 22;
    let labelWidthPx = 25;
    let checkboxWidthPx = 27;
    let playerFontPx = 14.5;
    let playerPadXPx = 6;

    if (playerCount >= 33) {
        boxHeightPx = 54;
        colWidthPx = 216;
        colGapPx = 14;
        labelWidthPx = 21;
        checkboxWidthPx = 21;
        playerFontPx = 12.5;
        playerPadXPx = 5;
        wSlotUnit = 88;
        lSlotUnit = 92;
    } else if (isPortraitLayout) {
        boxHeightPx = 54;
        colWidthPx = 228;
        colGapPx = 16;
        labelWidthPx = 22;
        checkboxWidthPx = 22;
        playerFontPx = 13;
        playerPadXPx = 5;
        if (playerCount >= 25) {
            wSlotUnit = WINNERS_SLOT_HEIGHT_32;
            lSlotUnit = LOSERS_SLOT_HEIGHT_32;
        } else {
            wSlotUnit = Math.max(wSlotUnit, boxHeightPx + 34);
            lSlotUnit = Math.max(lSlotUnit, boxHeightPx + 34);
        }
    } else {
        if (isGfMode || playerCount <= 16) {
            boxHeightPx = 56;
        }
        if (playerCount <= 8) {
            boxHeightPx = 62;
        }
        wSlotUnit = Math.max(wSlotUnit, boxHeightPx + 30);
        lSlotUnit = Math.max(lSlotUnit, boxHeightPx + 28);
    }

    const wColsCount = wContainer.children.length;
    const lColsCount = (!isSingle && (isGfMode || lCountNum > 0)) ? lContainer.children.length : 0;

    let bracketGapPx = (!isSingle && (isGfMode || lCountNum > 0)) ? (isPortraitLayout ? 48 : 28) : 0;

    let winnersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (winnersSlots * wSlotUnit);
    let losersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (losersSlots * lSlotUnit);

    const minBracketHeight = winnersHeightPx + ((!isSingle && (isGfMode || lCountNum > 0)) ? (bracketGapPx + losersHeightPx) : 0);
    const rosterEstimatedHeight = 36 + (playerCount * 25) + (pendingLogoDataUrl ? 165 : 10);
    const minBodyHeight = Math.max(minBracketHeight, rosterEstimatedHeight);

    let totalCanvasWidth = 2362;
    let totalCanvasHeight = 1670;

    if (isPortraitLayout) {
        const wRowWidth = (wColsCount * (colWidthPx + colGapPx)) + 356 + 24;
        const lRowWidth = (lColsCount * (colWidthPx + colGapPx)) + 20;
        const rawNeedW = Math.max(1680, wRowWidth, lRowWidth);
        const rawNeedH = Math.max(2300, minBodyHeight + 76);

        totalCanvasWidth = Math.max(rawNeedW, Math.round(rawNeedH / Math.SQRT2));
        totalCanvasHeight = Math.round(totalCanvasWidth * Math.SQRT2);
    } else {
        const maxCols = Math.max(wColsCount, lColsCount);
        const estimatedBracketWidth = maxCols * (colWidthPx + colGapPx);
        const rawNeedW = Math.max(2362, estimatedBracketWidth + 356 + 40);
        const rawNeedH = Math.max(1670, minBodyHeight + 76);

        totalCanvasWidth = Math.max(rawNeedW, Math.round(rawNeedH * Math.SQRT2));
        totalCanvasHeight = Math.round(totalCanvasWidth / Math.SQRT2);
    }

    const targetBodyHeight = totalCanvasHeight - 82;
    if (!isSingle && (isGfMode || lCountNum > 0)) {
        const availForSlots = targetBodyHeight - bracketGapPx - (ROUND_HEADER_TOTAL_HEIGHT * 2);
        if (availForSlots > (winnersSlots * wSlotUnit + losersSlots * lSlotUnit)) {
            const wWeight = winnersSlots;
            const lWeight = losersSlots * 1.15;
            wSlotUnit = Math.floor((availForSlots * (wWeight / (wWeight + lWeight))) / winnersSlots);
            lSlotUnit = Math.floor((availForSlots * (lWeight / (wWeight + lWeight))) / losersSlots);
            winnersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (winnersSlots * wSlotUnit);
            losersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (losersSlots * lSlotUnit);
        }
    } else {
        const availForWSlots = targetBodyHeight - ROUND_HEADER_TOTAL_HEIGHT - (pendingLogoDataUrl ? 140 : 20);
        if (availForWSlots > winnersSlots * wSlotUnit) {
            wSlotUnit = Math.min(150, Math.floor(availForWSlots / winnersSlots));
            winnersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (winnersSlots * wSlotUnit);
        }
    }

    targetSheetEl.style.setProperty('--match-box-h', `${boxHeightPx}px`);
    targetSheetEl.style.setProperty('--col-w', `${colWidthPx}px`);
    targetSheetEl.style.setProperty('--col-gap', `${colGapPx}px`);
    targetSheetEl.style.setProperty('--label-w', `${labelWidthPx}px`);
    targetSheetEl.style.setProperty('--checkbox-w', `${checkboxWidthPx}px`);
    targetSheetEl.style.setProperty('--player-font', `${playerFontPx}px`);
    targetSheetEl.style.setProperty('--player-pad-x', `${playerPadXPx}px`);

    wContainer.style.height = `${winnersHeightPx}px`;
    bracketContainerEl.innerHTML = '';
    bracketContainerEl.appendChild(wContainer);

    if (!isSingle && (isGfMode || lCountNum > 0)) {
        lContainer.style.height = `${losersHeightPx}px`;
        bracketContainerEl.style.gap = `${bracketGapPx}px`;
        bracketContainerEl.appendChild(lContainer);
    } else {
        bracketContainerEl.style.gap = '0px';
    }

    renderCheckinRosterToContainer(currentPool.rosterList, rosterContainerEl);

    return { canvasWidth: totalCanvasWidth, canvasHeight: totalCanvasHeight, boxHeightPx };
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
            ? `Winners side qualifier: ${wCount}`
            : `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`;
    }

    const bracketContainer = document.getElementById('bracket-container');
    const rosterContainer = document.getElementById('checkin-roster-container');

    const { canvasWidth, canvasHeight } = buildBracketSheetContent(selectedPoolName, bracketContainer, rosterContainer, previewArea);
    previewArea.style.width = `${canvasWidth}px`;
    previewArea.style.minHeight = `${canvasHeight}px`;
    previewArea.style.height = `${canvasHeight}px`;

    applyPrintAndDrawOptions();
    requestAnimationFrame(fitToViewport);
});

// === シート要素をキャプチャする共通ヘルパー（PDF出力時はモノクロ白スナップ圧縮で容量を約1/7に軽量化） ===
async function captureSheetElementToJpeg(sheetEl, width, height, pixelRatio = 2, forPdfCompression = false) {
    const effectiveRatio = forPdfCompression
        ? Math.min(1.35, 2250 / Math.max(width, height))
        : pixelRatio;

    let rawCanvas = null;
    if (window.htmlToImage && window.htmlToImage.toCanvas) {
        rawCanvas = await htmlToImage.toCanvas(sheetEl, {
            pixelRatio: effectiveRatio,
            backgroundColor: '#ffffff',
            width: width,
            height: height,
            style: { transform: 'none', margin: '0' }
        });
    } else if (window.html2canvas) {
        rawCanvas = await html2canvas(sheetEl, {
            scale: effectiveRatio,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: width,
            height: height,
            windowWidth: width + 100,
            windowHeight: height + 100,
            scrollX: 0,
            scrollY: 0
        });
    }

    if (rawCanvas) {
        if (forPdfCompression) {
            const ctx = rawCanvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const y = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
                const v = y >= 244 ? 255 : y;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
            }
            ctx.putImageData(imgData, 0, 0);
            return rawCanvas.toDataURL('image/jpeg', 0.68);
        }
        return rawCanvas.toDataURL('image/jpeg', 0.92);
    }

    return await htmlToImage.toJpeg(sheetEl, {
        quality: forPdfCompression ? 0.68 : 0.92,
        pixelRatio: effectiveRatio,
        backgroundColor: '#ffffff',
        width: width,
        height: height,
        style: { transform: 'none', margin: '0' }
    });
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
        const dataUrl = await captureSheetElementToJpeg(previewArea, width, height, 2);

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

// === 印刷画面を出さずに直接PDFファイルを生成・ダウンロードする共通エンジン ===
async function downloadPoolsAsPdfDirect(targetPoolNames, triggerBtn, downloadFileName) {
    if (!targetPoolNames || targetPoolNames.length === 0) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showInlineError(exportErrorMsg, 'PDF生成ライブラリ(jsPDF)の読み込みに失敗しました。ページを再読み込みしてください。');
        return;
    }

    const originalBtnText = triggerBtn ? triggerBtn.textContent : '';
    const exportJpgBtn = document.getElementById('export-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const exportAllPdfBtn = document.getElementById('export-all-pdf-btn');

    [exportJpgBtn, exportPdfBtn, exportAllPdfBtn].forEach(b => { if (b) b.disabled = true; });

    isPrintingMode = true;
    applyPrintAndDrawOptions();

    const isUsingRecommendedSettings =
        printSizeSelect.value === recommendedPrintConfig.size &&
        printOrientationSelect.value === recommendedPrintConfig.orientation &&
        printMarginSelect.value === recommendedPrintConfig.margin;

    const marginType = printMarginSelect.value;
    const marginMapMm = { standard: 3.5, wide: 8, narrow: 1.5 };
    const marginMm = marginMapMm[marginType] ?? 3.5;

    const pad = { v: 6, h: 8 };

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
            ? `Winners side qualifier: ${wCount}`
            : `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`);

    batchPrintContainer.innerHTML = '';
    batchPrintContainer.classList.remove('hidden');
    batchPrintContainer.style.cssText = 'position: fixed; left: -99999px; top: 0; z-index: -1; background: #ffffff;';

    try {
        const { jsPDF } = window.jspdf;
        let pdf = null;

        for (let idx = 0; idx < targetPoolNames.length; idx++) {
            const pName = targetPoolNames[idx];
            const poolObj = poolsData[pName];
            if (!poolObj) continue;

            if (triggerBtn) {
                triggerBtn.textContent = targetPoolNames.length > 1
                    ? `PDF生成中... (${idx + 1}/${targetPoolNames.length})`
                    : 'PDF生成中...';
            }

            // 推奨設定モード時は各プールの有効人数（6〜12人:A4横 / 13〜24人:A3横 / 25〜40人:A3縦）を適用
            let pageSize = printSizeSelect.value;
            let pageOrientation = printOrientationSelect.value;
            if (isUsingRecommendedSettings) {
                const effCount = getEffectivePlayerCountForPool(pName);
                const poolRec = getRecommendedPrintSettings(effCount, elimFormatSelect.value || 'double');
                pageSize = poolRec.size;
                pageOrientation = poolRec.orientation;
            }

            const dim = paperDimensionsMm[pageSize] || paperDimensionsMm.A3;
            const pageW_mm = pageOrientation === 'landscape' ? dim.long : dim.short;
            const pageH_mm = pageOrientation === 'landscape' ? dim.short : dim.long;
            const availW_mm = Math.max(20, pageW_mm - marginMm * 2);
            const availH_mm = Math.max(20, pageH_mm - marginMm * 2);

            if (!pdf) {
                pdf = new jsPDF({
                    orientation: pageOrientation === 'landscape' ? 'l' : 'p',
                    unit: 'mm',
                    format: [pageW_mm, pageH_mm],
                    compress: true
                });
            } else {
                pdf.addPage([pageW_mm, pageH_mm], pageOrientation === 'landscape' ? 'l' : 'p');
            }

            batchPrintContainer.innerHTML = '';
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

            const { canvasWidth, canvasHeight } = buildBracketSheetContent(pName, bContainer, rContainer, sheet, pageOrientation);
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

            batchPrintContainer.appendChild(sheet);

            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const dataUrl = await captureSheetElementToJpeg(sheet, canvasWidth, canvasHeight, 2, true);

            const ratio = Math.min(availW_mm / canvasWidth, availH_mm / canvasHeight);
            const drawW_mm = canvasWidth * ratio;
            const drawH_mm = canvasHeight * ratio;
            const offsetX_mm = (pageW_mm - drawW_mm) / 2;
            const offsetY_mm = (pageH_mm - drawH_mm) / 2;

            pdf.addImage(dataUrl, 'JPEG', offsetX_mm, offsetY_mm, drawW_mm, drawH_mm, undefined, 'FAST');
        }

        if (pdf) {
            pdf.save(downloadFileName);
        }
    } catch (err) {
        console.error('PDF直接生成エラー:', err);
        showInlineError(exportErrorMsg, 'PDFファイルの生成に失敗しました。');
    } finally {
        batchPrintContainer.innerHTML = '';
        batchPrintContainer.classList.add('hidden');
        batchPrintContainer.style.cssText = '';
        isPrintingMode = false;
        if (triggerBtn) triggerBtn.textContent = originalBtnText;
        [exportJpgBtn, exportPdfBtn, exportAllPdfBtn].forEach(b => { if (b) b.disabled = false; });
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

    const btn = document.getElementById('export-pdf-btn');
    downloadPoolsAsPdfDirect([selectedPoolName], btn, `Pool_${selectedPoolName}.pdf`);
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

    const tName = tournamentNameInput ? tournamentNameInput.value.trim().replace(/[\\/:*?"<>|]/g, '_') : '';
    const fileName = tName ? `${tName}_All_Pools.pdf` : 'All_Pools.pdf';
    const btn = document.getElementById('export-all-pdf-btn');
    downloadPoolsAsPdfDirect(poolKeys, btn, fileName);
});
