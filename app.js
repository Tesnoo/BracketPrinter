// === 入力バリデーションと描画ボタンの有効化/グレーアウト連動 ===
const generateBtn = document.getElementById('generate-btn');
const winnersAdvanceCount = document.getElementById('winners-advance-count');
const losersAdvanceCount = document.getElementById('losers-advance-count');
const baseBoSelect = document.getElementById('base-bo-select');
const targetPhaseInput = document.getElementById('target-phase-input');

function validateForm() {
    const wVal = winnersAdvanceCount.value;
    const lVal = losersAdvanceCount.value;
    const boVal = baseBoSelect.value;
    const phaseVal = targetPhaseInput.value.trim();

    if (wVal && lVal && boVal && phaseVal !== '') {
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
baseBoSelect.addEventListener('change', validateForm);
targetPhaseInput.addEventListener('input', validateForm);

validateForm();

// === 手順3のロジック (基本Bo設定と奇数チェック) ===
const customBoContainer = document.getElementById('custom-bo-container');
const customBoInput = document.getElementById('custom-bo-input');
const customBoApplyBtn = document.getElementById('custom-bo-apply-btn');
const customBoConfirmArea = document.getElementById('custom-bo-confirm-area');
const customBoConfirmText = document.getElementById('custom-bo-confirm-text');
const customBoConfirmYes = document.getElementById('custom-bo-confirm-yes');
const customBoConfirmNo = document.getElementById('custom-bo-confirm-no');

let baseBoValue = '5';

baseBoSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
        customBoContainer.classList.remove('hidden');
    } else {
        customBoContainer.classList.add('hidden');
        customBoConfirmArea.classList.add('hidden');
        customBoInput.value = '';
        baseBoValue = e.target.value;
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
    customBoConfirmArea.classList.add('hidden');
    customBoContainer.classList.add('hidden');
    alert(`基本最大セット数を Bo${baseBoValue} に設定しました。`);
    validateForm();
});

customBoConfirmNo.addEventListener('click', () => {
    customBoConfirmArea.classList.add('hidden');
    customBoInput.value = '';
    customBoInput.focus();
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

// === アコーディオン開閉の制御（style.displayによる確実な切替） ===
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

// === HTML要素生成ヘルパー ===
function createElement(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
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
    const p1Slot = createElement('div', 'player-slot', player1Name);
    if (seed1) p1Slot.appendChild(createElement('span', 'seed-label', seed1));
    playersArea.appendChild(p1Slot);
    
    const p2Slot = createElement('div', 'player-slot', player2Name);
    if (seed2) p2Slot.appendChild(createElement('span', 'seed-label', seed2));
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

// === ラウンド列生成（太字斜体対応） ===
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

// === ブラケットを描画ボタンの処理 ===
generateBtn.addEventListener('click', () => {
    const targetPhaseName = targetPhaseInput.value.trim();
    const wCount = winnersAdvanceCount.value;
    const lCount = losersAdvanceCount.value;

    document.getElementById('preview-placeholder').classList.add('hidden');
    document.getElementById('preview-header').classList.remove('hidden');

    document.getElementById('pool-subtitle').textContent = `Winners side qualifier: ${wCount} / Losers side qualifier: ${lCount}`;

    const container = document.getElementById('bracket-container');
    container.innerHTML = ''; 
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '28px'; 

    // ==========================================
    // 1. Winners Bracket
    // ==========================================
    const wContainer = createElement('div', 'bracket-container');

    const wr1 = createRoundColumn('Winners Round 1', 'winners');
    const wr1Seeds = [
        ['16', '17'], ['9', '24'], ['13', '20'], ['12', '21'],
        ['15', '18'], ['10', '23'], ['14', '19'], ['11', '22']
    ];
    ['A','B','C','D','E','F','G','H'].forEach((l, i) => {
        wr1.appendChild(createMatchNode(l, '', '', wr1Seeds[i][0], wr1Seeds[i][1], 'none'));
    });

    const wr2 = createRoundColumn('Winners Round 2', 'winners');
    const wr2Seeds = ['1', '8', '4', '5', '2', '7', '3', '6'];
    ['I','J','K','L','M','N','O','P'].forEach((l, i) => {
        wr2.appendChild(createMatchNode(l, '', '', wr2Seeds[i], '', 'straight'));
    });

    const wr3 = createRoundColumn('Winners Quarter-Final', 'winners');
    ['Q','R','S','T'].forEach(l => wr3.appendChild(createMatchNode(l, '', '', '', '', 'branch')));

    const wr4 = createRoundColumn('Winners Semi-Final', 'winners');
    ['U','V'].forEach(l => wr4.appendChild(createMatchNode(l, '', '', '', '', 'branch')));

    const wr5 = createRoundColumn('Winners Final', 'winners');
    wr5.appendChild(createMatchNode('W', '', '', '', '', 'branch')); 

    const wQual = createRoundColumn('', 'winners', true);
    wQual.appendChild(createQualifierNode('W', targetPhaseName, 'W'));

    wContainer.append(wr1, wr2, wr3, wr4, wr5, wQual);

    // ==========================================
    // 2. Losers Bracket
    // ==========================================
    const lContainer = createElement('div', 'bracket-container');

    const lr1 = createRoundColumn('Losers Round 1', 'losers');
    const lr1Top = ['P','O','N','M','L','K','J','I'];
    const lr1Bot = ['A','B','C','D','E','F','G','H'];
    ['Z','AA','AB','AC','AD','AE','AF','AG'].forEach((l, i) => {
        lr1.appendChild(createMatchNode(l, '', '', '', '', 'none', `Loser of ${lr1Top[i]}`, `Loser of ${lr1Bot[i]}`));
    });

    const lr2 = createRoundColumn('Losers Round 2', 'losers');
    ['AH','AI','AJ','AK'].forEach(l => lr2.appendChild(createMatchNode(l, '', '', '', '', 'branch')));

    const lr3 = createRoundColumn('Losers Round 3', 'losers');
    const lr3Top = ['R','Q','T','S'];
    ['AL','AM','AN','AO'].forEach((l, i) => {
        lr3.appendChild(createMatchNode(l, '', '', '', '', 'straight', `Loser of ${lr3Top[i]}`));
    });

    const lr4 = createRoundColumn('Losers Round 4', 'losers');
    ['AP','AQ'].forEach(l => lr4.appendChild(createMatchNode(l, '', '', '', '', 'branch')));

    const lr5 = createRoundColumn('Losers Quarter-Final', 'losers');
    lr5.appendChild(createMatchNode('AR', '', '', '', '', 'straight', 'Loser of V'));
    lr5.appendChild(createMatchNode('AS', '', '', '', '', 'straight', 'Loser of U'));

    const lr6 = createRoundColumn('Losers Semi-Final', 'losers');
    lr6.appendChild(createMatchNode('AT', '', '', '', '', 'branch'));

    const lQual = createRoundColumn('', 'losers', true);
    lQual.appendChild(createQualifierNode('AT', targetPhaseName, 'L'));

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
