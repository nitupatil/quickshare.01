// app.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// --- 3-Second Magic Intro Animation ---
window.addEventListener('load', () => {
    const intro = document.getElementById('intro-animation');
    // Check if they came via QR code link OR if they already saw it this session
    const urlParams = new URLSearchParams(window.location.search);
    if (!sessionStorage.getItem('magicIntroPlayed') && !urlParams.get('pin')) {
        setTimeout(() => {
            intro.classList.add('intro-fade-out');
            setTimeout(() => intro.style.display = 'none', 500); // Remove from DOM flow
        }, 3000);
        sessionStorage.setItem('magicIntroPlayed', 'true');
    } else {
        intro.style.display = 'none'; // Skip intro
    }
});

// --- History API (Fixes Mobile Back Button) ---
if (!history.state) { history.replaceState({ view: 'view-landing' }, '', '/'); }

window.navTo = function(viewId, pushHistory = true) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    if (pushHistory) {
        let url = viewId === 'view-landing' ? '/' : '#' + viewId;
        history.pushState({ view: viewId }, '', url);
    }
};

window.addEventListener('popstate', (e) => {
    if (document.getElementById('preview-modal').style.display === 'flex') {
        document.getElementById('preview-modal').style.display = 'none';
        document.getElementById('preview-content').innerHTML = ''; 
    } 
    else if (e.state && e.state.view) { navTo(e.state.view, false); } 
    else { navTo('view-landing', false); }
});

// --- QR Code Auto-Scan Logic ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('pin') && urlParams.get('otp')) {
        document.getElementById('receiver-pin').value = urlParams.get('pin');
        document.getElementById('receiver-otp').value = urlParams.get('otp');
        navTo('view-receive');
        document.getElementById('verify-btn').click();
    }
};

const playSwoosh = () => document.getElementById('sound-upload').play().catch(()=>{});
const playDing = () => document.getElementById('sound-unlock').play().catch(()=>{});
const playDownload = () => document.getElementById('sound-download').play().catch(()=>{});

// --- File Drag & Drop (Send Flow) ---
let selectedFilesArray = [];
const dropOverlay = document.getElementById('fullscreen-drop');
const fileInput = document.getElementById('file-input');
const fileListContainer = document.getElementById('file-list-container');
const uploadBtn = document.getElementById('upload-btn');

