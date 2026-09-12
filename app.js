// app.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// Global UI Navigation
window.navTo = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
};

// --- QR Code Auto-Scan Logic ---
// If URL has ?pin=1234&otp=5678, skip to receive and verify immediately
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPin = urlParams.get('pin');
    const urlOtp = urlParams.get('otp');
    if(urlPin && urlOtp) {
        document.getElementById('receiver-pin').value = urlPin;
        document.getElementById('receiver-otp').value = urlOtp;
        navTo('view-receive');
        document.getElementById('verify-btn').click(); // Auto unlock
    }
};

// --- Sound Effects ---
const playSwoosh = () => document.getElementById('sound-upload').play().catch(()=>{});
const playDing = () => document.getElementById('sound-unlock').play().catch(()=>{});

// --- File Selection & Drag Drop (Send Flow) ---
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

// --- Upload to Supabase ---
uploadBtn.addEventListener('click', async () => {
    const pin = document.getElementById('sender-pin').value;
    const maxDownloads = document.getElementById('max-downloads').value || 2;

    if (!pin || pin.length !== 4) return alert('Please enter a 4-digit PIN.');
    if (selectedFilesArray.length === 0) return alert('Add files first!');

    uploadBtn.disabled = true;
    document.getElementById('rocket-icon').classList.add('launching'); // Rocket animation
    document.getElementById('upload-text').innerText = 'Uploading...';

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

        playSwoosh(); // Play sound
        document.getElementById('rocket-icon').classList.remove('launching');

        // Setup Active Session UI
        document.getElementById('display-pin').innerText = shareData.pin;
        document.getElementById('display-otp').innerText = shareData.otp;
        document.getElementById('download-max').innerText = shareData.max_downloads || '∞';
        
        // Generate Magic QR Code
        document.getElementById('qrcode').innerHTML = ''; // clear old
        const magicLink = `${window.location.origin}${window.location.pathname}?pin=${shareData.pin}&otp=${shareData.otp}`;
        new QRCode(document.getElementById('qrcode'), { text: magicLink, width: 150, height: 150 });

        navTo('view-active');
        startTimer(300); 
        subscribeToRealtime(shareData.id);

    } catch (err) {
        alert('Upload failed: ' + err.message);
        document.getElementById('rocket-icon').classList.remove('launching');
        uploadBtn.disabled = false;
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
let vaultFilesData = []; // Store secure URLs

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

        const filePaths = data[0].files;
        vaultFilesData = [];

        for (let path of filePaths) {
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
        
        playDing(); // Play success sound
        renderVault();
        navTo('view-vault');
        
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
const modal = document.getElementById('preview-modal');
const previewContent = document.getElementById('preview-content');
const previewActions = document.getElementById('preview-actions');

window.openPreview = function(index) {
    const file = vaultFilesData[index];
    document.getElementById('preview-title').innerText = file.name;
    modal.style.display = 'flex';
    
    // Create silent local blob for download to hide Supabase URL
    let downloadAction = `downloadSilent('${file.url}', '${file.name}')`;
    let printAction = `printFile('${file.url}', '${file.type}')`;

    if(file.type === 'image') {
        previewContent.innerHTML = `<img src="${file.url}">`;
        previewActions.innerHTML = `<button onclick="${printAction}">🖨️ Print</button> <button class="primary" onclick="${downloadAction}">⬇️ Download</button>`;
    } else if(file.type === 'video') {
        previewContent.innerHTML = `<video controls autoplay><source src="${file.url}"></video>`;
        previewActions.innerHTML = `<button class="primary" onclick="${downloadAction}">⬇️ Download</button>`;
    } else {
        previewContent.innerHTML = `<iframe src="${file.url}" style="width:100%; height:80vh; background:white;"></iframe>`;
        previewActions.innerHTML = `<button onclick="${printAction}">🖨️ Print</button> <button class="primary" onclick="${downloadAction}">⬇️ Download</button>`;
    }
};

window.closePreview = function() {
    modal.style.display = 'none';
    previewContent.innerHTML = ''; // Stop video audio
};

// Hidden Download (Blob)
window.downloadSilent = async function(url, filename) {
    const response = await fetch(url);
    const blob = await response.blob();
    const localUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = localUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(localUrl);
};

// Hidden Print logic
window.printFile = function(url, type) {
    const iframe = document.getElementById('print-frame');
    if (type === 'image') {
        iframe.srcdoc = `<html><head></head><body style="margin:0;"><img src="${url}" style="max-width:100%;" onload="window.print();"></body></html>`;
    } else {
        iframe.src = url;
        iframe.onload = () => iframe.contentWindow.print();
    }
};
