// ============================================================
// QUICKSHARES.ONLINE — MAGIC FILE TRANSFER
// Updated QR + SEND flow
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseUrl, supabaseKey } from './config.js';

const supabase = createClient(supabaseUrl, supabaseKey);


// ============================================================
// INTRO + QR DETECTION
// ============================================================

window.addEventListener('load', () => {

    const intro = document.getElementById('intro-animation');
    const appContainer = document.getElementById('app-container');

    const urlParams = new URLSearchParams(window.location.search);

    const hasShareCredentials =
        urlParams.get('pin') &&
        urlParams.get('otp');

    const triggerAppEntrance = () => {

        if (intro) {
            intro.classList.add('intro-fade-out');

            setTimeout(() => {
                intro.style.display = 'none';

                if (appContainer) {
                    appContainer.style.opacity = '1';
                    appContainer.style.transform = 'translateY(0)';
                }

            }, 500);
        }
    };


    // IMPORTANT:
    // If QR was scanned, do NOT wait for the normal intro.
    // The receiver should immediately enter the secure transfer flow.

    if (hasShareCredentials) {

        if (intro) {
            intro.style.display = 'none';
        }

        if (appContainer) {
            appContainer.style.opacity = '1';
            appContainer.style.transform = 'translateY(0)';
        }

    } else {

        if (!sessionStorage.getItem('magicIntroPlayed')) {

            setTimeout(triggerAppEntrance, 3000);

            sessionStorage.setItem(
                'magicIntroPlayed',
                'true'
            );

        } else {

            if (intro) {
                intro.style.display = 'none';
            }

            if (appContainer) {
                appContainer.style.opacity = '1';
                appContainer.style.transform = 'translateY(0)';
            }
        }
    }
});


// ============================================================
// HISTORY
// ============================================================

if (!history.state) {
    history.replaceState(
        { view: 'view-landing' },
        '',
        window.location.pathname
    );
}


window.navTo = function(viewId, pushHistory = true) {

    document
        .querySelectorAll('.view')
        .forEach(v => v.classList.remove('active'));

    const target = document.getElementById(viewId);

    if (target) {
        target.classList.add('active');
    }

    if (pushHistory) {

        let url =
            viewId === 'view-landing'
                ? window.location.pathname
                : '#' + viewId;

        history.pushState(
            { view: viewId },
            '',
            url
        );
    }
};


// ============================================================
// MOBILE BACK BUTTON
// ============================================================

window.addEventListener('popstate', (e) => {

    const previewModal =
        document.getElementById('preview-modal');

    if (
        previewModal &&
        previewModal.style.display === 'flex'
    ) {

        previewModal.style.display = 'none';

        const previewContent =
            document.getElementById('preview-content');

        if (previewContent) {
            previewContent.innerHTML = '';
        }

    }

    else if (
        e.state &&
        e.state.view
    ) {

        navTo(
            e.state.view,
            false
        );

    }

    else {

        navTo(
            'view-landing',
            false
        );
    }
});


// ============================================================
// QR AUTO RECEIVE
// ============================================================

window.addEventListener('load', async () => {

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const pin =
        urlParams.get('pin');

    const otp =
        urlParams.get('otp');


    // No QR credentials = normal website visit
    if (!pin || !otp) {
        return;
    }


    // QR SCAN DETECTED
    console.log(
        'QuickShares secure QR detected'
    );


    const receiverPin =
        document.getElementById('receiver-pin');

    const receiverOtp =
        document.getElementById('receiver-otp');

    const verifyBtn =
        document.getElementById('verify-btn');


    if (!receiverPin || !receiverOtp || !verifyBtn) {
        console.error(
            'Receive elements not found.'
        );
        return;
    }


    // Fill credentials automatically
    receiverPin.value = pin;
    receiverOtp.value = otp;


    // Go directly to receiving screen
    navTo(
        'view-receive',
        false
    );


    // Small delay so DOM/UI is ready
    await new Promise(
        resolve => setTimeout(resolve, 250)
    );


    // AUTOMATICALLY UNLOCK
    verifyBtn.click();
});