window.addEventListener('dragenter', (e) => { e.preventDefault(); if(document.getElementById('view-send').classList.contains('active')) dropOverlay.style.display = 'flex'; });
dropOverlay.addEventListener('dragover', (e) => e.preventDefault());
dropOverlay.addEventListener('dragleave', (e) => { e.preventDefault(); dropOverlay.style.display = 'none'; });
dropOverlay.addEventListener('drop', (e) => { e.preventDefault(); dropOverlay.style.display = 'none'; handleNewFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => handleNewFiles(e.target.files));

function handleNewFiles(files) {
    Array.from(files).forEach(file => {
        if (!selectedFilesArray.some(f => f.name === file.name && f.size === file.size)) selectedFilesArray.push(file);
    });
    renderFileList();
}

window.removeFile = function(index) {
    selectedFilesArray.splice(index, 1);
    renderFileList();
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    let totalSize = 0;
    selectedFilesArray.forEach((file, index) => {
        totalSize += file.size;
        let icon = file.type.includes('image') ? '🖼️' : (file.type.includes('video') ? '🎥' : '📄');
        fileListContainer.innerHTML += `
            <div class="file-item">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>${icon}</span>
                    <div><div style="font-weight:500; font-size:14px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</div>
                    <div style="font-size:12px; color:gray;">${(file.size/1024/1024).toFixed(2)} MB</div></div>
                </div>
                <button class="remove-btn" onclick="removeFile(${index})">×</button>
            </div>
        `;
    });

    if (totalSize > 50 * 1024 * 1024) {
        uploadBtn.style.background = 'var(--danger)';
        document.getElementById('upload-text').innerText = 'Size Exceeds 50MB';
        uploadBtn.disabled = true;
    } else {
        uploadBtn.style.background = 'var(--primary)';
        document.getElementById('upload-text').innerText = 'Upload Securely';
        uploadBtn.disabled = false;
    }
}

// --- Upload to Supabase with Visuals ---
uploadBtn.addEventListener('click', async () => {
    const pin = document.getElementById('sender-pin').value;
    const maxDownloads = document.getElementById('max-downloads').value || 2;

    if (!pin || pin.length !== 4) return alert('Please enter a 4-digit PIN.');
    if (selectedFilesArray.length === 0) return alert('Add files first!');

    uploadBtn.disabled = true;
    
    // Trigger Rocket Animation
    const actionIcon = document.getElementById('action-icon-send');
    actionIcon.classList.add('launching');
    document.getElementById('upload-text').innerText = 'Uploading files...';

    try {
        let filePaths = [];
        let totalSize = 0;

        for (let file of selectedFilesArray) {
            const fileName = `${Date.now()}_${file.name}`;
            const { error } = await supabase.storage.from('quickshares_files').upload(fileName, file);
            if (error) throw error;
            filePaths.push(fileName);
            totalSize += file.size;
        }

        const { data: shareData, error: dbError } = await supabase
            .from('shares').insert([{ pin: pin, file_paths: filePaths, total_size_bytes: totalSize, max_downloads: maxDownloads }]).select().single();
        if (dbError) throw dbError;

        playSwoosh();
        actionIcon.classList.remove('launching');

        document.getElementById('display-pin').innerText = shareData.pin;
        document.getElementById('display-otp').innerText = shareData.otp;
        document.getElementById('download-max').innerText = shareData.max_downloads || '∞';
        
        document.getElementById('qrcode').innerHTML = '';
        const magicLink = `${window.location.origin}${window.location.pathname}?pin=${shareData.pin}&otp=${shareData.otp}`;
        new QRCode(document.getElementById('qrcode'), { text: magicLink, width: 140, height: 140, colorDark: "#1E293B", colorLight: "#ffffff" });

        navTo('view-active');
        startTimer(300); 
        subscribeToRealtime(shareData.id);

    } catch (err) {
        alert('Upload failed: ' + err.message);
        actionIcon.classList.remove('launching');
        uploadBtn.disabled = false;
        document.getElementById('upload-text').innerText = 'Upload Securely';
    }
});

// --- Timer & Realtime ---
function startTimer(duration) {
    let timer = duration;
    const display = document.getElementById('timer');
    const interval = setInterval(() => {
        let m = parseInt(timer / 60, 10); let s = parseInt(timer % 60, 10);
        m = m < 10 ? "0" + m : m; s = s < 10 ? "0" + s : s;
        display.textContent = m + ":" + s;
        if (--timer < 0) { clearInterval(interval); display.textContent = "EXPIRED"; display.style.color = "gray"; }
    }, 1000);
}
function subscribeToRealtime(shareId) {
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shares', filter: `id=eq.${shareId}` }, (payload) => {
        document.getElementById('download-count').innerText = payload.new.download_count;
        if (payload.new.status === 'expired') document.getElementById('timer').textContent = "EXPIRED";
    }).subscribe();
}

// --- Receive Flow (Unlock Vault) ---
let vaultFilesData = []; 

document.getElementById('verify-btn').addEventListener('click', async () => {
    const pin = document.getElementById('receiver-pin').value;
    const otp = document.getElementById('receiver-otp').value;
    const statusText = document.getElementById('receive-status');
    const verifyBtn = document.getElementById('verify-btn');

    if (!pin || !otp) return statusText.innerText = 'Enter both PIN and OTP';
    verifyBtn.innerText = 'Unlocking...'; verifyBtn.disabled = true;

    try {
        const { data, error } = await supabase.rpc('verify_and_download', { p_pin: pin, p_otp: otp });
        if (error || !data || data.length === 0) throw new Error('Invalid credentials or session expired.');

        vaultFilesData = [];
        for (let path of data[0].files) {
            const { data: urlData } = await supabase.storage.from('quickshares_files').createSignedUrl(path, 60);
            if (urlData) {
                const originalName = path.split('_').slice(1).join('_');
                const ext = originalName.split('.').pop().toLowerCase();
                let type = 'pdf';
                if(['png','jpg','jpeg','gif','webp'].includes(ext)) type = 'image';
                if(['mp4','webm','mov'].includes(ext)) type = 'video';
                vaultFilesData.push({ url: urlData.signedUrl, name: originalName, type: type });
            }
        }
        
        playDing();
        renderVault();
        navTo('view-vault');
        verifyBtn.innerText = 'Unlock Vault 🔓'; verifyBtn.disabled = false;
        
    } catch (err) {
        statusText.innerText = err.message;
        verifyBtn.innerText = 'Unlock Vault 🔓'; verifyBtn.disabled = false;
    }
});

