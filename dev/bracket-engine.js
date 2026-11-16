// =========================================================================
// 🏆 Bracket Printer - ブラケット描画・レイアウト計算エンジン (bracket-engine.js)
//    6〜48名（ダブルエリミ / シングルエリミ）のDOM構築・DQ自動進行・用紙収まり計算
// =========================================================================

const SLOT_HEIGHT_24 = 80;
const WINNERS_SLOT_HEIGHT_32 = 88;
const LOSERS_SLOT_HEIGHT_32 = 90;
const ROUND_HEADER_TOTAL_HEIGHT = 34;

// === HTML要素生成ヘルパー ===
function createElement(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function indexToMatchLabel(idx) {
    let n = idx;
    let label = '';
    while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    }
    return label;
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

function createQualifierNode(matchSourceLabel, targetPhase, targetType = 'W', isSingleElim = false) {
    const fullTextW = isSingleElim ? targetPhase : `${targetPhase} [W]`;
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

// === フェーズ通過までに実際に存在するラウンド一覧を算出する関数（6〜48名対応） ===
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

        if (effW === 4 && isFinalWLoserDirectQual) return { winnersRounds, losersRounds };
        losersRounds.push(rNames.wqfDrop);
        if (targetLosersBracketQuals >= 4) return { winnersRounds, losersRounds };
        losersRounds.push(rNames.consolidate2);
        if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) return { winnersRounds, losersRounds };
        if (effW === 4 && targetLosersBracketQuals === 1) {
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (effW === 2 && targetLosersBracketQuals === 2) return { winnersRounds, losersRounds };
        if (effW === 1 && isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) return { winnersRounds, losersRounds };
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if (effW === 2 && targetLosersBracketQuals === 1) return { winnersRounds, losersRounds };
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

        if (effW === 4 && isFinalWLoserDirectQual) return { winnersRounds, losersRounds };
        losersRounds.push(rNames.wqfDrop);
        if (targetLosersBracketQuals >= 4) return { winnersRounds, losersRounds };
        losersRounds.push(rNames.consolidate2);
        if ((effW === 2 && isFinalWLoserDirectQual) || (effW === 4 && targetLosersBracketQuals === 2)) return { winnersRounds, losersRounds };
        if (effW === 4 && targetLosersBracketQuals === 1) {
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.wsfDrop);
        if (effW === 2 && targetLosersBracketQuals === 2) return { winnersRounds, losersRounds };
        if (effW === 1 && isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) return { winnersRounds, losersRounds };
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if (effW === 2 && targetLosersBracketQuals === 1) return { winnersRounds, losersRounds };
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

        if (effW === 4 && isFinalWLoserDirectQual) return { winnersRounds, losersRounds };
        if (effW === 4) {
            if (targetLosersBracketQuals === 2) return { winnersRounds, losersRounds };
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        if (effW === 2 && isFinalWLoserDirectQual) return { winnersRounds, losersRounds };
        losersRounds.push(rNames.wsfDrop);
        if (effW === 2 && targetLosersBracketQuals === 2) return { winnersRounds, losersRounds };
        if (effW === 1 && isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) return { winnersRounds, losersRounds };
            losersRounds.push(rNames.consolidate1);
            return { winnersRounds, losersRounds };
        }
        losersRounds.push(rNames.consolidate1);
        if (effW === 2 && targetLosersBracketQuals === 1) return { winnersRounds, losersRounds };
        losersRounds.push(rNames.wfDrop);
        return { winnersRounds, losersRounds };
    } else {
        losersRounds = ['Losers Round 1'];
        if (effW >= 2 && isFinalWLoserDirectQual) return { winnersRounds, losersRounds };
        if (effW >= 2) {
            losersRounds.push('Losers Semi-Final');
            return { winnersRounds, losersRounds };
        }
        if (isFinalWLoserDirectQual) {
            if (targetLosersBracketQuals >= 2) return { winnersRounds, losersRounds };
            losersRounds.push('Losers Semi-Final');
            return { winnersRounds, losersRounds };
        }
        losersRounds.push('Losers Semi-Final', 'Losers Final');
        return { winnersRounds, losersRounds };
    }
}