// ============================================================
// SOUND
// ============================================================

// Sound is intentionally disabled.
// Visual animation should provide the feedback.

const playSwoosh = () => {};
const playDing = () => {};
const playDownload = () => {};


// ============================================================
// FILE DRAG & DROP
// ============================================================

let selectedFilesArray = [];

const dropOverlay =
    document.getElementById(
        'fullscreen-drop'
    );

const fileInput =
    document.getElementById(
        'file-input'
    );

const fileListContainer =
    document.getElementById(
        'file-list-container'
    );

const uploadBtn =
    document.getElementById(
        'upload-btn'
    );


if (dropOverlay) {

    window.addEventListener(
        'dragenter',
        (e) => {

            e.preventDefault();

            const sendView =
                document.getElementById(
                    'view-send'
                );

            if (
                sendView &&
                sendView.classList.contains('active')
            ) {
                dropOverlay.style.display = 'flex';
            }
        }
    );


    dropOverlay.addEventListener(
        'dragover',
        (e) => {
            e.preventDefault();
        }
    );


    dropOverlay.addEventListener(
        'dragleave',
        (e) => {

            e.preventDefault();

            dropOverlay.style.display = 'none';
        }
    );


    dropOverlay.addEventListener(
        'drop',
        (e) => {

            e.preventDefault();

            dropOverlay.style.display = 'none';

            handleNewFiles(
                e.dataTransfer.files
            );
        }
    );
}


if (fileInput) {

    fileInput.addEventListener(
        'change',
        (e) => {
            handleNewFiles(
                e.target.files
            );
        }
    );
}


// ============================================================
// ADD FILES
// ============================================================

function handleNewFiles(files) {

    Array
        .from(files)
        .forEach(file => {

            const alreadyExists =
                selectedFilesArray.some(
                    f =>
                        f.name === file.name &&
                        f.size === file.size
                );

            if (!alreadyExists) {
                selectedFilesArray.push(file);
            }
        });


    renderFileList();
}


// ============================================================
// REMOVE FILE
// ============================================================

window.removeFile = function(index) {

    selectedFilesArray.splice(
        index,
        1
    );

    renderFileList();
};


// ============================================================
// FILE LIST
// ============================================================

function renderFileList() {

    if (!fileListContainer) {
        return;
    }

    fileListContainer.innerHTML = '';

    let totalSize = 0;


    selectedFilesArray.forEach(
        (file, index) => {

            totalSize += file.size;


            let icon =
                file.type.includes('image')
                    ? '🖼️'
                    : file.type.includes('video')
                        ? '🎥'
                        : '📄';


            fileListContainer.innerHTML += `

                <div class="file-item">

                    <div style="
                        display:flex;
                        align-items:center;
                        gap:10px;
                    ">

                        <span>${icon}</span>

                        <div>

                            <div style="
                                font-weight:500;
                                font-size:14px;
                                max-width:180px;
                                overflow:hidden;
                                text-overflow:ellipsis;
                                white-space:nowrap;
                            ">
                                ${file.name}
                            </div>

                            <div style="
                                font-size:12px;
                                color:gray;
                            ">
                                ${(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>

                        </div>

                    </div>

                    <button
                        class="remove-btn"
                        onclick="removeFile(${index})"
                    >
                        ×
                    </button>

                </div>
            `;
        }
    );


    // ========================================================
    // SEND BUTTON TEXT
    // ========================================================

    if (totalSize > 50 * 1024 * 1024) {

        if (uploadBtn) {
            uploadBtn.disabled = true;
        }

        const uploadText =
            document.getElementById(
                'upload-text'
            );

        if (uploadText) {
            uploadText.innerText =
                'FILE TOO LARGE';
        }

    } else {

        if (uploadBtn) {
            uploadBtn.disabled = false;
        }

        const uploadText =
            document.getElementById(
                'upload-text'
            );

        if (uploadText) {

            // IMPORTANT:
            // Never show "Upload"
            uploadText.innerText =
                selectedFilesArray.length > 0
                    ? 'SEND'
                    : 'SEND';
        }
    }
}


