//const videojs = require('video.js').default;
//require('!style-loader!css-loader!video.js/dist/video-js.css');
require('./dash.all.min.js');

let FakeDash = require('./fakedash.js');

const icon = document.getElementById('icon');
const ua = navigator.userAgent;
if (ua.match(/Firefox/)) {
    icon.src = '/firefox.png';
} else if (ua.match(/Edg/)) {
    icon.src = '/edge.png';
} else if (ua.match(/Chrome/)) {
    icon.src = '/chrome.png';
} else if (ua.match(/Safari/)) {
    icon.src = '/safari.png';
}


const output = document.getElementById('output');

//videojs.log.level('debug');

let video;
let config;
let currentUrl;

let segmentSizes = [];
let segmentTimes = [];
let startTime = Date.now();
function updateBandwidth() {
    //let now = Date.now() - startTime;
    let now = segmentSizes.length; // approx 1s per segment
    let bytes = 0;
    let ms = 0;
    for (let i = segmentSizes.length - 1; i >= 0; i--) {
        //let duration = now - segmentTimes[i];
        let duration = (now - i) * 1000;
        bytes += segmentSizes[i];
        ms += duration;
        /*
        console.log({
            duration,
            bytes,
            ms
        })
        */
        if (ms >= 5000) {
            // rough rolling average
            break;
        }
    }
    if (bytes && ms) {
        let rate = bytes / ms;
        let bw = Math.round(rate * 8) + 'kbits/s';
        document.getElementById('bw').textContent = bw;
    }
}

function showVideo(url) {
    // Keep looking in case it changes.
    // @todo: switch polling to a WebSocket thing.
    awaitEncoding();

    if (video) {
        video.parentNode.removeChild(video);
        video = null;
    }

    startTime = Date.now();

    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;

    output.className = '';
    output.textContent = '';

    video = document.createElement('video');
    video.width = 1280;
    video.height = 720;
    video.controls = true;
    video.playsInline = true;
    video.muted = true;

    output.className = 'player';
    output.appendChild(link);

    const div = document.createElement('div');
    output.appendChild(div);
    div.appendChild(video);


    if (navigator.userAgent.match(/Safari/) && !navigator.userAgent.match(/Edg/) && !navigator.userAgent.match(/Chrome/)) {
        let fd = new FakeDash(video, url);
        video = fd.ogv;
        fd.load();
        fd.onsegmentloaded = (arr) => {
            let len = arr.byteLength;
            segmentSizes.push(len);
            segmentTimes.push(Date.now() - startTime);
        };
        video.addEventListener('loadedmetadata', () => {
            let res = `${video.videoWidth}x${video.videoHeight}`;
            document.getElementById('res').textContent = res;
        });
        document.getElementById('quality').disabled = true;
    } else {
        let mp = dashjs.MediaPlayer().create();
        mp.initialize(video, url, true /* autoplay */);
        mp.on('fragmentLoadingCompleted', (event) => {
            //console.log(event);
            if (event.response) {
                let len = event.response.byteLength;
                //let index = event.request.startTime; // hack
                //segmentSizes[index] = len;
                segmentSizes.push(len);
                segmentTimes.push(Date.now() - startTime);
            }
        });
        mp.on('qualityChangeRendered', (event) => {
            let qual = event.newQuality;
            //let res = `${video.videoWidth}x${video.videoHeight}`;
            /*
            console.log({
                qual,
                reso: config.resolutions
            })
            */
            let res = config.resolutions[config.resolutions.length - 1 - qual];
            document.getElementById('res').textContent = `${res[0]}x${res[1]}`;
        });
        var quality = document.getElementById('quality');
        quality.selectedIndex = 0;
        quality.addEventListener('change', () => {
            console.log(quality.value);
            if (quality.value == 'auto') {
                mp.updateSettings({
                    'streaming': {
                        'abr': {
                            'autoSwitchBitrate': {
                                'video': true
                            }
                        }
                    }
                });
            } else {
                mp.updateSettings({
                    'streaming': {
                        'abr': {
                            'autoSwitchBitrate': {
                                'video': false
                            }
                        }
                    }
                });
                mp.setQualityFor('video', parseInt(quality.value, 10));
            }
        });
    }
    video.addEventListener('timeupdate', () => {
        updateBandwidth();
    });
    video.addEventListener('ended', () => {
        console.log('LKDJFLKJSDFLKJFLSDKSDJF');
        document.location.reload();
    })
}

function awaitVideo(url) {
    fetch(url).then((response) => {
        if (response.status == 404) {
            setTimeout(() => {
                awaitVideo(url);
            }, 250);
        } else {
            showVideo(url);
        }
    });
}

function awaitEncoding() {
    fetch('/current').then((response) => {
        return response.json();
    }).then((url) => {
        if (!url) {
            currentUrl = url;
            document.getElementById('encode').disabled = false;
            setTimeout(() => {
                awaitEncoding();
            }, 250);
        } else if (url == currentUrl) {
            setTimeout(() => {
                awaitEncoding();
            }, 250);
        } else {
            currentUrl = url;
            document.getElementById('encode').disabled = true;
            awaitVideo(url);
        }
    });
}

document.getElementById('encode').onclick = function(event) {
    this.disabled = true;
    output.textContent = 'contacting server';

    fetch('/encode', {
        method: 'POST',
        body: 'do it' // ignored
    }).then(response => response.json()).then((url) => {
        this.disabled = false;
        awaitVideo(url);
    });
};

function awaitConfig() {
    fetch('/config').then((res) => {
        return res.json();
    }).then((config_) => {
        config = config_;
        let quality = document.getElementById('quality');
        for (let i = 0; i < config.resolutions.length; i++) {
            let res = config.resolutions[i];
            let opt = document.createElement('option');
            opt.value = `${config.resolutions.length - 1 - i}`;
            opt.textContent = `${res[0]}x${res[1]}`;
            quality.appendChild(opt);
        }
        awaitEncoding();
    });
}
awaitConfig();
