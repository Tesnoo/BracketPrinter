// ... existing code ...
const SLOT_HEIGHT_24 = 80;
const WINNERS_SLOT_HEIGHT_32 = 88;
const LOSERS_SLOT_HEIGHT_32 = 90;
const ROUND_HEADER_TOTAL_HEIGHT = 34;

const AUTOSAVE_STORAGE_KEY = 'bracket_printer_autosave_v1';
let hasSessionBeenDrawnOrRestored = false;

let recommendedPrintConfig = {
    size: 'A3',
    orientation: 'landscape',
    margin: 'standard',
    reason: '13〜24人 ダブルエリミの推奨設定'
};
// ... existing code ...
// === DOM要素参照 ===
const presetSelect = document.getElementById('preset-select');
const loadPresetBtn = document.getElementById('load-bp-btn') || document.getElementById('load-preset-btn');
const loadPresetFileInput = document.getElementById('load-bp-input') || document.getElementById('load-preset-file-input');
const presetLoadStatus = document.getElementById('preset-bp-status') || document.getElementById('preset-load-status');
const createPresetBtn = document.getElementById('save-bp-btn') || document.getElementById('create-preset-btn');

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
const restoreSessionBtn = document.getElementById('restore-session-btn');
const restoreSessionStatus = document.getElementById('restore-session-status');
const generateErrorMsg = document.getElementById('generate-error-msg');

const winnersAdvanceCount = document.getElementById('winners-advance-count');
// ... existing code ...
const clearDqOverridesBtn = document.getElementById('clear-dq-overrides-btn');
const clearStreamOverridesBtn = document.getElementById('clear-stream-overrides-btn');
const matchOverridesCountBadge = document.getElementById('match-overrides-count-badge');
const matchOverridesSummaryList = document.getElementById('match-overrides-summary-list');