// ============================================================
// TRANSFER ANIMATION
// ============================================================

function startTransferAnimation() {

    document.body.classList.add(
        'transfer-active'
    );


    const uploadText =
        document.getElementById(
            'upload-text'
        );

    if (uploadText) {
        uploadText.innerText =
            'SENDING...';
    }


    const actionIcon =
        document.getElementById(
            'action-icon-send'
        );

    if (actionIcon) {
        actionIcon.classList.add(
            'launching'
        );
    }


    // If redesigned HTML contains this element,
    // show the full transfer animation.

    const transferAnimation =
        document.getElementById(
            'transfer-animation'
        );

    if (transferAnimation) {

        transferAnimation.classList.add(
            'active'
        );
    }
}


// ============================================================
// TRANSFER ANIMATION END
// ============================================================

function finishTransferAnimation() {

    document.body.classList.remove(
        'transfer-active'
    );


    const transferAnimation =
        document.getElementById(
            'transfer-animation'
        );

    if (transferAnimation) {

        transferAnimation.classList.remove(
            'active'
        );
    }


    const actionIcon =
        document.getElementById(
            'action-icon-send'
        );

    if (actionIcon) {

        actionIcon.classList.remove(
            'launching'
        );
    }
}


// ============================================================
// SEND / UPLOAD
// ============================================================

if (uploadBtn) {

    uploadBtn.addEventListener(
        'click',
        async () => {

            const pin =
                document.getElementById(
                    'sender-pin'
                ).value;

            const maxDownloads =
                document.getElementById(
                    'max-downloads'
                ).value || 2;


            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (!pin || pin.length !== 4) {

                alert(
                    'Please enter a 4-digit PIN.'
                );

                return;
            }


            if (
                selectedFilesArray.length === 0
            ) {

                alert(
                    'Add files first!'
                );

                return;
            }


            uploadBtn.disabled = true;


            // ------------------------------------------------
            // START BIG SEND ANIMATION
            // ------------------------------------------------

            startTransferAnimation();


            try {

                let filePaths = [];

                let totalSize = 0;


                // ------------------------------------------------
                // UPLOAD EACH FILE
                // ------------------------------------------------

                for (
                    let file of selectedFilesArray
                ) {

                    const fileName =
                        `${Date.now()}_${file.name}`;


                    const {
                        error
                    } =
                        await supabase
                            .storage
                            .from(
                                'quickshares_files'
                            )
                            .upload(
                                fileName,
                                file
                            );


                    if (error) {
                        throw error;
                    }


                    filePaths.push(
                        fileName
                    );


                    totalSize +=
                        file.size;
                }


                // ------------------------------------------------
                // CREATE SHARE
                // ------------------------------------------------

                const {
                    data: shareData,
                    error: dbError
                } =
                    await supabase
                        .from('shares')
                        .insert([
                            {
                                pin: pin,
                                file_paths:
                                    filePaths,
                                total_size_bytes:
                                    totalSize,
                                max_downloads:
                                    maxDownloads
                            }
                        ])
                        .select()
                        .single();


                if (dbError) {
                    throw dbError;
                }


                // ------------------------------------------------
                // UPLOAD COMPLETE
                // ------------------------------------------------

                finishTransferAnimation();


                // ------------------------------------------------
                // SHOW SHARE INFORMATION
                // ------------------------------------------------

                document.getElementById(
                    'display-pin'
                ).innerText =
                    shareData.pin;


                document.getElementById(
                    'display-otp'
                ).innerText =
                    shareData.otp;


                document.getElementById(
                    'download-max'
                ).innerText =
                    shareData.max_downloads || '∞';


                // ------------------------------------------------
                // CREATE QR CODE
                // ------------------------------------------------

                const qrContainer =
                    document.getElementById(
                        'qrcode'
                    );


                if (qrContainer) {

                    qrContainer.innerHTML = '';


                    /*
                     * IMPORTANT:
                     *
                     * The QR must contain the actual
                     * PIN + OTP.
                     *
                     * When scanned:
                     *
                     * QuickShares
                     *       ↓
                     * detects pin + otp
                     *       ↓
                     * opens Receive
                     *       ↓
                     * automatically verifies
                     *       ↓
                     * opens Vault
                     *
                     */


                    const baseUrl =
                        window.location.origin +
                        window.location.pathname;


                    const magicLink =
                        `${baseUrl}?pin=${encodeURIComponent(shareData.pin)}&otp=${encodeURIComponent(shareData.otp)}`;


                    console.log(
                        'QR Magic Link:',
                        magicLink
                    );


                    new QRCode(
                        qrContainer,
                        {
                            text: magicLink,

                            width: 180,

                            height: 180,

                            colorDark:
                                '#111827',

                            colorLight:
                                '#ffffff',

                            correctLevel:
                                QRCode.CorrectLevel.H
                        }
                    );
                }


                // ------------------------------------------------
                // GO TO ACTIVE SHARE SCREEN
                // ------------------------------------------------

                navTo(
                    'view-active'
                );


                startTimer(
                    300
                );


                subscribeToRealtime(
                    shareData.id
                );


            }

            catch (err) {

                console.error(
                    'Upload failed:',
                    err
                );


                alert(
                    'Send failed: ' +
                    err.message
                );


                finishTransferAnimation();


                uploadBtn.disabled =
                    false;


                const uploadText =
                    document.getElementById(
                        'upload-text'
                    );

                if (uploadText) {

                    uploadText.innerText =
                        'SEND';
                }
            }

        }
    );
}


