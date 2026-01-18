/**
 * VIDEO LOOP CANVAS RENDERER
 * ---------------------------
 * Plays video from loopStartTime to loopEndTime, then loops back to loopStartTime
 */

// Configuration
let loopStartTime = 0;
let loopEndTime = 14;

// Element References
let canvas, ctx, activeVid;

/**
 * Initialize elements and start the loop
 */
function init() {
    canvas = document.getElementById('videoCanvas');
    ctx = canvas.getContext('2d');
    activeVid = document.getElementById('video1');

    if (!canvas || !activeVid) {
        console.error("Missing HTML elements. Check your IDs (videoCanvas, video1).");
        return;
    }

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial Video State
    activeVid.muted = true; // Required for most browsers to autoplay
    activeVid.currentTime = loopStartTime;
    activeVid.play().catch(e => console.warn("Autoplay blocked. User interaction required."));

    // Listen for when video reaches the end, then loop back
    activeVid.addEventListener('timeupdate', handleTimeUpdate);

    // Start rendering
    requestAnimationFrame(render);
}

/**
 * Handle video time updates - loop back when reaching end
 */
function handleTimeUpdate() {
    if (activeVid.currentTime >= loopEndTime) {
        activeVid.currentTime = loopStartTime;
    }
}

/**
 * Main Render Loop - draws video frames to canvas
 */
function render() {
    // Draw current video frame to canvas
    drawToCanvas();

    requestAnimationFrame(render);
}

/**
 * Draws current video frame to canvas with 'cover' aspect ratio
 */
function drawToCanvas() {
    if (activeVid.readyState < 2) return; // Video not ready

    const vW = activeVid.videoWidth;
    const vH = activeVid.videoHeight;
    const cW = canvas.width;
    const cH = canvas.height;

    const vAspect = vW / vH;
    const cAspect = cW / cH;

    let dW, dH, dX, dY;

    if (vAspect > cAspect) {
        dH = cH;
        dW = dH * vAspect;
        dX = (cW - dW) / 2;
        dY = 0;
    } else {
        dW = cW;
        dH = dW / vAspect;
        dX = 0;
        dY = (cH - dH) / 2;
    }

    ctx.clearRect(0, 0, cW, cH);
    ctx.drawImage(activeVid, dX, dY, dW, dH);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

/**
 * UI Settings Management
 */
function applySettings() {
    const fileInput = document.getElementById('videoFileInput');
    const startInput = document.getElementById('loopStart');
    const endInput = document.getElementById('loopEnd');

    loopStartTime = parseFloat(startInput.value) || 0;
    loopEndTime = parseFloat(endInput.value) || 5;

    // Update the timeupdate handler
    activeVid.removeEventListener('timeupdate', handleTimeUpdate);
    activeVid.addEventListener('timeupdate', handleTimeUpdate);

    if (fileInput.files && fileInput.files[0]) {
        const url = URL.createObjectURL(fileInput.files[0]);
        activeVid.src = url;
        activeVid.load();
        
        activeVid.onloadeddata = () => {
            activeVid.currentTime = loopStartTime;
            activeVid.play();
        };
    }
}

function toggleControls() {
    const controls = document.getElementById('controls');
    controls.classList.toggle('visible');
}

// Start everything when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Setup UI buttons if they exist
    const applyBtn = document.getElementById('applySettingsBtn');
    if (applyBtn) applyBtn.addEventListener('click', applySettings);
    
    const toggleBtn = document.getElementById('toggleControlsBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleControls);

    // Call init when video metadata is ready
    const video = document.getElementById('video1');
    if (video) {
        video.addEventListener('loadedmetadata', init, { once: true });
    }
});