// === 特定のPoolのブラケットDOM一式を構築するコア関数（6〜48名・ダブル/シングル両対応） ===
function buildBracketSheetContent(poolName, bracketContainerEl, rosterContainerEl, targetSheetEl = previewArea) {
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

    // ★重要修正：41〜48人の時は敗者側（LR1）も最大16試合になるため、losersSlots = 16 として勝者側と1:1で高さを配分する
    let winnersSlots = 8;
    let losersSlots = 4;
    let wSlotUnit = SLOT_HEIGHT_24;
    let lSlotUnit = SLOT_HEIGHT_24;

    if (playerCount >= 41) {
        winnersSlots = 16;
        losersSlots = 16;
        wSlotUnit = 64;
        lSlotUnit = 64;
    } else if (playerCount >= 25) {
        winnersSlots = 16;
        losersSlots = 8;
        wSlotUnit = WINNERS_SLOT_HEIGHT_32;
        lSlotUnit = LOSERS_SLOT_HEIGHT_32;
    } else if (playerCount >= 17) {
        winnersSlots = 8;
        losersSlots = 8;
    } else if (playerCount >= 9) {
        winnersSlots = (playerCount >= 13) ? 8 : 4;
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
            lQual.appendChild(createQualifierNode(src, targetPhaseName, 'L', false));
        });
        lContainer.appendChild(lQual);
    };

    const appendWinnersStopQualifiers = (matchLabels) => {
        const wQualType = isSingle ? 'W_ONLY' : (isFinalWLoserDirectQual ? 'W' : 'W_ONLY');
        const wQual = createRoundColumn('', true);
        matchLabels.forEach(lbl => {
            wQual.appendChild(createQualifierNode(lbl, targetPhaseName, wQualType, isSingle));
        });
        wContainer.appendChild(wQual);
    };

    let wfMatchLabelForGf = '';
    let lfMatchLabelForGf = '';
    let reservedGfLabel = '';
    let reservedGfResetLabel = '';

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
                reservedGfLabel = indexToMatchLabel(currentMatchIdx);
                reservedGfResetLabel = indexToMatchLabel(currentMatchIdx + 1);
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

            const wqfDropCol = () => createRoundColumn(`Losers Round 5 ${getBoStringForRound('L', 'Losers Round 5', playerCount)}`);
            const consolidate2Col = () => createRoundColumn(`Losers Round 6 ${getBoStringForRound('L', 'Losers Round 6', playerCount)}`);
            const wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
            const consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
            const wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);

            if (effW === 4 && isFinalWLoserDirectQual) {
                appendLosersQualifiersColumn(lr4Labels);
            } else {
                const colWqfDrop = wqfDropCol();
                const wqfDropOrder = [wqfLabels[2], wqfLabels[3], wqfLabels[0], wqfLabels[1]];
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
                        const wsfDropOrder = [wsfLabels[0], wsfLabels[1]];
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
                reservedGfLabel = indexToMatchLabel(currentMatchIdx);
                reservedGfResetLabel = indexToMatchLabel(currentMatchIdx + 1);
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
                    reservedGfLabel = indexToMatchLabel(currentMatchIdx);
                    reservedGfResetLabel = indexToMatchLabel(currentMatchIdx + 1);
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

                const wqfDropCol = () => createRoundColumn(`Losers Round 4 ${getBoStringForRound('L', 'Losers Round 4', playerCount)}`);
                const consolidate2Col = () => createRoundColumn(`Losers Round 5 ${getBoStringForRound('L', 'Losers Round 5', playerCount)}`);
                const wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
                const consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
                const wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);

                if (effW === 4 && isFinalWLoserDirectQual) {
                    appendLosersQualifiersColumn(lr3Labels32);
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

            const wqfDropCol = () => createRoundColumn(`Losers Round 3 ${getBoStringForRound('L', 'Losers Round 3', playerCount)}`);
            const consolidate2Col = () => createRoundColumn(`Losers Round 4 ${getBoStringForRound('L', 'Losers Round 4', playerCount)}`);
            const wsfDropCol = () => createRoundColumn(`Losers Quarter-Final ${getBoStringForRound('L', 'Losers Quarter-Final', playerCount)}`);
            const consolidate1Col = () => createRoundColumn(`Losers Semi-Final ${getBoStringForRound('L', 'Losers Semi-Final', playerCount)}`);
            const wfDropCol = () => createRoundColumn(`Losers Final ${getBoStringForRound('L', 'Losers Final', playerCount)}`);

            if (effW === 4 && isFinalWLoserDirectQual) {
                appendLosersQualifiersColumn(lr2Labels);
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
                reservedGfLabel = indexToMatchLabel(currentMatchIdx);
                reservedGfResetLabel = indexToMatchLabel(currentMatchIdx + 1);
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
            reservedGfLabel = indexToMatchLabel(currentMatchIdx);
            reservedGfResetLabel = indexToMatchLabel(currentMatchIdx + 1);
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

    // === Grand Final & Grand Final Reset の追加（ダブルエリミ W0L0時） ===
    if (isGfMode && !isSingle && wfMatchLabelForGf) {
        const gfLabel = reservedGfLabel || nextMatchLabel();
        const gfResetLabel = reservedGfResetLabel || nextMatchLabel();

        const gfCol = createRoundColumn(`Grand Final ${getBoStringForRound('W', 'Grand Final', playerCount)}`);
        const bottomLabelText = lfMatchLabelForGf ? `Winner of ${lfMatchLabelForGf}` : '';
        gfCol.appendChild(createInteractiveMatchNode(gfLabel, '', '', '', '', 'straight', '', bottomLabelText, 'W'));
        wContainer.appendChild(gfCol);

        const gfResetCol = createRoundColumn(`Grand Final Reset ${getBoStringForRound('W', 'Grand Final Reset', playerCount)}`);
        gfResetCol.appendChild(createInteractiveMatchNode(gfResetLabel, '', '', '', '', 'straight', `Winner of ${gfLabel}`, `Loser of ${gfLabel}`, 'W'));
        wContainer.appendChild(gfResetCol);
    }

    // =========================================================
    // トーナメント全体の接続グラフ構築（pair-group対応・DQ自動進行・落下）
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

            if (prevUnits.length === 8 && currUnits.length === 4) {
                for (let p = 0; p < 4; p++) {
                    const topPrev = getMatchesInSlotUnit(prevUnits[2 * p])[0];
                    const botPrev = getMatchesInSlotUnit(prevUnits[2 * p + 1])[0];
                    const currMatches = getMatchesInSlotUnit(currUnits[p]);

                    if (currMatches.length === 2) {
                        if (topPrev && !winnerTargetByMatch[topPrev.matchLabel]) {
                            const s1Occ = currMatches[0].p1NameSpan.textContent.trim() !== '' || currMatches[0].topLabel !== '';
                            winnerTargetByMatch[topPrev.matchLabel] = { targetLabel: currMatches[0].matchLabel, slot: s1Occ ? 2 : 1 };
                        }
                        if (botPrev && !winnerTargetByMatch[botPrev.matchLabel]) {
                            const s1Occ = currMatches[1].p1NameSpan.textContent.trim() !== '' || currMatches[1].topLabel !== '';
                            winnerTargetByMatch[botPrev.matchLabel] = { targetLabel: currMatches[1].matchLabel, slot: s1Occ ? 2 : 1 };
                        }
                    } else if (currMatches.length === 1) {
                        const currRec = currMatches[0];
                        const isBranch = currRec.wrapper.classList.contains('branch-line');
                        if (isBranch) {
                            if (topPrev && !winnerTargetByMatch[topPrev.matchLabel]) {
                                winnerTargetByMatch[topPrev.matchLabel] = { targetLabel: currRec.matchLabel, slot: 1 };
                            }
                            if (botPrev && !winnerTargetByMatch[botPrev.matchLabel]) {
                                winnerTargetByMatch[botPrev.matchLabel] = { targetLabel: currRec.matchLabel, slot: 2 };
                            }
                        } else {
                            const activePrev = topPrev || botPrev;
                            if (activePrev && !winnerTargetByMatch[activePrev.matchLabel]) {
                                const s1Occ = currRec.p1NameSpan.textContent.trim() !== '' || currRec.topLabel !== '';
                                winnerTargetByMatch[activePrev.matchLabel] = { targetLabel: currRec.matchLabel, slot: s1Occ ? 2 : 1 };
                            }
                        }
                    }
                }
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

    // === 配信台ラベル反映（チャンネル名のみ表示）＆ クリックイベント登録 ===
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

    // =========================================================
    // 📐 用紙サイズ・スリム幅・41〜48人時の16:16均等配分計算
    // =========================================================
    const refCount = getEffectiveReferencePlayerCount(playerCount);
    const isPortraitMode = printOrientationSelect ? (printOrientationSelect.value === 'portrait') : (refCount >= 25);
    let boxHeightPx = 48;
    let colWidthPx = 244;
    let colGapPx = 22;
    let labelWidthPx = 25;
    let checkboxWidthPx = 27;
    let playerFontPx = 14.5;
    let playerPadXPx = 6;
    let dropLabelFontPx = 11;
    let dropLabelOffsetPx = -13;
    let seedLabelFontPx = 10.5;
    let seedLabelOffsetPx = -11;

    const wColsCount = wContainer.children.length;
    const lColsCount = (!isSingle && (isGfMode || lCountNum > 0)) ? lContainer.children.length : 0;

    if (isPortraitMode) {
        if (playerCount >= 41 && lColsCount > 0) {
            // ★41〜48人ダブルエリミ：勝者16段＋敗者16段（計32段）をA3縦1枚に余裕をもって収める専用設定
            boxHeightPx = 39;
            colWidthPx = 188;
            colGapPx = 14;
            labelWidthPx = 20;
            checkboxWidthPx = 20;
            playerFontPx = 11.5;
            playerPadXPx = 4;
            dropLabelFontPx = 9.5;
            dropLabelOffsetPx = -11;
            seedLabelFontPx = 9.5;
            seedLabelOffsetPx = -10;
            wSlotUnit = 64;
            lSlotUnit = 64;
        } else if (playerCount >= 33) {
            boxHeightPx = 46;
            colWidthPx = 188;
            colGapPx = 14;
            labelWidthPx = 20;
            checkboxWidthPx = 20;
            playerFontPx = 12;
            playerPadXPx = 4;
            wSlotUnit = 86;
            lSlotUnit = 88;
        } else if (playerCount >= 25) {
            boxHeightPx = 54;
            colWidthPx = 224;
            colGapPx = 16;
            labelWidthPx = 22;
            checkboxWidthPx = 22;
            playerFontPx = 13;
            playerPadXPx = 5;
            wSlotUnit = WINNERS_SLOT_HEIGHT_32;
            lSlotUnit = LOSERS_SLOT_HEIGHT_32;
        } else {
            boxHeightPx = 56;
            colWidthPx = 232;
            colGapPx = 18;
            wSlotUnit = 110;
            lSlotUnit = 105;
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

    let winnersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (winnersSlots * wSlotUnit);
    let losersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (losersSlots * lSlotUnit);
    let bracketGapPx = (!isSingle && (isGfMode || lCountNum > 0)) ? (isPortraitMode ? (playerCount >= 41 ? 34 : 44) : 28) : 0;

    const rosterEstimatedHeight = 36 + (playerCount * 25) + (pendingLogoDataUrl ? 165 : 10);

    let totalCanvasWidth = 2362;
    let totalCanvasHeight = 1670;

    if (isPortraitMode) {
        const wRowWidth = (wColsCount * (colWidthPx + colGapPx)) + 356 + 24;
        const lRowWidth = (lColsCount * (colWidthPx + colGapPx)) + 20;
        const rawNeedW = Math.max(1680, wRowWidth, lRowWidth);
        const initialBodyHeight = Math.max(winnersHeightPx + (lColsCount > 0 ? bracketGapPx + losersHeightPx : 0), rosterEstimatedHeight);
        const rawNeedH = Math.max(2360, initialBodyHeight + 76);

        totalCanvasWidth = Math.max(rawNeedW, Math.round(rawNeedH / Math.SQRT2));
        totalCanvasHeight = Math.round(totalCanvasWidth * Math.SQRT2);

        const availableBodyH = totalCanvasHeight - 82;
        const currentTotalBracketH = winnersHeightPx + (lColsCount > 0 ? bracketGapPx + losersHeightPx : 0);

        if (availableBodyH > currentTotalBracketH + 20) {
            if (lColsCount > 0) {
                bracketGapPx = playerCount >= 41 ? 38 : 54;
                const usableH = availableBodyH - bracketGapPx - (ROUND_HEADER_TOTAL_HEIGHT * 2);
                const totalUnits = winnersSlots + losersSlots;
                const expandedUnit = Math.floor(usableH / totalUnits);
                wSlotUnit = Math.max(wSlotUnit, expandedUnit);
                lSlotUnit = Math.max(lSlotUnit, expandedUnit);
                const maxBoxH = playerCount >= 41 ? 42 : 62;
                boxHeightPx = Math.min(maxBoxH, Math.max(boxHeightPx, Math.floor(expandedUnit * 0.56)));
                winnersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (winnersSlots * wSlotUnit);
                losersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (losersSlots * lSlotUnit);
            } else {
                const usableH = availableBodyH - ROUND_HEADER_TOTAL_HEIGHT;
                wSlotUnit = Math.max(wSlotUnit, Math.floor(usableH / winnersSlots));
                boxHeightPx = Math.min(66, Math.max(boxHeightPx, Math.floor(wSlotUnit * 0.52)));
                winnersHeightPx = ROUND_HEADER_TOTAL_HEIGHT + (winnersSlots * wSlotUnit);
            }
        }
    } else {
        const maxCols = Math.max(wColsCount, lColsCount);
        const estimatedBracketWidth = maxCols * (colWidthPx + colGapPx);
        const rawNeedW = Math.max(2362, estimatedBracketWidth + 356 + 40);
        const initialBodyHeight = Math.max(winnersHeightPx + (lColsCount > 0 ? bracketGapPx + losersHeightPx : 0), rosterEstimatedHeight);
        const rawNeedH = Math.max(1670, initialBodyHeight + 76);

        totalCanvasWidth = Math.max(rawNeedW, Math.round(rawNeedH * Math.SQRT2));
        totalCanvasHeight = Math.round(totalCanvasWidth / Math.SQRT2);
    }

    targetSheetEl.style.setProperty('--match-box-h', `${boxHeightPx}px`);
    targetSheetEl.style.setProperty('--col-w', `${colWidthPx}px`);
    targetSheetEl.style.setProperty('--col-gap', `${colGapPx}px`);
    targetSheetEl.style.setProperty('--label-w', `${labelWidthPx}px`);
    targetSheetEl.style.setProperty('--checkbox-w', `${checkboxWidthPx}px`);
    targetSheetEl.style.setProperty('--player-font', `${playerFontPx}px`);
    targetSheetEl.style.setProperty('--player-pad-x', `${playerPadXPx}px`);
    targetSheetEl.style.setProperty('--drop-label-font', `${dropLabelFontPx}px`);
    targetSheetEl.style.setProperty('--drop-label-offset', `${dropLabelOffsetPx}px`);
    targetSheetEl.style.setProperty('--seed-label-font', `${seedLabelFontPx}px`);
    targetSheetEl.style.setProperty('--seed-label-offset', `${seedLabelOffsetPx}px`);

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