// ============================================================
// TIMER
// ============================================================

function startTimer(duration) {

    let timer = duration;

    const display =
        document.getElementById(
            'timer'
        );


    const interval =
        setInterval(
            () => {

                let m =
                    parseInt(
                        timer / 60,
                        10
                    );

                let s =
                    parseInt(
                        timer % 60,
                        10
                    );


                m =
                    m < 10
                        ? '0' + m
                        : m;


                s =
                    s < 10
                        ? '0' + s
                        : s;


                if (display) {

                    display.textContent =
                        m + ':' + s;
                }


                if (--timer < 0) {

                    clearInterval(
                        interval
                    );


                    if (display) {

                        display.textContent =
                            'EXPIRED';

                        display.style.color =
                            'gray';
                    }
                }

            },
            1000
        );
}


// ============================================================
// REALTIME DOWNLOAD COUNT
// ============================================================

function subscribeToRealtime(shareId) {

    supabase
        .channel(
            'quickshares-' + shareId
        )

        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'shares',
                filter:
                    `id=eq.${shareId}`
            },

            (payload) => {

                const count =
                    document.getElementById(
                        'download-count'
                    );


                if (count) {

                    count.innerText =
                        payload.new.download_count;
                }


                if (
                    payload.new.status ===
                    'expired'
                ) {

                    const timer =
                        document.getElementById(
                            'timer'
                        );


                    if (timer) {

                        timer.textContent =
                            'EXPIRED';
                    }
                }
            }
        )

        .subscribe();
}


// ============================================================
// RECEIVE / UNLOCK VAULT
// ============================================================

let vaultFilesData = [];


const verifyButton =
    document.getElementById(
        'verify-btn'
    );


