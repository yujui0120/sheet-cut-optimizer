import { state, ALLOWED_IPS, PASSCODE } from './config.js';

export async function verifyUserAccess(onSuccess) {
    let fetchSuccess = false;
    const loaderContentArea = document.getElementById('loaderContentArea');

    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        if (data && data.ip) {
            state.userIpAddress = data.ip;
            fetchSuccess = true;
        }
    } catch (error1) {
        try {
            const response2 = await fetch('https://ipwho.is/');
            const data2 = await response2.json();
            if (data2 && data2.ip) {
                state.userIpAddress = data2.ip;
                fetchSuccess = true;
            }
        } catch (error2) {}
    }

    if (!fetchSuccess) {
        renderPasscodeScreen(loaderContentArea, '無法取得您的設備IP');
        return;
    }

    if (!ALLOWED_IPS.includes(state.userIpAddress)) {
        renderPasscodeScreen(loaderContentArea, `偵測到您的 IP (${state.userIpAddress}) 未授權`);
        return;
    }

    onSuccess();
}

function renderPasscodeScreen(container, message) {
    if (container) {
        container.innerHTML = `
        <div style="font-size: 1.6rem; color: var(--danger); font-weight: 800; margin-bottom: 8px;">存取權限受限</div>
        <div style="font-size: 1.1rem; color: var(--text-main); font-weight: 600; margin-bottom: 6px;">${message}</div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 14px;">請輸入通行碼以繼續：</div>
        <div style="display: flex; gap: 8px; max-width: 280px; width: 100%; flex-direction: column;">
        <input type="password" id="passcodeInput" class="form-control" placeholder="請輸入通行碼">
        <button class="btn btn-primary" style="width: 100%; margin-top: 4px;" onclick="verifyPasscode()">確認</button>
        </div>
        `;
    }
}

window.verifyPasscode = function() {
    const inputVal = document.getElementById('passcodeInput').value;
    if (inputVal === PASSCODE) {
        const loader = document.getElementById('initialLoader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                window.grantAccessAfterAuth();
            }, 300);
        } else {
            window.grantAccessAfterAuth();
        }
    } else {
        alert('通行碼錯誤，請重新輸入！');
    }
};
