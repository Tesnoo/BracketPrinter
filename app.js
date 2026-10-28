// === グローバル状態管理（CSVデータ・設定値） ===
let poolsData = {}; // { poolName: { count: number, playersBySeed: { [seed]: { gamerTag, shortGamerTag } } } }
let isCsvValid = false;
let baseBoValue = '';
let isCustomBoConfirmed = false;

const csvUpload = document.getElementById('csv-upload');
const csvStatus = document.getElementById('csv-status');
const poolSelectWrapper = document.getElementById('pool-select-wrapper');
const poolSelect = document.getElementById('pool-select');
const generateBtn = document.getElementById('generate-btn');
const winnersAdvanceCount = document.getElementById('winners-advance-count');
const losersAdvanceCount = document.getElementById('losers-advance-count');
const baseBoSelect = document.getElementById('base-bo-select');
const targetPhaseInput = document.getElementById('target-phase-input');

// === 入力バリデーションと描画ボタンの有効化連動 ===
function validateForm() {
    const wVal = winnersAdvanceCount.value;
    const lVal = losersAdvanceCount.value;
    const boVal = baseBoSelect.value;
    const isBoReady = (boVal === '5' || boVal === '3' || (boVal === 'custom' && isCustomBoConfirmed));
    const phaseVal = targetPhaseInput.value.trim();

    if (isCsvValid && wVal && lVal && isBoReady && phaseVal !== '') {
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
        isCsvValid = false;
        poolsData = {};
        csvStatus.classList.add('hidden');
        poolSelectWrapper.classList.add('hidden');
        validateForm();
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

            // 1行目のヘッダー検証 (C1: index 2, D1: index 3, M1: index 12, N1: index 13)
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

            // 2行目以降のデータをPoolごとに集計
            const parsedPools = {};
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const poolName = (row[2] || '').trim();
                const seedStr = (row[3] || '').trim();
                if (!poolName || !seedStr) continue;

                const seed = parseInt(seedStr, 10);
                if (isNaN(seed)) continue;

                const gamerTag = (row[12] || '').trim();
                const shortGamerTag = (row[13] || '').trim();

                if (!parsedPools[poolName]) {
                    parsedPools[poolName] = {
                        count: 0,
                        playersBySeed: {}
                    };
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

            // プール選択プルダウンの構築
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
            csvStatus.textContent = `✅ 読み込み完了: Pool ${firstPool} (${parsedPools[firstPool].count}人)`;
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
        csvStatus.textContent = `✅ 選択中: Pool ${selected} (${poolsData[selected].count}人)`;
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

// === 手順3のロジック (基本Bo設定と奇数チェック) ===
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

// === 手順4のロジック ===
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
    if (e.target.value === 'custom') {
        winnersCustomInput.classList.remove('hidden');
    } else {
        winnersCustomInput.classList.add('hidden');
        winnersCustomInput.value = '';
    }
});
winnersCustomInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

losersBoSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        losersCustomInput.classList.remove('hidden');
    } else {
        losersCustomInput.classList.add('hidden');
        losersCustomInput.value = '';
    }
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
    'Losers Quarter-Final',
    'Losers Semi-Final'
];