if (verifyButton) {

    verifyButton.addEventListener(
        'click',
        async () => {

            const pin =
                document.getElementById(
                    'receiver-pin'
                ).value;


            const otp =
                document.getElementById(
                    'receiver-otp'
                ).value;


            const statusText =
                document.getElementById(
                    'receive-status'
                );


            if (!pin || !otp) {

                statusText.innerText =
                    'Enter both PIN and OTP';

                return;
            }


            verifyButton.innerText =
                'OPENING FILE...';


            verifyButton.disabled =
                true;


            try {

                // ------------------------------------------------
                // VERIFY SHARE
                // ------------------------------------------------

                const {
                    data,
                    error
                } =
                    await supabase.rpc(
                        'verify_and_download',
                        {
                            p_pin: pin,
                            p_otp: otp
                        }
                    );


                if (
                    error ||
                    !data ||
                    data.length === 0
                ) {

                    throw new Error(
                        'Invalid credentials or session expired.'
                    );
                }


                // ------------------------------------------------
                // BUILD VAULT
                // ------------------------------------------------

                vaultFilesData = [];


                for (
                    let path of data[0].files
                ) {

                    const {
                        data: urlData
                    } =
                        await supabase
                            .storage
                            .from(
                                'quickshares_files'
                            )
                            .createSignedUrl(
                                path,
                                60
                            );


                    if (urlData) {

                        const originalName =
                            path
                                .split('_')
                                .slice(1)
                                .join('_');


                        const ext =
                            originalName
                                .split('.')
                                .pop()
                                .toLowerCase();


                        let type =
                            'pdf';


                        if (
                            [
                                'png',
                                'jpg',
                                'jpeg',
                                'gif',
                                'webp'
                            ].includes(ext)
                        ) {

                            type =
                                'image';
                        }


                        if (
                            [
                                'mp4',
                                'webm',
                                'mov'
                            ].includes(ext)
                        ) {

                            type =
                                'video';
                        }


                        vaultFilesData.push(
                            {
                                url:
                                    urlData.signedUrl,

                                name:
                                    originalName,

                                type:
                                    type
                            }
                        );
                    }
                }


                // ------------------------------------------------
                // SUCCESS
                // ------------------------------------------------

                playDing();


                renderVault();


                /*
                 * THIS IS THE IMPORTANT PART:
                 *
                 * QR scanner reaches here automatically.
                 *
                 * Therefore:
                 *
                 * Scan QR
                 *    ↓
                 * URL contains PIN + OTP
                 *    ↓
                 * credentials auto-filled
                 *    ↓
                 * verify button automatically clicked
                 *    ↓
                 * Supabase verifies
                 *    ↓
                 * Vault opens
                 */


                navTo(
                    'view-vault'
                );


                verifyButton.innerText =
                    'OPENED ✓';


                verifyButton.disabled =
                    false;

            }

            catch (err) {

                console.error(
                    'Receive error:',
                    err
                );


                statusText.innerText =
                    err.message;


                verifyButton.innerText =
                    'Unlock Vault 🔓';


                verifyButton.disabled =
                    false;
            }
        }
    );
}


// ============================================================
// RENDER VAULT
// ============================================================

function renderVault() {

    const grid =
        document.getElementById(
            'vault-grid'
        );


    if (!grid) {
        return;
    }


    grid.innerHTML = '';


    vaultFilesData.forEach(
        (file, index) => {

            let icon =
                file.type === 'image'
                    ? '🖼️'
                    : file.type === 'video'
                        ? '🎥'
                        : '📄';


            grid.innerHTML += `

                <div
                    class="vault-item"
                    onclick="openPreview(${index})"
                >

                    <div style="
                        font-size:40px;
                        margin-bottom:10px;
                    ">
                        ${icon}
                    </div>

                    <div style="
                        font-size:13px;
                        font-weight:bold;
                        overflow:hidden;
                        text-overflow:ellipsis;
                    ">
                        ${file.name}
                    </div>

                </div>
            `;
        }
    );
}


// ============================================================
// PREVIEW
// ============================================================