const matchEditModal = document.getElementById('match-edit-modal');
// ... existing code ...
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
// ... existing code ...
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
// ... existing code ...
        const aliasQueries = chunk.map((g, idx) => `
            g${idx}: phaseGroup(id: ${Number(g.id)}) {
                id
                sets(page: 1, perPage: 100, sortType: STANDARD) {
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
                seeds(query: { page: 1, perPage: 64 }) {
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
// ... existing code ...
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        box.remove();
        saveCurrentSessionToStorage();
    });

    content.addEventListener('input', () => {
        saveCurrentSessionToStorage();
    });

    let isDragging = false;
// ... existing code ...
    window.addEventListener('mouseup', () => {
        if (isDragging && hasMovedDuringDrag) {
            saveCurrentSessionToStorage();
        }
        isDragging = false;
    });
// ... existing code ...
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
// ... existing code ...
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
// ... existing code ...
    // =========================================================
    // パターンS: 33〜48人規模（Winners Round 1〜3 / Losers Round 1〜6）
    // =========================================================
    if (playerCount >= 33) {
        const wr1_topPairs = [
            { s1: 32, s2: 33 }, { s1: 25, s2: 40 }, { s1: 29, s2: 36 }, { s1: 28, s2: 37 },
            { s1: 31, s2: 34 }, { s1: 26, s2: 39 }, { s1: 30, s2: 35 }, { s1: 27, s2: 38 }
        ];
        const wr1_botPairs = [
            { s1: 17, s2: 48 }, { s1: 24, s2: 41 }, { s1: 20, s2: 45 }, { s1: 21, s2: 44 },
            { s1: 18, s2: 47 }, { s1: 23, s2: 42 }, { s1: 19, s2: 46 }, { s1: 22, s2: 43 }
        ];
        const wr2_topSeeds = [1, 8, 4, 5, 2, 7, 3, 6];
        const wr2_botSeeds = [16, 9, 13, 12, 15, 10, 14, 11];

        const wr1 = createRoundColumn(`Winners Round 1 ${getBoStringForRound('W', 'Winners Round 1', playerCount)}`);
        const wr1TopActiveLabels = new Array(8).fill(null);
        const wr1BotActiveLabels = new Array(8).fill(null);

        for (let i = 0; i < 8; i++) {
            const pairGroup = createElement('div', 'pair-group');
            const topSlot = wr1_topPairs[i];
            const botSlot = wr1_botPairs[i];

            if (playerCount >= topSlot.s2) {
                const lblTop = nextMatchLabel();
                wr1TopActiveLabels[i] = lblTop;
                pairGroup.appendChild(createInteractiveMatchNode(lblTop, pMap[topSlot.s1] || '', pMap[topSlot.s2] || '', String(topSlot.s1), String(topSlot.s2), 'none', '', '', 'W'));
            } else {
                const topSpacer = createElement('div', 'match-wrapper');
                topSpacer.appendChild(createElement('div', 'dummy-spacer-box'));
                pairGroup.appendChild(topSpacer);
            }

            if (playerCount >= botSlot.s2) {
                const lblBot = nextMatchLabel();
                wr1BotActiveLabels[i] = lblBot;
                pairGroup.appendChild(createInteractiveMatchNode(lblBot, pMap[botSlot.s1] || '', pMap[botSlot.s2] || '', String(botSlot.s1), String(botSlot.s2), 'none', '', '', 'W'));
            } else {
                const botSpacer = createElement('div', 'match-wrapper');
                botSpacer.appendChild(createElement('div', 'dummy-spacer-box'));
                pairGroup.appendChild(botSpacer);
            }

            wr1.appendChild(pairGroup);
        }

        const wr2 = createRoundColumn(`Winners Round 2 ${getBoStringForRound('W', 'Winners Round 2', playerCount)}`);
        const wr2TopLabels = new Array(8).fill(null);
        const wr2BotLabels = new Array(8).fill(null);

        for (let i = 0; i < 8; i++) {
            const pairGroup = createElement('div', 'pair-group');
            const topSeed = wr2_topSeeds[i];
            const botSeed = wr2_botSeeds[i];
            const topWr1Pair = wr1_topPairs[i];
            const botWr1Pair = wr1_botPairs[i];

            const lblTop = nextMatchLabel();
            wr2TopLabels[i] = lblTop;
            if (wr1TopActiveLabels[i] !== null) {
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblTop, pMap[topSeed] || '', '', String(topSeed), '', 'straight', '', '', 'W')
                );
            } else {
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblTop, pMap[topSeed] || '', pMap[topWr1Pair.s1] || '', String(topSeed), String(topWr1Pair.s1), 'none', '', '', 'W')
                );
            }

            const lblBot = nextMatchLabel();
            wr2BotLabels[i] = lblBot;
            if (wr1BotActiveLabels[i] !== null) {
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblBot, pMap[botSeed] || '', '', String(botSeed), '', 'straight', '', '', 'W')
                );
            } else {
                pairGroup.appendChild(
                    createInteractiveMatchNode(lblBot, pMap[botSeed] || '', pMap[botWr1Pair.s1] || '', String(botSeed), String(botWr1Pair.s1), 'none', '', '', 'W')
                );
            }

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

        // 33〜48人規模 Losers Bracket
        if (!isSingle && (isGfMode || lCountNum > 0)) {
            const lr1 = createRoundColumn(`Losers Round 1 ${getBoStringForRound('L', 'Losers Round 1', playerCount)}`);
            const lr2 = createRoundColumn(`Losers Round 2 ${getBoStringForRound('L', 'Losers Round 2', playerCount)}`);
            const lr3 = createRoundColumn(`Losers Round 3 ${getBoStringForRound('L', 'Losers Round 3', playerCount)}`);
            const lr4 = createRoundColumn(`Losers Round 4 ${getBoStringForRound('L', 'Losers Round 4', playerCount)}`);

            const lr1TopActive = new Array(8).fill(null);
            const lr1BotActive = new Array(8).fill(null);

            for (let i = 0; i < 8; i++) {
                const hasTopWr1 = wr1TopActiveLabels[i] !== null;
                const hasBotWr1 = wr1BotActiveLabels[i] !== null;
                const wr2TopLoser = wr2TopLabels[7 - i];
                const wr2BotLoser = wr2BotLabels[7 - i];

                if (hasTopWr1 && hasBotWr1) {
                    const pairGroup = createElement('div', 'pair-group');
                    const lbl1 = nextMatchLabel();
                    lr1TopActive[i] = lbl1;
                    pairGroup.appendChild(createInteractiveMatchNode(lbl1, '', '', '', '', 'none', `Loser of ${wr2BotLoser}`, `Loser of ${wr1TopActiveLabels[i]}`, 'L'));

                    const lbl2 = nextMatchLabel();
                    lr1BotActive[i] = lbl2;
                    pairGroup.appendChild(createInteractiveMatchNode(lbl2, '', '', '', '', 'none', `Loser of ${wr2TopLoser}`, `Loser of ${wr1BotActiveLabels[i]}`, 'L'));
                    lr1.appendChild(pairGroup);
                } else if (hasTopWr1) {
                    const lbl = nextMatchLabel();
                    lr1TopActive[i] = lbl;
                    lr1.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'none', `Loser of ${wr2BotLoser}`, `Loser of ${wr1TopActiveLabels[i]}`, 'L'));
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
                if (lr1TopActive[i] !== null && lr1BotActive[i] !== null) {
                    lr2.appendChild(createInteractiveMatchNode(lbl, '', '', '', '', 'branch', '', '', 'L'));
                } else if (lr1TopActive[i] !== null) {
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
// ... existing code ...
            } else if (prevUnits.length === currUnits.length) {
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
                    } else if (currMatches.length === 2 && prevMatches.length === 2) {
                        for (let mIdx = 0; mIdx < 2; mIdx++) {
                            const prevRec = prevMatches[mIdx];
                            const targetRec = currMatches[mIdx];
                            if (prevRec && targetRec && !winnerTargetByMatch[prevRec.matchLabel]) {
                                const slot1Occupied = targetRec.p1NameSpan.textContent.trim() !== '' || targetRec.topLabel !== '';
                                const targetSlot = slot1Occupied ? 2 : 1;
                                winnerTargetByMatch[prevRec.matchLabel] = { targetLabel: targetRec.matchLabel, slot: targetSlot };
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
// ... existing code ...
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
// ... existing code ...