function getRoundBo(roundBaseName, bracketType) {
    const isChangeYes = document.querySelector('input[name="change-mode"]:checked').value === 'yes';
    if (!isChangeYes) return baseBoValue;

    if (bracketType === 'winners') {
        const selectedStart = winnersRoundSelect.value;
        if (selectedStart === 'none') return baseBoValue;

        const startIndex = winnersRoundOrder.indexOf(selectedStart);
        const currentIndex = winnersRoundOrder.indexOf(roundBaseName);

        if (currentIndex >= startIndex) {
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

        const startIndex = losersRoundOrder.indexOf(selectedStart);
        const currentIndex = losersRoundOrder.indexOf(roundBaseName);

        if (currentIndex >= startIndex) {
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

// === アコーディオン開閉の制御 ===
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

// === HTML要素生成・ラベル変換ヘルパー ===
function createElement(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

// 0 -> 'A', 25 -> 'Z', 26 -> 'AA', 27 -> 'AB' ...
function indexToMatchLabel(index) {
    let label = '';
    let n = index;
    while (n >= 0) {
        label = String.fromCharCode(65 + (n % 26)) + label;
        n = Math.floor(n / 26) - 1;
    }
    return label;
}

// WR1で試合が無い箇所の空白スペーサー（高さを40pxボックスと完全一致させる）
function createSpacerNode() {
    const wrapper = createElement('div', 'match-wrapper');
    const dummyBox = createElement('div', '');
    dummyBox.style.height = '40px';
    wrapper.appendChild(dummyBox);
    return wrapper;
}

// === 1試合分のノード生成 ===
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

// === 予選抜け専用ノード生成 ===
function createQualifierNode(matchSourceLabel, targetPhase, targetType = 'W') {
    const wrapper = createElement('div', 'match-wrapper straight-line');
    const box = createElement('div', 'qualifier-box');
    
    box.appendChild(createElement('span', 'qual-drop-label-top', `Winner of ${matchSourceLabel}`));

    if (targetType === 'W') {
        const slot1 = createElement('div', 'qualifier-slot border-b border-black', `${targetPhase} [W]`);
        box.appendChild(slot1);
        const slot2 = createElement('div', 'qualifier-slot', `${targetPhase} [L]`);
        box.appendChild(slot2);
        box.appendChild(createElement('span', 'qual-drop-label-bottom', `Loser of ${matchSourceLabel}`));
    } else {
        box.style.height = '22px'; 
        box.appendChild(createElement('div', 'qualifier-slot', `${targetPhase} [L]`));
    }

    wrapper.appendChild(box);
    return wrapper;
}

// === ラウンド列生成 ===
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

// === ズームコントロール ===
const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const scaleWrapper = document.getElementById('preview-scale-wrapper');
const previewArea = document.getElementById('preview-area');
const viewport = document.getElementById('preview-viewport');

function setZoom(percent) {
    const scale = percent / 100;
    zoomSlider.value = percent;
    zoomValue.textContent = `${percent}%`;
    scaleWrapper.style.transform = `scale(${scale})`;
    scaleWrapper.style.width = `${previewArea.offsetWidth * scale}px`;
    scaleWrapper.style.height = `${previewArea.offsetHeight * scale}px`;
}

function fitToViewport() {
    const availableWidth = viewport.clientWidth - 48;
    const contentWidth = previewArea.offsetWidth;
    if (contentWidth > 0) {
        const bestPercent = Math.min(100, Math.max(30, Math.floor((availableWidth / contentWidth) * 100)));
        setZoom(bestPercent);
    }
}

zoomSlider.addEventListener('input', (e) => setZoom(Number(e.target.value)));
document.getElementById('zoom-reset-btn').addEventListener('click', () => setZoom(100));
document.getElementById('zoom-fit-btn').addEventListener('click', fitToViewport);
window.addEventListener('resize', fitToViewport);

// === 17〜24人ブラケット生成メイン処理 ===
generateBtn.addEventListener('click', () => {
    const selectedPoolName = poolSelect.value;
    const currentPool = poolsData[selectedPoolName];
    if (!currentPool) {
        alert('プールデータが見つかりません。CSVを再読み込みしてください。');
        return;
    }

    const playerCount = currentPool.count;
    if (playerCount < 17 || playerCount > 24) {
        alert(`現在のPool ${selectedPoolName} の人数は ${playerCount}人 です。（現在17〜24人トナメに対応しています）`);
        return;
    }

    const getPlayerName = (seed) => {
        const p = currentPool.playersBySeed[seed];
        return p ? p.shortGamerTag : '';
    };

    const targetPhaseName = targetPhaseInput.value.trim();
    const wCount = winnersAdvanceCount.value;
    const lCount = losersAdvanceCount.value;

    // ヘッダー更新
    document.getElementById('preview-placeholder').classList.add('hidden');
    document.getElementById('preview-header').classList.remove('hidden');
    document.getElementById('pool-title').textContent = `Pool ${selectedPoolName} - Double Elimination (${playerCount} players)`;
    document.getElementById('pool-subtitle').textContent = `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`;

    const container = document.getElementById('bracket-container');
    container.innerHTML = ''; 
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '28px'; 

    // マッチラベル採番カウンター
    let labelCounter = 0;
    const nextLabel = () => indexToMatchLabel(labelCounter++);

    // WR2の上段シード順 (合計17の基準となる1〜8シード)
    const wr2TopSeeds = [1, 8, 4, 5, 2, 7, 3, 6];
    // WR1のシードペア (上段 + 下段 = 33, WR2上段 + WR1上段 = 17)
    const wr1SeedPairs = wr2TopSeeds.map(s => {
        const wr1Top = 17 - s;
        const wr1Bot = 33 - wr1Top;
        return [wr1Top, wr1Bot];
    });

    // ==========================================
    // 1. Winners Bracket のラベル割当と構築
    // ==========================================
    const wContainer = createElement('div', 'bracket-container');
    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wr2 = createRoundColumn('Winners Round 2', 'winners');
    const wr3 = createRoundColumn('Winners Quarter-Final', 'winners');
    const wr4 = createRoundColumn('Winners Semi-Final', 'winners');
    const wr5 = createRoundColumn('Winners Final', 'winners');
    const wQual = createRoundColumn('', 'winners', true);

    // WR1: 対戦相手(wr1Bot)が playerCount 以下の場合のみ試合が存在する
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

    // WR2: WR1の試合がある場合は上段のみシード配置＋直線接続。WR1が無い場合はs1がWR2下段に入り接続線なし
    const wr2Labels = [];
    for (let i = 0; i < 8; i++) {
        const lbl = nextLabel();
        wr2Labels.push(lbl);
        const topSeed = wr2TopSeeds[i];
        const [wr1TopSeed, wr1BotSeed] = wr1SeedPairs[i];

        if (wr1Labels[i] !== null) {
            wr2.appendChild(createMatchNode(lbl, getPlayerName(topSeed), '', topSeed, '', 'straight'));
        } else {
            wr2.appendChild(createMatchNode(lbl, getPlayerName(topSeed), getPlayerName(wr1TopSeed), topSeed, wr1TopSeed, 'none'));
        }
    }

    // WQF (4試合)
    const wqfLabels = [];
    for (let i = 0; i < 4; i++) {
        const lbl = nextLabel();
        wqfLabels.push(lbl);
        wr3.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    // WSF (2試合)
    const wsfLabels = [];
    for (let i = 0; i < 2; i++) {
        const lbl = nextLabel();
        wsfLabels.push(lbl);
        wr4.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    // WF (1試合)
    const wfLabel = nextLabel();
    wr5.appendChild(createMatchNode(wfLabel, '', '', '', '', 'branch'));

    // 予選通過ノード (Winners)
    wQual.appendChild(createQualifierNode(wfLabel, targetPhaseName, 'W'));

    wContainer.append(wr1, wr2, wr3, wr4, wr5, wQual);

    // ==========================================
    // 2. Losers Bracket のラベル割当と構築
    // ==========================================
    // start.ggの採番規則に合わせ、WFの後に2文字分スキップしてからLR1を開始
    nextLabel();
    nextLabel();

    const lContainer = createElement('div', 'bracket-container');
    const lr1 = createRoundColumn('Losers Round 1', 'losers');
    const lr2 = createRoundColumn('Losers Round 2', 'losers');
    const lr3 = createRoundColumn('Losers Round 3', 'losers');
    const lr4 = createRoundColumn('Losers Round 4', 'losers');
    const lr5 = createRoundColumn('Losers Quarter-Final', 'losers');
    const lr6 = createRoundColumn('Losers Semi-Final', 'losers');
    const lQual = createRoundColumn('', 'losers', true);

    // LR1の各スロット(j = 0..7)のラベルを先に採番（WR1の試合が存在する箇所のみ）
    const lr1Labels = [];
    for (let j = 0; j < 8; j++) {
        if (wr1Labels[j] !== null) {
            lr1Labels.push(nextLabel());
        } else {
            lr1Labels.push(null);
        }
    }

    // LR2の4試合のラベルを採番
    const lr2Labels = [];
    for (let k = 0; k < 4; k++) {
        lr2Labels.push(nextLabel());
    }

    // LR1とLR2をペア単位(k = 0..3)で構築
    for (let k = 0; k < 4; k++) {
        const jTop = 2 * k;
        const jBot = 2 * k + 1;

        const wr2DropTop = wr2Labels[7 - jTop];
        const wr2DropBot = wr2Labels[7 - jBot];

        const hasTopLr1 = lr1Labels[jTop] !== null;
        const hasBotLr1 = lr1Labels[jBot] !== null;

        const pairGroup = createElement('div', 'lr1-pair-group');

        if (hasTopLr1 && hasBotLr1) {
            // 両方のLR1試合が存在する場合（音叉型でLR2へ接続）
            pairGroup.appendChild(
                createMatchNode(lr1Labels[jTop], '', '', '', '', 'none', `Loser of ${wr2DropTop}`, `Loser of ${wr1Labels[jTop]}`)
            );
            pairGroup.appendChild(
                createMatchNode(lr1Labels[jBot], '', '', '', '', 'none', `Loser of ${wr2DropBot}`, `Loser of ${wr1Labels[jBot]}`)
            );
            lr1.appendChild(pairGroup);

            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'branch'));
        } else if (hasTopLr1 && !hasBotLr1) {
            // 上側のみLR1試合が存在し、下側のWR2敗者がLR2下段へ直行する場合（直線接続）
            pairGroup.appendChild(
                createMatchNode(lr1Labels[jTop], '', '', '', '', 'none', `Loser of ${wr2DropTop}`, `Loser of ${wr1Labels[jTop]}`)
            );
            lr1.appendChild(pairGroup);

            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'straight', '', `Loser of ${wr2DropBot}`));
        } else {
            // 両方ともWR1試合が無い場合（WR2敗者2名がそのままLR2で対戦）
            lr1.appendChild(pairGroup);
            lr2.appendChild(createMatchNode(lr2Labels[k], '', '', '', '', 'none', `Loser of ${wr2DropTop}`, `Loser of ${wr2DropBot}`));
        }
    }

    // LR3: WQF(0, 1, 2, 3)から 2, 1, 4, 3 の順番 (index: 1, 0, 3, 2) で落下
    const lr3DropOrder = [wqfLabels[1], wqfLabels[0], wqfLabels[3], wqfLabels[2]];
    for (let k = 0; k < 4; k++) {
        const lbl = nextLabel();
        lr3.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${lr3DropOrder[k]}`));
    }

    // LR4 (2試合)
    for (let k = 0; k < 2; k++) {
        const lbl = nextLabel();
        lr4.appendChild(createMatchNode(lbl, '', '', '', '', 'branch'));
    }

    // LQF (2試合: WSFの 2, 1 の順で落下)
    const lqfDropOrder = [wsfLabels[1], wsfLabels[0]];
    for (let k = 0; k < 2; k++) {
        const lbl = nextLabel();
        lr5.appendChild(createMatchNode(lbl, '', '', '', '', 'straight', `Loser of ${lqfDropOrder[k]}`));
    }

    // LSF (1試合)
    const lsfLabel = nextLabel();
    lr6.appendChild(createMatchNode(lsfLabel, '', '', '', '', 'branch'));

    // 予選通過ノード (Losers)
    lQual.appendChild(createQualifierNode(lsfLabel, targetPhaseName, 'L'));

    lContainer.append(lr1, lr2, lr3, lr4, lr5, lr6, lQual);

    container.appendChild(wContainer);
    container.appendChild(lContainer);

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
        setZoom(currentZoom);
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// === PDF出力機能 ===
document.getElementById('export-pdf-btn').addEventListener('click', () => {
    window.print();
});
