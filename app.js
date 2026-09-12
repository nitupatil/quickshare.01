// app.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);

// UI Elements
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileLabel = document.getElementById('file-label');
const uploadBtn = document.getElementById('upload-btn');
const downloadBtn = document.getElementById('download-btn');

let selectedFiles = [];

// --- Drag & Drop Logic ---
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

function handleFileSelect(files) {
    let totalSize = Array.from(files).reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
        alert('Total size exceeds 50MB limit.');
        selectedFiles = [];
        fileLabel.innerHTML = 'Drag & Drop files here (Max 50MB)';
        return;
    }
    selectedFiles = files;
    fileLabel.innerHTML = `${files.length} file(s) selected.<br>Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`;
}

// --- Upload Flow ---
uploadBtn.addEventListener('click', async () => {
    const pin = document.getElementById('sender-pin').value;
    const maxDownloads = document.getElementById('max-downloads').value || 2;

    if (!pin || pin.length !== 4) return alert('Please enter a 4-digit PIN.');
    if (selectedFiles.length === 0) return alert('Please select a file.');

    uploadBtn.innerText = 'Uploading...';
    uploadBtn.disabled = true;

    try {
        let filePaths = [];
        let totalSize = 0;

        // Upload to bucket
        for (let file of selectedFiles) {
            const fileName = `${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from('quickshares_files').upload(fileName, file);
            if (error) throw error;
            filePaths.push(fileName);
            totalSize += file.size;
        }

        // Create Database Row
        const { data: shareData, error: dbError } = await supabase
            .from('shares')
            .insert([{ 
                pin: pin, 
                file_paths: filePaths, 
                total_size_bytes: totalSize, 
                max_downloads: maxDownloads 
            }])
            .select()
            .single();

        if (dbError) throw dbError;

        // Transition UI to Active Session
        document.getElementById('nav-tabs').style.display = 'none';
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-active').classList.add('active');
        
        document.getElementById('display-pin').innerText = shareData.pin;
        document.getElementById('display-otp').innerText = shareData.otp;
        document.getElementById('download-max').innerText = shareData.max_downloads || '∞';

        startTimer(300); // 5 minutes
        subscribeToRealtime(shareData.id);

    } catch (err) {
        alert('Upload failed: ' + err.message);
        uploadBtn.innerText = 'Upload & Generate OTP';
        uploadBtn.disabled = false;
    }
});

// --- Realtime & Timer Logic ---
function startTimer(duration) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById('timer');
    const interval = setInterval(() => {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        display.textContent = minutes + ":" + seconds;
        if (--timer < 0) {
            clearInterval(interval);
            display.textContent = "EXPIRED";
            display.style.color = "#64748b";
        }
    }, 1000);
}

function subscribeToRealtime(shareId) {
    supabase.channel('custom-all-channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shares', filter: `id=eq.${shareId}` }, (payload) => {
        const row = payload.new;
        document.getElementById('download-count').innerText = row.download_count;
        if (row.status === 'expired') {
            document.getElementById('timer').textContent = "EXPIRED";
            document.getElementById('timer').style.color = "#64748b";
        }
    })
    .subscribe();
}

// --- Download Flow (Hidden URL / Direct File Blob Method) ---
downloadBtn.addEventListener('click', async () => {
    const pin = document.getElementById('receiver-pin').value;
    const otp = document.getElementById('receiver-otp').value;
    const statusText = document.getElementById('receive-status');

    if (!pin || !otp) return alert('Enter both PIN and OTP');
    
    downloadBtn.innerText = 'Verifying...';
    downloadBtn.disabled = true;

    try {
        const { data, error } = await supabase.rpc('verify_and_download', { p_pin: pin, p_otp: otp });
        
        if (error) throw new Error('Database error: ' + error.message);
        if (!data || data.length === 0) throw new Error('Invalid credentials or files expired.');

        const filePaths = data[0].files;
        statusText.innerText = 'Credentials verified. Downloading files securely...';
        statusText.style.color = '#10b981'; // Green

        // Fetch the file in the background and trigger forced download
        for (let path of filePaths) {
            const { data: urlData, error: urlError } = await supabase.storage.from('quickshares_files').createSignedUrl(path, 60);
            
            if (urlError) throw new Error('Storage error: ' + urlError.message);

            if (urlData) {
                // Fetch the actual file blob securely
                const response = await fetch(urlData.signedUrl);
                if (!response.ok) throw new Error('Network response was not ok');
                const blob = await response.blob();
                
                // Create a temporary object URL that hides the real backend path
                const localUrl = window.URL.createObjectURL(blob);
                
                // Create an invisible link to trigger the download prompt
                const a = document.createElement('a');
                a.href = localUrl;
                
                // Extract original filename (removing your generated timestamp)
                a.download = path.split('_').slice(1).join('_'); 
                
                document.body.appendChild(a);
                a.click();
                
                // Clean up the browser memory immediately after starting download
                a.remove();
                window.URL.revokeObjectURL(localUrl);
            }
        }
        
        statusText.innerText = 'Download complete!';
        downloadBtn.innerText = 'Download Files';
        downloadBtn.disabled = false;
        
    } catch (err) {
        statusText.innerText = err.message;
        statusText.style.color = '#ef4444'; // Red
        downloadBtn.innerText = 'Download Files';
        downloadBtn.disabled = false;
    }
});
