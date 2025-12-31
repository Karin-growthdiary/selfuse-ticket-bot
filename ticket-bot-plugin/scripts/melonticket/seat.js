window.isSuccess = false; // 是否成功
function playSuccessSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        // 创建两个振荡器，形成"双击"效果，更容易被耳朵捕捉
        
        // 第一声：短促的引导音 (Ding!)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'triangle'; // 三角波，声音更亮、更清脆
        osc1.frequency.setValueAtTime(880, now); // A5
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.5, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc1.start(now);
        osc1.stop(now + 0.5);

        // 第二声：悠长的提醒音 (Dinnnggggg~)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'triangle'; 
        osc2.frequency.setValueAtTime(1760, now + 0.1); // A6 (高八度，极具穿透力)
        
        // 音量包络：保持高音量一段时间，然后缓慢消逝
        gain2.gain.setValueAtTime(0, now + 0.1);
        gain2.gain.linearRampToValueAtTime(0.6, now + 0.2); // 稍微响一点
        gain2.gain.setValueAtTime(0.6, now + 1.0); // 保持响度 0.8秒
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 4.0); // 3秒长尾音

        osc2.start(now + 0.1);
        osc2.stop(now + 4.0);

    } catch (e) {
        console.error("播放提示音失败", e);
    }
}

async function sleep(t) {
    return await new Promise(resolve => setTimeout(resolve, t));
}

// 自动关闭座位确认弹窗，直接进入支付页面
async function autoCloseConfirmationModal() {
    let frame = theFrame();
    
    // 尝试多个可能的弹窗容器选择器
    const containerSelectors = [
        ".ui-dialog",           // jQuery UI dialog
        ".modal",               // Bootstrap modal
        ".popup",               // 通用popup
        ".mbx_pop",             // Melon特定class
        "div[role='dialog']",   // WAI-ARIA dialog
    ];
    
    // 等待弹窗出现（最多等待3秒，每50ms检查一次）
    let maxAttempts = 60;
    let attempt = 0;
    let modalContainer = null;
    
    while (attempt < maxAttempts && !modalContainer) {
        for (let selector of containerSelectors) {
            let container = frame.document.querySelector(selector);
            if (container && container.style.display !== "none" && container.offsetParent !== null) {
                modalContainer = container;
                console.log("[Melon Bot] 找到确认弹窗:", selector);
                break;
            }
        }
        if (!modalContainer) {
            await sleep(50);
            attempt++;
        }
    }
    
    if (!modalContainer) {
        console.log("[Melon Bot] 未找到弹窗，可能已自动关闭或用户已确认");
        return;
    }
    
    // 在弹窗容器内查找确认按钮
    let confirmButton = null;
    
    // 方法1：通过按钮文本查找（最可靠）
    let allButtons = modalContainer.querySelectorAll("button");
    for (let btn of allButtons) {
        let text = (btn.innerText || btn.textContent || "").trim();
        // 匹配韩文"확인"、英文"Confirm"或"OK"
        if (text === "확인" || text === "Confirm" || text === "OK" || text.includes("확인")) {
            confirmButton = btn;
            console.log("[Melon Bot] 找到确认按钮:", text);
            break;
        }
    }
    
    // 如果找到按钮，点击它
    if (confirmButton) {
        // 等待弹窗完全渲染
        await sleep(50);
        confirmButton.click();
        console.log("[Melon Bot] 已自动点击确认按钮");
        // 等待弹窗关闭和页面过渡
        await sleep(300);
    } else {
        console.log("[Melon Bot] 未找到确认按钮");
    }
}

function theFrame() {
    if (window._theFrameInstance == null) {
      window._theFrameInstance = document.getElementById('oneStopFrame').contentWindow;
    }
  
    return window._theFrameInstance;
}

function getConcertId() {
    return document.getElementById("prodId").value;
}

function openRangeList() {
    if (window.isSuccess) {
        return;
    }
    let frame = theFrame();
    // 查找 class 包含 seat_name 但不包含 open 的元素
    let sectionToOpen = frame.document.querySelector(".seat_name:not(.open)");

    // 如果找到了，就点击它
    if (sectionToOpen) {
        sectionToOpen.click();
    }
    return;
}

function clickOnArea(area) {
    let frame = theFrame();
    let section = frame.document.getElementsByClassName("area_tit");
    for (let i = 0; i < section.length; i++) {
        let reg = new RegExp(area + "\$","g");
        if (section[i].innerHTML.match(reg)) {
            section[i].parentElement.click();
            return;
        }
    }
}

async function findSeat() {
    let frame = theFrame();
    let canvas = frame.document.getElementById("ez_canvas");
    let seat = canvas.getElementsByTagName("rect");
    await sleep(750);
    for (let i = 0; i < seat.length; i++) {
        let fillColor = seat[i].getAttribute("fill");
    
        // Check if fill color is different from #DDDDDD or none
        if (fillColor !== "#DDDDDD" && fillColor !== "none") {
            console.log("Rect with different fill color found:", seat[i]);

            // --- 在这里播放提示音 ---
            playSuccessSound(); 
            // ---------------------

            
            var clickEvent = new Event('click', { bubbles: true });

            seat[i].dispatchEvent(clickEvent);
            frame.document.getElementById("nextTicketSelection").click();
            
            // 自动关闭确认弹窗（后台异步运行，不阻塞）
            autoCloseConfirmationModal();
            
            return true;
        }
    }
    return false;
}

async function checkCaptchaFinish() {
    if (document.getElementById("certification").style.display != "none") {
        await sleep(1000);
        checkCaptchaFinish();
        return;
    }
    let frame = theFrame();
    await sleep(500);
    frame.document.getElementById("nextTicketSelection").click();
    return;
}

async function searchSeat(data) {
    for (sec of data.section) {
        openRangeList();
        clickOnArea(sec);
        if (await findSeat()) {
            checkCaptchaFinish();
            return;
        }
        await sleep(750 + Math.random() * 500);
    }
    await searchSeat(data);
}

async function waitForVerifyCaptchaClose() {
    console.log("waitForVerifyCaptchaClose");
    console.log(window.document.getElementById("certification").style.display);
    if (window.document.getElementById("certification").style.display == "none") {
        return;
    }
    await sleep(1000);
    await waitForVerifyCaptchaClose();
}

async function waitFirstLoad() {
    let concertId = getConcertId();
    let data = await get_stored_value(concertId);
    let feishuBotId = data["feishu-bot-id"];
    console.log("feishuBotId:", feishuBotId);
    if (!data) {
        return;
    }
    await sleep(5000);
    await waitForVerifyCaptchaClose();
    openRangeList();
    await sleep(1000);
    await searchSeat(data);
    sendFeiShuMsg(feishuBotId, `[${new Date().toLocaleString()}]抢票成功`);
}


waitFirstLoad();