window.openPreview =
    function(index) {

        history.pushState(
            { modal: true },
            '',
            '#preview'
        );


        const file =
            vaultFilesData[index];


        document.getElementById(
            'preview-title'
        ).innerText =
            file.name;


        const modal =
            document.getElementById(
                'preview-modal'
            );


        const content =
            document.getElementById(
                'preview-content'
            );


        const actions =
            document.getElementById(
                'preview-actions'
            );


        modal.style.display =
            'flex';


        let downloadAction =
            `downloadSilent('${file.url}', '${file.name}')`;


        let printAction =
            `printFile('${file.url}', '${file.type}')`;


        if (file.type === 'image') {

            content.innerHTML =
                `<img src="${file.url}">`;


            actions.innerHTML = `

                <button
                    onclick="${printAction}"
                >
                    🖨️ Print
                </button>

                <button
                    class="primary"
                    onclick="${downloadAction}"
                >
                    ⬇️ Download
                </button>
            `;

        }

        else if (file.type === 'video') {

            content.innerHTML = `

                <video
                    controls
                    autoplay
                    playsinline
                >

                    <source
                        src="${file.url}"
                    >

                </video>
            `;


            actions.innerHTML = `

                <button
                    class="primary"
                    onclick="${downloadAction}"
                >
                    ⬇️ Download
                </button>
            `;

        }

        else {

            content.innerHTML = `

                <iframe
                    src="${file.url}"
                    style="
                        width:100%;
                        height:100%;
                        border:none;
                        background:white;
                        border-radius:8px;
                    "
                >
                </iframe>
            `;


            actions.innerHTML = `

                <button
                    onclick="${printAction}"
                >
                    🖨️ Print
                </button>

                <button
                    class="primary"
                    onclick="${downloadAction}"
                >
                    ⬇️ Download
                </button>
            `;
        }
    };


// ============================================================
// CLOSE PREVIEW
// ============================================================

window.closePreview =
    function() {

        if (
            history.state &&
            history.state.modal
        ) {

            history.back();

        }

        else {

            document.getElementById(
                'preview-modal'
            ).style.display =
                'none';


            document.getElementById(
                'preview-content'
            ).innerHTML =
                '';
        }
    };


// ============================================================
// DOWNLOAD ALL
// ============================================================

window.downloadAllFiles =
    async function() {

        const btnIcon =
            document.getElementById(
                'dl-icon'
            );


        const btnText =
            document.getElementById(
                'dl-text'
            );


        if (btnIcon) {

            btnIcon.innerText =
                '↓';

            btnIcon.className =
                'action-icon parachute dropping';
        }


        if (btnText) {

            btnText.innerText =
                'GETTING FILES...';
        }


        playDownload();


        for (
            let file of vaultFilesData
        ) {

            await downloadSilent(
                file.url,
                file.name
            );


            await new Promise(
                r => setTimeout(r, 600)
            );
        }


        setTimeout(
            () => {

                if (btnIcon) {

                    btnIcon.className =
                        'action-icon';

                    btnIcon.innerText =
                        '📦';
                }


                if (btnText) {

                    btnText.innerText =
                        'DOWNLOAD EVERYTHING';
                }

            },
            2000
        );
    };


// ============================================================
// SILENT DOWNLOAD
// ============================================================

window.downloadSilent =
    async function(url, filename) {

        const response =
            await fetch(url);


        const blob =
            await response.blob();


        const localUrl =
            window.URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                'a'
            );


        a.href =
            localUrl;


        a.download =
            filename;


        document.body.appendChild(a);


        a.click();


        a.remove();


        window.URL.revokeObjectURL(
            localUrl
        );
    };


// ============================================================
// PRINT
// ============================================================

window.printFile =
    function(url, type) {

        const iframe =
            document.getElementById(
                'print-frame'
            );


        if (type === 'image') {

            iframe.srcdoc = `

                <html>

                    <head></head>

                    <body
                        style="
                            margin:0;
                            text-align:center;
                        "
                    >

                        <img
                            src="${url}"
                            style="
                                max-width:100%;
                                max-height:100vh;
                            "
                            onload="window.print();"
                        >

                    </body>

                </html>
            `;

        }

        else {

            iframe.src =
                url;


            iframe.onload =
                () => {

                    iframe
                        .contentWindow
                        .print();
                };
        }
    };
