// app.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HISTORY API & NAVIGATION ---
if (!history.state) {
    history.replaceState({ view: 'view-landing' }, '', window.location.pathname);
}

window.navTo = function(viewId, pushHistory = true) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    
    if (pushHistory) {
        let url = viewId === 'view-landing' ? window.location.pathname : '#' + viewId;
        history.pushState({ view: viewId }, '', url);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.addEventListener('popstate', (e) => {
    const modal = document.getElementById('preview-modal');
    if (modal && modal.classList.contains('active')) {
        window.closePreview(false);
    } 
    else if (e.state && e.state.view) {
        window.navTo(e.state.view, false);
    } else {
        window.navTo('view-landing', false);
    }
});

// --- FILE SELECTION & DRAG DROP ---
let selectedFilesArray = [];
const fileInput = document.getElementById('file-input');
const fileListContainer = document.getElementById('file-list-container');
const uploadBtn = document.getElementById('upload-btn');

fileInput.addEventListener('change', (e) => handleNewFiles(e.target.files));

function handleNewFiles(files) {
    Array.from(files).forEach(file => {
        if (!selectedFilesArray.some(f => f.name === file.name && f.size === file.size)) {
            selectedFilesArray.push(file);
        }
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
                <div class="file-info">
                    <span class="file-icon">${icon}</span>
                    <div class="file-meta">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${(file.size/1024/1024).toFixed(2)} MB</div>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeFile(${index})" aria-label="Remove file">×</button>
            </div>
        `;
    });

    if (totalSize > 50 * 1024 * 1024) {
        uploadBtn.classList.add('danger-btn');
        document.getElementById('upload-text').innerText = 'Size Exceeds 50MB';
        uploadBtn.disabled = true;
    } else {
        uploadBtn.classList.remove('danger-btn');
        document.getElementById('upload-text').innerText = 'SEND';
        uploadBtn.disabled = selectedFilesArray.length === 0;
    }
}

// --- UPLOAD FLOW ---
uploadBtn.addEventListener('click', async () => {
    const pin = document.getElementById('sender-pin').value;
    const maxDownloads = document.getElementById('max-downloads').value || 2;

    if (!pin || pin.length !== 4) return alert('Please enter a 4-digit PIN.');
    if (selectedFilesArray.length === 0) return alert('Add files first!');

    uploadBtn.disabled = true;
    document.getElementById('upload-text').innerText = 'PACKING...';
    
    const transferAnim = document.getElementById('transfer-animation');
    if(transferAnim) transferAnim.classList.add('active');

    try {
        let filePaths = [];
        let totalSize = 0;
        document.getElementById('upload-text').innerText = 'SENDING...';

        for (let file of selectedFilesArray) {
            const fileName = `${Date.now()}_${file.name}`;
            const { error } = await supabase.storage.from('quickshares_files').upload(fileName, file);
            if (error) throw error;
            filePaths.push(fileName);
            totalSize += file.size;
        }

        const { data: shareData, error: dbError } = await supabase
            .from('shares')
            .insert([{ pin: pin, file_paths: filePaths, total_size_bytes: totalSize, max_downloads: maxDownloads }])
            .select()
            .single();

        if (dbError) throw dbError;

        document.getElementById('upload-text').innerText = 'SENT ✦';
        
        setTimeout(() => {
            if(transferAnim) transferAnim.classList.remove('active');
            
            document.getElementById('display-pin').innerText = shareData.pin;
            document.getElementById('display-otp').innerText = shareData.otp;
            document.getElementById('download-max').innerText = shareData.max_downloads || '∞';
            
            // Clean URL generation for the QR Code
            document.getElementById('qrcode').innerHTML = '';
            const baseUrl = window.location.origin + window.location.pathname;
            const magicLink = `${baseUrl}?pin=${shareData.pin}&otp=${shareData.otp}`;
            
            new QRCode(document.getElementById('qrcode'), { 
                text: magicLink, 
                width: 150, 
                height: 150, 
                colorDark: "#1A1A2C", 
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L
            });

            window.navTo('view-active');
            startTimer(300); 
            subscribeToRealtime(shareData.id);
        }, 600);

    } catch (err) {
        alert('Upload failed: ' + err.message);
        if(transferAnim) transferAnim.classList.remove('active');
        uploadBtn.disabled = false;
        document.getElementById('upload-text').innerText = 'SEND';
    }
});

// --- TIMER & REALTIME COUNTER ---
function startTimer(duration) {
    let timer = duration;
    const display = document.getElementById('timer');
    const interval = setInterval(() => {
        let m = parseInt(timer / 60, 10); 
        let s = parseInt(timer % 60, 10);
        m = m < 10 ? "0" + m : m; 
        s = s < 10 ? "0" + s : s;
        display.textContent = m + ":" + s;
        
        if (--timer < 0) { 
            clearInterval(interval); 
            display.textContent = "EXPIRED"; 
            display.style.color = "var(--muted)"; 
        }
    }, 1000);
}

function subscribeToRealtime(shareId) {
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shares', filter: `id=eq.${shareId}` }, (payload) => {
        document.getElementById('download-count').innerText = payload.new.download_count;
        if (payload.new.status === 'expired') {
            document.getElementById('timer').textContent = "EXPIRED";
            document.getElementById('timer').style.color = "var(--muted)";
        }
    }).subscribe();
}

// --- RECEIVE FLOW (Unlock Vault) ---
let vaultFilesData = []; 
const verifyBtn = document.getElementById('verify-btn');

verifyBtn.addEventListener('click', async () => {
    const pin = document.getElementById('receiver-pin').value;
    const otp = document.getElementById('receiver-otp').value;
    const statusText = document.getElementById('receive-status');

    if (!pin || !otp) {
        statusText.innerText = 'Enter both PIN and OTP';
        return;
    }
    
    verifyBtn.innerHTML = '<span aria-hidden="true">⏳</span> unlocking...'; 
    verifyBtn.disabled = true;
    statusText.innerText = '';

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
                
                vaultFilesData.push({ 
                    url: urlData.signedUrl, 
                    name: originalName, 
                    type: type,
                    sizeRaw: path
                });
            }
        }
        
        renderVault();
        window.navTo('view-vault');
        
        verifyBtn.innerHTML = '<span aria-hidden="true">🔓</span> unlock vault'; 
        verifyBtn.disabled = false;
        
    } catch (err) {
        statusText.innerText = err.message;
        verifyBtn.innerHTML = '<span aria-hidden="true">🔓</span> unlock vault'; 
        verifyBtn.disabled = false;
    }
});

function renderVault() {
    const grid = document.getElementById('vault-grid');
    grid.innerHTML = '';
    
    vaultFilesData.forEach((file, index) => {
        let icon = file.type === 'image' ? '🖼️' : (file.type === 'video' ? '🎥' : '📄');
        grid.innerHTML += `
            <div class="vault-item" onclick="openPreview(${index})" role="button" tabindex="0">
                <div class="vault-icon" aria-hidden="true">${icon}</div>
                <div class="vault-name">${file.name}</div>
                <div class="vault-size">Ready</div>
            </div>
        `;
    });
}

// --- PREVIEW & PRINT ENGINE ---
window.openPreview = function(index) {
    history.pushState({ modal: true }, '', '#preview'); 
    
    const file = vaultFilesData[index];
    document.getElementById('preview-title').innerText = file.name;
    const modal = document.getElementById('preview-modal');
    const content = document.getElementById('preview-content');
    const actions = document.getElementById('preview-actions');
    
    modal.classList.add('active');
    
    let downloadAction = `downloadSilent('${file.url}', '${file.name}')`;
    let printAction = `printFile('${file.url}', '${file.type}')`;

    if(file.type === 'image') {
        content.innerHTML = `<img src="${file.url}" alt="${file.name}">`;
        actions.innerHTML = `
            <button onclick="${printAction}">🖨️ Print</button> 
            <button class="primary" onclick="${downloadAction}">⬇️ Download</button>
        `;
    } else if(file.type === 'video') {
        content.innerHTML = `<video controls autoplay playsinline><source src="${file.url}"></video>`;
        actions.innerHTML = `
            <button class="primary" onclick="${downloadAction}">⬇️ Download</button>
        `;
    } else {
        content.innerHTML = `<iframe src="${file.url}" style="width:100%; height:100%; border:none; background:white; border-radius:12px;"></iframe>`;
        actions.innerHTML = `
            <button onclick="${printAction}">🖨️ Print</button> 
            <button class="primary" onclick="${downloadAction}">⬇️ Download</button>
        `;
    }
};

window.closePreview = function(goBack = true) {
    if(goBack && history.state && history.state.modal) { 
        history.back();
    } else { 
        const modal = document.getElementById('preview-modal');
        if(modal) modal.classList.remove('active'); 
        document.getElementById('preview-content').innerHTML = ''; 
    }
};

// --- SECURE DOWNLOAD LOGIC ---
window.downloadAllFiles = async function() {
    const btn = document.getElementById('download-all-btn');
    const originalText = document.getElementById('dl-text').innerText;
    
    document.getElementById('dl-icon').innerText = '⏳';
    document.getElementById('dl-text').innerText = 'FETCHING FILES...';
    btn.disabled = true;

    for(let file of vaultFilesData) {
        await window.downloadSilent(file.url, file.name);
        await new Promise(r => setTimeout(r, 600)); 
    }
    
    setTimeout(() => {
        document.getElementById('dl-icon').innerText = '📦';
        document.getElementById('dl-text').innerText = originalText;
        btn.disabled = false;
    }, 1500);
};

window.downloadSilent = async function(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        
        const localUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = localUrl; 
        a.download = filename;
        
        document.body.appendChild(a); 
        a.click(); 
        
        setTimeout(() => {
            a.remove();
            window.URL.revokeObjectURL(localUrl);
        }, 100);
    } catch (e) {
        alert("Download failed. Please try again.");
    }
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

// =========================================================================
// --- OVERRIDE: THE BULLETPROOF QR CODE AUTO-SCAN LOGIC ---
// Placing this at the very bottom ensures all DOM elements and listeners 
// (especially the 'verify-btn' click listener) are fully registered before running.
// =========================================================================
function executeQROverride() {
    const urlParams = new URLSearchParams(window.location.search);
    const pin = urlParams.get('pin');
    const otp = urlParams.get('otp');

    if (pin && otp) {
        // 1. Force the Intro UI to hide immediately
        const intro = document.getElementById('intro-animation');
        const appContainer = document.getElementById('app-container');
        if (intro) {
            intro.style.display = 'none';
            intro.style.opacity = '0';
        }
        if (appContainer) {
            appContainer.classList.add('visible');
            appContainer.style.opacity = '1';
        }

        // 2. Auto-fill the hidden input boxes
        document.getElementById('receiver-pin').value = pin;
        document.getElementById('receiver-otp').value = otp;
        
        // 3. Force navigation to the receiver screen
        if (typeof window.navTo === 'function') {
            window.navTo('view-receive', false);
        }
        
        // 4. Safely trigger the unlock mechanism now that the listener exists
        setTimeout(() => {
            if (verifyBtn) verifyBtn.click();
        }, 50); 
    }
}
// Execute immediately upon load
executeQROverride();