function renderVault() {
    const grid = document.getElementById('vault-grid');
    grid.innerHTML = '';
    vaultFilesData.forEach((file, index) => {
        let icon = file.type === 'image' ? '🖼️' : (file.type === 'video' ? '🎥' : '📄');
        grid.innerHTML += `
            <div class="vault-item" onclick="openPreview(${index})">
                <div style="font-size:40px; margin-bottom:10px;">${icon}</div>
                <div style="font-size:13px; font-weight:bold; overflow:hidden; text-overflow:ellipsis;">${file.name}</div>
            </div>
        `;
    });
}

// --- Preview & Print Engine ---
window.openPreview = function(index) {
    history.pushState({ modal: true }, '', '#preview'); 
    const file = vaultFilesData[index];
    document.getElementById('preview-title').innerText = file.name;
    const modal = document.getElementById('preview-modal');
    const content = document.getElementById('preview-content');
    const actions = document.getElementById('preview-actions');
    
    modal.style.display = 'flex';
    
    let downloadAction = `downloadSilent('${file.url}', '${file.name}')`;
    let printAction = `printFile('${file.url}', '${file.type}')`;

    if(file.type === 'image') {
        content.innerHTML = `<img src="${file.url}">`;
        actions.innerHTML = `<button onclick="${printAction}">🖨️ Print</button> <button class="primary" onclick="${downloadAction}">⬇️ Download</button>`;
    } else if(file.type === 'video') {
        content.innerHTML = `<video controls autoplay playsinline><source src="${file.url}"></video>`;
        actions.innerHTML = `<button class="primary" onclick="${downloadAction}">⬇️ Download</button>`;
    } else {
        content.innerHTML = `<iframe src="${file.url}" style="width:100%; height:100%; border:none; background:white; border-radius:8px;"></iframe>`;
        actions.innerHTML = `<button onclick="${printAction}">🖨️ Print</button> <button class="primary" onclick="${downloadAction}">⬇️ Download</button>`;
    }
};

window.closePreview = function() {
    if(history.state && history.state.modal) { history.back(); } 
    else { document.getElementById('preview-modal').style.display = 'none'; document.getElementById('preview-content').innerHTML = ''; }
};

window.downloadAllFiles = async function() {
    const btnIcon = document.getElementById('dl-icon');
    const btnText = document.getElementById('dl-text');
    
    // Parachute visual logic
    btnIcon.innerText = '🪂'; 
    btnIcon.className = 'action-icon parachute dropping';
    btnText.innerText = 'Fetching files...';

    playDownload();

    for(let file of vaultFilesData) {
        await downloadSilent(file.url, file.name);
        await new Promise(r => setTimeout(r, 600)); 
    }
    
    // Reset button after 3 seconds
    setTimeout(() => {
        btnIcon.className = 'action-icon';
        btnIcon.innerText = '📦';
        btnText.innerText = 'Download All Files';
    }, 2000);
};

window.downloadSilent = async function(url, filename) {
    const response = await fetch(url);
    const blob = await response.blob();
    const localUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = localUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(localUrl);
};

window.printFile = function(url, type) {
    const iframe = document.getElementById('print-frame');
    if (type === 'image') {
        iframe.srcdoc = `<html><head></head><body style="margin:0; text-align:center;"><img src="${url}" style="max-width:100%; max-height:100vh;" onload="window.print();"></body></html>`;
    } else {
        iframe.src = url;
        iframe.onload = () => iframe.contentWindow.print();
    }
};
